package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import site.resortpro.android.core.network.HousekeepingTaskDto
import site.resortpro.android.feature.housekeeping.HousekeepingFilter
import site.resortpro.android.feature.housekeeping.HousekeepingPolicy

class HousekeepingPolicyTest {
    @Test
    fun pendingTaskCanStartOrSkip() {
        assertEquals(
            listOf("IN_PROGRESS", "SKIPPED"),
            HousekeepingPolicy.allowedNextStatuses("PENDING"),
        )
    }

    @Test
    fun inProgressTaskCanCompleteOrSkip() {
        assertEquals(
            listOf("COMPLETED", "SKIPPED"),
            HousekeepingPolicy.allowedNextStatuses("IN_PROGRESS"),
        )
    }

    @Test
    fun terminalTasksExposeNoActions() {
        assertTrue(HousekeepingPolicy.allowedNextStatuses("COMPLETED").isEmpty())
        assertTrue(HousekeepingPolicy.allowedNextStatuses("SKIPPED").isEmpty())
    }

    @Test
    fun filterReturnsOnlyMatchingStatus() {
        val tasks = listOf(task("one", "PENDING"), task("two", "COMPLETED"))
        assertEquals(
            listOf("two"),
            HousekeepingPolicy.filter(tasks, HousekeepingFilter.COMPLETED).map { it.id },
        )
        assertEquals(tasks, HousekeepingPolicy.filter(tasks, HousekeepingFilter.ALL))
    }

    private fun task(id: String, status: String) = HousekeepingTaskDto(
        id = id,
        roomId = "room-$id",
        type = "DAILY",
        status = status,
        scheduledDate = "2026-08-29",
    )
}
