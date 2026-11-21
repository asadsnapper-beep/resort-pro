package site.resortpro.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.feature.guests.GuestsRepository

@RunWith(AndroidJUnit4::class)
class GuestsRepositoryTest {
    @Test fun searchAndDetailsUseExpectedEndpointsAndRejectDeniedAccess() = runBlocking {
        val server = MockWebServer()
        server.start()
        try {
            val json = Json { ignoreUnknownKeys = true }
            val api = Retrofit.Builder().baseUrl(server.url("/"))
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build().create(AuthApi::class.java)
            val repository = GuestsRepository(api)
            server.enqueue(MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody("""{"success":true,"data":[{"id":"g1","firstName":"Demo","lastName":"Guest","phone":"123"}],"pagination":{"page":2,"limit":20,"total":21,"totalPages":2}}"""))
            val results = repository.search("Demo Guest", 2)
            assertEquals("g1", results.guests.single().id)
            assertEquals(2, results.page)
            val searchRequest = server.takeRequest()
            assertEquals("POST", searchRequest.method)
            assertEquals("/api/mobile/guests/search", searchRequest.path)
            assertTrue(searchRequest.body.readUtf8().contains("Demo Guest"))
            server.enqueue(MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody("""{"success":true,"data":{"id":"g1","firstName":"Demo","lastName":"Guest","bookings":[]}}"""))
            assertEquals("g1", repository.details("g1").id)
            assertEquals("/api/mobile/guests/g1", server.takeRequest().path)
            server.enqueue(MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody("""{"success":true,"data":{"id":"b1","confirmationNo":"DEMO-1","status":"CONFIRMED","checkIn":"2026-11-01","checkOut":"2026-11-02","adults":2,"children":0,"guest":{"firstName":"Demo","lastName":"Guest"},"room":{"number":"101","name":"Garden"}}}"""))
            val booking = repository.booking("b1")
            assertNull(booking.totalAmount)
            assertNull(booking.paidAmount)
            assertEquals("/api/mobile/bookings/b1", server.takeRequest().path)
            server.enqueue(MockResponse().setResponseCode(403))
            val denied = runCatching { repository.details("g1") }.exceptionOrNull()
            assertTrue(denied is ApiException && denied.status == 403)
        } finally { server.shutdown() }
    }
}
