package com.example.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

/**
 * TokenManager — encrypted, persistent credential and session storage for TechBill mobile.
 *
 * ## Multi-Tenant Session Design
 * Every tenant session is strictly isolated by `tenantId`. All Room queries are
 * downstream-filtered by this value. On `clearSession()`, all credential fields and
 * tenant-scoped prefs are atomically wiped so a prior session cannot leak into the next.
 *
 * ## WhatsApp-Mode Session Persistence
 * Mobile sessions are issued 10-year JWTs by the backend when `clientSource=mobile`.
 * TokenManager does NOT auto-clear credentials on token age. Credentials are only wiped
 * on an explicit [clearSession] call (user-initiated logout or server-initiated revocation).
 *
 * ## Security
 * Credentials are stored in [EncryptedSharedPreferences] backed by Android Keystore.
 * The master key uses AES256-GCM, which is hardware-backed on supported devices.
 *
 * ## Manual DI
 * This class uses a plain constructor — no Hilt/Dagger annotations. Instantiate directly
 * in [MainActivity] or any non-Hilt factory.
 */
class TokenManager(context: Context) {

    companion object {
        private const val PREFS_FILE = "techbill_secure_prefs"

        const val KEY_ACCESS_TOKEN            = "access_token"
        const val KEY_REFRESH_TOKEN           = "refresh_token"
        const val KEY_USER_ID                 = "user_id"
        const val KEY_USER_EMAIL              = "user_email"
        const val KEY_USER_ROLE               = "user_role"
        const val KEY_USER_NAME               = "user_name"
        const val KEY_TENANT_ID               = "tenant_id"
        const val KEY_TENANT_NAME             = "tenant_name"
        const val KEY_SUBDOMAIN               = "subdomain"
        const val KEY_PERMISSIONS             = "permissions"
        const val KEY_WAREHOUSE_ENABLED       = "is_warehouse_enabled"
        const val KEY_ONLINE_SELLING_ENABLED  = "online_selling_enabled"
        const val KEY_APP_ACCESS_ENABLED      = "app_access_enabled"
        const val KEY_CURRENT_PERIOD_END      = "current_period_end"
        const val KEY_PUSH_NOTIFICATIONS      = "push_notifications_enabled"
        const val KEY_CLIENT_SOURCE           = "client_source"
        const val KEY_SAVED_AT_MILLIS         = "saved_at_millis"
    }

    // ─── EncryptedSharedPreferences (lazy — initialized once) ─────────────────

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    // ─── Reactive Flows via SharedPreferences.OnSharedPreferenceChangeListener ─

    /**
     * Generic helper that creates a cold [Flow] backed by a SharedPreferences key.
     * Emits the current value immediately on collection, then re-emits on every
     * downstream preference change for that key.
     */
    private fun preferenceFlow(key: String, default: String?): Flow<String?> =
        callbackFlow {
            trySend(prefs.getString(key, default))
            val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, changedKey ->
                if (changedKey == key) {
                    trySend(prefs.getString(key, default))
                }
            }
            prefs.registerOnSharedPreferenceChangeListener(listener)
            awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
        }.distinctUntilChanged()

    private fun preferenceBoolFlow(key: String, default: Boolean): Flow<Boolean> =
        callbackFlow {
            trySend(prefs.getBoolean(key, default))
            val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, changedKey ->
                if (changedKey == key) {
                    trySend(prefs.getBoolean(key, default))
                }
            }
            prefs.registerOnSharedPreferenceChangeListener(listener)
            awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
        }.distinctUntilChanged()

    // ─── Public reactive streams ───────────────────────────────────────────────

    val accessToken: Flow<String?>  = preferenceFlow(KEY_ACCESS_TOKEN, null)
    val refreshToken: Flow<String?> = preferenceFlow(KEY_REFRESH_TOKEN, null)
    val userName: Flow<String?>     = preferenceFlow(KEY_USER_NAME, null)
    val userEmail: Flow<String?>    = preferenceFlow(KEY_USER_EMAIL, null)
    val userRole: Flow<String?>     = preferenceFlow(KEY_USER_ROLE, null)

    /** Emits the current session's tenant ID. Downstream Room queries must filter by this value. */
    val tenantId: Flow<String?>     = preferenceFlow(KEY_TENANT_ID, null)

    val onlineSellingEnabled: Flow<Boolean>  = preferenceBoolFlow(KEY_ONLINE_SELLING_ENABLED, false)
    val appAccessEnabled: Flow<Boolean>      = preferenceBoolFlow(KEY_APP_ACCESS_ENABLED, false)
    val currentPeriodEnd: Flow<String?>      = preferenceFlow(KEY_CURRENT_PERIOD_END, null)
    val pushNotificationsEnabled: Flow<Boolean> = preferenceBoolFlow(KEY_PUSH_NOTIFICATIONS, true)

    // ─── Synchronous reads (for use in OkHttp interceptors / WorkManager) ─────

    fun getAccessToken(): String?   = prefs.getString(KEY_ACCESS_TOKEN, null)
    fun getRefreshToken(): String?  = prefs.getString(KEY_REFRESH_TOKEN, null)
    fun getUserId(): String?        = prefs.getString(KEY_USER_ID, null)
    fun getUserEmail(): String?     = prefs.getString(KEY_USER_EMAIL, null)
    fun getUserRole(): String?      = prefs.getString(KEY_USER_ROLE, null)
    fun getUserName(): String?      = prefs.getString(KEY_USER_NAME, null)
    fun getTenantId(): String?      = prefs.getString(KEY_TENANT_ID, null)
    fun getTenantName(): String?    = prefs.getString(KEY_TENANT_NAME, null)
    fun getSubdomain(): String?     = prefs.getString(KEY_SUBDOMAIN, null)
    fun getClientSource(): String?  = prefs.getString(KEY_CLIENT_SOURCE, null)
    fun isWarehouseEnabled(): Boolean = prefs.getBoolean(KEY_WAREHOUSE_ENABLED, false)
    fun isLoggedIn(): Boolean = !getAccessToken().isNullOrBlank()

    fun getPermissions(): List<String> {
        val raw = prefs.getString(KEY_PERMISSIONS, null) ?: return emptyList()
        return raw.split(",").filter { it.isNotBlank() }
    }

    // ─── Write ────────────────────────────────────────────────────────────────

    /**
     * Persist access + refresh tokens received from the backend.
     * Call once after a successful login response.
     */
    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_SAVED_AT_MILLIS, System.currentTimeMillis())
            .apply()
    }

    /**
     * Persist user profile fields decoded from the `GET auth/me` response.
     * Calling this after login ensures all reactive Flows immediately re-emit
     * with the authenticated user's context.
     */
    fun saveUser(
        email: String,
        name: String,
        role: String?,
        tenantId: String? = null,
        tenantName: String? = null,
        subdomain: String? = null,
        permissions: List<String> = emptyList(),
        onlineSellingEnabled: Boolean = false,
        appAccessEnabled: Boolean = false,
        currentPeriodEnd: String? = null,
        isWarehouseEnabled: Boolean = false,
        clientSource: String = "mobile",
    ) {
        prefs.edit()
            .putString(KEY_USER_EMAIL, email)
            .putString(KEY_USER_NAME, name)
            .putString(KEY_USER_ROLE, role)
            .putString(KEY_TENANT_ID, tenantId)
            .putString(KEY_TENANT_NAME, tenantName)
            .putString(KEY_SUBDOMAIN, subdomain)
            .putString(KEY_PERMISSIONS, permissions.joinToString(","))
            .putBoolean(KEY_ONLINE_SELLING_ENABLED, onlineSellingEnabled)
            .putBoolean(KEY_APP_ACCESS_ENABLED, appAccessEnabled)
            .putString(KEY_CURRENT_PERIOD_END, currentPeriodEnd)
            .putBoolean(KEY_WAREHOUSE_ENABLED, isWarehouseEnabled)
            .putString(KEY_CLIENT_SOURCE, clientSource)
            .apply()
    }

    /**
     * Convenience write — update only the user's role without requiring a full re-login.
     * Useful when role is determined via a separate `/tenants/me/config` round-trip.
     */
    fun saveUserRole(role: String) {
        prefs.edit().putString(KEY_USER_ROLE, role).apply()
    }

    /**
     * Refresh the warehouse feature flag from the latest `/tenants/me/config` response
     * without requiring a full re-login.
     */
    fun updateWarehouseEnabled(isEnabled: Boolean) {
        prefs.edit().putBoolean(KEY_WAREHOUSE_ENABLED, isEnabled).apply()
    }

    /**
     * Toggle push notifications preference from the Profile screen.
     */
    fun setPushNotificationsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_PUSH_NOTIFICATIONS, enabled).apply()
    }

    // ─── Wipe ─────────────────────────────────────────────────────────────────

    /**
     * Hard-wipes all stored credentials and session data.
     *
     * After clearing, all reactive [Flow]s emit `null` / default values, which triggers
     * the `isLoggedIn` StateFlow to become `false` and the UI to navigate to the Login screen.
     *
     * MUST be called only on:
     *   1. Explicit user-initiated logout action.
     *   2. Server returning HTTP 401 with `code: "SESSION_REVOKED"` in body.
     *   3. Before starting a new login attempt (pre-login flush for session isolation).
     */
    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
