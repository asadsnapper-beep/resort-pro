package site.resortpro.android.feature.guests

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.GuestDetailsDto
import site.resortpro.android.core.network.GuestSummaryDto

data class GuestSearchState(
    val query: String = "",
    val guests: List<GuestSummaryDto> = emptyList(),
    val isLoading: Boolean = false,
    val searched: Boolean = false,
    val error: String? = null,
    val page: Int = 1,
    val totalPages: Int = 0,
    val total: Int = 0,
)

class GuestsViewModel(private val repository: GuestsRepository) : ViewModel() {
    private val mutableState = MutableStateFlow(GuestSearchState())
    val state = mutableState.asStateFlow()
    private var request: Job? = null
    private var requestVersion = 0

    fun updateQuery(value: String) {
        requestVersion++
        request?.cancel()
        mutableState.update { it.copy(query = value.take(100), guests = emptyList(), searched = false, isLoading = false, error = null, page = 1, totalPages = 0, total = 0) }
    }

    fun search(page: Int = 1) {
        val query = mutableState.value.query.trim()
        if (query.length < 2 || page < 1 || mutableState.value.isLoading) return
        val version = ++requestVersion
        mutableState.update { it.copy(isLoading = true, error = null, guests = emptyList(), searched = true, page = page) }
        request = viewModelScope.launch {
            try {
                val result = repository.search(query, page)
                if (version == requestVersion) mutableState.update { it.copy(isLoading = false, guests = result.guests, page = result.page, totalPages = result.totalPages, total = result.total) }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { if (version == requestVersion) mutableState.update { it.copy(isLoading = false, error = error.message ?: "Could not search guests.") } }
        }
    }

    class Factory(private val repository: GuestsRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST") override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(GuestsViewModel::class.java))
            return GuestsViewModel(repository) as T
        }
    }
}

data class GuestDetailState(val isLoading: Boolean = false, val guest: GuestDetailsDto? = null, val error: String? = null)

class GuestDetailsViewModel(private val repository: GuestsRepository, private val guestId: String) : ViewModel() {
    private val mutableState = MutableStateFlow(GuestDetailState())
    val state = mutableState.asStateFlow()
    init { retry() }

    fun retry() {
        if (mutableState.value.isLoading) return
        mutableState.update { it.copy(isLoading = true, error = null, guest = null) }
        viewModelScope.launch {
            try { val guest = repository.details(guestId); mutableState.update { it.copy(isLoading = false, guest = guest) } }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { mutableState.update { it.copy(isLoading = false, error = error.message ?: "Could not load this guest.") } }
        }
    }

    class Factory(private val repository: GuestsRepository, private val guestId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST") override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(GuestDetailsViewModel::class.java))
            return GuestDetailsViewModel(repository, guestId) as T
        }
    }
}
