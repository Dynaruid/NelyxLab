# SPDX-License-Identifier: BSD-3-Clause
# Offline, process-owned DbgHelp session. No target process is opened or changed.
param(
 [Parameter(Mandatory=$true)][string]$ImagePath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,
 [uint32]$ExpectedImageSize=0
)
$ErrorActionPreference='Stop'
if(![Environment]::Is64BitProcess){throw 'V8 PDB decoding requires x64 PowerShell'}
$taskImage=(Resolve-Path -LiteralPath $ImagePath).Path
$taskPdb=$taskImage+'.pdb'
if(!(Test-Path -LiteralPath $taskPdb -PathType Leaf)){throw 'Pinned local PDB missing'}
if((Get-Item -LiteralPath $taskPdb).Length -gt 1GB){throw 'PDB exceeds the diagnostic read budget'}
if((Get-FileHash -LiteralPath $taskImage -Algorithm SHA256).Hash -ne $ExpectedSha256){throw 'PDB image differs from the sampled V8 supplier'}
$taskPayload=[Console]::In.ReadToEnd()
if($taskPayload.Length -gt 512KB){throw 'Native offset input exceeds the diagnostic budget'}
$taskRows=@($taskPayload | ConvertFrom-Json)
if($taskRows.Count -lt 1 -or $taskRows.Count -gt 16384){throw 'Native offset count outside the bounded phase'}
[ulong[]]$taskOffsets=@($taskRows | ForEach-Object {[ulong]$_.offset})

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
public static class NelyxV8Pdb {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
 public struct ModuleInfo {
  public uint SizeOfStruct; public ulong BaseOfImage;
  public uint ImageSize,TimeDateStamp,CheckSum,NumSyms; public int SymType;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)] public string ModuleName;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=256)] public string ImageName;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=256)] public string LoadedImageName;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=256)] public string LoadedPdbName;
  public uint CVSig;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=780)] public string CVData;
  public uint PdbSig; public Guid PdbSig70; public uint PdbAge;
  public int PdbUnmatched,DbgUnmatched,LineNumbers,GlobalSymbols,TypeInfo,SourceIndexed,Publics;
  public uint MachineType,Reserved;
 }
 public class Symbol {public ulong Offset,Displacement;public uint Size,Tag;public string Name;}
 public class Result {public string Pdb,Guid;public uint Age,ImageSize;public int SymType;public bool DirectPdbWithMatchedPeIdentity;public List<Symbol> Symbols=new List<Symbol>();}
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("dbghelp.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SymInitializeW(IntPtr process,string searchPath,bool invade);
 [DllImport("dbghelp.dll")] static extern uint SymSetOptions(uint options);
 [DllImport("dbghelp.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern ulong SymLoadModuleExW(IntPtr process,IntPtr file,string image,string name,ulong address,uint size,IntPtr data,uint flags);
 [DllImport("dbghelp.dll",SetLastError=true)] static extern bool SymGetModuleInfo64(IntPtr process,ulong address,ref ModuleInfo info);
 [DllImport("dbghelp.dll",SetLastError=true)] static extern bool SymUnloadModule64(IntPtr process,ulong address);
 [DllImport("dbghelp.dll",SetLastError=true)] static extern bool SymFromAddr(IntPtr process,ulong address,out ulong displacement,IntPtr symbol);
 [DllImport("dbghelp.dll")] static extern bool SymCleanup(IntPtr process);
 static Exception Error(string api){return new Win32Exception(Marshal.GetLastWin32Error(),api);}
 public static Result Resolve(string image,uint expectedSize,ulong[] offsets){
  IntPtr process=GetCurrentProcess(),buffer=IntPtr.Zero;bool initialized=false;
  // Exact local PDBs only: ignore environment symbol paths and avoid prompts.
  uint previous=SymSetOptions(0x00081602);
  try {
   if(!SymInitializeW(process,Path.GetDirectoryName(image),false))throw Error("SymInitialize");initialized=true;
   ulong address=SymLoadModuleExW(process,IntPtr.Zero,image,null,0,0,IntPtr.Zero,0);
   if(address==0)throw Error("SymLoadModuleEx");
   var info=new ModuleInfo();info.SizeOfStruct=(uint)Marshal.SizeOf<ModuleInfo>();
   if(!SymGetModuleInfo64(process,address,ref info))throw Error("SymGetModuleInfo64");
   var imageGuid=info.PdbSig70;uint imageAge=info.PdbAge,imageSize=info.ImageSize;bool directPdb=false;
   // The NuGet archive names the PDB v8jsi.dll.pdb; the DLL's CodeView path
   // names v8jsi.pdb. Read that exact local PDB directly, preserving the PE's
   // expected GUID/age and image extent instead of creating alias files.
   if(info.SymType!=3&&info.SymType!=7){
    directPdb=true;
    if(!SymUnloadModule64(process,address))throw Error("SymUnloadModule64");
    address=SymLoadModuleExW(process,IntPtr.Zero,image+".pdb",null,address,imageSize,IntPtr.Zero,0);
    if(address==0)throw Error("SymLoadModuleEx local PDB");
    info=new ModuleInfo();info.SizeOfStruct=(uint)Marshal.SizeOf<ModuleInfo>();
    if(!SymGetModuleInfo64(process,address,ref info))throw Error("SymGetModuleInfo64 local PDB");
   }
   if(info.PdbSig70!=imageGuid||info.PdbAge!=imageAge||info.ImageSize!=imageSize)throw new Exception("Local PDB does not match the sampled PE CodeView identity");
   // DbgHelp marks a directly opened PDB unassociated with an image. Its
   // CodeView GUID/age and image extent were explicitly matched above.
   if((info.SymType!=3&&info.SymType!=7)||(!directPdb&&info.PdbUnmatched!=0)||info.DbgUnmatched!=0||info.PdbSig70==System.Guid.Empty||info.PdbAge==0||!String.Equals(Path.GetFullPath(info.LoadedPdbName),Path.GetFullPath(image+".pdb"),StringComparison.OrdinalIgnoreCase))throw new Exception("Exact local V8 PDB was not loaded: type="+info.SymType+" pdb="+info.LoadedPdbName+" guid="+info.PdbSig70+" age="+info.PdbAge+" unmatched="+info.PdbUnmatched+"/"+info.DbgUnmatched);
   if(expectedSize!=0&&info.ImageSize!=expectedSize)throw new Exception("V8 shared-library range differs from the PE image");
   var result=new Result{Pdb=Path.GetFileName(info.LoadedPdbName),Guid=info.PdbSig70.ToString(),Age=info.PdbAge,ImageSize=info.ImageSize,SymType=info.SymType,DirectPdbWithMatchedPeIdentity=directPdb};
   buffer=Marshal.AllocHGlobal(88+4096);
   foreach(ulong offset in offsets){
    if(offset>=info.ImageSize)throw new Exception("Sample RVA outside the pinned image");
    Marshal.WriteInt32(buffer,0,88);Marshal.WriteInt32(buffer,80,4096);
    ulong displacement;var symbol=new Symbol{Offset=offset};
    if(SymFromAddr(process,address+offset,out displacement,buffer)){
     int length=Marshal.ReadInt32(buffer,76);if(length<0||length>=4096)throw new Exception("Bounded native symbol name exceeded");
     symbol.Name=Marshal.PtrToStringAnsi(IntPtr.Add(buffer,84),length);symbol.Displacement=displacement;
     symbol.Size=unchecked((uint)Marshal.ReadInt32(buffer,28));symbol.Tag=unchecked((uint)Marshal.ReadInt32(buffer,72));
    }
    result.Symbols.Add(symbol);
   }
   return result;
  } finally {if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);if(initialized)SymCleanup(process);SymSetOptions(previous);}
 }
}
'@
[NelyxV8Pdb]::Resolve($taskImage,$ExpectedImageSize,$taskOffsets) | ConvertTo-Json -Depth 5 -Compress
