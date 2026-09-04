package site.resortpro.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.DateFormat
import java.util.Date
import site.resortpro.android.core.network.HousekeepingTaskDto
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.housekeeping.HousekeepingFilter
import site.resortpro.android.feature.housekeeping.HousekeepingPolicy
import site.resortpro.android.feature.housekeeping.HousekeepingViewModel

@Composable
fun HousekeepingScreen(
    viewModel: HousekeepingViewModel,
    session: AuthenticatedSession,
    /** Null when this screen *is* the home — staff have nowhere to go back to. */
    onBack: (() -> Unit)?,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val loadError = state.errorMessage
    val actionError = state.actionError
    val tenantId = session.user.tenantId ?: session.tenant?.id ?: return
    LaunchedEffect(session.user.id, tenantId) {
        viewModel.loadTasks(
            role = session.user.role,
            userId = session.user.id,
            tenantId = tenantId,
        )
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
                    if (onBack != null) TextButton(onClick = onBack) { Text("Back") }
                    TextButton(onClick = onLogout) { Text("Sign out") }
                }
                Text(
                    "Housekeeping",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    if (state.isStaffView) "My assigned tasks" else session.tenant?.name ?: "ResortPro",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                state.syncedAt?.let { syncedAt ->
                    Text(
                        if (state.fromCache) {
                            "Offline · Last synced ${formatHousekeepingSyncTime(syncedAt)}"
                        } else {
                            "Updated ${formatHousekeepingSyncTime(syncedAt)}"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HousekeepingFilter.entries.forEach { filter ->
                        FilterChip(
                            selected = state.filter == filter,
                            onClick = { viewModel.selectFilter(filter) },
                            label = { Text(filter.label()) },
                        )
                    }
                }
            }

            if (actionError != null) {
                item {
                    HousekeepingMessageCard(
                        title = "Update failed",
                        message = "$actionError The previous status was restored.",
                        isError = true,
                    )
                    TextButton(onClick = viewModel::clearActionError) { Text("Dismiss") }
                }
            }

            when {
                state.isLoading -> item { HousekeepingLoadingCard() }
                loadError != null -> item {
                    HousekeepingMessageCard("Could not load tasks", loadError, isError = true)
                    TextButton(onClick = viewModel::retry) { Text("Try again") }
                }
                state.visibleTasks.isEmpty() -> item {
                    HousekeepingMessageCard(
                        title = "No tasks",
                        message = if (state.isStaffView && state.filter == HousekeepingFilter.ALL) {
                            "No housekeeping tasks are assigned to you."
                        } else {
                            "No tasks match this filter."
                        },
                    )
                }
                else -> {
                    item {
                        Text(
                            "${state.visibleTasks.size} tasks",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    items(state.visibleTasks, key = HousekeepingTaskDto::id) { task ->
                        HousekeepingTaskCard(
                            task = task,
                            isUpdating = task.id in state.updatingTaskIds,
                            isQueued = task.id in state.queuedTaskIds,
                            onUpdateStatus = { status -> viewModel.updateStatus(task.id, status) },
                        )
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun HousekeepingTaskCard(
    task: HousekeepingTaskDto,
    isUpdating: Boolean,
    isQueued: Boolean,
    onUpdateStatus: (String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        task.room?.let { "Room ${it.number} · ${it.name}" } ?: "Room task",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${task.type.displayLabel()} · ${task.scheduledDate.take(10)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    task.status.displayLabel(),
                    color = housekeepingStatusColor(task.status),
                    fontWeight = FontWeight.SemiBold,
                )
            }

            task.assignedTo?.user?.let { user ->
                Text("Assigned to ${user.firstName} ${user.lastName}")
            }
            if (!task.notes.isNullOrBlank()) {
                Text(task.notes, style = MaterialTheme.typography.bodyMedium)
            }
            if (isQueued) {
                Text(
                    "Saved offline · will sync when connected",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            val actions = HousekeepingPolicy.allowedNextStatuses(task.status)
            if (isUpdating) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                    Text("Updating…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else if (actions.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    actions.forEach { status ->
                        TextButton(onClick = { onUpdateStatus(status) }) {
                            Text(status.actionLabel())
                        }
                    }
                }
            }
        }
    }
}

private fun formatHousekeepingSyncTime(timestamp: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(timestamp))

@Composable
private fun HousekeepingLoadingCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(modifier = Modifier.height(24.dp))
            Text("Loading housekeeping tasks…")
        }
    }
}

@Composable
private fun HousekeepingMessageCard(title: String, message: String, isError: Boolean = false) {
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

@Composable
private fun housekeepingStatusColor(status: String) = when (status) {
    "COMPLETED" -> MaterialTheme.colorScheme.primary
    "SKIPPED" -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

private fun HousekeepingFilter.label(): String = when (this) {
    HousekeepingFilter.ALL -> "All"
    HousekeepingFilter.PENDING -> "Pending"
    HousekeepingFilter.IN_PROGRESS -> "In progress"
    HousekeepingFilter.COMPLETED -> "Completed"
    HousekeepingFilter.SKIPPED -> "Skipped"
}

private fun String.displayLabel(): String = lowercase()
    .replace('_', ' ')
    .replaceFirstChar { it.titlecase() }

private fun String.actionLabel(): String = when (this) {
    "IN_PROGRESS" -> "Start"
    "COMPLETED" -> "Complete"
    "SKIPPED" -> "Skip"
    else -> displayLabel()
}
