package site.resortpro.android.feature.housekeeping

import java.io.IOException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import retrofit2.Response
import site.resortpro.android.core.network.ApiEnvelope
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.core.network.HousekeepingTaskDto
import site.resortpro.android.core.network.NetworkUnavailableException
import site.resortpro.android.core.network.PaginatedHousekeepingEnvelope
import site.resortpro.android.core.network.UpdateHousekeepingStatusRequest
import site.resortpro.android.core.database.CacheDao
import site.resortpro.android.core.database.CacheEntryEntity
import site.resortpro.android.core.database.HousekeepingOutboxDao
import site.resortpro.android.core.database.HousekeepingOutboxEntity
import site.resortpro.android.core.database.cacheKey

data class HousekeepingLoadResult(
    val tasks: List<HousekeepingTaskDto>,
    val syncedAt: Long,
    val fromCache: Boolean,
)

data class HousekeepingStatusResult(
    val task: HousekeepingTaskDto,
    val queued: Boolean,
)

@Serializable
private data class HousekeepingCachePayload(val tasks: List<HousekeepingTaskDto>)

class HousekeepingRepository(
    private val api: AuthApi,
    private val json: Json,
    private val cacheDao: CacheDao,
    private val outboxDao: HousekeepingOutboxDao,
    private val scheduleOutbox: () -> Unit,
) {
    suspend fun loadTasks(role: String, userId: String, tenantId: String): HousekeepingLoadResult = try {
        val tasks = mutableListOf<HousekeepingTaskDto>()
        var page = 1
        var totalPages: Int
        do {
            val result = api.housekeepingTasks(page = page, limit = 100).requireTaskPage()
            tasks += result.tasks
            totalPages = result.totalPages
            page += 1
        } while (page <= totalPages)

        val scopedTasks = if (role == "STAFF") {
            tasks.filter { task -> task.assignedTo?.userId == userId }
        } else {
            tasks
        }
        val pendingByTask = outboxDao.all()
            .filter { it.tenantId == tenantId && it.userId == userId }
            .associateBy { it.taskId }
        val displayed = scopedTasks.map { task ->
            pendingByTask[task.id]?.let { task.copy(status = it.targetStatus) } ?: task
        }
        val syncedAt = System.currentTimeMillis()
        cacheDao.upsert(
            CacheEntryEntity(
                cacheKey = housekeepingCacheKey(tenantId, role, userId),
                payload = json.encodeToString(HousekeepingCachePayload(displayed)),
                syncedAt = syncedAt,
            ),
        )
        HousekeepingLoadResult(displayed, syncedAt, fromCache = false)
    } catch (error: IOException) {
        val entry = cacheDao.get(housekeepingCacheKey(tenantId, role, userId))
            ?: throw NetworkUnavailableException(error)
        val payload = runCatching { json.decodeFromString<HousekeepingCachePayload>(entry.payload) }
            .getOrElse {
                cacheDao.delete(entry.cacheKey)
                throw NetworkUnavailableException(error)
            }
        HousekeepingLoadResult(payload.tasks, entry.syncedAt, fromCache = true)
    }

    suspend fun updateStatus(
        task: HousekeepingTaskDto,
        status: String,
        tenantId: String,
        userId: String,
        role: String,
    ): HousekeepingStatusResult = try {
        val updated = api.updateHousekeepingStatus(
            id = task.id,
            request = UpdateHousekeepingStatusRequest(status, expectedStatus = task.status),
        ).requireData()
        outboxDao.delete(task.id)
        val merged = task.copy(status = updated.status, completedAt = updated.completedAt)
        updateCachedTask(tenantId, role, userId, merged)
        HousekeepingStatusResult(merged, queued = false)
    } catch (_: IOException) {
        val optimistic = task.copy(status = status)
        outboxDao.upsert(
            HousekeepingOutboxEntity(
                taskId = task.id,
                tenantId = tenantId,
                userId = userId,
                role = role,
                expectedStatus = task.status,
                targetStatus = status,
                queuedAt = System.currentTimeMillis(),
            ),
        )
        updateCachedTask(tenantId, role, userId, optimistic)
        scheduleOutbox()
        HousekeepingStatusResult(optimistic, queued = true)
    }

    suspend fun flushOutbox(): Boolean {
        for (pending in outboxDao.all()) {
            try {
                val updated = api.updateHousekeepingStatus(
                    id = pending.taskId,
                    request = UpdateHousekeepingStatusRequest(
                        status = pending.targetStatus,
                        expectedStatus = pending.expectedStatus,
                    ),
                ).requireData()
                outboxDao.delete(pending.taskId)
                updateCachedTask(
                    tenantId = pending.tenantId,
                    role = pending.role,
                    userId = pending.userId,
                    task = updated,
                )
            } catch (_: IOException) {
                return false
            } catch (error: ApiException) {
                if (error.status >= 500) return false
                // A conflict or terminal client error requires a fresh server
                // read instead of retrying a stale write forever.
                outboxDao.delete(pending.taskId)
            }
        }
        return true
    }

    private suspend fun updateCachedTask(
        tenantId: String,
        role: String,
        userId: String,
        task: HousekeepingTaskDto,
    ) {
        val key = housekeepingCacheKey(tenantId, role, userId)
        val entry = cacheDao.get(key) ?: return
        val cached = runCatching { json.decodeFromString<HousekeepingCachePayload>(entry.payload) }.getOrNull()
            ?: return
        val tasks = cached.tasks.map { existing ->
            if (existing.id == task.id) {
                existing.copy(status = task.status, completedAt = task.completedAt)
            } else {
                existing
            }
        }
        cacheDao.upsert(entry.copy(payload = json.encodeToString(HousekeepingCachePayload(tasks))))
    }

    private fun housekeepingCacheKey(tenantId: String, role: String, userId: String): String {
        val scope = if (role == "STAFF") userId else "overview"
        return cacheKey("housekeeping", "$tenantId:$scope")
    }

    private fun Response<PaginatedHousekeepingEnvelope>.requireTaskPage(): TaskPage {
        val envelope = body()
        if (isSuccessful && envelope?.success == true) {
            return TaskPage(
                tasks = envelope.data,
                totalPages = maxOf(1, envelope.pagination?.totalPages ?: 1),
            )
        }
        throw apiException(
            fallback = envelope?.error ?: "Could not load housekeeping tasks.",
            errorBody = errorBody()?.string(),
        )
    }

    private fun <T> Response<ApiEnvelope<T>>.requireData(): T {
        val envelope = body()
        if (isSuccessful && envelope?.success == true) {
            return envelope.data
                ?: throw ApiException(code(), null, "ResortPro returned an empty response.")
        }
        throw apiException(
            fallback = envelope?.error ?: "Could not update this task.",
            errorBody = errorBody()?.string(),
        )
    }

    private fun Response<*>.apiException(fallback: String, errorBody: String?): ApiException {
        val envelope = errorBody?.let { body ->
            runCatching { json.decodeFromString<ApiEnvelope<Unit>>(body) }.getOrNull()
        }
        return ApiException(
            status = code(),
            apiCode = envelope?.code,
            message = envelope?.error ?: fallback,
        )
    }

    private data class TaskPage(
        val tasks: List<HousekeepingTaskDto>,
        val totalPages: Int,
    )
}
