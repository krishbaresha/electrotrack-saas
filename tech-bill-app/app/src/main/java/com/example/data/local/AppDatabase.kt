package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.data.local.dao.InventoryDao
import com.example.data.local.dao.OfflineActionDao
import com.example.data.local.dao.SaleDao
import com.example.data.local.entity.InventoryEntity
import com.example.data.local.entity.OfflineActionEntity
import com.example.data.local.entity.SaleEntity

/**
 * AppDatabase — Room database for TechBill mobile.
 *
 * Version bumped to 2 to account for:
 *  - `inventory_items` schema change: composite primary key (id, tenantId).
 *  - `sale_items` schema change: new `tenantId` column added.
 *
 * `fallbackToDestructiveMigration()` is used in development to avoid manual migration
 * scripts for these structural schema changes. Replace with proper migrations before
 * shipping to production.
 */
@Database(
    entities = [InventoryEntity::class, SaleEntity::class, OfflineActionEntity::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun inventoryDao(): InventoryDao
    abstract fun saleDao(): SaleDao
    abstract fun offlineActionDao(): OfflineActionDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "electrotrack_database"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
