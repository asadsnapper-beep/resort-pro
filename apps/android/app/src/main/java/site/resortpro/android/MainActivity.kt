package site.resortpro.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModelProvider
import site.resortpro.android.feature.auth.AuthViewModel
import site.resortpro.android.ui.ResortProApp
import site.resortpro.android.ui.theme.ResortProTheme

class MainActivity : ComponentActivity() {
    private val authViewModel: AuthViewModel by lazy {
        val container = (application as ResortProApplication).container
        ViewModelProvider(
            this,
            AuthViewModel.Factory(container.authRepository),
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
                )
            }
        }
    }
}
