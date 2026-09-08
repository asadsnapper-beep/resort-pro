package site.resortpro.android.feature.walkin

/**
 * One photograph waiting to go up with the booking.
 *
 * The type is stored per photograph rather than once for the whole walk-in,
 * because a guest hands over more than one kind of paper: a passport and the
 * visa inside it, or an NID whose two sides are one document but a licence
 * that is another. Picking a type then photographing is how it reads at the
 * desk, so the chip selected at capture time is what each one keeps.
 */
data class CapturedDocument(
    val path: String,
    val docType: String,
)
