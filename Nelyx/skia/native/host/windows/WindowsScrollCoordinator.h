// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "CompositorFrameTiming.h"
#include "WindowsMonotonic.h"
#include <functional>
#include <map>
#include <deque>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <array>
#include <sstream>
#include <algorithm>
#include <cmath>
#include <windows.h>
namespace RNSkia {
inline bool windowsScrollInputSelected(){
  static const bool selected=[]{wchar_t value[2]{};return GetEnvironmentVariableW(L"NELYX_WINDOWS_SCROLL_INPUT",value,2)==1&&value[0]==L'1';}();return selected;
}
/** UI pollers and copied input accounting only. No COM/JS/runtime on workers.
 * One host clock services input independently of JS/GPU render demand. */
class WindowsScrollCoordinator final : public std::enable_shared_from_this<WindowsScrollCoordinator> {
public:
  using Post=std::function<void(std::function<void()>)>;
  struct Poller {std::function<void()> update,seal;std::function<bool()> active;};
  uint64_t openMailbox(){std::lock_guard lock(mutex);if(closed||mailboxes.size()>=64||nextMailbox>=9007199254740991ULL)throw std::runtime_error("Input mailbox owner budget exceeded");auto id=++nextMailbox;mailboxes.emplace(id,0);return id;}
  void updateMailbox(uint64_t id,size_t count){std::lock_guard lock(mutex);auto found=mailboxes.find(id);if(found==mailboxes.end()||count>256||jsPending-found->second+count+outstanding+staged>256)throw std::runtime_error("Shared native/JS input packet budget exceeded");jsPending=jsPending-found->second+count;found->second=count;}
  void closeMailbox(uint64_t id){std::lock_guard lock(mutex);auto found=mailboxes.find(id);if(found==mailboxes.end()||found->second)throw std::runtime_error("JS input mailbox closed before drain");mailboxes.erase(found);}
  std::array<uint64_t,2> mailboxStatus(){std::lock_guard lock(mutex);return {jsPending,uint64_t(mailboxes.size())};}
  void stagePacket(uint64_t view){std::lock_guard lock(mutex);if(closed||jsPending+outstanding+staged>=256||received>=9007199254740991ULL)throw std::runtime_error("Native input staging exceeds shared packet budget");stagedByView[view].push_back(++received);++staged;}
  uint64_t seal(size_t count,uint64_t view){std::lock_guard lock(mutex);auto found=stagedByView.find(view);if(found==stagedByView.end()||!count||found->second.size()<count)throw std::runtime_error("Native sealed input count differs");auto id=reserveLocked(count,view,count,found->second.front());staged-=count;for(size_t i=0;i<count;++i)found->second.pop_front();if(found->second.empty())stagedByView.erase(found);return id;}
  void beginAudit(double owner,bool manual){std::lock_guard lock(mutex);if(auditOwner||!std::isfinite(owner)||owner<1||owner>9007199254740991.||std::floor(owner)!=owner)throw std::runtime_error("Invalid scroll audit owner");auditOwner=owner;timed=!manual;began=windowsMonotonicMilliseconds();}
  void noteCredit(bool delivered){std::lock_guard lock(mutex);record(delivered?7:6,1);}
  void noteSubmission(){std::lock_guard lock(mutex);record(4,1);}
  void endAudit(){
    std::lock_guard lock(mutex);if(!auditOwner)throw std::runtime_error("Scroll audit not started");
    std::ostringstream out;out.precision(17);out<<"NELYX_SCROLL_HOST_USAGE {\"schema\":1,\"ownerGeneration\":"<<auditOwner<<",\"beganQpcMs\":"<<began<<",\"endedQpcMs\":"<<windowsMonotonicMilliseconds()<<",\"timing\":\""<<(timed?"qpc-buckets":"counters-only")<<"\",\"overflow\":"<<(overflow?"true":"false")<<",\"binCount\":"<<bins.size()<<",\"pendingPackets\":"<<outstanding<<",\"pendingBatches\":"<<packets.size()<<",\"retiredPackets\":"<<retiredPackets<<",\"pendingStaged\":"<<staged<<",\"pendingJsPackets\":"<<jsPending<<",\"mailboxOwners\":"<<mailboxes.size()<<",\"totals\":[";
    for(size_t i=0;i<auditTotals.size();++i){if(i)out<<',';out<<auditTotals[i];}out<<"]}";log(out.str());
    size_t index=0,count=0;std::ostringstream chunk;auto begin=[&]{chunk.str("");chunk.clear();chunk<<"NELYX_SCROLL_HOST_BINS {\"schema\":1,\"index\":"<<index++<<",\"rows\":[";count=0;};begin();
    for(const auto& [second,values]:bins){if(count)chunk<<',';chunk<<'['<<second;for(auto value:values)chunk<<','<<value;chunk<<']';if(++count==16){chunk<<"]}";log(chunk.str());begin();}}if(count){chunk<<"]}";log(chunk.str());}
    bins.clear();auditOwner=0;
  }
  void configure(Post ui,std::function<void()> request){std::lock_guard lock(mutex);if(requestClock)throw std::logic_error("Scroll coordinator already configured");postUi=std::move(ui);requestClock=std::move(request);}
  void request(){std::function<void()> callback;{std::lock_guard lock(mutex);if(closed)return;if(armed)return;if(!requestClock)throw std::logic_error("Scroll coordinator unavailable");armed=true;callback=requestClock;}callback();}
  void requestInput(){ {std::lock_guard lock(mutex);polling=true;}request(); }
  // UI owner. Entries hold weak view/precision references supplied by adapters.
  void add(uint64_t id,Poller poller){if(!pollers.emplace(id,std::move(poller)).second)throw std::logic_error("Duplicate scroll poller");}
  void remove(uint64_t id){pollers.erase(id);}
  void ready(std::function<void()> dispatch){
    Post post;bool direct=false;{std::lock_guard lock(mutex);if(closed)return;direct=!polling;if(direct){armed=false;++counts[5];record(5,1);}else post=postUi;}
    if(direct){dispatch();return;}
    post([weak=weak_from_this(),dispatch=std::move(dispatch)]{
      auto self=weak.lock();if(!self)return;{std::lock_guard lock(self->mutex);if(self->closed)return;}
      bool again=false;auto batch=self->pollers;
      for(auto const& [id,poller]:batch)if(self->pollers.contains(id)&&poller.active()){poller.update();{std::lock_guard lock(self->mutex);++self->counts[0];self->record(0,1);}}
      for(auto const& [id,poller]:batch)if(self->pollers.contains(id)){poller.seal();again=again||poller.active();}
      {std::lock_guard lock(self->mutex);self->armed=false;self->polling=again;++self->counts[5];self->record(5,1);}
      // Queue JS only after Update and sealing on UI. A stalled JS owner never
      // stops contact/end polling; the shared packet limit fails explicitly.
      dispatch();if(again)self->request();
    });
  }
  uint64_t reserve(size_t count,uint64_t view=0){std::lock_guard lock(mutex);return reserveLocked(count,view);}
  void retireInputOwner(uint64_t view){std::lock_guard lock(mutex);size_t count=0;for(const auto& [id,packet]:packets)if(packet.view==view)++count;if(retired.size()+count>256)throw std::runtime_error("Retired input ACK metadata budget exceeded");for(auto it=packets.begin();it!=packets.end();)if(it->second.view==view){retired.emplace(it->first,it->second.count);outstanding-=it->second.count;retiredPackets+=it->second.count;it=packets.erase(it);}else ++it;}
  void acknowledge(uint64_t id,size_t count){std::lock_guard lock(mutex);auto found=packets.find(id);if(found==packets.end()){
      auto old=retired.find(id);if(old!=retired.end()&&old->second==count){retired.erase(old);return;}
      if(closed&&id&&id<=next&&count&&count<=256)return;
      throw std::runtime_error("Stale/duplicate input batch ACK");}
    if(found->second.count!=count)throw std::runtime_error("Input batch ACK count differs");outstanding-=count;counts[3]+=count;record(3,count);packets.erase(found);}
  bool pending(){std::lock_guard lock(mutex);return outstanding!=0||staged!=0;}
  uint64_t captureInputWatermark(){std::lock_guard lock(mutex);return received;}
  bool pendingThrough(uint64_t watermark){std::lock_guard lock(mutex);if(watermark>received)throw std::runtime_error("Invalid native input watermark");for(const auto& [id,packet]:packets)if(packet.firstSerial<=watermark)return true;for(const auto& [view,queue]:stagedByView)if(!queue.empty()&&queue.front()<=watermark)return true;return false;}
  std::array<uint64_t,8> status(){std::lock_guard lock(mutex);auto result=counts;result[6]=outstanding;result[7]=packets.size();return result;}
  uint64_t retiredCount(){std::lock_guard lock(mutex);return retiredPackets;}
  void close(){std::lock_guard lock(mutex);if(outstanding||staged||jsPending||!mailboxes.empty())throw std::runtime_error("Native input batch accounting did not drain");closed=true;retired.clear();requestClock={};postUi={};}
private:
  uint64_t reserveLocked(size_t count,uint64_t view,size_t charged=0,uint64_t firstSerial=0){if(closed||!count||count>256||outstanding+staged+jsPending+count-charged>256||next>=9007199254740991ULL||(!charged&&received>9007199254740991ULL-count))throw std::runtime_error("Native input exceeds the shared 256-packet budget");if(!charged){firstSerial=received+1;received+=count;}auto id=++next;packets.emplace(id,Packet{count,view,firstSerial});outstanding+=count;counts[1]+=count;++counts[2];counts[4]=std::max(counts[4],outstanding+staged+jsPending-charged);record(1,count);record(2,1);return id;}
  static void log(std::string value){value+='\n';DWORD written{};WriteFile(GetStdHandle(STD_ERROR_HANDLE),value.data(),DWORD(value.size()),&written,nullptr);}
  void record(size_t index,uint64_t count){if(!auditOwner)return;auditTotals[index]+=count;if(!timed)return;auto second=uint64_t(windowsMonotonicMilliseconds()/1000.);if(!bins.contains(second)&&bins.size()>=1200){overflow=true;return;}bins[second][index]+=count;}
  std::mutex mutex;Post postUi;std::function<void()> requestClock;
  std::map<uint64_t,Poller> pollers;
  struct Packet{size_t count;uint64_t view,firstSerial;};
  std::map<uint64_t,Packet> packets;
  std::map<uint64_t,size_t> retired;
  uint64_t retiredPackets=0;
  uint64_t jsPending=0,staged=0,nextMailbox=0;
  std::map<uint64_t,size_t> mailboxes;
  std::map<uint64_t,std::deque<uint64_t>> stagedByView;
  uint64_t received=0;
  uint64_t next=0,outstanding=0;std::array<uint64_t,8> counts{};
  bool closed=false,armed=false,polling=false;
  double auditOwner=0,began=0;bool timed=false,overflow=false;
  std::array<uint64_t,8> auditTotals{};
  std::map<uint64_t,std::array<uint64_t,8>> bins;
};
}
