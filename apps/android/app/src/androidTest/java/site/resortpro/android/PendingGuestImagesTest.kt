package site.resortpro.android

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import java.io.File
import java.util.UUID
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import site.resortpro.android.feature.walkin.PendingGuestImages

@RunWith(AndroidJUnit4::class)
class PendingGuestImagesTest {
    @Test
    fun encryptedPendingImageSurvivesStoreRecreationAndIsAccountScoped() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val suffix = UUID.randomUUID().toString()
        val tenant = "test-tenant-$suffix"
        val user = "test-user-$suffix"
        val sample = "synthetic-test-image-$suffix".toByteArray()
        val photo = File.createTempFile("pending-test-", ".jpg", context.cacheDir)
        photo.writeBytes(sample)
        val store = PendingGuestImages(context)
        val item = store.save(tenant, user, "guest-$suffix", "booking-$suffix", "GUEST_PHOTO", photo)
        try {
            val encrypted = File(context.noBackupFilesDir, "pending-guest-images/${item.id}").readBytes()
            assertFalse(encrypted.toString(Charsets.ISO_8859_1).contains(suffix))
            val restored = PendingGuestImages(context).list(tenant, user).single { it.id == item.id }
            assertArrayEquals(sample, store.bytes(restored))
            assertTrue(store.list(tenant, "different-user").none { it.id == item.id })
            assertTrue(store.list("different-tenant", user).none { it.id == item.id })
            store.quarantine(restored)
            assertTrue(PendingGuestImages(context).list(tenant, user).single { it.id == item.id }.quarantined)
        } finally {
            store.remove(item)
            photo.delete()
        }
    }
}
