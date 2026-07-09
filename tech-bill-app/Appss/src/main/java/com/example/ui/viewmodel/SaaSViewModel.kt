package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID

// ==========================================
// 📊 STATE AND MODEL DEFINITIONS
// ==========================================
data class StoreEvent(val id: String, val message: String, val timestamp: String)

data class OwnerDashboardUiState(
    val totalSales: Int = 142,
    val totalRevenue: Double = 8450.50,
    val totalNetProfit: Double = 4210.20,
    val onlineSales: Double = 1250.00,
    val isOnlineOptionEnabled: Boolean = true,
    val liveEvents: List<StoreEvent> = emptyList()
)

enum class InvoiceStatus { Paid, Voided }

data class Invoice(
    val id: String,
    val clientReferenceId: String,
    val clientName: String,
    val clientPhone: String,
    val amount: Double,
    val status: InvoiceStatus,
    val date: String
)

data class InvoiceLedgerUiState(
    val searchQuery: String = "",
    val isExporting: Boolean = false
)

data class CashierPerformance(
    val cashierId: String,
    val name: String,
    val transactionCount: Int,
    val totalRevenue: Double,
    val targetRevenue: Double,
    val isClockedIn: Boolean,
    val clockInTime: String
)

data class StaffAnalyticsUiState(
    val staffList: List<CashierPerformance> = emptyList()
)

enum class TenantStatus { Active, Suspended, Expiring }

data class TenantUnit(
    val tenantId: String,
    val companyName: String,
    val ownerName: String,
    val subscriptionExpiresAt: String,
    val status: TenantStatus
)

data class SuperAdminDashboardUiState(
    val activeWebSocketsCount: Int = 0,
    val apiTrafficRates: List<Int> = emptyList(),
    val tenants: List<TenantUnit> = emptyList(),
    val serverCpuUsage: Float = 0f,
    val serverMemoryUsage: Float = 0f
)

// ==========================================
// 🧠 VIEWMODEL ARCHITECTURE
// ==========================================
class SaaSViewModel : ViewModel() {

    // 1. OWNER DASHBOARD FLOWS
    private val _ownerDashboardState = MutableStateFlow(OwnerDashboardUiState())
    val ownerDashboardState: StateFlow<OwnerDashboardUiState> = _ownerDashboardState.asStateFlow()

    // 2. INVOICES FLOWS
    private val _invoiceLedgerState = MutableStateFlow(InvoiceLedgerUiState())
    val invoiceLedgerState: StateFlow<InvoiceLedgerUiState> = _invoiceLedgerState.asStateFlow()

    private val rawInvoices = MutableStateFlow(
        listOf(
            Invoice("1", "REF-104", "Alice Smith", "+15550199", 350.00, InvoiceStatus.Paid, "2026-07-09 10:20 AM"),
            Invoice("2", "REF-208", "Bob Johnson", "+15550233", 120.00, InvoiceStatus.Voided, "2026-07-09 11:15 AM"),
            Invoice("3", "REF-312", "Charlie Brown", "+15550911", 540.50, InvoiceStatus.Paid, "2026-07-09 12:05 PM"),
            Invoice("4", "REF-409", "Diana Prince", "+15550144", 1250.00, InvoiceStatus.Paid, "2026-07-09 01:22 PM")
        )
    )

    val invoiceStream: Flow<List<Invoice>> = combine(
        rawInvoices,
        _invoiceLedgerState.map { it.searchQuery }.distinctUntilChanged()
    ) { list, query ->
        if (query.isBlank()) {
            list
        } else {
            list.filter {
                it.clientReferenceId.contains(query, ignoreCase = true) ||
                it.clientPhone.contains(query) ||
                it.clientName.contains(query, ignoreCase = true)
            }
        }
    }

    // 3. STAFF PERFORMANCE FLOWS
    private val _staffAnalyticsState = MutableStateFlow(
        StaffAnalyticsUiState(
            staffList = listOf(
                CashierPerformance("c1", "Sara Conner", 48, 2400.0, 3000.0, true, "08:00 AM"),
                CashierPerformance("c2", "John Doe", 32, 1850.0, 2000.0, true, "09:00 AM"),
                CashierPerformance("c3", "Peter Parker", 12, 450.0, 1500.0, false, "")
            )
        )
    )
    val staffAnalyticsState: StateFlow<StaffAnalyticsUiState> = _staffAnalyticsState.asStateFlow()

    // 4. SUPER ADMIN FLOWS
    private val _superAdminDashboardState = MutableStateFlow(
        SuperAdminDashboardUiState(
            activeWebSocketsCount = 142,
            apiTrafficRates = listOf(45, 58, 62, 85, 74, 90, 110, 95, 125),
            tenants = listOf(
                TenantUnit("t1", "Apex Retail Org", "Alex Apex", "2026-12-31", TenantStatus.Active),
                TenantUnit("t2", "Alpha Grocery Ltd", "Luna Alpha", "2026-07-15", TenantStatus.Expiring),
                TenantUnit("t3", "Beta Hardware Corp", "Marcus Beta", "2026-05-10", TenantStatus.Suspended)
            ),
            serverCpuUsage = 34.2f,
            serverMemoryUsage = 58.6f
        )
    )
    val superAdminDashboardState: StateFlow<SuperAdminDashboardUiState> = _superAdminDashboardState.asStateFlow()

    // Add local DB status state & fallbacks
    private val _isWebSocketConnected = MutableStateFlow(true)
    val isWebSocketConnected: StateFlow<Boolean> = _isWebSocketConnected.asStateFlow()

    private val cachedLocalEvents = listOf(
        StoreEvent("c1", "Fallback: Local cache restored (Database Sync OK)", "1 min ago"),
        StoreEvent("c2", "Fallback: Offline mode active", "2 min ago")
    )

    init {
        // Start streaming WebSocket mocks in background
        simulateWebSocketLiveLogs()
        simulateServerTelemetryUpdates()
    }

    // ==========================================
    // ⚙️ MUTATION TRIGGERS
    // ==========================================

    fun updateSearchQuery(query: String) {
        _invoiceLedgerState.update { it.copy(searchQuery = query) }
    }

    fun setExportingState(isExporting: Boolean) {
        _invoiceLedgerState.update { it.copy(isExporting = isExporting) }
    }

    fun renewTenantSubscription(tenantId: String) {
        viewModelScope.launch {
            try {
                // In production, makes network request: POST /admin/tenants/:id/renew
                _superAdminDashboardState.update { state ->
                    val updatedTenants = state.tenants.map { tenant ->
                        if (tenant.tenantId == tenantId) {
                            tenant.copy(
                                subscriptionExpiresAt = "2027-07-09",
                                status = TenantStatus.Active
                            )
                        } else tenant
                    }
                    state.copy(tenants = updatedTenants)
                }
            } catch (e: Exception) {
                // Log and absorb
            }
        }
    }

    fun suspendTenantAccount(tenantId: String) {
        viewModelScope.launch {
            try {
                // In production, makes network request: POST /admin/tenants/:id/suspend
                _superAdminDashboardState.update { state ->
                    val updatedTenants = state.tenants.map { tenant ->
                        if (tenant.tenantId == tenantId) {
                            val nextStatus = if (tenant.status == TenantStatus.Suspended) TenantStatus.Active else TenantStatus.Suspended
                            tenant.copy(status = nextStatus)
                        } else tenant
                    }
                    state.copy(tenants = updatedTenants)
                }
            } catch (e: Exception) {
                // Log and absorb
            }
        }
    }

    // ==========================================
    // 📡 LIVE MOCK STREAMERS
    // ==========================================

    private fun simulateWebSocketLiveLogs() {
        viewModelScope.launch {
            var counter = 1042
            val mockMessages = listOf(
                "Cashier Sara opened Sale",
                "Payment authorized for Invoice REF-302",
                "New online order received via API",
                "Cashier John clocked in shift",
                "System compiled transaction batch successfully"
            )

            while (true) {
                delay(4000)
                try {
                    // Randomly simulate socket disconnects/failures
                    if ((1..10).random() > 8) {
                        throw java.io.IOException("WebSocket pipeline interrupted")
                    }
                    
                    _isWebSocketConnected.value = true

                    val newEvent = StoreEvent(
                        id = UUID.randomUUID().toString(),
                        message = "${mockMessages.random()} #${counter++}",
                        timestamp = "Just Now"
                    )
                    _ownerDashboardState.update { state ->
                        val newList = (listOf(newEvent) + state.liveEvents).take(15)
                        state.copy(liveEvents = newList)
                    }
                } catch (e: Exception) {
                    _isWebSocketConnected.value = false
                    // Fallback cleanly to local DB/Room cached logs instead of crashing
                    _ownerDashboardState.update { state ->
                        state.copy(liveEvents = (cachedLocalEvents + state.liveEvents).distinctBy { it.id }.take(15))
                    }
                }
            }
        }
    }

    private fun simulateServerTelemetryUpdates() {
        viewModelScope.launch {
            while (true) {
                delay(3000)
                try {
                    _superAdminDashboardState.update { state ->
                        val nextRates = state.apiTrafficRates.takeLast(8) + (80..150).random()
                        state.copy(
                            activeWebSocketsCount = state.activeWebSocketsCount + (-3..3).random(),
                            serverCpuUsage = (250..600).random() / 10f,
                            serverMemoryUsage = (550..620).random() / 10f,
                            apiTrafficRates = nextRates
                        )
                    }
                } catch (e: Exception) {
                    // Absorb telemetry exceptions safely
                }
            }
        }
    }
}
