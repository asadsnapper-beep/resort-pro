package site.resortpro.android.core.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.edit
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Guards the silent session restore behind the device's own unlock.
 *
 * The refresh cookie keeps someone signed in for a week without a password.
 * That is the right behaviour — staff should not retype a password before every
 * shift — but it means anyone who picks up an unlocked phone has a week of
 * access to a resort's guests, bookings and money.
 *
 * So the lock sits on *resuming* a session, not on signing in. Signing in
 * already proves who you are. This proves it is still the same person a day
 * later.
 *
 * `DEVICE_CREDENTIAL` is accepted alongside a fingerprint on purpose: a
 * housekeeper with wet or gloved hands must still be able to get in with the
 * PIN she already uses to unlock the phone. Refusing that would mean staff
 * turning the lock off entirely.
 */
class AppLock(context: Context) {
    private val biometricManager = BiometricManager.from(context)
    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    /** Whether this device can ask for anything at all. */
    fun isAvailable(): Boolean =
        biometricManager.canAuthenticate(ALLOWED) == BiometricManager.BIOMETRIC_SUCCESS

    /** Off until someone turns it on — see [enable]. */
    fun isEnabled(): Boolean = preferences.getBoolean(KEY_ENABLED, false) && isAvailable()

    fun enable() = preferences.edit { putBoolean(KEY_ENABLED, true) }

    fun disable() = preferences.edit { putBoolean(KEY_ENABLED, false) }

    /**
     * Asks, and answers true only on an explicit success.
     *
     * A cancel, a lockout or an error is a refusal. Nothing here decides what
     * to do about that — the caller does, because the right answer differs
     * between "resuming a session" and "opening the settings screen".
     */
    suspend fun authenticate(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
    ): Boolean = suspendCancellableCoroutine { continuation ->
        val prompt = BiometricPrompt(
            activity,
            androidx.core.content.ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (continuation.isActive) continuation.resume(true)
                }

                override fun onAuthenticationError(code: Int, message: CharSequence) {
                    // Includes the user pressing cancel and the too-many-attempts
                    // lockout. Both mean "not now", not "try again forever".
                    if (continuation.isActive) continuation.resume(false)
                }

                // onAuthenticationFailed is a single bad finger, not a refusal —
                // the prompt stays up and the person tries again. Deliberately
                // not resumed here.
            },
        )

        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(ALLOWED)
            .build()

        prompt.authenticate(info)
        continuation.invokeOnCancellation { prompt.cancelAuthentication() }
    }

    private companion object {
        const val PREFERENCES_NAME = "resortpro_app_lock"
        const val KEY_ENABLED = "enabled"

        // BIOMETRIC_WEAK rather than STRONG: nothing here is unlocked by the
        // Keystore, so a class-3 sensor is not required, and insisting on it
        // would exclude a lot of the mid-range phones staff actually carry.
        const val ALLOWED = BIOMETRIC_WEAK or DEVICE_CREDENTIAL
    }
}
