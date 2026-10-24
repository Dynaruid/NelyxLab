// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp

/** Nonvisual OS input/semantics endpoints; Core paints and lays out editing UI. */
class NelyxEditingPackage: ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NelyxPlatformServices(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<in Nothing,in Nothing>> = listOf(NelyxInputConnectionManager(),NelyxEnvironmentManager(),NelyxKeyboardHostManager(),NelyxSemanticsManager())
}

class NelyxInputConnectionManager: SimpleViewManager<NelyxInputConnectionView>() {
    override fun getName(): String = "NelyxInputConnection"
    override fun getExportedViewConstants(): Map<String,Any> = mapOf("inputConnectionProtocol" to 4)
    override fun createViewInstance(context: ThemedReactContext): NelyxInputConnectionView = NelyxInputConnectionView(context)
    override fun getExportedCustomDirectEventTypeConstants(): Map<String,Any> = mapOf("topNelyxEditing" to mapOf("registrationName" to "onNelyxEditing"),"topNelyxInputBounds" to mapOf("registrationName" to "onNelyxInputBounds"))
    override fun getCommandsMap(): Map<String,Int> = mapOf("focus" to 1,"replace" to 2,"blur" to 3,"geometry" to 4,"replaceComposing" to 5)
    private fun integer(args: ReadableArray,index: Int): Long {val value=args.getDouble(index);require(value.isFinite()&&value>=0&&value<=9007199254740991.0&&value==value.toLong().toDouble());return value.toLong()}
    override fun receiveCommand(view: NelyxInputConnectionView,commandId: String,args: ReadableArray?) {
        when(commandId){
            "focus"->{requireNotNull(args);require(args.size()==1);val request=args.getMap(0)
                val timestamp=if(request?.hasKey("inputTimestamp")==true)request.getDouble("inputTimestamp") else null
                val restore=if(request?.hasKey("restore")==true)request.getBoolean("restore") else false
                view.focusInput(timestamp,restore)}
            "blur"->view.blurInput()
            "geometry"->{requireNotNull(args);require(args.size()==1);view.configureGeometry(requireNotNull(args.getMap(0)))}
            "replace","replaceComposing"->{requireNotNull(args);require(args.size()==5);view.replaceFromCore(requireNotNull(args.getString(0)),args.getInt(1),args.getInt(2),integer(args,3),integer(args,4),commandId=="replaceComposing")}
            else->throw IllegalArgumentException("Unknown Nelyx input connection command")
        }
    }
    override fun receiveCommand(view: NelyxInputConnectionView,commandId: Int,args: ReadableArray?) = receiveCommand(view,when(commandId){1->"focus";2->"replace";3->"blur";4->"geometry";5->"replaceComposing";else->throw IllegalArgumentException("Unknown Nelyx input connection command")},args)
    @ReactProp(name="initialValue") fun initialValue(view: NelyxInputConnectionView,value: ReadableMap?){if(value!=null)view.initialize(value)}
    @ReactProp(name="editable",defaultBoolean=true) fun editable(view: NelyxInputConnectionView,value: Boolean){view.isEnabled=value}
    @ReactProp(name="maxLength",defaultInt=4096) fun maxLength(view: NelyxInputConnectionView,value: Int){view.setTextLimit(value)}
    @ReactProp(name="editingConfiguration") fun editingConfiguration(view: NelyxInputConnectionView,value: ReadableMap?){view.configureEditing(value)}
    @ReactProp(name="inputAction") fun inputAction(view: NelyxInputConnectionView,value: String?){view.configureAction(value ?: "done")}
    @ReactProp(name="coreDocument") fun coreDocument(view: NelyxInputConnectionView,value: ReadableMap?){view.configureCoreDocument(value)}
    override fun onDropViewInstance(view: NelyxInputConnectionView){view.close();super.onDropViewInstance(view)}
}
