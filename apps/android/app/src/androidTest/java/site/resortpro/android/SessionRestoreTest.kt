package site.resortpro.android

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import site.resortpro.android.core.database.CacheDao
import site.resortpro.android.core.database.CacheEntryEntity
import site.resortpro.android.core.network.*
import site.resortpro.android.core.security.SecureRefreshCookieJar
import site.resortpro.android.core.security.SessionStore
import site.resortpro.android.feature.auth.AuthRepository
import site.resortpro.android.feature.auth.SessionRestoreResult

@RunWith(AndroidJUnit4::class)
class SessionRestoreTest {
    @Test fun temporaryFailurePreservesSessionAndRetryRestores() = runBlocking {
        val server = MockWebServer(); server.start()
        val json = Json { ignoreUnknownKeys = true }
        val jar = SecureRefreshCookieJar(ApplicationProvider.getApplicationContext(), json)
        val url = server.url("/")
        jar.saveFromResponse(url, listOf(Cookie.Builder().name("rp_refresh").value("synthetic").hostOnlyDomain(url.host).path("/api/auth").expiresAt(System.currentTimeMillis() + 60_000).build()))
        try {
            val store = SessionStore()
            val client = OkHttpClient.Builder().cookieJar(jar).build()
            val refresh = RefreshCoordinator(client, url, json, store, jar)
            val api = Retrofit.Builder().baseUrl(url).client(client).addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build().create(AuthApi::class.java)
            val cache = object : CacheDao {
                override suspend fun get(cacheKey: String): CacheEntryEntity? = null
                override suspend fun upsert(entry: CacheEntryEntity) = Unit
                override suspend fun delete(cacheKey: String) = Unit
                override suspend fun clearAll() = Unit
            }
            val repository = AuthRepository(api, url, json, store, jar, refresh, cache)
            server.enqueue(MockResponse().setResponseCode(503))
            assertEquals(SessionRestoreResult.RetryRequired, repository.restoreSession())
            assertTrue(jar.hasRefreshCookie(url))
            server.enqueue(MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody("""{"success":true,"data":{"token":"temporary-test-token"}}"""))
            server.enqueue(MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody("""{"success":true,"data":{"id":"u1","email":"demo@example.com","firstName":"Demo","lastName":"User","role":"OWNER","tenantId":"t1"}}"""))
            assertTrue(repository.restoreSession() is SessionRestoreResult.Restored)
            server.enqueue(MockResponse().setResponseCode(401))
            assertEquals(SessionRestoreResult.NoSession, repository.restoreSession())
            assertFalse(jar.hasRefreshCookie(url))
        } finally { jar.clear(); server.shutdown() }
    }
}
