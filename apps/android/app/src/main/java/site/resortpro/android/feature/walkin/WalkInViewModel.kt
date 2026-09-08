package site.resortpro.android.feature.walkin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.RateQuoteDto
import site.resortpro.android.core.network.RoomDto
import site.resortpro.android.core.network.WalkInBookingDto
import java.io.File
import site.resortpro.android.core.media.readAsUploadableJpeg
import site.resortpro.android.core.network.WalkInRequest
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
    /** Photographs waiting to go up with the booking, in the order taken. */
    val documents: List<CapturedDocument> = emptyList(),
    val documentType: String = GuestDocumentType.NATIONAL_ID,
    /** Set only when the check-in worked but the photograph did not go up. */
    val documentNote: String? = null,
    /** A retry of the photographs is in flight. */
    val isUploadingDocuments: Boolean = false,
) {
    val selectedRoom: RoomDto? get() = availableRooms.firstOrNull { it.id == selectedRoomId }
    val nights: Int get() = nightsBetween(checkIn, checkOut)
    val estimatedTotal: Double?
        get() = quote?.resolved?.totalPrice ?: quote?.basePrice?.times(nights)
}

class WalkInViewModel(
    private val repository: WalkInRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(WalkInUiState())
    val state: StateFlow<WalkInUiState> = mutableState.asStateFlow()
    private var prepared = false

    fun prepare() {
        if (prepared) return
        prepared = true
        checkAvailability()
    }

    fun updateGuestName(value: String) = mutableState.update {
        it.copy(guestName = value, validation = it.validation.copy(guestNameError = null))
    }

    fun updateGuestPhone(value: String) = mutableState.update { it.copy(guestPhone = value.take(30)) }

    fun updateCheckIn(value: String) {
        mutableState.update {
            it.copy(
                checkIn = value.take(10),
                selectedRoomId = null,
                availableRooms = emptyList(),
                hasAvailabilityResult = false,
                quote = null,
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

    fun addDocument(path: String) {
        mutableState.update { it.copy(documents = it.documents + CapturedDocument(path, it.documentType)) }
    }

    fun removeDocument(path: String) {
        File(path).delete()
        mutableState.update { it.copy(documents = it.documents.filterNot { doc -> doc.path == path }) }
    }

    fun setDocumentType(docType: String) {
        mutableState.update { it.copy(documentType = docType) }
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
                        if (it.selectedRoomId == roomId) it.copy(isLoadingQuote = false, quote = quote) else it
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        if (it.selectedRoomId == roomId) {
                            it.copy(isLoadingQuote = false, errorMessage = error.message ?: "Could not load the rate quote.")
                        } else {
                            it
                        }
                    }
                }
        }
    }

    /**
     * Send the photographs, if any were taken, and report what did not land.
     *
     * A file is deleted the moment it can no longer be of use — sent, or not a
     * readable image. A failed *send* keeps its file, because the receptionist
     * can tap Retry while the guest is still at the desk. Deleting those too is
     * what made a dropped connection cost the guest their passport a second
     * time: the photograph lived only in this app's cache, so there was nothing
     * left to add "from the guest's profile" with.
     *
     * The files still do not outlive the walk-in — [onCleared] and the cold-start
     * purge both clear them.
     */
    private suspend fun attachDocuments(
        documents: List<CapturedDocument>,
        booking: WalkInBookingDto,
    ): DocumentUploadOutcome = sendDocuments(
        documents = documents,
        send = { document ->
            try {
                val jpeg = File(document.path).readAsUploadableJpeg()
                if (jpeg == null) {
                    DocumentSendResult.UNREADABLE
                } else {
                    repository.uploadDocument(
                        guestId = booking.guestId,
                        bookingId = booking.id,
                        docType = document.docType,
                        jpeg = jpeg,
                    )
                    DocumentSendResult.SENT
                }
            } catch (error: Throwable) {
                DocumentSendResult.FAILED
            }
        },
        discard = { document -> File(document.path).delete() },
    )

    /**
     * Try the photographs that did not go up the first time.
     *
     * Only reachable from the success screen, so the booking already exists and
     * nothing here can put it at risk.
     */
    fun retryDocuments() {
        val current = mutableState.value
        val booking = current.createdBooking ?: return
        if (current.isUploadingDocuments || current.documents.isEmpty()) return

        mutableState.update { it.copy(isUploadingDocuments = true, documentNote = null) }
        viewModelScope.launch {
            val outcome = attachDocuments(current.documents, booking)
            mutableState.update {
                it.copy(
                    isUploadingDocuments = false,
                    documents = outcome.pending,
                    // Guarded above on a non-empty list, so no note means every
                    // one of them landed — worth saying, since the previous
                    // line said they had not.
                    documentNote = outcome.note ?: "Documents uploaded.",
                )
            }
        }
    }

    fun submit() {
        val current = mutableState.value
        if (current.isSubmitting || current.submissionUncertain || current.createdBooking != null) return
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
                    // The booking is the thing the guest is standing there
                    // waiting for; the photograph rides behind it and is never
                    // allowed to take it back down.
                    val outcome = attachDocuments(current.documents, booking)
                    mutableState.update {
                        it.copy(
                            isSubmitting = false,
                            createdBooking = booking,
                            documents = outcome.pending,
                            documentNote = outcome.note,
                        )
                    }
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
        discardPendingDocuments()
        mutableState.value = WalkInUiState()
        prepared = false
        prepare()
    }

    /**
     * A guest's ID does not outlive the walk-in it was taken for.
     *
     * Photographs kept for a retry are the one thing in this screen that
     * survives on disk, so every way out of it has to clear them: starting
     * another walk-in, and leaving the screen entirely. The cold-start purge is
     * the backstop for a process that dies before either happens.
     */
    override fun onCleared() {
        discardPendingDocuments()
        super.onCleared()
    }

    private fun discardPendingDocuments() {
        mutableState.value.documents.forEach { File(it.path).delete() }
    }

    class Factory(private val repository: WalkInRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(WalkInViewModel::class.java))
            return WalkInViewModel(repository) as T
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
