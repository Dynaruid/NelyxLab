// SPDX-License-Identifier: BSD-3-Clause
package com.reactnative.skia;
import android.view.MotionEvent;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.Event;

/** Preserve actual Android history and every move across a busy JS frame. */
final class AndroidPointerEvent extends Event<AndroidPointerEvent> {
  private final WritableMap data;
  AndroidPointerEvent(int surface,int tag,int nativeId,MotionEvent event,float density) {
    super(surface,tag);data=Arguments.createMap();data.putInt("protocol",1);data.putInt("nativeId",nativeId);
    WritableArray samples=Arguments.createArray();int action=event.getActionMasked();
    if(action==MotionEvent.ACTION_MOVE){
      for(int history=0;history<event.getHistorySize();history++)for(int pointer=0;pointer<event.getPointerCount();pointer++)
        samples.pushMap(sample(event,pointer,"move",event.getHistoricalX(pointer,history),event.getHistoricalY(pointer,history),event.getHistoricalEventTime(history),density));
      for(int pointer=0;pointer<event.getPointerCount();pointer++)samples.pushMap(sample(event,pointer,"move",event.getX(pointer),event.getY(pointer),event.getEventTime(),density));
    }else if(action==MotionEvent.ACTION_CANCEL){
      for(int pointer=0;pointer<event.getPointerCount();pointer++)samples.pushMap(sample(event,pointer,"cancel",event.getX(pointer),event.getY(pointer),event.getEventTime(),density));
    }else{
      int pointer=event.getActionIndex();String kind=action==MotionEvent.ACTION_DOWN||action==MotionEvent.ACTION_POINTER_DOWN?"down":"up";
      samples.pushMap(sample(event,pointer,kind,event.getX(pointer),event.getY(pointer),event.getEventTime(),density));
    }
    data.putArray("samples",samples);
  }
  private static WritableMap sample(MotionEvent event,int pointer,String kind,float x,float y,long time,float density){
    WritableMap value=Arguments.createMap();int tool=event.getToolType(pointer),buttons=event.getButtonState();
    boolean pen=tool==MotionEvent.TOOL_TYPE_STYLUS||tool==MotionEvent.TOOL_TYPE_ERASER,mouse=tool==MotionEvent.TOOL_TYPE_MOUSE;
    value.putString("kind",kind);value.putString("device",pen?"pen":mouse?"mouse":tool==MotionEvent.TOOL_TYPE_FINGER?"touch":"unknown");
    if(!mouse)buttons=1|(pen&&((buttons&MotionEvent.BUTTON_STYLUS_PRIMARY)!=0)?2:0)|(pen&&((buttons&MotionEvent.BUTTON_STYLUS_SECONDARY)!=0)?4:0);
    value.putInt("pointer",event.getPointerId(pointer));value.putInt("buttons",kind.equals("up")||kind.equals("cancel")?0:buttons&31);
    value.putDouble("x",x/density);value.putDouble("y",y/density);value.putDouble("timestamp",time);return value;
  }
  @Override public String getEventName(){return "topAndroidPointer";}
  @Override public boolean canCoalesce(){return false;}
  @Override public WritableMap getEventData(){return data;}
}
