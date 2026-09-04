package site.resortpro.android.feature.auth

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import retrofit2.Response
import site.resortpro.android.core.network.ApiEnvelope
import site.resortpro.android.core.network.ApiException
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.core.network.DashboardData
import site.resortpro.android.core.network.LoginData
import site.resortpro.android.core.network.LoginRequest
import site.resortpro.android.core.network.NetworkUnavailableException
import site.resortpro.android.core.network.RefreshCoordinator
import site.resortpro.android.core.network.ShareholderSummary
import site.resortpro.android.core.network.TenantDto
import site.resortpro.android.core.network.UserDto
import site.resortpro.android.core.security.SecureRefreshCookieJar
import site.resortpro.android.core.security.SessionStore
import site.resortpro.android.core.database.CacheDao
import site.resortpro.android.core.database.CacheEntryEntity
import site.resortpro.android.core.database.cacheKey

data class AuthenticatedSession(
    val user: UserDto,
    val tenant: TenantDto? = null,
)

sealed interface HomeContent {
    data class Operations(
        val dashboard: DashboardData,
        val showFinancials: Boolean,
    ) : HomeContent

    data class Investment(val summary: ShareholderSummary) : HomeContent

    data class Limited(val message: String) : HomeContent
}

data class HomeLoadResult(
    val content: HomeContent,
    val syncedAt: Long? = null,
    val fromCache: Boolean = false,
)

private data class CachedValue<T>(val value: T, val syncedAt: Long, val fromCache: Boolean)

enum class HomeKind {
    OPERATIONS_WITH_FINANCIALS,
    FRONT_DESK,
    STAFF,
    SHAREHOLDER,
    LIMITED,
}

object RolePolicy {
    fun homeKind(role: String): HomeKind = when (role) {
        "OWNER", "MANAGER" -> HomeKind.OPERATIONS_WITH_FINANCIALS
        "RECEPTIONIST" -> HomeKind.FRONT_DESK
        "STAFF" -> HomeKind.STAFF
        "SHAREHOLDER" -> HomeKind.SHAREHOLDER
        else -> HomeKind.LIMITED
    }

    fun canViewRooms(role: String): Boolean = role in setOf("OWNER", "MANAGER", "RECEPTIONIST")

    fun canViewHousekeeping(role: String): Boolean =
        role in setOf("OWNER", "MANAGER", "RECEPTIONIST", "STAFF")

    fun canCreateWalkIn(role: String): Boolean =
        role in setOf("OWNER", "MANAGER", "RECEPTIONIST")
}

class AuthRepository(
    private val api: AuthApi,
    private val baseUrl: HttpUrl,
    private val json: Json,
    private val sessionStore: SessionStore,
    private val cookieJar: SecureRefreshCookieJar,
    private val refreshCoordinator: RefreshCoordinator,
    private val cacheDao: CacheDao,
) {
    suspend fun login(email: String, password: String, slug: String): AuthenticatedSession {
        val response = networkCall {
            api.login(LoginRequest(email = email, password = password, slug = slug))
        }
        val data: LoginData = response.requireData()
        sessionStore.setAccessToken(data.token)
        return AuthenticatedSession(user = data.user, tenant = data.tenant)
    }

    suspend fun restoreSession(): AuthenticatedSession? = withContext(Dispatchers.IO) {
        if (!cookieJar.hasRefreshCookie(baseUrl)) return@withContext null
        val refreshed = refreshCoordinator.refreshToken(failedToken = null)
            ?: return@withContext null
        sessionStore.setAccessToken(refreshed)

        try {
            val response = api.me()
            AuthenticatedSession(user = response.requireData())
        } catch (_: IOException) {
            // Keep the encrypted refresh cookie. A temporary offline state must
            // not destroy an otherwise valid session.
            null
        } catch (error: ApiException) {
            if (error.status in setOf(400, 401, 403)) refreshCoordinator.clearSession()
            null
        }
    }

    suspend fun loadHome(role: String, tenantId: String): HomeLoadResult = when (RolePolicy.homeKind(role)) {
        HomeKind.OPERATIONS_WITH_FINANCIALS, HomeKind.FRONT_DESK -> {
            val cached = loadCached<DashboardData>(cacheKey("dashboard", tenantId)) {
                networkCall(api::dashboard).requireData()
            }
            HomeLoadResult(
                content = HomeContent.Operations(
                    dashboard = cached.value,
                    showFinancials = RolePolicy.homeKind(role) == HomeKind.OPERATIONS_WITH_FINANCIALS,
                ),
                syncedAt = cached.syncedAt,
                fromCache = cached.fromCache,
            )
        }
        HomeKind.SHAREHOLDER -> {
            val cached = loadCached<ShareholderSummary>(cacheKey("shareholder-summary", tenantId)) {
                networkCall(api::shareholderSummary).requireData()
            }
            HomeLoadResult(HomeContent.Investment(cached.value), cached.syncedAt, cached.fromCache)
        }
        HomeKind.STAFF -> HomeLoadResult(HomeContent.Limited(
            message = "Open Housekeeping to view and update your assigned tasks.",
        ))
        HomeKind.LIMITED -> HomeLoadResult(HomeContent.Limited(
            message = "This role does not have an Android dashboard yet.",
        ))
    }

    private suspend inline fun <reified T> loadCached(
        key: String,
        crossinline call: suspend () -> T,
    ): CachedValue<T> = try {
        val value = call()
        val syncedAt = System.currentTimeMillis()
        cacheDao.upsert(CacheEntryEntity(key, json.encodeToString(value), syncedAt))
        CachedValue(value, syncedAt, fromCache = false)
    } catch (error: NetworkUnavailableException) {
        val entry = cacheDao.get(key) ?: throw error
        val value = runCatching { json.decodeFromString<T>(entry.payload) }.getOrElse {
            cacheDao.delete(key)
            throw error
        }
        CachedValue(value, entry.syncedAt, fromCache = true)
    }

    suspend fun logout() {
        runCatching { networkCall(api::logout) }
        refreshCoordinator.clearSession()
    }

    fun clearLocalSession() {
        refreshCoordinator.clearSession()
    }

    private suspend fun <T> networkCall(call: suspend () -> Response<ApiEnvelope<T>>): Response<ApiEnvelope<T>> {
        return try {
            call()
        } catch (error: IOException) {
            throw NetworkUnavailableException(error)
        }
    }

    private fun <T> Response<ApiEnvelope<T>>.requireData(): T {
        if (isSuccessful) {
            return body()?.data
                ?: throw ApiException(code(), null, "ResortPro returned an empty response.")
        }

        val errorEnvelope = errorBody()?.string()?.let { body ->
            runCatching { json.decodeFromString<ApiEnvelope<T>>(body) }.getOrNull()
        }
        throw ApiException(
            status = code(),
            apiCode = errorEnvelope?.code,
            message = errorEnvelope?.error ?: "Request failed. Please try again.",
        )
    }
}
