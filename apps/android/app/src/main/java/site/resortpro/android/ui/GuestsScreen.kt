package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import site.resortpro.android.R
import site.resortpro.android.core.network.GuestBookingDto
import site.resortpro.android.feature.guests.GuestDetailState
import site.resortpro.android.feature.guests.GuestDetailsViewModel
import site.resortpro.android.feature.guests.GuestsViewModel

@Composable
fun GuestsScreen(viewModel: GuestsViewModel, onBack: () -> Unit, onGuest: (String) -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val focus = LocalFocusManager.current
    Scaffold(Modifier.statusBarsPadding()) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).testTag("guestSearchList"), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }
                Text(stringResource(R.string.guest_search_title), style = MaterialTheme.typography.headlineLarge, fontFamily = FontFamily.Serif)
                Text(stringResource(R.string.guest_search_subtitle), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            item {
                Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = state.query, onValueChange = viewModel::updateQuery,
                            modifier = Modifier.fillMaxWidth().testTag("guestSearchInput"),
                            label = { Text(stringResource(R.string.guest_search_label)) }, singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = { focus.clearFocus(); viewModel.search() }),
                        )
                        Text(stringResource(R.string.guest_search_hint), style = MaterialTheme.typography.bodySmall)
                        Button(onClick = { focus.clearFocus(); viewModel.search() }, enabled = state.query.trim().length >= 2 && !state.isLoading, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(stringResource(R.string.guest_search_action)) }
                    }
                }
            }
            when {
                state.isLoading -> item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.height(24.dp)); Text(stringResource(R.string.guest_loading)) } }
                state.error != null -> item { GuestMessage(state.error.orEmpty()) { viewModel.search(state.page) } }
                state.searched && state.guests.isEmpty() -> item { GuestMessage(stringResource(R.string.guest_none)) }
                state.searched -> {
                    item { Text(stringResource(R.string.guest_search_count, state.total, state.page, state.totalPages), style = MaterialTheme.typography.labelLarge) }
                    items(state.guests, key = { it.id }) { guest ->
                        Card(onClick = { onGuest(guest.id) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("${guest.firstName} ${guest.lastName}".trim(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                guest.phone?.takeIf { it.isNotBlank() }?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                Text(stringResource(R.string.guest_view_profile) + " →", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                    if (state.totalPages > 1) item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            TextButton(onClick = { viewModel.search(state.page - 1) }, enabled = state.page > 1) { Text(stringResource(R.string.guest_previous)) }
                            TextButton(onClick = { viewModel.search(state.page + 1) }, enabled = state.page < state.totalPages) { Text(stringResource(R.string.guest_next)) }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(20.dp)) }
        }
    }
}

@Composable
fun GuestDetailsScreen(viewModel: GuestDetailsViewModel, onBack: () -> Unit, onBooking: (String) -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    GuestDetailsContent(state, onBack, viewModel::retry, onBooking)
}

@Composable
internal fun GuestDetailsContent(state: GuestDetailState, onBack: () -> Unit, onRetry: () -> Unit, onBooking: (String) -> Unit = {}) {
    Scaffold(Modifier.statusBarsPadding()) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).testTag("guestDetailsList"), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }; Text(stringResource(R.string.guest_details_title), style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Serif) }
            when {
                state.isLoading -> item { CircularProgressIndicator() }
                state.error != null -> item { GuestMessage(state.error, onRetry) }
                state.guest != null -> {
                    val guest = state.guest
                    item {
                        Surface(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(24.dp)) {
                            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("${guest.firstName} ${guest.lastName}".trim(), style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Serif)
                                guest.phone?.takeIf { it.isNotBlank() }?.let { Text(it) }
                                guest.email?.takeIf { it.isNotBlank() && !it.endsWith("@resortpro.local", ignoreCase = true) }?.let { Text(it) }
                            }
                        }
                    }
                    item { Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(stringResource(R.string.guest_recent_bookings), style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif)
                        Text(stringResource(R.string.guest_booking_limit), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } }
                    if (guest.bookings.isEmpty()) item { GuestMessage(stringResource(R.string.guest_no_bookings)) }
                    else items(guest.bookings, key = GuestBookingDto::id) { booking -> GuestBookingCard(booking) { onBooking(booking.id) } }
                    item { Text(stringResource(R.string.guest_documents_hidden), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
            item { Spacer(Modifier.height(20.dp)) }
        }
    }
}

@Composable
private fun GuestBookingCard(booking: GuestBookingDto, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(booking.room?.let { stringResource(R.string.guest_room, it.number, it.name) } ?: stringResource(R.string.guest_room_unknown), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.guest_dates, booking.checkIn.take(10), booking.checkOut.take(10)))
            Text(stringResource(R.string.guest_confirmation, booking.confirmationNo), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(guestBookingStatus(booking.status), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.booking_view_details), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
internal fun guestBookingStatus(status: String): String = when (status) {
    "PENDING" -> stringResource(R.string.guest_status_pending)
    "CONFIRMED" -> stringResource(R.string.guest_status_confirmed)
    "CHECKED_IN" -> stringResource(R.string.guest_status_checked_in)
    "CHECKED_OUT" -> stringResource(R.string.guest_status_checked_out)
    "CANCELLED" -> stringResource(R.string.guest_status_cancelled)
    "NO_SHOW" -> stringResource(R.string.guest_status_no_show)
    "CONFLICT" -> stringResource(R.string.guest_status_conflict)
    else -> status.lowercase().replace('_', ' ').replaceFirstChar { it.titlecase() }
}

@Composable
private fun GuestMessage(message: String, retry: (() -> Unit)? = null) {
    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) {
        Text(message)
        retry?.let { TextButton(onClick = it) { Text(stringResource(R.string.action_try_again)) } }
    } }
}
