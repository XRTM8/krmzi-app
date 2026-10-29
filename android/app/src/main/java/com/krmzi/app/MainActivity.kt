package com.krmzi.app

import android.annotation.SuppressLint
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.Rational
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private companion object {
        const val TAG = "KrmziMainActivity"
    }

    private lateinit var webView: WebView
    private lateinit var container: FrameLayout
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var isVideoPlaying = false

    // Javascript Interface Bridge for direct, zero-CORS communication
    inner class KrmziBridge {
        @JavascriptInterface
        fun getEpisodes(page: Int): String {
            return KrmziScraper.getEpisodes(page)
        }

        @JavascriptInterface
        fun getSeries(page: Int): String {
            return KrmziScraper.getSeries(page)
        }

        @JavascriptInterface
        fun getSeriesDetail(url: String): String {
            return KrmziScraper.getSeriesDetail(url)
        }

        @JavascriptInterface
        fun getEpisodeDetail(url: String): String {
            return KrmziScraper.getEpisodeDetail(url)
        }

        @JavascriptInterface
        fun search(query: String): String {
            return KrmziScraper.getSearch(query)
        }

        @JavascriptInterface
        fun setVideoPlaying(playing: Boolean) {
            isVideoPlaying = playing
        }

        @JavascriptInterface
        fun setLandscape(enable: Boolean) {
            runOnUiThread {
                try {
                    requestedOrientation = if (enable) {
                        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Orientation error: ${e.message}")
                }
            }
        }

        @JavascriptInterface
        fun isNative(): Boolean = true

        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                val pInfo = packageManager.getPackageInfo(packageName, 0)
                val vName = pInfo.versionName ?: "1.0.3"
                val vCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    pInfo.longVersionCode
                } else {
                    @Suppress("DEPRECATION")
                    pInfo.versionCode.toLong()
                }
                JSONObject().apply {
                    put("versionName", vName)
                    put("versionCode", vCode)
                }.toString()
            } catch (e: Exception) {
                """{"versionName":"1.0.3","versionCode":4}"""
            }
        }

        @JavascriptInterface
        fun checkForUpdates(): String {
            return try {
                val url = URL("https://api.github.com/repos/XRTM8/krmzi-app/releases/latest")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("User-Agent", "KrmziApp-Android")
                    setRequestProperty("Accept", "application/vnd.github.v3+json")
                }
                val code = conn.responseCode
                if (code == 200) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    val tagName = json.optString("tag_name", "").replace("v", "").trim()
                    val releaseName = json.optString("name", "تحديث جديد")
                    val releaseNotes = json.optString("body", "")

                    var apkUrl = ""
                    val assets = json.optJSONArray("assets")
                    if (assets != null && assets.length() > 0) {
                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            val name = asset.optString("name", "")
                            if (name.endsWith(".apk", ignoreCase = true)) {
                                apkUrl = asset.optString("browser_download_url", "")
                                break
                            }
                        }
                    }
                    if (apkUrl.isEmpty()) {
                        apkUrl = json.optString("html_url", "https://github.com/XRTM8/krmzi-app/releases/latest")
                    }

                    val pInfo = packageManager.getPackageInfo(packageName, 0)
                    val currentVersion = (pInfo.versionName ?: "1.0.3").replace("v", "").trim()

                    val hasUpdate = isNewerVersion(currentVersion, tagName)

                    JSONObject().apply {
                        put("hasUpdate", hasUpdate)
                        put("currentVersion", currentVersion)
                        put("latestVersion", tagName)
                        put("releaseName", releaseName)
                        put("changelog", releaseNotes)
                        put("downloadUrl", apkUrl)
                        put("isSuccess", true)
                    }.toString()
                } else {
                    JSONObject().apply {
                        put("hasUpdate", false)
                        put("error", "HTTP $code")
                        put("isSuccess", false)
                    }.toString()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Update check error: ${e.message}")
                JSONObject().apply {
                    put("hasUpdate", false)
                    put("error", e.message)
                    put("isSuccess", false)
                }.toString()
            }
        }

        @JavascriptInterface
        fun openDownloadUrl(downloadUrl: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch download URL: ${e.message}")
                }
            }
        }
    }

    private fun isNewerVersion(current: String, latest: String): Boolean {
        if (latest.isEmpty()) return false
        val currParts = current.split(".").mapNotNull { it.toIntOrNull() }
        val lateParts = latest.split(".").mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(currParts.size, lateParts.size)
        for (i in 0 until maxLen) {
            val c = currParts.getOrElse(i) { 0 }
            val l = lateParts.getOrElse(i) { 0 }
            if (l > c) return true
            if (l < c) return false
        }
        return false
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make window edge-to-edge with Hardware Acceleration
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            window.statusBarColor = Color.TRANSPARENT
            window.navigationBarColor = Color.BLACK
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            window.setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            )
        } catch (_: Exception) {}

        container = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#060709"))
        }

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.TRANSPARENT)
        }

        container.addView(webView)
        setContentView(container)

        // Modern Google WebView Asset Loader for secure HTTPS assets
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        configureWebView(assetLoader)
        setupBackHandler()

        // Load application through official Android HTTPS asset loader
        webView.loadUrl("https://appassets.androidplatform.net/assets/public/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(assetLoader: WebViewAssetLoader) {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadsImagesAutomatically = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Enable cookies & third-party cookies for iframe streaming players
        try {
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(webView, true)
        } catch (_: Exception) {}

        // Register Native JavaScript Bridge
        webView.addJavascriptInterface(KrmziBridge(), "KrmziBridge")

        // Configure Chrome Client
        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                // Strictly block external popups from third-party ad networks
                return false
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                webView.visibility = View.GONE
                container.addView(view)
                hideSystemBars(true)
            }

            override fun onHideCustomView() {
                if (customView == null) return
                webView.visibility = View.VISIBLE
                container.removeView(customView)
                customView = null
                customViewCallback?.onCustomViewHidden()
                hideSystemBars(false)
            }
        }

        // Configure WebViewClient with Asset Loader & CORS-enabled Scraper interception
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val reqUri = request?.url ?: return null
                val path = reqUri.path ?: ""
                val host = reqUri.host?.lowercase() ?: ""

                // 1. Intercept relative or absolute /api/ requests ONLY for local app
                val isLocalApp = host == "appassets.androidplatform.net" || host == "localhost" || host == "127.0.0.1" || host.isEmpty()
                if (isLocalApp && path.contains("/api/")) {
                    return try {
                        val json = KrmziScraper.handle(reqUri.toString())
                        val headers = mutableMapOf(
                            "Access-Control-Allow-Origin" to "*",
                            "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
                            "Access-Control-Allow-Headers" to "*",
                            "Cache-Control" to "no-cache"
                        )
                        WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            200,
                            "OK",
                            headers,
                            json.byteInputStream(Charsets.UTF_8)
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Scraper interception error: ${e.message}")
                        WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            500,
                            "Internal Error",
                            mapOf("Access-Control-Allow-Origin" to "*"),
                            """{"error":"${e.message}"}""".byteInputStream(Charsets.UTF_8)
                        )
                    }
                }

                // 2. Delegate to AndroidX Asset Loader
                val assetResponse = assetLoader.shouldInterceptRequest(reqUri)
                if (assetResponse != null) {
                    return assetResponse
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString()?.lowercase() ?: ""

                // 1. Allow internal app asset navigation
                if (url.startsWith("https://appassets.androidplatform.net") || url.startsWith("file://")) {
                    return false
                }

                // 2. Allow ALL subframe requests (video players, iframes, chunks, CDNs)
                if (request?.isForMainFrame == false) {
                    return false
                }

                // 3. For main frame navigations: allow known streaming sources, block external ad takeovers
                if (url.contains("krmzi.org") ||
                    url.contains("ok.ru") ||
                    url.contains("okcdn") ||
                    url.contains("mycdn.me") ||
                    url.contains("arabhd") ||
                    url.contains("arabveturk") ||
                    url.contains("turkvearab") ||
                    url.contains("artrk.online") ||
                    url.contains("iplayerhls") ||
                    url.contains("youdboox") ||
                    url.contains("extreamnow") ||
                    url.contains("embedo") ||
                    url.contains("dailymotion") ||
                    url.contains("youtube")
                ) {
                    return false
                }

                // Block external pop-up / ad redirects attempting to hijack the main app window
                Log.d(TAG, "Blocked external popup navigation to: $url")
                return true
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    Log.w(TAG, "MainFrame error: ${error?.description}")
                }
            }
        }
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    webView.webChromeClient?.onHideCustomView()
                    return
                }

                webView.evaluateJavascript(
                    """
                    (function() {
                        const sheet = document.getElementById('sheetBackdrop');
                        if (sheet && !sheet.classList.contains('hidden')) {
                            sheet.classList.add('hidden');
                            return true;
                        }
                        const player = document.getElementById('mobilePlayer');
                        if (player && !player.classList.contains('hidden')) {
                            const btn = document.getElementById('dismissPlayerBtn');
                            if (btn) btn.click();
                            return true;
                        }
                        const search = document.getElementById('searchOverlay');
                        if (search && !search.classList.contains('hidden')) {
                            search.classList.add('hidden');
                            return true;
                        }
                        return false;
                    })()
                    """.trimIndent()
                ) { result ->
                    if (result != "true") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Only enter Picture-in-Picture when an actual video is active
        if (isVideoPlaying && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
                enterPictureInPictureMode(params)
            } catch (e: Exception) {
                Log.w(TAG, "PiP error: ${e.message}")
            }
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        val script = if (isInPictureInPictureMode) {
            "document.getElementById('playerHudTop')?.classList.add('hud-hidden'); document.getElementById('playerHudBottom')?.classList.add('hud-hidden');"
        } else {
            "document.getElementById('playerHudTop')?.classList.remove('hud-hidden'); document.getElementById('playerHudBottom')?.classList.remove('hud-hidden');"
        }
        webView.evaluateJavascript(script, null)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars(false)
        }
    }

    private fun hideSystemBars(fullscreen: Boolean) {
        try {
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            if (fullscreen) {
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.hide(WindowInsetsCompat.Type.statusBars())
            }
        } catch (_: Exception) {}
    }
}
