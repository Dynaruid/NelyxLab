// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.IllegalViewOperationException
import android.view.View
import android.view.SoundEffectConstants
import android.view.HapticFeedbackConstants
import android.view.accessibility.AccessibilityEvent
import android.os.Build
import android.content.Context
import android.provider.Settings
import android.view.accessibility.AccessibilityManager

/** Read the current Configuration, including every preferred app/OS locale.
 * The app-owned SDK observer polls this snapshot and also re-reads on RN
 * lifecycle/configuration events; constants are not cached across changes. */
/** Main-thread ownership, scoped to the actual Activity and React application. No field values are stored. */
internal object NelyxAutofillContext {
    private data class Entry(val owner: java.lang.ref.WeakReference<ReactApplicationContext>,val root: java.lang.ref.WeakReference<View>,val rootTag: Int,var operation: String?=null,var failure: Exception?=null)
    private val contexts=java.util.WeakHashMap<android.app.Activity,Entry>()
    fun accessible(activity: android.app.Activity,owner: ReactApplicationContext,root: View): Boolean {
        UiThreadUtil.assertOnUiThread();val entry=contexts[activity] ?: return true
        return entry.failure==null&&entry.owner.get()===owner&&entry.root.get()===root
    }
    fun begin(activity: android.app.Activity?,owner: ReactApplicationContext,root: View): Boolean {
        UiThreadUtil.assertOnUiThread()
        if(Build.VERSION.SDK_INT<26||activity==null||activity.isDestroyed||root !is NelyxKeyboardHost||!root.isAttachedToWindow||!accessible(activity,owner,root)||activity.getSystemService(android.view.autofill.AutofillManager::class.java)?.isEnabled!=true)return false
        if(contexts[activity]==null)contexts[activity]=Entry(java.lang.ref.WeakReference(owner),java.lang.ref.WeakReference(root),root.id);return true
    }
    fun owned(activity: android.app.Activity,owner: ReactApplicationContext,rootTag: Int,currentRoot: View?=null): Boolean {UiThreadUtil.assertOnUiThread();val entry=contexts[activity];return entry?.owner?.get()===owner&&entry.rootTag==rootTag&&(currentRoot==null||entry.root.get()===currentRoot)}
    fun failure(activity: android.app.Activity,owner: ReactApplicationContext,rootTag: Int,operation: String): Exception? {UiThreadUtil.assertOnUiThread();val entry=contexts[activity];return if(owned(activity,owner,rootTag)&&entry?.operation==operation)entry.failure else null}
    fun block(activity: android.app.Activity,owner: ReactApplicationContext,rootTag: Int,operation: String,error: Exception) {UiThreadUtil.assertOnUiThread();if(owned(activity,owner,rootTag)){contexts[activity]?.operation=operation;contexts[activity]?.failure=error}}
    fun forget(activity: android.app.Activity,owner: ReactApplicationContext,rootTag: Int) {UiThreadUtil.assertOnUiThread();if(owned(activity,owner,rootTag))contexts.remove(activity)}
    private fun cancel(activity: android.app.Activity,owner: ReactApplicationContext,rootTag: Int) {
        try {failure(activity,owner,rootTag,"cancel")?.let {throw it};if(Build.VERSION.SDK_INT>=26&&!activity.isDestroyed)activity.getSystemService(android.view.autofill.AutofillManager::class.java)?.cancel();forget(activity,owner,rootTag)}
        catch(error: Exception) {block(activity,owner,rootTag,"cancel",error);android.util.Log.e("NelyxAutofill","Context cancellation unconfirmed during native retirement",error)}
    }
    fun retireRoot(owner: ReactApplicationContext,root: View) {UiThreadUtil.assertOnUiThread();for((activity,entry) in contexts.toMap())if(entry.owner.get()===owner&&entry.root.get()===root)cancel(activity,owner,entry.rootTag)}
    fun retire(owner: ReactApplicationContext) {UiThreadUtil.runOnUiThread {for((activity,entry) in contexts.toMap())if(entry.owner.get()===owner)cancel(activity,owner,entry.rootTag)}}
}

class NelyxPlatformServices(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    @Volatile private var live = true
    internal val keyboardState=NelyxObservedKeyboardState()
    override fun getName(): String = "NelyxPlatformServices"
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getAccessibilityProtocol(): Int = 1

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getAccessibilityFeatures(): WritableMap {
        val result = Arguments.createMap()
        try {
            check(live) { "Native accessibility module retired" }
            val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
            val reduced = Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
            result.putInt("protocol", 1)
            result.putInt("features", (if(manager.isTouchExplorationEnabled) 1 else 0) or (if(reduced) 4 or 16 else 0))
            result.putInt("supportedFeatures", 1 or 4 or 16)
            result.putBoolean("semanticsEnabled", manager.isEnabled)
        } catch(error: Exception) { result.putString("error", error.toString()) }
        return result
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getFeedbackProtocol(): Int = 1

    /** Framework feedback uses the owning root's window, never a global activity. */
    @ReactMethod
    fun dispatchPlatformFeedback(rootTag: Double, kind: String, type: String?, promise: Promise) {
        if(!rootTag.isFinite()||rootTag<=0||rootTag>Int.MAX_VALUE||rootTag!=rootTag.toInt().toDouble()) {
            promise.reject("native-feedback-arguments","Invalid React View tag");return
        }
        UiThreadUtil.runOnUiThread {
            try {
                check(live){"Native feedback module retired"}
                val root=UIManagerHelper.getUIManagerForReactTag(context,rootTag.toInt())?.resolveView(rootTag.toInt())
                if(root==null||!root.isAttachedToWindow||!root.isShown){promise.resolve(false);return@runOnUiThread}
                val view=root.rootView
                when(kind) {
                    "sound" -> when(type) {
                        "SystemSoundType.click" -> view.playSoundEffect(SoundEffectConstants.CLICK)
                        "SystemSoundType.tick", "SystemSoundType.alert" -> Unit
                        else -> throw IllegalArgumentException("Unknown system sound type")
                    }
                    "haptic" -> {
                        val effect=when(type) {
                            null -> HapticFeedbackConstants.LONG_PRESS
                            "HapticFeedbackType.lightImpact" -> HapticFeedbackConstants.VIRTUAL_KEY
                            "HapticFeedbackType.mediumImpact" -> HapticFeedbackConstants.KEYBOARD_TAP
                            "HapticFeedbackType.heavyImpact" -> HapticFeedbackConstants.CONTEXT_CLICK
                            "HapticFeedbackType.selectionClick" -> HapticFeedbackConstants.CLOCK_TICK
                            "HapticFeedbackType.successNotification" -> if(Build.VERSION.SDK_INT>=30)HapticFeedbackConstants.CONFIRM else null
                            "HapticFeedbackType.warningNotification" -> if(Build.VERSION.SDK_INT>=30)HapticFeedbackConstants.KEYBOARD_TAP else null
                            "HapticFeedbackType.errorNotification" -> if(Build.VERSION.SDK_INT>=30)HapticFeedbackConstants.REJECT else null
                            else -> throw IllegalArgumentException("Unknown haptic feedback type")
                        }
                        if(effect!=null)view.performHapticFeedback(effect)
                    }
                    else -> throw IllegalArgumentException("Unknown feedback kind")
                }
                promise.resolve(true)
            } catch(_: IllegalViewOperationException) {promise.resolve(false)}
              catch(error: Exception) {promise.reject("native-feedback",error)}
        }
    }

    /** Resolve actual React views on their UI owner and acknowledge execution.
     * Node ids from Flutter are mapped to RN tags in the live JS semantics tree. */
    @ReactMethod
    fun dispatchAccessibilityEvent(rootTag: Double, targetTag: Double, type: String, message: String?, promise: Promise) {
        if(!rootTag.isFinite()||rootTag<=0||rootTag>Int.MAX_VALUE||rootTag!=rootTag.toInt().toDouble()||
           !targetTag.isFinite()||targetTag<=0||targetTag>Int.MAX_VALUE||targetTag!=targetTag.toInt().toDouble()) {
            promise.reject("native-accessibility-arguments","Invalid React View tag");return
        }
        UiThreadUtil.runOnUiThread {
            try {
                check(live){"Native accessibility module retired"}
                val root=UIManagerHelper.getUIManagerForReactTag(context,rootTag.toInt())?.resolveView(rootTag.toInt())
                val target=if(rootTag==targetTag)root else UIManagerHelper.getUIManagerForReactTag(context,targetTag.toInt())?.resolveView(targetTag.toInt())
                if(root==null||target==null||!root.isAttachedToWindow||!target.isAttachedToWindow||!root.isShown||!target.isShown){promise.resolve(false);return@runOnUiThread}
                var ancestor: View?=target
                while(ancestor!=null&&ancestor!==root)ancestor=ancestor.parent as? View
                if(ancestor!==root){promise.resolve(false);return@runOnUiThread}
                when(type) {
                    "announce" -> {requireNotNull(message);@Suppress("DEPRECATION") root.announceForAccessibility(message)}
                    "tap" -> target.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_CLICKED)
                    "longPress" -> target.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_LONG_CLICKED)
                    "focus" -> target.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED)
                    "tooltip" -> {
                        requireNotNull(message)
                        if(Build.VERSION.SDK_INT>=28){promise.resolve(false);return@runOnUiThread}
                        @Suppress("DEPRECATION") val event=AccessibilityEvent.obtain(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
                        event.setSource(root);event.packageName=context.packageName;event.className=root.javaClass.name;event.text.add(message)
                        root.parent?.requestSendAccessibilityEvent(root,event)
                    }
                    else -> {promise.resolve(false);return@runOnUiThread}
                }
                promise.resolve(true)
            } catch(_: IllegalViewOperationException) {promise.resolve(false)}
              catch(error: Exception) {promise.reject("native-accessibility-event",error)}
        }
    }
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getPreferredLocales(): WritableMap {
        if (!live) return Arguments.createMap().apply { putString("error", "Platform services module is retired") }
        return try {
            val configuration = context.resources.configuration
            require(configuration.locales.size() <= 256) { "Preferred-language snapshot exceeds its budget" }
            val locales = Arguments.createArray()
            for (index in 0 until configuration.locales.size()) { val tag=configuration.locales[index].toLanguageTag(); require(tag.length in 1..128) { "Invalid preferred-language tag length" }; locales.pushString(tag) }
            Arguments.createMap().apply { putArray("locales", locales); putString("format", "bcp47") }
        } catch (error: Exception) {
            Arguments.createMap().apply { putString("error", error.toString()) }
        }
    }
    @ReactMethod
    fun getKeyboardState(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                check(live){"Native keyboard module retired"}
                val keys=Arguments.createArray()
                for(key in keyboardState.snapshot())keys.pushMap(Arguments.createMap().apply {putInt("keyCode",key.keyCode);putInt("scanCode",key.scanCode)})
                promise.resolve(Arguments.createMap().apply {putInt("protocol",1);putString("target","android");putArray("keys",keys)})
            } catch(error: Exception) {promise.reject("native-keyboard-state",error)}
        }
    }
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getRestorationProtocol(): Int = 1

    private fun restorationKey(key: String): String {
        require(key.length==64 && key.all { it in '0'..'9' || it in 'a'..'f' }) { "Invalid restoration application key" }
        return key
    }
    private fun restorationValue(value: String): String {
        require(value.length <= ((4*1024*1024+2)/3)*4 && value.length%4==0) { "Restoration data exceeds base64 budget" }
        val padding=when { value.endsWith("==") -> 2; value.endsWith("=") -> 1; else -> 0 }
        require(value.length/4*3-padding<=4*1024*1024 && value.dropLast(padding).all { it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it=='+' || it=='/' }) { "Malformed restoration base64" }
        return value
    }
    @ReactMethod
    fun readRestoration(key: String, promise: Promise) {
        try { check(live) { "Native restoration module retired" }
            val stored=context.getSharedPreferences("nelyx.restoration.v1",Context.MODE_PRIVATE).getString(restorationKey(key),null)
            promise.resolve(stored?.let { restorationValue(it) })
        } catch(error: Exception) { promise.reject("native-restoration-read",error) }
    }
    @ReactMethod
    fun writeRestoration(key: String, value: String, promise: Promise) {
        try { check(live) { "Native restoration module retired" }
            val committed=context.getSharedPreferences("nelyx.restoration.v1",Context.MODE_PRIVATE).edit().putString(restorationKey(key),restorationValue(value)).commit()
            check(committed) { "Restoration storage commit failed" };promise.resolve(true)
        } catch(error: Exception) { promise.reject("native-restoration-write",error) }
    }

    /** Explicit SystemNavigator.pop finishes this host Activity; OS Back keeps its own task policy. */
    @Suppress("UNUSED_PARAMETER")
    @ReactMethod
    fun popSystemNavigator(animated: Boolean, promise: Promise) {
        try { UiThreadUtil.runOnUiThread {
            var acknowledged=false
            try {
                check(live) { "Platform services module is retired" }
                val activity=context.currentActivity ?: error("Owned Android Activity unavailable")
                check(!activity.isDestroyed) { "Owned Android Activity is destroyed" }
                // Queue JS acknowledgement before Activity teardown drains this admitted request.
                promise.resolve(null);acknowledged=true
                if(!activity.isFinishing) activity.finish()
            } catch(error: Exception) {
                if(!acknowledged) promise.reject("native-system-navigator",error)
                else android.util.Log.e("NelyxSystemNavigator","Activity finish failed after acknowledgement",error)
            }
        }} catch(error: Exception) { promise.reject("native-system-navigator",error) }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getAutofillProtocol(): Int = 2

    private fun autofillOutcome(status: String, reason: String? = null): WritableMap = Arguments.createMap().apply {
        putInt("protocol",1);putString("status",status);putString("scope",if(status=="requested")"activity" else "unavailable")
        if(reason==null)putNull("reason") else putString("reason",reason)
    }
    private fun autofillOnUi(promise: Promise, operation: () -> WritableMap) {
        try { UiThreadUtil.runOnUiThread {try {promise.resolve(operation())} catch(error: Exception) {promise.reject("native-autofill",error)} } }
        catch(error: Exception) {promise.reject("native-autofill",error)}
    }
    private fun autofillRoot(tag: Double): View? {
        require(tag.isFinite()&&tag>0&&tag<=Int.MAX_VALUE&&tag==tag.toInt().toDouble()) {"Invalid autofill View tag"}
        return try {UIManagerHelper.getUIManagerForReactTag(context,tag.toInt())?.resolveView(tag.toInt())} catch(_: IllegalViewOperationException) {null}
    }
    @ReactMethod
    fun getAutofillCapabilities(rootTag: Double, promise: Promise) = autofillOnUi(promise) {
        val activity=if(live)context.currentActivity else null
        val root=autofillRoot(rootTag)
        val available=Build.VERSION.SDK_INT>=26&&activity!=null&&!activity.isDestroyed&&root is NelyxKeyboardHost&&root.isAttachedToWindow
        val enabled=if(available)activity!!.getSystemService(android.view.autofill.AutofillManager::class.java)?.isEnabled==true else false
        val accessible=available&&NelyxAutofillContext.accessible(activity!!,context,root!!)
        Arguments.createMap().apply {
            putInt("protocol",1);putBoolean("hints",live&&Build.VERSION.SDK_INT>=26);putString("groups","activity")
            putBoolean("request",enabled&&accessible);putBoolean("finish",enabled&&accessible)
            putString("scope",if(available)"activity" else "unavailable");putString("provider",if(available){if(enabled)"enabled" else "disabled"}else "unknown")
        }
    }
    @ReactMethod
    fun requestAutofill(rootTag: Double, promise: Promise) = autofillOnUi(promise) {
        val activity=if(live)context.currentActivity else null
        if(Build.VERSION.SDK_INT<26||activity==null||activity.isDestroyed)return@autofillOnUi autofillOutcome("unavailable","closed-or-unsupported")
        val manager=activity.getSystemService(android.view.autofill.AutofillManager::class.java)
        if(manager?.isEnabled!=true)return@autofillOnUi autofillOutcome("unavailable","provider-disabled")
        val root=autofillRoot(rootTag)
        if(root !is NelyxKeyboardHost||!root.isAttachedToWindow)return@autofillOnUi autofillOutcome("unavailable","no-owned-view")
        val field=activity.currentFocus as? NelyxInputConnectionView
        if(field==null||!field.isEnabled||!field.acceptsSoftInput||field.autofillHints.isNullOrEmpty()||(field.context as? com.facebook.react.uimanager.ThemedReactContext)?.reactApplicationContext!==context)return@autofillOnUi autofillOutcome("unavailable","no-editable-client")
        var ancestor: View?=field;while(ancestor!=null&&ancestor!==root)ancestor=ancestor.parent as? View
        if(ancestor!==root)return@autofillOnUi autofillOutcome("unavailable","foreign-editable-view")
        if(!NelyxAutofillContext.begin(activity,context,root))return@autofillOnUi autofillOutcome("unavailable","foreign-or-blocked-context")
        field.importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_YES
        try {manager.requestAutofill(field)} catch(error: Exception) {NelyxAutofillContext.block(activity,context,rootTag.toInt(),"request",error);throw error}
        autofillOutcome("requested")
    }
    @ReactMethod
    fun finishAutofillContext(rootTag: Double, shouldSave: Boolean, promise: Promise) = autofillOnUi(promise) {
        val activity=if(live)context.currentActivity else null
        if(Build.VERSION.SDK_INT<26||activity==null||activity.isDestroyed)return@autofillOnUi autofillOutcome("unavailable","closed-or-unsupported")
        val root=autofillRoot(rootTag)
        if(!NelyxAutofillContext.owned(activity,context,rootTag.toInt(),root))return@autofillOnUi autofillOutcome("unavailable","no-owned-context")
        val manager=activity.getSystemService(android.view.autofill.AutofillManager::class.java)
        if(manager?.isEnabled!=true){NelyxAutofillContext.forget(activity,context,rootTag.toInt());return@autofillOnUi autofillOutcome("unavailable","provider-disabled")}
        if(shouldSave&&(root==null||!root.isAttachedToWindow||!NelyxAutofillContext.accessible(activity,context,root)))return@autofillOnUi autofillOutcome("unavailable","blocked-context")
        if(!shouldSave)NelyxAutofillContext.failure(activity,context,rootTag.toInt(),"cancel")?.let {throw it}
        try {if(shouldSave)manager.commit() else manager.cancel()} catch(error: Exception) {NelyxAutofillContext.block(activity,context,rootTag.toInt(),if(shouldSave)"commit" else "cancel",error);throw error}
        NelyxAutofillContext.forget(activity,context,rootTag.toInt())
        // This only acknowledges the OS request; Save UI/provider persistence is a separate outcome.
        autofillOutcome("requested")
    }

    override fun invalidate() { live = false;NelyxAutofillContext.retire(context);keyboardState.close();super.invalidate() }
}
