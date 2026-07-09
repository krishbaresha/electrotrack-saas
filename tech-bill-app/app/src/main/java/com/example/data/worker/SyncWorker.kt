package com.example.data.worker

import android.content.Context
import androidx.work.*
import com.example.data.local.AppDatabase
import com.example.data.local.TokenManager
import com.example.data.remote.RetrofitClient
import kotlinx.coroutines.flow.firstOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * SyncWorker — a [CoroutineWorker] that drains the offline-action queue in the background.
 *
 * ## Manual DI (No Hilt)
 * Dependencies are resolved directly from singleton references:
 * - [AppDatabase.getDatabase] for the Room database singleton.
 * - A locally instantiated [TokenManager] using the app context.
 *
 * ## SocketEventBus
 * An anonymous inner object implements the [SocketEventBus] interface to broadcast
 * success/failure events back to any connected UI observers.
 */
class SyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        // ── Manual DI resolution ─────────────────────────────────────────────
        val tokenManager = TokenManager(applicationContext)
        val db = AppDatabase.getDatabase(applicationContext)
        val offlineActionDao = db.offlineActionDao()
        val apiService = RetrofitClient.createApiService(applicationContext, tokenManager)

        val token = tokenManager.accessToken.firstOrNull()
        if (token.isNullOrEmpty()) {
            return Result.success() // Nothing to sync without an authenticated session
        }

        // ── Anonymous SocketEventBus observer ────────────────────────────────
        val eventBus = object : SocketEventBus {
            override fun onEvent(event: String, data: String) {
                android.util.Log.d("SyncWorker", "SocketEvent[$event]: $data")
            }
        }

        val pendingActions = offlineActionDao.getPendingActions()
        if (pendingActions.isEmpty()) return Result.success()

        var hadFailures = false

        for (action in pendingActions) {
            try {
                offlineActionDao.markInFlight(action.id)

                val okHttpClient = okhttp3.OkHttpClient.Builder().build()
                val mediaType = "application/json; charset=utf-8".toMediaType()
                val body = (action.payload ?: "{}").toRequestBody(mediaType)

                val baseUrl = "https://electrotrack-saas.onrender.com/"
                val requestBuilder = okhttp3.Request.Builder()
                    .url("$baseUrl${action.endpoint}")
                    .header("Authorization", "Bearer $token")

                val request = when (action.httpMethod.uppercase()) {
                    "POST"   -> requestBuilder.post(body).build()
                    "PUT"    -> requestBuilder.put(body).build()
                    "PATCH"  -> requestBuilder.patch(body).build()
                    "DELETE" -> requestBuilder.delete().build()
                    else     -> requestBuilder.get().build()
                }

                val response = okHttpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    offlineActionDao.markDone(action.id)
                    eventBus.onEvent("sync_success", action.endpoint)
                } else {
                    offlineActionDao.markFailed(action.id, "HTTP ${response.code}")
                    eventBus.onEvent("sync_failure", "${action.endpoint}: HTTP ${response.code}")
                    hadFailures = true
                }
                response.close()
            } catch (e: Exception) {
                offlineActionDao.markFailed(action.id, e.message ?: "Unknown error")
                eventBus.onEvent("sync_error", e.message ?: "Unknown error")
                hadFailures = true
            }
        }

        return if (hadFailures) Result.retry() else Result.success()
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "TechBill_SyncWorker"

        /**
         * Enqueue a one-time sync when the device reconnects to network.
         */
        fun enqueueOneTime(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        /**
         * Enqueue a periodic sync every 15 minutes.
         */
        fun enqueuePeriodic(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(
                15, java.util.concurrent.TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    UNIQUE_WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request
                )
        }
    }
}

/**
 * Minimal event bus interface for broadcasting WorkManager sync outcomes to the UI layer.
 * Implementations can forward events to a SharedFlow or a Socket.IO client.
 */
interface SocketEventBus {
    fun onEvent(event: String, data: String)
}
