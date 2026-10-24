// SPDX-License-Identifier: BSD-3-Clause
package com.reactnative.skia;
import android.view.MotionEvent;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.Event;
final class NativeMouseEvent extends Event<NativeMouseEvent> {
  private final WritableMap data;
  NativeMouseEvent(int surface,int tag,int nativeId,MotionEvent event,float density) {
    super(surface,tag);data=Arguments.createMap();data.putInt("protocol",1);data.putInt("nativeId",nativeId);
    data.putString("kind",event.getActionMasked()==MotionEvent.ACTION_HOVER_EXIT?"leave":"hover");
    boolean stylus=event.getToolType(0)==MotionEvent.TOOL_TYPE_STYLUS;int buttons=event.getButtonState();if(stylus)buttons=((buttons&MotionEvent.BUTTON_STYLUS_PRIMARY)!=0?2:0)|((buttons&MotionEvent.BUTTON_STYLUS_SECONDARY)!=0?4:0);
    data.putString("device",stylus?"pen":"mouse");data.putInt("pointer",event.getPointerId(0));data.putInt("buttons",buttons);
    data.putDouble("x",event.getX()/density);data.putDouble("y",event.getY()/density);data.putDouble("timestamp",event.getEventTime());
  }
  @Override public String getEventName(){return "topNativeMouseEvent";}
  @Override public boolean canCoalesce(){return false;}
  @Override public WritableMap getEventData(){return data;}
}
