package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.InventoryItem
import com.example.data.model.SaleItem
import com.example.data.model.UserInfo
import com.example.data.repository.SaaSDataRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class SaaSViewModel(
    private val repository: SaaSDataRepository
) : ViewModel() {

    val accessToken = repository.getAccessTokenFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val userName = repository.getUserNameFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Guest")
    val userEmail = repository.getUserEmailFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")
    val userRole = repository.getUserRoleFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val onlineSellingEnabled = repository.getOnlineSellingEnabledFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    val appAccessEnabled = repository.getAppAccessEnabledFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    val currentPeriodEnd = repository.getCurrentPeriodEndFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val pushNotificationsEnabled = repository.getPushNotificationsEnabledFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    val isLoggedIn: StateFlow<Boolean> = accessToken.map { !it.isNullOrEmpty() }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    // Login Form State
    val loginEmail = MutableStateFlow("")
    val loginPassword = MutableStateFlow("")
    private val _loginLoading = MutableStateFlow(false)
    val loginLoading: StateFlow<Boolean> = _loginLoading.asStateFlow()
    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError.asStateFlow()

    // Screen States from Offline DB
    val lowStockItems: StateFlow<List<InventoryItem>> = repository.getInventoryFlow()
        .map { it.filter { item -> item.quantity <= 5 } }
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

    private val _salesSummary = MutableStateFlow<com.example.data.model.SalesSummaryResponse?>(null)
    val salesSummary: StateFlow<com.example.data.model.SalesSummaryResponse?> = _salesSummary.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    val searchQuery = MutableStateFlow("")

    val showSubscriptionWarning: StateFlow<Boolean> = currentPeriodEnd.map { date ->
        isSubscriptionEndingSoon(date)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    init {
        // Trigger profile sync and general data fetching on start if logged in
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

    fun triggerSync() {
        viewModelScope.launch {
            _isSyncing.value = true
            val profileResult = repository.syncProfile()
            if (profileResult.isFailure) {
                // Ignore for now
            }
            fetchDashboardAndInvoicesData()
            _isSyncing.value = false
        }
    }

    private fun fetchDashboardAndInvoicesData() {
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

        viewModelScope.launch {
            val summaryRes = repository.getSalesSummary()
            if (summaryRes.isSuccess) {
                _salesSummary.value = summaryRes.getOrNull()
            }
        }
    }

    fun login() {
        viewModelScope.launch {
            _loginLoading.value = true
            _loginError.value = null
            val result = repository.login(loginEmail.value, loginPassword.value)
            if (result.isSuccess) {
                // Login succeeded, tokens saved, user synced
                loginEmail.value = ""
                loginPassword.value = ""
            } else {
                val errorMsg = result.exceptionOrNull()?.message ?: "Login failed. Please check credentials."
                _loginError.value = errorMsg
            }
            _loginLoading.value = false
        }
    }

    fun togglePushNotifications(enabled: Boolean) {
        viewModelScope.launch {
            repository.setPushNotificationsEnabled(enabled)
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
        }
    }

    private fun isSubscriptionEndingSoon(currentPeriodEnd: String?): Boolean {
        if (currentPeriodEnd.isNullOrEmpty()) return false
        return try {
            // Standard format handling
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
                // Subscription ends in 1 day or less
                diffDays in 0.0..1.1
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    // --- High-fidelity mock data generators for sandbox and cold-start fallback ---
    private fun getMockLowStockItems(): List<InventoryItem> {
        return listOf(
            InventoryItem("1", "Samsung Galaxy S24 Ultra", 0, "SAM-G998", 124999.00),
            InventoryItem("2", "OnePlus 12 256GB Silky Black", 1, "OP-12-BLK", 64999.00),
            InventoryItem("3", "Sony WH-1000XM5 Headphones", 0, "SONY-XM5", 29999.00),
            InventoryItem("4", "Apple iPad Pro M4", 1, "AAPL-IPAD-M4", 99900.00)
        )
    }

    private fun getMockSales(): List<SaleItem> {
        return listOf(
            SaleItem(
                id = "INV-2026-001",
                createdAt = "2026-07-08T11:45:00Z",
                customerName = "Bilal Khan",
                customerType = "Retail",
                paymentType = "Cash",
                totalAmount = 15000.0,
                type = "offline",
                items = listOf(
                    com.example.data.model.WarrantyDetails(
                        brand = "Samsung",
                        serialNumber = "SN-SAM-9821-X",
                        warrantyStart = "2026-07-08",
                        warrantyEnd = "2027-07-08"
                    )
                )
            ),
            SaleItem(
                id = "INV-2026-002",
                createdAt = "2026-07-08T09:30:00Z",
                customerName = "Ali Raza",
                customerType = "Wholesale",
                paymentType = "Bank Transfer",
                totalAmount = 10000.0,
                type = "offline",
                items = listOf(
                    com.example.data.model.WarrantyDetails(
                        brand = "Sony",
                        serialNumber = "SN-SONY-7162-M",
                        warrantyStart = "2026-07-08",
                        warrantyEnd = "2028-07-08"
                    )
                )
            )
        )
    }

    private fun getMockOnlineSales(): List<SaleItem> {
        return listOf(
            SaleItem(
                id = "ON-5001",
                createdAt = "2026-07-08T10:15:00Z",
                customerName = "Kashif Mahmood",
                totalAmount = 12500.0,
                courierStatus = "Pending",
                payoutStatus = "Logged",
                codValue = 12500.0,
                type = "online",
                items = listOf(
                    com.example.data.model.WarrantyDetails(
                        brand = "OnePlus",
                        serialNumber = "SN-OP-5511-A",
                        warrantyStart = "2026-07-08",
                        warrantyEnd = "2027-07-08"
                    )
                )
            ),
            SaleItem(
                id = "ON-5002",
                createdAt = "2026-07-07T16:20:00Z",
                customerName = "Ayesha Malik",
                totalAmount = 8500.0,
                courierStatus = "Dispatched",
                payoutStatus = "Due",
                codValue = 8500.0,
                type = "online",
                items = listOf(
                    com.example.data.model.WarrantyDetails(
                        brand = "Xiaomi",
                        serialNumber = "SN-XIAO-3391-B",
                        warrantyStart = "2026-07-07",
                        warrantyEnd = "2027-07-07"
                    )
                )
            ),
            SaleItem(
                id = "ON-5003",
                createdAt = "2026-07-06T14:10:00Z",
                customerName = "Zainab Bibi",
                totalAmount = 21000.0,
                courierStatus = "Completed",
                payoutStatus = "Cleared",
                codValue = 0.0,
                type = "online",
                items = listOf(
                    com.example.data.model.WarrantyDetails(
                        brand = "Realme",
                        serialNumber = "SN-RL-9281-Z",
                        warrantyStart = "2026-07-06",
                        warrantyEnd = "2027-07-06"
                    )
                )
            ),
            SaleItem(
                id = "ON-5004",
                createdAt = "2026-07-05T12:05:00Z",
                customerName = "Hamza Yousaf",
                totalAmount = 4500.0,
                courierStatus = "Returned",
                payoutStatus = "None",
                codValue = 0.0,
                type = "online",
                items = listOf(
                    com.example.data.model.WarrantyDetails(
                        brand = "Infinix",
                        serialNumber = "SN-INF-1182-Y",
                        warrantyStart = "2026-07-05",
                        warrantyEnd = "2026-07-15"
                    )
                )
            )
        )
    }

    private val _tenants = MutableStateFlow<List<com.example.data.model.TenantModel>>(emptyList())
    val tenants: StateFlow<List<com.example.data.model.TenantModel>> = _tenants.asStateFlow()
    private val _tenantsLoading = MutableStateFlow(false)
    val tenantsLoading: StateFlow<Boolean> = _tenantsLoading.asStateFlow()

    fun fetchTenants() {
        viewModelScope.launch {
            _tenantsLoading.value = true
            val result = repository.getTenants()
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
}
