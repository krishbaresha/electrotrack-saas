package com.example.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginRequest(
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String,
    @Json(name = "clientSource") val clientSource: String = "mobile"
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "refresh_token") val refreshToken: String
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(
    @Json(name = "refresh_token") val refreshToken: String
)

@JsonClass(generateAdapter = true)
data class RefreshResponse(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "refresh_token") val refreshToken: String
)

@JsonClass(generateAdapter = true)
data class TenantInfo(
    @Json(name = "onlineSellingEnabled") val onlineSellingEnabled: Boolean,
    @Json(name = "businessName") val businessName: String? = null
)

@JsonClass(generateAdapter = true)
data class UserInfo(
    @Json(name = "email") val email: String,
    @Json(name = "name") val name: String,
    @Json(name = "role") val role: String? = null,
    @Json(name = "permissions") val permissions: List<String>? = null,
    @Json(name = "appAccessEnabled") val appAccessEnabled: Boolean,
    @Json(name = "status") val status: String,
    @Json(name = "currentPeriodEnd") val currentPeriodEnd: String?,
    @Json(name = "tenant") val tenant: TenantInfo?
)

@JsonClass(generateAdapter = true)
data class InventoryItem(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "quantity") val quantity: Int,
    @Json(name = "sku") val sku: String? = null,
    @Json(name = "price") val price: Double? = null
)

@JsonClass(generateAdapter = true)
data class WarrantyDetails(
    @Json(name = "brand") val brand: String? = null,
    @Json(name = "serialNumber") val serialNumber: String? = null,
    @Json(name = "warrantyStart") val warrantyStart: String? = null,
    @Json(name = "warrantyEnd") val warrantyEnd: String? = null
)

@JsonClass(generateAdapter = true)
data class SaleItem(
    @Json(name = "id") val id: String,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "customerName") val customerName: String? = null,
    @Json(name = "customerType") val customerType: String? = null,
    @Json(name = "paymentType") val paymentType: String? = null,
    @Json(name = "totalAmount") val totalAmount: Double,
    @Json(name = "courierStatus") val courierStatus: String? = null,
    @Json(name = "payoutStatus") val payoutStatus: String? = null,
    @Json(name = "codValue") val codValue: Double? = null,
    @Json(name = "type") val type: String? = null,
    @Json(name = "items") val items: List<WarrantyDetails>? = null
)

@JsonClass(generateAdapter = true)
data class SalesSummaryResponse(
    @Json(name = "revenue") val revenue: Double,
    @Json(name = "profit") val profit: Double,
    @Json(name = "totalSales") val totalSales: Int,
    @Json(name = "itemsSold") val itemsSold: Int
)

@JsonClass(generateAdapter = true)
data class TenantModel(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "slug") val slug: String,
    @Json(name = "status") val status: String,
    @Json(name = "plan") val plan: String,
    @Json(name = "maxUsers") val maxUsers: Int? = null,
    @Json(name = "onlineSellingEnabled") val onlineSellingEnabled: Boolean? = null,
    @Json(name = "appAccessEnabled") val appAccessEnabled: Boolean? = null,
    @Json(name = "ownerEmail") val ownerEmail: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateTenantRequest(
    @Json(name = "name") val name: String,
    @Json(name = "slug") val slug: String,
    @Json(name = "ownerName") val ownerName: String,
    @Json(name = "ownerPasswordHashOrText") val ownerPasswordHashOrText: String,
    @Json(name = "username") val username: String? = null,
    @Json(name = "plan") val plan: String = "trial",
    @Json(name = "maxUsers") val maxUsers: Int = 5,
    @Json(name = "isWarehouseEnabled") val isWarehouseEnabled: Boolean = false
)
