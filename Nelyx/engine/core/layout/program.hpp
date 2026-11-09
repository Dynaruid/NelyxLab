// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include "../scene/geometry.hpp"
#include <vector>
#include <optional>
namespace nelyx::v2 {
struct LayoutExpression {uint32_t op=0,a=0,b=0,c=0;double value=0;};
struct LayoutInstruction {uint32_t kind=0,child=0,target=0,query=0,condition=UINT32_MAX;std::array<uint32_t,4> refs{};};
struct LayoutHitRoute {bool enabled=false;Rect bounds;Affine projection;};
struct LayoutPaintValues {
  Lease lease;
  uint32_t defined=0;
  std::array<double,wire::limits::layoutProgramPaintValues> values{};
  std::vector<LayoutHitRoute> hitRoutes;
  std::vector<Rect> selfHitRects;
  std::optional<Rect> semanticsRect;
  bool routesDefined=false,selfHitDefined=false;
  explicit LayoutPaintValues(const std::shared_ptr<Ledger>& ledger,uint32_t children=0,uint32_t selfRects=0)
    :lease(ledger,sizeof(LayoutPaintValues)+children*sizeof(LayoutHitRoute)+selfRects*sizeof(Rect)),hitRoutes(children){selfHitRects.reserve(selfRects);}
};
struct LayoutProgram {
  Lease lease;
  uint32_t children=0,flags=0,selfRects=0;
  std::array<std::pair<uint32_t,uint32_t>,5> modes{};
  std::vector<LayoutExpression> expressions;
  std::vector<LayoutInstruction> commands;
  LayoutProgram(const std::shared_ptr<Ledger>& ledger,uint32_t values,uint32_t instructions)
    :lease(ledger,sizeof(LayoutProgram)+values*sizeof(LayoutExpression)+instructions*sizeof(LayoutInstruction)),expressions(values),commands(instructions){}
};
inline std::shared_ptr<const LayoutProgram> readLayoutProgram(const std::shared_ptr<Ledger>& ledger,Reader bytes) {
  require(bytes.length>=wire::layoutProgramHeaderBytes&&!bytes.u64(56),wire::statuses::invalidValue);
  const auto children=bytes.u32(0),flags=bytes.u32(4),expressions=bytes.u32(8),commands=bytes.u32(12);
  require(children<=wire::limits::layoutProgramChildren&&flags<=3&&expressions>0&&expressions<=wire::limits::layoutProgramExpressions&&commands>0&&commands<=wire::limits::layoutProgramCommands&&
    bytes.length==wire::layoutProgramHeaderBytes+size_t(expressions)*wire::layoutProgramExpressionBytes+size_t(commands)*wire::layoutProgramCommandBytes,wire::statuses::invalidValue);
  auto result=std::make_shared<LayoutProgram>(ledger,expressions,commands);result->children=children;result->flags=flags;
  std::array<uint32_t,wire::limits::layoutProgramExpressions> depths{};
  constexpr std::array<uint32_t,18> arity{0,0,0,0,2,2,2,2,2,2,3,2,2,2,2,2,3,1};
  for(uint32_t i=0;i<expressions;++i){const auto at=wire::layoutProgramHeaderBytes+size_t(i)*wire::layoutProgramExpressionBytes;auto& e=result->expressions[i];
    e={bytes.u32(at),bytes.u32(at+4),bytes.u32(at+8),bytes.u32(at+12),bytes.f64(at+16)};
    require(e.op<arity.size()&&std::abs(e.value)<=1e12&&(!e.op||!e.value),wire::statuses::invalidValue);
    if(e.op==1||e.op==3){require(e.a<(e.op==1?5u:wire::limits::layoutProgramVariables)&&!e.b&&!e.c,wire::statuses::invalidValue);depths[i]=1;continue;}
    const std::array<uint32_t,3> refs{e.a,e.b,e.c};depths[i]=1;
    for(size_t j=0;j<refs.size();++j){if(j<arity[e.op]){require(refs[j]<i,wire::statuses::invalidValue);depths[i]=std::max(depths[i],depths[refs[j]]+1);}else require(!refs[j],wire::statuses::invalidValue);}
    require(depths[i]<=64,wire::statuses::invalidValue);
  }
  const auto commandAt=wire::layoutProgramHeaderBytes+size_t(expressions)*wire::layoutProgramExpressionBytes;
  constexpr std::array<uint32_t,15> operands{0,1,4,1,2,2,4,1,1,2,1,4,4,4,4};
  for(uint32_t i=0;i<commands;++i){const auto at=commandAt+size_t(i)*wire::layoutProgramCommandBytes;auto& c=result->commands[i];
    c.kind=bytes.u32(at);c.child=bytes.u32(at+4);c.target=bytes.u32(at+8);c.query=bytes.u32(at+12);
    const auto condition=bytes.u32(at+32);c.condition=condition?condition-1:UINT32_MAX;
    require(c.kind>0&&c.kind<operands.size()&&!bytes.u32(at+36)&&(!condition||(c.kind==3&&condition<=expressions)),wire::statuses::invalidValue);
    require((c.kind>=2&&c.kind<=4)||c.kind==9||c.kind==11||c.kind==12?c.child<children:!c.child,wire::statuses::invalidValue);
    require(c.kind<=3?c.target<=wire::limits::layoutProgramVariables-(c.kind==2?6u:1u):c.kind==10?c.target<wire::limits::layoutProgramPaintValues:!c.target,wire::statuses::invalidValue);
    require(c.kind==3?c.query>=wire::layoutQueries::minWidth&&c.query<=wire::layoutQueries::maxHeight:!c.query,wire::statuses::invalidValue);
    for(size_t j=0;j<c.refs.size();++j){c.refs[j]=bytes.u32(at+16+j*4);require(j<operands[c.kind]?c.refs[j]<expressions:!c.refs[j],wire::statuses::invalidValue);}
  }
  uint32_t cursor=0;
  for(size_t mode=0;mode<5;++mode){const auto begin=bytes.u32(16+mode*8),count=bytes.u32(20+mode*8);
    require(begin==cursor&&count>0&&count<=commands-cursor,wire::statuses::invalidValue);cursor+=count;result->modes[mode]={begin,count};
    std::array<bool,wire::limits::layoutProgramVariables> defined{};std::array<bool,wire::limits::layoutProgramChildren> measured{},routed{},projected{};bool terminal=false,interaction=false,semantics=false;
    for(uint32_t i=begin;i<cursor;++i){const auto& command=result->commands[i];
      require(mode?command.kind!=4&&command.kind!=5&&command.kind!=6&&command.kind!=9&&command.kind!=10&&command.kind<11:command.kind!=8,wire::statuses::invalidValue);
      // Reject undefined variables even in a lazy branch; each mode is independent.
      std::array<bool,wire::limits::layoutProgramExpressions> valid{};
      for(size_t j=0;j<result->expressions.size();++j){const auto& e=result->expressions[j];bool known=e.op!=3||defined[e.a];
        if(e.op!=1&&e.op!=3){const std::array<uint32_t,3> refs{e.a,e.b,e.c};for(size_t k=0;k<arity[e.op];++k)known=known&&valid[refs[k]];}valid[j]=known;}
      for(size_t j=0;j<operands[command.kind];++j)require(valid[command.refs[j]],wire::statuses::invalidValue);
      if(command.condition!=UINT32_MAX)require(valid[command.condition],wire::statuses::invalidValue);
      if(command.kind<=3){const auto countValues=command.kind==2?6u:1u;for(uint32_t j=0;j<countValues;++j)defined[command.target+j]=true;}
      if(command.kind==2)measured[command.child]=true;
      if(command.kind==4||command.kind==9)require(measured[command.child],wire::statuses::invalidValue);
      if(command.kind>=11)interaction=true;
      if(command.kind==11){require(measured[command.child]&&!routed[command.child],wire::statuses::invalidValue);routed[command.child]=true;}
      if(command.kind==12){require(routed[command.child]&&!projected[command.child],wire::statuses::invalidValue);projected[command.child]=true;}
      if(command.kind==13)require(++result->selfRects<=wire::limits::layoutProgramChildren,wire::statuses::invalidValue);
      if(command.kind==14){require(!semantics,wire::statuses::invalidValue);semantics=true;}
      terminal|=command.kind==(mode?8u:5u);
    }
    require(terminal,wire::statuses::invalidValue);
    if(!mode){require(bool(flags&2u)==interaction,wire::statuses::invalidValue);
      for(uint32_t i=0;i<children;++i)require(measured[i]&&routed[i]==projected[i],wire::statuses::invalidValue);}
  }
  require(cursor==commands,wire::statuses::invalidValue);return result;
}
/** One instruction per step; child work remains in the existing layout/query owners. */
struct LayoutEvaluation {
  struct Demand {uint32_t kind=0,child=0,target=0,query=0;std::array<double,4> values{};};
  Lease lease;
  const LayoutProgram& program;
  std::array<double,5> input;
  std::array<double,wire::limits::layoutProgramVariables> variables{};
  std::array<double,wire::limits::layoutProgramExpressions> values{};
  std::array<uint32_t,wire::limits::layoutProgramExpressions> stamps{};
  std::vector<Point> positions;
  std::vector<Point> scales;
  std::shared_ptr<LayoutPaintValues> paintValues;
  uint32_t cursor=0,end=0,stamp=0;
  double width=0,height=0,baseline=-1,ideographic=-1,result=0;
  bool hasBaseline=false,hasIdeographic=false;
  std::optional<Demand> demand;
  LayoutEvaluation(const std::shared_ptr<Ledger>& ledger,const LayoutProgram& data,uint32_t mode,std::array<double,5> constraints)
    :lease(ledger,sizeof(LayoutEvaluation)+data.children*2*sizeof(Point)),program(data),input(constraints),positions(data.children),scales(data.children,Point{1,1}),paintValues(mode?nullptr:std::make_shared<LayoutPaintValues>(ledger,data.flags&2u?data.children:0,data.selfRects)),cursor(data.modes.at(mode).first),end(cursor+data.modes.at(mode).second){}
  bool complete()const{return cursor==end&&!demand;}
  double read(uint32_t ref,uint64_t& work){
    if(stamps[ref]==stamp)return values[ref];
    require(++work<=wire::limits::layoutOperations,wire::statuses::budgetExceeded);
    const auto& e=program.expressions[ref];const auto a=[&]{return read(e.a,work);};const auto b=[&]{return read(e.b,work);};const auto c=[&]{return read(e.c,work);};double value=0;
    switch(e.op){case 0:value=e.value;break;case 1:value=input[e.a];break;case 2:value=INFINITY;break;case 3:value=variables[e.a];break;
      case 4:value=a()+b();break;case 5:value=a()-b();break;case 6:value=a()*b();break;
      case 7:{const auto denominator=b();require(denominator!=0,wire::statuses::invalidValue);value=a()/denominator;break;}
      case 8:value=std::min(a(),b());break;case 9:value=std::max(a(),b());break;
      case 10:{const auto low=b(),high=c();require(low<=high,wire::statuses::invalidValue);value=std::clamp(a(),low,high);break;}
      case 11:value=a()<b();break;case 12:value=a()<=b();break;case 13:value=a()>b();break;case 14:value=a()>=b();break;case 15:value=a()==b();break;
      case 16:value=a()!=0?b():c();break;case 17:value=std::isfinite(a());break;default:throw Error{wire::statuses::invalidValue};}
    require(!std::isnan(value)&&(std::isinf(value)||std::abs(value)<=1e12),wire::statuses::invalidValue);
    values[ref]=value;stamps[ref]=stamp;return value;
  }
  static double finite(double value){require(std::isfinite(value)&&std::abs(value)<=1e12,wire::statuses::invalidValue);return value;}
  void advance(uint64_t& work){
    require(!demand&&cursor<end,wire::statuses::invalidValue);++stamp;
    const auto& command=program.commands[cursor];constexpr std::array<uint32_t,15> arity{0,1,4,1,2,2,4,1,1,2,1,4,4,4,4};std::array<double,4> args{};
    if(command.condition!=UINT32_MAX&&read(command.condition,work)==0){variables[command.target]=0;++cursor;return;}
    for(size_t i=0;i<arity[command.kind];++i)args[i]=read(command.refs[i],work);
    if(command.kind==2||command.kind==3){
      if(command.kind==2)require(std::isfinite(args[0])&&std::isfinite(args[2])&&args[0]>=0&&args[2]>=0&&args[1]>=args[0]&&args[3]>=args[2],wire::statuses::invalidValue);
      else require(args[0]>=0,wire::statuses::invalidValue);
      demand=Demand{command.kind,command.child,command.target,command.query,args};return;
    }
    if(command.kind==1)variables[command.target]=args[0];
    else if(command.kind==4)positions[command.child]={finite(args[0]),finite(args[1])};
    else if(command.kind==5){width=finite(args[0]);height=finite(args[1]);require(width>=0&&height>=0,wire::statuses::invalidValue);}
    else if(command.kind==6){baseline=finite(args[0]);hasBaseline=args[1]!=0;ideographic=finite(args[2]);hasIdeographic=args[3]!=0;}
    else if(command.kind==7)require(args[0]!=0,wire::statuses::invalidValue);
    else if(command.kind==8){result=finite(args[0]);require(result>=0,wire::statuses::invalidValue);}
    else if(command.kind==9)scales[command.child]={finite(args[0]),finite(args[1])};
    else if(command.kind==10){require(bool(paintValues),wire::statuses::invalidValue);paintValues->values[command.target]=finite(args[0]);paintValues->defined|=1u<<command.target;}
    else if(command.kind>=11){
      require(bool(paintValues),wire::statuses::invalidValue);
      for(auto& value:args)value=finite(value);
      if(command.kind==12)paintValues->hitRoutes.at(command.child).projection={args[0],0,0,args[2],args[1],args[3]};
      else {
        require(args[2]>=0&&args[3]>=0,wire::statuses::invalidValue);const Rect rect{args[0],args[1],args[2],args[3]};
        if(command.kind==11){auto& route=paintValues->hitRoutes.at(command.child);route.enabled=true;route.bounds=rect;paintValues->routesDefined=true;}
        else if(command.kind==13){paintValues->selfHitDefined=true;paintValues->selfHitRects.push_back(rect);}
        else paintValues->semanticsRect=rect;
      }
    }
    ++cursor;
  }
  void measured(double widthValue,double heightValue,double alphabetic,double ideographicValue,bool hasAlphabetic,bool hasIdeographicValue){
    require(demand&&demand->kind==2,wire::statuses::invalidValue);const auto target=demand->target;
    const std::array<double,6> metrics{widthValue,heightValue,alphabetic,ideographicValue,double(hasAlphabetic),double(hasIdeographicValue)};
    for(size_t i=0;i<metrics.size();++i)variables[target+i]=finite(metrics[i]);demand.reset();++cursor;
  }
  void queried(double value){require(demand&&demand->kind==3,wire::statuses::invalidValue);variables[demand->target]=finite(value);demand.reset();++cursor;}
};
}
