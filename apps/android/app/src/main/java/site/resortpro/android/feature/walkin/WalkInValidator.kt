package site.resortpro.android.feature.walkin

import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.feature.rooms.AvailabilityValidator

data class WalkInValidation(
    val guestNameError: String? = null,
    val checkInError: String? = null,
    val checkOutError: String? = null,
    val roomError: String? = null,
    val occupancyError: String? = null,
    val advanceError: String? = null,
) {
    val isValid: Boolean get() = listOf(
        guestNameError,
        checkInError,
        checkOutError,
        roomError,
        occupancyError,
        advanceError,
    ).all { it == null }
}

object WalkInValidator {
    fun validate(
        guestName: String,
        checkIn: String,
        checkOut: String,
        room: RoomDto?,
        adults: Int,
        children: Int,
        paymentMethod: String,
        advanceText: String,
        estimatedTotal: Double?,
    ): WalkInValidation {
        val dates = AvailabilityValidator.validate(checkIn, checkOut)
        val advance = advanceText.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull()
        return WalkInValidation(
            guestNameError = if (guestName.trim().isEmpty()) "Guest name is required." else null,
            checkInError = dates.checkInError,
            checkOutError = dates.checkOutError,
            roomError = if (room == null) "Select an available room." else null,
            occupancyError = when {
                adults < 1 -> "At least one adult is required."
                children < 0 -> "Children cannot be negative."
                room != null && adults + children > room.maxOccupancy ->
                    "This room allows up to ${room.maxOccupancy} guests."
                else -> null
            },
            advanceError = when {
                paymentMethod == "LATER" && advanceText.isNotBlank() -> "Advance is not used for Pay later."
                advanceText.isNotBlank() && advance == null -> "Enter a valid amount."
                advance != null && advance < 0 -> "Advance cannot be negative."
                advance != null && estimatedTotal != null && advance > estimatedTotal ->
                    "Advance cannot exceed the estimated total."
                else -> null
            },
        )
    }
}
