package site.resortpro.android

import android.app.Application
import site.resortpro.android.core.AppContainer

class ResortProApplication : Application() {
    val container: AppContainer by lazy {
        AppContainer(applicationContext)
    }
}
