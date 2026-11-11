// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <algorithm>
#include <bitset>
#include <iterator>
#include <vector>

namespace nelyx::v2 {
/** Fixed-capacity persistent table. Copying a snapshot shares directories and
 * pages; an explicit write copies only its directory and 64-slot page. Reads,
 * including iteration on a mutable working document, never trigger COW. */
template<class T,size_t Count,size_t PageSize=64,size_t Fanout=16> class PagedStorage {
  static constexpr size_t pageCount=(Count+PageSize-1)/PageSize;
  struct Page {
    Lease lease;
    uint64_t revision=0;
    std::array<T,PageSize> values{};
    explicit Page(const std::shared_ptr<Ledger>& ledger):lease(ledger,sizeof(Page)){}
    Page(const Page& p):lease(p.lease.ledger,sizeof(Page)),revision(p.revision),values(p.values){}
  };
  struct Directory {
    Lease lease;
    std::array<std::shared_ptr<Page>,Fanout> pages{};
    explicit Directory(const std::shared_ptr<Ledger>& ledger):lease(ledger,sizeof(Directory)){}
    Directory(const Directory& d):lease(d.lease.ledger,sizeof(Directory)),pages(d.pages){}
  };
  std::shared_ptr<Ledger> ledger;
  std::array<std::shared_ptr<Directory>,(pageCount+Fanout-1)/Fanout> directories{};
public:
  uint64_t pageCopies=0,directoryCopies=0;
  explicit PagedStorage(std::shared_ptr<Ledger> owner):ledger(std::move(owner)){}
  PagedStorage(const PagedStorage& table):ledger(table.ledger),directories(table.directories){}
  PagedStorage& operator=(const PagedStorage& table){
    if(this!=&table){ledger=table.ledger;directories=table.directories;pageCopies=directoryCopies=0;}
    return *this;
  }
  size_t size()const{return Count;}
  struct WeakSnapshot {
    std::array<std::weak_ptr<const Page>,pageCount> pages;
    std::array<uint64_t,pageCount> revisions{};
    std::bitset<pageCount> present;
  };
  // make_shared's allocation may survive its object's destructor while weak
  // readers exist. Owners of a proof reserve this conservative storage credit.
  static constexpr size_t weakSnapshotBytes=pageCount*(sizeof(Page)+64);
  WeakSnapshot weakSnapshot()const {
    WeakSnapshot result;
    for(size_t d=0;d<directories.size();++d)if(directories[d])
      for(size_t p=0;p<Fanout&&d*Fanout+p<pageCount;++p)if(const auto& page=directories[d]->pages[p]){
        result.pages[d*Fanout+p]=page;result.revisions[d*Fanout+p]=page->revision;
        result.present.set(d*Fanout+p);}
    return result;
  }
  // Weak page identities do not keep a Document or its Node holders alive.
  // Expired or revised-in-place pages conservatively visit their bounded slot
  // block. Like COW itself, this requires writes to pass through edit().
  template<class Visit> size_t visitDifferences(const WeakSnapshot& previous,Visit visit)const {
    size_t visits=0;
    for(size_t d=0;d<directories.size();++d){
      for(size_t p=0;p<Fanout;++p){const auto first=(d*Fanout+p)*PageSize;if(first>=Count)break;
        const auto page=directories[d]?directories[d]->pages[p]:nullptr;
        const auto index=d*Fanout+p;
        if(!page&&!previous.present[index])continue;
        if(page&&previous.present[index]&&page->revision==previous.revisions[index]&&!page.owner_before(previous.pages[index])&&
            !previous.pages[index].owner_before(page))continue;
        const auto before=previous.pages[index].lock();
        for(size_t i=first;i<std::min(first+PageSize,Count);++i){++visits;
          visit(i,(*this)[i],before&&before->revision==previous.revisions[index]?&before->values[i-first]:nullptr);}
      }
    }
    return visits;
  }
  const T& operator[](size_t index)const {
    const auto& directory=directories.at(index/PageSize/Fanout);
    if(directory){const auto& page=directory->pages[index/PageSize%Fanout];
      if(page)return page->values[index%PageSize];}
    static const T empty{};return empty;
  }
  T& edit(size_t index){
    require(index<Count,wire::statuses::invalidHandle);
    auto& directory=directories[index/PageSize/Fanout];
    if(!directory)directory=std::make_shared<Directory>(ledger);
    else if(directory.use_count()!=1){directory=std::make_shared<Directory>(*directory);++directoryCopies;}
    auto& page=directory->pages[index/PageSize%Fanout];
    if(!page)page=std::make_shared<Page>(ledger);
    else if(page.use_count()!=1){page=std::make_shared<Page>(*page);++pageCopies;}
    page->revision=next(page->revision);
    return page->values[index%PageSize];
  }
  struct Iterator {
    using iterator_category=std::forward_iterator_tag;
    using value_type=T;using difference_type=ptrdiff_t;using pointer=const T*;using reference=const T&;
    const PagedStorage* owner;size_t index;
    reference operator*()const{return (*owner)[index];}
    pointer operator->()const{return &**this;}
    Iterator& operator++(){++index;return *this;}
    Iterator operator++(int){auto old=*this;++*this;return old;}
    bool operator==(const Iterator&)const=default;
  };
  Iterator begin()const{return {this,0};}Iterator end()const{return {this,Count};}
};

/** Each parent's child block has its own immutable holder. A slot-page copy
 * shares every other parent's vector instead of copying its contents. */
class ChildStorage {
  struct Block {
    Lease lease;std::vector<Handle> values;
    Block(const std::shared_ptr<Ledger>& ledger,std::vector<Handle> data)
      :lease(ledger,sizeof(Block)+data.capacity()*sizeof(Handle)),values(std::move(data)){}
  };
  std::shared_ptr<Ledger> ledger;
  PagedStorage<std::shared_ptr<const Block>,wire::limits::nodes+1> blocks;
public:
  uint64_t blockCopies=0;
  explicit ChildStorage(std::shared_ptr<Ledger> owner):ledger(owner),blocks(std::move(owner)){}
  ChildStorage(const ChildStorage& source):ledger(source.ledger),blocks(source.blocks){}
  size_t size()const{return blocks.size();}
  const std::vector<Handle>& operator[](size_t index)const {
    const auto& block=blocks[index];if(block)return block->values;
    static const std::vector<Handle> empty;return empty;
  }
  void set(size_t index,std::vector<Handle> children){
    if((*this)[index]==children)return;
    auto block=children.empty()?nullptr:std::make_shared<const Block>(ledger,std::move(children));
    blocks.edit(index)=std::move(block);++blockCopies;
  }
  void append(size_t index,Handle child){auto copy=(*this)[index];copy.push_back(child);set(index,std::move(copy));}
};
}
