// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.backend

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.OpenableColumns
import android.view.View
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.fasterxml.jackson.databind.JsonNode
import java.util.concurrent.Executors
import org.json.JSONObject

@InvokeArg
class WatchSafeAreaArgs {
    lateinit var view: String
    lateinit var subscription: String
    lateinit var onChange: Channel
}

@InvokeArg
class UnwatchSafeAreaArgs {
    lateinit var view: String
    lateinit var subscription: String
}

@InvokeArg
class DeviceFileNameArgs {
    lateinit var uri: String
}

@InvokeArg
class SystemChromeArgs {
    lateinit var method: String
    var arguments: JsonNode? = null
}

@TauriPlugin
class SafeAreaPlugin(private val activity: Activity) : Plugin(activity) {
    private data class InsetsSnapshot(val safeArea: Insets, val keyboardTop: Int?)
    private data class Subscription(val id: String, val channel: Channel, var last: InsetsSnapshot? = null)
    private data class SystemOverlays(
        val top: Boolean,
        val bottom: Boolean,
        val behavior: Int = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT,
    )
    private val subscriptions = mutableMapOf<String, Subscription>()
    private var content: View? = null
    private var webView: WebView? = null
    private val webViewLocation = IntArray(2)
    private val layoutListener = View.OnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
        ViewCompat.getRootWindowInsets(view)?.let { insets -> publishInsets(insets, view) }
    }
    private var dispatchingBack = false
    private var systemOverlays = SystemOverlays(top = true, bottom = true)
    private val documentQueries = Executors.newSingleThreadExecutor()

    override fun load(webView: WebView) {
        // Listen on the host content so the WebView retains its own IME inset handling.
        val host = webView.parent as View
        this.webView?.removeOnLayoutChangeListener(layoutListener)
        if (content !== host) content?.let { ViewCompat.setOnApplyWindowInsetsListener(it, null) }
        this.webView = webView
        content = host
        webView.addOnLayoutChangeListener(layoutListener)
        ViewCompat.setOnApplyWindowInsetsListener(host) { view, insets ->
            val current = ViewCompat.getRootWindowInsets(view) ?: insets
            publishInsets(current, webView)
            ViewCompat.onApplyWindowInsets(view, insets)
        }
    }

    @Command
    fun watchSafeArea(invoke: Invoke) {
        val args = invoke.parseArgs(WatchSafeAreaArgs::class.java)
        activity.runOnUiThread {
            val host = content
            val view = webView
            if (host == null || view == null) {
                invoke.reject("WebView is not ready")
                return@runOnUiThread
            }
            val subscription = Subscription(args.subscription, args.onChange)
            subscriptions[args.view] = subscription
            ViewCompat.getRootWindowInsets(host)?.let { publishInsets(it, view) }
            ViewCompat.requestApplyInsets(host)
            invoke.resolve()
        }
    }

    @Command
    fun unwatchSafeArea(invoke: Invoke) {
        val args = invoke.parseArgs(UnwatchSafeAreaArgs::class.java)
        activity.runOnUiThread {
            if (subscriptions[args.view]?.id == args.subscription) subscriptions.remove(args.view)
            invoke.resolve()
        }
    }

    @Command
    fun dispatchDefaultBack(invoke: Invoke) {
        activity.runOnUiThread {
            val host = activity as AppCompatActivity
            if (dispatchingBack || host.isFinishing || host.isDestroyed) {
                invoke.resolve()
                return@runOnUiThread
            }
            dispatchingBack = true
            try {
                // The frontend has already unregistered its Tauri core listener.
                host.onBackPressedDispatcher.onBackPressed()
                invoke.resolve()
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Android back dispatch failed")
            } finally {
                dispatchingBack = false
            }
        }
    }

    @Command
    fun systemChrome(invoke: Invoke) {
        val request = invoke.parseArgs(SystemChromeArgs::class.java)
        activity.runOnUiThread {
            try {
                val args = request.arguments
                when (request.method) {
                    "SystemChrome.setPreferredOrientations" ->
                        activity.requestedOrientation = requestedOrientation(requireNotNull(args))
                    "SystemChrome.setEnabledSystemUIMode" -> {
                        systemOverlays = when (args?.asText()) {
                            "SystemUiMode.edgeToEdge" -> SystemOverlays(top = true, bottom = true)
                            "SystemUiMode.immersiveSticky" -> SystemOverlays(
                                top = false,
                                bottom = false,
                                behavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE,
                            )
                            "SystemUiMode.leanBack", "SystemUiMode.immersive" ->
                                SystemOverlays(top = false, bottom = false)
                            else -> error("Unknown system UI mode")
                        }
                        applySystemOverlays()
                    }
                    "SystemChrome.setEnabledSystemUIOverlays" -> {
                        val overlays = requireNotNull(args).map { it.asText() }
                        systemOverlays = SystemOverlays(
                            top = "SystemUiOverlay.top" in overlays,
                            bottom = "SystemUiOverlay.bottom" in overlays,
                        )
                        applySystemOverlays()
                    }
                    "SystemChrome.restoreSystemUIOverlays" -> applySystemOverlays()
                    "SystemChrome.setSystemUIOverlayStyle" -> applySystemOverlayStyle(requireNotNull(args))
                    else -> error("Unknown SystemChrome method")
                }
                invoke.resolve()
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Android SystemChrome failed")
            }
        }
    }

    private fun applySystemOverlays() {
        val window = activity.window
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.systemBarsBehavior = systemOverlays.behavior
        val status = WindowInsetsCompat.Type.statusBars()
        val navigation = WindowInsetsCompat.Type.navigationBars()
        val visible = (if (systemOverlays.top) status else 0) or
            (if (systemOverlays.bottom) navigation else 0)
        val hidden = (status or navigation) and visible.inv()
        if (visible != 0) controller.show(visible)
        if (hidden != 0) controller.hide(hidden)
    }

    @Suppress("DEPRECATION")
    private fun applySystemOverlayStyle(style: JsonNode) {
        val window = activity.window
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        val dark = "Brightness.dark"
        style.get("statusBarIconBrightness")?.takeUnless { it.isNull }?.let {
            controller.isAppearanceLightStatusBars = it.asText() == dark
        }
        if (Build.VERSION.SDK_INT >= 26) {
            style.get("systemNavigationBarIconBrightness")?.takeUnless { it.isNull }?.let {
                controller.isAppearanceLightNavigationBars = it.asText() == dark
            }
        }
        if (Build.VERSION.SDK_INT < 35) {
            style.get("statusBarColor")?.takeUnless { it.isNull }?.let {
                window.statusBarColor = it.asLong().toInt()
            }
            if (Build.VERSION.SDK_INT >= 26) {
                style.get("systemNavigationBarColor")?.takeUnless { it.isNull }?.let {
                    window.navigationBarColor = it.asLong().toInt()
                }
            }
            if (Build.VERSION.SDK_INT >= 28) {
                style.get("systemNavigationBarDividerColor")?.takeUnless { it.isNull }?.let {
                    window.navigationBarDividerColor = it.asLong().toInt()
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            style.get("systemStatusBarContrastEnforced")?.takeUnless { it.isNull }?.let {
                window.isStatusBarContrastEnforced = it.asBoolean()
            }
            style.get("systemNavigationBarContrastEnforced")?.takeUnless { it.isNull }?.let {
                window.isNavigationBarContrastEnforced = it.asBoolean()
            }
        }
    }

    private fun requestedOrientation(orientations: JsonNode): Int {
        val requested = orientations.map {
            when (it.asText()) {
                "DeviceOrientation.portraitUp" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                "DeviceOrientation.portraitDown" -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                "DeviceOrientation.landscapeLeft" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                "DeviceOrientation.landscapeRight" -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                else -> error("Unknown device orientation")
            }
        }
        val portrait = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        val landscape = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        val reverseLandscape = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
        return when (requested.toSet()) {
            emptySet<Int>() -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            setOf(portrait, ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT) ->
                ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT
            setOf(landscape, reverseLandscape) -> ActivityInfo.SCREEN_ORIENTATION_USER_LANDSCAPE
            setOf(portrait, landscape, reverseLandscape) -> ActivityInfo.SCREEN_ORIENTATION_USER
            setOf(portrait, ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT, landscape, reverseLandscape) ->
                ActivityInfo.SCREEN_ORIENTATION_FULL_USER
            // Android uses the first orientation when there is no equivalent combination.
            else -> requested.first()
        }
    }

    @Command
    fun deviceFileName(invoke: Invoke) {
        val uri = Uri.parse(invoke.parseArgs(DeviceFileNameArgs::class.java).uri)
        if (uri.scheme != "content" || activity.checkUriPermission(
                uri, Process.myPid(), Process.myUid(), Intent.FLAG_GRANT_READ_URI_PERMISSION
            ) != PackageManager.PERMISSION_GRANTED) {
            invoke.resolve(JSObject())
            return
        }
        documentQueries.execute {
            val response = JSObject()
            try {
                activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                    ?.use { cursor ->
                        if (cursor.moveToFirst()) response.put("name", cursor.getString(0))
                    }
            } catch (_: Exception) {
                // The provider can revoke the grant between the permission check and the query.
            }
            invoke.resolve(response)
        }
    }

    override fun onDestroy(activity: AppCompatActivity) {
        if (activity != this.activity) return
        documentQueries.shutdownNow()
        subscriptions.clear()
        content?.let { ViewCompat.setOnApplyWindowInsetsListener(it, null) }
        content = null
        webView?.removeOnLayoutChangeListener(layoutListener)
        webView = null
    }

    private fun publishInsets(insets: WindowInsetsCompat, view: View) {
        if (subscriptions.isEmpty()) return
        val safeArea = insets.getInsetsIgnoringVisibility(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        )
        val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        val keyboardTop = if (keyboard > 0) {
            view.getLocationInWindow(webViewLocation)
            (activity.window.decorView.height - keyboard - webViewLocation[1]).coerceAtLeast(0)
        } else null
        val snapshot = InsetsSnapshot(safeArea, keyboardTop)
        for (subscription in subscriptions.values) {
            if (snapshot == subscription.last) continue
            subscription.last = snapshot
            subscription.channel.send(JSObject().apply {
                put("top", safeArea.top)
                put("right", safeArea.right)
                put("bottom", safeArea.bottom)
                put("left", safeArea.left)
                put("keyboardTop", keyboardTop ?: JSONObject.NULL)
            })
        }
    }
}
