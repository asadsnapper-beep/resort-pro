package site.resortpro.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import site.resortpro.android.core.media.DocumentImage

class DocumentImageTest {
    @Test
    fun aPhoneSizedPhotoIsDecodedAtAQuarterScale() {
        // A 12 MP portrait shot: 4000 on the long edge, so halving twice still
        // leaves 1000 — one halving too many. Two steps is the answer.
        assertEquals(2, DocumentImage.sampleSizeFor(3000, 4000))
    }

    @Test
    fun anAlreadySmallImageIsNotSampledDown() {
        assertEquals(1, DocumentImage.sampleSizeFor(1200, 900))
        assertEquals(1200 to 900, DocumentImage.scaledSize(1200, 900))
    }

    @Test
    fun scalingKeepsTheShapeOfTheDocument() {
        val (width, height) = DocumentImage.scaledSize(4000, 3000)
        assertEquals(DocumentImage.MAX_EDGE, width)
        assertEquals(1200, height)
    }

    @Test
    fun aVeryWideCropNeverCollapsesToZero() {
        // An ID card photographed as a letterbox strip. At 8000x2 the scale
        // factor is 0.2, so the short side rounds to zero without a floor —
        // and a zero-height bitmap is one Android refuses to allocate. 8000x3
        // would not catch it: 0.6 rounds up on its own.
        val (_, height) = DocumentImage.scaledSize(8000, 2)
        assertTrue("short side must survive rounding, was $height", height >= 1)
    }

    @Test
    fun degenerateInputDoesNotDivideByZero() {
        assertEquals(1, DocumentImage.sampleSizeFor(0, 0))
        assertEquals(0 to 0, DocumentImage.scaledSize(0, 0))
    }
}
