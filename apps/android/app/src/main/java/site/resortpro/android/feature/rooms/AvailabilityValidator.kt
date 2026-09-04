package site.resortpro.android.feature.rooms

import java.text.SimpleDateFormat
import java.util.Locale

data class AvailabilityValidation(
    val checkInError: String? = null,
    val checkOutError: String? = null,
) {
    val isValid: Boolean get() = checkInError == null && checkOutError == null
}

object AvailabilityValidator {
    private val isoDate = Regex("\\d{4}-\\d{2}-\\d{2}")

    fun validate(checkIn: String, checkOut: String): AvailabilityValidation {
        val checkInDate = parse(checkIn)
        val checkOutDate = parse(checkOut)
        return AvailabilityValidation(
            checkInError = if (checkInDate == null) "Use YYYY-MM-DD." else null,
            checkOutError = when {
                checkOutDate == null -> "Use YYYY-MM-DD."
                checkInDate != null && !checkOutDate.after(checkInDate) -> "Check-out must be after check-in."
                else -> null
            },
        )
    }

    private fun parse(value: String) = if (!isoDate.matches(value)) {
        null
    } else {
        runCatching {
            SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply { isLenient = false }.parse(value)
        }.getOrNull()
    }
}
