package com.reactnative.skia;

import com.facebook.react.uimanager.PointerEvents;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewProps;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.SkiaViewManagerDelegate;
import com.facebook.react.viewmanagers.SkiaViewManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public class SkiaViewManager extends ReactViewManager implements SkiaViewManagerInterface<SkiaView> {

    protected SkiaViewManagerDelegate mDelegate;

    SkiaViewManager() {
        mDelegate = new SkiaViewManagerDelegate(this);
    }

    protected SkiaViewManagerDelegate getDelegate() {
        return mDelegate;
    }

    @NonNull
    @Override
    public String getName() {
        return "SkiaView";
    }

    @NonNull
    @Override
    public SkiaView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new SkiaView(reactContext);
    }

    @Override
    public void setNativeId(@NonNull ReactViewGroup view, @Nullable String nativeId) {
        super.setNativeId(view, nativeId);
        int nativeIdResolved = Integer.parseInt(nativeId);
        ((SkiaView)view).mCursorNativeId=nativeIdResolved;
        ((SkiaView) view).registerView(nativeIdResolved);
    }

    @ReactProp(name = "opaque")
    public void setOpaque(SkiaView view, boolean value) {
        view.setOpaque(value);
    }

    @Override public java.util.Map<String,Object> getExportedCustomDirectEventTypeConstants() {
        var base=super.getExportedCustomDirectEventTypeConstants();var events=new java.util.HashMap<String,Object>();if(base!=null)events.putAll(base);
        events.put("topNativeMouseEvent",java.util.Map.of("registrationName","onNativeMouseEvent"));
        events.put("topAndroidPointer",java.util.Map.of("registrationName","onAndroidPointer"));return events;
    }

    @Override public java.util.Map<String,Object> getExportedViewConstants() {
        var base=super.getExportedViewConstants();var constants=new java.util.HashMap<String,Object>();if(base!=null)constants.putAll(base);constants.put("androidPointerProtocol",1);return constants;
    }

    @ReactProp(name = "mouseCursor")
    public void setMouseCursor(SkiaView view, @Nullable String value) {
        view.setMouseCursor(value);
    }

    @ReactProp(name = "highBitDepth")
    public void setHighBitDepth(SkiaView view, boolean value) {
        view.setHighBitDepth(value);
    }

    @ReactProp(name = "androidSurfaceType")
    public void setAndroidSurfaceType(SkiaView view, @Nullable String value) {
        view.setSurfaceType(value);
    }

    @ReactProp(name = "androidZOrderOnTop")
    public void setAndroidZOrderOnTop(SkiaView view, boolean value) {
        view.setZOrderOnTop(value);
    }

    @ReactProp(name = ViewProps.POINTER_EVENTS)
    public void setPointerEvents(SkiaView view, @Nullable String pointerEventsStr) {
        view.setPointerEvents(PointerEvents.parsePointerEvents(pointerEventsStr));
    }

    // The backing view depends on several props (opaque, androidSurfaceType,
    // androidZOrderOnTop, highBitDepth), so it is resolved once per transaction
    // rather than in each setter.
    @Override
    protected void onAfterUpdateTransaction(@NonNull ReactViewGroup view) {
        super.onAfterUpdateTransaction(view);
        ((SkiaView) view).updateView();
    }

    @Override
    public void onDropViewInstance(@NonNull ReactViewGroup view) {
        super.onDropViewInstance(view);
        ((SkiaView) view).dropInstance();
    }
}
