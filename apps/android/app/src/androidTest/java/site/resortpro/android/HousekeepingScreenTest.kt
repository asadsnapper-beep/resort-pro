package site.resortpro.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import site.resortpro.android.core.network.HousekeepingRoomDto
import site.resortpro.android.core.network.HousekeepingTaskDto
import site.resortpro.android.ui.HousekeepingTaskCard
import site.resortpro.android.ui.theme.ResortProTheme

@RunWith(AndroidJUnit4::class)
class HousekeepingScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun queuedTaskShowsSyncWarningAndDoesNotOfferAnotherUpdate() {
        compose.setContent {
            ResortProTheme {
                HousekeepingTaskCard(
                    task = HousekeepingTaskDto("task-1", "room-1", type = "DAILY", status = "IN_PROGRESS", scheduledDate = "2026-10-30", room = HousekeepingRoomDto("101", "Garden")),
                    isUpdating = false,
                    isQueued = true,
                    isStaffView = true,
                    onUpdateStatus = {},
                )
            }
        }
        compose.onNodeWithText("Room 101").assertIsDisplayed()
        compose.onNodeWithText("Waiting for sync. Refresh before making another update.").assertIsDisplayed()
        compose.onNodeWithText("Complete").assertDoesNotExist()
    }
}
