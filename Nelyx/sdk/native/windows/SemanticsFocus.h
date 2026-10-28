// SPDX-License-Identifier: BSD-3-Clause
#pragma once

namespace Nelyx::WindowsSemantics {
enum class NativeFocusAction {None,Peer,Canvas};
// Passive geometry/metadata updates neither reclaim focus from another target
// nor undo a UIA request whose Core acknowledgement has not arrived yet.
// An inactive island must not be activated by publishing logical focus.
// Explicit UIA requests remain separate from this passive synchronization.
inline NativeFocusAction semanticsFocusAction(bool wasFocused,bool focused,bool peerFocused,bool ownerFocused)noexcept{
  if(wasFocused==focused||!ownerFocused)return NativeFocusAction::None;
  if(focused&&!peerFocused)return NativeFocusAction::Peer;
  if(!focused&&peerFocused)return NativeFocusAction::Canvas;
  return NativeFocusAction::None;
}
}
