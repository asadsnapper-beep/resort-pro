package site.resortpro.android.core.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import site.resortpro.android.core.network.CookieRecord

class SecureRefreshCookieJar(
    context: Context,
    private val json: Json,
) : CookieJar {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val lock = Any()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val refreshCookie = cookies.lastOrNull { it.name == REFRESH_COOKIE_NAME } ?: return
        synchronized(lock) {
            if (refreshCookie.expiresAt <= System.currentTimeMillis() || refreshCookie.value.isEmpty()) {
                clearLocked()
                return
            }
            val record = CookieRecord(
                name = refreshCookie.name,
                value = refreshCookie.value,
                domain = refreshCookie.domain,
                path = refreshCookie.path,
                expiresAt = refreshCookie.expiresAt,
                secure = refreshCookie.secure,
                httpOnly = refreshCookie.httpOnly,
                hostOnly = refreshCookie.hostOnly,
            )
            val encrypted = encrypt(json.encodeToString(record))
            preferences.edit { putString(COOKIE_KEY, encrypted) }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> = synchronized(lock) {
        val cookie = readCookieLocked() ?: return@synchronized emptyList()
        if (cookie.expiresAt <= System.currentTimeMillis()) {
            clearLocked()
            return@synchronized emptyList()
        }
        if (cookie.matches(url)) listOf(cookie) else emptyList()
    }

    /**
     * Is there a session to resume?
     *
     * Takes the API's base URL and resolves the refresh endpoint itself, rather
     * than trusting the caller to pass a URL inside the cookie's path. The
     * server scopes this cookie to `/api/auth`, and a cookie only matches a
     * request whose path sits under its own — "/" never does. Both callers
     * asked with the base URL, so this answered "no session" every time:
     * restore never ran, and a 401 could never be refreshed either. See
     * RefreshCookiePathTest.
     */
    fun hasRefreshCookie(baseUrl: HttpUrl): Boolean {
        val refreshUrl = baseUrl.resolve(REFRESH_PATH) ?: return false
        return loadForRequest(refreshUrl).any { it.name == REFRESH_COOKIE_NAME }
    }

    fun clear() = synchronized(lock) {
        clearLocked()
    }

    private fun readCookieLocked(): Cookie? {
        val encrypted = preferences.getString(COOKIE_KEY, null) ?: return null
        return runCatching {
            val record = json.decodeFromString<CookieRecord>(decrypt(encrypted))
            Cookie.Builder()
                .name(record.name)
                .value(record.value)
                .path(record.path)
                .expiresAt(record.expiresAt)
                .apply {
                    if (record.hostOnly) hostOnlyDomain(record.domain) else domain(record.domain)
                    if (record.secure) secure()
                    if (record.httpOnly) httpOnly()
                }
                .build()
        }.getOrElse {
            clearLocked()
            null
        }
    }

    private fun clearLocked() {
        preferences.edit { remove(COOKIE_KEY) }
    }

    private fun encrypt(plainText: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val payload = cipher.iv + encrypted
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(payload: String): String {
        val bytes = Base64.decode(payload, Base64.NO_WRAP)
        require(bytes.size > IV_SIZE_BYTES)
        val iv = bytes.copyOfRange(0, IV_SIZE_BYTES)
        val encrypted = bytes.copyOfRange(IV_SIZE_BYTES, bytes.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
        return cipher.doFinal(encrypted).toString(Charsets.UTF_8)
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER).run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        const val PREFERENCES_NAME = "resortpro_secure_session"
        const val COOKIE_KEY = "encrypted_refresh_cookie"
        const val REFRESH_COOKIE_NAME = "rp_refresh"
        const val REFRESH_PATH = "api/auth/refresh"
        const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        const val KEY_ALIAS = "resortpro_refresh_cookie_key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE_BYTES = 12
        const val GCM_TAG_BITS = 128
    }
}
