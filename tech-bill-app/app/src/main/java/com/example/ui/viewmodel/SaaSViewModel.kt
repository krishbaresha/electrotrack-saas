package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.InventoryItem
import com.example.data.model.SaleItem
import com.example.data.model.SalesSummary
import com.example.data.model.UserInfo
import com.example.data.repository.SaaSDataRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class SaaSViewModel(
    private val repository: SaaSDataRepository
) : ViewModel() {

    // ─── Session identity Flows ───────────────────────────────────────────────

    val accessToken: StateFlow<String?> = repository.getAccessTokenFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val userName: StateFlow<String?> = repository.getUserNameFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Guest")

    val userEmail: StateFlow<String?> = repository.getUserEmailFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    val userRole: StateFlow<String?> = repository.getUserRoleFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val tenantId: StateFlow<String?> = repository.getTenantIdFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val onlineSellingEnabled: StateFlow<Boolean> = repository.getOnlineSellingEnabledFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val appAccessEnabled: StateFlow<Boolean> = repository.getAppAccessEnabledFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val currentPeriodEnd: StateFlow<String?> = repository.getCurrentPeriodEndFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val pushNotificationsEnabled: StateFlow<Boolean> = repository.getPushNotificationsEnabledFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    val isLoggedIn: StateFlow<Boolean> = accessToken
        .map { !it.isNullOrEmpty() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    // ─── Login form State ─────────────────────────────────────────────────────

    val loginEmail    = MutableStateFlow("")
    val loginPassword = MutableStateFlow("")

    private val _loginLoading = MutableStateFlow(false)
    val loginLoading: StateFlow<Boolean> = _loginLoading.asStateFlow()

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    // ─── Tenant-bounded Room Flows ────────────────────────────────────────────

    /**
     * Low-stock inventory items — strictly bounded by the active tenant session.
     * Switches automatically when tenantId changes (flatMapLatest in repository).
     */
    val lowStockItems: StateFlow<List<InventoryItem>> = repository.getInventoryFlow()
        .map { list -> list.filter { item -> item.quantity <= 5 } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _lowStockLoading = MutableStateFlow(false)
    val lowStockLoading: StateFlow<Boolean> = _lowStockLoading.asStateFlow()

    val recentSales: StateFlow<List<SaleItem>> = repository.getSalesFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _salesLoading = MutableStateFlow(false)
    val salesLoading: StateFlow<Boolean> = _salesLoading.asStateFlow()

    val onlineSales: StateFlow<List<SaleItem>> = repository.getOnlineSalesFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _onlineSalesLoading = MutableStateFlow(false)
    val onlineSalesLoading: StateFlow<Boolean> = _onlineSalesLoading.asStateFlow()

    /**
     * Sales summary — derived reactively from the Room-backed [recentSales] StateFlow.
     *
     * Because [recentSales] is already tenant-isolated via `tenantId.flatMapLatest`,
     * this derived StateFlow is automatically bounded by the active session. It never
     * requires a direct network call — the summary recomputes whenever Room emits new
     * sale data, ensuring the dashboard stays in sync with local cache writes.
     */
    val salesSummary: StateFlow<SalesSummary?> = recentSales
        .map { sales ->
            if (sales.isEmpty()) {
                null
            } else {
                SalesSummary(
                    totalRevenue = sales.sumOf { it.totalAmount },
                    transactionCount = sales.size,
                    pendingReturnCount = sales.count { it.payoutStatus == "Due" || it.courierStatus == "Returned" },
                    totalNetProfit = sales.sumOf { it.totalAmount * 0.15 }, // ~15% estimated margin
                    itemsSold = sales.sumOf { it.items?.size ?: 1 }
                )
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    val searchQuery = MutableStateFlow("")

    val showSubscriptionWarning: StateFlow<Boolean> = currentPeriodEnd.map { date ->
        isSubscriptionEndingSoon(date)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    // ─── Tenant admin State ───────────────────────────────────────────────────

    private val _tenants = MutableStateFlow<List<com.example.data.model.TenantModel>>(emptyList())
    val tenants: StateFlow<List<com.example.data.model.TenantModel>> = _tenants.asStateFlow()

    private val _tenantsLoading = MutableStateFlow(false)
    val tenantsLoading: StateFlow<Boolean> = _tenantsLoading.asStateFlow()

    // ─── Init — reactive sync on token presence ───────────────────────────────

    init {
        viewModelScope.launch {
            accessToken.collect { token ->
                if (!token.isNullOrEmpty()) {
                    triggerSync()
                }
            }
        }
        viewModelScope.launch {
            userRole.collect { role ->
                if (role == "platform_admin") {
                    fetchTenants()
                }
            }
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    fun triggerSync() {
        viewModelScope.launch {
            _isSyncing.value = true
            val profileResult = repository.syncProfile()
            if (profileResult.isFailure) {
                // Non-fatal: fall back to cached values
            }
            fetchDashboardData()
            _isSyncing.value = false
        }
    }

    private fun fetchDashboardData() {
        viewModelScope.launch {
            _lowStockLoading.value = true
            repository.fetchInventoryFromServer()
            _lowStockLoading.value = false
        }

        viewModelScope.launch {
            _salesLoading.value = true
            _onlineSalesLoading.value = true
            repository.fetchSalesFromServer()
            _salesLoading.value = false
            _onlineSalesLoading.value = false
        }
    }

    fun login() {
        viewModelScope.launch {
            _loginLoading.value = true
            _loginError.value = null
            val result = repository.login(loginEmail.value, loginPassword.value)
            if (result.isSuccess) {
                loginEmail.value = ""
                loginPassword.value = ""
                triggerSync()
            } else {
                val errorMsg = result.exceptionOrNull()?.message ?: "Login failed. Please check credentials."
                _loginError.value = errorMsg
            }
            _loginLoading.value = false
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
        }
    }

    fun togglePushNotifications(enabled: Boolean) {
        viewModelScope.launch {
            repository.setPushNotificationsEnabled(enabled)
        }
    }

    fun fetchTenants() {
        viewModelScope.launch {
            _tenantsLoading.value = true
            val result = if (userRole.value == "platform_admin") {
                repository.getAdminTenants()
            } else {
                repository.getTenants()
            }
            if (result.isSuccess) {
                _tenants.value = result.getOrNull() ?: emptyList()
            }
            _tenantsLoading.value = false
        }
    }

    fun createTenant(
        request: com.example.data.model.CreateTenantRequest,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            val result = repository.createTenant(request)
            if (result.isSuccess) {
                fetchTenants()
                onSuccess()
            } else {
                onError(result.exceptionOrNull()?.message ?: "Failed to create tenant")
            }
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private fun isSubscriptionEndingSoon(currentPeriodEnd: String?): Boolean {
        if (currentPeriodEnd.isNullOrEmpty()) return false
        return try {
            val cleanDate = currentPeriodEnd.replace("Z", "+0000")
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
                "yyyy-MM-dd'T'HH:mm:ssZ",
                "yyyy-MM-dd'T'HH:mm:ss",
                "yyyy-MM-dd"
            )
            var parsedDate: Date? = null
            for (f in formats) {
                try {
                    val parser = SimpleDateFormat(f, Locale.ROOT)
                    parsedDate = parser.parse(cleanDate)
                    if (parsedDate != null) break
                } catch (e: Exception) {}
            }
            if (parsedDate != null) {
                val diffMs = parsedDate.time - System.currentTimeMillis()
                val diffDays = diffMs / (1000.0 * 60 * 60 * 24)
                diffDays in 0.0..1.1
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }
}
