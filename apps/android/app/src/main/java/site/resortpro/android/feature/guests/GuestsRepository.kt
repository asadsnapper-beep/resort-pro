package site.resortpro.android.feature.guests

import java.io.IOException
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.core.network.GuestDetailsDto
import site.resortpro.android.core.network.GuestSummaryDto
import site.resortpro.android.core.network.GuestSearchRequest
import site.resortpro.android.core.network.BookingDetailsDto
import site.resortpro.android.core.network.NetworkUnavailableException

data class GuestSearchResult(val guests: List<GuestSummaryDto>, val page: Int, val totalPages: Int, val total: Int)

/** Guest records are intentionally held in memory only, not in the offline cache. */
class GuestsRepository(private val api: AuthApi) {
    suspend fun search(query: String, page: Int): GuestSearchResult = try {
        val response = api.searchGuests(GuestSearchRequest(query, page))
        val body = response.body()
        if (!response.isSuccessful || body?.success != true) throw failure(response.code(), body?.error ?: "Could not search guests.")
        val pagination = body.pagination ?: throw ApiException(response.code(), null, "Guest search response was incomplete.")
        GuestSearchResult(body.data, pagination.page, pagination.totalPages, pagination.total)
    } catch (error: IOException) { throw NetworkUnavailableException(error) }

    suspend fun details(guestId: String): GuestDetailsDto = try {
        val response = api.guestDetails(guestId)
        val body = response.body()
        if (!response.isSuccessful || body?.success != true || body.data == null) throw failure(response.code(), body?.error ?: "Could not load this guest.")
        if (body.data.id != guestId) throw ApiException(409, null, "Guest response did not match the requested record.")
        body.data
    } catch (error: IOException) { throw NetworkUnavailableException(error) }

    suspend fun booking(bookingId: String): BookingDetailsDto = try {
        val response = api.bookingDetails(bookingId)
        val body = response.body()
        if (!response.isSuccessful || body?.success != true || body.data == null) throw failure(response.code(), body?.error ?: "Could not load this booking.")
        if (body.data.id != bookingId) throw ApiException(409, null, "Booking response did not match the requested record.")
        body.data
    } catch (error: IOException) { throw NetworkUnavailableException(error) }

    private fun failure(status: Int, fallback: String): ApiException = ApiException(status, null, when (status) {
        403 -> "Access denied or permissions changed. Sign in again or contact your manager."
        401 -> "Your session is no longer valid. Please sign in again."
        404 -> "This item is unavailable, or the server needs an update."
        else -> fallback
    })
}
