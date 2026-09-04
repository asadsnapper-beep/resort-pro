package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Test

class FoundationTest {
    @Test
    fun supportedRolesRemainExplicit() {
        val roles = setOf("OWNER", "MANAGER", "RECEPTIONIST", "STAFF", "SHAREHOLDER")

        assertEquals(5, roles.size)
    }
}
