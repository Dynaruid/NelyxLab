// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <deque>
#include <algorithm>
#include <mutex>
#include <stdexcept>
#include <vector>
namespace nelyx::host {
// Samples retain their original sequence, amount and timestamps. One posted
// wakeup covers a bounded batch; saturation is an explicit delivery failure.
template<class Sample,size_t Capacity=2048> class InputBatch final {
public:
  bool push(Sample sample){std::lock_guard lock(mutex);if(sealed)throw std::runtime_error("Native input admission closed");if(samples.size()>=Capacity)throw std::runtime_error("Native input mailbox full; sample is invalid");samples.push_back(std::move(sample));if(armed)return false;armed=true;return true;}
  std::vector<Sample> take(size_t maximum=64){return takeBatch([](auto const&,auto const&){return true;},maximum);}
  template<class SameBatch> std::vector<Sample> takeBatch(SameBatch same,size_t maximum=64){return takeBatchIf([](auto const&){return true;},same,maximum);}
  template<class Eligible,class SameBatch> std::vector<Sample> takeBatchIf(Eligible eligible,SameBatch same,size_t maximum=64){std::lock_guard lock(mutex);std::vector<Sample> batch;if(samples.empty()||!eligible(samples.front()))return batch;batch.reserve(std::min(maximum,samples.size()));while(!samples.empty()&&batch.size()<maximum&&(batch.empty()||same(batch.front(),samples.front()))){batch.push_back(std::move(samples.front()));samples.pop_front();}return batch;}
  bool finish(){std::lock_guard lock(mutex);if(!samples.empty())return true;armed=false;return false;}
  void seal(){std::lock_guard lock(mutex);sealed=true;}
  size_t pending(){std::lock_guard lock(mutex);return samples.size();}
private:std::mutex mutex;std::deque<Sample> samples;bool armed=false,sealed=false;
};
}
