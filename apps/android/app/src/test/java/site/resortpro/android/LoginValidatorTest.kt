package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import site.resortpro.android.feature.auth.LoginValidator

class LoginValidatorTest {
    @Test
    fun validCredentialsPassValidation() {
        val result = LoginValidator.validate(
            slug = "palm-paradise",
            email = "owner@example.com",
            password = "Password123!",
        )

        assertTrue(result.isValid)
        assertNull(result.slugError)
        assertNull(result.emailError)
        assertNull(result.passwordError)
    }

    @Test
    fun invalidFieldsReturnSpecificErrors() {
        val result = LoginValidator.validate(
            slug = "Palm Paradise",
            email = "not-an-email",
            password = "",
        )

        assertFalse(result.isValid)
        assertEquals("Use lowercase letters, numbers, and hyphens only.", result.slugError)
        assertEquals("Enter a valid email address.", result.emailError)
        assertEquals("Password is required.", result.passwordError)
    }
}
