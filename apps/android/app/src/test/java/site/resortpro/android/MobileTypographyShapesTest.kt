package site.resortpro.android

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Test
import site.resortpro.android.ui.theme.ResortProShapes
import site.resortpro.android.ui.theme.ResortProTypography
import site.resortpro.android.ui.theme.RpShape
import site.resortpro.android.ui.theme.RpType

class MobileTypographyShapesTest {
    @Test
    fun typographyMatchesMobileScale() {
        assertEquals(16.sp, RpType.input.fontSize)
        assertEquals(15.sp, ResortProTypography.bodyMedium.fontSize)
        assertEquals(22.sp, ResortProTypography.bodyMedium.lineHeight)
        assertEquals(FontWeight.ExtraBold, RpType.displayXl.fontWeight)
        assertEquals((-0.32).sp, RpType.displayXl.letterSpacing)
        assertEquals((-0.28).sp, RpType.displayLg.letterSpacing)
        assertEquals(0.96.sp, RpType.sectionLabel.letterSpacing)
        assertEquals("tnum", RpType.metric.fontFeatureSettings)
        assertEquals("tnum", RpType.metricXl.fontFeatureSettings)
    }

    @Test
    fun shapesAreWiredToMaterialSlots() {
        assertEquals(RpShape.xs, ResortProShapes.extraSmall)
        assertEquals(RpShape.sm, ResortProShapes.small)
        assertEquals(RpShape.md, ResortProShapes.medium)
        assertEquals(RpShape.lg, ResortProShapes.large)
        assertEquals(RpShape.xl, ResortProShapes.extraLarge)
    }
}
