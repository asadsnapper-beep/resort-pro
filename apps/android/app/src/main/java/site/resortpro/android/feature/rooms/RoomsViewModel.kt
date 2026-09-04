package site.resortpro.android.feature.rooms

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
import site.resortpro.android.core.network.RoomDto

enum class RoomsMode { ALL, AVAILABILITY }

data class RoomsUiState(
    val mode: RoomsMode = RoomsMode.ALL,
    val rooms: List<RoomDto> = emptyList(),
    val availableRooms: List<RoomDto>? = null,
    val checkIn: String = defaultDate(daysFromToday = 1),
    val checkOut: String = defaultDate(daysFromToday = 2),
    val validation: AvailabilityValidation = AvailabilityValidation(),
    val isLoading: Boolean = false,
    val isAvailabilityLoading: Boolean = false,
    val errorMessage: String? = null,
    val availabilityError: String? = null,
    val syncedAt: Long? = null,
    val fromCache: Boolean = false,
    val truncated: Boolean = false,
)

class RoomsViewModel(
    private val repository: RoomsRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(RoomsUiState())
    val state: StateFlow<RoomsUiState> = mutableState.asStateFlow()

    fun loadRooms(tenantId: String, force: Boolean = false) {
        if (mutableState.value.isLoading || (!force && mutableState.value.rooms.isNotEmpty())) return
        viewModelScope.launch {
            mutableState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.loadRooms(tenantId) }
                .onSuccess { result ->
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            rooms = result.rooms,
                            syncedAt = result.syncedAt,
                            fromCache = result.fromCache,
                            truncated = result.truncated,
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(isLoading = false, errorMessage = error.message ?: "Could not load rooms.")
                    }
                }
        }
    }

    fun selectMode(mode: RoomsMode) {
        mutableState.update { it.copy(mode = mode) }
    }

    fun updateCheckIn(value: String) {
        mutableState.update {
            it.copy(
                checkIn = value.take(10),
                validation = it.validation.copy(checkInError = null),
                availabilityError = null,
            )
        }
    }

    fun updateCheckOut(value: String) {
        mutableState.update {
            it.copy(
                checkOut = value.take(10),
                validation = it.validation.copy(checkOutError = null),
                availabilityError = null,
            )
        }
    }

    fun checkAvailability() {
        val current = mutableState.value
        val validation = AvailabilityValidator.validate(current.checkIn, current.checkOut)
        if (!validation.isValid) {
            mutableState.update { it.copy(validation = validation) }
            return
        }

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isAvailabilityLoading = true,
                    availabilityError = null,
                    validation = validation,
                )
            }
            runCatching { repository.checkAvailability(current.checkIn, current.checkOut) }
                .onSuccess { rooms ->
                    mutableState.update {
                        it.copy(isAvailabilityLoading = false, availableRooms = rooms)
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isAvailabilityLoading = false,
                            availabilityError = error.message ?: "Could not check availability.",
                        )
                    }
                }
        }
    }

    class Factory(
        private val repository: RoomsRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(RoomsViewModel::class.java))
            return RoomsViewModel(repository) as T
        }
    }
}

private fun defaultDate(daysFromToday: Int): String {
    val calendar = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, daysFromToday) }
    return SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(calendar.time)
}
