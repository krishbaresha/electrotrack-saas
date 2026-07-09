package com.example.data.remote

import com.example.data.model.*
import retrofit2.Call
import retrofit2.http.*

interface ApiService {

    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): LoginResponse

    @POST("auth/refresh")
    fun refreshTokens(
        @Body request: RefreshRequest
    ): Call<RefreshResponse>

    @GET("auth/me")
    suspend fun getProfile(): UserInfo

    @GET("inventory")
    suspend fun getInventory(
        @Query("lowStock") lowStock: Boolean
    ): List<InventoryItem>

    @GET("sales")
    suspend fun getSales(
        @Query("limit") limit: Int? = null,
        @Query("type") type: String? = null
    ): List<SaleItem>

    @POST("sales")
    suspend fun createSale(
        @Body request: SaleItem
    ): SaleItem

    @GET("reports/sales-summary")
    suspend fun getSalesSummary(): SalesSummaryResponse

    /**
     * Fetch the feature-flag and role config for the currently authenticated tenant user.
     * Used post-login and on every app-foreground resume.
     * Endpoint: `GET /tenants/me/config`
     */
    @GET("tenants/me/config")
    suspend fun getTenantConfig(): TenantConfigResponse

    /**
     * List all tenants — only accessible by `platform_admin` role.
     * Endpoint: `GET /admin/tenants`
     */
    @GET("admin/tenants")
    suspend fun getAdminTenants(): List<TenantModel>

    /**
     * Standard tenant listing for super-admin console.
     * Endpoint: `GET /tenants`
     */
    @GET("tenants")
    suspend fun getTenants(): List<TenantModel>

    @POST("tenants")
    suspend fun createTenant(
        @Body request: CreateTenantRequest
    ): TenantModel
}
