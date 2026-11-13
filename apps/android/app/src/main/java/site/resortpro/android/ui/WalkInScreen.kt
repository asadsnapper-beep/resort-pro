package site.resortpro.android.ui

import android.app.DatePickerDialog
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import java.io.File
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.walkin.WalkInUiState
import site.resortpro.android.feature.walkin.WalkInViewModel

@Composable
fun WalkInScreen(viewModel: WalkInViewModel, session: AuthenticatedSession, onBack: () -> Unit, onLogout: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var step by rememberSaveable { mutableIntStateOf(0) }
    val context = LocalContext.current
    var pendingPath by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingDocument by rememberSaveable { mutableStateOf(false) }
    var cameraError by remember { mutableStateOf<String?>(null) }
    var confirmDiscard by remember { mutableStateOf(false) }
    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text("Remove saved photos?") },
            text = { Text("This removes all pending photos for your account from this device. Check guest documents first if an upload was not confirmed. Server documents are not deleted.") },
            confirmButton = { TextButton(onClick = { confirmDiscard = false; viewModel.discardPendingImages() }) { Text("Remove photos") } },
            dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text("Cancel") } },
        )
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val path = pendingPath
        if (success && path != null && File(path).length() > 0L) {
            if (File(path).length() > 5L * 1024 * 1024) {
                File(path).delete()
                cameraError = "Photo is too large. Please take a smaller image (maximum 5 MB)."
            } else {
                viewModel.setPhoto(path, pendingDocument)
                cameraError = null
            }
        } else {
            path?.let { File(it).delete() }
        }
        pendingPath = null
    }
    fun takePhoto(document: Boolean) {
        runCatching {
            val dir = File(context.cacheDir, "walkin-captures").apply { mkdirs() }
            val file = File.createTempFile("capture-", ".jpg", dir)
            pendingDocument = document
            pendingPath = file.absolutePath
            camera.launch(FileProvider.getUriForFile(context, "${context.packageName}.capture", file))
        }.onFailure { error ->
            android.util.Log.e("WalkInCamera", "Could not launch the camera", error)
            pendingPath?.let { path -> File(path).delete() }
            pendingPath = null
            cameraError = "Could not open the camera. Please check that a camera app is available."
        }
    }
    fun back() { if (step > 0) step-- else onBack() }
    BackHandler(enabled = state.uploadingImages) { }
    BackHandler(enabled = step > 0 && !state.isSubmitting && !state.uploadingImages && state.createdBooking == null) { back() }

    if (state.createdBooking != null) {
        BackHandler(enabled = state.uploadingImages) { }
        SuccessScreen(state, onAnother = { step = 0; viewModel.startAnother() }, onDone = onBack, onRetry = viewModel::retryPendingImages)
        return
    }

    Scaffold(modifier = Modifier.statusBarsPadding()) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { back() }, enabled = !state.isSubmitting && !state.uploadingImages) { Text("‹  Back") }
                    TextButton(onClick = onLogout, enabled = !state.isSubmitting && !state.uploadingImages) { Text("Sign out") }
                }
                Text("New walk-in", fontFamily = FontFamily.Serif, fontSize = 32.sp, color = MaterialTheme.colorScheme.onBackground)
                Text(session.tenant?.name ?: "ResortPro", color = MaterialTheme.colorScheme.onSurfaceVariant)
                StepIndicator(step)
            }
            state.errorMessage?.let { message -> item { MessageCard("Please check", message, true) } }
            state.pendingImageError?.let { message -> item { MessageCard("Saved photos", message, true) } }
            if (state.pendingImageCount > 0) item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("${state.pendingImageCount} photo(s) waiting to upload", fontWeight = FontWeight.Bold)
                        Text("Encrypted on this device for your account. Retry when connected.")
                        state.imageUploadMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        TextButton(onClick = viewModel::retryPendingImages, enabled = !state.uploadingImages) { Text(if (state.uploadingImages) "Uploading…" else "Retry uploads") }
                        TextButton(onClick = { confirmDiscard = true }, enabled = !state.uploadingImages) { Text("Remove saved photos") }
                    }
                }
            }
            state.conflictMessage?.let { message -> item {
                MessageCard("Room conflict", message, true)
                TextButton(onClick = { step = 1; viewModel.checkAvailability() }) { Text("Refresh available rooms") }
            } }

            when (step) {
                0 -> {
                    item {
                        Text("Let’s plan their stay", fontFamily = FontFamily.Serif, fontSize = 25.sp)
                        Text("Choose the dates and number of guests.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    item {
                        Section("Stay dates") {
                            WalkInDate("Check-in", state.checkIn, state.validation.checkInError, viewModel::updateCheckIn)
                            WalkInDate("Check-out", state.checkOut, state.validation.checkOutError, viewModel::updateCheckOut)
                            Text("${state.nights} night${if (state.nights == 1) "" else "s"}", color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    item {
                        Section("Guests") {
                            GuestCounter("Adults", state.adults, { viewModel.incrementAdults(-1) }, { viewModel.incrementAdults(1) })
                            GuestCounter("Children", state.children, { viewModel.incrementChildren(-1) }, { viewModel.incrementChildren(1) })
                        }
                    }
                    item {
                        Text("Availability and rates are checked live.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Button(onClick = { if (viewModel.validateStay()) { step = 1; viewModel.checkAvailability() } }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(54.dp), shape = RoundedCornerShape(16.dp)) { Text("Find available rooms  →") }
                    }
                }
                1 -> {
                    item { Text("Choose a room", fontFamily = FontFamily.Serif, fontSize = 26.sp); Text("${state.checkIn} → ${state.checkOut} · ${state.adults + state.children} guests", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    if (state.isLoadingRooms) item { CircularProgressIndicator(); Text("Checking availability…") }
                    else if (state.hasAvailabilityResult && state.availableRooms.isEmpty()) item { MessageCard("No available rooms", "Go back and choose another date range.") }
                    else items(state.availableRooms, key = { it.id }) { room ->
                        Card(Modifier.fillMaxWidth().clickable { viewModel.selectRoom(room.id) }, shape = RoundedCornerShape(18.dp)) {
                            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text("Room ${room.number} · ${room.name}", fontWeight = FontWeight.Bold)
                                    Text("Up to ${room.maxOccupancy} guests · ${money(room.basePrice)} / night", style = MaterialTheme.typography.bodySmall)
                                }
                                Text(if (room.id == state.selectedRoomId) "Selected" else "Select", color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                    item {
                        state.validation.occupancyError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        state.validation.roomError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        if (!state.isLoadingRooms && !state.hasAvailabilityResult) TextButton(onClick = viewModel::checkAvailability) { Text("Retry availability") }
                        if (state.isLoadingQuote) Text("Loading server price…")
                        state.estimatedTotal?.let { Text("Estimated stay total: ${money(it)}", fontWeight = FontWeight.Bold) }
                        if (!state.isLoadingQuote && state.selectedRoomId != null && state.quote == null) TextButton(onClick = { viewModel.selectRoom(state.selectedRoomId!!) }) { Text("Retry price quote") }
                        Button(onClick = { if (viewModel.validateRoom()) step = 2 }, enabled = !state.isLoadingRooms && !state.isLoadingQuote, modifier = Modifier.fillMaxWidth().padding(top = 10.dp).height(54.dp), shape = RoundedCornerShape(16.dp)) { Text("Continue to guest  →") }
                    }
                }
                2 -> {
                    item { Text("Tell us about the guest", fontFamily = FontFamily.Serif, fontSize = 25.sp) }
                    item {
                        Section("Guest details") {
                            OutlinedTextField(state.guestName, viewModel::updateGuestName, modifier = Modifier.fillMaxWidth(), label = { Text("Full name") }, singleLine = true, isError = state.validation.guestNameError != null, supportingText = state.validation.guestNameError?.let { { Text(it) } })
                            OutlinedTextField(state.guestPhone, viewModel::updateGuestPhone, modifier = Modifier.fillMaxWidth(), label = { Text("Phone (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                            OutlinedTextField(state.roomNotes, viewModel::updateNotes, modifier = Modifier.fillMaxWidth(), label = { Text("Room notes (optional)") }, minLines = 2)
                        }
                    }
                    item {
                        Section("Guest and ID photos · optional") {
                            Text("Photos are uploaded after check-in. Until the booking is confirmed, they are temporary and may be lost if the app closes.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            PhotoCaptureRow("Guest photo", state.guestPhotoPath, { takePhoto(false) }, { viewModel.removePhoto(false) })
                            Text("ID type", fontWeight = FontWeight.SemiBold)
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf("NATIONAL_ID" to "National ID", "PASSPORT" to "Passport", "DRIVERS_LICENSE" to "Driving licence", "OTHER" to "Other").forEach { (type, label) ->
                                    FilterChip(selected = state.documentType == type, onClick = { viewModel.selectDocumentType(type) }, label = { Text(label) })
                                }
                            }
                            PhotoCaptureRow("ID document", state.documentPhotoPath, { takePhoto(true) }, { viewModel.removePhoto(true) })
                            cameraError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                    item { Button(onClick = { if (viewModel.validateGuest()) step = 3 }, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp)) { Text("Review stay  →") } }
                }
                else -> {
                    item { Text("Review & check in", fontFamily = FontFamily.Serif, fontSize = 26.sp); Text("Please confirm the details before checking in.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    item {
                        Section("Stay summary") {
                            SummaryRow("Guest", state.guestName)
                            SummaryRow("Room", state.selectedRoom?.let { "${it.number} · ${it.name}" } ?: "Select a room")
                            SummaryRow("Dates", "${state.checkIn} → ${state.checkOut}")
                            SummaryRow("Guests", "${state.adults} adults · ${state.children} children")
                            SummaryRow("Photos", listOfNotNull(if (state.guestPhotoPath != null) "Guest" else null, if (state.documentPhotoPath != null) "ID" else null).joinToString(" + ").ifEmpty { "None" })
                            SummaryRow("Estimated total", state.estimatedTotal?.let(::money) ?: "Price unavailable")
                        }
                    }
                    item {
                        Section("Payment") {
                            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf("CASH", "CARD", "BANK_TRANSFER", "LATER").forEach { method ->
                                    FilterChip(selected = state.paymentMethod == method, onClick = { viewModel.selectPaymentMethod(method) }, enabled = !state.isSubmitting, label = { Text(method.lowercase().replace('_', ' ').replaceFirstChar { it.titlecase() }) })
                                }
                            }
                            if (state.paymentMethod != "LATER") OutlinedTextField(state.advanceAmount, viewModel::updateAdvance, modifier = Modifier.fillMaxWidth(), label = { Text("Advance received (optional)") }, enabled = !state.isSubmitting, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), isError = state.validation.advanceError != null, supportingText = state.validation.advanceError?.let { { Text(it) } })
                        }
                    }
                    item { WalkInSubmissionControls(state.quote != null && !state.uploadingImages, state.isSubmitting, state.submissionUncertain, viewModel::submit, viewModel::acknowledgeUncertainSubmission) }
                }
            }
        }
    }
}

@Composable
private fun PhotoCaptureRow(label: String, path: String?, onCapture: () -> Unit, onRemove: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontWeight = FontWeight.SemiBold)
        if (path != null) {
            val image = remember(path) {
                runCatching {
                    BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = 8 })?.asImageBitmap()
                }.getOrNull()
            }
            if (image != null) Image(image, contentDescription = "$label preview", modifier = Modifier.fillMaxWidth().height(140.dp), contentScale = ContentScale.Fit)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onCapture) { Text("Retake") }
                TextButton(onClick = onRemove) { Text("Remove") }
            }
        } else OutlinedButton(onClick = onCapture, modifier = Modifier.fillMaxWidth()) { Text("Take $label") }
    }
}

@Composable
private fun StepIndicator(step: Int) {
    Row(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf("Stay", "Room", "Guest", "Review").forEachIndexed { index, label ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(32.dp).background(if (index == step) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                    Text("${index + 1}", color = if (index == step) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(label, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontFamily = FontFamily.Serif)
            content()
        }
    }
}

@Composable
private fun WalkInDate(label: String, value: String, error: String?, onChange: (String) -> Unit) {
    val context = LocalContext.current
    val parts = value.split("-").mapNotNull(String::toIntOrNull)
    val now = Calendar.getInstance()
    OutlinedButton(onClick = {
        DatePickerDialog(context, { _, year, month, day -> onChange(String.format(Locale.ROOT, "%04d-%02d-%02d", year, month + 1, day)) }, parts.getOrNull(0) ?: now.get(Calendar.YEAR), (parts.getOrNull(1) ?: now.get(Calendar.MONTH) + 1) - 1, parts.getOrNull(2) ?: now.get(Calendar.DAY_OF_MONTH)).show()
    }, modifier = Modifier.fillMaxWidth()) { Text("$label  ·  $value", modifier = Modifier.padding(vertical = 7.dp)) }
    error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
}

@Composable
private fun GuestCounter(label: String, count: Int, minus: () -> Unit, plus: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontWeight = FontWeight.SemiBold)
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = minus) { Text("−", fontSize = 22.sp) }
            Text("$count", fontWeight = FontWeight.Bold)
            TextButton(onClick = plus) { Text("+", fontSize = 22.sp) }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(12.dp))
        Text(value, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun WalkInSubmissionControls(canSubmit: Boolean, isSubmitting: Boolean, submissionUncertain: Boolean, onSubmit: () -> Unit, onAcknowledgeUncertain: () -> Unit) {
    if (submissionUncertain) TextButton(onClick = onAcknowledgeUncertain, modifier = Modifier.testTag("walkInAcknowledgeUncertain")) { Text("I checked Front Desk — allow retry") }
    Button(onClick = onSubmit, modifier = Modifier.fillMaxWidth().height(54.dp).testTag("walkInSubmit"), enabled = canSubmit && !isSubmitting && !submissionUncertain, shape = RoundedCornerShape(16.dp)) {
        if (isSubmitting) CircularProgressIndicator(Modifier.height(22.dp), strokeWidth = 2.dp) else Text("Check in guest")
    }
    Text("Availability is confirmed by the server. Check Front Desk if confirmation is interrupted.", modifier = Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun MessageCard(title: String, message: String, error: Boolean = false) {
    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text(title, fontWeight = FontWeight.Bold, color = if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface); Text(message) } }
}

@Composable
private fun SuccessScreen(state: WalkInUiState, onAnother: () -> Unit, onDone: () -> Unit, onRetry: () -> Unit) {
    val booking = state.createdBooking ?: return
    Column(Modifier.fillMaxSize().statusBarsPadding().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Guest checked in", fontFamily = FontFamily.Serif, fontSize = 30.sp)
        Text(booking.confirmationNo, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
        Text("Room ${booking.room?.number ?: "—"} · ${money(booking.totalAmount)}")
        if (state.uploadingImages) {
            CircularProgressIndicator(Modifier.padding(top = 12.dp))
            Text("Uploading guest photos…")
        }
        state.imageUploadMessage?.let { Text(it, modifier = Modifier.padding(top = 12.dp), style = MaterialTheme.typography.bodySmall) }
        state.pendingImageError?.let { Text(it, modifier = Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error) }
        if (state.pendingImageCount > 0) {
            Text("${state.pendingImageCount} photo(s) saved securely for retry.")
            TextButton(onClick = onRetry, enabled = !state.uploadingImages) { Text("Retry uploads") }
        }
        Button(onClick = onAnother, enabled = !state.uploadingImages, modifier = Modifier.fillMaxWidth().padding(top = 24.dp).height(52.dp)) { Text("Create another walk-in") }
        TextButton(onClick = onDone, enabled = !state.uploadingImages) { Text("Back to dashboard") }
    }
}

private fun money(value: Double): String = "৳${NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD")).apply { maximumFractionDigits = 0 }.format(value)}"
