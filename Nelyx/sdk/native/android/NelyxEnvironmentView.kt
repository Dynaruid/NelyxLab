// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import android.content.res.Configuration
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowInsets
import android.view.ViewConfiguration
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

private class EnvironmentEvent(surface: Int,tag: Int,private val snapshot: WritableMap) : Event<EnvironmentEvent>(surface,tag) {
    override fun getEventName(): String="topNelyxEnvironment"
    override fun canCoalesce(): Boolean=false
    override fun getEventData(): WritableMap=snapshot
}
class NelyxEnvironmentManager : SimpleViewManager<NelyxEnvironmentView>() {
    override fun getName(): String="NelyxEnvironment"
    override fun createViewInstance(context: ThemedReactContext): NelyxEnvironmentView=NelyxEnvironmentView(context)
    override fun getExportedCustomDirectEventTypeConstants(): Map<String,Any> = mapOf("topNelyxEnvironment" to mapOf("registrationName" to "onNelyxEnvironment"))
    override fun onDropViewInstance(view: NelyxEnvironmentView) {view.close();super.onDropViewInstance(view)}
}
/** A surface-owned observer. It does not replace/consume an ancestor's WindowInsets listener. */
class NelyxEnvironmentView(private val reactContext: ThemedReactContext) : View(reactContext) {
    private var live=true
    private var queued=false
    private var previous=""
    private var revision=0L
    private var observedTree: ViewTreeObserver?=null
    private val globalLayout=ViewTreeObserver.OnGlobalLayoutListener {schedule()}
    private val publishTask=Runnable {queued=false;publish()}
    init {importantForAccessibility=IMPORTANT_FOR_ACCESSIBILITY_NO;isClickable=false;isFocusable=false}
    override fun onAttachedToWindow() {super.onAttachedToWindow();observedTree=viewTreeObserver;observedTree?.addOnGlobalLayoutListener(globalLayout);requestApplyInsets();schedule()}
    override fun onDetachedFromWindow() {stopObserving();super.onDetachedFromWindow()}
    override fun onApplyWindowInsets(insets: WindowInsets): WindowInsets {schedule();return super.onApplyWindowInsets(insets)}
    override fun onConfigurationChanged(configuration: Configuration) {super.onConfigurationChanged(configuration);schedule()}
    private fun stopObserving() {observedTree?.let {if(it.isAlive)it.removeOnGlobalLayoutListener(globalLayout)};observedTree=null;removeCallbacks(publishTask);queued=false}
    private fun schedule() {if(!live||queued)return;queued=true;post(publishTask)}
    private fun publish() {
        if(!live||!isAttachedToWindow||id==NO_ID)return
        val surface=parent as? View ?: return
        if(surface.width<=0||surface.height<=0)return
        val density=resources.displayMetrics.density
        var top=0f;var right=0f;var bottom=0f;var left=0f;var keyboard=0f
        var safeSource="application";var keyboardSource="unavailable"
        val insets=rootWindowInsets
        if(Build.VERSION.SDK_INT>=30&&insets!=null){
            val bars=insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            val ime=insets.getInsets(WindowInsets.Type.ime())
            val surfaceLocation=IntArray(2);surface.getLocationOnScreen(surfaceLocation)
            val rootLocation=IntArray(2);rootView.getLocationOnScreen(rootLocation)
            val x=surfaceLocation[0]-rootLocation[0];val y=surfaceLocation[1]-rootLocation[1]
            fun horizontal(value: Int): Float=value.coerceIn(0,surface.width)/density
            fun vertical(value: Int): Float=value.coerceIn(0,surface.height)/density
            left=horizontal(bars.left-x);right=horizontal(x+surface.width-(rootView.width-bars.right))
            top=vertical(bars.top-y)
            val dockedIme=insets.isVisible(WindowInsets.Type.ime())&&ime.bottom>bars.bottom
            bottom=if(dockedIme)0f else vertical(y+surface.height-(rootView.height-bars.bottom))
            if(insets.isVisible(WindowInsets.Type.ime())){
                val visible=Rect();rootView.getWindowVisibleDisplayFrame(visible)
                // Measure overlap with this surface; an already resized/panned surface adds no second inset.
                keyboard=vertical(surfaceLocation[1]+surface.height-visible.bottom)
            }
            safeSource="native";keyboardSource="native-ime"
        }
        val textScale=resources.configuration.fontScale
        val touchSlop=ViewConfiguration.get(surface.context).scaledTouchSlop
        val signature="$top,$right,$bottom,$left,$keyboard,$textScale,$safeSource,$keyboardSource,$touchSlop"
        if(signature==previous)return
        previous=signature;revision++
        val environment=Arguments.createMap().apply {
            putMap("safeArea",Arguments.createMap().apply {putDouble("top",top.toDouble());putDouble("right",right.toDouble());putDouble("bottom",bottom.toDouble());putDouble("left",left.toDouble())})
            putString("safeAreaSource",safeSource);putDouble("keyboardInset",keyboard.toDouble());putString("keyboardSource",keyboardSource);putDouble("textScale",textScale.toDouble());putString("textScaleSource","native")
            putMap("gestureSettings",Arguments.createMap().apply {putDouble("physicalTouchSlop",touchSlop.toDouble());putNull("physicalDoubleTapSlop")});putString("gestureSettingsSource","native")
        }
        val snapshot=Arguments.createMap().apply {putDouble("revision",revision.toDouble());putMap("environment",environment)}
        UIManagerHelper.getEventDispatcherForReactTag(reactContext,id)?.dispatchEvent(EnvironmentEvent(UIManagerHelper.getSurfaceId(this),id,snapshot))
    }
    fun close() {live=false;stopObserving()}
}
