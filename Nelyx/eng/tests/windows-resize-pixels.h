// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include "windows-resize-glyphs.h"
#include <dwmapi.h>
#include <d3d11.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <exception>
#include <memory>
#include <mutex>
#include <set>
#include <stdexcept>
#include "windows-resize-timing.h"
#pragma comment(lib,"windowsapp.lib")
#pragma comment(lib,"d3d11.lib")

// Inspect only the owned fixture's bounded header region in a monitor frame.
// The monitor extent stays fixed. Native caption/border pixels identify the
// displayed client bounds in that SAME image; USER32 bounds and a resizing
// window-capture ContentSize are independent observations, not pixel receipts.
// The fixture's temporary native colors are restored. No images are retained.
class WindowsResizePixels final {
  using Frame=winrt::Windows::Graphics::Capture::Direct3D11CaptureFrame;
  struct CaptureState{
    std::mutex mutex;Frame latest{nullptr};std::exception_ptr failure;bool closed=false;
    winrt::handle ready{CreateEventW(nullptr,FALSE,FALSE,nullptr)};
  };
  HWND window;bool apartment=false,colorsChanged=false,calibrated=false;double scale=1;
  RECT monitor{},region{};COLORREF oldCaption=DWMWA_COLOR_DEFAULT,oldBorder=DWMWA_COLOR_DEFAULT;
  static constexpr COLORREF sensorColor=RGB(229,17,203);
  int left=0,right=0,top=0,bottom=0,headerHeight=0,capacityWidth=0,capacityHeight=0,lastWidth=0;
  winrt::com_ptr<ID3D11Device> device;winrt::com_ptr<ID3D11DeviceContext> context;winrt::com_ptr<ID3D11Texture2D> staging;
  winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool pool{nullptr};
  winrt::Windows::Graphics::Capture::GraphicsCaptureSession session{nullptr};winrt::event_token arrived{};
  const std::shared_ptr<CaptureState> state=std::make_shared<CaptureState>();
  struct Glyph{int width=0,height=0,rightInset=-1,x=0,y=0,anchor=-1,edgeTop=-1;};Glyph reference;
  std::set<std::pair<int,int>> sizes;
  Frame take(bool wait){
    for(;;){
      {std::lock_guard lock(state->mutex);if(state->failure)std::rethrow_exception(state->failure);if(state->latest){auto frame=std::move(state->latest);state->latest=nullptr;return frame;}}
      if(!wait)return nullptr;
      if(WaitForSingleObject(state->ready.get(),2000)!=WAIT_OBJECT_0)throw std::runtime_error("Owned window capture did not deliver a frame");
    }
  }
  void release()noexcept{
    {std::lock_guard lock(state->mutex);state->closed=true;}
    try{if(pool)pool.FrameArrived(arrived);if(session)session.Close();if(pool)pool.Close();}catch(...){}
    {std::lock_guard lock(state->mutex);try{if(state->latest)state->latest.Close();}catch(...){}state->latest=nullptr;}
    session=nullptr;pool=nullptr;staging=nullptr;context=nullptr;device=nullptr;
    if(colorsChanged&&IsWindow(window)){DwmSetWindowAttribute(window,DWMWA_CAPTION_COLOR,&oldCaption,sizeof(oldCaption));DwmSetWindowAttribute(window,DWMWA_BORDER_COLOR,&oldBorder,sizeof(oldBorder));colorsChanged=false;}
    if(apartment){winrt::uninit_apartment();apartment=false;}
  }
  Glyph capture(Frame const& frame,bool observe){
    const auto size=frame.ContentSize();
    if(size.Width!=capacityWidth||size.Height!=capacityHeight)throw std::runtime_error("Capture monitor changed during the owned drag");
    auto access=frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
    winrt::com_ptr<ID3D11Texture2D> texture;winrt::check_hresult(access->GetInterface(__uuidof(ID3D11Texture2D),texture.put_void()));
    D3D11_BOX box{UINT(region.left-monitor.left),UINT(region.top-monitor.top),0,UINT(region.right-monitor.left),UINT(region.bottom-monitor.top),1};context->CopySubresourceRegion(staging.get(),0,0,0,0,texture.get(),0,&box);
    D3D11_MAPPED_SUBRESOURCE mapped{};winrt::check_hresult(context->Map(staging.get(),0,D3D11_MAP_READ,0,&mapped));
    try{
      const int regionWidth=region.right-region.left,regionHeight=region.bottom-region.top;
      const auto pixel=[&](int x,int y){return static_cast<const unsigned char*>(mapped.pData)+y*mapped.RowPitch+x*4;};
      int minX=regionWidth,minY=regionHeight,maxX=-1,maxY=-1,countBorder=0;
      for(int y=0;y<regionHeight;y++)for(int x=0;x<regionWidth;x++){const auto p=pixel(x,y);if(std::abs(int(p[2])-229)<=6&&std::abs(int(p[1])-17)<=6&&std::abs(int(p[0])-203)<=6){minX=std::min(minX,x);minY=std::min(minY,y);maxX=std::max(maxX,x);maxY=std::max(maxY,y);++countBorder;}}
      if(countBorder<100)throw std::runtime_error("Owned displayed window border is absent or occluded");
      if(!calibrated){RECT client{};POINT origin{};if(!GetClientRect(window,&client)||!ClientToScreen(window,&origin))throw std::runtime_error("Desktop calibration client unavailable");left=origin.x-region.left-minX;top=origin.y-region.top-minY;right=region.left+maxX+1-origin.x-client.right;bottom=region.top+maxY+1-origin.y-client.bottom;calibrated=true;}
      const int width=maxX-minX+1-left-right,height=maxY-minY+1-top-bottom,clientX=minX+left,clientY=minY+top;lastWidth=width;
      if(width<=0||clientX<0||clientY<0||clientX+width>regionWidth||clientY+headerHeight>regionHeight)throw std::runtime_error("Displayed header left the bounded owned region");
      const auto dark=[&](int x,int y){const auto p=pixel(clientX+x,clientY+y);return p[0]<80&&p[1]<80&&p[2]<80;};
      if(observe){++samples;sizes.emplace(width,height);Nelyx::Fixture::appendChanged(displayChanges,double(frame.SystemRelativeTime().count())/10000.,RECT{minX,minY,maxX+1,maxY+1});unsigned count=0;for(int part=1;part<=3;part++)if(dark(width*part/4,6))++count;if(count==3)++backgroundExposures;}
      const int xBegin=static_cast<int>(8*scale),yBegin=static_cast<int>(4*scale),xEnd=std::min(width,static_cast<int>(240*scale));
      const auto glyph=resizeGlyphBounds(xBegin,yBegin,xEnd,headerHeight,dark,observe?reference.anchor:-1);
      if(glyph.pixels<10){if(observe)++missingGlyphs;else throw std::runtime_error("Captured header glyph calibration is empty");}
      int rightmost=-1,edgeTop=headerHeight;
      // A dedicated color distinguishes the layout marker from live scrollbar
      // thumbs, text and icons. Their darkest edge is not a layout receipt.
      for(int y=yBegin;y<headerHeight;y++)for(int x=std::max(0,width-static_cast<int>(90*scale));x<width-static_cast<int>(6*scale);x++){const auto p=pixel(clientX+x,clientY+y);if(std::abs(int(p[0])-91)<=4&&std::abs(int(p[1])-230)<=4&&p[2]<=4){rightmost=std::max(rightmost,x);edgeTop=std::min(edgeTop,y);}}
      if(rightmost<0){if(observe)++missingEdgeGlyphs;else throw std::runtime_error("Captured right header calibration is empty");}
      context->Unmap(staging.get(),0);return {glyph.pixels<10?0:glyph.width,glyph.pixels<10?0:glyph.height,rightmost<0?-1:width-1-rightmost,glyph.x,glyph.y,glyph.anchor,rightmost<0?-1:edgeTop};
    }catch(...){context->Unmap(staging.get(),0);throw;}
  }
public:
  std::vector<Nelyx::Fixture::ResizeObservation> displayChanges;
  unsigned samples=0,racedSamples=0,backgroundExposures=0,glyphChanges=0,missingGlyphs=0,edgeGlyphChanges=0,missingEdgeGlyphs=0;int maximumGlyphDelta=0,maximumEdgeDelta=0;
  explicit WindowsResizePixels(HWND window):window(window){
    try{
      DWORD process=0;GetWindowThreadProcessId(window,&process);if(process!=GetCurrentProcessId()||GetForegroundWindow()!=window)throw std::runtime_error("Capture requires the fixture's own foreground window");
      winrt::init_apartment(winrt::apartment_type::multi_threaded);apartment=true;if(!state->ready)winrt::throw_last_error();
      scale=GetDpiForWindow(window)/96.;headerHeight=static_cast<int>(44*scale);
      winrt::check_hresult(D3D11CreateDevice(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,device.put(),nullptr,context.put()));
      winrt::Windows::Foundation::IInspectable inspectable{nullptr};winrt::check_hresult(CreateDirect3D11DeviceFromDXGIDevice(device.as<IDXGIDevice>().get(),reinterpret_cast<IInspectable**>(winrt::put_abi(inspectable))));
      const auto captureDevice=inspectable.as<winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice>();
      const auto target=MonitorFromWindow(window,MONITOR_DEFAULTTONEAREST);MONITORINFO info{sizeof(info)};if(!GetMonitorInfoW(target,&info))throw std::runtime_error("Owned monitor unavailable");monitor=info.rcMonitor;capacityWidth=monitor.right-monitor.left;capacityHeight=monitor.bottom-monitor.top;
      RECT outer{};POINT origin{};if(!GetWindowRect(window,&outer)||!ClientToScreen(window,&origin))throw std::runtime_error("Owned header region unavailable");
      const int growth=static_cast<int>(std::ceil(84*scale))+16,rise=static_cast<int>(std::ceil(28*scale))+16;
      region={std::max(monitor.left,outer.left-growth),std::max(monitor.top,outer.top-rise),std::min(monitor.right,outer.right+growth),std::min(monitor.bottom,outer.bottom+rise)};
      DwmGetWindowAttribute(window,DWMWA_CAPTION_COLOR,&oldCaption,sizeof(oldCaption));DwmGetWindowAttribute(window,DWMWA_BORDER_COLOR,&oldBorder,sizeof(oldBorder));
      winrt::check_hresult(DwmSetWindowAttribute(window,DWMWA_CAPTION_COLOR,&sensorColor,sizeof(sensorColor)));colorsChanged=true;winrt::check_hresult(DwmSetWindowAttribute(window,DWMWA_BORDER_COLOR,&sensorColor,sizeof(sensorColor)));winrt::check_hresult(DwmFlush());
      winrt::Windows::Graphics::Capture::GraphicsCaptureItem item{nullptr};winrt::check_hresult(winrt::get_activation_factory<winrt::Windows::Graphics::Capture::GraphicsCaptureItem,IGraphicsCaptureItemInterop>()->CreateForMonitor(target,winrt::guid_of<winrt::Windows::Graphics::Capture::GraphicsCaptureItem>(),winrt::put_abi(item)));
      pool=winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool::CreateFreeThreaded(captureDevice,winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,2,{capacityWidth,capacityHeight});
      arrived=pool.FrameArrived([state=state](auto const& sender,auto const&){
        try{auto frame=sender.TryGetNextFrame();if(!frame)return;std::lock_guard lock(state->mutex);if(state->closed){frame.Close();return;}if(state->latest)state->latest.Close();state->latest=std::move(frame);SetEvent(state->ready.get());}
        catch(...){std::lock_guard lock(state->mutex);state->failure=std::current_exception();SetEvent(state->ready.get());}
      });
      session=pool.CreateCaptureSession(item);session.IsCursorCaptureEnabled(false);session.StartCapture();auto frame=take(true);
      D3D11_TEXTURE2D_DESC desc{};desc.Width=region.right-region.left;desc.Height=region.bottom-region.top;desc.MipLevels=desc.ArraySize=1;desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;desc.SampleDesc.Count=1;desc.Usage=D3D11_USAGE_STAGING;desc.CPUAccessFlags=D3D11_CPU_ACCESS_READ;
      winrt::check_hresult(device->CreateTexture2D(&desc,nullptr,staging.put()));reference=capture(frame,false);frame.Close();
      // The first capture can contain a transitional hover/desktop snapshot.
      // Establish a resting baseline before any resize input, then inspect
      // every sampled drag frame against that fixed baseline.
      unsigned stable=0;for(unsigned attempt=0;attempt<8&&stable<2;attempt++){
        auto next=take(true);const auto value=capture(next,false);next.Close();
        const bool same=value.width==reference.width&&value.height==reference.height&&value.x==reference.x&&value.y==reference.y;
        std::printf("ANIMATION_GLYPH_CALIBRATION previous=%d,%d next=%d,%d stable=%u\n",reference.width,reference.height,value.width,value.height,same?stable+1:0);
        stable=same?stable+1:0;reference=value;
      }
      if(stable<2)throw std::runtime_error("Resting header capture did not stabilize before resize");
      if(std::abs(reference.rightInset-static_cast<int>(10*scale))>1||std::abs(reference.edgeTop-static_cast<int>(6*scale))>1)throw std::runtime_error("Fixture right-edge layout sensor is absent");
    }catch(...){release();throw;}
  }
  ~WindowsResizePixels(){release();}
  WindowsResizePixels(const WindowsResizePixels&)=delete;WindowsResizePixels& operator=(const WindowsResizePixels&)=delete;
  void sample(){
    if(GetForegroundWindow()!=window)throw std::runtime_error("Owned desktop probe lost foreground");
    auto frame=take(false);if(!frame)return;const auto glyph=capture(frame,true);frame.Close();if(!glyph.width)return;
    const auto delta=std::max(std::abs(glyph.width-reference.width),std::abs(glyph.height-reference.height));maximumGlyphDelta=std::max(maximumGlyphDelta,delta);if(delta>1){++glyphChanges;if(glyphChanges<=8)std::printf("ANIMATION_GLYPH_MISMATCH actual=%d,%d,%d,%d expected=%d,%d,%d,%d\n",glyph.x,glyph.y,glyph.width,glyph.height,reference.x,reference.y,reference.width,reference.height);}
    const auto originDelta=std::max(std::abs(glyph.x-reference.x),std::abs(glyph.y-reference.y));if(originDelta>1&&samples<8)std::printf("ANIMATION_ORIGIN_MISMATCH x=%d y=%d expected=%d,%d delta=%d\n",glyph.x,glyph.y,reference.x,reference.y,originDelta);
    if(glyph.rightInset>=0){const auto edge=std::max(std::abs(glyph.rightInset-reference.rightInset),std::abs(glyph.edgeTop-reference.edgeTop));maximumEdgeDelta=std::max(maximumEdgeDelta,edge);if(edge>1){++edgeGlyphChanges;if(edgeGlyphChanges<=8){RECT client{},outer{},extended{};GetClientRect(window,&client);GetWindowRect(window,&outer);DwmGetWindowAttribute(window,DWMWA_EXTENDED_FRAME_BOUNDS,&extended,sizeof(extended));std::printf("ANIMATION_EDGE_MISMATCH inset=%d expected=%d delta=%d top=%d expectedTop=%d captured=%d client=%ld outer=%ld extended=%ld insets=%d,%d\n",glyph.rightInset,reference.rightInset,edge,glyph.edgeTop,reference.edgeTop,lastWidth,client.right,outer.right-outer.left,extended.right-extended.left,left,right);}}}
  }
  int distinctSizes()const{return static_cast<int>(sizes.size());}
  int referenceWidth()const{return reference.width;}int referenceHeight()const{return reference.height;}
};
