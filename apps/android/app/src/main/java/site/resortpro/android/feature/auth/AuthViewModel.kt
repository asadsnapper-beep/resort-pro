package site.resortpro.android.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.ApiException

data class AuthUiState(
    val isRestoring: Boolean = true,
    val isSubmitting: Boolean = false,
    val slug: String = "",
    val email: String = "",
    val password: String = "",
    val passwordVisible: Boolean = false,
    val validation: LoginValidation = LoginValidation(),
    val errorMessage: String? = null,
    val verificationRequired: Boolean = false,
    val session: AuthenticatedSession? = null,
    val home: HomeContent? = null,
    val isHomeLoading: Boolean = false,
    val homeError: String? = null,
    val homeSyncedAt: Long? = null,
    val homeFromCache: Boolean = false,
)

class AuthViewModel(
    private val repository: AuthRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = mutableState.asStateFlow()

    init {
        restoreSession()
    }

    fun updateSlug(value: String) {
        mutableState.update {
            it.copy(slug = value.lowercase(), validation = it.validation.copy(slugError = null), errorMessage = null)
        }
    }

    fun updateEmail(value: String) {
        mutableState.update {
            it.copy(email = value, validation = it.validation.copy(emailError = null), errorMessage = null)
        }
    }

    fun updatePassword(value: String) {
        mutableState.update {
            it.copy(password = value, validation = it.validation.copy(passwordError = null), errorMessage = null)
        }
    }

    fun togglePasswordVisibility() {
        mutableState.update { it.copy(passwordVisible = !it.passwordVisible) }
    }

    fun submitLogin() {
        val current = mutableState.value
        val validation = LoginValidator.validate(current.slug, current.email, current.password)
        if (!validation.isValid) {
            mutableState.update { it.copy(validation = validation) }
            return
        }

        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    isSubmitting = true,
                    errorMessage = null,
                    verificationRequired = false,
                    validation = validation,
                )
            }
            runCatching {
                repository.login(
                    email = current.email.trim(),
                    password = current.password,
                    slug = current.slug.trim(),
                )
            }.onSuccess { session ->
                mutableState.update {
                    it.copy(
                        isSubmitting = false,
                        password = "",
                        session = session,
                    )
                }
                loadHome(session)
            }.onFailure(::showAuthError)
        }
    }

    fun retryHome() {
        mutableState.value.session?.let(::loadHome)
    }

    fun logout() {
        viewModelScope.launch {
            mutableState.update { it.copy(isSubmitting = true) }
            repository.logout()
            mutableState.value = AuthUiState(isRestoring = false)
        }
    }

    private fun restoreSession() {
        viewModelScope.launch {
            val session = repository.restoreSession()
            mutableState.update { it.copy(isRestoring = false, session = session) }
            if (session != null) loadHome(session)
        }
    }

    private fun loadHome(session: AuthenticatedSession) {
        viewModelScope.launch {
            mutableState.update { it.copy(isHomeLoading = true, homeError = null) }
            val tenantId = session.user.tenantId ?: session.tenant?.id
            if (tenantId == null) {
                mutableState.update { it.copy(isHomeLoading = false, homeError = "This session has no resort assigned.") }
                return@launch
            }
            runCatching { repository.loadHome(session.user.role, tenantId) }
                .onSuccess { result ->
                    mutableState.update {
                        it.copy(
                            isHomeLoading = false,
                            home = result.content,
                            homeSyncedAt = result.syncedAt,
                            homeFromCache = result.fromCache,
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            isHomeLoading = false,
                            homeError = error.message ?: "Could not load your dashboard.",
                        )
                    }
                }
        }
    }

    private fun showAuthError(error: Throwable) {
        val apiError = error as? ApiException
        mutableState.update {
            it.copy(
                isSubmitting = false,
                verificationRequired = apiError?.apiCode == "EMAIL_VERIFICATION_REQUIRED",
                errorMessage = error.message ?: "Sign in failed. Please try again.",
            )
        }
    }

    class Factory(
        private val repository: AuthRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AuthViewModel::class.java))
            return AuthViewModel(repository) as T
        }
    }
}
