// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;

import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Bundle;
import android.os.Build;
import android.view.MotionEvent;
import android.view.View;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityNodeProvider;
import dev.nelyx.input.NelyxInputBuffer;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;

/** Virtual nodes are drawn by C++; no invisible EditText substitutes for this tree. */
public final class EngineAccessibility extends AccessibilityNodeProvider {
    private final HostView view;
    private final AccessibilityManager manager;
    private final HashMap<Long,Integer> identities=new HashMap<>();
    private final LinkedHashMap<Integer,JSONObject> nodes=new LinkedHashMap<>();
    private int nextId=1,accessibilityFocus=View.NO_ID,hovered=View.NO_ID;
    private long publication;
    private long routeSequence;
    private boolean closed;
    EngineAccessibility(HostView view){this.view=view;manager=(AccessibilityManager)view.getContext().getSystemService(android.content.Context.ACCESSIBILITY_SERVICE);}
    void update(JSONObject state){
        if(closed)return;
        long nextPublication=state.optLong("frame");if(nextPublication==publication)return;
        publication=nextPublication;JSONArray values=state.optJSONArray("nodes");nodes.clear();
        if(values!=null)for(int i=0;i<values.length();i++){JSONObject node=values.optJSONObject(i);if(node==null)continue;long owner=node.optLong("owner");Integer id=identities.get(owner);if(id==null){id=nextId++;identities.put(owner,id);}nodes.put(id,node);}
        identities.entrySet().removeIf(item->!nodes.containsKey(item.getValue()));
        if(!nodes.containsKey(accessibilityFocus))accessibilityFocus=View.NO_ID;
        else if((nodes.get(accessibilityFocus).optInt("flags")&256)!=0){int previous=accessibilityFocus;accessibilityFocus=View.NO_ID;event(previous,AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED);}
        if(!nodes.containsKey(hovered))hovered=View.NO_ID;
        else if((nodes.get(hovered).optInt("flags")&256)!=0){int previous=hovered;hovered=View.NO_ID;event(previous,AccessibilityEvent.TYPE_VIEW_HOVER_EXIT);}
        event(HOST_VIEW_ID,AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED);
        JSONObject route=state.optJSONObject("route");
        if(route==null||route.optLong("scope")==0){
            if(Build.VERSION.SDK_INT>=28)view.setAccessibilityPaneTitle(null);
        }else if(route.optLong("sequence")>routeSequence){
            routeSequence=route.optLong("sequence");String label=route.optString("label"),title=label.isEmpty()?" ":label;
            if(Build.VERSION.SDK_INT>=28&&!android.text.TextUtils.equals(view.getAccessibilityPaneTitle(),title))view.setAccessibilityPaneTitle(title);
            else routeEvent(identities.getOrDefault(route.optLong("scope"),HOST_VIEW_ID),title);
        }
    }
    private int parent(JSONObject node){Integer id=identities.get(node.optLong("parent"));return id==null?HOST_VIEW_ID:id;}
    private Rect bounds(JSONObject node,boolean screen){
        RectF logical=HostView.rect(node.optJSONArray("bounds"));if(logical==null)return new Rect();
        float density=view.getResources().getDisplayMetrics().density;
        if(!screen){JSONObject p=nodes.get(parent(node));if(p!=null){RectF origin=HostView.rect(p.optJSONArray("bounds"));logical.offset(-origin.left,-origin.top);}}
        Rect result=new Rect((int)Math.floor(logical.left*density),(int)Math.floor(logical.top*density),(int)Math.ceil(logical.right*density),(int)Math.ceil(logical.bottom*density));
        if(screen){int[] origin=new int[2];view.getLocationOnScreen(origin);result.offset(origin[0],origin[1]);}return result;
    }
    @Override public AccessibilityNodeInfo createAccessibilityNodeInfo(int id){
        if(closed)return null;
        if(id==HOST_VIEW_ID){AccessibilityNodeInfo info=AccessibilityNodeInfo.obtain(view);view.onInitializeAccessibilityNodeInfo(info);for(var entry:nodes.entrySet())if(parent(entry.getValue())==HOST_VIEW_ID)info.addChild(view,entry.getKey());return info;}
        JSONObject node=nodes.get(id);if(node==null)return null;
        AccessibilityNodeInfo info=AccessibilityNodeInfo.obtain();info.setSource(view,id);info.setPackageName(view.getContext().getPackageName());int p=parent(node);if(p==HOST_VIEW_ID)info.setParent(view);else info.setParent(view,p);
        for(var entry:nodes.entrySet())if(parent(entry.getValue())==id)info.addChild(view,entry.getKey());
        String[] roles={"android.view.View","android.view.ViewGroup","android.widget.Button","android.widget.TextView","android.widget.EditText","android.widget.CheckBox","android.widget.SeekBar","android.widget.TextView","android.widget.RadioButton","android.widget.RadioGroup","android.widget.Switch"};int role=node.optInt("role"),flags=node.optInt("flags"),actions=node.optInt("actions");info.setClassName(role>=0&&role<roles.length?roles[role]:roles[0]);
        info.setEnabled((flags&1)==0);info.setVisibleToUser(view.isShown());info.setBoundsInParent(bounds(node,false));info.setBoundsInScreen(bounds(node,true));
        boolean scopesRoute=(flags&256)!=0;
        info.setContentDescription(node.optString("label"));info.setHintText(node.optString("hint"));info.setFocusable(!scopesRoute&&((flags&16)!=0||(actions&2)!=0));info.setFocused(node.optBoolean("focused"));info.setAccessibilityFocused(id==accessibilityFocus);info.setSelected((flags&8)!=0);
        if(Build.VERSION.SDK_INT>=28)info.setScreenReaderFocusable(!scopesRoute&&(!node.optString("label").isEmpty()||!node.optString("value").isEmpty()||actions!=0));
        if(!scopesRoute)info.addAction(id==accessibilityFocus?AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS:AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS);
        if((actions&1)!=0){info.setClickable(true);info.addAction(AccessibilityNodeInfo.ACTION_CLICK);}
        if(!scopesRoute&&(actions&2)!=0)info.addAction(AccessibilityNodeInfo.ACTION_FOCUS);
        if((actions&64)!=0){info.setLongClickable(true);info.addAction(AccessibilityNodeInfo.ACTION_LONG_CLICK);}
        if(role==5||role==8||role==10){info.setCheckable(true);info.setChecked((flags&4)!=0);}
        if(role==4){boolean password=node.optBoolean("password");info.setPassword(password);info.setEditable((flags&32)==0);if(!password){info.setText(node.optString("text"));info.setTextSelection(node.optInt("anchor"),node.optInt("focus"));info.addAction(AccessibilityNodeInfo.ACTION_SET_SELECTION);}if((flags&32)==0)info.addAction(AccessibilityNodeInfo.ACTION_SET_TEXT);}
        else if(!node.optString("value").isEmpty())info.setText(node.optString("value"));
        JSONArray range=node.optJSONArray("range");if(range!=null){info.setRangeInfo(AccessibilityNodeInfo.RangeInfo.obtain(AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_FLOAT,(float)range.optDouble(0),(float)range.optDouble(1),(float)range.optDouble(2)));if((actions&4)!=0)info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_PROGRESS);}
        if((actions&16)!=0)info.addAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);if((actions&32)!=0)info.addAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
        return info;
    }
    @Override public AccessibilityNodeInfo findFocus(int kind){if(kind==AccessibilityNodeInfo.FOCUS_ACCESSIBILITY)return createAccessibilityNodeInfo(accessibilityFocus);for(var entry:nodes.entrySet())if(entry.getValue().optBoolean("focused"))return createAccessibilityNodeInfo(entry.getKey());return null;}
    @Override public List<AccessibilityNodeInfo> findAccessibilityNodeInfosByText(String query,int root){ArrayList<AccessibilityNodeInfo> result=new ArrayList<>();String match=query.toLowerCase(java.util.Locale.ROOT);for(var entry:nodes.entrySet()){JSONObject value=entry.getValue();if(value.optString("label").toLowerCase(java.util.Locale.ROOT).contains(match)||!value.optBoolean("password")&&value.optString("text").toLowerCase(java.util.Locale.ROOT).contains(match))result.add(createAccessibilityNodeInfo(entry.getKey()));}return result;}
    @Override public boolean performAction(int id,int action,Bundle arguments){
        if(closed)return false;view.readState(true);JSONObject node=nodes.get(id);if(node==null)return false;
        if(action==AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS){if((node.optInt("flags")&256)!=0||accessibilityFocus==id)return false;int old=accessibilityFocus;accessibilityFocus=id;if(old!=View.NO_ID)event(old,AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED);event(id,AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED);return true;}
        if(action==AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS){if(accessibilityFocus!=id)return false;accessibilityFocus=View.NO_ID;event(id,AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED);return true;}
        long owner=node.optLong("owner");int canonical=action==AccessibilityNodeInfo.ACTION_CLICK?1:action==AccessibilityNodeInfo.ACTION_FOCUS?2:action==AccessibilityNodeInfo.ACTION_LONG_CLICK?64:action==AccessibilityNodeInfo.ACTION_SCROLL_FORWARD?16:action==AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD?32:action==AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_PROGRESS.getId()?4:0;
        if(canonical!=0){double value=canonical==4&&arguments!=null?arguments.getFloat(AccessibilityNodeInfo.ACTION_ARGUMENT_PROGRESS_VALUE):0;boolean accepted=NativeHost.action(view.host,owner,publication,canonical,value);view.readState(true);return accepted;}
        if(action==AccessibilityNodeInfo.ACTION_SET_TEXT||action==AccessibilityNodeInfo.ACTION_SET_SELECTION){
            if(arguments==null||node.optInt("role")!=4)return false;
            if(!node.optBoolean("focused")){if(!NativeHost.action(view.host,owner,publication,2,0))return false;view.readState(true);}
            NelyxInputBuffer.Value current=view.input.value();if(current==null||current.owner!=owner)return false;
            CharSequence text=action==AccessibilityNodeInfo.ACTION_SET_TEXT?arguments.getCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE):current.text;if(text==null)return false;
            int a=action==AccessibilityNodeInfo.ACTION_SET_TEXT?text.length():arguments.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT,-1),f=action==AccessibilityNodeInfo.ACTION_SET_TEXT?text.length():arguments.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT,-1);
            boolean accepted=NativeHost.edit(view.host,current.owner,current.session,current.revision,current.publication,text.toString(),a,f,action==AccessibilityNodeInfo.ACTION_SET_TEXT?-1:current.composingStart,action==AccessibilityNodeInfo.ACTION_SET_TEXT?-1:current.composingEnd);view.readState(true);if(accepted)event(id,action==AccessibilityNodeInfo.ACTION_SET_TEXT?AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED:AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED);return accepted;
        }
        return false;
    }
    boolean hover(MotionEvent event){if(closed||!manager.isTouchExplorationEnabled())return false;int id=View.NO_ID;if(event.getActionMasked()!=MotionEvent.ACTION_HOVER_EXIT){float density=view.getResources().getDisplayMetrics().density;for(var entry:nodes.entrySet()){if((entry.getValue().optInt("flags")&256)!=0)continue;RectF bounds=HostView.rect(entry.getValue().optJSONArray("bounds"));if(bounds!=null&&bounds.contains(event.getX()/density,event.getY()/density))id=entry.getKey();}}if(id!=hovered){if(hovered!=View.NO_ID)event(hovered,AccessibilityEvent.TYPE_VIEW_HOVER_EXIT);hovered=id;if(id!=View.NO_ID)event(id,AccessibilityEvent.TYPE_VIEW_HOVER_ENTER);}return id!=View.NO_ID;}
    private void routeEvent(int id,String title){if(!manager.isEnabled()||view.getParent()==null)return;AccessibilityEvent event=AccessibilityEvent.obtain(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED);event.setPackageName(view.getContext().getPackageName());event.setClassName("android.view.View");event.setSource(view,id);event.getText().add(title);view.getParent().requestSendAccessibilityEvent(view,event);}
    private void event(int id,int type){if(!manager.isEnabled()||view.getParent()==null)return;AccessibilityEvent event=AccessibilityEvent.obtain(type);event.setPackageName(view.getContext().getPackageName());event.setSource(view,id);event.setClassName("android.view.View");if(type==AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED)event.setContentChangeTypes(AccessibilityEvent.CONTENT_CHANGE_TYPE_SUBTREE);view.getParent().requestSendAccessibilityEvent(view,event);}
    void feedback(long owner,String type){
        if(closed)return;Integer id=identities.get(owner);if(id==null||!nodes.containsKey(id))return;
        int eventType="semantics-tap".equals(type)?AccessibilityEvent.TYPE_VIEW_CLICKED:"semantics-longPress".equals(type)?AccessibilityEvent.TYPE_VIEW_LONG_CLICKED:AccessibilityEvent.TYPE_VIEW_FOCUSED;
        event(id,eventType);
    }
    void close(){closed=true;nodes.clear();identities.clear();accessibilityFocus=hovered=View.NO_ID;if(Build.VERSION.SDK_INT>=28)view.setAccessibilityPaneTitle(null);}
}
