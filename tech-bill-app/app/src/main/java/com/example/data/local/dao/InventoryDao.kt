package com.example.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.data.local.entity.InventoryEntity
import kotlinx.coroutines.flow.Flow

/**
 * InventoryDao — Room data access object for the `inventory_items` table.
 *
 * All queries are scoped to a specific `tenantId` to ensure complete
 * data isolation between tenant sessions. Callers must pass the current
 * session's tenant ID, sourced from [TokenManager.tenantId].
 */
@Dao
interface InventoryDao {

    /** Observe all inventory items for the given tenant, ordered by name. */
    @Query("SELECT * FROM inventory_items WHERE tenantId = :tenantId ORDER BY name ASC")
    fun getAllInventory(tenantId: String): Flow<List<InventoryEntity>>

    /** Insert or replace a batch of inventory items for the given tenant. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<InventoryEntity>)

    /** Delete all inventory rows for the given tenant — called on logout or session switch. */
    @Query("DELETE FROM inventory_items WHERE tenantId = :tenantId")
    suspend fun clearByTenant(tenantId: String)

    /** Full wipe of ALL rows across ALL tenants — used only on hard logout. */
    @Query("DELETE FROM inventory_items")
    suspend fun clearAll()
}
