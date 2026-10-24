// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import android.text.SpannableString
import android.text.Spanned
import android.text.style.LocaleSpan
import android.text.style.TtsSpan
import android.view.View
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo
import android.view.ViewGroup
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager
import java.util.Locale

/** Canvas semantics already has a logical order; Android's geometric sort loses it for bidi/wrapped spans. */
class NelyxSemanticsManager : ReactViewManager() {
    override fun getName(): String = "NelyxSemantics"
    override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = NelyxSemanticsView(context)
    override fun getExportedViewConstants(): MutableMap<String,Any> = mutableMapOf("semanticsProtocol" to 2)
    @ReactProp(name="semanticsProtocol") fun protocol(view: ReactViewGroup,value: Int) {require(value==2)}
    @ReactProp(name="textInput") fun textInput(view: ReactViewGroup,value: com.facebook.react.bridge.ReadableMap?) {
        (view as NelyxSemanticsView).textInput=if(value==null)null else {
            val text=requireNotNull(value.getString("value"));val anchor=value.getInt("anchor");val focus=value.getInt("focus")
            require(anchor in 0..text.length&&focus in 0..text.length)
            val tag=if(value.isNull("target"))null else value.getInt("target").also {require(it>0)}
            CoreTextInputSemantics(text,anchor,focus,value.getBoolean("readOnly"),value.getBoolean("obscured"),value.getBoolean("multiline"),value.getBoolean("focused"),value.getBoolean("focusable"),value.getBoolean("enabled"),tag)
        }
    }
    @ReactProp(name="labelAttributes") fun attributes(view: ReactViewGroup,value: ReadableArray?) {
        // Copy bridge data at the setter boundary; no retained ReadableArray/JNI owner.
        (view as NelyxSemanticsView).attributes = if(value==null) emptyList() else (0 until value.size()).map {index->
            val attribute=requireNotNull(value.getMap(index))
            val start=attribute.getDouble("start");val end=attribute.getDouble("end")
            require(start.isFinite()&&end.isFinite()&&start>=0&&end>=start&&end<=Int.MAX_VALUE&&start==start.toInt().toDouble()&&end==end.toInt().toDouble())
            val kind=requireNotNull(attribute.getString("kind"));require(kind=="locale"||kind=="spellOut")
            LabelAttribute(start.toInt(),end.toInt(),if(kind=="locale")requireNotNull(attribute.getString("locale")) else null)
        }
    }
    override fun onAfterUpdateTransaction(view: ReactViewGroup) {
        super.onAfterUpdateTransaction(view)
        (view as NelyxSemanticsView).applyAttributes()
    }
    override fun onDropViewInstance(view: ReactViewGroup) {
        (view as NelyxSemanticsView).attributes=emptyList();view.textInput=null
        view.contentDescription=null
        super.onDropViewInstance(view)
    }
}

internal data class CoreTextInputSemantics(val value: String,val anchor: Int,val focus: Int,val readOnly: Boolean,val obscured: Boolean,val multiline: Boolean,val focused: Boolean,val focusable: Boolean,val enabled: Boolean,val target: Int?)

internal data class LabelAttribute(val start: Int,val end: Int,val locale: String?)

class NelyxSemanticsView(context: ThemedReactContext) : ReactViewGroup(context) {
    internal var attributes: List<LabelAttribute> = emptyList()
    internal var textInput: CoreTextInputSemantics?=null
    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        textInput?.let {state->
            info.className="android.widget.EditText";info.isEditable=!state.readOnly&&state.enabled;info.isPassword=state.obscured;info.isMultiLine=state.multiline
            info.text=state.value;info.setTextSelection(state.anchor,state.focus);info.isEnabled=state.enabled;info.isFocusable=state.enabled&&state.focusable;info.isFocused=state.focused
            if(state.enabled&&state.focusable)info.addAction(if(state.focused)AccessibilityNodeInfo.AccessibilityAction.ACTION_CLEAR_FOCUS else AccessibilityNodeInfo.AccessibilityAction.ACTION_FOCUS)
        }
    }
    override fun performAccessibilityAction(action: Int,arguments: Bundle?): Boolean {
        val state=textInput
        if(state!=null&&(action==AccessibilityNodeInfo.ACTION_FOCUS||action==AccessibilityNodeInfo.ACTION_CLEAR_FOCUS||action==AccessibilityNodeInfo.ACTION_CLICK)) {
            if(!state.enabled||!state.focusable)return false
            val target=state.target?.let {rootView.findViewById<View>(it)} as? NelyxInputConnectionView ?: return false
            if(action==AccessibilityNodeInfo.ACTION_CLEAR_FOCUS){target.blurInput();return !target.isFocused}
            target.focusInput();return target.isFocused
        }
        return super.performAccessibilityAction(action,arguments)
    }

    internal fun applyAttributes() {
        val description=contentDescription ?: return
        // Strip previously applied attributes on every update, including removal.
        val text=description.toString()
        if(attributes.isEmpty()){contentDescription=text;return}
        val label=getTag(com.facebook.react.R.id.accessibility_label) as? String ?: ""
        require(text.startsWith(label))
        val attributed=SpannableString(text)
        for(attribute in attributes) {
            require(attribute.end<=label.length)
            if(attribute.start==attribute.end)continue
            val span=if(attribute.locale==null)TtsSpan.VerbatimBuilder(label.substring(attribute.start,attribute.end)).build()
                else LocaleSpan(Locale.forLanguageTag(attribute.locale))
            attributed.setSpan(span,attribute.start,attribute.end,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        contentDescription=attributed
    }
    override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
        // Do not call ViewGroup's screen-coordinate sort: a label covering two
        // lines can have the same origin as an earlier inline child.
        for(index in 0 until childCount) {
            val child=getChildAt(index)
            if(child.visibility!=VISIBLE||child.importantForAccessibility==IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS)continue
            if(child.isImportantForAccessibility)outChildren.add(child)
            else if(child is ViewGroup)child.addChildrenForAccessibility(outChildren)
        }
    }
}
