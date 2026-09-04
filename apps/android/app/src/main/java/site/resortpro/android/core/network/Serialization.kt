package site.resortpro.android.core.network

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

object FlexibleDoubleSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("FlexibleDouble", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        if (decoder !is JsonDecoder) return decoder.decodeDouble()
        val value = decoder.decodeJsonElement() as? JsonPrimitive
            ?: throw IllegalArgumentException("Expected a numeric value")
        return value.doubleOrNull ?: value.content.toDouble()
    }

    override fun serialize(encoder: Encoder, value: Double) {
        encoder.encodeDouble(value)
    }
}
