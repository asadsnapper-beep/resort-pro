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
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.DateFormat
import java.util.Date
import site.resortpro.android.R
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
                    if (onBack != null) TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }
                    TextButton(onClick = onLogout) { Text(stringResource(R.string.action_sign_out)) }
                }
                Text(
                    stringResource(R.string.hk_title),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    if (state.isStaffView) stringResource(R.string.hk_my_tasks) else session.tenant?.name ?: stringResource(R.string.app_name),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                state.syncedAt?.let { syncedAt ->
                    Text(
                        if (state.fromCache) {
                            stringResource(R.string.hk_offline_synced, formatHousekeepingSyncTime(syncedAt))
                        } else {
                            stringResource(R.string.hk_updated, formatHousekeepingSyncTime(syncedAt))
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
                        title = stringResource(R.string.hk_update_failed),
                        message = stringResource(R.string.hk_update_failed_body, actionError),
                        isError = true,
                    )
                    TextButton(onClick = viewModel::clearActionError) { Text(stringResource(R.string.action_dismiss)) }
                }
            }

            when {
                state.isLoading -> item { HousekeepingLoadingCard() }
                loadError != null -> item {
                    HousekeepingMessageCard(stringResource(R.string.hk_load_failed), loadError, isError = true)
                    TextButton(onClick = viewModel::retry) { Text(stringResource(R.string.action_try_again)) }
                }
                state.visibleTasks.isEmpty() -> item {
                    HousekeepingMessageCard(
                        title = stringResource(R.string.hk_none_title),
                        message = if (state.isStaffView && state.filter == HousekeepingFilter.ALL) {
                            stringResource(R.string.hk_none_assigned)
                        } else {
                            stringResource(R.string.hk_none_match)
                        },
                    )
                }
                else -> {
                    item {
                        // A housekeeper counts what is left, not what exists.
                        // "8 tasks" includes the five she has already finished,
                        // which is the one number that cannot help her.
                        val remaining = state.visibleTasks.count { !HousekeepingPolicy.isFinished(it.status) }
                        Text(
                            if (state.isStaffView) {
                                if (remaining == 0) stringResource(R.string.hk_all_done) else stringResource(R.string.hk_left, remaining)
                            } else {
                                stringResource(R.string.hk_task_count, state.visibleTasks.size)
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    items(state.visibleTasks, key = HousekeepingTaskDto::id) { task ->
                        HousekeepingTaskCard(
                            task = task,
                            isUpdating = task.id in state.updatingTaskIds,
                            isQueued = task.id in state.queuedTaskIds,
                            isStaffView = state.isStaffView,
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
    isStaffView: Boolean,
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
                    if (isStaffView) {
                        // The room number is the only thing she needs to read
                        // while walking, so it is the largest thing on the card.
                        // The room's name is how the resort sells it, not how
                        // she finds it.
                        Text(
                            task.room?.let { stringResource(R.string.hk_room, it.number) } ?: stringResource(R.string.hk_room_task),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            task.type.displayLabel(),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Text(
                            task.room?.let { stringResource(R.string.hk_room_named, it.number, it.name) } ?: stringResource(R.string.hk_room_task),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "${task.type.displayLabel()} · ${task.scheduledDate.take(10)}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Text(
                    task.status.displayLabel(),
                    color = housekeepingStatusColor(task.status),
                    fontWeight = FontWeight.SemiBold,
                )
            }

            // Every row on a housekeeper's own list said "Assigned to Rina
            // Akter". Whose list it is was already answered by the heading.
            if (!isStaffView) {
                task.assignedTo?.user?.let { user ->
                    Text(stringResource(R.string.hk_assigned_to, "${user.firstName} ${user.lastName}"))
                }
            }
            if (!task.notes.isNullOrBlank()) {
                Text(task.notes, style = MaterialTheme.typography.bodyMedium)
            }
            if (isQueued) {
                Text(
                    stringResource(R.string.hk_queued),
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
                    Text(stringResource(R.string.hk_updating), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else if (actions.isNotEmpty()) {
                if (isStaffView) {
                    // Full-width buttons at the foot of the card: 56dp so they
                    // can be hit while holding linen, and low enough on the
                    // screen to reach with the thumb of the hand holding the
                    // phone. Text buttons tucked mid-card are a mouse's idea of
                    // an action.
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        actions.forEachIndexed { index, status ->
                            if (index == 0) {
                                Button(
                                    onClick = { onUpdateStatus(status) },
                                    modifier = Modifier.weight(1f).height(56.dp),
                                ) { Text(status.actionLabel()) }
                            } else {
                                OutlinedButton(
                                    onClick = { onUpdateStatus(status) },
                                    modifier = Modifier.weight(1f).height(56.dp),
                                ) { Text(status.actionLabel()) }
                            }
                        }
                    }
                } else {
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
            Text(stringResource(R.string.hk_loading))
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

@Composable
private fun HousekeepingFilter.label(): String = stringResource(
    when (this) {
        HousekeepingFilter.ALL -> R.string.hk_filter_all
        HousekeepingFilter.PENDING -> R.string.hk_filter_pending
        HousekeepingFilter.IN_PROGRESS -> R.string.hk_filter_in_progress
        HousekeepingFilter.COMPLETED -> R.string.hk_filter_completed
        HousekeepingFilter.SKIPPED -> R.string.hk_filter_skipped
    },
)

/**
 * Server statuses and task types are English identifiers. Prettifying them by
 * lower-casing and swapping underscores works only in English — in Bangla it
 * would print "IN_PROGRESS" as "In progress" and leave a housekeeper reading a
 * word she may not know. Unknown values fall back to the tidied identifier
 * rather than an empty label, since a new server status should not blank the
 * screen.
 */
@Composable
private fun String.displayLabel(): String = when (this) {
    "PENDING" -> stringResource(R.string.hk_status_pending)
    "IN_PROGRESS" -> stringResource(R.string.hk_status_in_progress)
    "COMPLETED" -> stringResource(R.string.hk_status_completed)
    "SKIPPED" -> stringResource(R.string.hk_status_skipped)
    "DAILY" -> stringResource(R.string.hk_type_daily)
    "DEEP_CLEAN" -> stringResource(R.string.hk_type_deep_clean)
    "TURNDOWN" -> stringResource(R.string.hk_type_turndown)
    "CHECKOUT" -> stringResource(R.string.hk_type_checkout)
    "CHECKIN" -> stringResource(R.string.hk_type_checkin)
    else -> tidyIdentifier()
}

private fun String.tidyIdentifier(): String = lowercase()
    .replace('_', ' ')
    .replaceFirstChar { it.titlecase() }

@Composable
private fun String.actionLabel(): String = when (this) {
    "IN_PROGRESS" -> stringResource(R.string.hk_action_start)
    "COMPLETED" -> stringResource(R.string.hk_action_complete)
    "SKIPPED" -> stringResource(R.string.hk_action_skip)
    else -> displayLabel()
}
