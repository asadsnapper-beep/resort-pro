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
        if (!response.isSuccessful || body?.success != true) throw failure(response.code(), body?.error)
        val pagination = body.pagination ?: throw ApiException(INCOMPLETE, null, "")
        GuestSearchResult(body.data, pagination.page, pagination.totalPages, pagination.total)
    } catch (error: IOException) { throw NetworkUnavailableException(error) }

    suspend fun details(guestId: String): GuestDetailsDto = try {
        val response = api.guestDetails(guestId)
        val body = response.body()
        if (!response.isSuccessful || body?.success != true || body.data == null) throw failure(response.code(), body?.error)
        if (body.data.id != guestId) throw ApiException(MISMATCH, null, "")
        body.data
    } catch (error: IOException) { throw NetworkUnavailableException(error) }

    suspend fun booking(bookingId: String): BookingDetailsDto = try {
        val response = api.bookingDetails(bookingId)
        val body = response.body()
        if (!response.isSuccessful || body?.success != true || body.data == null) throw failure(response.code(), body?.error)
        if (body.data.id != bookingId) throw ApiException(MISMATCH, null, "")
        body.data
    } catch (error: IOException) { throw NetworkUnavailableException(error) }

    /**
     * The status is carried through untouched and `Throwable.toGuestError` turns
     * it into a string resource. Phrasing it here as well would put the same
     * decision in two layers, and the prose version is the one values-bn cannot
     * reach — which is the whole reason it moved.
     *
     * Only text the server itself sent is passed along, and only as a last
     * resort for a status with no specific meaning.
     */
    private fun failure(status: Int, serverText: String?): ApiException =
        ApiException(status, null, serverText.orEmpty())

    private companion object {
        /**
         * Minted here, not returned by the API: the call succeeded but the body
         * was not usable. 409 follows the convention this file already set for a
         * response describing a different record than the one asked for.
         */
        const val MISMATCH = 409
        const val INCOMPLETE = 422
    }
}
