// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.platformviews

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.Rect
import android.graphics.SurfaceTexture
import android.util.Base64
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.webkit.WebView
import android.widget.EditText
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.doAfterTextChanged
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import org.json.JSONObject
import kotlin.math.roundToInt

@InvokeArg
class NativeViewOwner {
    var id: String = ""
    var generation: Long = 0
}

@InvokeArg
class NativeViewControlArgs {
    lateinit var owner: NativeViewOwner
    var action: String = ""
    var instanceId: Long? = null
    var viewType: String = ""
    var text: String = ""
    var through: Long = 0
    var window: String = ""
    var events: Channel? = null
}

@InvokeArg
class NativeViewFrameArgs {
    lateinit var packet: String
}

@TauriPlugin
class PlatformViewsPlugin(private val activity: Activity) : Plugin(activity) {
    private data class Owner(val id: String, val generation: Long)
    private data class Control(val frame: FrameLayout, val editor: EditText)
    private data class Placement(val id: Long, val bounds: Rect, val clip: Rect)
    private data class Geometry(val width: Int, val height: Int, val scale: Double, val x: Int, val y: Int)
    private data class Input(val id: Long, val bounds: Rect)
    private data class Scene(
        val token: LongArray,
        val geometry: Geometry,
        val placements: List<Placement>,
        val input: List<Input>,
        val wire: ByteArray,
    ) {
        val sequence get() = token[1]
        val viewport get() = token[2]
    }

    private class Pending(val scene: Scene, val bitmap: Bitmap, val invoke: Invoke)

    private class Session(val owner: Owner, val window: String, val events: Channel, val overlay: FrameLayout) {
        val controls = mutableMapOf<Long, Control>()
        val hitRegions = mutableListOf<HitRegion>()
        var foreground: TextureView? = null
        var pending: Pending? = null
        var submitted: LongArray? = null
        var through: Long = 0

        fun send(event: JSObject) {
            events.send(JSObject().apply {
                put("window", window)
                put("owner", JSObject().apply { put("id", owner.id); put("generation", owner.generation) })
                put("event", event)
            })
        }
    }

    private var webView: WebView? = null
    private var active: Session? = null
    private var paused = false
    private val skia = Executors.newSingleThreadExecutor()

    override fun load(webView: WebView) {
        if (this.webView !== webView) close()
        this.webView = webView
    }

    override fun onPause(activity: AppCompatActivity) {
        paused = true
        active?.let { hide(it) }
    }

    override fun onResume(activity: AppCompatActivity) { paused = false }

    override fun onDestroy(activity: AppCompatActivity) {
        close()
        webView = null
        skia.shutdownNow()
    }

    @Command
    fun control(invoke: Invoke) {
        val args = invoke.parseArgs(NativeViewControlArgs::class.java)
        activity.runOnUiThread {
            try {
                handle(args)
                invoke.resolve()
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Android platform view command failed")
            }
        }
    }

    private fun handle(args: NativeViewControlArgs) {
        val view = webView ?: error("Android WebView is unavailable")
        val parent = view.parent as? ViewGroup ?: error("Android WebView has no ViewGroup parent")
        val owner = Owner(args.owner.id, args.owner.generation)
        require(owner.id.isNotEmpty() && owner.id.length <= 80 && owner.generation in 1..MAX_ID) { "Invalid native view owner" }
        val action = args.action
        if (action == "open") {
            val events = args.events ?: error("Native view event channel is required")
            require(args.window.isNotEmpty()) { "Native view window is required" }
            if (active?.owner == owner) error("The native view session already exists")
            close()
            val overlay = FrameLayout(activity).apply {
                clipChildren = true
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            parent.addView(overlay, ViewGroup.LayoutParams(-1, -1))
            active = Session(owner, args.window, events, overlay)
            return
        }
        val session = active?.takeIf { it.owner == owner } ?: error("Stale native view owner")
        val id = args.instanceId ?: 0
        when (action) {
            "create" -> {
                val initial = args.text
                require(args.viewType == "nelyx.android.edit" && id in 1..MAX_ID &&
                    !session.controls.containsKey(id) && session.controls.size < 8 && initial.length <= 65_536) { "Invalid native control registration" }
                val editor = EditText(activity).apply {
                    setBackgroundColor(Color.WHITE)
                    setTextColor(Color.BLACK)
                    setSingleLine(false)
                    gravity = android.view.Gravity.TOP
                    setText(initial)
                    doAfterTextChanged { editable ->
                        if (active === session && session.controls.containsKey(id))
                            session.send(JSObject().apply {
                                put("kind", "input")
                                put("instanceId", id)
                                put("value", editable?.toString() ?: "")
                            })
                    }
                    setOnKeyListener { _, code, event ->
                        if (code != KeyEvent.KEYCODE_TAB) false else {
                            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0)
                                session.send(JSObject().apply {
                                    put("kind", "tab")
                                    put("instanceId", id)
                                    put("backwards", event.isShiftPressed)
                                })
                            true
                        }
                    }
                }
                val clip = FrameLayout(activity).apply {
                    clipChildren = true
                    visibility = View.INVISIBLE
                    addView(editor, FrameLayout.LayoutParams(-1, -1))
                }
                session.overlay.addView(clip, FrameLayout.LayoutParams(0, 0))
                session.controls[id] = Control(clip, editor)
            }
            "update" -> {
                val editor = session.controls[id]?.editor ?: error("Unknown native control")
                val text = args.text
                require(text.length <= 65_536) { "Native control text is too large" }
                if (editor.text.toString() != text) editor.setText(text)
            }
            "focus" -> {
                if (id == 0L) view.requestFocus() else {
                    val control = session.controls[id] ?: error("Unknown native control")
                    require(control.frame.visibility == View.VISIBLE && control.editor.requestFocus()) { "The native control could not receive focus" }
                }
            }
            "remove" -> session.controls.remove(id)?.let {
                hideControl(it)
                session.overlay.removeView(it.frame)
                hide(session)
            }
            "hide" -> {
                val through = args.through
                require(through in 0..MAX_ID) { "Invalid native view sequence" }
                session.through = maxOf(session.through, through)
                if ((session.submitted?.get(1) ?: 0) <= through) hide(session)
            }
            "close" -> close()
            else -> error("Unknown native view command")
        }
    }

    @Command
    fun frame(invoke: Invoke) {
        val encoded = invoke.parseArgs(NativeViewFrameArgs::class.java).packet
        activity.runOnUiThread {
            try {
                require(encoded.length <= 512 * 1024) { "Android foreground is too large" }
                val packet = Base64.decode(encoded, Base64.DEFAULT)
                val session = active ?: error("Native view session is closed")
                val scene = decode(session, packet)
                if (paused || stale(session, scene)) {
                    invoke.resolve()
                } else if (scene.wire.isEmpty()) {
                    retireForeground(session)
                    place(session, scene)
                    invoke.resolve()
                } else {
                    skia.execute { render(session, scene, invoke) }
                }
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Android native frame failed")
            }
        }
    }

    private fun decode(session: Session, packet: ByteArray): Scene {
        require(packet.size in 8..384 * 1024) { "Invalid Android frame length" }
        val header = ByteBuffer.wrap(packet).order(ByteOrder.LITTLE_ENDIAN)
        require(header.int == 1) { "Unsupported Android platform view wire" }
        val metadataLength = header.int
        require(metadataLength in 1..minOf(packet.size - 8, 65_528)) { "Invalid Android geometry packet length" }
        val meta = JSONObject(String(packet, 8, metadataLength, Charsets.UTF_8))
        val owner = meta.getJSONObject("owner")
        require(Owner(owner.getString("id"), owner.getLong("generation")) == session.owner) { "Stale native frame owner" }
        val key = longArrayOf(session.owner.generation, meta.getLong("sequence"), meta.getLong("viewportGeneration"),
            meta.getLong("rendererGeneration"), meta.getLong("contextGeneration"), meta.getLong("surfaceGeneration"))
        require(key.all { it in 0..MAX_ID } && key.take(4).all { it > 0 }) { "Invalid Android frame generation" }
        val scale = meta.getDouble("scale")
        val width = meta.getInt("width")
        val height = meta.getInt("height")
        require(scale > 0.0 && scale <= 64.0 && width in 1..16_384 && height in 1..16_384 &&
            width.toLong() * height <= 16_777_216) { "Invalid Android foreground dimensions" }
        val webOffset = IntArray(2)
        val overlayOffset = IntArray(2)
        (webView ?: error("Android WebView closed")).getLocationInWindow(webOffset)
        session.overlay.getLocationInWindow(overlayOffset)
        val origin = meta.getJSONArray("origin")
        val geometry = Geometry(width, height, scale,
            pixel(origin.getDouble(0) * scale + webOffset[0] - overlayOffset[0]),
            pixel(origin.getDouble(1) * scale + webOffset[1] - overlayOffset[1]))
        val placementJson = meta.getJSONArray("placements")
        val inputJson = meta.getJSONArray("input")
        require(placementJson.length() <= 8 && inputJson.length() <= 128) { "Android native regions exceed their limit" }
        val placements = List(placementJson.length()) { index ->
            val row = placementJson.getJSONObject(index)
            val id = row.getLong("instanceId")
            require(session.controls.containsKey(id)) { "Unknown Android native view" }
            val bounds = rectangle(row.getJSONObject("bounds"), geometry)
            Placement(id, bounds, clipping(rectangle(row.getJSONObject("clip"), geometry), bounds))
        }
        val input = List(inputJson.length()) { index ->
            val row = inputJson.getJSONObject(index)
            val id = row.getLong("instanceId")
            val clip = placements.firstOrNull { it.id == id }?.clip ?: error("Unknown Android hit target")
            Input(id, clipping(rectangle(row.getJSONObject("rect"), geometry), clip))
        }.filter { !it.bounds.isEmpty }.distinct()
        return Scene(key, geometry, placements, input, packet.copyOfRange(8 + metadataLength, packet.size))
    }

    private fun pixel(value: Double): Int {
        require(value.isFinite() && value in -65_536.0..65_536.0) { "Invalid Android view coordinate" }
        return value.roundToInt()
    }

    private fun rectangle(value: JSONObject, geometry: Geometry): Rect {
        val x = value.getDouble("x")
        val y = value.getDouble("y")
        val width = value.getDouble("width")
        val height = value.getDouble("height")
        require(width >= 0 && height >= 0) { "Invalid Android view bounds" }
        return Rect(pixel(x * geometry.scale + geometry.x), pixel(y * geometry.scale + geometry.y),
            pixel((x + width) * geometry.scale + geometry.x), pixel((y + height) * geometry.scale + geometry.y))
    }

    private fun clipping(rect: Rect, clip: Rect) = Rect(rect).apply { if (!intersect(clip)) setEmpty() }

    private fun stale(session: Session, scene: Scene): Boolean {
        val last = session.submitted
        return scene.sequence <= session.through || (last != null &&
            (scene.sequence <= last[1] || (2..5).any { scene.token[it] < last[it] }))
    }

    private fun render(session: Session, scene: Scene, invoke: Invoke) {
        val (width, height, scale) = scene.geometry
        val bitmap = try {
            val pixels = rasterize(scene.wire, scene.token, width, height, scale) ?: error("Unsupported Android Skia foreground")
            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
                copyPixelsFromBuffer(ByteBuffer.wrap(pixels))
            }
        } catch (error: Exception) {
            activity.runOnUiThread {
                if (active === session && !stale(session, scene)) hide(session, "Android Skia foreground failed")
                invoke.reject(error.message ?: "Android Skia foreground failed")
            }
            return
        }
        activity.runOnUiThread {
            if (active !== session || paused || stale(session, scene)) {
                bitmap.recycle()
                invoke.resolve()
            } else {
                val pending = Pending(scene, bitmap, invoke)
                session.pending = pending
                val surface = session.foreground ?: createForeground(session)
                if (surface.isAvailable) commit(session, surface)
                else surface.postDelayed({
                    if (session.pending === pending) hide(session, "Android texture did not become available")
                }, 800)
            }
        }
    }

    private fun createForeground(session: Session): TextureView {
        val surface = TextureView(activity).apply {
            isOpaque = false
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) {
                    if (active === session) commit(session, this@apply)
                }
                override fun onSurfaceTextureSizeChanged(texture: SurfaceTexture, width: Int, height: Int) {}
                override fun onSurfaceTextureUpdated(texture: SurfaceTexture) {}
                override fun onSurfaceTextureDestroyed(texture: SurfaceTexture): Boolean {
                    if (session.foreground === this@apply) {
                        retirePending(session, "Android texture was destroyed")
                        clearHits(session)
                        for (control in session.controls.values) hideControl(control)
                    }
                    return true
                }
            }
        }
        session.foreground = surface
        session.overlay.addView(surface, FrameLayout.LayoutParams(-1, -1))
        return surface
    }

    private fun commit(session: Session, surface: TextureView) {
        val pending = session.pending ?: return
        session.pending = null
        try {
            val canvas = surface.lockCanvas() ?: error("Android texture canvas was unavailable")
            try {
                canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
                canvas.drawBitmap(pending.bitmap, pending.scene.geometry.x.toFloat(), pending.scene.geometry.y.toFloat(), null)
            } finally { surface.unlockCanvasAndPost(canvas) }
            place(session, pending.scene)
            pending.invoke.resolve()
        } catch (error: Exception) {
            hide(session, "Android foreground submission failed")
            pending.invoke.reject(error.message ?: "Android foreground submission failed")
        } finally { pending.bitmap.recycle() }
    }

    private fun place(session: Session, scene: Scene) {
        for ((id, control) in session.controls) {
            val placement = scene.placements.firstOrNull { it.id == id }
            if (placement == null || placement.clip.isEmpty) {
                hideControl(control)
            } else {
                val bounds = placement.bounds
                control.frame.layoutParams = layout(placement.clip)
                control.editor.layoutParams = layout(Rect(bounds).apply { offset(-placement.clip.left, -placement.clip.top) })
                // The clip may crop the visible edges while the editor keeps its original layout.
                control.frame.visibility = View.VISIBLE
                control.frame.bringToFront()
            }
        }
        session.foreground?.bringToFront()
        if (session.hitRegions.map { it.input } != scene.input) {
            clearHits(session)
            for (region in scene.input) {
                val hit = HitRegion(activity, session, region, scene)
                session.overlay.addView(hit, layout(region.bounds))
                session.hitRegions.add(hit)
            }
        }
        for (hit in session.hitRegions) { hit.scene = scene; hit.bringToFront() }
        session.submitted = scene.token
    }

    private fun layout(bounds: Rect) = FrameLayout.LayoutParams(bounds.width(), bounds.height()).apply {
        leftMargin = bounds.left
        topMargin = bounds.top
    }

    private fun clearHits(session: Session) {
        for (hit in session.hitRegions) { hit.cancel(); session.overlay.removeView(hit) }
        session.hitRegions.clear()
    }

    private fun retirePending(session: Session, reason: String?) {
        val pending = session.pending ?: return
        session.pending = null
        pending.bitmap.recycle()
        if (reason == null) pending.invoke.resolve() else pending.invoke.reject(reason)
    }

    private fun retireForeground(session: Session, reason: String? = null) {
        retirePending(session, reason)
        val surface = session.foreground ?: return
        session.foreground = null
        session.overlay.removeView(surface)
    }

    private fun hideControl(control: Control) {
        if (control.frame.visibility != View.VISIBLE) return
        val editor = control.editor
        val input = activity.getSystemService(InputMethodManager::class.java)
        if (editor.isFocused || input?.isActive(editor) == true) {
            WindowCompat.getInsetsController(activity.window, editor).hide(WindowInsetsCompat.Type.ime())
        }
        editor.clearFocus()
        control.frame.visibility = View.INVISIBLE
    }

    private fun hide(session: Session, reason: String? = null) {
        clearHits(session)
        for (control in session.controls.values) hideControl(control)
        retireForeground(session, reason)
    }

    private fun close() {
        val session = active ?: return
        active = null
        hide(session)
        (session.overlay.parent as? ViewGroup)?.removeView(session.overlay)
    }

    private class HitRegion(activity: Activity, private val session: Session, val input: Input, var scene: Scene) : View(activity) {
        private var pointer: Int? = null
        private var x = 0f
        private var y = 0f

        init { importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            if (event.actionMasked == MotionEvent.ACTION_DOWN) pointer = event.getPointerId(0)
            val id = pointer ?: return true
            val index = event.findPointerIndex(id)
            if (index >= 0) {
                x = event.getX(index)
                y = event.getY(index)
            }
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> emit("down")
                MotionEvent.ACTION_MOVE -> if (index >= 0) emit("move") else cancel()
                MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> if (event.actionIndex == index) {
                    pointer = null
                    emit("up")
                }
                MotionEvent.ACTION_CANCEL -> cancel()
            }
            return true
        }

        fun cancel() { if (pointer != null) { pointer = null; emit("cancel") } }

        private fun emit(kind: String) {
            val geometry = scene.geometry
            session.send(JSObject().put("kind", kind).put("sequence", scene.sequence)
                .put("viewportGeneration", scene.viewport).put("device", "touch")
                .put("x", (x + input.bounds.left - geometry.x) / geometry.scale)
                .put("y", (y + input.bounds.top - geometry.y) / geometry.scale))
        }
    }

    private external fun rasterize(packet: ByteArray, token: LongArray, width: Int, height: Int, scale: Double): ByteArray?

    companion object { private const val MAX_ID = 9_007_199_254_740_991L }
}
