// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.demo.tauri

import android.app.Activity
import android.view.View
import android.webkit.WebView
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
  lateinit var onChange: Channel
}

@TauriPlugin
class SafeAreaPlugin(activity: Activity) : Plugin(activity) {
  private lateinit var content: View
  private var onChange: Channel? = null
  private var lastSafeArea: Insets? = null

  override fun load(webView: WebView) {
    // Preserve WebView's own inset listener on older Android releases.
    content = webView.parent as View
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      publish(ViewCompat.getRootWindowInsets(view) ?: insets)
      ViewCompat.onApplyWindowInsets(view, insets)
    }
  }

  @Command
  fun watchSafeArea(invoke: Invoke) {
    if (!::content.isInitialized) {
      invoke.reject("WebView is not ready")
      return
    }
    onChange = invoke.parseArgs(WatchSafeAreaArgs::class.java).onChange
    lastSafeArea = null
    ViewCompat.getRootWindowInsets(content)?.let(::publish)
    ViewCompat.requestApplyInsets(content)
    invoke.resolve()
  }

  private fun publish(insets: WindowInsetsCompat) {
    val channel = onChange ?: return
    val safeArea = insets.getInsetsIgnoringVisibility(
      WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
    )
    if (safeArea == lastSafeArea) return
    lastSafeArea = safeArea
    channel.send(JSObject().apply {
      put("top", safeArea.top)
      put("right", safeArea.right)
      put("bottom", safeArea.bottom)
      put("left", safeArea.left)
    })
  }
}
