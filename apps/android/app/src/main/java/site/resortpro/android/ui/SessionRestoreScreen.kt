package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import site.resortpro.android.R

@Composable
internal fun SessionRestoreScreen(onRetry: () -> Unit, onSignInInstead: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(R.string.session_retry_title), style = MaterialTheme.typography.headlineSmall)
        Text(stringResource(R.string.session_retry_body), modifier = Modifier.padding(vertical = 16.dp))
        Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.action_try_again)) }
        TextButton(onClick = onSignInInstead) { Text(stringResource(R.string.session_sign_in_instead)) }
    }
}
