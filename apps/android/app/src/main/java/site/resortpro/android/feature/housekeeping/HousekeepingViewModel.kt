package site.resortpro.android.feature.housekeeping

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.HousekeepingTaskDto

data class HousekeepingUiState(
    val tasks: List<HousekeepingTaskDto> = emptyList(),
    val filter: HousekeepingFilter = HousekeepingFilter.ALL,
    val isLoading: Boolean = false,
    val updatingTaskIds: Set<String> = emptySet(),
    val errorMessage: String? = null,
    val actionError: String? = null,
    val isStaffView: Boolean = false,
    val syncedAt: Long? = null,
    val fromCache: Boolean = false,
    val queuedTaskIds: Set<String> = emptySet(),
) {
    val visibleTasks: List<HousekeepingTaskDto>
        get() = HousekeepingPolicy.filter(tasks, filter).let { filtered ->
            // Unfinished work first, for staff. Opening the app to two rooms
            // you already cleaned, with the next job below the fold, is the
            // list telling you about its own history instead of your day.
            // Managers keep the server's order — they are reading the whole
            // board, not working through it.
            if (isStaffView) filtered.sortedBy { HousekeepingPolicy.isFinished(it.status) } else filtered
        }
}

class HousekeepingViewModel(
    private val repository: HousekeepingRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(HousekeepingUiState())
    val state: StateFlow<HousekeepingUiState> = mutableState.asStateFlow()

    private var currentRole: String? = null
    private var currentUserId: String? = null
    private var currentTenantId: String? = null

    fun loadTasks(role: String, userId: String, tenantId: String, force: Boolean = false) {
        currentRole = role
        currentUserId = userId
        currentTenantId = tenantId
        if (mutableState.value.isLoading || (!force && mutableState.value.tasks.isNotEmpty())) return

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    isStaffView = role == "STAFF",
                )
            }
            runCatching { repository.loadTasks(role = role, userId = userId, tenantId = tenantId) }
                .onSuccess { result ->
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            tasks = result.tasks,
                            syncedAt = result.syncedAt,
                            fromCache = result.fromCache,
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Could not load housekeeping tasks.",
                        )
                    }
                }
        }
    }

    fun retry() {
        val role = currentRole ?: return
        val userId = currentUserId ?: return
        val tenantId = currentTenantId ?: return
        loadTasks(role = role, userId = userId, tenantId = tenantId, force = true)
    }

    fun selectFilter(filter: HousekeepingFilter) {
        mutableState.update { it.copy(filter = filter) }
    }

    fun updateStatus(taskId: String, newStatus: String) {
        val original = mutableState.value.tasks.firstOrNull { it.id == taskId } ?: return
        val role = currentRole ?: return
        val userId = currentUserId ?: return
        val tenantId = currentTenantId ?: return
        if (taskId in mutableState.value.updatingTaskIds) return
        if (newStatus !in HousekeepingPolicy.allowedNextStatuses(original.status)) return

        mutableState.update { state ->
            state.copy(
                tasks = state.tasks.map { task ->
                    if (task.id == taskId) task.copy(status = newStatus) else task
                },
                updatingTaskIds = state.updatingTaskIds + taskId,
                actionError = null,
            )
        }

        viewModelScope.launch {
            runCatching {
                repository.updateStatus(
                    task = original,
                    status = newStatus,
                    tenantId = tenantId,
                    userId = userId,
                    role = role,
                )
            }.onSuccess { result ->
                    mutableState.update { state ->
                        state.copy(
                            tasks = state.tasks.map { task ->
                                if (task.id == taskId) {
                                    task.copy(status = result.task.status, completedAt = result.task.completedAt)
                                } else {
                                    task
                                }
                            },
                            updatingTaskIds = state.updatingTaskIds - taskId,
                            queuedTaskIds = if (result.queued) {
                                state.queuedTaskIds + taskId
                            } else {
                                state.queuedTaskIds - taskId
                            },
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update { state ->
                        state.copy(
                            tasks = state.tasks.map { task -> if (task.id == taskId) original else task },
                            updatingTaskIds = state.updatingTaskIds - taskId,
                            actionError = error.message ?: "The task was restored to its previous status.",
                        )
                    }
                }
        }
    }

    fun clearActionError() {
        mutableState.update { it.copy(actionError = null) }
    }

    class Factory(
        private val repository: HousekeepingRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(HousekeepingViewModel::class.java))
            return HousekeepingViewModel(repository) as T
        }
    }
}
