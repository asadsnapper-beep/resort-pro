package site.resortpro.android.feature.guests

import androidx.annotation.StringRes
import site.resortpro.android.R
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.NetworkUnavailableException

/**
 * Why a guest or booking screen has nothing to show.
 *
 * The screens' own copy already comes from strings.xml, so a Bangla user sees
 * Bangla — right up until something fails, at which point a prose message built
 * in Kotlin took over and the text reverted to English. Carrying a resource id
 * instead means values-bn applies to the failure as well.
 *
 * Only the server's own `error` text stays untranslated, because it arrives as
 * a finished English sentence and there is nothing on this side to key off.
 */
sealed interface GuestError {
    /** A condition this app recognises, so it can be said in the user's language. */
    data class Known(@StringRes val message: Int) : GuestError

    /** Text the API sent. English, and not translatable here. */
    data class FromServer(val message: String) : GuestError
}

/**
 * The HTTP status is the single source of truth for what went wrong — the
 * repository deliberately no longer phrases it, so there is one mapping rather
 * than prose in one layer and a decision in another.
 *
 * `fallback` is what to say when the status carries no specific meaning and the
 * server offered no text of its own; it differs per call site, which is why it
 * is a parameter rather than one generic string.
 */
fun Throwable.toGuestError(@StringRes fallback: Int): GuestError = when (this) {
    is NetworkUnavailableException -> GuestError.Known(R.string.guest_error_offline)
    is ApiException -> when (status) {
        401 -> GuestError.Known(R.string.guest_error_signed_out)
        403 -> GuestError.Known(R.string.guest_error_forbidden)
        404 -> GuestError.Known(R.string.guest_error_missing)
        409 -> GuestError.Known(R.string.guest_error_mismatch)
        422 -> GuestError.Known(R.string.guest_error_incomplete)
        else -> message.takeIf { it.isNotBlank() }
            ?.let { GuestError.FromServer(it) }
            ?: GuestError.Known(fallback)
    }
    else -> GuestError.Known(fallback)
}
