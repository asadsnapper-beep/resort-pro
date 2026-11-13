package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import android.app.DatePickerDialog
import androidx.compose.ui.platform.LocalContext
import java.util.Calendar
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    onOpenRoom: (String, String?, String?) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val roomError = state.errorMessage
    val availabilityError = state.availabilityError
    val availableRooms = state.availableRooms
    var statusFilter by rememberSaveable { mutableStateOf("ALL") }
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
                Text(text = "Rooms & availability", fontFamily = FontFamily.Serif, fontSize = 30.sp)
                Text(
                    text = "Find the right room, faster.",
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

            if (state.rooms.isNotEmpty()) item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    RoomSummary("Available", state.rooms.count { it.status == "AVAILABLE" }, Modifier.weight(1f))
                    RoomSummary("Occupied", state.rooms.count { it.status == "OCCUPIED" }, Modifier.weight(1f))
                    RoomSummary("Cleaning", state.rooms.count { it.status == "CLEANING" }, Modifier.weight(1f))
                }
                if (state.truncated) Text("Counts reflect the first ${state.rooms.size} rooms.", style = MaterialTheme.typography.bodySmall)
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
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("ALL", "AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "RESERVED").forEach { status ->
                            FilterChip(selected = statusFilter == status, onClick = { statusFilter = status }, label = { Text(status.toDisplayLabel()) })
                        }
                    }
                }
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
                        val visibleRooms = state.rooms.filter { statusFilter == "ALL" || it.status == statusFilter }
                        if (visibleRooms.isEmpty()) item { RoomsMessageCard("No matching rooms", "Choose another status filter.") }
                        items(visibleRooms, key = RoomDto::id) { room -> RoomCard(room) { onOpenRoom(room.id, null, null) } }
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
                            items(availableRooms, key = RoomDto::id) { room -> RoomCard(room) { onOpenRoom(room.id, state.checkIn, state.checkOut) } }
                        }
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun RoomSummary(label: String, count: Int, modifier: Modifier) {
    Column(modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(18.dp)).padding(12.dp)) {
        Text(count.toString(), fontWeight = FontWeight.Bold, fontSize = 23.sp)
        Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
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
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Check availability", style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif)
            Text(
                "Dates use YYYY-MM-DD. Booking conflicts are checked live by ResortPro.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            DateChoice("Check-in", checkIn, checkInError, !isLoading, onCheckInChange)
            DateChoice("Check-out", checkOut, checkOutError, !isLoading, onCheckOutChange)
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
private fun DateChoice(label: String, value: String, error: String?, enabled: Boolean, onChange: (String) -> Unit) {
    val context = LocalContext.current
    val parts = value.split("-").mapNotNull(String::toIntOrNull)
    val now = Calendar.getInstance()
    val year = parts.getOrNull(0) ?: now.get(Calendar.YEAR)
    val month = (parts.getOrNull(1) ?: (now.get(Calendar.MONTH) + 1)) - 1
    val day = parts.getOrNull(2) ?: now.get(Calendar.DAY_OF_MONTH)
    androidx.compose.material3.OutlinedButton(
        modifier = Modifier.fillMaxWidth(),
        enabled = enabled,
        onClick = {
            DatePickerDialog(context, { _, selectedYear, selectedMonth, selectedDay ->
                onChange(String.format(Locale.ROOT, "%04d-%02d-%02d", selectedYear, selectedMonth + 1, selectedDay))
            }, year, month, day).show()
        },
    ) { Text("$label  ·  $value", modifier = Modifier.padding(vertical = 8.dp)) }
    if (error != null) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun RoomCard(room: RoomDto, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
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
                Text("Current: ${room.status.toDisplayLabel()}", color = statusColor(room.status), fontWeight = FontWeight.SemiBold)
            }
            Text("${room.type.toDisplayLabel()} · Up to ${room.maxOccupancy} guests${room.floor?.let { " · Floor $it" } ?: ""}")
            Text("${formatRoomPrice(room.basePrice)} / night", style = MaterialTheme.typography.titleMedium)
            Text("View room details →", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
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
