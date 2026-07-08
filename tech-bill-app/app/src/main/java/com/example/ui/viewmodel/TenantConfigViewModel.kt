package com.example.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.TokenManager
import com.example.data.remote.TechBillApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * TenantConfigViewModel — manages the live [TenantConfig] state for the current session.
 *
 * ## Lifecycle
 * Created once by Hilt at the NavHost scope and shared across all screens via
 * [hiltViewModel()]. Survives navigation events, recompositions, and process state
 * changes (within the ViewModel lifecycle).
 *
 * ## Data flow
 * 1. [TokenManager] provides the last-persisted warehouse flag for instant display.
 * 2. [refreshConfig] fetches `GET /tenants/me/config` and updates both the
 *    in-memory [StateFlow] and the persisted [TokenManager] value simultaneously.
 *    This means the correct value survives app restarts.
 *
 * ## Warehouse gating
 * The [isWarehouseEnabled] StateFlow is consumed in [AppNavigation] and [DashboardScreen]
 * to reactively gate the warehouse route and tab. No additional casting or local
 * re-check is needed downstream.
 */
@HiltViewModel
class TenantConfigViewModel @Inject constructor(
    private val apiService: TechBillApiService,
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
     *   - On successful login (in [AppNavigation] `onLoginSuccess` callback).
     *   - On app foreground resume (via [androidx.lifecycle.ProcessLifecycleOwner]).
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

                Log.d(TAG, "Config refreshed — warehouse=${config.isWarehouseEnabled}, role=${config.role}")

            } catch (e: Exception) {
                // Non-fatal: fall back to persisted value from TokenManager.
                // Do NOT clear session or navigate to login on config refresh failure.
                Log.w(TAG, "Failed to refresh tenant config — using persisted value", e)
            } finally {
                _isLoading.value = false
            }
        }
    }
}

// ─── Response model for /tenants/me/config ────────────────────────────────────

data class TenantConfigResponse(
    val isWarehouseEnabled: Boolean,
    val role: String,
)
