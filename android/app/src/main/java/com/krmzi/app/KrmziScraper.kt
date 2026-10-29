package com.krmzi.app

import android.net.Uri
import android.util.Base64
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

object KrmziScraper {

    private const val TAG = "KrmziScraper"

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .retryOnConnectionFailure(true)
        .build()

    private const val USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

    // Simple thread-safe memory cache with 5 minutes TTL
    private data class CacheEntry(val data: String, val timestamp: Long)
    private val memoryCache = ConcurrentHashMap<String, CacheEntry>()
    private const val CACHE_TTL_MS = 5 * 60 * 1000L

    private fun getCached(key: String): String? {
        val entry = memoryCache[key] ?: return null
        if (System.currentTimeMillis() - entry.timestamp < CACHE_TTL_MS) {
            return entry.data
        }
        memoryCache.remove(key)
        return null
    }

    private fun putCache(key: String, data: String) {
        if (memoryCache.size > 150) {
            memoryCache.clear()
        }
        memoryCache[key] = CacheEntry(data, System.currentTimeMillis())
    }

    private fun fetchHtml(url: String): String {
        return try {
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "ar,en-US;q=0.9,en;q=0.8")
                .header("Referer", "https://krmzi.org/")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.w(TAG, "HTTP error ${response.code} for: $url")
                    return ""
                }
                response.body?.string() ?: ""
            }
        } catch (e: Exception) {
            Log.e(TAG, "fetchHtml failed for: $url, error: ${e.message}")
            ""
        }
    }

    // Helper to unwrap advertising redirects (e.g. sayyarh.com?url=aHR0cHM...)
    fun extractRealUrl(rawUrl: String): String {
        if (rawUrl.isEmpty()) return ""
        if (rawUrl.contains("krmzi.org/episode/")) return rawUrl

        val pattern = Pattern.compile("[?&](?:url|link|target)=([^&]+)")
        val matcher = pattern.matcher(rawUrl)
        if (matcher.find()) {
            try {
                var valStr = URLDecoder.decode(matcher.group(1) ?: "", "UTF-8")
                if (!valStr.startsWith("http")) {
                    val decodedBytes = Base64.decode(valStr, Base64.DEFAULT)
                    val decodedStr = String(decodedBytes, Charsets.UTF_8)
                    if (decodedStr.contains("krmzi.org")) {
                        return URLDecoder.decode(decodedStr, "UTF-8")
                    }
                }
                if (valStr.contains("krmzi.org")) {
                    return valStr
                }
            } catch (_: Exception) {}
        }
        return rawUrl
    }

    fun handle(fullUrl: String): String {
        return try {
            val uri = Uri.parse(fullUrl)
            val path = uri.path ?: ""
            
            when {
                path.contains("/api/episodes") -> {
                    val page = uri.getQueryParameter("page")?.toIntOrNull() ?: 1
                    getEpisodes(page)
                }
                path.contains("/api/series/detail") -> {
                    val url = uri.getQueryParameter("url") ?: ""
                    getSeriesDetail(url)
                }
                path.contains("/api/series") -> {
                    val page = uri.getQueryParameter("page")?.toIntOrNull() ?: 1
                    getSeries(page)
                }
                path.contains("/api/search") -> {
                    val q = uri.getQueryParameter("q") ?: ""
                    getSearch(q)
                }
                path.contains("/api/episode/detail") -> {
                    val url = uri.getQueryParameter("url") ?: ""
                    getEpisodeDetail(url)
                }
                else -> JSONObject().put("error", "Unknown endpoint: $path").toString()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in handle: ${e.message}", e)
            JSONObject().put("error", e.message ?: "Unknown error").toString()
        }
    }

    fun getEpisodes(page: Int): String {
        val cacheKey = "episodes_page_$page"
        getCached(cacheKey)?.let { return it }

        val url = if (page == 1) "https://krmzi.org/" else "https://krmzi.org/page/$page/"
        val html = fetchHtml(url)

        val episodes = JSONArray()
        if (html.isNotEmpty()) {
            val blockPattern = Pattern.compile("<div class=\"block-post\">([\\s\\S]*?)</div>\\s*</div>")
            val matcher = blockPattern.matcher(html)

            // Flexible link matcher that also captures redirected ad wrappers
            val linkPattern = Pattern.compile("<a\\s+href=\"([^\"]+)\"\\s+title=\"([^\"]+)\"")
            val numPattern = Pattern.compile("<div class=\"episodeNum\">[\\s\\S]*?<span>(\\d+)</span>")
            val thumbPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")

            while (matcher.find()) {
                val blockHtml = matcher.group(1) ?: continue
                val lm = linkPattern.matcher(blockHtml)
                if (!lm.find()) continue

                val rawHref = lm.group(1) ?: ""
                val epUrl = extractRealUrl(rawHref)
                val fullTitle = (lm.group(2) ?: "").replace(Regex("\\s*-\\s*قرمزي\\s*$"), "").trim()

                val nm = numPattern.matcher(blockHtml)
                val episodeNum = if (nm.find()) nm.group(1) ?: "" else ""

                val tm = thumbPattern.matcher(blockHtml)
                val thumb = if (tm.find()) tm.group(1) ?: "" else ""

                var seriesTitle = fullTitle
                if (episodeNum.isNotEmpty()) {
                    seriesTitle = fullTitle.replace(Regex("الحلقة\\s*$episodeNum.*"), "").trim()
                }

                val item = JSONObject().apply {
                    put("url", epUrl)
                    put("title", fullTitle)
                    put("seriesTitle", if (seriesTitle.isNotEmpty()) seriesTitle else fullTitle)
                    put("episodeNum", episodeNum)
                    put("thumbnail", thumb)
                }
                episodes.put(item)
            }
        }

        val hasNext = html.contains("page/${page + 1}/")
        val result = JSONObject().apply {
            put("page", page)
            put("episodes", episodes)
            put("hasNext", hasNext)
            put("isSuccess", episodes.length() > 0)
        }.toString()

        if (episodes.length() > 0) {
            putCache(cacheKey, result)
        }
        return result
    }

    fun getSeries(page: Int): String {
        val cacheKey = "series_page_$page"
        getCached(cacheKey)?.let { return it }

        val url = if (page == 1) "https://krmzi.org/series-list/" else "https://krmzi.org/series-list/page/$page/"
        val html = fetchHtml(url)

        val seriesList = JSONArray()
        if (html.isNotEmpty()) {
            val blockPattern = Pattern.compile("<div class=\"block-post\">([\\s\\S]*?)</div>\\s*</div>")
            val matcher = blockPattern.matcher(html)

            val linkPattern = Pattern.compile("<a\\s+href=\"([^\"]+)\"\\s+title=\"([^\"]+)\"")
            val thumbPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")

            while (matcher.find()) {
                val blockHtml = matcher.group(1) ?: continue
                val lm = linkPattern.matcher(blockHtml)
                if (!lm.find()) continue

                val rawHref = lm.group(1) ?: ""
                val serUrl = extractRealUrl(rawHref)
                val title = (lm.group(2) ?: "").replace(Regex("\\s*-\\s*قرمزي\\s*$"), "").trim()

                val tm = thumbPattern.matcher(blockHtml)
                val thumb = if (tm.find()) tm.group(1) ?: "" else ""

                val item = JSONObject().apply {
                    put("url", serUrl)
                    put("title", title)
                    put("thumbnail", thumb)
                }
                seriesList.put(item)
            }
        }

        val hasNext = html.contains("series-list/page/${page + 1}/")
        val result = JSONObject().apply {
            put("page", page)
            put("series", seriesList)
            put("hasNext", hasNext)
            put("isSuccess", seriesList.length() > 0)
        }.toString()

        if (seriesList.length() > 0) {
            putCache(cacheKey, result)
        }
        return result
    }

    fun getSeriesDetail(url: String): String {
        if (url.isEmpty()) return JSONObject().put("error", "URL cannot be empty").toString()
        val cacheKey = "series_detail_" + url.hashCode()
        getCached(cacheKey)?.let { return it }

        val html = fetchHtml(url)
        val titlePattern = Pattern.compile("<h1[^>]*>([\\s\\S]*?)</h1>")
        val tm = titlePattern.matcher(html)
        val title = if (tm.find()) tm.group(1)?.replace(Regex("<[^>]+>"), "")?.trim() ?: "" else ""

        val posterPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")
        val pm = posterPattern.matcher(html)
        val poster = if (pm.find()) pm.group(1) ?: "" else ""

        val storyPattern = Pattern.compile("<div class=\"story\">([\\s\\S]*?)</div>")
        val sm = storyPattern.matcher(html)
        val story = if (sm.find()) sm.group(1)?.replace(Regex("<[^>]+>"), "")?.trim() ?: "" else ""

        val episodes = JSONArray()
        val epPattern = Pattern.compile("<a\\s+href=\"([^\"]+)\"[^>]*>([\\s\\S]*?)</a>")
        val em = epPattern.matcher(html)
        val seen = mutableSetOf<String>()

        while (em.find()) {
            val rawEpUrl = em.group(1) ?: continue
            val epUrl = extractRealUrl(rawEpUrl)
            if (seen.contains(epUrl) || !epUrl.contains("/episode/")) continue
            seen.add(epUrl)

            val inner = em.group(2)?.replace(Regex("<[^>]+>"), " ")?.trim() ?: ""
            val numRegex = Regex("الحلقة-(\\d+)")
            val numMatch = numRegex.find(epUrl)
            val epNum = numMatch?.groupValues?.get(1) ?: ""

            episodes.put(JSONObject().apply {
                put("url", epUrl)
                put("title", if (inner.isNotEmpty()) inner else "الحلقة $epNum")
                put("episodeNum", epNum)
            })
        }

        val result = JSONObject().apply {
            put("url", url)
            put("title", title)
            put("poster", poster)
            put("story", story)
            put("episodes", episodes)
            put("isSuccess", true)
        }.toString()

        putCache(cacheKey, result)
        return result
    }

    fun getSearch(query: String): String {
        if (query.trim().isEmpty()) {
            return JSONObject().apply {
                put("query", "")
                put("results", JSONArray())
            }.toString()
        }

        val cacheKey = "search_" + query.trim().lowercase()
        getCached(cacheKey)?.let { return it }

        val searchUrl = "https://krmzi.org/?s=" + URLEncoder.encode(query, "UTF-8")
        val html = fetchHtml(searchUrl)

        val results = JSONArray()
        if (html.isNotEmpty()) {
            val blockPattern = Pattern.compile("<div class=\"block-post\">([\\s\\S]*?)</div>\\s*</div>")
            val matcher = blockPattern.matcher(html)

            val linkPattern = Pattern.compile("<a\\s+href=\"([^\"]+)\"\\s+title=\"([^\"]+)\"")
            val thumbPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")

            while (matcher.find()) {
                val blockHtml = matcher.group(1) ?: continue
                val lm = linkPattern.matcher(blockHtml)
                if (!lm.find()) continue

                val rawHref = lm.group(1) ?: ""
                val itemUrl = extractRealUrl(rawHref)
                val title = (lm.group(2) ?: "").replace(Regex("\\s*-\\s*قرمزي\\s*$"), "").trim()
                val isSeries = itemUrl.contains("/series/")

                val tm = thumbPattern.matcher(blockHtml)
                val thumb = if (tm.find()) tm.group(1) ?: "" else ""

                results.put(JSONObject().apply {
                    put("url", itemUrl)
                    put("title", title)
                    put("type", if (isSeries) "series" else "episode")
                    put("thumbnail", thumb)
                })
            }
        }

        val result = JSONObject().apply {
            put("query", query)
            put("results", results)
            put("isSuccess", true)
        }.toString()

        putCache(cacheKey, result)
        return result
    }

    fun getEpisodeDetail(epUrl: String): String {
        if (epUrl.isEmpty()) return JSONObject().put("error", "URL cannot be empty").toString()
        val cacheKey = "ep_detail_" + epUrl.hashCode()
        getCached(cacheKey)?.let { return it }

        val html = fetchHtml(epUrl)

        val titlePattern = Pattern.compile("<h1[^>]*>([\\s\\S]*?)</h1>")
        val tm = titlePattern.matcher(html)
        val rawTitle = if (tm.find()) tm.group(1)?.replace(Regex("<[^>]+>"), "")?.trim() ?: "" else ""
        val title = rawTitle.replace(Regex("\\s*-\\s*قرمزي\\s*$"), "").trim()

        val numRegex = Regex("الحلقة-(\\d+)")
        val numMatch = numRegex.find(epUrl)
        val episodeNum = numMatch?.groupValues?.get(1) ?: ""

        val posterPattern = Pattern.compile("url\\('?(https://krmzi\\.org/wp-content/uploads/[^')]+)'?\\)")
        val pm = posterPattern.matcher(html)
        val poster = if (pm.find()) pm.group(1) ?: "" else ""

        val seriesPattern = Pattern.compile("<a[^>]+href=\"(https://krmzi\\.org/series/[^\"]+)\"")
        val sm = seriesPattern.matcher(html)
        val seriesUrl = if (sm.find()) sm.group(1) ?: "" else ""

        val servers = JSONArray()
        val directStreams = JSONArray()
        val seenServerIds = mutableSetOf<String>()

        // 1. Direct HTML serversList parsing
        val liPattern = Pattern.compile("<li[^>]*data-name=\"([^\"]*)\"[^>]*data-server=\"([^\"]*)\"")
        val liMatcher = liPattern.matcher(html)

        while (liMatcher.find()) {
            val sName = liMatcher.group(1) ?: ""
            val sId = liMatcher.group(2) ?: ""
            if (sName.isEmpty() && sId.isEmpty()) continue
            if (sId.isNotEmpty() && seenServerIds.contains(sId)) continue
            if (sId.isNotEmpty()) seenServerIds.add(sId)

            var embedUrl = ""
            var isDirect = false

            when (sName) {
                "ok" -> {
                    embedUrl = "https://ok.ru/videoembed/$sId"
                    try {
                        val okHtml = fetchHtml(embedUrl)
                        val optPattern = Pattern.compile("data-options=\"([^\"]+)\"")
                        val optM = optPattern.matcher(okHtml)
                        if (optM.find()) {
                            val raw = (optM.group(1) ?: "").replace("&quot;", "\"")
                            val okData = JSONObject(raw)
                            val flashvars = okData.optJSONObject("flashvars")
                            val metaObj = flashvars?.opt("metadata")
                            val meta = if (metaObj is String) JSONObject(metaObj) else metaObj as? JSONObject

                            val videos = meta?.optJSONArray("videos")
                            if (videos != null && videos.length() > 0) {
                                val qualityMap = mapOf(
                                    "full" to "1080p (Full HD)",
                                    "hd" to "720p (HD)",
                                    "sd" to "480p (SD)",
                                    "low" to "360p",
                                    "lowest" to "240p",
                                    "mobile" to "144p"
                                )
                                for (j in (videos.length() - 1) downTo 0) {
                                    val v = videos.getJSONObject(j)
                                    val vName = v.getString("name")
                                    val vUrl = v.getString("url")
                                    directStreams.put(JSONObject().apply {
                                        put("quality", qualityMap[vName] ?: vName)
                                        put("url", vUrl)
                                    })
                                }
                                isDirect = true
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed OK.ru extract: ${e.message}")
                    }
                }
                "Arab HD" -> embedUrl = "https://arabhd.onl/embed-$sId.html"
                "estream" -> embedUrl = "https://arabveturk.com/embed-$sId.html"
                "box" -> embedUrl = "https://youdboox.com/embed-$sId.html"
                "now" -> embedUrl = "https://extreamnow.org/embed-$sId.html"
                "Red HD" -> embedUrl = "https://iplayerhls.com/e/$sId"
                "Pro HD" -> embedUrl = "https://embedo.co/e/$sId"
                "dailymotion" -> embedUrl = "https://www.dailymotion.com/embed/video/$sId"
                "youtube" -> embedUrl = "https://www.youtube.com/embed/$sId"
            }

            if (embedUrl.isNotEmpty()) {
                servers.put(JSONObject().apply {
                    put("name", sName)
                    put("id", sId)
                    put("embedUrl", embedUrl)
                    put("hasDirectStream", isDirect)
                })
            }
        }

        // 2. Fallback to default iframe if no servers yet
        if (servers.length() == 0) {
            val ifPattern = Pattern.compile("<iframe[^>]+src=\"([^\"]+)\"")
            val ifm = ifPattern.matcher(html)
            if (ifm.find()) {
                val ifUrl = ifm.group(1) ?: ""
                if (ifUrl.isNotEmpty()) {
                    servers.put(JSONObject().apply {
                        put("name", "سيرفر رئيسي")
                        put("id", "main_frame")
                        put("embedUrl", ifUrl)
                        put("hasDirectStream", false)
                    })
                }
            }
        }

        // 3. Fallback to Qesen Base64 payload if present
        val qesenPattern = Pattern.compile("href=\"https://qesen\\.net/krmzi\\?post=([^\"]+)\"")
        val qm = qesenPattern.matcher(html)
        if (servers.length() == 0 && qm.find()) {
            try {
                val b64 = qm.group(1) ?: ""
                val decoded = String(Base64.decode(b64, Base64.DEFAULT), Charsets.UTF_8)
                val postObj = JSONObject(decoded)
                val rawServers = postObj.optJSONArray("servers") ?: JSONArray()
                for (i in 0 until rawServers.length()) {
                    val s = rawServers.getJSONObject(i)
                    val sName = s.getString("name")
                    val sId = s.getString("id")
                    var embedUrl = ""
                    when (sName) {
                        "ok" -> embedUrl = "https://ok.ru/videoembed/$sId"
                        "Arab HD" -> embedUrl = "https://arabhd.onl/embed-$sId.html"
                        "estream" -> embedUrl = "https://arabveturk.com/embed-$sId.html"
                        "Red HD" -> embedUrl = "https://iplayerhls.com/e/$sId"
                    }
                    if (embedUrl.isNotEmpty()) {
                        servers.put(JSONObject().apply {
                            put("name", sName)
                            put("id", sId)
                            put("embedUrl", embedUrl)
                            put("hasDirectStream", false)
                        })
                    }
                }
            } catch (_: Exception) {}
        }

        val result = JSONObject().apply {
            put("url", epUrl)
            put("title", title)
            put("episodeNum", episodeNum)
            put("poster", poster)
            put("seriesUrl", seriesUrl)
            put("servers", servers)
            put("directStreams", directStreams)
            put("isSuccess", true)
        }.toString()

        putCache(cacheKey, result)
        return result
    }
}
