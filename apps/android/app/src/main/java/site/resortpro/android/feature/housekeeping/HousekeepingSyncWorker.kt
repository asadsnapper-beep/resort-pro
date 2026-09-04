package site.resortpro.android.feature.housekeeping

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import site.resortpro.android.ResortProApplication

class HousekeepingSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext as ResortProApplication).container.housekeepingRepository
        return if (repository.flushOutbox()) Result.success() else Result.retry()
    }

    companion object {
        private const val UNIQUE_WORK = "housekeeping-status-outbox"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<HousekeepingSyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
