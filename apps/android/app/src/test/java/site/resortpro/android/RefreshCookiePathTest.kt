package site.resortpro.android

import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The refresh cookie is scoped to `/api/auth` by the server. Anything that asks
 * "do we have a session to restore?" has to ask with a URL inside that path.
 *
 * Asking with the API's base URL — path `/` — can never match, and the check
 * silently answers "no session" every single time. That is not a subtle
 * degradation: it means session restore never runs and every launch demands a
 * full password login.
 */
class RefreshCookiePathTest {
    private val cookie = Cookie.Builder()
        .name("rp_refresh")
        .value("token")
        .hostOnlyDomain("resortpro-api.webcoronet.com")
        .path("/api/auth")
        .expiresAt(Long.MAX_VALUE)
        .build()

    @Test
    fun `base url does not match a cookie scoped to api auth`() {
        assertFalse(cookie.matches("https://resortpro-api.webcoronet.com/".toHttpUrl()))
    }

    @Test
    fun `the refresh endpoint does match`() {
        assertTrue(cookie.matches("https://resortpro-api.webcoronet.com/api/auth/refresh".toHttpUrl()))
    }
}
