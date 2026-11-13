package site.resortpro.android.feature.walkin

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class PendingGuestImage(
    val id: String,
    val tenantId: String,
    val userId: String,
    val guestId: String,
    val bookingId: String,
    val docType: String,
    val image: String,
    val quarantined: Boolean = false,
)

/** App-private, encrypted and excluded from backup; no plaintext pending photos on disk. */
class PendingGuestImages(context: Context) {
    private val directory = File(context.noBackupFilesDir, "pending-guest-images")
    private val json = Json { ignoreUnknownKeys = true }
    private val keyAlias = "resortpro.pending-guest-images.v1"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
        }.generateKey()
    }

    fun save(tenantId: String, userId: String, guestId: String, bookingId: String, docType: String, photo: File): PendingGuestImage {
        val bytes = photo.readBytes()
        require(bytes.isNotEmpty() && bytes.size <= 5 * 1024 * 1024)
        val item = PendingGuestImage(UUID.randomUUID().toString(), tenantId, userId, guestId, bookingId, docType, Base64.encodeToString(bytes, Base64.NO_WRAP))
        write(item)
        return item
    }

    fun quarantine(item: PendingGuestImage) = write(item.copy(quarantined = true))

    private fun write(item: PendingGuestImage) {
        check(directory.exists() || directory.mkdirs())
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = cipher.doFinal(json.encodeToString(item).toByteArray(Charsets.UTF_8))
        val atomic = AtomicFile(File(directory, item.id))
        val out = atomic.startWrite()
        try {
            out.write(cipher.iv.size)
            out.write(cipher.iv)
            out.write(encrypted)
            atomic.finishWrite(out)
        } catch (error: Exception) {
            atomic.failWrite(out)
            throw error
        }
    }

    fun list(tenantId: String, userId: String): List<PendingGuestImage> {
        if (!directory.exists()) return emptyList()
        val files = directory.listFiles() ?: error("Cannot read pending image directory")
        return files.filter { it.isFile && UUID_PATTERN.matches(it.name) }.map { file ->
            val raw = AtomicFile(file).openRead().use { it.readBytes() }
            require(raw.isNotEmpty() && raw[0].toInt() == 12 && raw.size > 13)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw.copyOfRange(1, 13)))
            }
            val item = json.decodeFromString<PendingGuestImage>(cipher.doFinal(raw.copyOfRange(13, raw.size)).toString(Charsets.UTF_8))
            check(item.id == file.name)
            item
        }.filter { it.tenantId == tenantId && it.userId == userId }
    }

    fun bytes(item: PendingGuestImage): ByteArray = Base64.decode(item.image, Base64.NO_WRAP)

    fun remove(item: PendingGuestImage) {
        require(UUID_PATTERN.matches(item.id))
        AtomicFile(File(directory, item.id)).delete()
    }

    private companion object {
        val UUID_PATTERN = Regex("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
    }
}
