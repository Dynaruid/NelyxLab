// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <Windows.h>
#include <shellapi.h>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>
#pragma comment(lib,"shell32.lib")

namespace Nelyx {
// Unpackaged Windows activations start an independent process. The application
// installer owns its scheme registration and passes: --nelyx-uri "%1".
// No global registry edits, private RNW symbols or cross-process routing here.
inline std::optional<std::wstring> ParseLaunchUriArguments(std::vector<std::wstring> const& args) {
  bool requested=false;
  for(size_t i=1;i<args.size();i++)if(args[i].rfind(L"--nelyx-uri",0)==0)requested=true;
  if(!requested)return std::nullopt;
  if(args.size()!=3||args[1]!=L"--nelyx-uri")throw std::invalid_argument("Expected exactly --nelyx-uri and one absolute URI");
  auto const& uri=args[2];
  if(uri.empty()||uri.size()>16384)throw std::invalid_argument("Launch URI length limit");
  auto colon=uri.find(L':');
  if(colon==std::wstring::npos||colon==0||colon+1==uri.size())throw std::invalid_argument("Absolute launch URI required");
  auto alpha=[](wchar_t c){return (c>=L'a'&&c<=L'z')||(c>=L'A'&&c<=L'Z');};
  if(!alpha(uri[0]))throw std::invalid_argument("Invalid launch URI scheme");
  for(size_t i=0;i<uri.size();i++){
    auto c=uri[i];
    if(c<=0x20||c==0x7f||c==L'"'||c==L'\\')throw std::invalid_argument("Unsafe launch URI character");
    if(i<colon&&!alpha(c)&&!(i>0&&((c>=L'0'&&c<=L'9')||c==L'+'||c==L'-'||c==L'.')))throw std::invalid_argument("Invalid launch URI scheme");
    if(c>=0xd800&&c<=0xdbff){if(i+1>=uri.size()||uri[i+1]<0xdc00||uri[i+1]>0xdfff)throw std::invalid_argument("Invalid launch URI UTF-16");i++;}
    else if(c>=0xdc00&&c<=0xdfff)throw std::invalid_argument("Invalid launch URI UTF-16");
  }
  return uri;
}
inline std::optional<std::wstring> ReadLaunchUri() {
  int count=0;auto values=CommandLineToArgvW(GetCommandLineW(),&count);
  if(!values)throw std::runtime_error("Windows command-line parsing failed");
  std::vector<std::wstring> args;
  try{args.assign(values,values+count);}catch(...){LocalFree(values);throw;}
  LocalFree(values);return ParseLaunchUriArguments(args);
}
}
