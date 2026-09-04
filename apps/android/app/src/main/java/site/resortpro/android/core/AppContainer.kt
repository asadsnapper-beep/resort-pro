package site.resortpro.android.core

import android.content.Context
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.HttpUrl.Companion.toHttpUrl
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import site.resortpro.android.BuildConfig
import site.resortpro.android.core.network.AuthApi
import site.resortpro.android.core.network.AuthHeaderInterceptor
import site.resortpro.android.core.network.RefreshCoordinator
import site.resortpro.android.core.network.SessionAuthenticator
import site.resortpro.android.core.database.ResortProDatabase
import site.resortpro.android.core.security.LastResortStore
import site.resortpro.android.core.security.SecureRefreshCookieJar
import site.resortpro.android.core.security.SessionStore
import site.resortpro.android.feature.auth.AuthRepository
import site.resortpro.android.feature.rooms.RoomsRepository
import site.resortpro.android.feature.housekeeping.HousekeepingRepository
import site.resortpro.android.feature.housekeeping.HousekeepingSyncWorker
import site.resortpro.android.feature.walkin.WalkInRepository

class AppContainer(context: Context) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    private val sessionStore = SessionStore()
    private val cookieJar = SecureRefreshCookieJar(context, json)

    /** Which resort was last signed into — see LastResortStore for why it is separate. */
    val lastResortStore = LastResortStore(context)
    private val baseUrl = BuildConfig.API_BASE_URL.toHttpUrl()
    private val database = ResortProDatabase.create(context)

    private val refreshClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .build()

    private val refreshCoordinator = RefreshCoordinator(
        client = refreshClient,
        baseUrl = baseUrl,
        json = json,
        sessionStore = sessionStore,
        cookieJar = cookieJar,
    )

    private val authenticatedClient = refreshClient.newBuilder()
        .addInterceptor(AuthHeaderInterceptor(sessionStore))
        .authenticator(SessionAuthenticator(sessionStore, refreshCoordinator))
        .build()

    private val authApi = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(authenticatedClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(AuthApi::class.java)

    val authRepository = AuthRepository(
        api = authApi,
        baseUrl = baseUrl,
        json = json,
        sessionStore = sessionStore,
        cookieJar = cookieJar,
        refreshCoordinator = refreshCoordinator,
        cacheDao = database.cacheDao(),
    )

    val roomsRepository = RoomsRepository(
        api = authApi,
        json = json,
        cacheDao = database.cacheDao(),
    )

    val housekeepingRepository = HousekeepingRepository(
        api = authApi,
        json = json,
        cacheDao = database.cacheDao(),
        outboxDao = database.housekeepingOutboxDao(),
        scheduleOutbox = { HousekeepingSyncWorker.enqueue(context) },
    )

    val walkInRepository = WalkInRepository(
        api = authApi,
        json = json,
    )
}
