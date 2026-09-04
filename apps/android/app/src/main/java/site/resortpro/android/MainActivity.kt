package site.resortpro.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModelProvider
import site.resortpro.android.feature.auth.AuthViewModel
import site.resortpro.android.ui.ResortProApp
import site.resortpro.android.ui.theme.ResortProTheme

class MainActivity : FragmentActivity() {
    private val authViewModel: AuthViewModel by lazy {
        val container = (application as ResortProApplication).container
        ViewModelProvider(
            this,
            AuthViewModel.Factory(container.authRepository, container.lastResortStore, container.appLock),
        )[AuthViewModel::class.java]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ResortProTheme {
                ResortProApp(
                    viewModel = authViewModel,
                    container = (application as ResortProApplication).container,
                    activity = this,
                )
            }
        }
    }
}
