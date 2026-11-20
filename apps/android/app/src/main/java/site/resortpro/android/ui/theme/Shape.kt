package site.resortpro.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

object RpShape {
    val xs = RoundedCornerShape(8.dp)
    val sm = RoundedCornerShape(10.dp)
    val md = RoundedCornerShape(12.dp)
    val lg = RoundedCornerShape(16.dp)
    val xl = RoundedCornerShape(24.dp)
    val pill = RoundedCornerShape(999.dp)
}

val ResortProShapes = Shapes(
    extraSmall = RpShape.xs,
    small = RpShape.sm,
    medium = RpShape.md,
    large = RpShape.lg,
    extraLarge = RpShape.xl,
)
