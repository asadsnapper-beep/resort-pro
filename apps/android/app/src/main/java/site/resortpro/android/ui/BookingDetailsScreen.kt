package site.resortpro.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.NumberFormat
import java.util.Locale
import site.resortpro.android.R
import site.resortpro.android.feature.guests.BookingDetailsState
import site.resortpro.android.feature.guests.BookingDetailsViewModel

@Composable
fun BookingDetailsScreen(viewModel: BookingDetailsViewModel, onBack: () -> Unit, showPayment: Boolean) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BookingDetailsContent(state, onBack, viewModel::retry, showPayment)
}

@Composable
internal fun BookingDetailsContent(state: BookingDetailsState, onBack: () -> Unit, onRetry: () -> Unit, showPayment: Boolean) {
    Scaffold(Modifier.statusBarsPadding()) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding).testTag("bookingDetailsList"), contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }; Text(stringResource(R.string.booking_details_title), style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Serif) }
            when {
                state.loading -> item { CircularProgressIndicator() }
                state.error != null -> item { Column { Text(state.error, color = MaterialTheme.colorScheme.error); TextButton(onClick = onRetry) { Text(stringResource(R.string.action_try_again)) } } }
                state.booking != null -> {
                    val booking = state.booking
                    item { Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                        Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(stringResource(R.string.guest_confirmation, booking.confirmationNo), style = MaterialTheme.typography.labelLarge)
                            Text(guestBookingStatus(booking.status), style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Serif)
                        }
                    } }
                    item { BookingInfoCard(stringResource(R.string.booking_guest)) { Text("${booking.guest.firstName} ${booking.guest.lastName}".trim(), style = MaterialTheme.typography.titleMedium) } }
                    item { BookingInfoCard(stringResource(R.string.booking_stay)) {
                        Text(stringResource(R.string.guest_room, booking.room.number, booking.room.name), fontWeight = FontWeight.SemiBold)
                        Text(stringResource(R.string.guest_dates, booking.checkIn.take(10), booking.checkOut.take(10)))
                        Text(stringResource(R.string.booking_people, booking.adults, booking.children))
                    } }
                    if (showPayment) item { BookingInfoCard(stringResource(R.string.booking_payment)) {
                        booking.totalAmount?.let { Text("${stringResource(R.string.booking_total)}: ${bookingMoney(it)}") }
                        booking.paidAmount?.let { Text("${stringResource(R.string.booking_paid)}: ${bookingMoney(it)}") }
                        if (booking.totalAmount == null && booking.paidAmount == null) Text(stringResource(R.string.booking_payment_unavailable))
                        booking.paymentStatus?.let { Text(stringResource(R.string.booking_payment_status, it.lowercase().replace('_', ' ').replaceFirstChar(Char::titlecase))) }
                    } }
                    item { Text(stringResource(R.string.booking_readonly), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        }
    }
}

@Composable
private fun BookingInfoCard(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            content()
        }
    }
}

private fun bookingMoney(amount: Double): String = "৳" + NumberFormat.getNumberInstance(Locale.forLanguageTag("en-BD")).apply { maximumFractionDigits = 2 }.format(amount)
