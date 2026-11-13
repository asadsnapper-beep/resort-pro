package site.resortpro.android.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import site.resortpro.android.BuildConfig
import site.resortpro.android.R

private const val MAX_IMAGE_BYTES = 5 * 1024 * 1024
private val imageClient = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false).callTimeout(10, TimeUnit.SECONDS).build()

@Composable
internal fun RoomImage(imageUrl: String?) {
    val bitmap by produceState<ImageBitmap?>(initialValue = null, imageUrl) {
        value = withContext(Dispatchers.IO) { loadRoomImage(imageUrl) }
    }
    Box(Modifier.fillMaxWidth().height(210.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) {
        if (bitmap != null) {
            Image(bitmap = bitmap!!, contentDescription = stringResource(R.string.room_photo), modifier = Modifier.matchParentSize().clip(RoundedCornerShape(24.dp)), contentScale = ContentScale.Crop)
        } else {
            Text(stringResource(R.string.room_photo_placeholder), modifier = Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

/** Fetch only the configured API origin, without auth cookies, redirects or unbounded image allocations. */
private fun loadRoomImage(raw: String?): ImageBitmap? {
    return try {
    if (raw.isNullOrBlank()) return null
    val base = BuildConfig.API_BASE_URL.toHttpUrl()
    val url = base.resolve(raw) ?: return null
    if (url.scheme != base.scheme || url.host != base.host || url.port != base.port) return null
    imageClient.newCall(Request.Builder().url(url).build()).execute().use { response ->
        if (!response.isSuccessful) return null
        val body = response.body
        if (body.contentLength() > MAX_IMAGE_BYTES) return null
        val bytes = body.byteStream().use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > MAX_IMAGE_BYTES) return null
                output.write(buffer, 0, read)
            }
            output.toByteArray()
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / sample > 1200 || bounds.outHeight / sample > 1200) sample *= 2
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
    }
    } catch (_: Exception) { null }
}
