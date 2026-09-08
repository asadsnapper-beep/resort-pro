package site.resortpro.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
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
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.core.content.FileProvider
import java.io.File
import java.text.NumberFormat
import java.util.Locale
import site.resortpro.android.core.media.DocumentImage
import site.resortpro.android.core.media.MAX_GUEST_DOCUMENTS
import site.resortpro.android.core.media.copyIntoDocumentCache
import site.resortpro.android.core.media.newDocumentCaptureFile
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.walkin.CapturedDocument
import site.resortpro.android.feature.walkin.GuestDocumentType
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
        WalkInSuccessScreen(state, viewModel::startAnother, viewModel::retryDocuments, onBack)
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
                    GuestDocumentCapture(
                        documents = state.documents,
                        documentType = state.documentType,
                        enabled = !state.isSubmitting,
                        onCaptured = viewModel::addDocument,
                        onRemove = viewModel::removeDocument,
                        onTypeChange = viewModel::setDocumentType,
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
private fun WalkInSuccessScreen(
    state: WalkInUiState,
    onAnother: () -> Unit,
    onRetryDocuments: () -> Unit,
    onDone: () -> Unit,
) {
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
            // Said here rather than swallowed: the check-in worked, but someone
            // has to know the ID is not on file, while the guest is still at
            // the desk holding it.
            state.documentNote?.let { note ->
                Text(
                    note,
                    modifier = Modifier.padding(bottom = 16.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    // Green once they are all up: the same line said a moment
                    // ago that they were not, so leaving it red would read as
                    // a fresh failure.
                    color = if (state.documents.isEmpty()) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.error
                    },
                )
            }
            // Only while there is something a retry could still send. The
            // photographs are on this phone and nowhere else, so this is the
            // last chance before the desk has to ask the guest again.
            if (state.documents.isNotEmpty()) {
                OutlinedButton(
                    onClick = onRetryDocuments,
                    enabled = !state.isUploadingDocuments,
                    modifier = Modifier.fillMaxWidth().height(50.dp).padding(bottom = 12.dp),
                ) {
                    if (state.isUploadingDocuments) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text(
                            if (state.documents.size == 1) {
                                "Retry the photo"
                            } else {
                                "Retry ${state.documents.size} photos"
                            },
                        )
                    }
                }
            }
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

/**
 * Photograph, or pick, the documents the guest just handed over.
 *
 * Two ways in, because both happen. The camera is for the paper on the counter
 * right now; the picker is for the photo the guest already has on their own
 * phone, or one taken a minute ago before the app was open.
 *
 * More than one, because one document is often several pictures: a passport
 * and the visa in it, an NID with two sides. Each keeps the type that was
 * selected when it was added, so a passport page and a visa page do not have
 * to be filed as the same thing.
 *
 * The system camera and the system photo picker do the work, so the app needs
 * neither a CAMERA nor a storage permission — the picker hands over only the
 * images the guest's own hand chose.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GuestDocumentCapture(
    documents: List<CapturedDocument>,
    documentType: String,
    enabled: Boolean,
    onCaptured: (String) -> Unit,
    onRemove: (String) -> Unit,
    onTypeChange: (String) -> Unit,
) {
    val context = LocalContext.current
    var pendingFile by rememberSaveable { mutableStateOf<String?>(null) }

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val path = pendingFile
        if (saved && path != null) {
            onCaptured(path)
        } else {
            // Cancelled, or the camera wrote nothing: leave no empty file
            // behind pretending to be a document.
            path?.let { File(it).delete() }
        }
        pendingFile = null
    }

    val pickImages = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_GUEST_DOCUMENTS),
    ) { uris ->
        // Copied into our own cache rather than held as a foreign content URI:
        // the permission granted over that URI is temporary, and everything
        // downstream already reads files.
        uris.forEach { uri ->
            context.copyIntoDocumentCache(uri)?.let { file -> onCaptured(file.absolutePath) }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Guest documents (optional)",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // Scrolls sideways rather than wrapping, matching Payment directly
        // below it. Five chips wrapped onto two ragged lines and read as a
        // different kind of control from the one under it.
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            GuestDocumentType.OFFERED.forEach { type ->
                FilterChip(
                    selected = type == documentType,
                    onClick = { onTypeChange(type) },
                    enabled = enabled,
                    label = { Text(documentTypeLabel(type)) },
                )
            }
        }

        if (documents.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                documents.forEach { document ->
                    CapturedDocumentThumbnail(
                        document = document,
                        enabled = enabled,
                        onRemove = { onRemove(document.path) },
                    )
                }
            }
        }

        val atLimit = documents.size >= MAX_GUEST_DOCUMENTS
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = {
                    val file = context.newDocumentCaptureFile()
                    pendingFile = file.absolutePath
                    takePicture.launch(
                        FileProvider.getUriForFile(context, "${context.packageName}.documents", file),
                    )
                },
                enabled = enabled && !atLimit,
                modifier = Modifier.weight(1f).height(56.dp),
            ) {
                Text("Camera")
            }
            OutlinedButton(
                onClick = {
                    pickImages.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                    )
                },
                enabled = enabled && !atLimit,
                modifier = Modifier.weight(1f).height(56.dp),
            ) {
                Text("Gallery")
            }
        }
        if (atLimit) {
            Text(
                "That is as many as one check-in needs. Remove one to add another.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** One photograph, with its type and a way to drop it. */
@Composable
private fun CapturedDocumentThumbnail(
    document: CapturedDocument,
    enabled: Boolean,
    onRemove: () -> Unit,
) {
    // Fixed to the width of the image so a row of these reads as a strip of
    // photographs rather than three loose columns of text.
    Column(
        modifier = Modifier.width(84.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        val thumbnail = remember(document.path) { decodeThumbnail(document.path) }
        if (thumbnail != null) {
            Image(
                bitmap = thumbnail,
                contentDescription = "Photographed ${documentTypeLabel(document.docType)}",
                modifier = Modifier.size(84.dp).clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop,
            )
        }
        Text(
            documentTypeLabel(document.docType),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
        )
        // A plain tappable label, not a TextButton: the button's own padding
        // made each photo twice as tall as the picture in it.
        Text(
            "Remove",
            modifier = Modifier
                .clickable(enabled = enabled) { onRemove() }
                .padding(vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

private fun documentTypeLabel(type: String): String = when (type) {
    GuestDocumentType.NATIONAL_ID -> "NID"
    GuestDocumentType.PASSPORT -> "Passport"
    GuestDocumentType.DRIVERS_LICENSE -> "Licence"
    GuestDocumentType.VISA -> "Visa"
    else -> "Other"
}

/** A small preview of the captured file, sampled down so it costs nothing. */
private fun decodeThumbnail(path: String): ImageBitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0) return null
    return BitmapFactory.decodeFile(
        path,
        BitmapFactory.Options().apply {
            inSampleSize = DocumentImage.sampleSizeFor(bounds.outWidth, bounds.outHeight, maxEdge = 200)
        },
    )?.asImageBitmap()
}
