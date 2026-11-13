package site.resortpro.android.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.Scaffold
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import androidx.navigation.NavType
import android.net.Uri
import site.resortpro.android.R
import site.resortpro.android.core.AppContainer
import site.resortpro.android.feature.auth.AuthViewModel
import site.resortpro.android.feature.auth.HomeKind
import site.resortpro.android.feature.auth.RolePolicy
import site.resortpro.android.feature.housekeeping.HousekeepingViewModel
import site.resortpro.android.feature.rooms.RoomsViewModel
import site.resortpro.android.feature.rooms.RoomDetailsViewModel
import site.resortpro.android.feature.guests.GuestsViewModel
import site.resortpro.android.feature.guests.GuestDetailsViewModel
import site.resortpro.android.feature.guests.BookingDetailsViewModel
import site.resortpro.android.feature.walkin.WalkInViewModel
import site.resortpro.android.ui.components.LoadingScreen

private object Route {
    const val HOME = "home"
    const val ROOMS = "rooms"
    const val ROOM_DETAILS = "room/{roomId}?checkIn={checkIn}&checkOut={checkOut}"
    const val GUESTS = "guests"
    const val GUEST_DETAILS = "guest/{guestId}"
    const val BOOKING_DETAILS = "booking/{bookingId}"
    const val HOUSEKEEPING = "housekeeping"
    const val WALK_IN = "walk-in"
    const val ANALYTICS = "analytics"
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
            state.restoreRetryRequired -> SessionRestoreScreen(viewModel::restoreSession, viewModel::signInInstead)
            state.lockedSession != null -> {
                // Raised as soon as the locked state appears, so the usual path
                // is: open app, thumb, in. Keyed on lockPromptPending so that
                // dismissing it does not immediately raise it again, and
                // pressing Unlock does.
                if (state.lockPromptPending) {
                    // Read outside the effect: stringResource is a composable.
                    val promptTitle = stringResource(R.string.lock_prompt_title)
                    val promptSubtitle = stringResource(R.string.lock_prompt_subtitle)
                    LaunchedEffect(state.lockedSession, state.lockPromptPending) {
                        val unlocked = container.appLock.authenticate(
                            activity = activity,
                            title = promptTitle,
                            subtitle = promptSubtitle,
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
                // Housekeeping is not a place staff navigate to — it is their
                // whole job. Their old home screen existed only to say "Open
                // Housekeeping to view and update your assigned tasks", which
                // is a signpost standing where the thing itself should be.
                val isFieldStaff = RolePolicy.homeKind(session.user.role) == HomeKind.STAFF
                val startDestination = if (isFieldStaff) Route.HOUSEKEEPING else Route.HOME
                val entry by navController.currentBackStackEntryAsState()
                val currentRoute = entry?.destination?.route
                Scaffold(bottomBar = {
                    if (!isFieldStaff && currentRoute in setOf(Route.HOME, Route.ROOMS, Route.ANALYTICS)) {
                        NavigationBar {
                            val destinations = buildList {
                                add(Triple(Route.HOME, "⌂", "Home"))
                                if (RolePolicy.canViewRooms(session.user.role)) add(Triple(Route.ROOMS, "▦", "Rooms"))
                                if (RolePolicy.canViewAnalytics(session.user.role)) add(Triple(Route.ANALYTICS, "▥", "Analytics"))
                            }
                            destinations.forEach { (route, icon, label) ->
                                NavigationBarItem(selected = currentRoute == route, onClick = {
                                    navController.navigate(route) { popUpTo(Route.HOME); launchSingleTop = true }
                                }, icon = { Text(icon) }, label = { Text(label) })
                            }
                        }
                    }
                }) { padding ->
                NavHost(navController = navController, startDestination = startDestination, modifier = Modifier.padding(padding)) {
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
                            onOpenAnalytics = permitted(RolePolicy.canViewAnalytics(session.user.role)) {
                                navController.navigate(Route.ANALYTICS)
                            },
                            onEnableAppLock = viewModel::enableAppLock,
                            onDeclineAppLock = viewModel::declineAppLock,
                            onLogout = viewModel::logout,
                            onOpenGuests = permitted(RolePolicy.canViewGuests(session.user.role)) { navController.navigate(Route.GUESTS) },
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
                        RoomsScreen(screenModel, session, navController::navigateUp, viewModel::logout) { id, checkIn, checkOut ->
                            val dates = if (checkIn != null && checkOut != null) "?checkIn=${Uri.encode(checkIn)}&checkOut=${Uri.encode(checkOut)}" else ""
                            navController.navigate("room/${Uri.encode(id)}$dates")
                        }
                    }
                    composable(Route.ROOM_DETAILS, arguments = listOf(
                        navArgument("checkIn") { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument("checkOut") { type = NavType.StringType; nullable = true; defaultValue = null },
                    )) { roomEntry ->
                        if (!RolePolicy.canViewRooms(session.user.role)) {
                            navController.popBackStack()
                            return@composable
                        }
                        val roomId = roomEntry.arguments?.getString("roomId") ?: return@composable
                        val tenantId = session.user.tenantId ?: session.tenant?.id ?: return@composable
                        val screenModel: RoomDetailsViewModel = viewModel(factory = RoomDetailsViewModel.Factory(
                            container.roomsRepository, roomId, tenantId,
                            roomEntry.arguments?.getString("checkIn"), roomEntry.arguments?.getString("checkOut"),
                        ))
                        RoomDetailsScreen(screenModel, navController::navigateUp, if (RolePolicy.canCreateWalkIn(session.user.role)) ({ navController.navigate(Route.WALK_IN) }) else null)
                    }
                    composable(Route.HOUSEKEEPING) {
                        if (!RolePolicy.canViewHousekeeping(session.user.role)) {
                            navController.popBackStack()
                            return@composable
                        }
                        val screenModel: HousekeepingViewModel = viewModel(
                            factory = HousekeepingViewModel.Factory(container.housekeepingRepository),
                        )
                        HousekeepingScreen(
                            viewModel = screenModel,
                            session = session,
                            onBack = if (isFieldStaff) null else { { navController.navigateUp() } },
                            onLogout = viewModel::logout,
                        )
                    }
                    composable(Route.GUESTS) {
                        if (!RolePolicy.canViewGuests(session.user.role)) { navController.popBackStack(); return@composable }
                        val screenModel: GuestsViewModel = viewModel(factory = GuestsViewModel.Factory(container.guestsRepository))
                        GuestsScreen(screenModel, navController::navigateUp) { guestId -> navController.navigate("guest/${Uri.encode(guestId)}") }
                    }
                    composable(Route.GUEST_DETAILS) { guestEntry ->
                        if (!RolePolicy.canViewGuests(session.user.role)) { navController.popBackStack(); return@composable }
                        val guestId = guestEntry.arguments?.getString("guestId") ?: return@composable
                        val screenModel: GuestDetailsViewModel = viewModel(factory = GuestDetailsViewModel.Factory(container.guestsRepository, guestId))
                        GuestDetailsScreen(screenModel, navController::navigateUp) { id -> navController.navigate("booking/${Uri.encode(id)}") }
                    }
                    composable(Route.BOOKING_DETAILS) { bookingEntry ->
                        if (!RolePolicy.canViewGuests(session.user.role)) { navController.popBackStack(); return@composable }
                        val id = bookingEntry.arguments?.getString("bookingId") ?: return@composable
                        val screenModel: BookingDetailsViewModel = viewModel(factory = BookingDetailsViewModel.Factory(container.guestsRepository, id))
                        BookingDetailsScreen(screenModel, navController::navigateUp, RolePolicy.canViewBookingPayment(session.user.role))
                    }
                    composable(Route.WALK_IN) {
                        if (!RolePolicy.canCreateWalkIn(session.user.role)) {
                            navController.popBackStack()
                            return@composable
                        }
                        val screenModel: WalkInViewModel = viewModel(
                            factory = WalkInViewModel.Factory(container.walkInRepository, container.pendingGuestImages, session.user.tenantId ?: session.tenant?.id.orEmpty(), session.user.id),
                        )
                        WalkInScreen(screenModel, session, navController::navigateUp, viewModel::logout)
                    }
                    composable(Route.ANALYTICS) {
                        if (RolePolicy.canViewAnalytics(session.user.role)) {
                            AnalyticsScreen(container.authRepository, navController::navigateUp)
                        }
                    }
                }
                }
            }
        }
    }
}

private fun permitted(allowed: Boolean, action: () -> Unit): (() -> Unit)? =
    action.takeIf { allowed }
