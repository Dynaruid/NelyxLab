// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Modified from RNW AccessibilityInfo::announceForAccessibility. See upstream/ and provenance.json.
#include "AccessibilityInfoModule.h"

namespace nelyx::v2::windows::rnw {
HRESULT announceForAccessibility(IRawElementProviderSimple* provider,const std::wstring& announcement) {
  // The caller runs inside the owned App SDK UI service queue after its close gate.
  if(!provider)return UIA_E_ELEMENTNOTAVAILABLE;
  auto bstrAnnouncement=SysAllocString(announcement.c_str());
  if(!bstrAnnouncement)return E_OUTOFMEMORY;
  const HRESULT result=UiaRaiseNotificationEvent(provider,NotificationKind_Other,
    NotificationProcessing_ImportantMostRecent,bstrAnnouncement,bstrAnnouncement);
  SysFreeString(bstrAnnouncement);
  return result;
}
}
