package site.resortpro.android

import android.app.Application
import site.resortpro.android.core.AppContainer
import site.resortpro.android.core.media.purgeAbandonedDocumentCaptures

class ResortProApplication : Application() {
    val container: AppContainer by lazy {
        AppContainer(applicationContext)
    }

    override fun onCreate() {
        super.onCreate()
        // A guest document photographed and then abandoned — the walk-in
        // cancelled, the app closed mid-form — has nothing left referring to
        // it once the process dies. Cleared here rather than left to sit in
        // the cache until Android happens to reclaim it.
        purgeAbandonedDocumentCaptures()
    }
}
