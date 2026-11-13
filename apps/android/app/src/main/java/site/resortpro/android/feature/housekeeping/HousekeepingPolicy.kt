package site.resortpro.android.feature.housekeeping

import site.resortpro.android.core.network.HousekeepingTaskDto
import site.resortpro.android.core.database.HousekeepingOutboxEntity

enum class HousekeepingFilter(val status: String?) {
    ALL(null),
    PENDING("PENDING"),
    IN_PROGRESS("IN_PROGRESS"),
    COMPLETED("COMPLETED"),
    SKIPPED("SKIPPED"),
}

object HousekeepingPolicy {
    fun allowedNextStatuses(currentStatus: String): List<String> = when (currentStatus) {
        "PENDING" -> listOf("IN_PROGRESS", "SKIPPED")
        "IN_PROGRESS" -> listOf("COMPLETED", "SKIPPED")
        else -> emptyList()
    }

    fun filter(tasks: List<HousekeepingTaskDto>, filter: HousekeepingFilter): List<HousekeepingTaskDto> =
        filter.status?.let { status -> tasks.filter { it.status == status } } ?: tasks

    /** Nothing more for the person holding the phone to do about it. */
    fun isFinished(status: String): Boolean = status == "COMPLETED" || status == "SKIPPED"

    fun scopedPending(items: List<HousekeepingOutboxEntity>, tenantId: String, userId: String): Map<String, HousekeepingOutboxEntity> =
        items.filter { it.tenantId == tenantId && it.userId == userId }.associateBy { it.taskId }

    fun withPendingStatuses(tasks: List<HousekeepingTaskDto>, pending: Map<String, HousekeepingOutboxEntity>): List<HousekeepingTaskDto> =
        tasks.map { task -> pending[task.id]?.let { task.copy(status = it.targetStatus) } ?: task }
}
