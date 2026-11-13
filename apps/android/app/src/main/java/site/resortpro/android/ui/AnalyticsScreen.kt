package site.resortpro.android.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.util.Locale
import site.resortpro.android.core.network.AnalyticsData
import site.resortpro.android.feature.auth.AuthRepository

@Composable
fun AnalyticsScreen(repository: AuthRepository, onBack: () -> Unit) {
    var data by remember { mutableStateOf<AnalyticsData?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(attempt) {
        loading = true
        error = null
        runCatching { repository.loadAnalytics() }.onSuccess { data = it }.onFailure { error = it.message ?: "Could not load analytics." }
        loading = false
    }
    val dark = isSystemInDarkTheme()
    val bg = if (dark) Color(0xFF101D19) else Color(0xFFF7F4ED)
    val card = if (dark) Color(0xFF20342D) else Color.White
    val ink = if (dark) Color(0xFFF1F5EC) else Color(0xFF173B32)
    val muted = if (dark) Color(0xFFAFBFB3) else Color(0xFF718078)
    LazyColumn(Modifier.fillMaxSize().background(bg).statusBarsPadding(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Analytics", color = ink, fontFamily = FontFamily.Serif, fontSize = 32.sp)
                TextButton(onClick = onBack) { Text("Back") }
            }
            Text("Your resort, in perspective.", color = muted)
        }
        when {
            loading -> item { CircularProgressIndicator() }
            error != null -> item { Text(error!!, color = ink); TextButton(onClick = { attempt++ }) { Text("Try again") } }
            data != null -> {
                val analytics = data!!
                val k = analytics.kpis
                item {
                    Column(Modifier.fillMaxWidth().background(Color(0xFF143D35), RoundedCornerShape(24.dp)).padding(20.dp)) {
                        Text("REVENUE OVERVIEW · THIS MONTH", color = Color(0xFFD5E9DA), fontSize = 11.sp, letterSpacing = 1.sp)
                        Text(money(k.mtdRevenue), color = Color(0xFFF2CF85), fontSize = 32.sp, fontFamily = FontFamily.Serif, modifier = Modifier.padding(top = 8.dp))
                        Text("${if (k.revenueGrowth > 0) "+" else ""}${k.revenueGrowth}% vs last month", color = Color(0xFFD5E9DA), fontSize = 13.sp)
                        Text("Revenue by month · last 12 months", color = Color(0xFFBCD5C7), fontSize = 11.sp, modifier = Modifier.padding(top = 22.dp))
                        RevenueChart(analytics.revenueByMonth.map { it.revenue })
                        if (analytics.revenueByMonth.isNotEmpty()) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(analytics.revenueByMonth.first().month, color = Color(0xFFBCD5C7), fontSize = 10.sp)
                            Text(analytics.revenueByMonth.last().month, color = Color(0xFFBCD5C7), fontSize = 10.sp)
                        }
                    }
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Metric("Occupancy · current", "${k.occupancyRate}%", card, ink, muted, Modifier.weight(1f))
                            Metric("Bookings · last 30 days", "${k.totalBookings30}", card, ink, muted, Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Metric("Average rate · 90 days", money(k.adr), card, ink, muted, Modifier.weight(1f))
                            Metric("Expenses · this month", money(k.mtdExpenses), card, ink, muted, Modifier.weight(1f))
                        }
                    }
                }
                item {
                    Column(Modifier.fillMaxWidth().background(card, RoundedCornerShape(22.dp)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Booking sources", color = ink, fontSize = 21.sp, fontFamily = FontFamily.Serif)
                        Text("Last 90 days", color = muted, fontSize = 12.sp)
                        if (analytics.bySources.isEmpty()) Text("No bookings in this period.", color = muted)
                        analytics.bySources.forEach { source ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(source.source.lowercase().replace('_', ' ').replaceFirstChar { it.titlecase() }, color = ink)
                                Text("${source.count}", color = ink, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RevenueChart(values: List<Double>) {
    if (values.size < 2) return
    Canvas(Modifier.fillMaxWidth().height(105.dp).padding(top = 12.dp, bottom = 8.dp)) {
        val max = values.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
        val path = Path()
        values.forEachIndexed { index, value ->
            val x = size.width * index / (values.size - 1)
            val y = size.height - (value / max).toFloat().coerceIn(0f, 1f) * (size.height - 8.dp.toPx())
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawLine(Color.White.copy(alpha = .14f), Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 1.dp.toPx())
        drawPath(path, Color(0xFFF2CF85), style = Stroke(width = 2.dp.toPx()))
    }
}

@Composable
private fun Metric(label: String, value: String, card: Color, ink: Color, muted: Color, modifier: Modifier) {
    Column(modifier.background(card, RoundedCornerShape(18.dp)).padding(15.dp)) {
        Text(label, color = muted, fontSize = 11.sp, minLines = 2)
        Text(value, color = ink, fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.padding(top = 6.dp))
    }
}

private fun money(value: Double): String = "৳${NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD")).apply { maximumFractionDigits = 0 }.format(value)}"
