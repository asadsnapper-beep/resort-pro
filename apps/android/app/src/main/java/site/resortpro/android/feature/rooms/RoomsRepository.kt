package site.resortpro.android.feature.rooms

import java.io.IOException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import retrofit2.Response
import site.resortpro.android.core.network.ApiEnvelope
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.core.network.NetworkUnavailableException
import site.resortpro.android.core.network.PaginatedRoomEnvelope
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.core.database.CacheDao
import site.resortpro.android.core.database.CacheEntryEntity
import site.resortpro.android.core.database.cacheKey

data class RoomsLoadResult(
    val rooms: List<RoomDto>,
    val syncedAt: Long,
    val fromCache: Boolean,
    val truncated: Boolean,
)

@Serializable
private data class RoomsCachePayload(
    val rooms: List<RoomDto>,
    val truncated: Boolean,
)

class RoomsRepository(
    private val api: AuthApi,
    private val json: Json,
    private val cacheDao: CacheDao,
) {
    suspend fun loadRooms(tenantId: String): RoomsLoadResult = try {
        val rooms = mutableListOf<RoomDto>()
        var page = 1
        var totalPages: Int
        do {
            val response = api.rooms(page = page, limit = 100).requireRoomPage()
            rooms += response.rooms
            totalPages = response.totalPages
            page += 1
        } while (page <= minOf(totalPages, MAX_EAGER_PAGES))
        val syncedAt = System.currentTimeMillis()
        val payload = RoomsCachePayload(
            rooms = rooms,
            truncated = totalPages > MAX_EAGER_PAGES,
        )
        cacheDao.upsert(
            CacheEntryEntity(
                cacheKey = cacheKey(ROOMS_CACHE, tenantId),
                payload = json.encodeToString(payload),
                syncedAt = syncedAt,
            ),
        )
        RoomsLoadResult(
            rooms = rooms,
            syncedAt = syncedAt,
            fromCache = false,
            truncated = payload.truncated,
        )
    } catch (error: IOException) {
        val entry = cacheDao.get(cacheKey(ROOMS_CACHE, tenantId))
            ?: throw NetworkUnavailableException(error)
        val payload = runCatching { json.decodeFromString<RoomsCachePayload>(entry.payload) }
            .getOrElse {
                cacheDao.delete(entry.cacheKey)
                throw NetworkUnavailableException(error)
            }
        RoomsLoadResult(
            rooms = payload.rooms,
            syncedAt = entry.syncedAt,
            fromCache = true,
            truncated = payload.truncated,
        )
    }

    suspend fun checkAvailability(checkIn: String, checkOut: String): List<RoomDto> = try {
        api.roomAvailability(checkIn, checkOut).requireData()
    } catch (error: IOException) {
        throw NetworkUnavailableException(error)
    }

    private fun Response<PaginatedRoomEnvelope>.requireRoomPage(): RoomPage {
        val envelope = body()
        if (isSuccessful && envelope?.success == true) {
            return RoomPage(
                rooms = envelope.data,
                totalPages = maxOf(1, envelope.pagination?.totalPages ?: 1),
            )
        }
        throw apiException(
            fallback = envelope?.error ?: "Could not load rooms.",
            errorBody = errorBody()?.string(),
        )
    }

    private data class RoomPage(
        val rooms: List<RoomDto>,
        val totalPages: Int,
    )

    private companion object {
        const val ROOMS_CACHE = "rooms"
        const val MAX_EAGER_PAGES = 3
    }

    private fun <T> Response<ApiEnvelope<T>>.requireData(): T {
        val envelope = body()
        if (isSuccessful && envelope?.success == true) {
            return envelope.data
                ?: throw ApiException(code(), null, "ResortPro returned an empty response.")
        }
        throw apiException(
            fallback = envelope?.error ?: "Request failed. Please try again.",
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
}
