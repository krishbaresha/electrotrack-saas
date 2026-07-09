package com.example.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * SaleEntity — Room entity for the `sale_items` table.
 *
 * ## Multi-Tenant Isolation
 * The `tenantId` column is stored alongside every sale row. All DAO queries
 * MUST filter `WHERE tenantId = :tenantId` to ensure a newly authenticated
 * tenant session never observes data from a prior session.
 */
@Entity(tableName = "sale_items")
data class SaleEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")            val id: String,
    @ColumnInfo(name = "tenantId")      val tenantId: String,
    @ColumnInfo(name = "createdAt")     val createdAt: String,
    @ColumnInfo(name = "customerName")  val customerName: String?,
    @ColumnInfo(name = "customerType")  val customerType: String?,
    @ColumnInfo(name = "paymentType")   val paymentType: String?,
    @ColumnInfo(name = "totalAmount")   val totalAmount: Double,
    @ColumnInfo(name = "courierStatus") val courierStatus: String?,
    @ColumnInfo(name = "payoutStatus")  val payoutStatus: String?,
    @ColumnInfo(name = "codValue")      val codValue: Double?,
    @ColumnInfo(name = "type")          val type: String?,
    @ColumnInfo(name = "itemsJson")     val itemsJson: String? // List<WarrantyDetails> serialized to JSON
)
