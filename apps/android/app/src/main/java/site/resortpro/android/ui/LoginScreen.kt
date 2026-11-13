package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(padding).padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 30.dp)) {
                    Box(Modifier.size(45.dp).background(Color(0xFF143D35), RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) {
                        Text("R", color = Color(0xFFD5E9DA), fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 27.sp)
                    }
                    Column(Modifier.padding(start = 11.dp)) {
                        Text("RESORTPRO", fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, letterSpacing = 1.8.sp)
                        Text("YOUR RESORT, IN SYNC", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, letterSpacing = 1.sp)
                    }
                }
                Text("Welcome back.", fontFamily = FontFamily.Serif, fontSize = 36.sp, lineHeight = 42.sp, color = MaterialTheme.colorScheme.onBackground)
                Text(
                    "A smoother day at your resort starts here.",
                    modifier = Modifier.padding(top = 8.dp, bottom = 26.dp),
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
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A6B5E), contentColor = Color.White),
                    enabled = !state.isSubmitting,
                ) {
                    if (state.isSubmitting) CircularProgressIndicator(Modifier.height(22.dp), strokeWidth = 2.dp)
                    else Text(stringResource(R.string.login_submit))
                }
                Text(
                    "Made for the people who make every stay special.",
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
        shape = RoundedCornerShape(15.dp),
        keyboardOptions = KeyboardOptions(keyboardType = type, imeAction = ImeAction.Next),
    )
}
