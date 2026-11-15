package site.resortpro.android.ui.theme

import androidx.compose.ui.unit.dp

/**
 * Existing screen dimensions. Numeric names avoid assigning one visual
 * purpose to a value that is currently shared by several different layouts.
 * This slice is additive; screens keep their current values until migrated.
 */
object ResortSpacing {
    val Space2 = 2.dp
    val Space4 = 4.dp
    val Space6 = 6.dp
    // Housekeeping uses 7 dp between task details, distinct from 6 and 8 dp.
    val Space7 = 7.dp
    val Space8 = 8.dp
    val Space10 = 10.dp
    val Space12 = 12.dp
    val Space14 = 14.dp
    val Space16 = 16.dp
    // Keep near-duplicate values distinct: replacing an existing inset changes
    // the layout. On dev, 22 dp is a spinner height in Login, Rooms and WalkIn;
    // the pending guest branch also uses 22 dp as an inset.
    val Space18 = 18.dp
    val Space20 = 20.dp
    val Space22 = 22.dp
    val Space24 = 24.dp
    val Space28 = 28.dp
    val Space32 = 32.dp
}

/**
 * Explicit radii do not override the defaults in MaterialTheme.shapes.
 */
object ResortRadius {
    // WalkInScreen's document thumbnail on dev.
    val Radius8 = 8.dp
    // GuestsScreen and BookingDetailsScreen cards on the unmerged guest branch.
    val Radius20 = 20.dp
    // GuestsScreen and BookingDetailsScreen surfaces on the unmerged guest branch.
    val Radius24 = 24.dp
}

// Current screens do not set custom elevation values.
