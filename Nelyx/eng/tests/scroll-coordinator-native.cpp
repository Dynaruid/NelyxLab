// SPDX-License-Identifier: BSD-3-Clause
#include "windows/WindowsScrollCoordinator.h"
#include "nelyx_skia/section_lifetime.h"
#include "nelyx_skia/pointer_targets.h"
#include <iostream>
#include <cassert>
#include <vector>
int main(int argc,char**) {
  if(argc>2){try{
    uint32_t sizes[2]{};std::cin.read(reinterpret_cast<char*>(sizes),8);if(sizes[0]>1031||sizes[1]!=12)return 2;
    std::vector<double> patch(sizes[0]),query(sizes[1]);std::cin.read(reinterpret_cast<char*>(patch.data()),patch.size()*8);std::cin.read(reinterpret_cast<char*>(query.data()),query.size()*8);if(!std::cin)return 2;
    nelyx::pointer_targets::Session session(patch[2]);session.patch(patch);auto result=session.query(query);
    // A malformed later patch must leave the previously published revision.
    auto bad=patch;bad[4]++;bad[8]=999;bool rejected=false;try{session.patch(bad);}catch(...){rejected=true;}if(!rejected||session.query(query)!=result)return 3;
    session.close();if(session.trees()!=0)return 3;
    std::cout.write(reinterpret_cast<const char*>(result.data()),result.size()*8);return 0;
  }catch(const std::exception& e){std::cerr<<e.what();return 2;}}
  if(argc>1){try{
    uint32_t size=0;std::cin.read(reinterpret_cast<char*>(&size),4);if(size>152)return 2;
    std::vector<double> packet(size);std::cin.read(reinterpret_cast<char*>(packet.data()),size*8);if(!std::cin)return 2;
    auto result=nelyx::section_lifetime::run(packet);std::cout.write(reinterpret_cast<const char*>(result.data()),result.size()*8);return 0;
  }catch(const std::exception& e){std::cerr<<e.what();return 2;}}
  auto owner=std::make_shared<RNSkia::WindowsScrollCoordinator>();
  owner->beginAudit(7,true);
  std::vector<std::function<void()>> ui;int requests=0,updates=0,seals=0,dispatches=0;bool active=true;
  owner->configure([&](auto callback){ui.push_back(std::move(callback));},[&]{++requests;});
  owner->add(1,{[&]{++updates;},[&]{++seals;},[&]{return active;}});
  owner->requestInput();owner->request();assert(requests==1);
  owner->ready([&]{assert(updates==1&&seals==1);++dispatches;});assert(ui.size()==1&&updates==0);
  auto callback=std::move(ui.back());ui.clear();callback();assert(requests==2&&dispatches==1);
  auto id=owner->reserve(256);assert(owner->pending());bool overflow=false;
  try{owner->reserve(1);}catch(...){overflow=true;}assert(overflow);
  bool early=false;try{owner->close();}catch(...){early=true;}assert(early);
  owner->acknowledge(id,256);bool duplicate=false;try{owner->acknowledge(id,256);}catch(...){duplicate=true;}assert(duplicate);
  active=false;owner->ready([&]{++dispatches;});callback=std::move(ui.back());ui.clear();callback();assert(requests==2&&updates==1);
  auto late=owner->reserve(2,8);owner->retireInputOwner(8);assert(!owner->pending()&&owner->retiredCount()==2);owner->acknowledge(late,2);
  owner->remove(1);owner->close();owner->request();assert(requests==2);owner->acknowledge(late,2);
  auto status=owner->status();assert(status[1]==258&&status[3]==256&&status[4]==256&&status[6]==0&&status[7]==0);
  owner->endAudit();
  auto shared=std::make_shared<RNSkia::WindowsScrollCoordinator>();
  auto mailbox=shared->openMailbox();shared->updateMailbox(mailbox,254);
  shared->stagePacket(9);shared->stagePacket(9);
  bool full=false;try{shared->stagePacket(9);}catch(...){full=true;}assert(full);
  auto sealed=shared->seal(2,9);assert(shared->status()[6]==2);
  full=false;try{shared->updateMailbox(mailbox,255);}catch(...){full=true;}assert(full);
  assert(shared->mailboxStatus()[0]==254);
  shared->updateMailbox(mailbox,0);shared->acknowledge(sealed,2);shared->closeMailbox(mailbox);
  std::vector<std::function<void()>> idleUi;int idleRequests=0,idleDispatches=0;
  shared->configure([&](auto callback){idleUi.push_back(std::move(callback));},[&]{++idleRequests;});
  shared->request();shared->ready([&]{++idleDispatches;});
  assert(idleRequests==1&&idleDispatches==1&&idleUi.empty());shared->close();
  auto continuous=std::make_shared<RNSkia::WindowsScrollCoordinator>();
  assert(continuous->captureInputWatermark()==0&&!continuous->pendingThrough(0));
  continuous->stagePacket(1);auto first=continuous->captureInputWatermark();
  continuous->stagePacket(2);continuous->stagePacket(1);
  assert(continuous->pendingThrough(first));
  auto batch1=continuous->seal(2,1); // A batch straddles the captured watermark.
  assert(continuous->captureInputWatermark()==3&&continuous->pendingThrough(first));
  continuous->acknowledge(batch1,2);
  assert(continuous->pending()&&!continuous->pendingThrough(first));
  auto second=continuous->captureInputWatermark();
  auto batch2=continuous->seal(1,2);
  continuous->stagePacket(1);
  assert(continuous->pendingThrough(second));
  continuous->retireInputOwner(2);continuous->acknowledge(batch2,1);
  assert(continuous->pending()&&!continuous->pendingThrough(second));
  auto batch3=continuous->seal(1,1);continuous->acknowledge(batch3,1);
  bool future=false;try{continuous->pendingThrough(5);}catch(...){future=true;}assert(future);
  continuous->stagePacket(1);continuous->stagePacket(1);
  auto partial=continuous->seal(1,1);auto last=continuous->captureInputWatermark();
  continuous->acknowledge(partial,1);assert(continuous->pendingThrough(last));
  auto tail=continuous->seal(1,1);continuous->acknowledge(tail,1);
  auto direct=continuous->reserve(2,1);assert(continuous->captureInputWatermark()==8&&continuous->pendingThrough(7));
  continuous->acknowledge(direct,2);assert(!continuous->pendingThrough(8));continuous->close();
  std::cout<<"PASS coordinator UI-before-JS coalescing=1 independent-input=1 bounded=256 delta-packets=preserved drain=0 physicalInput=unobserved\n";
}
