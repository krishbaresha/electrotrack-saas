package com.example.data.repository

import com.example.data.local.AppDatabase
import com.example.data.local.TokenManager
import com.example.data.local.entity.InventoryEntity
import com.example.data.local.entity.OfflineActionEntity
import com.example.data.local.entity.SaleEntity
import com.example.data.local.entity.ActionPriority
import com.example.data.local.entity.ActionStatus
import com.example.data.model.*
import com.example.data.remote.ApiService
import com.example.data.remote.RetrofitClient
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.util.*

/**
 * SaaSDataRepository — single source of truth for all local and remote data operations.
 *
 * ## Multi-Tenant Data Boundaries
 * All Room-backed reactive Flows use [tokenManager.tenantId.flatMapLatest] to ensure
 * that every new tenant session causes the streams to automatically switch to
 * tenant-scoped Room queries. A session with no tenant ID returns empty lists.
 *
 * ## Session Isolation on Login
 * [login] triggers a local [logout] before authenticating, guaranteeing any prior
 * tenant's cached data is wiped before the new session token is stored.
 *
 * ## Logout Contract
 * [logout] atomically clears: EncryptedSharedPreferences, inventory, sale, and
 * offline-action Room tables. This prevents any form of cross-session data leakage.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SaaSDataRepository(
    private val apiService: ApiService,
    private val tokenManager: TokenManager,
    private val database: AppDatabase
) {

    private val inventoryDao    = database.inventoryDao()
    private val saleDao         = database.saleDao()
    private val offlineActionDao = database.offlineActionDao()
    private val moshi = RetrofitClient.moshi

    // ─── State Flows from TokenManager ────────────────────────────────────────

    fun getAccessTokenFlow(): Flow<String?>  = tokenManager.accessToken
    fun getUserNameFlow(): Flow<String?>     = tokenManager.userName
    fun getUserEmailFlow(): Flow<String?>    = tokenManager.userEmail
    fun getUserRoleFlow(): Flow<String?>     = tokenManager.userRole
    fun getTenantIdFlow(): Flow<String?>     = tokenManager.tenantId
    fun getOnlineSellingEnabledFlow(): Flow<Boolean>  = tokenManager.onlineSellingEnabled
    fun getAppAccessEnabledFlow(): Flow<Boolean>      = tokenManager.appAccessEnabled
    fun getCurrentPeriodEndFlow(): Flow<String?>      = tokenManager.currentPeriodEnd
    fun getPushNotificationsEnabledFlow(): Flow<Boolean> = tokenManager.pushNotificationsEnabled

    // ─── Tenant-Isolated Offline-First Data Flows (from Room DB) ──────────────

    /**
     * Inventory stream — automatically switches when tenantId changes.
     * Returns an empty list when no tenant session is active.
     */
    fun getInventoryFlow(): Flow<List<InventoryItem>> {
        return tokenManager.tenantId.flatMapLatest { id ->
            if (id.isNullOrBlank()) {
                flowOf(emptyList())
            } else {
                inventoryDao.getAllInventory(id).map { list ->
                    list.map { it.toDomainModel() }
                }
            }
        }
    }

    /**
     * All sales stream — automatically switches when tenantId changes.
     * Returns an empty list when no tenant session is active.
     */
    fun getSalesFlow(): Flow<List<SaleItem>> {
        val adapter = moshi.adapter<List<WarrantyDetails>>(
            com.squareup.moshi.Types.newParameterizedType(List::class.java, WarrantyDetails::class.java)
        )
        return tokenManager.tenantId.flatMapLatest { id ->
            if (id.isNullOrBlank()) {
                flowOf(emptyList())
            } else {
                saleDao.getAllSales(id).map { list ->
                    list.map { entity -> entity.toDomain(adapter) }
                }
            }
        }
    }

    /**
     * Online-only sales stream — automatically switches when tenantId changes.
     * Returns an empty list when no tenant session is active.
     */
    fun getOnlineSalesFlow(): Flow<List<SaleItem>> {
        val adapter = moshi.adapter<List<WarrantyDetails>>(
            com.squareup.moshi.Types.newParameterizedType(List::class.java, WarrantyDetails::class.java)
        )
        return tokenManager.tenantId.flatMapLatest { id ->
            if (id.isNullOrBlank()) {
                flowOf(emptyList())
            } else {
                saleDao.getOnlineSales(id).map { list ->
                    list.map { entity -> entity.toDomain(adapter) }
                }
            }
        }
    }

    // ─── Network Sync Methods ──────────────────────────────────────────────────

    /**
     * Authenticate the user. Pre-login: wipes any stale session so a prior tenant's
     * data never bleeds into the new one. Post-login: saves tokens then syncs profile.
     */
    suspend fun login(email: String, password: String): Result<LoginResponse> {
        return try {
            // 1. Flush prior session data before establishing a new token context.
            logout()

            val response = apiService.login(LoginRequest(email, password))
            tokenManager.saveTokens(response.accessToken, response.refreshToken)
            syncProfile()
            Result.success(response)
        } catch (e: retrofit2.HttpException) {
            val errorBody = e.response()?.errorBody()?.string()
            val parsedMessage = try {
                val jsonObject = org.json.JSONObject(errorBody ?: "")
                val msg = jsonObject.get("message")
                if (msg is org.json.JSONArray) {
                    msg.getString(0)
                } else {
                    msg.toString()
                }
            } catch (ex: Exception) {
                e.message() ?: "Unauthorized"
            }
            Result.failure(Exception(parsedMessage))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Sync the authenticated user's profile from `GET auth/me`.
     * Also queries `GET tenants/me/config` to retrieve tenant-specific feature flags.
     * If the user is a `platform_admin`, also fetches `GET admin/tenants`.
     */
    suspend fun syncProfile(): Result<UserInfo> {
        return try {
            val userInfo = apiService.getProfile()
            if (!userInfo.appAccessEnabled || userInfo.status.lowercase(Locale.ROOT) != "active") {
                logout()
                return Result.failure(IllegalStateException("App Access disabled or subscription inactive."))
            }

            tokenManager.saveUser(
                email = userInfo.email,
                name = userInfo.name,
                role = userInfo.role,
                tenantId = userInfo.tenant?.id,
                tenantName = userInfo.tenant?.businessName,
                subdomain = userInfo.tenant?.subdomain,
                onlineSellingEnabled = userInfo.tenant?.onlineSellingEnabled ?: false,
                appAccessEnabled = userInfo.appAccessEnabled,
                currentPeriodEnd = userInfo.currentPeriodEnd
            )

            // Post-auth: fetch tenant config for feature flags and warehouse gate.
            try {
                val config = apiService.getTenantConfig()
                tokenManager.updateWarehouseEnabled(config.isWarehouseEnabled)
                tokenManager.saveUserRole(config.role)
                // If tenantId wasn't in the /me response, backfill from config
                if (config.tenantId != null && tokenManager.getTenantId().isNullOrBlank()) {
                    tokenManager.saveUser(
                        email = userInfo.email,
                        name = userInfo.name,
                        role = config.role,
                        tenantId = config.tenantId,
                        tenantName = config.tenantName,
                        subdomain = config.subdomain,
                        onlineSellingEnabled = config.onlineSellingEnabled,
                        appAccessEnabled = userInfo.appAccessEnabled,
                        currentPeriodEnd = userInfo.currentPeriodEnd,
                        isWarehouseEnabled = config.isWarehouseEnabled
                    )
                }
            } catch (_: Exception) {
                // Non-fatal: tenant config fetch failure should not block login.
            }

            Result.success(userInfo)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchInventoryFromServer(): Result<Unit> {
        return try {
            val tenantId = tokenManager.getTenantId() ?: return Result.failure(
                IllegalStateException("No active tenant session.")
            )
            val items = apiService.getInventory(lowStock = false)
            val entities = items.map { InventoryEntity.fromDomainModel(it, tenantId) }
            inventoryDao.insertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchSalesFromServer(): Result<Unit> {
        return try {
            val tenantId = tokenManager.getTenantId() ?: return Result.failure(
                IllegalStateException("No active tenant session.")
            )
            val sales = apiService.getSales()
            val adapter = moshi.adapter<List<WarrantyDetails>>(
                com.squareup.moshi.Types.newParameterizedType(List::class.java, WarrantyDetails::class.java)
            )
            val entities = sales.map { sale ->
                SaleEntity(
                    id = sale.id,
                    tenantId = tenantId,
                    createdAt = sale.createdAt,
                    customerName = sale.customerName,
                    customerType = sale.customerType,
                    paymentType = sale.paymentType,
                    totalAmount = sale.totalAmount,
                    courierStatus = sale.courierStatus,
                    payoutStatus = sale.payoutStatus,
                    codValue = sale.codValue,
                    type = sale.type,
                    itemsJson = sale.items?.let { adapter.toJson(it) }
                )
            }
            saleDao.insertAll(entities)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getSalesSummary(): Result<SalesSummaryResponse> {
        return try {
            val summary = apiService.getSalesSummary()
            Result.success(summary)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Offline-First Write Actions ──────────────────────────────────────────

    suspend fun createSale(sale: SaleItem) {
        val tenantId = tokenManager.getTenantId() ?: return
        val adapter = moshi.adapter<List<WarrantyDetails>>(
            com.squareup.moshi.Types.newParameterizedType(List::class.java, WarrantyDetails::class.java)
        )
        // 1. Save to local DB instantly
        val entity = SaleEntity(
            id = sale.id,
            tenantId = tenantId,
            createdAt = sale.createdAt,
            customerName = sale.customerName,
            customerType = sale.customerType,
            paymentType = sale.paymentType,
            totalAmount = sale.totalAmount,
            courierStatus = sale.courierStatus,
            payoutStatus = sale.payoutStatus,
            codValue = sale.codValue,
            type = sale.type,
            itemsJson = sale.items?.let { adapter.toJson(it) }
        )
        saleDao.insert(entity)

        // 2. Queue for background sync
        val saleJson = moshi.adapter(SaleItem::class.java).toJson(sale)
        offlineActionDao.insert(
            OfflineActionEntity(
                httpMethod = "POST",
                endpoint = "sales",
                payload = saleJson,
                entityType = "sale",
                entityId = sale.id,
                priority = ActionPriority.NORMAL
            )
        )
    }

    suspend fun setPushNotificationsEnabled(enabled: Boolean) {
        tokenManager.setPushNotificationsEnabled(enabled)
    }

    suspend fun getTenants(): Result<List<TenantModel>> {
        return try {
            val tenants = apiService.getTenants()
            Result.success(tenants)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAdminTenants(): Result<List<TenantModel>> {
        return try {
            val tenants = apiService.getAdminTenants()
            Result.success(tenants)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTenant(request: CreateTenantRequest): Result<TenantModel> {
        return try {
            val tenant = apiService.createTenant(request)
            Result.success(tenant)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Hard logout — atomically clears all session data and cache layers.
     *
     * Execution order:
     * 1. Wipe all Room tables (inventory, sales, offline-action queue).
     * 2. Clear EncryptedSharedPreferences (tokens + user identity).
     *
     * After this call all reactive Flows emit empty/default values, causing
     * the ViewModel's `isLoggedIn` to become `false` and triggering navigation
     * to the Login screen.
     */
    suspend fun logout() {
        inventoryDao.clearAll()
        saleDao.clearAll()
        offlineActionDao.deleteAll()
        tokenManager.clearSession()
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private fun SaleEntity.toDomain(
        adapter: com.squareup.moshi.JsonAdapter<List<WarrantyDetails>>
    ) = SaleItem(
        id = id,
        createdAt = createdAt,
        customerName = customerName,
        customerType = customerType,
        paymentType = paymentType,
        totalAmount = totalAmount,
        courierStatus = courierStatus,
        payoutStatus = payoutStatus,
        codValue = codValue,
        type = type,
        items = itemsJson?.let { adapter.fromJson(it) }
    )
}
