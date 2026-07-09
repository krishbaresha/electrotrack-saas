package com.example.data.local.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import com.example.data.model.InventoryItem

/**
 * InventoryEntity — Room entity for the `inventory_items` table.
 *
 * ## Multi-Tenant Isolation
 * The composite primary key `(id, tenantId)` ensures that inventory rows from
 * different tenant sessions cannot collide even if the backend-assigned IDs overlap.
 * All DAO queries MUST filter `WHERE tenantId = :tenantId` to prevent cross-session leakage.
 */
@Entity(
    tableName = "inventory_items",
    primaryKeys = ["id", "tenantId"]
)
data class InventoryEntity(
    @ColumnInfo(name = "id")       val id: String,
    @ColumnInfo(name = "tenantId") val tenantId: String,
    @ColumnInfo(name = "name")     val name: String,
    @ColumnInfo(name = "quantity") val quantity: Int,
    @ColumnInfo(name = "sku")      val sku: String?,
    @ColumnInfo(name = "price")    val price: Double?
) {
    fun toDomainModel() = InventoryItem(id, name, quantity, sku, price)

    companion object {
        fun fromDomainModel(item: InventoryItem, tenantId: String) = InventoryEntity(
            id = item.id,
            tenantId = tenantId,
            name = item.name,
            quantity = item.quantity,
            sku = item.sku,
            price = item.price
        )
    }
}
