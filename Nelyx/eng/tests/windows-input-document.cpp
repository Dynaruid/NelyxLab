// SPDX-License-Identifier: BSD-3-Clause
#include "TextInputStore.h"
#include <iostream>
#include <functional>

using namespace Nelyx::WindowsInput;
void check(bool condition,char const* message){if(!condition)throw std::runtime_error(message);}
void rejects(std::function<void()> action){bool rejected=false;try{action();}catch(std::invalid_argument const&){rejected=true;}catch(std::logic_error const&){rejected=true;}check(rejected,"Invalid or retired input operation was admitted");}
void textStoreChecks();
void keyboardSourceChecks();
CoreGeometry layout(uint64_t epoch=4,uint64_t viewport=2){return {{"view",1},viewport,epoch,{10,20,180,48},{10,20,160,48},{35,22,1,24},35,42};}

int main(){
  try {
    TextInputDocument document({"view",1},L"A\U0001f1f0\U0001f1f7\uD55c",{6,1},64);
    check(document.read().text.size()==6&&document.read().selection==Selection{6,1},"Directed UTF-16 selection lost");
    check(document.updateGeometry(layout(),document.read().text,{6,1},0),"Matching Core geometry rejected");
    check(document.geometry()&&document.textBounds(1,1)==std::optional<Rect>(layout().caret),"Core caret missing");
    check(!document.textBounds(0,6),"Unrequested character layout was fabricated");
    check(document.updateCharacterBounds(2,4,0,0,6,{{10,22,10,24},{20,22,18,24},{20,22,18,24},{38,22,18,24},{38,22,18,24},{56,22,20,24}}),"Current UTF-16 bounds rejected");
    check(document.textBounds(1,5)==std::optional<Rect>(Rect{20,22,36,24}),"UTF-16 surrogate bounds were remeasured or counted as codepoints");
    check(document.updateCaretBounds(2,4,0,0,{10,22,1,24}),"Independent Core caret reply rejected");
    check(document.updateGeometry(layout(),document.read().text,{6,1},0)&&document.textBounds(1,5)==std::optional<Rect>(Rect{20,22,36,24})&&document.textBounds(0,0)==std::optional<Rect>(Rect{10,22,1,24}),"Republishing the same committed frame erased current Core range/caret replies");
    {
      auto edit=document.beginNativeEdit();check(!document.geometry(),"Locked native draft exposed old geometry");
      check(document.replace(L"Core",{4,4},0)==ReplaceResult::busy,"Core write bypassed the TSF write lock");
      edit.value().text=L"\uD55c\uAE00";edit.value().selection={2,1};edit.value().composing={0,2};
      check(document.read().text.size()==6,"Partial TSF calls leaked to Core");check(edit.commit(),"Native batch did not commit");
    }
    check(document.read().revision==1&&document.read().text==L"\uD55c\uAE00"&&document.read().composing.active(),"Native batch was not atomic");
    check(document.replace(L"Core",{4,4},0)==ReplaceResult::stale,"Stale Core write overwrote native input");
    check(document.replace(L"Core",{4,4},1)==ReplaceResult::composing,"Unobserved cancellation replaced active composition");
    {
      auto edit=document.beginNativeEdit();edit.value().composing={};check(edit.commit(),"Observed composition end did not commit");
    }
    check(document.replace(L"Core",{4,4},2)==ReplaceResult::applied,"Completed composition did not admit Core replacement");
    check(document.read().revision==3&&document.replace(L"Core",{4,4},3)==ReplaceResult::applied&&document.read().revision==4,"Same-value acknowledgement lost its revision");
    rejects([&]{document.replace(std::wstring(1,static_cast<wchar_t>(0xd800)),{1,1},4);});
    check(document.read().revision==4&&document.read().text==L"Core","Malformed Core input changed the document");
    {
      auto edit=document.beginNativeEdit();edit.value().text=L"partial";
    }
    check(!document.editing()&&document.read().text==L"Core","Abandoned TSF draft was published");
    {
      auto edit=document.beginNativeEdit();edit.value().selection={-1,0};rejects([&]{edit.commit();});
    }
    check(!document.editing()&&document.read().revision==4,"Rejected native selection left the write locked");
    document.updateCoreDocument(L"Core",{4,4});
    check(!document.updateGeometry(layout(4),L"Core",{4,4},4),"A prior epoch was relabelled for another document");
    check(document.updateGeometry(layout(5),L"Core",{4,4},4),"New Core frame rejected");
    document.withdrawGeometry();check(!document.geometry(),"Geometry withdrawal failed");
    auto moved=layout(5);moved.caret.x++;
    check(!document.updateGeometry(moved,L"Core",{4,4},4),"An existing epoch changed its coordinates");
    check(document.updateGeometry(layout(5),L"Core",{4,4},4)&&document.geometry(),"Same committed epoch could not restore withdrawn bounds");
    document.updateCoreDocument(L"pending",{7,7});document.updateCoreDocument(L"Core",{4,4});
    check(!document.geometry(),"Core document ABA revived an uncommitted frame");
    check(document.updateGeometry(layout(5),L"Core",{4,4},4),"An actual publication failed to restore the original frame");
    check(!document.updateGeometry(layout(6,1),L"Core",{4,4},4),"An older viewport accepted a newer epoch");
    check(!document.updateCharacterBounds(2,4,0,0,6,std::vector<Rect>(6)),"A late character reply used another native revision");
    auto foreign=layout(6);foreign.owner.id="other";rejects([&]{document.updateGeometry(foreign,L"Core",{4,4},4);});
    std::exception_ptr wrongThread;std::thread thread([&]{try{document.read();}catch(...){wrongThread=std::current_exception();}});thread.join();check(wrongThread!=nullptr,"Foreign thread accessed the native document");
    document.close();document.close();rejects([&]{document.read();});rejects([&]{document.replace(L"late",{4,4},4);});
    textStoreChecks();keyboardSourceChecks();
    std::cout<<"PASS-scoped: native UTF-16 shadow document, directed selection, atomic TSF-style batches, stale/busy/composing rejection, Core-only frame/character bounds, withdrawal/ABA/epoch/viewport and UI retirement. The document checks do not independently qualify RNW/app/physical IME.\n";
    return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<'\n';return 1;}
}
