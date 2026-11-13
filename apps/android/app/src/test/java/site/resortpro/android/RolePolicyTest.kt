package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Test
import site.resortpro.android.feature.auth.HomeKind
import site.resortpro.android.feature.auth.RolePolicy

class RolePolicyTest {
    @Test
    fun shareholderUsesPrivateInvestmentHome() {
        assertEquals(HomeKind.SHAREHOLDER, RolePolicy.homeKind("SHAREHOLDER"))
    }

    @Test
    fun receptionistNeverGetsFinancialHome() {
        assertEquals(HomeKind.FRONT_DESK, RolePolicy.homeKind("RECEPTIONIST"))
    }

    @Test
    fun ownerAndManagerGetFinancialOperationsHome() {
        assertEquals(HomeKind.OPERATIONS_WITH_FINANCIALS, RolePolicy.homeKind("OWNER"))
        assertEquals(HomeKind.OPERATIONS_WITH_FINANCIALS, RolePolicy.homeKind("MANAGER"))
    }

    @Test
    fun staffGetsLimitedOperationalHome() {
        assertEquals(HomeKind.STAFF, RolePolicy.homeKind("STAFF"))
    }

    @Test
    fun roomAccessMatchesBackendRoleGuard() {
        assertEquals(true, RolePolicy.canViewRooms("OWNER"))
        assertEquals(true, RolePolicy.canViewRooms("MANAGER"))
        assertEquals(true, RolePolicy.canViewRooms("RECEPTIONIST"))
        assertEquals(false, RolePolicy.canViewRooms("STAFF"))
        assertEquals(false, RolePolicy.canViewRooms("SHAREHOLDER"))
    }

    @Test
    fun housekeepingAccessMatchesBackendRoleGuard() {
        assertEquals(true, RolePolicy.canViewHousekeeping("OWNER"))
        assertEquals(true, RolePolicy.canViewHousekeeping("MANAGER"))
        assertEquals(true, RolePolicy.canViewHousekeeping("RECEPTIONIST"))
        assertEquals(true, RolePolicy.canViewHousekeeping("STAFF"))
        assertEquals(false, RolePolicy.canViewHousekeeping("SHAREHOLDER"))
    }

    @Test
    fun walkInAccessMatchesBackendRoleGuard() {
        assertEquals(true, RolePolicy.canCreateWalkIn("OWNER"))
        assertEquals(true, RolePolicy.canCreateWalkIn("MANAGER"))
        assertEquals(true, RolePolicy.canCreateWalkIn("RECEPTIONIST"))
        assertEquals(false, RolePolicy.canCreateWalkIn("STAFF"))
        assertEquals(false, RolePolicy.canCreateWalkIn("SHAREHOLDER"))
    }

    @Test
    fun guestAccessMatchesBackendRoleGuard() {
        assertEquals(true, RolePolicy.canViewGuests("OWNER"))
        assertEquals(true, RolePolicy.canViewGuests("MANAGER"))
        assertEquals(true, RolePolicy.canViewGuests("RECEPTIONIST"))
        assertEquals(false, RolePolicy.canViewGuests("STAFF"))
        assertEquals(false, RolePolicy.canViewGuests("SHAREHOLDER"))
        assertEquals(false, RolePolicy.canViewGuests("UNKNOWN"))
    }

    @Test fun bookingPaymentAccessMatchesFrontDeskPolicy() {
        for (role in listOf("OWNER", "MANAGER", "RECEPTIONIST")) assertEquals(true, RolePolicy.canViewBookingPayment(role))
        for (role in listOf("STAFF", "SHAREHOLDER", "UNKNOWN")) assertEquals(false, RolePolicy.canViewBookingPayment(role))
        assertEquals(false, RolePolicy.canViewAnalytics("RECEPTIONIST"))
    }
}
