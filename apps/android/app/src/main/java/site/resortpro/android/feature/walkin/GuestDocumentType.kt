package site.resortpro.android.feature.walkin

/**
 * What the guest handed over. The strings are the server's own vocabulary
 * (GuestDocument.docType) — anything it does not recognise is stored as OTHER,
 * so the list here stays the shorter, honest one rather than a superset.
 */
object GuestDocumentType {
    const val NATIONAL_ID = "NATIONAL_ID"
    const val PASSPORT = "PASSPORT"
    const val DRIVERS_LICENSE = "DRIVERS_LICENSE"
    const val VISA = "VISA"
    const val OTHER = "OTHER"

    /** Offered in the order a Bangladeshi resort actually meets them. */
    val OFFERED = listOf(NATIONAL_ID, PASSPORT, VISA, DRIVERS_LICENSE, OTHER)
}
