package site.resortpro.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.NumberFormat
import java.util.Locale
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.walkin.WalkInUiState
import site.resortpro.android.feature.walkin.WalkInViewModel

@Composable
fun WalkInScreen(
    viewModel: WalkInViewModel,
    session: AuthenticatedSession,
    onBack: () -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.prepare() }

    if (state.createdBooking != null) {
        WalkInSuccessScreen(state, viewModel::startAnother, onBack)
        return
    }

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
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onBack, enabled = !state.isSubmitting) { Text("Back") }
                    TextButton(onClick = onLogout, enabled = !state.isSubmitting) { Text("Sign out") }
                }
                Text("New walk-in", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    "Creates the booking and checks the guest in immediately.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            state.errorMessage?.let { message ->
                item { WalkInMessageCard("Could not confirm booking", message, isError = true) }
            }
            state.conflictMessage?.let { message ->
                item {
                    WalkInMessageCard("Room conflict", message, isError = true)
                    TextButton(onClick = viewModel::checkAvailability) { Text("Refresh available rooms") }
                }
            }

            item {
                WalkInSection(title = "Stay dates") {
                    OutlinedTextField(
                        value = state.checkIn,
                        onValueChange = viewModel::updateCheckIn,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Check-in") },
                        supportingText = state.validation.checkInError?.let { { Text(it) } },
                        isError = state.validation.checkInError != null,
                        enabled = !state.isSubmitting,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
                    )
                    OutlinedTextField(
                        value = state.checkOut,
                        onValueChange = viewModel::updateCheckOut,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Check-out") },
                        supportingText = state.validation.checkOutError?.let { { Text(it) } },
                        isError = state.validation.checkOutError != null,
                        enabled = !state.isSubmitting,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
                    )
                    Button(
                        onClick = viewModel::checkAvailability,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        enabled = !state.isLoadingRooms && !state.isSubmitting,
                    ) {
                        if (state.isLoadingRooms) {
                            CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Check available rooms")
                        }
                    }
                }
            }

            if (!state.isLoadingRooms && state.hasAvailabilityResult && state.availableRooms.isEmpty()) {
                item { WalkInMessageCard("No available rooms", "Choose another valid date range and check again.") }
            } else if (state.availableRooms.isNotEmpty()) {
                item {
                    Text(
                        "Select a room",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                items(state.availableRooms, key = RoomDto::id) { room ->
                    WalkInRoomCard(
                        room = room,
                        selected = room.id == state.selectedRoomId,
                        enabled = !state.isSubmitting,
                        onClick = { viewModel.selectRoom(room.id) },
                    )
                }
            }

            item {
                WalkInSection(title = "Guest") {
                    OutlinedTextField(
                        value = state.guestName,
                        onValueChange = viewModel::updateGuestName,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Full name") },
                        supportingText = state.validation.guestNameError?.let { { Text(it) } },
                        isError = state.validation.guestNameError != null,
                        enabled = !state.isSubmitting,
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = state.guestPhone,
                        onValueChange = viewModel::updateGuestPhone,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Phone (optional)") },
                        enabled = !state.isSubmitting,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    )
                    GuestCounter(
                        label = "Adults",
                        value = state.adults,
                        enabled = !state.isSubmitting,
                        onMinus = { viewModel.incrementAdults(-1) },
                        onPlus = { viewModel.incrementAdults(1) },
                    )
                    GuestCounter(
                        label = "Children",
                        value = state.children,
                        enabled = !state.isSubmitting,
                        onMinus = { viewModel.incrementChildren(-1) },
                        onPlus = { viewModel.incrementChildren(1) },
                    )
                    state.validation.occupancyError?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    OutlinedTextField(
                        value = state.roomNotes,
                        onValueChange = viewModel::updateNotes,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Room notes (optional)") },
                        enabled = !state.isSubmitting,
                        minLines = 2,
                    )
                }
            }

            item {
                WalkInSection(title = "Payment") {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf("CASH", "CARD", "BANK_TRANSFER", "LATER").forEach { method ->
                            FilterChip(
                                selected = state.paymentMethod == method,
                                onClick = { viewModel.selectPaymentMethod(method) },
                                enabled = !state.isSubmitting,
                                label = { Text(paymentLabel(method)) },
                            )
                        }
                    }
                    if (state.paymentMethod != "LATER") {
                        OutlinedTextField(
                            value = state.advanceAmount,
                            onValueChange = viewModel::updateAdvance,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Advance received (optional)") },
                            supportingText = state.validation.advanceError?.let { { Text(it) } },
                            isError = state.validation.advanceError != null,
                            enabled = !state.isSubmitting,
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        )
                    }
                }
            }

            item { WalkInQuoteCard(state) }

            item {
                WalkInSubmissionControls(
                    canSubmit = state.quote != null,
                    isSubmitting = state.isSubmitting,
                    submissionUncertain = state.submissionUncertain,
                    onSubmit = viewModel::submit,
                    onAcknowledgeUncertain = viewModel::acknowledgeUncertainSubmission,
                )
            }
            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
fun WalkInSubmissionControls(
    canSubmit: Boolean,
    isSubmitting: Boolean,
    submissionUncertain: Boolean,
    onSubmit: () -> Unit,
    onAcknowledgeUncertain: () -> Unit,
) {
    if (submissionUncertain) {
        TextButton(onClick = onAcknowledgeUncertain) {
            Text("I checked Front Desk — allow retry")
        }
    }
    Button(
        onClick = onSubmit,
        modifier = Modifier.fillMaxWidth().height(54.dp),
        enabled = canSubmit && !isSubmitting && !submissionUncertain,
    ) {
        if (isSubmitting) CircularProgressIndicator(Modifier.height(22.dp), strokeWidth = 2.dp)
        else Text("Check in guest")
    }
    Text(
        "Submission is never retried automatically. ResortPro rechecks room conflicts before creating the booking.",
        modifier = Modifier.padding(top = 8.dp),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun WalkInSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
private fun WalkInRoomCard(room: RoomDto, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Room ${room.number} · ${room.name}", fontWeight = FontWeight.Bold)
                Text(
                    "${room.type.displayWalkInLabel()} · Max ${room.maxOccupancy} guests",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(formatWalkInMoney(room.basePrice), fontWeight = FontWeight.SemiBold)
                Text(if (selected) "Selected" else "Select", color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun GuestCounter(
    label: String,
    value: Int,
    enabled: Boolean,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label)
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onMinus, enabled = enabled) { Text("−") }
            Text(value.toString(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            TextButton(onClick = onPlus, enabled = enabled) { Text("+") }
        }
    }
}

@Composable
private fun WalkInQuoteCard(state: WalkInUiState) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Server price quote", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            when {
                state.isLoadingQuote -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                        Text("Resolving rates…")
                    }
                }
                state.quote == null -> Text(
                    "Select an available room to load the final rate estimate.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> {
                    val quote = state.quote
                    Text("${state.nights} night${if (state.nights == 1) "" else "s"}")
                    quote.resolved?.planName?.let { Text("Rate plan: $it") }
                    Text(
                        formatWalkInMoney(state.estimatedTotal ?: 0.0),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun WalkInSuccessScreen(state: WalkInUiState, onAnother: () -> Unit, onDone: () -> Unit) {
    val booking = state.createdBooking ?: return
    Scaffold(modifier = Modifier.statusBarsPadding()) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Guest checked in", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text(
                booking.confirmationNo,
                modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                "Room ${booking.room?.number ?: "—"} · ${formatWalkInMoney(booking.totalAmount)}",
                modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onAnother, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                Text("Create another walk-in")
            }
            TextButton(onClick = onDone) { Text("Back to dashboard") }
        }
    }
}

@Composable
private fun WalkInMessageCard(title: String, message: String, isError: Boolean = false) {
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

private fun paymentLabel(method: String): String = when (method) {
    "BANK_TRANSFER" -> "Bank transfer"
    "LATER" -> "Pay later"
    else -> method.lowercase().replaceFirstChar { it.titlecase() }
}

private fun String.displayWalkInLabel(): String = lowercase()
    .replace('_', ' ')
    .replaceFirstChar { it.titlecase() }

private fun formatWalkInMoney(value: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD"))
    formatter.maximumFractionDigits = 0
    return "৳${formatter.format(value)}"
}
