package site.resortpro.android.feature.rooms

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.RoomDto

data class RoomDetailsState(
    val room: RoomDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val fromCache: Boolean = false,
    val syncedAt: Long? = null,
    val checkIn: String? = null,
    val checkOut: String? = null,
    val availabilityLoading: Boolean = false,
    val available: Boolean? = null,
    val availabilityError: String? = null,
)

class RoomDetailsViewModel(
    private val repository: RoomsRepository,
    private val roomId: String,
    private val tenantId: String,
    checkIn: String?,
    checkOut: String?,
) : ViewModel() {
    private val hasValidDates = checkIn != null && checkOut != null && AvailabilityValidator.validate(checkIn, checkOut).isValid
    private val mutableState = MutableStateFlow(RoomDetailsState(checkIn = checkIn.takeIf { hasValidDates }, checkOut = checkOut.takeIf { hasValidDates }))
    val state = mutableState.asStateFlow()

    init { refresh() }

    fun refresh() {
        if (mutableState.value.isLoading || mutableState.value.availabilityLoading) return
        mutableState.update { it.copy(isLoading = true, error = null, available = null, availabilityError = null) }
        viewModelScope.launch {
            try {
                val result = repository.roomDetails(roomId, tenantId)
                mutableState.update { it.copy(room = result.room, isLoading = false, fromCache = result.fromCache, syncedAt = result.syncedAt) }
                val state = mutableState.value
                if (state.checkIn != null && state.checkOut != null) {
                    mutableState.update { it.copy(availabilityLoading = true) }
                    try {
                        val rooms = repository.checkAvailability(state.checkIn, state.checkOut)
                        mutableState.update { it.copy(availabilityLoading = false, available = rooms.any { room -> room.id == roomId }) }
                    } catch (error: CancellationException) { throw error }
                    catch (_: Exception) { mutableState.update { it.copy(availabilityLoading = false, availabilityError = "Could not verify availability. Please try again online.") } }
                }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { mutableState.update { it.copy(isLoading = false, room = null, error = error.message ?: "Could not load this room.") } }
        }
    }

    class Factory(private val repository: RoomsRepository, private val roomId: String, private val tenantId: String, private val checkIn: String?, private val checkOut: String?) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(RoomDetailsViewModel::class.java))
            return RoomDetailsViewModel(repository, roomId, tenantId, checkIn, checkOut) as T
        }
    }
}
