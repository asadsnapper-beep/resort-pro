package site.resortpro.android.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import site.resortpro.android.core.AppContainer
import site.resortpro.android.feature.auth.AuthViewModel
import site.resortpro.android.feature.auth.RolePolicy
import site.resortpro.android.feature.housekeeping.HousekeepingViewModel
import site.resortpro.android.feature.rooms.RoomsViewModel
import site.resortpro.android.feature.walkin.WalkInViewModel
import site.resortpro.android.ui.components.LoadingScreen

private object Route {
    const val HOME = "home"
    const val ROOMS = "rooms"
    const val HOUSEKEEPING = "housekeeping"
    const val WALK_IN = "walk-in"
}

@Composable
fun ResortProApp(viewModel: AuthViewModel, container: AppContainer, activity: FragmentActivity) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val session = state.session

    // The lock has to re-arm when the app is put away, not only on a cold
    // start — otherwise pressing home and reopening walks straight past it.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_STOP -> viewModel.onBackgrounded()
                Lifecycle.Event.ON_START -> viewModel.onForegrounded()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        when {
            state.isRestoring -> LoadingScreen("Restoring your secure session…")
            state.lockedSession != null -> {
                // Raised as soon as the locked state appears, so the usual path
                // is: open app, thumb, in. Keyed on lockPromptPending so that
                // dismissing it does not immediately raise it again, and
                // pressing Unlock does.
                if (state.lockPromptPending) {
                    LaunchedEffect(state.lockedSession, state.lockPromptPending) {
                        val unlocked = container.appLock.authenticate(
                            activity = activity,
                            title = "Unlock ResortPro",
                            subtitle = "Confirm it's you to continue where you left off",
                        )
                        if (unlocked) viewModel.unlocked() else viewModel.lockRefused()
                    }
                }
                LockedScreen(
                    onUnlock = viewModel::retryUnlock,
                    onSignOut = viewModel::signOutFromLock,
                )
            }
            session == null -> LoginScreen(
                state = state,
                onSlugChange = viewModel::updateSlug,
                onEmailChange = viewModel::updateEmail,
                onPasswordChange = viewModel::updatePassword,
                onTogglePassword = viewModel::togglePasswordVisibility,
                onSubmit = viewModel::submitLogin,
            )
            else -> {
                val navController = rememberNavController()
                NavHost(navController = navController, startDestination = Route.HOME) {
                    composable(Route.HOME) {
                        HomeScreen(
                            state = state,
                            session = session,
                            onRetry = viewModel::retryHome,
                            onOpenRooms = permitted(RolePolicy.canViewRooms(session.user.role)) {
                                navController.navigate(Route.ROOMS)
                            },
                            onOpenHousekeeping = permitted(RolePolicy.canViewHousekeeping(session.user.role)) {
                                navController.navigate(Route.HOUSEKEEPING)
                            },
                            onOpenWalkIn = permitted(RolePolicy.canCreateWalkIn(session.user.role)) {
                                navController.navigate(Route.WALK_IN)
                            },
                            onEnableAppLock = viewModel::enableAppLock,
                            onDeclineAppLock = viewModel::declineAppLock,
                            onLogout = viewModel::logout,
                        )
                    }
                    composable(Route.ROOMS) {
                        if (!RolePolicy.canViewRooms(session.user.role)) {
                            navController.popBackStack()
                            return@composable
                        }
                        val screenModel: RoomsViewModel = viewModel(
                            factory = RoomsViewModel.Factory(container.roomsRepository),
                        )
                        RoomsScreen(screenModel, session, navController::navigateUp, viewModel::logout)
                    }
                    composable(Route.HOUSEKEEPING) {
                        if (!RolePolicy.canViewHousekeeping(session.user.role)) {
                            navController.popBackStack()
                            return@composable
                        }
                        val screenModel: HousekeepingViewModel = viewModel(
                            factory = HousekeepingViewModel.Factory(container.housekeepingRepository),
                        )
                        HousekeepingScreen(screenModel, session, navController::navigateUp, viewModel::logout)
                    }
                    composable(Route.WALK_IN) {
                        if (!RolePolicy.canCreateWalkIn(session.user.role)) {
                            navController.popBackStack()
                            return@composable
                        }
                        val screenModel: WalkInViewModel = viewModel(
                            factory = WalkInViewModel.Factory(container.walkInRepository),
                        )
                        WalkInScreen(screenModel, session, navController::navigateUp, viewModel::logout)
                    }
                }
            }
        }
    }
}

private fun permitted(allowed: Boolean, action: () -> Unit): (() -> Unit)? =
    action.takeIf { allowed }
