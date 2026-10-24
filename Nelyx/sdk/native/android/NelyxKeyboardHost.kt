// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import android.view.KeyEvent
import android.view.KeyCharacterMap
import android.view.ViewGroup
import android.view.View
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager
import java.util.Collections
import java.util.IdentityHashMap

private class KeyboardEvent(surface: Int,tag: Int,private val snapshot: WritableMap): Event<KeyboardEvent>(surface,tag) {
    override fun getEventName(): String = "topNelyxKey"
    override fun canCoalesce(): Boolean = false
    override fun getEventData(): WritableMap = snapshot
}
private class KeyboardFocusEvent(surface: Int,tag: Int,private val snapshot: WritableMap): Event<KeyboardFocusEvent>(surface,tag) {
    override fun getEventName(): String = "topNelyxKeyboardFocus"
    override fun canCoalesce(): Boolean = false
    override fun getEventData(): WritableMap = snapshot
}

/** Acknowledged raw keys for the Core canvas and its nonvisual input endpoints. */
class NelyxKeyboardHostManager: ReactViewManager() {
    override fun getName(): String = "NelyxKeyboardHost"
    override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = NelyxKeyboardHost(context)
    override fun getExportedViewConstants(): MutableMap<String,Any> = mutableMapOf("keyboardProtocol" to 3)
    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String,Any> =
        (super.getExportedCustomDirectEventTypeConstants()?.toMutableMap() ?: mutableMapOf()).apply {
            put("topNelyxKey",mapOf("registrationName" to "onNelyxKey"))
            put("topNelyxKeyboardFocus",mapOf("registrationName" to "onNelyxKeyboardFocus"))
        }
    override fun getCommandsMap(): MutableMap<String,Int> = super.getCommandsMap().apply {put("focusCanvas",101);put("acknowledgeKey",102)}
    @ReactProp(name="keyboardProtocol") fun protocol(view: ReactViewGroup,value: Int) {require(value==3);(view as NelyxKeyboardHost).enableProtocol()}
    override fun receiveCommand(view: ReactViewGroup,commandId: String,args: ReadableArray?) {
        when(commandId) {
            "focusCanvas" -> (view as NelyxKeyboardHost).focusCanvas()
            "acknowledgeKey" -> {requireNotNull(args);require(args.size()==2);(view as NelyxKeyboardHost).acknowledge(args.getDouble(0).toLong(),args.getBoolean(1))}
            else -> super.receiveCommand(view,commandId,args)
        }
    }
    override fun receiveCommand(view: ReactViewGroup,commandId: Int,args: ReadableArray?) {
        when(commandId) {101->receiveCommand(view,"focusCanvas",args);102->receiveCommand(view,"acknowledgeKey",args);else->super.receiveCommand(view,commandId,args)}
    }
    override fun onDropViewInstance(view: ReactViewGroup) {(view as NelyxKeyboardHost).close();super.onDropViewInstance(view)}
}

class NelyxKeyboardHost(private val reactContext: ThemedReactContext): ReactViewGroup(reactContext) {
    internal val keyboardFocusOrder=NelyxKeyboardFocusOrder()
    override fun dispatchKeyEventPreIme(event: KeyEvent): Boolean {
        if(live&&event.keyCode==KeyEvent.KEYCODE_BACK&&event.action==KeyEvent.ACTION_UP&&!event.isCanceled)keyboardFocusOrder.dismiss(event.eventTime)
        return super.dispatchKeyEventPreIme(event)
    }
    private var protocolReady=false
    private val characterCombiner=NelyxKeyCharacterCombiner {accent,base->KeyCharacterMap.getDeadChar(accent,base)}
    private val modernCharacterCombiner=NelyxKeyCharacterCombiner {accent,base->KeyCharacterMap.getDeadChar(accent,base)}
    private var live=true
    private var sequence=0L
    private var focusEpoch=0L
    private var observedKeyboard: NelyxObservedKeyboardState?=null
    private var keyboardOwner=0L
    private fun observedState(): NelyxObservedKeyboardState? {
        if(observedKeyboard==null){val module=reactContext.getNativeModule(NelyxPlatformServices::class.java) ?: return null;observedKeyboard=module.keyboardState;keyboardOwner=module.keyboardState.newOwner()}
        return observedKeyboard
    }
    private data class Captured(val event: KeyEvent,val epoch: Long,val target: View)
    private fun inputTarget(): View?=findFocus()?.takeIf {it===this||it is NelyxInputConnectionView}
    private val redispatched=Collections.newSetFromMap(IdentityHashMap<KeyEvent,Boolean>())
    private val queue=NelyxKeyQueue<Captured> {item,handled->
        if(!handled&&live&&isAttachedToWindow&&inputTarget()===item.target&&hasWindowFocus()&&item.epoch==focusEpoch){redispatched.add(item.event);try{rootView.dispatchKeyEvent(item.event)}finally{redispatched.remove(item.event)}}
    }
    // Leaving Android touch mode must retain the canvas owner, rather than move
    // native focus to the first accessibility proxy. Explicit editor focus remains allowed.
    init {isFocusable=true;isFocusableInTouchMode=true;descendantFocusability=ViewGroup.FOCUS_BEFORE_DESCENDANTS}
    fun enableProtocol() {if(!live)return;protocolReady=true;if(inputTarget()!=null&&hasWindowFocus())notifyFocus(true)}
    fun editorFocusChanged(focused: Boolean){if(!live)return;cancelPending();if(focused&&hasWindowFocus())notifyFocus(true)else post {if(live)notifyFocus(inputTarget()!=null&&hasWindowFocus())}}
    fun focusCanvas() {
        if(!live||!isAttachedToWindow)return
        // Canvas pointer ingress precedes Core gesture/focus policy. Keep an
        // existing editor (and IME) until Core explicitly blurs it; clear buttons
        // and scrolling may intentionally retain editing focus.
        if(findFocus() is NelyxInputConnectionView)return
        isFocusable=true;isFocusableInTouchMode=true
        val prior=descendantFocusability;descendantFocusability=ViewGroup.FOCUS_BLOCK_DESCENDANTS
        try {requestFocus();(context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(windowToken,0)}
        finally {descendantFocusability=prior}
    }
    /** The host outlives a retired editor. Another editor's focus wins the batch. */
    fun releaseEditor() {
        if(!live||!isAttachedToWindow)return
        post {if(live&&isAttachedToWindow&&findFocus() !is NelyxInputConnectionView)focusCanvas()}
    }
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if(redispatched.remove(event))return super.dispatchKeyEvent(event)
        val target=inputTarget()
        if(!live||!protocolReady||target==null||!hasWindowFocus()||event.isSystem||event.keyCode==KeyEvent.KEYCODE_BACK||event.action!=KeyEvent.ACTION_DOWN&&event.action!=KeyEvent.ACTION_UP)return super.dispatchKeyEvent(event)
        val dispatcher=UIManagerHelper.getEventDispatcherForReactTag(reactContext,id) ?: return super.dispatchKeyEvent(event)
        val id=++sequence;check(id<=9007199254740991L)
        if(!queue.admit(id,Captured(KeyEvent(event),focusEpoch,target)))return super.dispatchKeyEvent(event)
        if(!live||inputTarget()!==target||!hasWindowFocus()){queue.acknowledge(id,true);return true}
        observedState()?.also {it.focus(keyboardOwner);it.observe(keyboardOwner,event.keyCode,event.scanCode,event.action==KeyEvent.ACTION_UP)}
        val unicode=event.getUnicodeChar(event.metaState and (KeyEvent.META_CTRL_MASK or KeyEvent.META_META_MASK).inv())
        val characterCode=event.unicodeChar
        val plainCodePoint=event.getUnicodeChar(0)
        val complexCharacter=characterCombiner.combine(characterCode)
        // The pinned modern responder advances its own combiner on down only;
        // the legacy raw responder advances on both down and up.
        val modernCharacter=if(event.action==KeyEvent.ACTION_DOWN)modernCharacterCombiner.combine(characterCode).takeUnless {it[0]=='\u0000'} else null
        val device=event.device
        val payload=Arguments.createMap().apply {
            putDouble("sequence",id.toDouble());putString("kind",if(event.action==KeyEvent.ACTION_DOWN)"down" else "up");putString("key",logicalKey(event,unicode))
            putString("character",if(event.action==KeyEvent.ACTION_DOWN&&characterCode in 0x20..0x10ffff&&characterCode !in 0x7f..0x9f)String(Character.toChars(characterCode)) else null)
            putBoolean("shift",event.isShiftPressed);putBoolean("control",event.isCtrlPressed);putBoolean("alt",event.isAltPressed);putBoolean("meta",event.isMetaPressed);putBoolean("repeat",event.action==KeyEvent.ACTION_DOWN&&event.repeatCount>0)
            putInt("keyCode",event.keyCode);putInt("scanCode",event.scanCode);putInt("deviceId",event.deviceId);putInt("source",event.source);putInt("metaState",event.metaState);putInt("repeatCount",event.repeatCount);putInt("flags",event.flags)
            putInt("codePoint",characterCode);putInt("plainCodePoint",plainCodePoint);putString("complexCharacter",complexCharacter)
            putString("keyCharacter",modernCharacter)
            putInt("vendorId",device?.vendorId ?: 0);putInt("productId",device?.productId ?: 0);putBoolean("deviceAvailable",device!=null)
            putDouble("timestamp",event.eventTime.toDouble());putDouble("downTime",event.downTime.toDouble());putBoolean("canceled",event.isCanceled)
        }
        dispatcher.dispatchEvent(KeyboardEvent(UIManagerHelper.getSurfaceId(this),this.id,payload));return true
    }
    fun acknowledge(id: Long,handled: Boolean) {queue.acknowledge(id,handled)}
    private fun cancelPending() {focusEpoch++;queue.clear();redispatched.clear();characterCombiner.clear();modernCharacterCombiner.clear();observedKeyboard?.blur(keyboardOwner)}
    private fun notifyFocus(focused: Boolean) {if(!live||!protocolReady||id<=0)return;if(focused)observedState()?.focus(keyboardOwner);else observedKeyboard?.blur(keyboardOwner);val dispatcher=UIManagerHelper.getEventDispatcherForReactTag(reactContext,id) ?: return;val focusSequence=++sequence;check(focusSequence<=9007199254740991L);val payload=Arguments.createMap().apply {putBoolean("focused",focused);putDouble("sequence",focusSequence.toDouble())};dispatcher.dispatchEvent(KeyboardFocusEvent(UIManagerHelper.getSurfaceId(this),id,payload))}
    override fun onFocusChanged(focused: Boolean,direction: Int,previous: android.graphics.Rect?) {if(!focused){cancelPending();notifyFocus(false)}else if(hasWindowFocus())notifyFocus(true);super.onFocusChanged(focused,direction,previous)}
    override fun onWindowFocusChanged(focused: Boolean) {if(!focused){cancelPending();notifyFocus(false)}else if(inputTarget()!=null)notifyFocus(true);super.onWindowFocusChanged(focused)}
    override fun onDetachedFromWindow() {cancelPending();super.onDetachedFromWindow()}
    fun close() {NelyxAutofillContext.retireRoot(reactContext.reactApplicationContext,this);live=false;protocolReady=false;queue.close();cancelPending();clearFocus()}
    private fun logicalKey(event: KeyEvent,unicode: Int): String = when(event.keyCode) {
        KeyEvent.KEYCODE_DPAD_LEFT->"ArrowLeft";KeyEvent.KEYCODE_DPAD_RIGHT->"ArrowRight";KeyEvent.KEYCODE_DPAD_UP->"ArrowUp";KeyEvent.KEYCODE_DPAD_DOWN->"ArrowDown"
        KeyEvent.KEYCODE_MOVE_HOME->"Home";KeyEvent.KEYCODE_MOVE_END->"End";KeyEvent.KEYCODE_PAGE_UP->"PageUp";KeyEvent.KEYCODE_PAGE_DOWN->"PageDown"
        KeyEvent.KEYCODE_TAB->"Tab";KeyEvent.KEYCODE_ENTER,KeyEvent.KEYCODE_NUMPAD_ENTER->"Enter";KeyEvent.KEYCODE_ESCAPE->"Escape";KeyEvent.KEYCODE_DEL->"Backspace";KeyEvent.KEYCODE_FORWARD_DEL->"Delete"
        KeyEvent.KEYCODE_SHIFT_LEFT,KeyEvent.KEYCODE_SHIFT_RIGHT->"Shift";KeyEvent.KEYCODE_CTRL_LEFT,KeyEvent.KEYCODE_CTRL_RIGHT->"Control";KeyEvent.KEYCODE_ALT_LEFT,KeyEvent.KEYCODE_ALT_RIGHT->"Alt";KeyEvent.KEYCODE_META_LEFT,KeyEvent.KEYCODE_META_RIGHT->"Meta"
        KeyEvent.KEYCODE_CAPS_LOCK->"CapsLock";KeyEvent.KEYCODE_NUM_LOCK->"NumLock";KeyEvent.KEYCODE_SCROLL_LOCK->"ScrollLock"
        in KeyEvent.KEYCODE_F1..KeyEvent.KEYCODE_F12->"F${event.keyCode-KeyEvent.KEYCODE_F1+1}"
        else->if(unicode and KeyCharacterMap.COMBINING_ACCENT!=0)"Dead" else if(unicode in 1..0x10ffff)String(Character.toChars(unicode)) else "Unidentified"
    }
}
