package site.resortpro.android.feature.walkin

import java.io.IOException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import retrofit2.Response
import site.resortpro.android.core.network.ApiEnvelope
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.core.network.NetworkUnavailableException
import site.resortpro.android.core.network.RateQuoteDto
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.core.network.WalkInBookingDto
import site.resortpro.android.core.network.WalkInRequest

class WalkInRepository(
    private val api: AuthApi,
    private val json: Json,
) {
    suspend fun availableRooms(checkIn: String, checkOut: String): List<RoomDto> = call {
        api.roomAvailability(checkIn, checkOut).requireData()
    }

    suspend fun quote(roomId: String, checkIn: String, checkOut: String): RateQuoteDto = call {
        api.resolveRate(roomId, checkIn, checkOut).requireData()
    }

    suspend fun create(request: WalkInRequest): WalkInBookingDto = call {
        api.createWalkIn(request).requireData()
    }

    private suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (error: IOException) {
        throw NetworkUnavailableException(error)
    }

    private fun <T> Response<ApiEnvelope<T>>.requireData(): T {
        val envelope = body()
        if (isSuccessful && envelope?.success == true) {
            return envelope.data
                ?: throw ApiException(code(), null, "ResortPro returned an empty response.")
        }
        val errorEnvelope = errorBody()?.string()?.let { body ->
            runCatching { json.decodeFromString<ApiEnvelope<Unit>>(body) }.getOrNull()
        }
        throw ApiException(
            status = code(),
            apiCode = errorEnvelope?.code,
            message = errorEnvelope?.error ?: envelope?.error ?: "Request failed. Please try again.",
        )
    }
}
