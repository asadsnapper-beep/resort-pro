package site.resortpro.android.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ApiEnvelope<T>(
    val success: Boolean,
    val data: T? = null,
    val message: String? = null,
    val error: String? = null,
    val code: String? = null,
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    val slug: String,
)

@Serializable
data class LoginData(
    val token: String,
    val user: UserDto,
    val tenant: TenantDto,
)

@Serializable
data class RefreshData(val token: String)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val role: String,
    val tenantId: String? = null,
    val phone: String? = null,
    val avatarUrl: String? = null,
)

@Serializable
data class TenantDto(
    val id: String,
    val name: String,
    val slug: String,
    val plan: String,
    val planStatus: String? = null,
    val trialEndsAt: String? = null,
    val isActive: Boolean,
    val onboardingStep: Int? = null,
    val onboardingCompletedAt: String? = null,
)

@Serializable
data class DashboardData(val stats: DashboardStats)

@Serializable
data class DashboardStats(
    val totalRooms: Int = 0,
    val availableRooms: Int = 0,
    val occupiedRooms: Int = 0,
    val occupancyRate: Double = 0.0,
    val todayCheckIns: Int = 0,
    val todayCheckOuts: Int = 0,
    val activeBookings: Int = 0,
    val openTickets: Int = 0,
    val monthlyRevenue: Double = 0.0,
    val revenueGrowth: Double = 0.0,
    val pendingHousekeeping: Int = 0,
    val openMaintenance: Int = 0,
)

@Serializable
data class ShareholderSummary(
    val ownershipPercent: Double,
    val joinedAt: String,
    val netProfitThisMonth: Double,
    val estimatedShareThisMonth: Double,
)

@Serializable
data class PaginationMeta(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int,
)

@Serializable
data class RoomDto(
    val id: String,
    val number: String,
    val name: String,
    val type: String,
    val floor: Int? = null,
    val maxOccupancy: Int,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val basePrice: Double,
    val description: String? = null,
    val amenities: List<String> = emptyList(),
    val images: List<String> = emptyList(),
    val videos: List<String> = emptyList(),
    val status: String,
    val isActive: Boolean = true,
)

@Serializable
data class PaginatedRoomEnvelope(
    val success: Boolean,
    val data: List<RoomDto> = emptyList(),
    val pagination: PaginationMeta? = null,
    val message: String? = null,
    val error: String? = null,
    val code: String? = null,
)

@Serializable
data class HousekeepingRoomDto(
    val number: String,
    val name: String,
    val floor: Int? = null,
)

@Serializable
data class HousekeepingUserDto(
    val firstName: String,
    val lastName: String,
)

@Serializable
data class HousekeepingAssigneeDto(
    val id: String,
    val userId: String,
    val user: HousekeepingUserDto? = null,
)

@Serializable
data class HousekeepingTaskDto(
    val id: String,
    val roomId: String,
    val assignedToId: String? = null,
    val type: String,
    val status: String,
    val scheduledDate: String,
    val completedAt: String? = null,
    val notes: String? = null,
    val room: HousekeepingRoomDto? = null,
    val assignedTo: HousekeepingAssigneeDto? = null,
)

@Serializable
data class PaginatedHousekeepingEnvelope(
    val success: Boolean,
    val data: List<HousekeepingTaskDto> = emptyList(),
    val pagination: PaginationMeta? = null,
    val message: String? = null,
    val error: String? = null,
    val code: String? = null,
)

@Serializable
data class UpdateHousekeepingStatusRequest(
    val status: String,
    val expectedStatus: String? = null,
)

@Serializable
data class ResolvedRateDto(
    @Serializable(with = FlexibleDoubleSerializer::class)
    val price: Double,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val totalPrice: Double,
    val planName: String,
    val planType: String,
)

@Serializable
data class RateQuoteDto(
    val roomId: String,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val basePrice: Double,
    val resolved: ResolvedRateDto? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val effectivePrice: Double,
)

@Serializable
data class WalkInRequest(
    val guestName: String,
    val guestPhone: String? = null,
    val adults: Int,
    val children: Int,
    val roomId: String,
    val checkIn: String,
    val checkOut: String,
    val discount: Double = 0.0,
    val paymentMethod: String,
    val advanceAmount: Double? = null,
    val roomNotes: String? = null,
)

@Serializable
data class WalkInGuestDto(
    val firstName: String,
    val lastName: String,
    val phone: String? = null,
)

@Serializable
data class WalkInRoomDto(
    val number: String,
    val name: String,
    val type: String,
)

@Serializable
data class WalkInBookingDto(
    val id: String,
    val guestId: String,
    val confirmationNo: String,
    val status: String,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val totalAmount: Double,
    val guest: WalkInGuestDto? = null,
    val room: WalkInRoomDto? = null,
)

@Serializable
data class CookieRecord(
    val name: String,
    val value: String,
    val domain: String,
    val path: String,
    val expiresAt: Long,
    val secure: Boolean,
    val httpOnly: Boolean,
    val hostOnly: Boolean,
)

class ApiException(
    val status: Int,
    val apiCode: String?,
    override val message: String,
) : Exception(message)

class NetworkUnavailableException(cause: Throwable) : Exception(
    "Could not reach ResortPro. Check your connection and try again.",
    cause,
)
