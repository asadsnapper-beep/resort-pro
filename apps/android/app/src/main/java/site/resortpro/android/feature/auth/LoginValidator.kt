package site.resortpro.android.feature.auth

data class LoginValidation(
    val slugError: String? = null,
    val emailError: String? = null,
    val passwordError: String? = null,
) {
    val isValid: Boolean
        get() = slugError == null && emailError == null && passwordError == null
}

object LoginValidator {
    private val slugPattern = Regex("^[a-z0-9-]+$")
    private val emailPattern = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun validate(slug: String, email: String, password: String): LoginValidation {
        val cleanSlug = slug.trim()
        val cleanEmail = email.trim()
        return LoginValidation(
            slugError = when {
                cleanSlug.isEmpty() -> "Resort slug is required."
                !slugPattern.matches(cleanSlug) -> "Use lowercase letters, numbers, and hyphens only."
                else -> null
            },
            emailError = when {
                cleanEmail.isEmpty() -> "Email is required."
                !emailPattern.matches(cleanEmail) -> "Enter a valid email address."
                else -> null
            },
            passwordError = if (password.isEmpty()) "Password is required." else null,
        )
    }
}
