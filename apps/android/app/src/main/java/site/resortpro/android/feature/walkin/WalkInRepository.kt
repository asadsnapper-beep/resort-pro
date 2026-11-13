package site.resortpro.android.feature.walkin

import java.io.IOException
import java.io.File
import okhttp3.MultipartBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
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

class UploadIdentityMismatchException : Exception("Server returned an unexpected upload identity")

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

    suspend fun uploadImage(guestId: String, bookingId: String, docType: String, file: File) = call {
        val type = "text/plain".toMediaType()
        val part = MultipartBody.Part.createFormData("file", "capture.jpg", file.asRequestBody("image/jpeg".toMediaType()))
        val uploaded = api.uploadGuestImage(guestId, docType.toRequestBody(type), bookingId.toRequestBody(type), part).requireData()
        if (uploaded.docType != docType || uploaded.bookingId != bookingId) {
            throw ApiException(409, null, "Image was saved without the expected type or booking. Check guest documents before uploading again.")
        }
        uploaded
    }

    suspend fun supportsSafeRetry(): Boolean = try {
        api.guestImageCapabilities().body()?.data?.idempotencyVersion == 1
    } catch (_: IOException) {
        false
    }

    suspend fun uploadSavedImage(guestId: String, bookingId: String, docType: String, uploadId: String, bytes: ByteArray) = call {
        val type = "text/plain".toMediaType()
        val part = MultipartBody.Part.createFormData("file", "capture.jpg", bytes.toRequestBody("image/jpeg".toMediaType()))
        val uploaded = api.uploadGuestImage(guestId, docType.toRequestBody(type), bookingId.toRequestBody(type), part, uploadId).requireData()
        if (uploaded.id != uploadId || uploaded.docType != docType || uploaded.bookingId != bookingId) {
            throw UploadIdentityMismatchException()
        }
        uploaded
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
