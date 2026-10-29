package com.krmzi.app

import android.util.Base64
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

object KrmziScraper {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private const val USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

    private fun fetchHtml(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "ar,en-US;q=0.9,en;q=0.8")
            .header("Referer", "https://krmzi.org/")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return ""
            return response.body?.string() ?: ""
        }
    }

    fun handle(fullUrl: String): String {
        val uri = URI(fullUrl)
        val path = uri.path ?: ""
        val queryMap = parseQuery(uri.query)

        return when {
            path.contains("/api/episodes") -> {
                val page = queryMap["page"]?.toIntOrNull() ?: 1
                getEpisodes(page)
            }
            path.contains("/api/series/detail") -> {
                val url = queryMap["url"] ?: ""
                getSeriesDetail(url)
            }
            path.contains("/api/series") -> {
                val page = queryMap["page"]?.toIntOrNull() ?: 1
                getSeries(page)
            }
            path.contains("/api/search") -> {
                val q = queryMap["q"] ?: ""
                getSearch(q)
            }
            path.contains("/api/episode/detail") -> {
                val url = queryMap["url"] ?: ""
                getEpisodeDetail(url)
            }
            else -> JSONObject().put("error", "Unknown endpoint").toString()
        }
    }

    private fun parseQuery(query: String?): Map<String, String> {
        val map = mutableMapOf<String, String>()
        if (query.isNullOrEmpty()) return map
        for (param in query.split("&")) {
            val parts = param.split("=", limit = 2)
            if (parts.size == 2) {
                map[parts[0]] = URLDecoder.decode(parts[1], "UTF-8")
            }
        }
        return map
    }

    private fun getEpisodes(page: Int): String {
        val url = if (page == 1) "https://krmzi.org/" else "https://krmzi.org/page/$page/"
        val html = fetchHtml(url)

        val episodes = JSONArray()
        val blockPattern = Pattern.compile("<div class=\"block-post\">([\\s\\S]*?)</div>\\s*</div>")
        val matcher = blockPattern.matcher(html)

        val linkPattern = Pattern.compile("<a\\s+href=\"(https://krmzi\\.org/episode/[^\"]+)\"\\s+title=\"([^\"]+)\"")
        val numPattern = Pattern.compile("<div class=\"episodeNum\">[\\s\\S]*?<span>(\\d+)</span>")
        val thumbPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")

        while (matcher.find()) {
            val blockHtml = matcher.group(1) ?: continue
            val lm = linkPattern.matcher(blockHtml)
            if (!lm.find()) continue

            val epUrl = lm.group(1) ?: ""
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

        val hasNext = html.contains("page/${page + 1}/")
        return JSONObject().apply {
            put("page", page)
            put("episodes", episodes)
            put("hasNext", hasNext)
        }.toString()
    }

    private fun getSeries(page: Int): String {
        val url = if (page == 1) "https://krmzi.org/series-list/" else "https://krmzi.org/series-list/page/$page/"
        val html = fetchHtml(url)

        val seriesList = JSONArray()
        val blockPattern = Pattern.compile("<div class=\"block-post\">([\\s\\S]*?)</div>\\s*</div>")
        val matcher = blockPattern.matcher(html)

        val linkPattern = Pattern.compile("<a\\s+href=\"(https://krmzi\\.org/series/[^\"]+)\"\\s+title=\"([^\"]+)\"")
        val thumbPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")

        while (matcher.find()) {
            val blockHtml = matcher.group(1) ?: continue
            val lm = linkPattern.matcher(blockHtml)
            if (!lm.find()) continue

            val serUrl = lm.group(1) ?: ""
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

        val hasNext = html.contains("series-list/page/${page + 1}/")
        return JSONObject().apply {
            put("page", page)
            put("series", seriesList)
            put("hasNext", hasNext)
        }.toString()
    }

    private fun getSeriesDetail(url: String): String {
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
        val epPattern = Pattern.compile("<a\\s+href=\"(https://krmzi\\.org/episode/[^\"]+)\"[^>]*>([\\s\\S]*?)</a>")
        val em = epPattern.matcher(html)
        val seen = mutableSetOf<String>()

        while (em.find()) {
            val epUrl = em.group(1) ?: continue
            if (seen.contains(epUrl)) continue
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

        return JSONObject().apply {
            put("url", url)
            put("title", title)
            put("poster", poster)
            put("story", story)
            put("episodes", episodes)
        }.toString()
    }

    private fun getSearch(query: String): String {
        val searchUrl = "https://krmzi.org/?s=" + URLEncoder.encode(query, "UTF-8")
        val html = fetchHtml(searchUrl)

        val results = JSONArray()
        val blockPattern = Pattern.compile("<div class=\"block-post\">([\\s\\S]*?)</div>\\s*</div>")
        val matcher = blockPattern.matcher(html)

        val linkPattern = Pattern.compile("<a\\s+href=\"(https://krmzi\\.org/(?:series|episode)/[^\"]+)\"\\s+title=\"([^\"]+)\"")
        val thumbPattern = Pattern.compile("url\\((https://krmzi\\.org/wp-content/uploads/[^)]+)\\)")

        while (matcher.find()) {
            val blockHtml = matcher.group(1) ?: continue
            val lm = linkPattern.matcher(blockHtml)
            if (!lm.find()) continue

            val itemUrl = lm.group(1) ?: ""
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

        return JSONObject().apply {
            put("query", query)
            put("results", results)
        }.toString()
    }

    private fun getEpisodeDetail(epUrl: String): String {
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

        val qesenPattern = Pattern.compile("href=\"https://qesen\\.net/krmzi\\?post=([^\"]+)\"")
        val qm = qesenPattern.matcher(html)

        val servers = JSONArray()
        val directStreams = JSONArray()

        if (qm.find()) {
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
                            } catch (_: Exception) {}
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
            } catch (_: Exception) {}
        }

        return JSONObject().apply {
            put("url", epUrl)
            put("title", title)
            put("episodeNum", episodeNum)
            put("poster", poster)
            put("seriesUrl", seriesUrl)
            put("servers", servers)
            put("directStreams", directStreams)
        }.toString()
    }
}
