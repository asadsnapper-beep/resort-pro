package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.feature.walkin.WalkInValidator

class WalkInValidatorTest {
    @Test
    fun validWalkInPasses() {
        assertTrue(validate().isValid)
    }

    @Test
    fun roomCapacityIsEnforced() {
        assertEquals(
            "This room allows up to 2 guests.",
            validate(adults = 2, children = 1).occupancyError,
        )
    }

    @Test
    fun advanceCannotExceedQuote() {
        assertEquals(
            "Advance cannot exceed the estimated total.",
            validate(advance = "5001", total = 5000.0).advanceError,
        )
    }

    @Test
    fun payLaterRejectsStaleAdvance() {
        assertEquals(
            "Advance is not used for Pay later.",
            validate(payment = "LATER", advance = "100").advanceError,
        )
    }

    private fun validate(
        adults: Int = 1,
        children: Int = 0,
        payment: String = "CASH",
        advance: String = "",
        total: Double = 5000.0,
    ) = WalkInValidator.validate(
        guestName = "Rahman Ahmed",
        checkIn = "2026-09-01",
        checkOut = "2026-09-02",
        room = RoomDto(
            id = "room-1",
            number = "101",
            name = "Sea View",
            type = "STANDARD",
            maxOccupancy = 2,
            basePrice = 5000.0,
            status = "AVAILABLE",
        ),
        adults = adults,
        children = children,
        paymentMethod = payment,
        advanceText = advance,
        estimatedTotal = total,
    )
}
