package site.resortpro.android.feature.walkin

/**
 * How one photograph fared on its way to the server.
 *
 * The distinction that matters is between a failure worth retrying and one that
 * never will be. A file that cannot be decoded will not decode on the second
 * attempt either, so holding on to it only keeps a guest's ID in the cache for
 * nothing.
 */
enum class DocumentSendResult {
    /** Accepted by the server. The local copy has no further use. */
    SENT,

    /** Not a readable image. Another attempt would fail the same way. */
    UNREADABLE,

    /** The send itself failed — no network, a timeout, a 5xx. Try again. */
    FAILED,
}

/** What survived a send attempt, and what the desk should be told about it. */
data class DocumentUploadOutcome(
    /** Still on the phone, in the order taken, waiting for another attempt. */
    val pending: List<CapturedDocument> = emptyList(),
    val failed: Int = 0,
    val total: Int = 0,
) {
    /**
     * The line shown under "Guest checked in", or null when there is nothing to
     * say. The check-in itself already succeeded — this is only about the
     * photographs, and it has to reach the receptionist while the guest is
     * still at the desk holding the document.
     */
    val note: String?
        get() = when {
            failed == 0 -> null
            pending.isEmpty() && failed == total ->
                "Checked in, but the photos could not be read. Take them again from the guest's profile."
            pending.isEmpty() ->
                "Checked in. $failed of $total photos could not be read — take those again from the guest's profile."
            failed == total ->
                "Checked in, but the photos did not upload. Tap Retry — they are still on this phone."
            else ->
                "Checked in. $failed of $total photos did not upload. Tap Retry — they are still on this phone."
        }
}

/**
 * Send each photograph, keeping the ones worth another attempt.
 *
 * One request per photograph because the server takes a single file at a time,
 * and one failure must not strand the rest: a passport page that uploaded is
 * still worth having when its second page did not.
 *
 * A file is discarded the moment it can no longer be of use — sent, or
 * unreadable. What is kept is exactly what a retry could still rescue. The
 * earlier version deleted every file either way and told the desk to "add them
 * from the guest's profile", which for a camera capture was advice to do the
 * impossible: the photograph lived only in the app's cache, so a failed upload
 * destroyed the only copy and the guest had to be asked for their passport
 * again.
 */
suspend fun sendDocuments(
    documents: List<CapturedDocument>,
    send: suspend (CapturedDocument) -> DocumentSendResult,
    discard: (CapturedDocument) -> Unit,
): DocumentUploadOutcome {
    if (documents.isEmpty()) return DocumentUploadOutcome()

    val pending = mutableListOf<CapturedDocument>()
    var failed = 0

    for (document in documents) {
        when (send(document)) {
            DocumentSendResult.SENT -> discard(document)
            DocumentSendResult.UNREADABLE -> {
                failed++
                discard(document)
            }
            DocumentSendResult.FAILED -> {
                failed++
                pending += document
            }
        }
    }

    return DocumentUploadOutcome(pending = pending, failed = failed, total = documents.size)
}
