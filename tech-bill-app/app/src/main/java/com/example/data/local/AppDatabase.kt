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

@Database(
    entities = [InventoryEntity::class, SaleEntity::class, OfflineActionEntity::class],
    version = 1,
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
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
