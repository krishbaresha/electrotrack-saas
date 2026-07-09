package com.example.data.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.io.IOException

// Mocking Database/DAO entities for compilation & logical completeness
data class OfflineActionEntity(
    val id: String,
    val payload: String,
    var isSynced: Boolean = false
)

interface OfflineActionDao {
    fun getUnsyncedActions(): List<OfflineActionEntity>
    fun markAsSynced(id: String)
}

interface NestJsApiService {
    fun syncPayload(payload: String): Int // returns status code
}

class SyncWorker(
    context: Context,
    params: WorkerParameters,
    private val actionDao: OfflineActionDao? = null,
    private val apiService: NestJsApiService? = null
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Retrieve offline actions needing syncing
        val actions = actionDao?.getUnsyncedActions() ?: emptyList()
        
        var hasFailure = false

        for (action in actions) {
            try {
                // Perform HTTP sync action with backend
                val statusCode = apiService?.syncPayload(action.payload) ?: 500
                
                if (statusCode == 200 || statusCode == 201) {
                    // Database Transactional Safety: Mark as synced ONLY on success status codes (200/201)
                    actionDao?.markAsSynced(action.id)
                } else {
                    // Transient network or server error, trigger retry policy
                    hasFailure = true
                }
            } catch (e: IOException) {
                // Network outage or timeout, retry with backoff policy
                hasFailure = true
            } catch (e: Exception) {
                // Critical or unhandled exception
                hasFailure = true
            }
        }

        return if (hasFailure) {
            Result.retry()
        } else {
            Result.success()
        }
    }
}
