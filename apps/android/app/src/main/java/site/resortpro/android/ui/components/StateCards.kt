package site.resortpro.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun LoadingScreen(message: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Text(message, Modifier.padding(top = 16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun NoticeCard(title: String, message: String, isError: Boolean = false) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                title,
                fontWeight = FontWeight.SemiBold,
                color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            )
            Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
