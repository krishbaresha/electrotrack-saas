package com.example.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.data.model.InventoryItem

@Entity(tableName = "inventory_items")
data class InventoryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val quantity: Int,
    val sku: String?,
    val price: Double?
) {
    fun toDomainModel() = InventoryItem(id, name, quantity, sku, price)
    
    companion object {
        fun fromDomainModel(item: InventoryItem) = InventoryEntity(
            item.id, item.name, item.quantity, item.sku, item.price
        )
    }
}
