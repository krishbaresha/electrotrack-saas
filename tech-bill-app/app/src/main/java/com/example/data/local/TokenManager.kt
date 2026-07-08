package com.example.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * TokenManager — encrypted, persistent credential storage for TechBill mobile.
 *
 * ## WhatsApp-Mode Session Persistence
 * Mobile sessions are issued 10-year JWTs by the backend when `clientSource=mobile`.
 * TokenManager intentionally does NOT auto-clear credentials on token age or
 * standard expiry log events. Credentials are only wiped on an explicit [clearAll]
 * call (user-initiated logout or manual cache clear from Settings).
 *
 * ## Security
 * Credentials are stored in [EncryptedSharedPreferences] backed by Android Keystore.
 * The master key uses AES256-GCM, which is hardware-backed on supported devices.
 *
 * ## Usage
 *  - On login response: call [saveTokens] + [saveUserProfile]
 *  - On every API request: attach [getAccessToken] as Bearer header
 *  - On logout tap: call [clearAll]
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    companion object {
        private const val PREFS_FILE = "techbill_secure_prefs"

        private const val KEY_ACCESS_TOKEN     = "access_token"
        private const val KEY_REFRESH_TOKEN    = "refresh_token"
        private const val KEY_USER_ID          = "user_id"
        private const val KEY_USER_EMAIL       = "user_email"
        private const val KEY_USER_ROLE        = "user_role"
        private const val KEY_USER_NAME        = "user_name"
        private const val KEY_TENANT_ID        = "tenant_id"
        private const val KEY_TENANT_NAME      = "tenant_name"
        private const val KEY_SUBDOMAIN        = "subdomain"
        private const val KEY_PERMISSIONS      = "permissions"
        private const val KEY_WAREHOUSE_ENABLED = "is_warehouse_enabled"
        private const val KEY_CLIENT_SOURCE    = "client_source"
        private const val KEY_SAVED_AT_MILLIS  = "saved_at_millis"
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

    // ─── Write ────────────────────────────────────────────────────────────────

    /**
     * Persist access + refresh tokens received from the backend.
     * Call once after a successful login response.
     *
     * IMPORTANT: This method intentionally stores tokens without any TTL
     * enforcement. Mobile clients receive 3650d tokens — the backend is the
     * source of truth for revocation, not the client-side timer.
     */
    fun saveTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_SAVED_AT_MILLIS, System.currentTimeMillis())
            .apply()
    }

    /**
     * Persist user profile fields decoded from the login response body.
     */
    fun saveUserProfile(
        userId: String,
        email: String,
        role: String,
        name: String,
        tenantId: String?,
        tenantName: String?,
        subdomain: String?,
        permissions: List<String>,
        isWarehouseEnabled: Boolean,
        clientSource: String = "mobile",
    ) {
        prefs.edit()
            .putString(KEY_USER_ID, userId)
            .putString(KEY_USER_EMAIL, email)
            .putString(KEY_USER_ROLE, role)
            .putString(KEY_USER_NAME, name)
            .putString(KEY_TENANT_ID, tenantId)
            .putString(KEY_TENANT_NAME, tenantName)
            .putString(KEY_SUBDOMAIN, subdomain)
            .putString(KEY_PERMISSIONS, permissions.joinToString(","))
            .putBoolean(KEY_WAREHOUSE_ENABLED, isWarehouseEnabled)
            .putString(KEY_CLIENT_SOURCE, clientSource)
            .apply()
    }

    /**
     * Refresh the warehouse feature flag from the latest /tenants/me/config response
     * without requiring a full re-login.
     */
    fun updateWarehouseEnabled(isEnabled: Boolean) {
        prefs.edit().putBoolean(KEY_WAREHOUSE_ENABLED, isEnabled).apply()
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

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

    fun getPermissions(): List<String> {
        val raw = prefs.getString(KEY_PERMISSIONS, null) ?: return emptyList()
        return raw.split(",").filter { it.isNotBlank() }
    }

    /**
     * Returns true when a valid access token is present in the store.
     *
     * NOTE: We do NOT check token expiry locally. The 10-year mobile token
     * is effectively permanent. Server-side 401 responses trigger a
     * re-authentication flow through [AuthViewModel], not an automatic clear here.
     */
    fun isLoggedIn(): Boolean = !getAccessToken().isNullOrBlank()

    // ─── Wipe ─────────────────────────────────────────────────────────────────

    /**
     * Hard-wipes all stored credentials and profile data.
     *
     * MUST be called only on:
     *   1. Explicit user-initiated logout action.
     *   2. Server returning HTTP 401 with `code: "SESSION_REVOKED"` in body.
     *   3. Manual "Clear App Data" from device Settings.
     *
     * DO NOT call this automatically on expiry events, background token age
     * checks, or foreground resume hooks — that would break the offline-first
     * WhatsApp-mode persistent session guarantee.
     */
    fun clearAll() {
        prefs.edit().clear().apply()
    }
}
