package site.resortpro.android.core.network

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import site.resortpro.android.core.security.SecureRefreshCookieJar
import site.resortpro.android.core.security.SessionStore

class AuthHeaderInterceptor(
    private val sessionStore: SessionStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = sessionStore.accessToken()
        val request = if (token == null) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        }
        return chain.proceed(request)
    }
}

class SessionAuthenticator(
    private val sessionStore: SessionStore,
    private val refreshCoordinator: RefreshCoordinator,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        val failedHeader = response.request.header("Authorization") ?: return null
        if (responseCount(response) >= 2) return null

        val failedToken = failedHeader.removePrefix("Bearer ")
        val token = synchronized(refreshCoordinator) {
            sessionStore.accessToken()
                ?.takeIf { it != failedToken }
                ?: refreshCoordinator.refreshToken(failedToken)
        } ?: return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var current = response.priorResponse
        while (current != null) {
            count += 1
            current = current.priorResponse
        }
        return count
    }
}

class RefreshCoordinator(
    private val client: OkHttpClient,
    private val baseUrl: HttpUrl,
    private val json: Json,
    private val sessionStore: SessionStore,
    private val cookieJar: SecureRefreshCookieJar,
) {
    @Synchronized
    fun refreshToken(failedToken: String?): String? {
        val currentToken = sessionStore.accessToken()
        if (currentToken != null && failedToken != null && currentToken != failedToken) {
            return currentToken
        }
        if (!cookieJar.hasRefreshCookie(baseUrl)) return null

        val refreshUrl = baseUrl.resolve("api/auth/refresh") ?: return null
        val request = Request.Builder()
            .url(refreshUrl)
            .post("{}".toRequestBody("application/json".toMediaType()))
            .build()

        return runCatching {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    if (response.code in setOf(400, 401, 403)) clearSession()
                    return null
                }
                val body = response.body.string()
                val envelope = json.decodeFromString<ApiEnvelope<RefreshData>>(body)
                envelope.data?.token?.also(sessionStore::setAccessToken)
            }
        }.getOrElse {
            null
        }
    }

    fun clearSession() {
        sessionStore.clear()
        cookieJar.clear()
    }
}
