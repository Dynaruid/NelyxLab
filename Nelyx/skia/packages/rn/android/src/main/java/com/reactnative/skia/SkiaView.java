package com.reactnative.skia;

import android.content.Context;
import android.graphics.SurfaceTexture;
import android.util.Log;
import android.view.Choreographer;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.View;

import androidx.annotation.Nullable;

import com.facebook.jni.HybridData;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.uimanager.PointerEvents;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.views.view.ReactViewGroup;

/**
 * The Android view behind <Canvas>, <SkiaPictureView> and <SkiaGraphiteView>.
 * It is backed by a SurfaceView or a TextureView (see updateView()) that the
 * native side draws into with Graphite, presenting the queued recordings when
 * the backing view can show them (see FrameScheduler).
 */
public class SkiaView extends ReactViewGroup implements SkiaViewAPI, Choreographer.FrameCallback {
    private static final String TAG = "SkiaView";

    @DoNotStrip
    private HybridData mHybridData;

    private View mView;
    private String mMouseCursor = "basic";
    int mCursorNativeId;

    public void setMouseCursor(@Nullable String kind) {
        mMouseCursor=kind==null?"basic":kind;
        setPointerIcon(SystemMouseCursor.resolve(getContext(),mMouseCursor));
        if(mView!=null)mView.setPointerIcon(SystemMouseCursor.resolve(getContext(),mMouseCursor));
    }
    @Override public boolean dispatchHoverEvent(MotionEvent event) {
        int action=event.getActionMasked();
        if(mCursorNativeId>0&&PointerEvents.canBeTouchTarget(getPointerEvents())&&event.getPointerCount()>0&&(event.getToolType(0)==MotionEvent.TOOL_TYPE_MOUSE||event.getToolType(0)==MotionEvent.TOOL_TYPE_STYLUS)&&(action==MotionEvent.ACTION_HOVER_ENTER||action==MotionEvent.ACTION_HOVER_MOVE||action==MotionEvent.ACTION_HOVER_EXIT)) {
            ReactContext context=(ReactContext)getContext();var dispatcher=UIManagerHelper.getEventDispatcherForReactTag(context,getId());
            if(dispatcher!=null)dispatcher.dispatchEvent(new NativeMouseEvent(UIManagerHelper.getSurfaceId(this),getId(),mCursorNativeId,event,getResources().getDisplayMetrics().density));
        }
        return super.dispatchHoverEvent(event);
    }

    // Props, applied together in updateView(). A null kind is "auto".
    private boolean mOpaque = false;
    @Nullable
    private BackingViewKind mRequestedKind = null;
    private boolean mZOrderOnTop = false;
    private boolean mHighBitDepth = false;

    // What the current backing view was created with; no kind before the first one.
    @Nullable
    private BackingViewKind mAppliedKind = null;
    private boolean mAppliedZOrderOnTop;
    private boolean mAppliedHighBitDepth;

    private final Runnable mPostedPresent = this::onPostedPresent;
    private final FrameScheduler mFrameScheduler = new FrameScheduler(new FrameScheduler.Host() {
        @Override
        public void postFrameCallback() {
            Choreographer.getInstance().postFrameCallback(SkiaView.this);
        }

        @Override
        public void postBehindPendingDraw() {
            post(mPostedPresent);
        }

        @Override
        public boolean presentFrame() {
            return SkiaView.this.presentFrame();
        }
    });

    public SkiaView(Context context) {
        super(context);
        RNSkiaModule skiaModule = ((ReactContext) context).getNativeModule(RNSkiaModule.class);
        mHybridData = initHybrid(skiaModule.getSkiaManager());
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        // When pointerEvents is "none" or "box-none", make this view completely
        // transparent to touch dispatch so events pass through to views behind it
        if (!PointerEvents.canBeTouchTarget(getPointerEvents())) {
            return false;
        }
        int action=ev.getActionMasked();
        boolean contact=action==MotionEvent.ACTION_DOWN||action==MotionEvent.ACTION_POINTER_DOWN||action==MotionEvent.ACTION_MOVE||action==MotionEvent.ACTION_POINTER_UP||action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL;
        if(contact){
            var dispatcher=UIManagerHelper.getEventDispatcherForReactTag((ReactContext)getContext(),getId());
            if(dispatcher!=null)dispatcher.dispatchEvent(new AndroidPointerEvent(UIManagerHelper.getSurfaceId(this),getId(),mCursorNativeId,ev,getResources().getDisplayMetrics().density));
        }
        boolean handled=super.dispatchTouchEvent(ev);
        // Retain the native target through MOVE/UP even when the GPU backing
        // child has no Android click listener. Core owns gesture recognition.
        return contact||handled;
    }

    public void setOpaque(boolean value) {
        mOpaque = value;
    }

    public void setSurfaceType(@Nullable String value) {
        mRequestedKind = BackingViewKind.fromSurfaceType(value);
    }

    public void setZOrderOnTop(boolean value) {
        mZOrderOnTop = value;
    }

    public void setHighBitDepth(boolean value) {
        mHighBitDepth = value;
    }

    // Resolve the backing view from the props. "auto" picks SurfaceView for an
    // opaque canvas and TextureView for a non-opaque one.
    private BackingViewKind resolveKind() {
        if (mRequestedKind != null) {
            return mRequestedKind;
        }
        return mOpaque ? BackingViewKind.SURFACE_VIEW : BackingViewKind.TEXTURE_VIEW;
    }

    // The 10-bit buffer format only has 2 bits of alpha, which would visibly
    // break translucency, and the extra precision would be lost in the 8-bit
    // composition pass of a TextureView anyway. So the flag only applies to an
    // opaque SurfaceView.
    private boolean resolveHighBitDepth(BackingViewKind kind) {
        if (!mHighBitDepth) {
            return false;
        }
        if (kind != BackingViewKind.SURFACE_VIEW || !mOpaque) {
            Log.w(TAG, "highBitDepth requires an opaque SurfaceView on Android, falling back to the 8-bit format");
            return false;
        }
        return true;
    }

    // Apply the complete prop transaction once, after every prop has arrived.
    // Only a change of backing view, or of a setting the view must know before
    // it attaches (zOrderOnTop, the buffer format), replaces the child; opacity
    // is applied in place.
    void updateView() {
        BackingViewKind kind = resolveKind();
        boolean zOrderOnTop = kind == BackingViewKind.SURFACE_VIEW && mZOrderOnTop;
        boolean highBitDepth = resolveHighBitDepth(kind);
        if (mView == null
                || kind != mAppliedKind
                || zOrderOnTop != mAppliedZOrderOnTop
                || highBitDepth != mAppliedHighBitDepth) {
            if (mView != null) {
                removeView(mView);
            }
            mAppliedKind = kind;
            mAppliedZOrderOnTop = zOrderOnTop;
            mAppliedHighBitDepth = highBitDepth;
            mView = switch (kind) {
                case SURFACE_VIEW -> new SkiaSurfaceView(getContext(), this, zOrderOnTop, mOpaque);
                case TEXTURE_VIEW -> new SkiaTextureView(getContext(), this, mOpaque);
            };
            addView(mView);
            mView.setPointerIcon(SystemMouseCursor.resolve(getContext(),mMouseCursor));
            // React Native sizes native children explicitly through onLayout, so
            // the requestLayout triggered by addView is ignored; size the new
            // child ourselves or it stays 0x0 and never gets a surface.
            if (getWidth() > 0 || getHeight() > 0) {
                mView.layout(0, 0, getWidth(), getHeight());
            }
        } else {
            switch (kind) {
                case SURFACE_VIEW -> ((SkiaSurfaceView) mView).setOpaque(mOpaque);
                case TEXTURE_VIEW -> ((SkiaTextureView) mView).setOpaque(mOpaque);
            }
        }
    }

    void dropInstance() {
        mCursorNativeId=0;
        unregisterView();
    }

    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);
        // The backing view gets this exact size, and so does its surface: tell
        // the native side now, so that a frame recorded before the surface
        // exists (the first one usually is) already has the right size.
        setLayoutSize(right - left, bottom - top);
        if (mView != null) {
            mView.layout(0, 0, right - left, bottom - top);
        }
    }

    // Frames --------------------------------------------------------------

    /** A recording was submitted. Main thread; called from native. */
    @DoNotStrip
    public void scheduleFrame() {
        mFrameScheduler.requestFrame(mAppliedKind);
    }

    @Override
    public void doFrame(long frameTimeNanos) {
        mFrameScheduler.onFrame(mAppliedKind);
    }

    private void onPostedPresent() {
        mFrameScheduler.onPosted();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        Choreographer.getInstance().removeFrameCallback(this);
        removeCallbacks(mPostedPresent);
        mFrameScheduler.cancel();
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        mHybridData.resetNative();
    }

    // Surfaces ------------------------------------------------------------

    // SurfaceView callbacks: the native side receives an android.view.Surface.

    @Override
    public void onSurfaceCreated(Surface surface, int width, int height) {
        surfaceAvailable(surface, width, height, true, mAppliedHighBitDepth);
    }

    @Override
    public void onSurfaceChanged(Surface surface, int width, int height) {
        Log.i(TAG, "onSurfaceChanged " + width + "/" + height);
        surfaceSizeChanged(surface, width, height, true, mAppliedHighBitDepth);
    }

    // TextureView callbacks: the native side receives the SurfaceTexture and
    // creates the Surface it draws into. The 10-bit format is never used here.

    @Override
    public void onSurfaceTextureCreated(SurfaceTexture surface, int width, int height) {
        surfaceAvailable(surface, width, height, false, false);
    }

    @Override
    public void onSurfaceTextureChanged(SurfaceTexture surface, int width, int height) {
        Log.i(TAG, "onSurfaceTextureSizeChanged " + width + "/" + height);
        surfaceSizeChanged(surface, width, height, false, false);
    }

    @Override
    public void onSurfaceDestroyed() {
        surfaceDestroyed();
    }

    // Native ---------------------------------------------------------------

    private native HybridData initHybrid(SkiaManager skiaManager);

    // isSurface tells the native side whether `surface` is an
    // android.view.Surface (SurfaceView) or a SurfaceTexture (TextureView).
    private native void surfaceAvailable(Object surface, int width, int height, boolean isSurface, boolean highBitDepth);

    private native void surfaceSizeChanged(Object surface, int width, int height, boolean isSurface, boolean highBitDepth);

    private native void surfaceDestroyed();

    private native void setLayoutSize(int width, int height);

    native void registerView(int nativeId);

    private native void unregisterView();

    /** Presents the queued recordings, returning whether any are left. */
    private native boolean presentFrame();
}
