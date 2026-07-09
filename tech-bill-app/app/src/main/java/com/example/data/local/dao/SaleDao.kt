package com.example.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.data.local.entity.SaleEntity
import kotlinx.coroutines.flow.Flow

/**
 * SaleDao — Room data access object for the `sale_items` table.
 *
 * All queries are scoped to a specific `tenantId` to enforce strict
 * cross-session isolation. Callers must supply the current session's
 * tenant ID, sourced from [TokenManager.tenantId].
 */
@Dao
interface SaleDao {

    /** Observe all sales for the given tenant, newest first. */
    @Query("SELECT * FROM sale_items WHERE tenantId = :tenantId ORDER BY createdAt DESC")
    fun getAllSales(tenantId: String): Flow<List<SaleEntity>>

    /** Observe online sales only for the given tenant, newest first. */
    @Query("SELECT * FROM sale_items WHERE tenantId = :tenantId AND type = 'online' ORDER BY createdAt DESC")
    fun getOnlineSales(tenantId: String): Flow<List<SaleEntity>>

    /** Insert or replace a batch of sale records. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(sales: List<SaleEntity>)

    /** Insert or replace a single sale record (offline-first write). */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(sale: SaleEntity)

    /** Delete all sales for the given tenant — called on session switch. */
    @Query("DELETE FROM sale_items WHERE tenantId = :tenantId")
    suspend fun clearByTenant(tenantId: String)

    /** Full wipe of ALL rows across ALL tenants — used only on hard logout. */
    @Query("DELETE FROM sale_items")
    suspend fun clearAll()
}
