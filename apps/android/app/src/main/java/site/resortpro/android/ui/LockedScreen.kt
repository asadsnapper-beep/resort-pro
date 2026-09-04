package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Shown while a restored session is held back.
 *
 * Reached by dismissing the unlock prompt, which is usually a fumble rather
 * than a decision — so the way forward is one button, and signing out is the
 * deliberate, secondary choice. Nothing about the session is shown here: not
 * the resort, not the name. Only that there is something to unlock.
 */
@Composable
fun LockedScreen(
    onUnlock: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("ResortPro is locked", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "Unlock the way you unlock this phone, and carry on where you left off.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
        )
        Button(onClick = onUnlock, modifier = Modifier.fillMaxWidth().height(56.dp)) {
            Text("Unlock")
        }
        TextButton(onClick = onSignOut, modifier = Modifier.padding(top = 8.dp)) {
            Text("Sign in with a password instead")
        }
    }
}
