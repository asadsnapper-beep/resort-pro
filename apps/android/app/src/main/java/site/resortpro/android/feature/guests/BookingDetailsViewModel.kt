package site.resortpro.android.feature.guests

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.BookingDetailsDto

data class BookingDetailsState(val loading: Boolean = false, val booking: BookingDetailsDto? = null, val error: String? = null)

class BookingDetailsViewModel(private val repository: GuestsRepository, private val id: String) : ViewModel() {
    private val mutableState = MutableStateFlow(BookingDetailsState())
    val state = mutableState.asStateFlow()
    init { retry() }
    fun retry() {
        if (mutableState.value.loading) return
        mutableState.update { it.copy(loading = true, booking = null, error = null) }
        viewModelScope.launch {
            try { val booking = repository.booking(id); mutableState.update { it.copy(loading = false, booking = booking) } }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { mutableState.update { it.copy(loading = false, error = error.message ?: "Could not load this booking.") } }
        }
    }
    class Factory(private val repository: GuestsRepository, private val id: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST") override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(BookingDetailsViewModel::class.java))
            return BookingDetailsViewModel(repository, id) as T
        }
    }
}
