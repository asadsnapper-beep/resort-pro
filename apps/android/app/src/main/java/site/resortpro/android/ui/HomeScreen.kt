package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import site.resortpro.android.core.network.DashboardStats
import site.resortpro.android.feature.auth.AuthUiState
import site.resortpro.android.feature.auth.AuthenticatedSession
import site.resortpro.android.feature.auth.HomeContent
import site.resortpro.android.ui.components.NoticeCard

@Composable
fun HomeScreen(
    state: AuthUiState,
    session: AuthenticatedSession,
    onRetry: () -> Unit,
    onOpenRooms: (() -> Unit)?,
    onOpenHousekeeping: (() -> Unit)?,
    onOpenWalkIn: (() -> Unit)?,
    onLogout: () -> Unit,
    onEnableAppLock: () -> Unit,
    onDeclineAppLock: () -> Unit,
) {
    Scaffold(modifier = Modifier.statusBarsPadding()) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(session.tenant?.name ?: "ResortPro", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text(
                            "${session.user.firstName} ${session.user.lastName} · ${roleLabel(session.user.role)}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        state.homeSyncedAt?.let { syncedAt ->
                            Text(
                                if (state.homeFromCache) "Offline · Last synced ${formatHomeSyncTime(syncedAt)}"
                                else "Updated ${formatHomeSyncTime(syncedAt)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    TextButton(onClick = onLogout, enabled = !state.isSubmitting) { Text("Sign out") }
                }
            }
            // Asked once, right after a password sign-in, and only where the
            // device can actually do it. Not a settings screen buried three
            // taps away that nobody will ever find.
            if (state.offerAppLock) item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Lock the app?", fontWeight = FontWeight.Bold)
                        Text(
                            "You stay signed in for a week. Ask to be unlocked when " +
                                "reopening — however you unlock this phone — so the resort's " +
                                "data is safe if it is left lying around.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(
                            Modifier.fillMaxWidth().padding(top = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Button(onClick = onEnableAppLock, modifier = Modifier.weight(1f).height(50.dp)) {
                                Text("Turn on")
                            }
                            TextButton(onClick = onDeclineAppLock, modifier = Modifier.weight(1f)) {
                                Text("Not now")
                            }
                        }
                    }
                }
            }
            navigationButton("Rooms & availability", onOpenRooms)
            navigationButton("Housekeeping", onOpenHousekeeping)
            navigationButton("New walk-in", onOpenWalkIn)

            when {
                state.isHomeLoading -> item { LoadingCard() }
                state.homeError != null -> item {
                    NoticeCard("Could not load dashboard", state.homeError, true)
                    TextButton(onClick = onRetry) { Text("Try again") }
                }
                state.home is HomeContent.Operations -> operationsItems(state.home)
                state.home is HomeContent.Investment -> investmentItems(state.home)
                state.home is HomeContent.Limited -> item { NoticeCard("Signed in securely", state.home.message) }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.navigationButton(
    label: String,
    action: (() -> Unit)?,
) {
    if (action != null) item {
        Button(onClick = action, modifier = Modifier.fillMaxWidth().height(50.dp)) { Text(label) }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.operationsItems(home: HomeContent.Operations) {
    val stats = home.dashboard.stats
    item { SectionTitle("Today") }
    items(operationalStats(stats), key = { it.first }) { (label, value) -> StatCard(label, value) }
    if (home.showFinancials) item { StatCard("Monthly revenue", formatCurrency(stats.monthlyRevenue)) }
}

private fun androidx.compose.foundation.lazy.LazyListScope.investmentItems(home: HomeContent.Investment) {
    item { SectionTitle("My investment") }
    item { StatCard("Ownership", "${home.summary.ownershipPercent}%") }
    item { StatCard("Estimated share this month", formatCurrency(home.summary.estimatedShareThisMonth)) }
    item { StatCard("Net profit this month", formatCurrency(home.summary.netProfitThisMonth)) }
    item {
        Text(
            "This view is read-only and shows only your own shareholder information.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SectionTitle(label: String) = Text(label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)

@Composable
private fun StatCard(label: String, value: String) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun LoadingCard() {
    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.height(24.dp))
            Text("Loading your dashboard…")
        }
    }
}

private fun operationalStats(stats: DashboardStats) = listOf(
    "Arrivals today" to stats.todayCheckIns.toString(),
    "Departures today" to stats.todayCheckOuts.toString(),
    "Available rooms" to stats.availableRooms.toString(),
    "Occupied rooms" to stats.occupiedRooms.toString(),
    "Occupancy" to "${stats.occupancyRate}%",
    "Pending housekeeping" to stats.pendingHousekeeping.toString(),
)

private fun roleLabel(role: String) = role.lowercase().replaceFirstChar { it.titlecase() }

private fun formatHomeSyncTime(timestamp: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(timestamp))

private fun formatCurrency(value: Double): String {
    val formatter = NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD"))
    formatter.maximumFractionDigits = 0
    return "৳${formatter.format(value)}"
}
