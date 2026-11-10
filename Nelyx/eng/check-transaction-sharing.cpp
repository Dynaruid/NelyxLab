// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/scene/document.hpp"
#include <stdexcept>
using namespace nelyx::v2;
namespace {
void verify(bool result,const char* message){if(!result)throw std::runtime_error(message);}
Writer command(uint32_t op,Handle h,size_t bytes){Writer result(16+bytes);result.u16(0,uint16_t(op));
  result.u32(4,uint32_t(result.bytes.size()));writeHandle(result,8,h);return result;}
}
void checkTransactionSharing(){
  for(const uint32_t unrelated:{64u,2048u}){
    auto ledger=std::make_shared<Ledger>();
    {
      auto input=std::make_shared<Document>(ledger);
      for(uint32_t i=1;i<=unrelated+5;++i){auto n=std::make_shared<Node>(ledger);n->id={i,1};n->kind=(i==4||i==5)?wire::kinds::paragraph:wire::kinds::stack;
        n->parent=i==1?Handle{}:Handle{i<=3?1u:i<=5?2u:3u,1};n->order=i<=3?i-2:i<=5?i-4:i-6;
        input->nodes.edit(i).value=n;++input->count;input->highWater=i;
      }
      input->children.set(0,{{1,1}});input->children.set(1,{{2,1},{3,1}});input->children.set(2,{{4,1},{5,1}});
      std::vector<Handle> siblings;for(uint32_t i=6;i<=unrelated+5;++i)siblings.push_back({i,1});
      input->children.set(3,std::move(siblings));
      Resources resources{};const auto baseline=transact(input,resources,{nullptr,0},0).document;
      Writer edits(0);
      for(uint32_t color:{1u,2u,3u}){auto paint=command(wire::commands::paint,{4,1},16);paint.u32(16,color);paint.f64(24,2);
        edits.bytes.insert(edits.bytes.end(),paint.bytes.begin(),paint.bytes.end());}
      const auto changed=transact(baseline,resources,{edits.bytes.data(),edits.bytes.size()},3).document;
      verify(changed->work.nodeClones==1&&changed->nodes.pageCopies==1&&changed->nodes.directoryCopies==1,
        "A transaction must clone its edited node/page/directory once");
      verify(changed->work.incrementalValidations==1&&changed->work.validationVisits==0&&changed->children.blockCopies==0,
        "Paint must preserve graph validation and every immutable child block");
      verify(baseline->get({4,1}).color==0&&changed->get({4,1}).color==3,"Paint mutated a prior snapshot");
      verify(&baseline->get({6,1})==&changed->get({6,1})&&&baseline->children[3]==&changed->children[3],
        "An unrelated node/child block was copied");
      auto full=std::make_shared<Document>(*baseline);full->graphValidated=false;
      const auto reference=transact(full,resources,{edits.bytes.data(),edits.bytes.size()},3).document;
      verify(reference->get({4,1}).color==changed->get({4,1}).color&&reference->get({4,1}).radius==changed->get({4,1}).radius,
        "Incremental validation differs from full validation");
      const auto paragraph=paragraphBytes(ParagraphOptions{});
      auto local=command(wire::commands::paragraphOptions,{4,1},paragraph.bytes.size());
      std::copy(paragraph.bytes.begin(),paragraph.bytes.end(),local.bytes.begin()+16);
      const auto textStyle=transact(baseline,resources,{local.bytes.data(),local.bytes.size()},1).document;
      const auto fullStyle=transact(full,resources,{local.bytes.data(),local.bytes.size()},1).document;
      verify(textStyle->work.incrementalValidations==1&&textStyle->work.fullValidations==0&&textStyle->work.validationVisits==1&&
        textStyle->children.blockCopies==0&&textStyle->get({4,1}).paragraph->value==fullStyle->get({4,1}).paragraph->value,
        "Local paragraph validation must match the full oracle without unrelated visits");
      auto registration=command(wire::commands::registerBlob,{1,1},8+paragraph.bytes.size());
      registration.u32(16,wire::commands::paragraphOptions);registration.u32(20,uint32_t(paragraph.bytes.size()));
      std::copy(paragraph.bytes.begin(),paragraph.bytes.end(),registration.bytes.begin()+24);
      Writer registered=registration;
      for(uint32_t slot:{4u,5u}){auto bind=command(wire::commands::useBlob,{slot,1},16);writeHandle(bind,16,{1,1});
        bind.u32(24,wire::commands::paragraphOptions);registered.bytes.insert(registered.bytes.end(),bind.bytes.begin(),bind.bytes.end());}
      const auto shared=transact(baseline,resources,{registered.bytes.data(),registered.bytes.size()},3).document;
      verify(shared->work.blobRegistrations==1&&shared->work.blobBindings==2&&shared->get({4,1}).paragraph==shared->get({5,1}).paragraph,
        "Immutable configuration must normalize once and share its retained value");
      auto release=command(wire::commands::releaseBlob,{1,1},0);
      const auto released=transact(shared,resources,{release.bytes.data(),release.bytes.size()},1).document;
      verify(released->blobCount==0&&released->get({4,1}).paragraph==shared->get({4,1}).paragraph&&shared->blobCount==1,
        "Dictionary retirement invalidated a live reader or prior snapshot");
      bool reusedId=false;try{transact(released,resources,{registration.bytes.data(),registration.bytes.size()},1);}
      catch(const Error& error){reusedId=error.status==wire::statuses::invalidHandle;}
      verify(reusedId,"A retired immutable ID was silently recycled");
      auto move=command(wire::commands::move,{5,1},16);writeHandle(move,16,{2,1});move.u32(24,0);
      const auto moved=transact(baseline,resources,{move.bytes.data(),move.bytes.size()},1).document;
      verify(moved->children[2]==std::vector<Handle>{{5,1},{4,1}}&&moved->children.blockCopies==1,
        "Sibling move copied unrelated child blocks");
      verify(moved->work.siblingVisits<=4&&moved->work.nodeClones==4,"Sibling editing visited unrelated nodes or recloned a node");
      Writer removal(0);
      // Existing wire permits a parent to be destroyed before its children,
      // provided the final graph is valid. Keep the staged sibling list alive.
      for(const uint32_t slot:{2u,4u,5u}){auto destroy=command(wire::commands::destroy,{slot,1},8);
        destroy.u32(16,wire::nodeDestroyFlags::detach);removal.bytes.insert(removal.bytes.end(),destroy.bytes.begin(),destroy.bytes.end());}
      const auto removed=transact(baseline,resources,{removal.bytes.data(),removal.bytes.size()},3).document;
      verify(removed->count==baseline->count-3&&removed->children[2].empty(),"Ordered parent/child destruction changed its wire contract");
      const auto bytesBefore=ledger->bytes.load();
      for(uint32_t failure=0;failure<3;++failure){
        auto invalid=command(wire::commands::paint,{4,failure==0?2u:1u},16);
        invalid.f64(24,failure==1?-1:9000);
        uint32_t statuses[2]{};uint32_t index=0;
        for(const auto& source:{baseline,std::shared_ptr<const Document>(full)}){
          try{transact(source,resources,{invalid.bytes.data(),invalid.bytes.size()},1);}
          catch(const Error& error){statuses[index]=error.status;}++index;
        }
        verify(statuses[0]&&statuses[0]==statuses[1],"Malformed incremental/full rejection differs");
      }
      auto cycle=command(wire::commands::move,{2,1},16);writeHandle(cycle,16,{4,1});
      bool rejected=false;try{transact(baseline,resources,{cycle.bytes.data(),cycle.bytes.size()},1);}
      catch(const Error& error){rejected=error.status==wire::statuses::invalidGraph;}
      verify(rejected&&baseline->get({2,1}).parent==Handle{1,1},"Cycle rejection changed accepted topology");
      verify(ledger->bytes==bytesBefore,"Rejected transaction retained private pages or nodes");
    }
    verify(ledger->bytes==0&&ledger->nodes==0,"Persistent document storage did not drain");
  }
}
