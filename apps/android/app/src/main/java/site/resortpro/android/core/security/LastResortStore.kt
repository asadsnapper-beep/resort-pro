package site.resortpro.android.core.security

import android.content.Context
import androidx.core.content.edit

/**
 * Remembers which resort was last signed into, so it does not have to be typed
 * again on every launch.
 *
 * Staff sign in on their own phones, day after day, to the same resort. Making
 * a housekeeper type "coral-bay-resort" before every shift is friction with no
 * purpose — the slug is not a secret, it appears in the resort's own public
 * URL.
 *
 * Deliberately separate from [SecureRefreshCookieJar]: that holds a credential
 * and is encrypted with a Keystore key. This holds a public identifier, and
 * mixing the two would mean either encrypting something that does not need it
 * or storing a secret somewhere that does not protect it. The email is
 * remembered on the same terms; the password never is.
 */
class LastResortStore(context: Context) {
    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun lastSlug(): String = preferences.getString(KEY_SLUG, null).orEmpty()

    fun lastEmail(): String = preferences.getString(KEY_EMAIL, null).orEmpty()

    fun remember(slug: String, email: String) {
        preferences.edit {
            putString(KEY_SLUG, slug.trim().lowercase())
            putString(KEY_EMAIL, email.trim())
        }
    }

    /**
     * Cleared on sign-out only when the person asks to be forgotten. A plain
     * sign-out keeps the slug, because the usual reason to sign out is to hand
     * the phone to a colleague at the same resort.
     */
    fun forget() {
        preferences.edit { clear() }
    }

    private companion object {
        const val PREFERENCES_NAME = "resortpro_last_resort"
        const val KEY_SLUG = "slug"
        const val KEY_EMAIL = "email"
    }
}
