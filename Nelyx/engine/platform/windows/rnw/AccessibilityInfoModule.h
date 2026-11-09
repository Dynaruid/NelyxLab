// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Modified for Nelyx: App SDK queue and Core's current UIA provider replace the React island.
#pragma once
#include <UIAutomation.h>
#include <string>

namespace nelyx::v2::windows::rnw {
HRESULT announceForAccessibility(IRawElementProviderSimple* provider,const std::wstring& announcement);
}
