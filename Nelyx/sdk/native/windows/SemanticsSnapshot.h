// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "SemanticsState.h"
#include "TextInputProtocol.h"

namespace Nelyx::WindowsSemantics {
namespace RN=winrt::Microsoft::ReactNative;
/** Only copied Core data enters a peer. Password bodies, unit tables and native
 * paragraph references must already be absent at this boundary. */
inline CoreSemanticsSnapshot readCoreSemanticsSnapshot(RN::JSValue const& value){
  using namespace Nelyx::WindowsInput::InputWire;
  require(counter(field(value,"protocol"))==1);CoreSemanticsSnapshot result;
  result.commit=counter(field(value,"commit"),true);result.source=counter(field(value,"source"),true);result.surface=counter(field(value,"surface"));
  result.id=string(field(value,"id"));result.role=string(field(value,"role"));result.owner=owner(field(value,"owner"));
  require(!result.id.empty()&&result.id.size()<=1024&&(result.role=="text-field"||result.role=="text"||result.role=="button"||result.role=="image"||result.role=="group"||result.role=="list"));
  result.bounds=rect(field(value,"bounds"));result.enabled=boolean(field(value,"enabled"));result.focusable=boolean(field(value,"focusable"));result.focused=boolean(field(value,"focused"));
  result.canActivate=boolean(field(value,"canActivate"));
  const auto viewport=counter(field(value,"viewport"),true),surfaceGeneration=counter(field(value,"surfaceGeneration"));
  result.frame={result.owner,viewport,result.commit,result.bounds,result.bounds,result.bounds,result.bounds.x,result.bounds.y,surfaceGeneration};
  const auto& input=field(value,"text");if(input.IsNull()){require(result.role!="text-field");return result;}require(result.role=="text-field");
  TextSnapshot textValue;textValue.revision=counter(field(input,"revision"),true);textValue.textRevision=counter(field(input,"textRevision"),true);textValue.generation=counter(field(input,"generation"));
  textValue.text=text(field(input,"value"));textValue.anchor=offset(field(input,"anchor"));textValue.focus=offset(field(input,"focus"));
  textValue.enabled=result.enabled;textValue.focused=result.focused;textValue.readOnly=boolean(field(input,"readOnly"));textValue.obscured=boolean(field(input,"obscured"));textValue.selectionEnabled=boolean(field(input,"selectionEnabled"));
  const auto& navigation=field(input,"navigation");const auto& paragraph=field(input,"paragraph");const auto& coordinates=field(input,"geometry");
  if(textValue.obscured)require(textValue.text.empty()&&textValue.anchor==0&&textValue.focus==0&&navigation.IsNull()&&paragraph.IsNull());
  else if(!navigation.IsNull()){
    const auto readStops=[&](char const* name){const auto& array=field(navigation,name);require(array.TryGetArray()&&array.AsArray().size()<=TextDocument::maximumTextUnits+1);std::vector<int> stops;for(const auto& item:array.AsArray())stops.push_back(offset(item));return stops;};
    textValue.characters=readStops("characters");textValue.words=readStops("words");textValue.lines=readStops("lines");
  }
  // An unrecorded/dirty paragraph can keep a text document. Navigation must
  // still be supplied by Core; never invent native character partitions.
  if(!coordinates.IsNull()){result.frame=geometry(coordinates,result.owner);require(result.frame.surface==surfaceGeneration&&result.frame.viewport==viewport);result.hasGeometry=true;}
  if(!paragraph.IsNull()){
    require(!textValue.obscured&&result.hasGeometry);CoreParagraphFrame source;source.geometry=result.frame;
    const auto& resource=field(paragraph,"resource");const auto& reference=field(paragraph,"reference");const auto& origin=field(paragraph,"paintOffset");
    require(string(field(reference,"protocol"))=="native-paragraph-v1");source.ticket=counter(field(reference,"token"));source.paintX=number(field(origin,"x"));source.paintY=number(field(origin,"y"));
    source.identity={result.owner.id,string(field(resource,"id")),string(field(input,"value")),result.owner.generation,counter(field(resource,"generation"),true),static_cast<uint32_t>(textValue.text.size())};
    size_t index=0;for(const auto& item:field(coordinates,"transform").AsArray())source.transform[index++]=number(item);result.paragraph=std::move(source);
  }
  // Reuse the provider's complete UTF-16/selection/navigation/privacy validator
  // before the caller changes any live peer state.
  if(textValue.obscured||!textValue.characters.empty())TextDocument::validate(textValue);
  else{TextDocument::validateText(textValue.text);TextDocument::validateSpan(textValue,std::min(textValue.anchor,textValue.focus),std::max(textValue.anchor,textValue.focus));}
  result.text=std::move(textValue);return result;
}
}
