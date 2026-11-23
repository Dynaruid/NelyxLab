// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.backend

import android.app.Activity
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

@TauriPlugin
class SafeAreaPlugin(private val activity: Activity) : Plugin(activity) {
    private data class Subscription(val id: String, val channel: Channel, var last: Insets? = null)
    private val subscriptions = mutableMapOf<String, Subscription>()
    private var content: View? = null

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

    override fun onDestroy(activity: AppCompatActivity) {
        if (activity != this.activity) return
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
