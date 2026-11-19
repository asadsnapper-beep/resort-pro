package site.resortpro.android

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import retrofit2.Response
import site.resortpro.android.core.network.ApiEnvelope
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.LoginData
import site.resortpro.android.feature.auth.requireData

class AuthResponseTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun invalidCredentialsPreserveServerErrorAndStatus() {
        val body = """{"success":false,"error":"Invalid credentials","code":"INVALID_CREDENTIALS"}"""
        val response = Response.error<ApiEnvelope<LoginData>>(
            401, body.toResponseBody("application/json".toMediaType()),
        )
        try {
            response.requireData(json)
            fail("Expected ApiException")
        } catch (error: ApiException) {
            assertEquals(401, error.status)
            assertEquals("Invalid credentials", error.message)
            assertEquals("INVALID_CREDENTIALS", error.apiCode)
        }
    }

    @Test
    fun errorDataDoesNotRequireSuccessPayloadSerializer() {
        val body = """{"success":false,"error":"Denied","data":{"details":["reason"]},"extra":true}"""
        val response = Response.error<ApiEnvelope<LoginData>>(
            403, body.toResponseBody("application/json".toMediaType()),
        )
        try {
            response.requireData(json)
            fail("Expected ApiException")
        } catch (error: ApiException) {
            assertEquals(403, error.status)
            assertEquals("Denied", error.message)
            assertEquals(null, error.apiCode)
        }
    }

    @Test
    fun malformedErrorBodyUsesFallback() {
        val response = Response.error<ApiEnvelope<LoginData>>(
            502, "not json".toResponseBody("text/plain".toMediaType()),
        )
        try {
            response.requireData(json)
            fail("Expected ApiException")
        } catch (error: ApiException) {
            assertEquals(502, error.status)
            assertEquals("Request failed. Please try again.", error.message)
        }
    }

    @Test
    fun successfulResponseReturnsItsData() {
        val response = Response.success(ApiEnvelope(success = true, data = "ok"))
        assertEquals("ok", response.requireData(json))
    }

    @Test
    fun successfulResponseWithoutDataFailsClearly() {
        val response = Response.success(ApiEnvelope<String>(success = true))
        try {
            response.requireData(json)
            fail("Expected ApiException")
        } catch (error: ApiException) {
            assertEquals("ResortPro returned an empty response.", error.message)
        }
    }
}
