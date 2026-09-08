package site.resortpro.android

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import site.resortpro.android.feature.walkin.CapturedDocument
import site.resortpro.android.feature.walkin.DocumentSendResult
import site.resortpro.android.feature.walkin.GuestDocumentType
import site.resortpro.android.feature.walkin.sendDocuments

/**
 * The rule under test: a photograph is thrown away only when it can no longer
 * be of any use. Everything else is kept, because a camera capture exists
 * nowhere but this phone's cache — deleting it after a failed upload means
 * asking the guest for their passport a second time.
 */
class DocumentUploadTest {
    private fun doc(name: String) = CapturedDocument("/cache/$name.jpg", GuestDocumentType.NATIONAL_ID)

    private fun run(
        documents: List<CapturedDocument>,
        results: Map<String, DocumentSendResult>,
    ): Pair<site.resortpro.android.feature.walkin.DocumentUploadOutcome, List<String>> {
        val discarded = mutableListOf<String>()
        val outcome = runBlocking {
            sendDocuments(
                documents = documents,
                send = { results.getValue(it.path) },
                discard = { discarded += it.path },
            )
        }
        return outcome to discarded
    }

    @Test
    fun everythingSentLeavesNothingBehindAndNothingToSay() {
        val docs = listOf(doc("a"), doc("b"))
        val (outcome, discarded) = run(docs, docs.associate { it.path to DocumentSendResult.SENT })

        assertTrue(outcome.pending.isEmpty())
        assertEquals(0, outcome.failed)
        assertNull(outcome.note)
        assertEquals(docs.map { it.path }, discarded)
    }

    @Test
    fun aFailedSendKeepsItsFileForAnotherAttempt() {
        val docs = listOf(doc("a"))
        val (outcome, discarded) = run(docs, mapOf(docs[0].path to DocumentSendResult.FAILED))

        // The whole point: the file is still there to retry with.
        assertEquals(docs, outcome.pending)
        assertEquals(emptyList<String>(), discarded)
        assertTrue(outcome.note!!.contains("Retry"))
    }

    @Test
    fun anUnreadableFileIsDiscardedBecauseARetryWouldFailTheSameWay() {
        val docs = listOf(doc("a"))
        val (outcome, discarded) = run(docs, mapOf(docs[0].path to DocumentSendResult.UNREADABLE))

        assertTrue(outcome.pending.isEmpty())
        assertEquals(1, outcome.failed)
        assertEquals(listOf(docs[0].path), discarded)
        // No Retry offered — there is nothing a retry could fix.
        assertTrue(outcome.note!!.contains("Take them again"))
    }

    @Test
    fun onePageFailingDoesNotStrandTheOthers() {
        val docs = listOf(doc("front"), doc("back"), doc("visa"))
        val (outcome, discarded) = run(
            docs,
            mapOf(
                docs[0].path to DocumentSendResult.SENT,
                docs[1].path to DocumentSendResult.FAILED,
                docs[2].path to DocumentSendResult.SENT,
            ),
        )

        assertEquals(listOf(docs[1]), outcome.pending)
        assertEquals(listOf(docs[0].path, docs[2].path), discarded)
        assertEquals(1, outcome.failed)
        assertEquals(3, outcome.total)
        assertTrue(outcome.note!!.startsWith("Checked in. 1 of 3"))
    }

    @Test
    fun retriesKeepTheOrderTheyWereTakenIn() {
        val docs = listOf(doc("a"), doc("b"), doc("c"))
        val (outcome, _) = run(
            docs,
            mapOf(
                docs[0].path to DocumentSendResult.FAILED,
                docs[1].path to DocumentSendResult.SENT,
                docs[2].path to DocumentSendResult.FAILED,
            ),
        )

        assertEquals(listOf(docs[0], docs[2]), outcome.pending)
    }

    @Test
    fun noPhotographsMeansNoMessage() {
        val (outcome, discarded) = run(emptyList(), emptyMap())

        assertNull(outcome.note)
        assertEquals(0, outcome.total)
        assertEquals(emptyList<String>(), discarded)
    }
}
