package site.resortpro.android.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Existing screen gaps and insets. Numeric names avoid assigning one visual
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
    // 18, 20, 22 and 24 dp are deliberately separate: changing an inset
    // changes the layout. Guest/booking screens on the pending branch use 22.
    val Space18 = 18.dp
    val Space20 = 20.dp
    val Space22 = 22.dp
    val Space24 = 24.dp
    val Space28 = 28.dp
    val Space32 = 32.dp
}

/**
 * Explicit corner radii already used by the thumbnail and pending guest
 * surfaces. Material components without an explicit shape retain their own
 * defaults; these values do not override MaterialTheme.shapes.
 */
object ResortRadius {
    val Thumbnail = 8.dp
    val GuestCard = 20.dp
    val GuestSurface = 24.dp
}

/**
 * Current screens do not set custom elevation values. This marker means
 * "leave the component's Material default alone", not a measured elevation
 * and not a value to pass to an elevation parameter.
 */
object ResortElevation {
    val MaterialDefault: Dp = Dp.Unspecified
}
