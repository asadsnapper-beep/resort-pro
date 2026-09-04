package site.resortpro.android.feature.housekeeping

import site.resortpro.android.core.network.HousekeepingTaskDto

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
}
