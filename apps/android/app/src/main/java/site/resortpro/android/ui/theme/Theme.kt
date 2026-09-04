package site.resortpro.android.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = ResortGreen,
    onPrimary = Color.White,
    secondary = ResortCoral,
    tertiary = ResortGold,
    background = ResortCanvas,
    onBackground = ResortInk,
    surface = Color.White,
    onSurface = ResortInk,
)

private val DarkColors = darkColorScheme(
    primary = ResortGreenDark,
    secondary = ResortCoral,
    tertiary = ResortGold,
    background = Color(0xFF0E1714),
    onBackground = Color(0xFFE4ECE8),
    surface = Color(0xFF16231F),
    onSurface = Color(0xFFE4ECE8),
)

@Composable
fun ResortProTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colors,
        content = content,
    )
}
