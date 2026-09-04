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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.NumberFormat
import java.util.Locale
import java.text.DateFormat
import java.util.Date
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.rooms.RoomsMode
import site.resortpro.android.feature.rooms.RoomsViewModel

@Composable
fun RoomsScreen(
    viewModel: RoomsViewModel,
    session: AuthenticatedSession,
    onBack: () -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val roomError = state.errorMessage
    val availabilityError = state.availabilityError
    val availableRooms = state.availableRooms
    val tenantId = session.user.tenantId ?: session.tenant?.id ?: return
    LaunchedEffect(tenantId) { viewModel.loadRooms(tenantId) }

    Scaffold(modifier = Modifier.statusBarsPadding()) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onBack) { Text("Back") }
                    TextButton(onClick = onLogout) { Text("Sign out") }
                }
                Text(
                    text = "Rooms & availability",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = session.tenant?.name ?: "ResortPro",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                state.syncedAt?.let { syncedAt ->
                    Text(
                        text = if (state.fromCache) {
                            "Offline · Last synced ${formatSyncTime(syncedAt)}"
                        } else {
                            "Updated ${formatSyncTime(syncedAt)}"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    FilterChip(
                        selected = state.mode == RoomsMode.ALL,
                        onClick = { viewModel.selectMode(RoomsMode.ALL) },
                        label = { Text("All rooms") },
                    )
                    FilterChip(
                        selected = state.mode == RoomsMode.AVAILABILITY,
                        onClick = { viewModel.selectMode(RoomsMode.AVAILABILITY) },
                        label = { Text("Availability") },
                    )
                }
            }

            if (state.mode == RoomsMode.ALL) {
                when {
                    state.isLoading -> item { RoomsLoadingCard("Loading rooms…") }
                    roomError != null -> item {
                        RoomsErrorCard(roomError)
                        TextButton(onClick = { viewModel.loadRooms(tenantId, force = true) }) { Text("Try again") }
                    }
                    state.rooms.isEmpty() -> item {
                        RoomsMessageCard("No rooms", "No active rooms were returned for this resort.")
                    }
                    else -> {
                        item {
                            Text(
                                "${state.rooms.size} active rooms",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        if (state.truncated) {
                            item {
                                RoomsMessageCard(
                                    "Showing the first ${state.rooms.size}",
                                    "Use availability search to query the complete live inventory.",
                                )
                            }
                        }
                        items(state.rooms, key = RoomDto::id) { room -> RoomCard(room) }
                    }
                }
            } else {
                item {
                    AvailabilityForm(
                        checkIn = state.checkIn,
                        checkOut = state.checkOut,
                        checkInError = state.validation.checkInError,
                        checkOutError = state.validation.checkOutError,
                        isLoading = state.isAvailabilityLoading,
                        onCheckInChange = viewModel::updateCheckIn,
                        onCheckOutChange = viewModel::updateCheckOut,
                        onSubmit = viewModel::checkAvailability,
                    )
                }
                when {
                    availabilityError != null -> item { RoomsErrorCard(availabilityError) }
                    availableRooms != null -> {
                        item {
                            Text(
                                "${availableRooms.size} rooms available",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        if (availableRooms.isEmpty()) {
                            item {
                                RoomsMessageCard(
                                    "No availability",
                                    "Try another date range. Availability is confirmed by the server.",
                                )
                            }
                        } else {
                            items(availableRooms, key = RoomDto::id) { room -> RoomCard(room) }
                        }
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

private fun formatSyncTime(timestamp: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(timestamp))

@Composable
private fun AvailabilityForm(
    checkIn: String,
    checkOut: String,
    checkInError: String?,
    checkOutError: String?,
    isLoading: Boolean,
    onCheckInChange: (String) -> Unit,
    onCheckOutChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Check a stay", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(
                "Dates use YYYY-MM-DD. Booking conflicts are checked live by ResortPro.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = checkIn,
                onValueChange = onCheckInChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Check-in") },
                supportingText = checkInError?.let { { Text(it) } },
                isError = checkInError != null,
                enabled = !isLoading,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            )
            OutlinedTextField(
                value = checkOut,
                onValueChange = onCheckOutChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Check-out") },
                supportingText = checkOutError?.let { { Text(it) } },
                isError = checkOutError != null,
                enabled = !isLoading,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            )
            Button(
                onClick = onSubmit,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                enabled = !isLoading,
            ) {
                if (isLoading) CircularProgressIndicator(modifier = Modifier.height(22.dp), strokeWidth = 2.dp)
                else Text("Check availability")
            }
        }
    }
}

@Composable
private fun RoomCard(room: RoomDto) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Room ${room.number}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(room.name, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(room.status.toDisplayLabel(), color = statusColor(room.status), fontWeight = FontWeight.SemiBold)
            }
            Text("${room.type.toDisplayLabel()} · Up to ${room.maxOccupancy} guests${room.floor?.let { " · Floor $it" } ?: ""}")
            Text("${formatRoomPrice(room.basePrice)} / night", style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
private fun RoomsLoadingCard(message: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(modifier = Modifier.height(24.dp))
            Text(message)
        }
    }
}

@Composable
private fun RoomsErrorCard(message: String) {
    RoomsMessageCard("Something went wrong", message, isError = true)
}

@Composable
private fun RoomsMessageCard(title: String, message: String, isError: Boolean = false) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                title,
                fontWeight = FontWeight.SemiBold,
                color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            )
            Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun statusColor(status: String) = when (status) {
    "AVAILABLE" -> MaterialTheme.colorScheme.primary
    "MAINTENANCE" -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

private fun String.toDisplayLabel(): String = lowercase()
    .replace('_', ' ')
    .replaceFirstChar { it.titlecase() }

private fun formatRoomPrice(value: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD"))
    formatter.maximumFractionDigits = 0
    return "৳${formatter.format(value)}"
}
