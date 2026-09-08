package site.resortpro.android.core.network

import kotlinx.serialization.json.JsonElement
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiEnvelope<LoginData>>

    @GET("api/auth/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("api/auth/logout")
    suspend fun logout(): Response<ApiEnvelope<JsonElement>>

    @GET("api/dashboard")
    suspend fun dashboard(): Response<ApiEnvelope<DashboardData>>

    @GET("api/shareholders/me")
    suspend fun shareholderSummary(): Response<ApiEnvelope<ShareholderSummary>>

    @GET("api/rooms")
    suspend fun rooms(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 100,
    ): Response<PaginatedRoomEnvelope>

    @GET("api/rooms/availability")
    suspend fun roomAvailability(
        @Query("checkIn") checkIn: String,
        @Query("checkOut") checkOut: String,
    ): Response<ApiEnvelope<List<RoomDto>>>

    @GET("api/housekeeping")
    suspend fun housekeepingTasks(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 100,
    ): Response<PaginatedHousekeepingEnvelope>

    @PATCH("api/housekeeping/{id}/status")
    suspend fun updateHousekeepingStatus(
        @Path("id") id: String,
        @Body request: UpdateHousekeepingStatusRequest,
    ): Response<ApiEnvelope<HousekeepingTaskDto>>

    @GET("api/rate-plans/resolve")
    suspend fun resolveRate(
        @Query("roomId") roomId: String,
        @Query("checkIn") checkIn: String,
        @Query("checkOut") checkOut: String,
    ): Response<ApiEnvelope<RateQuoteDto>>

    @POST("api/bookings/walk-in")
    suspend fun createWalkIn(
        @Body request: WalkInRequest,
    ): Response<ApiEnvelope<WalkInBookingDto>>

    /**
     * A photograph of the guest's ID, attached to the stay it was taken for.
     *
     * bookingId is optional to the server, which drops it if it does not belong
     * to this guest — so the document lands on the guest either way, and never
     * on the wrong stay.
     */
    @Multipart
    @POST("api/guests/{id}/documents")
    suspend fun uploadGuestDocument(
        @Path("id") guestId: String,
        @Part file: MultipartBody.Part,
        @Part("docType") docType: RequestBody,
        @Part("bookingId") bookingId: RequestBody?,
    ): Response<ApiEnvelope<JsonElement>>
}
