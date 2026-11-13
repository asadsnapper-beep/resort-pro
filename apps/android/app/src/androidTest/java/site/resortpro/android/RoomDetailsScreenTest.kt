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
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.feature.rooms.RoomDetailsState
import site.resortpro.android.ui.RoomDetailsContent
import site.resortpro.android.ui.theme.ResortProTheme

@RunWith(AndroidJUnit4::class)
class RoomDetailsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun currentStatusAndDateAvailabilityAreClearlySeparate() {
        val room = RoomDto("r1", "101", "Garden Suite", "SUITE", maxOccupancy = 2, basePrice = 4000.0, status = "OCCUPIED")
        compose.setContent {
            ResortProTheme {
                RoomDetailsContent(RoomDetailsState(room = room, checkIn = "2026-11-01", checkOut = "2026-11-02", available = true), {}, {}, null)
            }
        }
        compose.onNodeWithTag("roomDetailsList").performScrollToNode(hasText("Current room status"))
        compose.onNodeWithText("Current room status").assertIsDisplayed()
        compose.onNodeWithText("Occupied").assertIsDisplayed()
        compose.onNodeWithTag("roomDetailsList").performScrollToNode(hasText("Available for these dates"))
        compose.onNodeWithText("Available for these dates").assertIsDisplayed()
    }

    @Test
    fun failedAvailabilityDoesNotClaimRoomIsAvailable() {
        val room = RoomDto("r1", "101", "Garden Suite", "SUITE", maxOccupancy = 2, basePrice = 4000.0, status = "AVAILABLE")
        compose.setContent {
            ResortProTheme {
                RoomDetailsContent(RoomDetailsState(room = room, fromCache = true, syncedAt = 1, checkIn = "2026-11-01", checkOut = "2026-11-02", availabilityError = "offline"), {}, {}, null)
            }
        }
        compose.onNodeWithTag("roomDetailsList").performScrollToNode(hasText("Could not verify availability. Please try again online."))
        compose.onNodeWithText("Could not verify availability. Please try again online.").assertIsDisplayed()
        compose.onNodeWithText("Available for these dates").assertDoesNotExist()
    }
}
