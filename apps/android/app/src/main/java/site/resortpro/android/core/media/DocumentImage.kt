package site.resortpro.android.core.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Sizing rules for a photographed guest document.
 *
 * A phone camera writes 4–12 MB per shot. The server refuses anything over
 * 10 MB, and a receptionist on mobile data should not be sending a passport at
 * full sensor resolution either — the picture only has to stay readable enough
 * to satisfy a compliance check, not to be printed.
 *
 * The arithmetic lives here, apart from Android's Bitmap, so it can be argued
 * with in a test rather than by taking photographs.
 */
object DocumentImage {
    /** Long edge, in pixels, after downscaling. Text on an ID stays legible. */
    const val MAX_EDGE = 1600

    /** JPEG quality. High enough that small print survives the recompression. */
    const val JPEG_QUALITY = 82

    /** The server's own limit; anything above it is refused with a 400. */
    const val MAX_UPLOAD_BYTES = 10L * 1024 * 1024

    /**
     * The sample size to decode at: the largest power of two that still leaves
     * the image at or above [MAX_EDGE], which is what BitmapFactory expects and
     * what keeps the decode cheap enough not to stall a mid-range phone.
     */
    fun sampleSizeFor(width: Int, height: Int, maxEdge: Int = MAX_EDGE): Int {
        val longest = maxOf(width, height)
        if (longest <= 0) return 1
        var sample = 1
        while (longest / (sample * 2) >= maxEdge) sample *= 2
        return sample
    }

    /** Target dimensions after scaling, keeping the aspect ratio. */
    fun scaledSize(width: Int, height: Int, maxEdge: Int = MAX_EDGE): Pair<Int, Int> {
        val longest = maxOf(width, height)
        if (longest <= maxEdge || longest <= 0) return width to height
        val ratio = maxEdge.toDouble() / longest
        // Never round a side down to zero: a very wide, very short crop would
        // otherwise produce a bitmap Android refuses to create.
        return maxOf(1, Math.round(width * ratio).toInt()) to
            maxOf(1, Math.round(height * ratio).toInt())
    }
}

/**
 * Reads the photograph the camera app just wrote and returns JPEG bytes small
 * enough to send.
 *
 * The file is decoded twice on purpose: once for its dimensions alone
 * (inJustDecodeBounds), then for real at a sample size chosen from them. A
 * 12 MP photograph decoded at full size on a mid-range phone is tens of
 * megabytes of heap for an image about to be shrunk anyway.
 */
fun File.readAsUploadableJpeg(): ByteArray? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    val decoded = BitmapFactory.decodeFile(
        absolutePath,
        BitmapFactory.Options().apply {
            inSampleSize = DocumentImage.sampleSizeFor(bounds.outWidth, bounds.outHeight)
        },
    ) ?: return null

    val (width, height) = DocumentImage.scaledSize(decoded.width, decoded.height)
    val scaled = if (width == decoded.width && height == decoded.height) {
        decoded
    } else {
        Bitmap.createScaledBitmap(decoded, width, height, true)
    }

    return ByteArrayOutputStream().use { out ->
        scaled.compress(Bitmap.CompressFormat.JPEG, DocumentImage.JPEG_QUALITY, out)
        if (scaled !== decoded) scaled.recycle()
        decoded.recycle()
        out.toByteArray()
    }
}

/**
 * Where a document photograph is allowed to live: the app's own cache, never
 * the shared gallery. A guest's passport in MediaStore is readable by every
 * app on the phone and by whoever picks it up, and it outlives the check-in
 * that needed it.
 */
fun Context.newDocumentCaptureFile(): File =
    File(cacheDir, "guest-doc-${System.currentTimeMillis()}.jpg")
