package com.example.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * OfflineActionEntity — Room entity for the offline-first action queue.
 *
 * When the device has no network, any mutation (sale, return approval, etc.)
 * is stored here. The [SyncWorker] drains this table sequentially once
 * connectivity is restored, replaying each action against the backend API.
 *
 * Design notes:
 * - [id] is a client-generated UUID so actions survive process kills without collision.
 * - [payload] is a JSON string — serialized with kotlinx.serialization or Gson.
 * - [retryCount] caps retries to avoid infinite loops on server-side rejections.
 * - [status] drives the SyncWorker state machine (PENDING → IN_FLIGHT → DONE | FAILED).
 * - [createdAt] preserves server-side chronological ordering on replay.
 */
@Entity(
    tableName = "offline_actions",
    indices = [
        Index(value = ["status"]),
        Index(value = ["created_at"]),
        Index(value = ["entity_type", "entity_id"]),
    ],
)
data class OfflineActionEntity(

    /** Client-side UUID primary key — generated before any network call. */
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String = UUID.randomUUID().toString(),

    /**
     * HTTP method that will be replayed: GET | POST | PUT | PATCH | DELETE.
     * Stored as a plain string to avoid enum migration headaches.
     */
    @ColumnInfo(name = "http_method")
    val httpMethod: String,

    /**
     * Relative API path, e.g. "/returns/abc-123/approve" or "/sales".
     * The SyncWorker prepends the base URL at dispatch time.
     */
    @ColumnInfo(name = "endpoint")
    val endpoint: String,

    /**
     * JSON-serialized request body. Null for DELETE/GET actions.
     * Example: '{"returnType":"cash_refund","reason":"Customer request"}'
     */
    @ColumnInfo(name = "payload")
    val payload: String? = null,

    /**
     * Human-readable entity type for lookup and deduplication.
     * Examples: "sale", "return", "inventory_unit", "reconciliation"
     */
    @ColumnInfo(name = "entity_type")
    val entityType: String,

    /**
     * Optional server-side entity UUID. Set when the action targets an
     * existing resource (PATCH/DELETE). Null for creation actions (POST).
     */
    @ColumnInfo(name = "entity_id")
    val entityId: String? = null,

    /**
     * Current processing state of this action.
     * @see ActionStatus
     */
    @ColumnInfo(name = "status")
    val status: String = ActionStatus.PENDING,

    /**
     * Number of failed dispatch attempts. The SyncWorker stops retrying
     * after [MAX_RETRY_COUNT] failures and marks the action as FAILED.
     */
    @ColumnInfo(name = "retry_count")
    val retryCount: Int = 0,

    /**
     * Last error message returned by the server or thrown locally.
     * Persisted for diagnostics — shown in the offline-sync debug UI.
     */
    @ColumnInfo(name = "last_error")
    val lastError: String? = null,

    /**
     * Unix epoch millis when this action was first queued.
     * Used to preserve ordering and detect stale actions.
     */
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    /**
     * Unix epoch millis of last dispatch attempt. Null if never tried.
     */
    @ColumnInfo(name = "last_attempted_at")
    val lastAttemptedAt: Long? = null,

    /**
     * Priority level for ordering. Lower value = dispatched first.
     * Use [ActionPriority] constants. Defaults to NORMAL (100).
     */
    @ColumnInfo(name = "priority")
    val priority: Int = ActionPriority.NORMAL,
) {
    companion object {
        const val MAX_RETRY_COUNT = 5
    }
}

// ─── Status constants ──────────────────────────────────────────────────────────

object ActionStatus {
    /** Queued, not yet attempted. */
    const val PENDING = "PENDING"

    /** Currently being dispatched by SyncWorker. */
    const val IN_FLIGHT = "IN_FLIGHT"

    /** Successfully received a 2xx response from the server. */
    const val DONE = "DONE"

    /** Exhausted retries or received a non-retryable error (4xx). */
    const val FAILED = "FAILED"
}

// ─── Priority constants ────────────────────────────────────────────────────────

object ActionPriority {
    /** Return approvals/rejections — time-sensitive. */
    const val HIGH = 10

    /** Standard sales, inventory mutations. */
    const val NORMAL = 100

    /** Background reconciliation updates. */
    const val LOW = 200
}
