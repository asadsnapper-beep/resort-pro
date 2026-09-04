package site.resortpro.android.core.security

class SessionStore {
    @Volatile
    private var token: String? = null

    fun accessToken(): String? = token

    fun setAccessToken(value: String) {
        token = value
    }

    fun clear() {
        token = null
    }
}
