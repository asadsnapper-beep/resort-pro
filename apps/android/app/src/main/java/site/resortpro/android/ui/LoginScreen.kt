package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import site.resortpro.android.R
import site.resortpro.android.feature.auth.AuthUiState
import site.resortpro.android.ui.components.NoticeCard

@Composable
fun LoginScreen(
    state: AuthUiState,
    onSlugChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onTogglePassword: () -> Unit,
    onSubmit: () -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    Scaffold(modifier = Modifier.statusBarsPadding()) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            item {
                Text("ResortPro", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
                Text(
                    stringResource(R.string.login_tagline),
                    modifier = Modifier.padding(top = 8.dp, bottom = 28.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                when {
                    state.verificationRequired -> NoticeCard(
                        stringResource(R.string.login_verify_title),
                        stringResource(R.string.login_verify_body),
                    )
                    state.errorMessage != null -> NoticeCard(stringResource(R.string.login_failed), state.errorMessage, true)
                }
                if (state.verificationRequired || state.errorMessage != null) Spacer(Modifier.height(16.dp))

                LoginField(
                    value = state.slug,
                    onChange = onSlugChange,
                    label = stringResource(R.string.login_slug_label),
                    error = state.validation.slugError,
                    helper = stringResource(R.string.login_slug_hint),
                    type = KeyboardType.Ascii,
                    enabled = !state.isSubmitting,
                )
                Spacer(Modifier.height(12.dp))
                LoginField(
                    value = state.email,
                    onChange = onEmailChange,
                    label = stringResource(R.string.login_email_label),
                    error = state.validation.emailError,
                    type = KeyboardType.Email,
                    enabled = !state.isSubmitting,
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = state.password,
                    onValueChange = onPasswordChange,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.isSubmitting,
                    label = { Text(stringResource(R.string.login_password_label)) },
                    supportingText = state.validation.passwordError?.let { { Text(it) } },
                    isError = state.validation.passwordError != null,
                    singleLine = true,
                    visualTransformation = if (state.passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = { TextButton(onClick = onTogglePassword) { Text(stringResource(if (state.passwordVisible) R.string.login_hide else R.string.login_show)) } },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { keyboard?.hide(); onSubmit() }),
                )
                Spacer(Modifier.height(20.dp))
                Button(
                    onClick = { keyboard?.hide(); onSubmit() },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    enabled = !state.isSubmitting,
                ) {
                    if (state.isSubmitting) CircularProgressIndicator(Modifier.height(22.dp), strokeWidth = 2.dp)
                    else Text(stringResource(R.string.login_submit))
                }
                Text(
                    stringResource(R.string.login_roles),
                    modifier = Modifier.padding(top = 24.dp, bottom = 32.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun LoginField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    error: String?,
    helper: String? = null,
    type: KeyboardType,
    enabled: Boolean,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        enabled = enabled,
        label = { Text(label) },
        supportingText = (error ?: helper)?.let { { Text(it) } },
        isError = error != null,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = type, imeAction = ImeAction.Next),
    )
}
