package site.resortpro.android

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test
import site.resortpro.android.core.network.RoomDto

class FlexibleDoubleSerializerTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun roomPriceAcceptsPrismaDecimalString() {
        val room = json.decodeFromString<RoomDto>(
            """{"id":"r1","number":"101","name":"Sea View","type":"STANDARD","maxOccupancy":2,"basePrice":"4500.50","status":"AVAILABLE"}""",
        )
        assertEquals(4500.50, room.basePrice, 0.001)
    }
}
