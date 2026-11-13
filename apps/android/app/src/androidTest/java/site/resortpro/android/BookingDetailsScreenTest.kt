package site.resortpro.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import site.resortpro.android.core.network.BookingDetailsDto
import site.resortpro.android.core.network.BookingGuestDto
import site.resortpro.android.core.network.GuestBookingRoomDto
import site.resortpro.android.feature.guests.BookingDetailsState
import site.resortpro.android.ui.BookingDetailsContent
import site.resortpro.android.ui.theme.ResortProTheme

@RunWith(AndroidJUnit4::class)
class BookingDetailsScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun receptionistCanSeeBookingPaymentSummary() {
        val booking = BookingDetailsDto("b1", "DEMO-1", "CHECKED_IN", "2026-11-01", "2026-11-02", 2, 0, BookingGuestDto("Demo", "Guest"), GuestBookingRoomDto("101", "Garden"), "PAID", 1000.0, 1000.0)
        compose.setContent { ResortProTheme { BookingDetailsContent(BookingDetailsState(booking = booking), {}, {}, true) } }
        compose.onNodeWithText("Booking DEMO-1").assertIsDisplayed()
        compose.onNodeWithTag("bookingDetailsList").performScrollToNode(hasText("Payment summary"))
        compose.onNodeWithText("Payment summary").assertIsDisplayed()
    }
    @Test fun restrictedViewDoesNotShowPaymentSummary() {
        val booking = BookingDetailsDto("b1", "DEMO-1", "CHECKED_IN", "2026-11-01", "2026-11-02", 2, 0, BookingGuestDto("Demo", "Guest"), GuestBookingRoomDto("101", "Garden"), "PAID", 1000.0, 1000.0)
        compose.setContent { ResortProTheme { BookingDetailsContent(BookingDetailsState(booking = booking), {}, {}, false) } }
        compose.onNodeWithText("Booking DEMO-1").assertIsDisplayed()
        compose.onNodeWithText("Payment summary").assertDoesNotExist()
    }
}
