// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <objidl.h>
#include <shlobj_core.h>
#include <wrl.h>
#include <cstring>
#include <string>

namespace Nelyx::WindowsInput {
// TSF's formatted-text query can retrieve the plain document without using a
// RichEdit, clipboard contents or a native renderer.
class TextInputDataObject final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IDataObject> {
public:
  explicit TextInputDataObject(std::wstring text):text_(std::move(text)){}
  HRESULT STDMETHODCALLTYPE GetData(FORMATETC* format,STGMEDIUM* medium)override{
    if(!medium)return E_INVALIDARG;*medium={};const auto valid=QueryGetData(format);if(FAILED(valid))return valid;
    const auto memory=GlobalAlloc(GMEM_MOVEABLE,(text_.size()+1)*sizeof(wchar_t));if(!memory)return E_OUTOFMEMORY;
    auto target=GlobalLock(memory);if(!target){GlobalFree(memory);return E_OUTOFMEMORY;}std::memcpy(target,text_.c_str(),(text_.size()+1)*sizeof(wchar_t));GlobalUnlock(memory);medium->tymed=TYMED_HGLOBAL;medium->hGlobal=memory;return S_OK;
  }
  HRESULT STDMETHODCALLTYPE GetDataHere(FORMATETC* format,STGMEDIUM* medium)override{
    const auto valid=QueryGetData(format);if(FAILED(valid))return valid;if(!medium||medium->tymed!=TYMED_HGLOBAL||!medium->hGlobal)return DV_E_TYMED;
    if(GlobalSize(medium->hGlobal)<(text_.size()+1)*sizeof(wchar_t))return STG_E_MEDIUMFULL;
    auto target=GlobalLock(medium->hGlobal);if(!target)return E_OUTOFMEMORY;std::memcpy(target,text_.c_str(),(text_.size()+1)*sizeof(wchar_t));GlobalUnlock(medium->hGlobal);return S_OK;
  }
  HRESULT STDMETHODCALLTYPE QueryGetData(FORMATETC* format)override{
    if(!format)return E_INVALIDARG;if(format->cfFormat!=CF_UNICODETEXT)return DV_E_FORMATETC;if(format->dwAspect!=DVASPECT_CONTENT)return DV_E_DVASPECT;if(!(format->tymed&TYMED_HGLOBAL))return DV_E_TYMED;if(format->lindex!=-1)return DV_E_LINDEX;return S_OK;
  }
  HRESULT STDMETHODCALLTYPE GetCanonicalFormatEtc(FORMATETC* input,FORMATETC* output)override{if(!input||!output)return E_INVALIDARG;*output=*input;output->ptd=nullptr;return DATA_S_SAMEFORMATETC;}
  HRESULT STDMETHODCALLTYPE SetData(FORMATETC*,STGMEDIUM*,BOOL)override{return E_ACCESSDENIED;}
  HRESULT STDMETHODCALLTYPE EnumFormatEtc(DWORD direction,IEnumFORMATETC** output)override{if(!output)return E_INVALIDARG;*output=nullptr;if(direction!=DATADIR_GET)return E_ACCESSDENIED;FORMATETC format{CF_UNICODETEXT,nullptr,DVASPECT_CONTENT,-1,TYMED_HGLOBAL};return SHCreateStdEnumFmtEtc(1,&format,output);}
  HRESULT STDMETHODCALLTYPE DAdvise(FORMATETC*,DWORD,IAdviseSink*,DWORD*)override{return OLE_E_ADVISENOTSUPPORTED;}
  HRESULT STDMETHODCALLTYPE DUnadvise(DWORD)override{return OLE_E_ADVISENOTSUPPORTED;}
  HRESULT STDMETHODCALLTYPE EnumDAdvise(IEnumSTATDATA** output)override{if(output)*output=nullptr;return OLE_E_ADVISENOTSUPPORTED;}
private:
  std::wstring text_;
};
}
