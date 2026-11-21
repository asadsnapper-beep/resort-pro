package site.resortpro.android

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Test
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.NetworkUnavailableException
import site.resortpro.android.feature.guests.GuestError
import site.resortpro.android.feature.guests.toGuestError

/**
 * The guest screens' failure text used to be built as prose in Kotlin, which no
 * amount of translation in values-bn could reach: a Bangla user saw Bangla
 * screens and English errors. These assert that every recognised condition
 * resolves to a string resource instead, because a regression here is silent —
 * the app still runs, it just quietly speaks the wrong language.
 */
class GuestErrorTest {
    private val fallback = R.string.guest_error_search

    private fun api(status: Int, message: String = "") =
        ApiException(status, null, message).toGuestError(fallback)

    @Test
    fun statusesTheAppRecognisesBecomeStringResources() {
        assertEquals(GuestError.Known(R.string.guest_error_signed_out), api(401))
        assertEquals(GuestError.Known(R.string.guest_error_forbidden), api(403))
        assertEquals(GuestError.Known(R.string.guest_error_missing), api(404))
        assertEquals(GuestError.Known(R.string.guest_error_mismatch), api(409))
        assertEquals(GuestError.Known(R.string.guest_error_incomplete), api(422))
    }

    @Test
    fun aMissingConnectionIsTranslatedRatherThanQuoted() {
        // NetworkUnavailableException carries its own English sentence, which is
        // exactly what must NOT reach the screen.
        val error = NetworkUnavailableException(IOException("socket closed")).toGuestError(fallback)
        assertEquals(GuestError.Known(R.string.guest_error_offline), error)
    }

    @Test
    fun anUnrecognisedStatusPrefersTheServersOwnWords() {
        assertEquals(GuestError.FromServer("Rate limit reached"), api(429, "Rate limit reached"))
    }

    @Test
    fun anUnrecognisedStatusWithNothingToQuoteFallsBackPerCallSite() {
        assertEquals(GuestError.Known(fallback), api(500))
        assertEquals(GuestError.Known(fallback), api(500, "   "))
        assertEquals(
            GuestError.Known(R.string.guest_error_load_booking),
            ApiException(500, null, "").toGuestError(R.string.guest_error_load_booking),
        )
    }

    @Test
    fun somethingThatIsNotAnApiFailureStillSaysSomethingTranslatable() {
        assertEquals(GuestError.Known(fallback), IllegalStateException("boom").toGuestError(fallback))
    }
}
