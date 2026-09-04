package site.resortpro.android.core.database

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "cache_entries")
data class CacheEntryEntity(
    @PrimaryKey val cacheKey: String,
    val payload: String,
    val syncedAt: Long,
)

@Entity(tableName = "housekeeping_outbox")
data class HousekeepingOutboxEntity(
    @PrimaryKey val taskId: String,
    val tenantId: String,
    val userId: String,
    val role: String,
    val expectedStatus: String,
    val targetStatus: String,
    val queuedAt: Long,
)

@Dao
interface CacheDao {
    @Query("SELECT * FROM cache_entries WHERE cacheKey = :cacheKey LIMIT 1")
    suspend fun get(cacheKey: String): CacheEntryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: CacheEntryEntity)

    @Query("DELETE FROM cache_entries WHERE cacheKey = :cacheKey")
    suspend fun delete(cacheKey: String)

    @Query("DELETE FROM cache_entries")
    suspend fun clearAll()
}

@Dao
interface HousekeepingOutboxDao {
    @Query("SELECT * FROM housekeeping_outbox ORDER BY queuedAt ASC")
    suspend fun all(): List<HousekeepingOutboxEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: HousekeepingOutboxEntity)

    @Query("DELETE FROM housekeeping_outbox WHERE taskId = :taskId")
    suspend fun delete(taskId: String)

    @Query("DELETE FROM housekeeping_outbox")
    suspend fun clearAll()
}

@Database(
    entities = [CacheEntryEntity::class, HousekeepingOutboxEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class ResortProDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao
    abstract fun housekeepingOutboxDao(): HousekeepingOutboxDao

    companion object {
        fun create(context: Context): ResortProDatabase = Room.databaseBuilder(
            context.applicationContext,
            ResortProDatabase::class.java,
            "resortpro.db",
        ).build()
    }
}
