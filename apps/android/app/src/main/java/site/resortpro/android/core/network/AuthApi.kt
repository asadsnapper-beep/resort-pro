package site.resortpro.android.core.network

import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Multipart
import retrofit2.http.Part
import retrofit2.http.Header
import okhttp3.MultipartBody
import okhttp3.RequestBody

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiEnvelope<LoginData>>

    @GET("api/auth/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("api/auth/logout")
    suspend fun logout(): Response<ApiEnvelope<JsonElement>>

    @GET("api/dashboard")
    suspend fun dashboard(): Response<ApiEnvelope<DashboardData>>

    @GET("api/dashboard/analytics")
    suspend fun analytics(): Response<ApiEnvelope<AnalyticsData>>

    @GET("api/shareholders/me")
    suspend fun shareholderSummary(): Response<ApiEnvelope<ShareholderSummary>>

    @GET("api/rooms")
    suspend fun rooms(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 100,
    ): Response<PaginatedRoomEnvelope>

    @GET("api/rooms/{id}")
    suspend fun roomDetails(@Path("id") roomId: String): Response<ApiEnvelope<RoomDto>>

    @POST("api/mobile/guests/search")
    suspend fun searchGuests(@Body request: GuestSearchRequest): Response<GuestSearchEnvelope>

    @GET("api/mobile/guests/{id}")
    suspend fun guestDetails(@Path("id") guestId: String): Response<ApiEnvelope<GuestDetailsDto>>

    @GET("api/mobile/bookings/{id}")
    suspend fun bookingDetails(@Path("id") bookingId: String): Response<ApiEnvelope<BookingDetailsDto>>

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

    @Multipart
    @POST("api/guests/{id}/documents")
    suspend fun uploadGuestImage(
        @Path("id") guestId: String,
        @Part("docType") docType: RequestBody,
        @Part("bookingId") bookingId: RequestBody,
        @Part file: MultipartBody.Part,
        @Header("Idempotency-Key") uploadId: String? = null,
    ): Response<ApiEnvelope<GuestImageUpload>>

    @GET("api/guests/document-upload-capabilities")
    suspend fun guestImageCapabilities(): Response<ApiEnvelope<GuestImageCapabilities>>
}
