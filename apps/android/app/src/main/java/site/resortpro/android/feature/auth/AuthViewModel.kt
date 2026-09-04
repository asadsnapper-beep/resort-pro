package site.resortpro.android.feature.auth

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.security.AppLock
import site.resortpro.android.core.security.LastResortStore

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
    /** A restored session held back until the device unlock is satisfied. */
    val lockedSession: AuthenticatedSession? = null,
    /** Whether the system prompt should be showing right now. */
    val lockPromptPending: Boolean = false,
    /** Offered once, after a password sign-in, when the device can do it. */
    val offerAppLock: Boolean = false,
    val home: HomeContent? = null,
    val isHomeLoading: Boolean = false,
    val homeError: String? = null,
    val homeSyncedAt: Long? = null,
    val homeFromCache: Boolean = false,
)

class AuthViewModel(
    private val repository: AuthRepository,
    private val lastResort: LastResortStore,
    private val appLock: AppLock,
) : ViewModel() {
    // Prefilled before the first frame, so the fields are never briefly empty
    // and then filled in underneath someone who has already started typing.
    private var backgroundedAt: Long? = null

    private val mutableState = MutableStateFlow(
        AuthUiState(slug = lastResort.lastSlug(), email = lastResort.lastEmail()),
    )
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
                // Remembered only after the server accepted them, so a typo is
                // never what greets the next launch.
                lastResort.remember(slug = current.slug.trim(), email = current.email.trim())
                mutableState.update {
                    it.copy(
                        isSubmitting = false,
                        password = "",
                        session = session,
                        offerAppLock = appLock.isAvailable() && !appLock.isEnabled(),
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
            // The slug and email survive a sign-out: the usual reason to sign
            // out is to hand the phone to a colleague at the same resort.
            mutableState.value = AuthUiState(
                isRestoring = false,
                slug = lastResort.lastSlug(),
                email = lastResort.lastEmail(),
            )
        }
    }

    private fun restoreSession() {
        viewModelScope.launch {
            val session = repository.restoreSession()
            // A password was typed once, days ago. If the resort turned the lock
            // on, prove it is still the same person before showing anything.
            if (session != null && appLock.isEnabled()) {
                mutableState.update {
                    it.copy(isRestoring = false, lockedSession = session, lockPromptPending = true)
                }
                return@launch
            }
            mutableState.update { it.copy(isRestoring = false, session = session) }
            if (session != null) loadHome(session)
        }
    }

    /**
     * Re-arms the lock when the app is put away.
     *
     * Locking only on a cold start is not what "app lock" means to anyone: press
     * home, reopen, and you were straight back in. The clock is monotonic so a
     * changed device time cannot skip the lock.
     */
    fun onBackgrounded() {
        backgroundedAt = SystemClock.elapsedRealtime()
    }

    /**
     * Locks again if the app was away long enough.
     *
     * The grace period is deliberate. Staff step out of the app constantly —
     * to the camera to photograph a damaged fitting, to the dialler to call a
     * guest back — and demanding a fingerprint every time they return would
     * get the lock switched off within a day. A minute is long enough to be
     * unobtrusive and short enough that a phone left on a counter is covered.
     */
    fun onForegrounded() {
        val awaySince = backgroundedAt ?: return
        backgroundedAt = null
        val session = mutableState.value.session ?: return
        if (!appLock.isEnabled()) return
        if (SystemClock.elapsedRealtime() - awaySince < LOCK_GRACE_MILLIS) return
        mutableState.update { it.copy(session = null, lockedSession = session, lockPromptPending = true) }
    }

    /** The device unlock succeeded — release the session that was held back. */
    fun unlocked() {
        val session = mutableState.value.lockedSession ?: return
        mutableState.update { it.copy(lockedSession = null, lockPromptPending = false, session = session) }
        loadHome(session)
    }

    /**
     * Cancelled, dismissed or locked out. Stays locked and offers to try again.
     *
     * Deliberately not a sign-out. A dismissed prompt is almost always a
     * fumble — a stray back press, a pocket — not an intruder, and making
     * someone retype a password for it is a punishment for dropping their
     * phone. Nothing is revealed either way: the session stays held back until
     * an unlock actually succeeds.
     */
    fun lockRefused() {
        mutableState.update { it.copy(lockPromptPending = false) }
    }

    /** Raise the prompt again after a refusal. */
    fun retryUnlock() {
        mutableState.update { it.copy(lockPromptPending = true) }
    }

    /** Chosen on purpose from the locked screen — this one really does sign out. */
    fun signOutFromLock() {
        viewModelScope.launch {
            repository.logout()
            mutableState.value = AuthUiState(
                isRestoring = false,
                slug = lastResort.lastSlug(),
                email = lastResort.lastEmail(),
            )
        }
    }

    fun enableAppLock() {
        appLock.enable()
        mutableState.update { it.copy(offerAppLock = false) }
    }

    fun declineAppLock() {
        mutableState.update { it.copy(offerAppLock = false) }
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

    private companion object {
        const val LOCK_GRACE_MILLIS = 60_000L
    }

    class Factory(
        private val repository: AuthRepository,
        private val lastResort: LastResortStore,
        private val appLock: AppLock,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AuthViewModel::class.java))
            return AuthViewModel(repository, lastResort, appLock) as T
        }
    }
}
