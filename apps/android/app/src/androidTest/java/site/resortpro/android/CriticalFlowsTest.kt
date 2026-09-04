package site.resortpro.android

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import site.resortpro.android.core.network.TenantDto
import site.resortpro.android.core.network.UserDto
import site.resortpro.android.feature.auth.AuthUiState
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.auth.HomeContent
import site.resortpro.android.ui.HomeScreen
import site.resortpro.android.ui.LoginScreen
import site.resortpro.android.ui.WalkInSubmissionControls
import site.resortpro.android.ui.theme.ResortProTheme

@RunWith(AndroidJUnit4::class)
class CriticalFlowsTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun walkIn_secondTapIsBlocked_andUncertainOutcomeRequiresAcknowledgement() {
        var submitting by mutableStateOf(false)
        var uncertain by mutableStateOf(false)
        var submissions = 0
        compose.setContent {
            ResortProTheme {
                WalkInSubmissionControls(
                    canSubmit = true,
                    isSubmitting = submitting,
                    submissionUncertain = uncertain,
                    onSubmit = { submissions += 1; submitting = true },
                    onAcknowledgeUncertain = { uncertain = false },
                )
            }
        }

        compose.onNodeWithText("Check in guest").performClick()
        compose.onNodeWithText("Check in guest").assertIsNotEnabled()
        compose.onNodeWithText("Check in guest").performClick()
        assertEquals(1, submissions)

        compose.runOnIdle { submitting = false; uncertain = true }
        compose.onNodeWithText("Check in guest").assertIsNotEnabled()
        compose.onNodeWithText("I checked Front Desk — allow retry").assertIsDisplayed().performClick()
        compose.onNodeWithText("I checked Front Desk — allow retry").assertDoesNotExist()
    }

    @Test
    fun loginActionMovesToRoleAwareHome() {
        var signedIn by mutableStateOf(false)
        val session = AuthenticatedSession(
            user = UserDto("u1", "owner@example.com", "Asha", "Hore", "OWNER", "t1"),
            tenant = TenantDto("t1", "Palm Paradise", "palm-paradise", "PRO", isActive = true),
        )
        compose.setContent {
            ResortProTheme {
                if (signedIn) {
                    HomeScreen(
                        state = AuthUiState(isRestoring = false, session = session, home = HomeContent.Limited("Ready")),
                        session = session,
                        onRetry = {},
                        onOpenRooms = {},
                        onOpenHousekeeping = {},
                        onOpenWalkIn = {},
                        onLogout = {},
                    )
                } else {
                    LoginScreen(
                        state = AuthUiState(isRestoring = false),
                        onSlugChange = {},
                        onEmailChange = {},
                        onPasswordChange = {},
                        onTogglePassword = {},
                        onSubmit = { signedIn = true },
                    )
                }
            }
        }

        compose.onNodeWithText("Sign in").performClick()
        compose.onNodeWithText("Palm Paradise").assertIsDisplayed()
        compose.onNodeWithText("Asha Hore · Owner").assertIsDisplayed()
        compose.onNodeWithText("Rooms & availability").assertIsDisplayed()
    }
}
