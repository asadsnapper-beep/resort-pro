package site.resortpro.android.feature.walkin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CancellationException
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.RateQuoteDto
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.core.network.WalkInBookingDto
import site.resortpro.android.core.network.WalkInRequest
import site.resortpro.android.BuildConfig
import site.resortpro.android.feature.rooms.AvailabilityValidator

data class WalkInUiState(
    val guestName: String = "",
    val guestPhone: String = "",
    val checkIn: String = walkInDate(0),
    val checkOut: String = walkInDate(1),
    val adults: Int = 1,
    val children: Int = 0,
    val roomNotes: String = "",
    val paymentMethod: String = "CASH",
    val advanceAmount: String = "",
    val availableRooms: List<RoomDto> = emptyList(),
    val hasAvailabilityResult: Boolean = false,
    val selectedRoomId: String? = null,
    val quote: RateQuoteDto? = null,
    val validation: WalkInValidation = WalkInValidation(),
    val isLoadingRooms: Boolean = false,
    val isLoadingQuote: Boolean = false,
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val conflictMessage: String? = null,
    val submissionUncertain: Boolean = false,
    val createdBooking: WalkInBookingDto? = null,
    val guestPhotoPath: String? = null,
    val documentPhotoPath: String? = null,
    val documentType: String = "NATIONAL_ID",
    val uploadingImages: Boolean = false,
    val imageUploadMessage: String? = null,
    val pendingImageCount: Int = 0,
    val pendingImageError: String? = null,
) {
    val selectedRoom: RoomDto? get() = availableRooms.firstOrNull { it.id == selectedRoomId }
    val nights: Int get() = nightsBetween(checkIn, checkOut)
    val estimatedTotal: Double?
        get() = quote?.resolved?.totalPrice ?: quote?.basePrice?.times(nights)
}

class WalkInViewModel(
    private val repository: WalkInRepository,
    private val pending: PendingGuestImages,
    private val tenantId: String,
    private val userId: String,
) : ViewModel() {
    private val mutableState = MutableStateFlow(WalkInUiState())
    val state: StateFlow<WalkInUiState> = mutableState.asStateFlow()
    private var prepared = false

    init { refreshPending() }

    private fun refreshPending() {
        viewModelScope.launch {
            try {
                check(tenantId.isNotBlank() && userId.isNotBlank())
                val count = withContext(Dispatchers.IO) { pending.list(storageTenant(), userId).size }
                mutableState.update { it.copy(pendingImageCount = count, pendingImageError = null) }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                mutableState.update { it.copy(pendingImageError = "Saved photos cannot be read on this device. Contact your administrator; do not retake them until guest documents are checked.") }
            }
        }
    }

    private fun storageTenant() = "${BuildConfig.API_BASE_URL}|$tenantId"

    fun prepare() {
        if (prepared) return
        prepared = true
    }

    fun validateStay(): Boolean {
        val current = mutableState.value
        val dates = AvailabilityValidator.validate(current.checkIn, current.checkOut)
        mutableState.update { it.copy(validation = it.validation.copy(checkInError = dates.checkInError, checkOutError = dates.checkOutError)) }
        return dates.isValid
    }

    fun validateRoom(): Boolean {
        val current = mutableState.value
        val room = current.selectedRoom
        val roomError = if (room == null) "Select an available room." else null
        val occupancyError = if (room != null && current.adults + current.children > room.maxOccupancy) {
            "This room allows up to ${room.maxOccupancy} guests."
        } else null
        mutableState.update { it.copy(validation = it.validation.copy(roomError = roomError, occupancyError = occupancyError)) }
        return roomError == null && occupancyError == null && current.quote != null && !current.isLoadingQuote
    }

    fun validateGuest(): Boolean {
        val error = if (mutableState.value.guestName.isBlank()) "Guest name is required." else null
        mutableState.update { it.copy(validation = it.validation.copy(guestNameError = error)) }
        return error == null
    }

    fun updateGuestName(value: String) = mutableState.update {
        it.copy(guestName = value, validation = it.validation.copy(guestNameError = null))
    }

    fun updateGuestPhone(value: String) = mutableState.update { it.copy(guestPhone = value.take(30)) }

    fun setPhoto(path: String, isDocument: Boolean) {
        val old = if (isDocument) mutableState.value.documentPhotoPath else mutableState.value.guestPhotoPath
        if (old != path) old?.let { File(it).delete() }
        mutableState.update { if (isDocument) it.copy(documentPhotoPath = path) else it.copy(guestPhotoPath = path) }
    }

    fun removePhoto(isDocument: Boolean) {
        val path = if (isDocument) mutableState.value.documentPhotoPath else mutableState.value.guestPhotoPath
        path?.let { File(it).delete() }
        mutableState.update { if (isDocument) it.copy(documentPhotoPath = null) else it.copy(guestPhotoPath = null) }
    }

    fun selectDocumentType(value: String) = mutableState.update { it.copy(documentType = value) }

    fun updateCheckIn(value: String) {
        mutableState.update {
            it.copy(
                checkIn = value.take(10),
                selectedRoomId = null,
                availableRooms = emptyList(),
                hasAvailabilityResult = false,
                quote = null,
                isLoadingRooms = false,
                isLoadingQuote = false,
                validation = it.validation.copy(checkInError = null, roomError = null),
                conflictMessage = null,
            )
        }
    }

    fun updateCheckOut(value: String) {
        mutableState.update {
            it.copy(
                checkOut = value.take(10),
                selectedRoomId = null,
                availableRooms = emptyList(),
                hasAvailabilityResult = false,
                quote = null,
                isLoadingRooms = false,
                isLoadingQuote = false,
                validation = it.validation.copy(checkOutError = null, roomError = null),
                conflictMessage = null,
            )
        }
    }

    fun incrementAdults(delta: Int) = mutableState.update {
        it.copy(adults = (it.adults + delta).coerceAtLeast(1), validation = it.validation.copy(occupancyError = null))
    }

    fun incrementChildren(delta: Int) = mutableState.update {
        it.copy(children = (it.children + delta).coerceAtLeast(0), validation = it.validation.copy(occupancyError = null))
    }

    fun updateNotes(value: String) = mutableState.update { it.copy(roomNotes = value.take(500)) }

    fun selectPaymentMethod(value: String) = mutableState.update {
        it.copy(
            paymentMethod = value,
            advanceAmount = if (value == "LATER") "" else it.advanceAmount,
            validation = it.validation.copy(advanceError = null),
        )
    }

    fun updateAdvance(value: String) = mutableState.update {
        it.copy(
            advanceAmount = value.filter { char -> char.isDigit() || char == '.' }.take(12),
            validation = it.validation.copy(advanceError = null),
        )
    }

    fun checkAvailability() {
        val current = mutableState.value
        val dates = AvailabilityValidator.validate(current.checkIn, current.checkOut)
        if (!dates.isValid) {
            mutableState.update {
                it.copy(
                    validation = it.validation.copy(
                        checkInError = dates.checkInError,
                        checkOutError = dates.checkOutError,
                    ),
                )
            }
            return
        }
        if (current.isLoadingRooms || current.isSubmitting) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isLoadingRooms = true,
                    errorMessage = null,
                    conflictMessage = null,
                    availableRooms = emptyList(),
                    hasAvailabilityResult = false,
                    selectedRoomId = null,
                    quote = null,
                )
            }
            runCatching { repository.availableRooms(current.checkIn, current.checkOut) }
                .onSuccess { rooms ->
                    if (mutableState.value.checkIn != current.checkIn || mutableState.value.checkOut != current.checkOut) return@onSuccess
                    mutableState.update {
                        it.copy(
                            isLoadingRooms = false,
                            availableRooms = rooms,
                            hasAvailabilityResult = true,
                        )
                    }
                    rooms.firstOrNull()?.let { selectRoom(it.id) }
                }
                .onFailure { error ->
                    if (mutableState.value.checkIn != current.checkIn || mutableState.value.checkOut != current.checkOut) return@onFailure
                    mutableState.update {
                        it.copy(isLoadingRooms = false, errorMessage = error.message ?: "Could not check availability.")
                    }
                }
        }
    }

    fun selectRoom(roomId: String) {
        val current = mutableState.value
        if (current.availableRooms.none { it.id == roomId }) return
        mutableState.update {
            it.copy(
                selectedRoomId = roomId,
                quote = null,
                isLoadingQuote = true,
                errorMessage = null,
                validation = it.validation.copy(roomError = null, occupancyError = null),
            )
        }
        viewModelScope.launch {
            runCatching { repository.quote(roomId, current.checkIn, current.checkOut) }
                .onSuccess { quote ->
                    mutableState.update {
                        if (it.selectedRoomId == roomId && it.checkIn == current.checkIn && it.checkOut == current.checkOut) it.copy(isLoadingQuote = false, quote = quote) else it
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        if (it.selectedRoomId == roomId && it.checkIn == current.checkIn && it.checkOut == current.checkOut) {
                            it.copy(isLoadingQuote = false, errorMessage = error.message ?: "Could not load the rate quote.")
                        } else {
                            it
                        }
                    }
                }
        }
    }

    fun submit() {
        val current = mutableState.value
        if (current.isSubmitting || current.uploadingImages || current.submissionUncertain || current.createdBooking != null) return
        val validation = WalkInValidator.validate(
            guestName = current.guestName,
            checkIn = current.checkIn,
            checkOut = current.checkOut,
            room = current.selectedRoom,
            adults = current.adults,
            children = current.children,
            paymentMethod = current.paymentMethod,
            advanceText = current.advanceAmount,
            estimatedTotal = current.estimatedTotal,
        )
        if (!validation.isValid || current.quote == null) {
            mutableState.update {
                it.copy(
                    validation = validation,
                    errorMessage = if (current.quote == null) "Wait for the server price quote before checking in." else null,
                )
            }
            return
        }

        val request = WalkInRequest(
            guestName = current.guestName.trim(),
            guestPhone = current.guestPhone.trim().takeIf(String::isNotEmpty),
            adults = current.adults,
            children = current.children,
            roomId = current.selectedRoom!!.id,
            checkIn = current.checkIn,
            checkOut = current.checkOut,
            paymentMethod = current.paymentMethod,
            advanceAmount = current.advanceAmount.toDoubleOrNull()?.takeIf { it > 0 },
            roomNotes = current.roomNotes.trim().takeIf(String::isNotEmpty),
        )

        // Reserve submission synchronously. Two taps can arrive before a
        // launched coroutine gets CPU time, so setting this inside launch
        // leaves a small but real duplicate-booking window.
        mutableState.update {
            it.copy(isSubmitting = true, errorMessage = null, conflictMessage = null)
        }
        viewModelScope.launch {
            runCatching { repository.create(request) }
                .onSuccess { booking ->
                    mutableState.update { it.copy(isSubmitting = false, createdBooking = booking, uploadingImages = it.guestPhotoPath != null || it.documentPhotoPath != null) }
                    uploadCapturedImages(booking)
                }
                .onFailure { error ->
                    mutableState.update {
                        when {
                            error is ApiException && error.status == 409 -> it.copy(
                                isSubmitting = false,
                                selectedRoomId = null,
                                quote = null,
                                conflictMessage = error.message,
                            )
                            error !is ApiException || error.status >= 500 -> it.copy(
                                isSubmitting = false,
                                submissionUncertain = true,
                                errorMessage = "Connection ended before confirmation. Check Front Desk before retrying to avoid a duplicate booking.",
                            )
                            else -> it.copy(
                                isSubmitting = false,
                                errorMessage = error.message,
                            )
                        }
                    }
                }
        }
    }

    fun acknowledgeUncertainSubmission() {
        mutableState.update { it.copy(submissionUncertain = false, errorMessage = null) }
    }

    fun startAnother() {
        removePhoto(false)
        removePhoto(true)
        mutableState.value = WalkInUiState(pendingImageCount = mutableState.value.pendingImageCount, pendingImageError = mutableState.value.pendingImageError)
        prepared = false
        prepare()
    }

    private suspend fun uploadCapturedImages(booking: WalkInBookingDto) {
        val current = mutableState.value
        val images = listOfNotNull(
            current.guestPhotoPath?.let { Triple(it, "GUEST_PHOTO", "Guest photo") },
            current.documentPhotoPath?.let { Triple(it, current.documentType, "ID photo") },
        )
        val failed = mutableListOf<String>()
        for ((path, type, label) in images) {
            val file = File(path)
            try {
                check(tenantId.isNotBlank() && userId.isNotBlank())
                withContext(Dispatchers.IO) { pending.save(storageTenant(), userId, booking.guestId, booking.id, type, file) }
                file.delete()
                mutableState.update { if (type == "GUEST_PHOTO") it.copy(guestPhotoPath = null) else it.copy(documentPhotoPath = null) }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { failed += label }
        }
        if (images.size > failed.size) uploadPending()
        mutableState.update {
            it.copy(
                uploadingImages = false,
                imageUploadMessage = if (failed.isNotEmpty()) "${failed.joinToString()} could not be saved securely. Booking is confirmed. These temporary photos are removed when you leave; check guest documents and retake if needed." else it.imageUploadMessage,
            )
        }
        refreshPending()
    }

    fun retryPendingImages() {
        if (mutableState.value.uploadingImages) return
        mutableState.update { it.copy(uploadingImages = true, imageUploadMessage = null) }
        viewModelScope.launch {
            try { uploadPending() }
            finally { mutableState.update { it.copy(uploadingImages = false) }; refreshPending() }
        }
    }

    fun discardPendingImages() {
        if (mutableState.value.uploadingImages) return
        mutableState.update { it.copy(uploadingImages = true) }
        viewModelScope.launch {
            try {
                check(tenantId.isNotBlank() && userId.isNotBlank())
                withContext(Dispatchers.IO) { pending.list(storageTenant(), userId).forEach(pending::remove) }
                mutableState.update { it.copy(imageUploadMessage = "Saved photos removed from this device. Existing server documents were not changed.") }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { mutableState.update { it.copy(imageUploadMessage = "Could not remove saved photos. Contact your administrator.") } }
            finally { mutableState.update { it.copy(uploadingImages = false) }; refreshPending() }
        }
    }

    private suspend fun uploadPending() {
        try {
            check(tenantId.isNotBlank() && userId.isNotBlank())
            val items = withContext(Dispatchers.IO) { pending.list(storageTenant(), userId) }
            if (items.isEmpty()) return
            if (!repository.supportsSafeRetry()) {
                mutableState.update { it.copy(imageUploadMessage = "Photos are encrypted on this device. Upload will be available when the server supports safe retry; please try again later.") }
                return
            }
            for (item in items) {
                if (item.quarantined) {
                    mutableState.update { it.copy(imageUploadMessage = "A photo needs manual review. Check guest documents and contact your administrator before trying again.") }
                    continue
                }
                try {
                    repository.uploadSavedImage(item.guestId, item.bookingId, item.docType, item.id, pending.bytes(item))
                } catch (error: UploadIdentityMismatchException) {
                    withContext(Dispatchers.IO) { pending.quarantine(item) }
                    mutableState.update { it.copy(imageUploadMessage = "The server returned an unexpected response. This photo is paused; check guest documents and contact your administrator.") }
                    return
                }
                withContext(Dispatchers.IO) { pending.remove(item) }
            }
            if (items.none { it.quarantined }) mutableState.update { it.copy(imageUploadMessage = "Guest photos uploaded.") }
        } catch (error: CancellationException) { throw error }
        catch (_: Exception) {
            mutableState.update { it.copy(imageUploadMessage = "Upload not confirmed. The encrypted photos remain on this device; retry when connected. Check guest documents if the server response was unexpected.") }
        }
    }

    override fun onCleared() {
        mutableState.value.guestPhotoPath?.let { File(it).delete() }
        mutableState.value.documentPhotoPath?.let { File(it).delete() }
        super.onCleared()
    }

    class Factory(private val repository: WalkInRepository, private val pending: PendingGuestImages, private val tenantId: String, private val userId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(WalkInViewModel::class.java))
            return WalkInViewModel(repository, pending, tenantId, userId) as T
        }
    }
}

private fun walkInDate(daysFromToday: Int): String {
    val calendar = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, daysFromToday) }
    return SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(calendar.time)
}

private fun nightsBetween(checkIn: String, checkOut: String): Int {
    val parser = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply { isLenient = false }
    return runCatching {
        val start = parser.parse(checkIn)?.time ?: return@runCatching 1
        val end = parser.parse(checkOut)?.time ?: return@runCatching 1
        ((end - start) / 86_400_000L).toInt().coerceAtLeast(1)
    }.getOrDefault(1)
}
