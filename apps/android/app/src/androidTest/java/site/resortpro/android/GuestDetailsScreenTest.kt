package site.resortpro.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import site.resortpro.android.core.network.GuestBookingDto
import site.resortpro.android.core.network.GuestBookingRoomDto
import site.resortpro.android.core.network.GuestDetailsDto
import site.resortpro.android.feature.guests.GuestDetailState
import site.resortpro.android.ui.GuestDetailsContent
import site.resortpro.android.ui.theme.ResortProTheme

@RunWith(AndroidJUnit4::class)
class GuestDetailsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun syntheticGuestShowsBookingAndHidesPlaceholderEmail() {
        val guest = GuestDetailsDto("g1", "Demo", "Guest", email = "walkin-1@resortpro.local", bookings = listOf(GuestBookingDto("b1", "DEMO-1", "CHECKED_IN", "2026-11-01", "2026-11-02", GuestBookingRoomDto("101", "Garden"))))
        compose.setContent { ResortProTheme { GuestDetailsContent(GuestDetailState(guest = guest), {}, {}) } }
        compose.onNodeWithText("Demo Guest").assertIsDisplayed()
        compose.onNodeWithText("walkin-1@resortpro.local").assertDoesNotExist()
        compose.onNodeWithTag("guestDetailsList").performScrollToNode(hasText("Room 101 · Garden"))
        compose.onNodeWithText("Room 101 · Garden").assertIsDisplayed()
        compose.onNodeWithText("Checked in").assertIsDisplayed()
    }
}
