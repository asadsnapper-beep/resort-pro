package site.resortpro.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.DateFormat
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import site.resortpro.android.feature.auth.AuthUiState
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.auth.HomeContent

private val Forest = Color(0xFF143D35)
private val Mint = Color(0xFFD5E9DA)
private val Coral = Color(0xFFEE806B)
private val Sand = Color(0xFFF6F4EC)
private val Ink = Color(0xFF18362F)

@Composable
fun HomeScreen(
    state: AuthUiState,
    session: AuthenticatedSession,
    onRetry: () -> Unit,
    onOpenRooms: (() -> Unit)?,
    onOpenHousekeeping: (() -> Unit)?,
    onOpenWalkIn: (() -> Unit)?,
    onOpenAnalytics: (() -> Unit)? = null,
    onLogout: () -> Unit,
    onEnableAppLock: () -> Unit,
    onDeclineAppLock: () -> Unit,
    onOpenGuests: (() -> Unit)? = null,
) {
    val dark = isSystemInDarkTheme()
    val locale = LocalConfiguration.current.locales[0] ?: Locale.ROOT
    val page = if (dark) Color(0xFF101D19) else Sand
    val card = if (dark) Color(0xFF20342D) else Color.White
    val text = if (dark) Color(0xFFF1F5EC) else Ink
    val muted = if (dark) Color(0xFFAFBFB3) else Color(0xFF6D7C70)
    val greeting = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        else -> "Good evening"
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(page).statusBarsPadding(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).background(Forest, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                    Text("R", color = Mint, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 25.sp)
                }
                Column(Modifier.weight(1f).padding(start = 11.dp)) {
                    Text("RESORTPRO", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.6.sp, color = muted)
                    Text(session.tenant?.name ?: "ResortPro", color = text, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                TextButton(onClick = onLogout, enabled = !state.isSubmitting) { Text("Sign out", color = muted) }
            }
        }
        item {
            Column {
                Text(SimpleDateFormat("EEEE, d MMMM", locale).format(Date()).uppercase(locale), color = muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp)
                Text("$greeting, ${session.user.firstName}.", color = text, fontFamily = FontFamily.Serif, fontSize = 31.sp, lineHeight = 37.sp, modifier = Modifier.padding(top = 5.dp))
                Text("${session.user.firstName} ${session.user.lastName} · ${session.user.role.lowercase().replaceFirstChar { it.titlecase() }}", color = muted, style = MaterialTheme.typography.labelSmall)
                Text("Here's what's happening at your resort.", color = muted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 3.dp))
            }
        }
        state.homeSyncedAt?.let { syncedAt ->
            item {
                Text(
                    if (state.homeFromCache) "●  Offline · Last synced ${formatHomeSyncTime(syncedAt)}" else "●  Updated ${formatHomeSyncTime(syncedAt)}",
                    color = if (state.homeFromCache) Coral else muted,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
        if (state.offerAppLock) item {
            Column(Modifier.fillMaxWidth().background(card, RoundedCornerShape(20.dp)).padding(18.dp)) {
                Text("Keep your resort secure", color = text, fontWeight = FontWeight.Bold)
                Text("Use your phone's screen lock to protect this app.", color = muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onEnableAppLock) { Text("Turn on", color = if (dark) Mint else Forest) }
                    TextButton(onClick = onDeclineAppLock) { Text("Not now", color = muted) }
                }
            }
        }
        when {
            state.isHomeLoading -> item { Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp); Text("Loading your overview…", color = text) } }
            state.homeError != null -> item {
                Column(Modifier.fillMaxWidth().background(card, RoundedCornerShape(20.dp)).padding(18.dp)) {
                    Text("Couldn't load your overview", color = text, fontWeight = FontWeight.Bold)
                    Text(state.homeError, color = muted, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = onRetry) { Text("Try again") }
                }
            }
            state.home is HomeContent.Operations -> {
                val stats = state.home.dashboard.stats
                item {
                    Column(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Forest, Color(0xFF216257))), RoundedCornerShape(26.dp)).padding(21.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("YOUR RESORT TODAY", color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                            Text("✦", color = Color(0xFFF3CF81), fontSize = 23.sp)
                        }
                        Text("A little overview.", fontFamily = FontFamily.Serif, fontSize = 26.sp, color = Color.White, modifier = Modifier.padding(top = 7.dp))
                        Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            HeroMetric("${stats.todayCheckIns}", "Arrivals", Modifier.weight(1f))
                            HeroMetric("${stats.todayCheckOuts}", "Departures", Modifier.weight(1f))
                            HeroMetric("${stats.occupancyRate}%", "Occupancy", Modifier.weight(1f))
                        }
                    }
                }
                item { SectionHeading("Your workspace", "Everything within reach", text, muted) }
                if (onOpenRooms != null || onOpenHousekeeping != null || onOpenWalkIn != null || onOpenGuests != null) item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (onOpenWalkIn != null) WorkspaceRow("↗", "New walk-in", "Welcome a guest and check in", Coral, card, text, muted, onOpenWalkIn)
                        if (onOpenRooms != null) WorkspaceRow("▦", "Rooms & availability", "${stats.availableRooms} available · ${stats.occupiedRooms} occupied", Color(0xFFBADCC8), card, text, muted, onOpenRooms)
                        if (onOpenGuests != null) WorkspaceRow("♙", "Guests & stays", "Find a guest or recent booking", Mint, card, text, muted, onOpenGuests)
                        if (onOpenHousekeeping != null) WorkspaceRow("✦", "Housekeeping", "${stats.pendingHousekeeping} tasks pending", Color(0xFFF4DC9F), card, text, muted, onOpenHousekeeping)
                    }
                }
                if (state.home.showFinancials) item {
                    Column(Modifier.fillMaxWidth().background(card, RoundedCornerShape(22.dp)).padding(19.dp)) {
                        Text("MONTHLY REVENUE", color = muted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
                        Text(formatCurrency(stats.monthlyRevenue), color = text, fontSize = 25.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                        if (onOpenAnalytics != null) TextButton(onClick = onOpenAnalytics) { Text("View analytics →") }
                    }
                }
            }
            state.home is HomeContent.Investment -> {
                val summary = state.home.summary
                item {
                    Column(Modifier.fillMaxWidth().background(Forest, RoundedCornerShape(26.dp)).padding(22.dp)) {
                        Text("YOUR INVESTMENT", color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                        Text("${summary.ownershipPercent}%", color = Color.White, fontFamily = FontFamily.Serif, fontSize = 42.sp, modifier = Modifier.padding(top = 10.dp))
                        Text("Ownership", color = Mint)
                    }
                }
                item { SectionHeading("This month", "Your investment at a glance", text, muted) }
                item {
                    Column(Modifier.fillMaxWidth().background(card, RoundedCornerShape(22.dp)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        InvestmentRow("Estimated share", formatCurrency(summary.estimatedShareThisMonth), text, muted)
                        InvestmentRow("Net profit", formatCurrency(summary.netProfitThisMonth), text, muted)
                        Text("Your personal investment view is read-only.", color = muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            state.home is HomeContent.Limited -> item {
                Text(state.home.message, color = text, modifier = Modifier.fillMaxWidth().background(card, RoundedCornerShape(20.dp)).padding(18.dp))
            }
        }
        if (state.home !is HomeContent.Operations && (onOpenRooms != null || onOpenHousekeeping != null || onOpenWalkIn != null || onOpenGuests != null)) item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (onOpenWalkIn != null) WorkspaceRow("↗", "New walk-in", "Welcome a guest and check in", Coral, card, text, muted, onOpenWalkIn)
                if (onOpenRooms != null) WorkspaceRow("▦", "Rooms & availability", "Explore your rooms", Mint, card, text, muted, onOpenRooms)
                if (onOpenGuests != null) WorkspaceRow("♙", "Guests & stays", "Find a guest or recent booking", Mint, card, text, muted, onOpenGuests)
                if (onOpenHousekeeping != null) WorkspaceRow("✦", "Housekeeping", "View your tasks", Color(0xFFF4DC9F), card, text, muted, onOpenHousekeeping)
            }
        }
    }
}

@Composable
private fun HeroMetric(value: String, label: String, modifier: Modifier) {
    Column(modifier.background(Color.White.copy(alpha = 0.1f), RoundedCornerShape(16.dp)).padding(horizontal = 10.dp, vertical = 12.dp)) {
        Text(value, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp, maxLines = 1)
        Text(label, color = Mint, fontSize = 11.sp, maxLines = 1)
    }
}

@Composable
private fun SectionHeading(title: String, subtitle: String, text: Color, muted: Color) {
    Column {
        Text(title, color = text, fontSize = 21.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = muted, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun WorkspaceRow(symbol: String, title: String, subtitle: String, accent: Color, card: Color, text: Color, muted: Color, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(card, RoundedCornerShape(20.dp)).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp).background(accent, RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) {
            Text(symbol, color = Forest, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
        Column(Modifier.weight(1f).padding(start = 13.dp)) {
            Text(title, color = text, fontWeight = FontWeight.Bold, maxLines = 1)
            Text(subtitle, color = muted, style = MaterialTheme.typography.bodySmall, maxLines = 2)
        }
        Text("↗", color = muted, fontSize = 20.sp, modifier = Modifier.padding(horizontal = 4.dp))
    }
}

@Composable
private fun InvestmentRow(label: String, value: String, text: Color, muted: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = muted)
        Text(value, color = text, fontWeight = FontWeight.Bold)
    }
}

private fun formatHomeSyncTime(timestamp: Long): String = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(timestamp))

private fun formatCurrency(value: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD"))
    formatter.maximumFractionDigits = 0
    return "৳${formatter.format(value)}"
}
