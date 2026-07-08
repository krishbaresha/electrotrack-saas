package com.example.data.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.example.data.local.TokenManager
import com.example.data.local.dao.OfflineActionDao
import com.example.data.local.entity.ActionStatus
import com.example.data.local.entity.OfflineActionEntity
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * SyncWorker — WorkManager worker that drains the offline action queue.
 *
 * ## When it runs
 * Scheduled via [SyncWorker.enqueue] with [NetworkType.CONNECTED] constraint.
 * WorkManager retries automatically with exponential back-off if the device
 * loses connectivity mid-flight.
 *
 * ## Dispatch order
 * Actions are fetched ordered by (priority ASC, created_at ASC), ensuring
 * high-priority mutations (e.g., return approvals) replay before routine sales.
 *
 * ## Retry logic
 * - 2xx response → marked DONE.
 * - 4xx response → marked FAILED immediately (client error, do not retry).
 * - 5xx / IOException → retryCount++ and retried up to [OfflineActionEntity.MAX_RETRY_COUNT].
 *
 * ## Real-time bridge
 * After each successful sync flush, emits a Socket.io event via [SocketEventBus]
 * so connected web dashboard sessions receive live updates without polling.
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted workerParams: WorkerParameters,
    private val offlineActionDao: OfflineActionDao,
    private val tokenManager: TokenManager,
    private val socketEventBus: SocketEventBus,
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "SyncWorker"
        private const val WORK_NAME = "techbill_sync_worker"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        /**
         * Enqueue a periodic sync attempt with network constraint.
         * Uses [ExistingPeriodicWorkPolicy.KEEP] to avoid duplicate workers.
         */
        fun enqueue(workManager: WorkManager) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(
                repeatInterval = 15,
                repeatIntervalTimeUnit = TimeUnit.MINUTES,
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS,
                )
                .build()

            workManager.enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        /**
         * Enqueue a one-shot immediate sync (e.g., called on network reconnect signal).
         */
        fun enqueueOneShot(workManager: WorkManager) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()

            workManager.enqueueUniqueWork(
                "${WORK_NAME}_oneshot",
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }

    // ─── OkHttp client — reuse across dispatches ───────────────────────────────

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    // ─── Worker entry point ────────────────────────────────────────────────────

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.i(TAG, "SyncWorker started — draining pending action queue")

        val accessToken = tokenManager.getAccessToken()
        if (accessToken.isNullOrBlank()) {
            Log.w(TAG, "No access token available — skipping sync")
            return@withContext Result.success()   // Not retryable — user must re-login
        }

        val subdomain = tokenManager.getSubdomain() ?: "app"
        val baseUrl = "https://$subdomain.api.techbill.app/api"

        // Fetch pending actions ordered by priority then creation time
        val pendingActions = offlineActionDao.getPendingActions()

        if (pendingActions.isEmpty()) {
            Log.d(TAG, "No pending actions — nothing to sync")
            return@withContext Result.success()
        }

        Log.i(TAG, "Dispatching ${pendingActions.size} queued actions")

        var anyFailedRetryable = false

        for (action in pendingActions) {
            val dispatched = dispatchAction(action, baseUrl, accessToken)

            when (dispatched) {
                DispatchResult.SUCCESS -> {
                    offlineActionDao.markDone(action.id)
                    Log.d(TAG, "Action ${action.id} [${action.entityType}] → DONE")

                    // Emit real-time event to connected webapp via Socket.io bridge
                    socketEventBus.emitSyncEvent(
                        entityType = action.entityType,
                        entityId   = action.entityId,
                        payload    = action.payload,
                    )
                }
                DispatchResult.CLIENT_ERROR -> {
                    // 4xx — do not retry; mark as permanent failure
                    offlineActionDao.markFailed(action.id, "Client error (4xx) — not retryable")
                    Log.w(TAG, "Action ${action.id} permanently failed (4xx)")
                }
                DispatchResult.SERVER_ERROR -> {
                    val newRetryCount = action.retryCount + 1
                    if (newRetryCount >= OfflineActionEntity.MAX_RETRY_COUNT) {
                        offlineActionDao.markFailed(action.id, "Max retries (${OfflineActionEntity.MAX_RETRY_COUNT}) exceeded")
                        Log.e(TAG, "Action ${action.id} exceeded max retries — marked FAILED")
                    } else {
                        offlineActionDao.incrementRetry(action.id, newRetryCount)
                        Log.w(TAG, "Action ${action.id} failed (5xx) — retry ${newRetryCount}/${OfflineActionEntity.MAX_RETRY_COUNT}")
                        anyFailedRetryable = true
                    }
                }
            }
        }

        // If any server errors remain, signal WorkManager to retry the worker
        if (anyFailedRetryable) Result.retry() else Result.success()
    }

    // ─── Dispatch single action ────────────────────────────────────────────────

    private fun dispatchAction(
        action: OfflineActionEntity,
        baseUrl: String,
        accessToken: String,
    ): DispatchResult {
        val url = "$baseUrl${action.endpoint}"

        val requestBody = action.payload?.toRequestBody(JSON_MEDIA_TYPE)

        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $accessToken")
            .header("X-Client-Source", "mobile")
            .method(action.httpMethod, requestBody)
            .build()

        return try {
            httpClient.newCall(request).execute().use { response ->
                when {
                    response.isSuccessful  -> DispatchResult.SUCCESS
                    response.code in 400..499 -> DispatchResult.CLIENT_ERROR
                    else                   -> DispatchResult.SERVER_ERROR
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "Network error dispatching action ${action.id}", e)
            DispatchResult.SERVER_ERROR   // Retryable — transient connectivity issue
        }
    }

    private enum class DispatchResult { SUCCESS, CLIENT_ERROR, SERVER_ERROR }
}

// ─── SocketEventBus ───────────────────────────────────────────────────────────

/**
 * SocketEventBus — thin abstraction over the Socket.io client.
 *
 * After a successful sync flush, the SyncWorker calls [emitSyncEvent] to push
 * a structured real-time event to the connected webapp (running on a laptop/desktop).
 * The webapp's Socket.io server listener responds by reloading the affected entity.
 *
 * Bind the concrete implementation via Hilt in your ApplicationModule:
 * ```kotlin
 * @Binds abstract fun bindSocketEventBus(impl: SocketIoEventBus): SocketEventBus
 * ```
 *
 * The concrete [SocketIoEventBus] holds the `socket.io-client` Socket instance,
 * which must be connected (or auto-reconnect) when the app has network access.
 */
interface SocketEventBus {
    /**
     * Emit a `sync_event` to the Socket.io server.
     *
     * @param entityType  e.g. "return", "sale", "inventory_unit"
     * @param entityId    Server-side UUID of the affected entity (may be null for creates)
     * @param payload     Original JSON payload that was sent to the REST endpoint
     */
    fun emitSyncEvent(entityType: String, entityId: String?, payload: String?)
}
