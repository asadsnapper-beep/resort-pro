package site.resortpro.android.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import site.resortpro.android.R

private val Nunito = FontFamily(
    Font(R.font.nunito_regular, FontWeight.Normal),
    Font(R.font.nunito_medium, FontWeight.Medium),
    Font(R.font.nunito_semibold, FontWeight.SemiBold),
    Font(R.font.nunito_bold, FontWeight.Bold),
    Font(R.font.nunito_extrabold, FontWeight.ExtraBold),
)

/** Named styles include the roles Material 3 does not have slots for. */
object RpType {
    val displayXl = style(32, 36, FontWeight.ExtraBold).copy(letterSpacing = (-0.32).sp)
    val displayLg = style(28, 32, FontWeight.ExtraBold).copy(letterSpacing = (-0.28).sp)
    val heading = style(22, 28, FontWeight.Bold)
    val subheading = style(18, 24, FontWeight.Bold)
    // The section-label component, not translated strings, performs uppercasing.
    val sectionLabel = style(12, 16, FontWeight.Bold).copy(letterSpacing = 0.96.sp)
    val bodyLg = style(17, 24, FontWeight.Normal)
    val body = style(15, 22, FontWeight.Normal)
    val bodyStrong = style(15, 22, FontWeight.SemiBold)
    val meta = style(13, 18, FontWeight.Normal)
    val caption = style(12, 16, FontWeight.Medium)
    val micro = style(11, 14, FontWeight.SemiBold)
    val metricXl = style(30, 34, FontWeight.ExtraBold).copy(
        letterSpacing = (-0.6).sp,
        fontFeatureSettings = "tnum",
    )
    val metric = style(20, 24, FontWeight.Bold).copy(fontFeatureSettings = "tnum")
    val button = style(15, 20, FontWeight.Bold)
    val input = style(16, 22, FontWeight.Normal)
    val tabLabel = style(11, 14, FontWeight.SemiBold)

    private fun style(size: Int, line: Int, weight: FontWeight) = TextStyle(
        fontFamily = Nunito,
        fontSize = size.sp,
        lineHeight = line.sp,
        fontWeight = weight,
    )
}

val ResortProTypography: Typography by lazy {
    Typography(
        displayLarge = RpType.displayXl,
        displayMedium = RpType.displayLg,
        displaySmall = RpType.displayLg,
        headlineLarge = RpType.displayLg,
        headlineMedium = RpType.heading,
        headlineSmall = RpType.heading,
        titleLarge = RpType.heading,
        titleMedium = RpType.subheading,
        titleSmall = RpType.bodyStrong,
        bodyLarge = RpType.bodyLg,
        bodyMedium = RpType.body,
        bodySmall = RpType.meta,
        labelLarge = RpType.button,
        labelMedium = RpType.caption,
        labelSmall = RpType.micro,
    )
}
