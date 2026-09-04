package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import site.resortpro.android.feature.rooms.AvailabilityValidator

class AvailabilityValidatorTest {
    @Test
    fun validDateRangePasses() {
        assertTrue(AvailabilityValidator.validate("2026-09-01", "2026-09-03").isValid)
    }

    @Test
    fun malformedOrImpossibleDatesFail() {
        val result = AvailabilityValidator.validate("2026-02-30", "03-01-2026")
        assertEquals("Use YYYY-MM-DD.", result.checkInError)
        assertEquals("Use YYYY-MM-DD.", result.checkOutError)
    }

    @Test
    fun checkoutMustBeAfterCheckin() {
        val sameDay = AvailabilityValidator.validate("2026-09-01", "2026-09-01")
        val earlier = AvailabilityValidator.validate("2026-09-02", "2026-09-01")
        assertEquals("Check-out must be after check-in.", sameDay.checkOutError)
        assertEquals("Check-out must be after check-in.", earlier.checkOutError)
    }
}
