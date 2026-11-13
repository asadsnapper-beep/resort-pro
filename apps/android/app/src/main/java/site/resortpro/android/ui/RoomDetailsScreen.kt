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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.DateFormat
import java.text.NumberFormat
import java.util.Date
import java.util.Locale
import site.resortpro.android.R
import site.resortpro.android.feature.rooms.RoomDetailsState
import site.resortpro.android.feature.rooms.RoomDetailsViewModel

@Composable
fun RoomDetailsScreen(viewModel: RoomDetailsViewModel, onBack: () -> Unit, onWalkIn: (() -> Unit)?) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    RoomDetailsContent(state, onBack, viewModel::refresh, onWalkIn)
}

@Composable
internal fun RoomDetailsContent(state: RoomDetailsState, onBack: () -> Unit, onRefresh: () -> Unit, onWalkIn: (() -> Unit)?) {
    Scaffold(modifier = Modifier.statusBarsPadding()) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).testTag("roomDetailsList"), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }
                    TextButton(onClick = onRefresh, enabled = !state.isLoading && !state.availabilityLoading) { Text(stringResource(R.string.hk_refresh)) }
                }
                Text(stringResource(R.string.room_details_title), style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Serif)
            }
            when {
                state.isLoading -> item { CircularProgressIndicator() }
                state.error != null -> item {
                    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) {
                        Text(state.error, color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = onRefresh) { Text(stringResource(R.string.action_try_again)) }
                    } }
                }
                state.room != null -> {
                    val room = state.room
                    item { RoomImage(room.images.firstOrNull()) }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(stringResource(R.string.room_number, room.number), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Text(room.name, style = MaterialTheme.typography.headlineLarge, fontFamily = FontFamily.Serif)
                            Text(room.type.roomDisplayLabel(), color = MaterialTheme.colorScheme.onSurfaceVariant)
                            state.syncedAt?.let {
                                val time = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(it))
                                Text(stringResource(if (state.fromCache) R.string.room_cached else R.string.room_updated, time), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    item {
                        Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(stringResource(R.string.room_current_status), style = MaterialTheme.typography.labelLarge)
                                Text(roomStatusLabel(room.status), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                                Text(buildList {
                                    add(stringResource(R.string.room_guest_capacity, room.maxOccupancy))
                                    room.floor?.let { add(stringResource(R.string.room_floor, it)) }
                                }.joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                    item { RoomAvailabilityCard(state) }
                    item {
                        Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(stringResource(R.string.room_base_rate), style = MaterialTheme.typography.labelLarge)
                                val price = NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD")).apply { maximumFractionDigits = 0 }.format(room.basePrice)
                                Text("৳$price", style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Serif)
                                Text(stringResource(R.string.room_base_rate_note), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    if (!room.description.isNullOrBlank()) item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(stringResource(R.string.room_about), style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif)
                            Text(room.description, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(stringResource(R.string.room_amenities), style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif)
                            if (room.amenities.isEmpty()) Text(stringResource(R.string.room_no_amenities), color = MaterialTheme.colorScheme.onSurfaceVariant)
                            else room.amenities.forEach { Text("•  $it") }
                        }
                    }
                    if (onWalkIn != null) item {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Button(onClick = onWalkIn, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text(stringResource(R.string.room_walkin)) }
                            Text(stringResource(R.string.room_walkin_note), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun RoomAvailabilityCard(state: RoomDetailsState) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (state.checkIn != null && state.checkOut != null) {
                Text(stringResource(R.string.room_selected_dates, state.checkIn, state.checkOut), style = MaterialTheme.typography.labelLarge)
                when {
                    state.availabilityLoading -> Text(stringResource(R.string.room_availability_loading))
                    state.availabilityError != null -> Text(stringResource(R.string.room_availability_error), color = MaterialTheme.colorScheme.error)
                    state.available == true -> Text(stringResource(R.string.room_available), fontWeight = FontWeight.SemiBold)
                    state.available == false -> Text(stringResource(R.string.room_unavailable), fontWeight = FontWeight.SemiBold)
                }
                Text(stringResource(R.string.room_availability_note), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Text(stringResource(R.string.room_no_dates), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

private fun String.roomDisplayLabel(): String = lowercase().replace('_', ' ').replaceFirstChar { it.titlecase() }

@Composable
private fun roomStatusLabel(status: String): String = when (status) {
    "AVAILABLE" -> stringResource(R.string.room_status_available)
    "OCCUPIED" -> stringResource(R.string.room_status_occupied)
    "CLEANING" -> stringResource(R.string.room_status_cleaning)
    "MAINTENANCE" -> stringResource(R.string.room_status_maintenance)
    "RESERVED" -> stringResource(R.string.room_status_reserved)
    else -> status.roomDisplayLabel()
}
