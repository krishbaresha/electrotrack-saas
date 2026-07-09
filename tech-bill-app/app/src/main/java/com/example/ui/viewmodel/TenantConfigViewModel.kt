package com.example.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.TokenManager
import com.example.data.remote.ApiService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * TenantConfigViewModel — manages live tenant config state for the current session.
 *
 * ## Manual DI (No Hilt)
 * Instantiated via [TenantConfigViewModelFactory] in any Activity or Fragment that
 * needs tenant config state independently of [SaaSViewModel]. In the current architecture,
 * tenant config is managed directly inside [SaaSViewModel.triggerSync] / [SaaSDataRepository.syncProfile],
 * so this ViewModel is an optional secondary consumer.
 *
 * ## Data flow
 * 1. [TokenManager] provides the last-persisted warehouse flag for instant display.
 * 2. [refreshConfig] fetches `GET /tenants/me/config` and updates both the
 *    in-memory [StateFlow] and the persisted [TokenManager] value simultaneously.
 *    This ensures the correct value survives app restarts.
 */
class TenantConfigViewModel(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
) : ViewModel() {

    companion object {
        private const val TAG = "TenantConfigVM"
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /** Seed from persisted prefs so the UI has an instant value before network. */
    private val _isWarehouseEnabled = MutableStateFlow(tokenManager.isWarehouseEnabled())
    val isWarehouseEnabled: StateFlow<Boolean> = _isWarehouseEnabled.asStateFlow()

    private val _role = MutableStateFlow(tokenManager.getUserRole() ?: "")
    val role: StateFlow<String> = _role.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // ─── Init — refresh on ViewModel creation ─────────────────────────────────

    init {
        refreshConfig()
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Fetches the latest tenant config from `GET /tenants/me/config`.
     * Call this:
     *   - On successful login.
     *   - On app foreground resume.
     *   - After a subscription change event received via Socket.io.
     */
    fun refreshConfig() {
        if (!tokenManager.isLoggedIn()) return

        viewModelScope.launch {
            _isLoading.value = true
            try {
                val config = apiService.getTenantConfig()

                // Update in-memory state
                _isWarehouseEnabled.value = config.isWarehouseEnabled
                _role.value = config.role

                // Persist for next cold start
                tokenManager.updateWarehouseEnabled(config.isWarehouseEnabled)
                tokenManager.saveUserRole(config.role)

                Log.d(TAG, "Config refreshed — warehouse=${config.isWarehouseEnabled}, role=${config.role}")
            } catch (e: Exception) {
                // Non-fatal: fall back to persisted value from TokenManager.
                Log.w(TAG, "Failed to refresh tenant config — using persisted value", e)
            } finally {
                _isLoading.value = false
            }
        }
    }
}
