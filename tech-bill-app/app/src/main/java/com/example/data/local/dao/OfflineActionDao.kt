package com.example.data.local.dao

import androidx.room.*
import com.example.data.local.entity.ActionStatus
import com.example.data.local.entity.OfflineActionEntity

/**
 * OfflineActionDao — Room data access object for the offline action queue.
 *
 * Query ordering: priority ASC (lower = higher priority), then created_at ASC
 * (FIFO within same priority tier) to preserve transactional order on replay.
 */
@Dao
interface OfflineActionDao {

    // ─── Reads ────────────────────────────────────────────────────────────────

    /** Returns all PENDING actions ordered by priority then creation time. */
    @Query(
        """
        SELECT * FROM offline_actions
        WHERE status = :status
        ORDER BY priority ASC, created_at ASC
        """
    )
    suspend fun getPendingActions(status: String = ActionStatus.PENDING): List<OfflineActionEntity>

    /** Returns the total count of unprocessed actions for badge indicators. */
    @Query("SELECT COUNT(*) FROM offline_actions WHERE status = :status")
    suspend fun countPending(status: String = ActionStatus.PENDING): Int

    /** Lookup a specific action by its client-generated ID. */
    @Query("SELECT * FROM offline_actions WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): OfflineActionEntity?

    // ─── Writes ───────────────────────────────────────────────────────────────

    /**
     * Insert a new offline action. On conflict (same ID), replace to allow
     * idempotent re-queuing of the same logical operation.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(action: OfflineActionEntity)

    /**
     * Bulk insert for batched creation — e.g., importing an offline sale with
     * multiple line items as separate actions.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(actions: List<OfflineActionEntity>)

    // ─── Status transitions ───────────────────────────────────────────────────

    @Query(
        """
        UPDATE offline_actions
        SET status = '${ActionStatus.IN_FLIGHT}', last_attempted_at = :now
        WHERE id = :id
        """
    )
    suspend fun markInFlight(id: String, now: Long = System.currentTimeMillis())

    @Query(
        """
        UPDATE offline_actions
        SET status = '${ActionStatus.DONE}'
        WHERE id = :id
        """
    )
    suspend fun markDone(id: String)

    @Query(
        """
        UPDATE offline_actions
        SET status = '${ActionStatus.FAILED}', last_error = :error
        WHERE id = :id
        """
    )
    suspend fun markFailed(id: String, error: String)

    @Query(
        """
        UPDATE offline_actions
        SET retry_count = :retryCount,
            status = '${ActionStatus.PENDING}',
            last_attempted_at = :now
        WHERE id = :id
        """
    )
    suspend fun incrementRetry(id: String, retryCount: Int, now: Long = System.currentTimeMillis())

    // ─── Maintenance ──────────────────────────────────────────────────────────

    /** Prune successfully synced actions older than [thresholdMillis] to prevent unbounded growth. */
    @Query(
        """
        DELETE FROM offline_actions
        WHERE status = '${ActionStatus.DONE}'
        AND created_at < :thresholdMillis
        """
    )
    suspend fun pruneCompleted(thresholdMillis: Long)

    /** Full wipe on logout — ensures no cross-session data leakage. */
    @Query("DELETE FROM offline_actions")
    suspend fun deleteAll()
}
