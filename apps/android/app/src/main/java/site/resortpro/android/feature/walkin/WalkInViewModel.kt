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
                    mutableState.update { it.copy(isSubmitting = false, createdBooking = booking) }
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
        mutableState.value = WalkInUiState()
        prepared = false
        prepare()
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
