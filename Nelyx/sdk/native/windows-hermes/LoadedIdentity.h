// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <bcrypt.h>
#include <tlhelp32.h>
#include <filesystem>
#include <fstream>
#include <array>
#include <vector>
namespace Nelyx::NativeHermes {
inline std::filesystem::path loadedPath(HMODULE module){std::vector<wchar_t> value(32768);auto size=GetModuleFileNameW(module,value.data(),DWORD(value.size()));if(!size||size==value.size())throw std::runtime_error("Loaded image path unavailable");return std::filesystem::canonical(std::wstring(value.data(),size));}
inline std::string fileHash(std::filesystem::path const& file){
  struct Hash {BCRYPT_ALG_HANDLE algorithm=nullptr;BCRYPT_HASH_HANDLE value=nullptr;~Hash(){if(value)BCryptDestroyHash(value);if(algorithm)BCryptCloseAlgorithmProvider(algorithm,0);}};
  std::vector<UCHAR> object;Hash hash;
  auto checked=[](NTSTATUS status){if(status<0)throw std::runtime_error("Image SHA256 failed");};
  checked(BCryptOpenAlgorithmProvider(&hash.algorithm,BCRYPT_SHA256_ALGORITHM,nullptr,0));ULONG bytes=0,size=0;checked(BCryptGetProperty(hash.algorithm,BCRYPT_OBJECT_LENGTH,reinterpret_cast<PUCHAR>(&size),sizeof(size),&bytes,0));object.resize(size);checked(BCryptCreateHash(hash.algorithm,&hash.value,object.data(),size,nullptr,0,0));
  std::ifstream stream(file,std::ios::binary);if(!stream)throw std::runtime_error("Loaded image read failed");std::array<char,65536> chunk{};while(stream){stream.read(chunk.data(),chunk.size());if(stream.gcount())checked(BCryptHashData(hash.value,reinterpret_cast<PUCHAR>(chunk.data()),ULONG(stream.gcount()),0));}if(!stream.eof())throw std::runtime_error("Loaded image read incomplete");std::array<UCHAR,32> result{};checked(BCryptFinishHash(hash.value,result.data(),result.size(),0));static constexpr char hex[]="0123456789abcdef";std::string output;for(auto value:result){output.push_back(hex[value>>4]);output.push_back(hex[value&15]);}return output;
}
inline size_t assertIndependentModules(){
  const auto snapshot=CreateToolhelp32Snapshot(TH32CS_SNAPMODULE,GetCurrentProcessId());if(snapshot==INVALID_HANDLE_VALUE)throw std::runtime_error("Loaded module enumeration failed");
  MODULEENTRY32W entry{};entry.dwSize=sizeof(entry);size_t count=0;bool independent=true;
  if(Module32FirstW(snapshot,&entry))do{++count;std::wstring name=entry.szModule;for(auto& c:name)c=towlower(c);if(name.find(L"reactnative")!=std::wstring::npos||name.find(L"react-native")!=std::wstring::npos||name.find(L"nodeapi")!=std::wstring::npos||name.find(L"node-api")!=std::wstring::npos||name==L"hermes.dll"||name.find(L"v8jsi")!=std::wstring::npos||name.find(L"javascriptcore")!=std::wstring::npos)independent=false;}while(Module32NextW(snapshot,&entry));CloseHandle(snapshot);if(!count||!independent)throw std::runtime_error("RN/Node-API or foreign engine in direct host loaded modules");return count;
}
}
