package site.resortpro.android

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import site.resortpro.android.core.network.AuthHeaderInterceptor
import site.resortpro.android.core.network.RefreshCoordinator
import site.resortpro.android.core.network.SessionAuthenticator
import site.resortpro.android.core.security.SecureRefreshCookieJar
import site.resortpro.android.core.security.SessionStore

@RunWith(AndroidJUnit4::class)
class AuthRefreshTest {
    private lateinit var server: MockWebServer

    @Before fun startServer() {
        server = MockWebServer()
        server.start()
    }

    @After fun stopServer() {
        server.shutdown()
    }

    @Test
    fun a401RefreshesOnceAndRetriesWithTheNewToken() {
        val resourceCalls = AtomicInteger()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when (request.path) {
                "/api/auth/refresh" -> MockResponse().setResponseCode(200)
                    .setBody("""{"success":true,"data":{"token":"new-token"}}""")
                "/protected" -> if (resourceCalls.incrementAndGet() == 1) {
                    MockResponse().setResponseCode(401)
                } else {
                    MockResponse().setResponseCode(200).setBody("ok")
                }
                else -> MockResponse().setResponseCode(404)
            }
        }

        val store = SessionStore().apply { setAccessToken("old-token") }
        val cookieJar = SecureRefreshCookieJar(ApplicationProvider.getApplicationContext(), Json)
        val baseUrl = server.url("/")
        cookieJar.saveFromResponse(
            baseUrl,
            listOf(Cookie.Builder().name("refreshToken").value("cookie").domain(baseUrl.host).path("/").build()),
        )
        val refresh = RefreshCoordinator(OkHttpClient.Builder().cookieJar(cookieJar).build(), baseUrl, Json, store, cookieJar)
        val client = OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .addInterceptor(AuthHeaderInterceptor(store))
            .authenticator(SessionAuthenticator(store, refresh))
            .build()

        client.newCall(Request.Builder().url(server.url("/protected")).build()).execute().use { response: Response ->
            assertEquals(200, response.code)
            assertEquals("ok", response.body.string())
        }
        assertEquals("new-token", store.accessToken())
        assertEquals(2, resourceCalls.get())
        assertEquals(3, server.requestCount)
    }
}
