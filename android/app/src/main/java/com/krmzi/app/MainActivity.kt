package com.krmzi.app

import android.annotation.SuppressLint
import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge immersive styling
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        hideSystemUI()

        webView = WebView(this)
        setContentView(webView)

        webView.setBackgroundColor(Color.parseColor("#060709"))

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                // Strictly block any external popup window from ads
                return false
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                val path = url.path ?: ""

                // Intercept any local or relative /api/ requests and serve from native Kotlin Scraper!
                if (path.contains("/api/")) {
                    return try {
                        val json = KrmziScraper.handle(url.toString())
                        WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            json.byteInputStream(Charsets.UTF_8)
                        )
                    } catch (e: Exception) {
                        WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            """{"error":"${e.message}"}""".byteInputStream(Charsets.UTF_8)
                        )
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: ""
                // Keep file and internal navigation inside WebView, ignore external ad redirects
                if (url.startsWith("file://") || url.contains("krmzi.org") || url.contains("ok.ru") || url.contains("arabhd")) {
                    return false
                }
                return true
            }
        }

        // Back button navigation handling
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    """
                    (function() {
                        const player = document.getElementById('mobilePlayer');
                        const search = document.getElementById('searchOverlay');
                        const sheet = document.getElementById('sheetBackdrop');
                        if (sheet && !sheet.classList.contains('hidden')) {
                            sheet.classList.add('hidden');
                            return true;
                        }
                        if (player && !player.classList.contains('hidden')) {
                            const btn = document.getElementById('dismissPlayerBtn');
                            if (btn) btn.click();
                            return true;
                        }
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

        // Load the local offline bundle
        webView.loadUrl("file:///android_asset/public/index.html")
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // Automatic Picture-in-Picture when user goes home while watching video
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
                enterPictureInPictureMode(params)
            } catch (_: Exception) {}
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isInPictureInPictureMode) {
            webView.evaluateJavascript(
                "document.getElementById('playerHudTop')?.classList.add('hud-hidden'); document.getElementById('playerHudBottom')?.classList.add('hud-hidden');",
                null
            )
        }
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                it.hide(WindowInsets.Type.systemBars())
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }
}
