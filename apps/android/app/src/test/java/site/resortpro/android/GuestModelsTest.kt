package site.resortpro.android

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test
import site.resortpro.android.core.network.ApiEnvelope
import site.resortpro.android.core.network.GuestDetailsDto
import site.resortpro.android.core.network.BookingDetailsDto

class GuestModelsTest {
    @Test
    fun guestDetailsDecodeOnlyNeededGuestAndBookingFields() {
        val json = Json { ignoreUnknownKeys = true }
        val envelope = json.decodeFromString<ApiEnvelope<GuestDetailsDto>>("""{"success":true,"data":{"id":"g1","firstName":"Demo","lastName":"Guest","idNumber":"ignored","bookings":[{"id":"b1","confirmationNo":"DEMO-1","status":"CHECKED_IN","checkIn":"2026-11-01T00:00:00.000Z","checkOut":"2026-11-02T00:00:00.000Z","room":{"number":"101","name":"Garden"},"totalAmount":"1000.00"}]}}""")
        assertEquals("Demo", envelope.data?.firstName)
        assertEquals("101", envelope.data?.bookings?.single()?.room?.number)
        assertEquals("CHECKED_IN", envelope.data?.bookings?.single()?.status)
    }

    @Test fun bookingAmountsDecodeFromPrismaDecimalStrings() {
        val json = Json { ignoreUnknownKeys = true }
        val envelope = json.decodeFromString<ApiEnvelope<BookingDetailsDto>>("""{"success":true,"data":{"id":"b1","confirmationNo":"X1","status":"CONFIRMED","checkIn":"2026-11-01","checkOut":"2026-11-02","adults":2,"children":0,"guest":{"firstName":"Demo","lastName":"Guest"},"room":{"number":"101","name":"Garden"},"totalAmount":"1500.50","paidAmount":"500.25"}}""")
        assertEquals(1500.5, envelope.data!!.totalAmount!!, 0.001)
        assertEquals(500.25, envelope.data!!.paidAmount!!, 0.001)
    }

    @Test fun responseWithoutFinancialFieldsDoesNotInventAmounts() {
        val json = Json { ignoreUnknownKeys = true }
        val envelope = json.decodeFromString<ApiEnvelope<BookingDetailsDto>>("""{"success":true,"data":{"id":"b1","confirmationNo":"X1","status":"CONFIRMED","checkIn":"2026-11-01","checkOut":"2026-11-02","adults":2,"children":0,"guest":{"firstName":"Demo","lastName":"Guest"},"room":{"number":"101","name":"Garden"}}}""")
        assertEquals(null, envelope.data?.totalAmount)
        assertEquals(null, envelope.data?.paidAmount)
    }
}
