package site.resortpro.android.core.database

data class CachedResult<T>(
    val data: T,
    val syncedAt: Long,
    val fromCache: Boolean,
)

fun cacheKey(resource: String, tenantId: String): String = "$resource:$tenantId"
