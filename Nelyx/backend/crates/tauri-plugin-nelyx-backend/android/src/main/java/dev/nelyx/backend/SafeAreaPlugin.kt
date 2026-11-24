// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.backend

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Process
import android.provider.OpenableColumns
import android.view.View
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.concurrent.Executors

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

@TauriPlugin
class SafeAreaPlugin(private val activity: Activity) : Plugin(activity) {
    private data class Subscription(val id: String, val channel: Channel, var last: Insets? = null)
    private val subscriptions = mutableMapOf<String, Subscription>()
    private var content: View? = null
    private var dispatchingBack = false
    private val documentQueries = Executors.newSingleThreadExecutor()

    override fun load(webView: WebView) {
        // Listen on the host content so the WebView retains its own IME inset handling.
        val host = webView.parent as View
        content = host
        ViewCompat.setOnApplyWindowInsetsListener(host) { view, insets ->
            val current = ViewCompat.getRootWindowInsets(view) ?: insets
            subscriptions.values.forEach { publish(it, current) }
            ViewCompat.onApplyWindowInsets(view, insets)
        }
    }

    @Command
    fun watchSafeArea(invoke: Invoke) {
        val args = invoke.parseArgs(WatchSafeAreaArgs::class.java)
        activity.runOnUiThread {
            val host = content
            if (host == null) {
                invoke.reject("WebView is not ready")
                return@runOnUiThread
            }
            val subscription = Subscription(args.subscription, args.onChange)
            subscriptions[args.view] = subscription
            ViewCompat.getRootWindowInsets(host)?.let { publish(subscription, it) }
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
    }

    private fun publish(subscription: Subscription, insets: WindowInsetsCompat) {
        val safeArea = insets.getInsetsIgnoringVisibility(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        )
        if (safeArea == subscription.last) return
        subscription.last = safeArea
        subscription.channel.send(JSObject().apply {
            put("top", safeArea.top)
            put("right", safeArea.right)
            put("bottom", safeArea.bottom)
            put("left", safeArea.left)
        })
    }
}
