package com.example.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sale_items")
data class SaleEntity(
    @PrimaryKey val id: String,
    val createdAt: String,
    val customerName: String?,
    val customerType: String?,
    val paymentType: String?,
    val totalAmount: Double,
    val courierStatus: String?,
    val payoutStatus: String?,
    val codValue: Double?,
    val type: String?,
    val itemsJson: String? // List<WarrantyDetails> serialized to JSON
)
