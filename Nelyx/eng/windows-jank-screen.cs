using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static partial class JankScreen {
 [StructLayout(LayoutKind.Sequential)] struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] struct BitmapInfo {
  public uint Size; public int Width,Height; public ushort Planes,Bits;
  public uint Compression,ImageSize; public int Xppm,Yppm; public uint Used,Important,Color;
 }
 [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr window);
 [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr window,IntPtr dc);
 [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window,ref Point point);
 [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr window);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
 [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref BitmapInfo info,uint usage,out IntPtr bits,IntPtr section,uint offset);
 [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
 [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
 [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr target,int x,int y,int width,int height,IntPtr source,int sourceX,int sourceY,uint operation);
 [DllImport("gdi32.dll")] static extern bool GdiFlush();
 [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint value);
 [DllImport("winmm.dll")] static extern uint timeEndPeriod(uint value);
 public sealed class Observation {
  public double Started,Ended,MaximumCaptureMs,MaximumIntervalMs;
  public int Captures,Invalid; public double RequestedHz=240;
  public List<double[]> SampleGaps=new List<double[]>();
  public List<double[]> Changes=new List<double[]>();
 }
 static double Now() { return Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency; }
 public static Observation Capture(IntPtr window,string stop,string ready) {
  IntPtr dpi=SetThreadDpiAwarenessContext(new IntPtr(-4)),screen=IntPtr.Zero,memory=IntPtr.Zero,bitmap=IntPtr.Zero,old=IntPtr.Zero,bits;
  bool timer=false;
  try {
   double scale=GetDpiForWindow(window)/96.0;var origin=new Point();
   if(scale<=0||!ClientToScreen(window,ref origin))throw new Exception("Screen capture geometry unavailable");
   int left=(int)Math.Round(8*scale),width=(int)Math.Round(104*scale)-left;
   int top=(int)Math.Round(11*scale),last=-1;
   screen=GetDC(IntPtr.Zero);memory=CreateCompatibleDC(screen);
   var info=new BitmapInfo{Size=40,Width=width,Height=-1,Planes=1,Bits=32};
   bitmap=CreateDIBSection(screen,ref info,0,out bits,IntPtr.Zero,0);
   if(screen==IntPtr.Zero||memory==IntPtr.Zero||bitmap==IntPtr.Zero||bits==IntPtr.Zero)throw new Exception("Screen capture allocation failed");
   old=SelectObject(memory,bitmap);timer=timeBeginPeriod(1)==0;
   if(!timer)throw new Exception("Screen capture timer unavailable");
   var result=new Observation{Started=Now()};double next=result.Started,previous=0;
   File.WriteAllText(ready,"ready");
   while(!File.Exists(stop)) {
    double at=Now();if(at-result.Started>180000)throw new Exception("Screen capture exceeded 180 seconds");
    if(GetForegroundWindow()!=window)throw new Exception("Screen capture lost foreground");
    if(GetDpiForWindow(window)/96.0!=scale)throw new Exception("Screen capture DPI changed");
    var current=new Point();if(!ClientToScreen(window,ref current)||current.X!=origin.X||current.Y!=origin.Y)throw new Exception("Screen capture target moved");
    if(!BitBlt(memory,0,0,width,1,screen,origin.X+left,origin.Y+top,0x40cc0020)||!GdiFlush())throw new Exception("Screen capture failed");
    double completed=Now(),sample=(at+completed)/2;
    result.MaximumCaptureMs=Math.Max(result.MaximumCaptureMs,completed-at);
    if(previous>0 && sample-previous>1000.0/60)result.SampleGaps.Add(new double[]{previous,sample});
    if(previous>0)result.MaximumIntervalMs=Math.Max(result.MaximumIntervalMs,sample-previous);
    previous=sample;result.Captures++;
    uint code=0;bool valid=true;
    for(int bit=0;bit<32;bit++) {
     int x=(int)Math.Round((8+(bit+.5)*3)*scale)-left,pixel=Marshal.ReadInt32(bits,x*4);
     int r=(pixel>>16)&255,g=(pixel>>8)&255,b=pixel&255;
     if(r>=200&&g>=200&&b>=200)code|=1u<<bit;
     else if(r>55||g>55||b>55){valid=false;break;}
    }
    int frame=(int)((code>>8)&65535),checksum=(frame^(frame>>8)^0xa5)&255;
    valid=valid&&(code&255)==0xd3&&(code>>24)==checksum&&frame!=0;
    if(!valid)result.Invalid++;
    else if(frame!=last) {
     if(result.Changes.Count>=4096)throw new Exception("Screen observation budget exceeded");
     result.Changes.Add(new double[]{sample,frame});last=frame;
    }
    next+=1000.0/result.RequestedHz;if(next<completed)next=completed+1000.0/result.RequestedHz;
    while(Now()<next){if(next-Now()>1.5)Thread.Sleep(1);else Thread.SpinWait(32);}
   }
   result.Ended=Now();return result;
  } finally {
   if(timer)timeEndPeriod(1);if(old!=IntPtr.Zero&&memory!=IntPtr.Zero)SelectObject(memory,old);
   if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(memory!=IntPtr.Zero)DeleteDC(memory);if(screen!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,screen);
   SetThreadDpiAwarenessContext(dpi);
  }
 }
}
