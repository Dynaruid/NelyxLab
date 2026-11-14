// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/engine.hpp"
#include <ostream>

namespace nelyx::v2::diagnostics {
/** Numeric, bounded observations of immutable cohorts. A dispatch interval is
 * an observation bracket, never an exact demand-creation or CPU timestamp. */
class PreparationJournal {
 public:
  struct Interval {double from=0,to=0;uint64_t sequence=0;};
  struct Request {PreparationProgress::Request value;Interval observed;};
  enum class Terminal {pending,published,continued,superseded,closed};
  struct Sample {
    uint64_t sequence=0,lastSequence=0,publication=0,input=0;
    uint32_t session=0,app=0,view=0,generation=0;
    PreparationCohort cohort;
    Interval observed,layoutReady,providerReady,activated,published,ended;
    bool originObserved=false,truncated=false;
    Terminal terminal=Terminal::pending;
    uint32_t requestCount=0,requestOverflow=0,viewportCount=0,publishedViewportCount=0;
    std::array<Request,4> requests{};
    std::array<PreparationViewportProgress,16> viewports{},publishedViewports{};
  };
  std::array<Sample,128> samples{};
  uint64_t through=0,snapshotThrough=0,outOfOrder=0,overwrittenPending=0;
  std::array<uint64_t,5> terminals{};

  void observe(const PreparationProgress& p,double from,double to){
    if(p.sequence<=snapshotThrough){++outOfOrder;return;}
    snapshotThrough=p.sequence;
    const Interval at{from,to,p.sequence};
    if(p.current.preparation){auto& sample=get(p,p.current,at);sample.originObserved|=p.preparing;
      sample.input=p.input;sample.truncated|=p.truncated;sample.lastSequence=p.sequence;
      if(p.preparing){
        sample.viewportCount=p.viewportCount;sample.viewports=p.viewports;
        if(p.ready&&!sample.layoutReady.sequence)sample.layoutReady=at;
        if(p.providerReady&&!sample.providerReady.sequence)sample.providerReady=at;
        if(p.hasRequest){bool found=false;
          for(uint32_t i=0;i<sample.requestCount;++i)if(sample.requests[i].value.id==p.request.id&&
              sample.requests[i].value.node==p.request.node&&sample.requests[i].value.revision==p.request.revision)found=true;
          if(!found){if(sample.requestCount<sample.requests.size())sample.requests[sample.requestCount++]={p.request,at};
            else ++sample.requestOverflow;}
        }
      }
    }
    if(p.active.preparation){auto& sample=get(p,p.active,at);
      if(!sample.activated.sequence)sample.activated=at;sample.lastSequence=p.sequence;}
    if(p.published.preparation){auto& sample=get(p,p.published,at);
      if(!sample.published.sequence){sample.published=at;sample.publication=p.publication;
        sample.publishedViewportCount=p.publishedViewportCount;sample.publishedViewports=p.publishedViewports;
        sample.truncated|=p.truncated;finish(sample,Terminal::published,at);}
      sample.lastSequence=p.sequence;
    }
    for(auto& sample:samples)if(sample.sequence&&sameOwner(sample,p)&&sample.terminal==Terminal::pending&&
        (p.closed||(sample.cohort!=p.current&&sample.cohort!=p.active&&sample.cohort!=p.published))){
      finish(sample,p.closed?Terminal::closed:(sample.cohort.preparation==p.current.preparation?
        Terminal::continued:Terminal::superseded),at);
    }
  }
  void write(std::ostream& out)const{
    out<<"{\"domain\":\"qpc-milliseconds\",\"boundary\":\"dispatch-observation-interval\",\"through\":"<<through
      <<",\"overwritten\":"<<(through>samples.size()?through-samples.size():0)
      <<",\"overwrittenPending\":"<<overwrittenPending<<",\"outOfOrder\":"<<outOfOrder<<",\"terminals\":{";
    for(size_t i=1;i<terminals.size();++i){if(i!=1)out<<',';out<<'"'<<name(Terminal(i))<<"\":"<<terminals[i];}
    uint32_t pending=0;for(const auto& sample:samples)if(sample.sequence&&sample.terminal==Terminal::pending)++pending;
    out<<"},\"pending\":"<<pending<<",\"samples\":[";
    const auto first=through>samples.size()?through-samples.size()+1:1;
    for(auto i=first;i<=through;++i){const auto& s=samples[(i-1)%samples.size()];if(i!=first)out<<',';
      out<<"{\"sequence\":"<<s.sequence<<",\"owner\":\""<<s.session<<'/'<<s.app<<'/'<<s.view<<'/'<<s.generation
        <<"\",\"preparation\":\""<<s.cohort.preparation<<"\",\"document\":\""<<s.cohort.document
        <<"\",\"metrics\":\""<<s.cohort.metrics<<"\",\"device\":\""<<s.cohort.device<<"\",\"font\":\""<<s.cohort.font
        <<"\",\"input\":\""<<s.input<<"\",\"publication\":\""<<s.publication<<"\",\"terminal\":\""<<name(s.terminal)
        <<"\",\"originObserved\":"<<(s.originObserved?"true":"false")<<",\"truncated\":"<<(s.truncated?"true":"false");
      out<<",\"observed\":";interval(out,s.observed);out<<",\"layoutReady\":";interval(out,s.layoutReady);
      out<<",\"providerReady\":";interval(out,s.providerReady);out<<",\"activated\":";interval(out,s.activated);
      out<<",\"published\":";interval(out,s.published);out<<",\"ended\":";interval(out,s.ended);
      out<<",\"requestOverflow\":"<<s.requestOverflow<<",\"requests\":[";
      for(uint32_t j=0;j<s.requestCount;++j){if(j)out<<',';const auto& request=s.requests[j];const auto& r=request.value;
        out<<"{\"id\":\""<<r.id<<"\",\"revision\":\""<<r.revision<<"\",\"node\":";handle(out,r.node);
        out<<",\"viewport\":";handle(out,r.viewport);
        out<<",\"list\":"<<(r.list?"true":"false")<<",\"listGeneration\":\""<<r.listGeneration<<"\",\"begin\":"<<r.begin
          <<",\"end\":"<<r.end<<",\"offset\":"<<r.offset<<",\"paint\":"<<r.paint<<",\"observed\":";interval(out,request.observed);out<<'}';
      }
      out<<"],\"viewports\":";viewports(out,s.viewports,s.viewportCount);
      out<<",\"publishedViewports\":";viewports(out,s.publishedViewports,s.publishedViewportCount);out<<'}';
    }
    out<<"]}";
  }
 private:
  static bool sameOwner(const Sample& s,const PreparationProgress& p){return s.session==p.session&&s.app==p.app&&s.view==p.view&&s.generation==p.generation;}
  Sample& get(const PreparationProgress& p,const PreparationCohort& cohort,Interval at){
    for(auto& sample:samples)if(sample.sequence&&sameOwner(sample,p)&&sample.cohort==cohort)return sample;
    auto& sample=samples[through%samples.size()];
    if(sample.sequence&&sample.terminal==Terminal::pending)++overwrittenPending;
    sample={};sample.sequence=++through;sample.session=p.session;sample.app=p.app;sample.view=p.view;sample.generation=p.generation;
    sample.cohort=cohort;sample.observed=at;return sample;
  }
  void finish(Sample& sample,Terminal terminal,Interval at){if(sample.terminal!=Terminal::pending)return;
    sample.terminal=terminal;sample.ended=at;++terminals[size_t(terminal)];}
  static const char* name(Terminal t){switch(t){case Terminal::published:return "published";case Terminal::continued:return "continued";
    case Terminal::superseded:return "superseded";case Terminal::closed:return "closed";default:return "pending";}}
  static void interval(std::ostream& out,Interval at){if(!at.sequence){out<<"null";return;}out<<"{\"from\":"<<at.from<<",\"to\":"<<at.to<<",\"sequence\":"<<at.sequence<<'}';}
  static void handle(std::ostream& out,Handle h){out<<"{\"slot\":"<<h.slot<<",\"generation\":"<<h.generation<<'}';}
  static void viewports(std::ostream& out,const std::array<PreparationViewportProgress,16>& values,uint32_t count){
    out<<'[';for(uint32_t i=0;i<count;++i){if(i)out<<',';const auto& v=values[i];out<<"{\"node\":";handle(out,v.node);
      out<<",\"content\":";handle(out,v.content);out<<",\"listGeneration\":\""<<v.listGeneration<<"\",\"begin\":"<<v.begin
        <<",\"end\":"<<v.end<<",\"coverage\":"<<(v.coverage?"true":"false")<<",\"minimum\":"<<v.minimum<<",\"maximum\":"<<v.maximum
        <<",\"offset\":"<<v.offset<<",\"requested\":"<<v.requested<<",\"deferred\":"<<(v.deferred?"true":"false")<<'}';}out<<']';
  }
};
}
