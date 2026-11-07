// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;

import android.content.Context;
import android.graphics.RectF;
import android.graphics.SurfaceTexture;
import android.os.Handler;
import android.os.Looper;
import android.view.Choreographer;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.VelocityTracker;
import android.view.View;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeProvider;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import dev.nelyx.input.NelyxInputBuffer;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;

/** TextureView owns Android objects; C++ owns the document, scene and GPU workers. */
public final class HostView extends TextureView implements TextureView.SurfaceTextureListener,Choreographer.FrameCallback {
    final long host;
    final NelyxInputBuffer input;
    final EngineAccessibility accessibility;
    final Handler handler=new Handler(Looper.getMainLooper());
    JSONObject state=new JSONObject();
    private boolean running,closed,polling;
    private java.util.function.Consumer<JSONObject> failure;
    private long retirementDeadline;
    private long surfaceGeneration;
    private SurfaceTexture texture;
    private VelocityTracker velocity;
    private final android.util.SparseArray<float[]> points=new android.util.SparseArray<>();
    private static final class HeldSurface {long generation;Surface value;SurfaceTexture texture;boolean destroy;HeldSurface(long generation,Surface value,SurfaceTexture texture){this.generation=generation;this.value=value;this.texture=texture;}}
    private final ArrayList<HeldSurface> surfaces=new ArrayList<>();
    public HostView(Context context,String directory,boolean emulator){
        super(context);setOpaque(true);setFocusable(true);setFocusableInTouchMode(true);setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);setSurfaceTextureListener(this);
        host=NativeHost.open(directory,emulator);
        input=new NelyxInputBuffer(this,new NelyxInputBuffer.Sink(){
            @Override public NelyxInputBuffer.Value edit(NelyxInputBuffer.Value observed,String text,int a,int f,int s,int e){
                if(closed)return null;
                boolean accepted=NativeHost.edit(host,observed.owner,observed.session,observed.revision,observed.publication,text,a,f,s,e);
                readState(false);NelyxInputBuffer.Value value=editor(state.optJSONObject("editor"));
                if(!accepted)input.adopt(value);
                return accepted?value:null;
            }
            @Override public boolean action(NelyxInputBuffer.Value observed){if(closed)return false;boolean accepted=NativeHost.key(host,13,0,true,false);NativeHost.key(host,13,0,false,false);return accepted;}
        });
        accessibility=new EngineAccessibility(this);
    }
    void onFailure(java.util.function.Consumer<JSONObject> callback){failure=callback;}
    static NelyxInputBuffer.Value editor(JSONObject value){
        if(value==null)return null;
        try{return new NelyxInputBuffer.Value(value.getLong("owner"),value.getLong("session"),value.getLong("revision"),value.getLong("publication"),value.getLong("metrics"),value.getString("text"),value.getInt("anchor"),value.getInt("focus"),value.getInt("composingStart"),value.getInt("composingEnd"),value.getInt("flags"),rect(value.optJSONArray("caret")),(float)value.optDouble("baseline",0));}catch(Exception e){throw new IllegalStateException("Invalid canonical Android edit mirror",e);}
    }
    static RectF rect(JSONArray value){if(value==null)return null;float x=(float)value.optDouble(0),y=(float)value.optDouble(1);return new RectF(x,y,x+(float)value.optDouble(2),y+(float)value.optDouble(3));}
    void readState(boolean adopt){
        try{state=new JSONObject(NativeHost.snapshot(host));releaseSurfaces(state.optBoolean("closed")?Long.MAX_VALUE:state.optLong("retiredSurface"));if(adopt&&!closed){input.adopt(editor(state.optJSONObject("editor")));accessibility.update(state);}}
        catch(Exception error){throw new IllegalStateException("Cannot read Android engine publication",error);}
    }
    public void resume(){if(closed||running)return;running=true;Choreographer.getInstance().postFrameCallback(this);}
    public void pause(){if(!running)return;running=false;Choreographer.getInstance().removeFrameCallback(this);cancelPointer();input.adopt(null);NativeHost.frame(host,System.nanoTime(),false);}
    @Override public void doFrame(long nanos){
        if(closed||!running)return;
        NativeHost.frame(host,nanos,isShown()&&hasWindowFocus());readState(true);
        if(state.optBoolean("failed")){android.util.Log.e("NelyxV2",state.optString("error"));pause();java.util.function.Consumer<JSONObject> callback=failure;failure=null;if(callback!=null)callback.accept(state);return;}
        Choreographer.getInstance().postFrameCallback(this);
    }
    @Override public boolean onCheckIsTextEditor(){return input.editable();}
    @Override public InputConnection onCreateInputConnection(EditorInfo info){return input.connect(info);}
    private boolean canonicalKey(KeyEvent event){
        if(closed)return false;int code;
        switch(event.getKeyCode()){case KeyEvent.KEYCODE_TAB:code=9;break;case KeyEvent.KEYCODE_ENTER:code=13;break;case KeyEvent.KEYCODE_SPACE:code=32;break;case KeyEvent.KEYCODE_ESCAPE:code=27;break;case KeyEvent.KEYCODE_DPAD_LEFT:code=37;break;case KeyEvent.KEYCODE_DPAD_UP:code=38;break;case KeyEvent.KEYCODE_DPAD_RIGHT:code=39;break;case KeyEvent.KEYCODE_DPAD_DOWN:code=40;break;case KeyEvent.KEYCODE_MOVE_HOME:code=36;break;case KeyEvent.KEYCODE_MOVE_END:code=35;break;default:code=Character.toUpperCase(event.getUnicodeChar());if(code<=0||code>65535)return false;}
        boolean accepted=NativeHost.key(host,code,(event.isShiftPressed()?1:0)|(event.isCtrlPressed()?2:0)|(event.isAltPressed()?4:0)|(event.isMetaPressed()?8:0),event.getAction()==KeyEvent.ACTION_DOWN,event.getRepeatCount()>0);readState(true);return accepted;
    }
    @Override public boolean onKeyDown(int key,KeyEvent event){return (key==KeyEvent.KEYCODE_TAB?canonicalKey(event):input.key(event)||canonicalKey(event))||super.onKeyDown(key,event);}
    @Override public boolean onKeyUp(int key,KeyEvent event){return (key==KeyEvent.KEYCODE_TAB?canonicalKey(event):input.key(event)||canonicalKey(event))||super.onKeyUp(key,event);}
    @Override public AccessibilityNodeProvider getAccessibilityNodeProvider(){return accessibility;}
    @Override public boolean dispatchHoverEvent(MotionEvent event){return accessibility.hover(event)||super.dispatchHoverEvent(event);}
    @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(!focused)cancelPointer();if(!closed)NativeHost.frame(host,System.nanoTime(),running&&focused);}
    @Override public boolean onTouchEvent(MotionEvent event){
        if(closed)return false;
        int action=event.getActionMasked(),changed=event.getActionIndex();
        if(action==MotionEvent.ACTION_DOWN){requestFocus();velocity=VelocityTracker.obtain();}
        if(velocity!=null){velocity.addMovement(event);velocity.computeCurrentVelocity(1000);}
        int first=action==MotionEvent.ACTION_MOVE?0:changed,last=action==MotionEvent.ACTION_MOVE?event.getPointerCount():changed+1;
        double density=getResources().getDisplayMetrics().density;
        for(int index=first;index<last;index++){
            int id=event.getPointerId(index),phase=(action==MotionEvent.ACTION_DOWN||action==MotionEvent.ACTION_POINTER_DOWN)?1:action==MotionEvent.ACTION_MOVE?2:action==MotionEvent.ACTION_CANCEL?4:3;
            float x=event.getX(index),y=event.getY(index);float[] before=points.get(id);if(before==null)before=new float[]{x,y};
            int tool=event.getToolType(index),kind=tool==MotionEvent.TOOL_TYPE_MOUSE?2:tool==MotionEvent.TOOL_TYPE_STYLUS||tool==MotionEvent.TOOL_TYPE_ERASER?3:1;
            // MotionEvent reports zero buttons for finger contact. Canonical
            // recognizers require the primary contact bit while it is down.
            int buttons=kind==2?event.getButtonState():(phase<=2?1|((event.getButtonState()&32)!=0?2:0)|((event.getButtonState()&64)!=0?4:0):0);
            NativeHost.input(host,phase,kind,id+1,event.getEventTime()/1000.0,x/density,y/density,phase==2?(before[0]-x)/density:0,phase==2?(before[1]-y)/density:0,velocity==null?0:-velocity.getYVelocity(id)/density,buttons,modifiers(event),false);
            if(phase>=3)points.remove(id);else points.put(id,new float[]{x,y});
        }
        readState(true);
        if(action==MotionEvent.ACTION_DOWN&&input.editable())((InputMethodManager)getContext().getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(this,0);
        if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){if(velocity!=null)velocity.recycle();velocity=null;points.clear();}
        return true;
    }
    private void cancelPointer(){
        if(!closed)for(int i=0;i<points.size();i++){float[] point=points.valueAt(i);double density=getResources().getDisplayMetrics().density;NativeHost.input(host,4,1,points.keyAt(i)+1,android.os.SystemClock.uptimeMillis()/1000.0,point[0]/density,point[1]/density,0,0,0,0,0,false);}
        points.clear();if(velocity!=null)velocity.recycle();velocity=null;
    }
    private static int modifiers(MotionEvent event){int value=KeyEvent.normalizeMetaState(event.getMetaState());return ((value&KeyEvent.META_SHIFT_ON)!=0?1:0)|((value&KeyEvent.META_CTRL_ON)!=0?2:0)|((value&KeyEvent.META_ALT_ON)!=0?4:0)|((value&KeyEvent.META_META_ON)!=0?8:0);}
    @Override public boolean onGenericMotionEvent(MotionEvent event){if(event.getActionMasked()==MotionEvent.ACTION_SCROLL&&!closed){double density=getResources().getDisplayMetrics().density;return NativeHost.input(host,2,2,1,event.getEventTime()/1000.0,event.getX()/density,event.getY()/density,-event.getAxisValue(MotionEvent.AXIS_HSCROLL)*48,-event.getAxisValue(MotionEvent.AXIS_VSCROLL)*48,0,event.getButtonState(),modifiers(event),true);}return super.onGenericMotionEvent(event);}
    private void attach(SurfaceTexture value,int width,int height){texture=value;Surface surface=new Surface(value);long generation=++surfaceGeneration;surfaces.add(new HeldSurface(generation,surface,value));NativeHost.surface(host,surface,generation,width,height,getResources().getDisplayMetrics().density);}
    @Override public void onSurfaceTextureAvailable(SurfaceTexture value,int width,int height){if(!closed)attach(value,width,height);}
    @Override public void onSurfaceTextureSizeChanged(SurfaceTexture value,int width,int height){if(closed)return;for(int i=surfaces.size()-1;i>=0;i--){HeldSurface held=surfaces.get(i);if(held.texture==value&&!held.destroy){held.generation=++surfaceGeneration;NativeHost.surface(host,held.value,held.generation,width,height,getResources().getDisplayMetrics().density);return;}}attach(value,width,height);}
    @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture value){
        texture=null;
        for(int i=surfaces.size()-1;i>=0;i--)if(surfaces.get(i).texture==value){surfaces.get(i).destroy=true;break;}
        NativeHost.surface(host,null,++surfaceGeneration,0,0,1);scheduleRetirement();return false;
    }
    @Override public void onSurfaceTextureUpdated(SurfaceTexture value){}
    private void releaseSurfaces(long retired){for(int i=surfaces.size()-1;i>=0;i--){HeldSurface item=surfaces.get(i);if(item.generation<=retired){item.value.release();if(item.destroy)item.texture.release();surfaces.remove(i);}}}
    private void scheduleRetirement(){if(polling)return;polling=true;retirementDeadline=android.os.SystemClock.uptimeMillis()+15000;handler.postDelayed(new Runnable(){@Override public void run(){try{readState(false);}finally{if((closed&&!state.optBoolean("closed")||!surfaces.isEmpty())&&android.os.SystemClock.uptimeMillis()<retirementDeadline)handler.postDelayed(this,16);else {polling=false;if(closed&&!state.optBoolean("closed"))android.util.Log.e("NelyxV2","Android owner retirement deadline exceeded");}}}},16);}
    public void close(){if(closed)return;pause();cancelPointer();input.close();closed=true;accessibility.close();NativeHost.surface(host,null,++surfaceGeneration,0,0,1);for(int i=surfaces.size()-1;i>=0;i--)if(surfaces.get(i).texture==texture){surfaces.get(i).destroy=true;break;}texture=null;NativeHost.close(host);scheduleRetirement();}
}
