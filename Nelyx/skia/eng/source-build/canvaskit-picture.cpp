// SPDX-License-Identifier: BSD-3-Clause
// Included by the locked CanvasKit paragraph binding. Pictures cross workers;
// font bytes and mutable Skia objects stay with their respective owners.
#include "include/core/SkData.h"
#include "include/core/SkFontArguments.h"
#include "include/core/SkPicture.h"
#include "include/core/SkSerialProcs.h"
#include "include/core/SkStream.h"
#include "include/core/SkTypeface.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>

namespace {
constexpr uint32_t kNelyxFontReference=0x3258504e;
constexpr size_t kNelyxPictureLimit=32*1024*1024,kNelyxFaceLimit=1024,kNelyxAxisLimit=32,
    kNelyxOriginLimit=72,kNelyxFontLimit=16*1024*1024,kNelyxIdentityLimit=128;
struct NelyxPictureFonts {
    std::vector<sk_sp<SkTypeface>> faces,bases;
    std::vector<std::string> identities,baseIdentities;
    std::vector<size_t> sources;
    bool valid=true;
};
// A receiving provider owns this cache. Re-importing a Picture must not create
// a new FreeType face identity for every unchanged variation: Skia's strike/GPU
// caches can keep those identities alive after the old Picture is retired.
class NelyxPictureFontCache {
    using Coordinate=SkFontArguments::VariationPosition::Coordinate;
    struct Entry {sk_sp<SkTypeface> base,face;std::vector<Coordinate> coordinates;};
    std::vector<Entry> entries;
    uint32_t hits_=0,misses_=0;
public:
    sk_sp<SkTypeface> resolve(sk_sp<SkTypeface> base,std::vector<Coordinate> coordinates){
        std::sort(coordinates.begin(),coordinates.end(),[](const auto& a,const auto& b){return a.axis<b.axis;});
        const auto found=std::find_if(entries.begin(),entries.end(),[&](const auto& entry){
            return entry.base->uniqueID()==base->uniqueID()&&entry.coordinates.size()==coordinates.size()&&
                std::equal(entry.coordinates.begin(),entry.coordinates.end(),coordinates.begin(),[](const auto& a,const auto& b){return a.axis==b.axis&&a.value==b.value;});
        });
        if(found!=entries.end()){
            ++hits_;auto face=found->face;std::rotate(found,found+1,entries.end());return face;
        }
        ++misses_;SkFontArguments arguments;arguments.setVariationDesignPosition({coordinates.data(),int(coordinates.size())});
        auto face=base->makeClone(arguments);if(!face)return nullptr;
        if(entries.size()==16)entries.erase(entries.begin());
        entries.push_back({std::move(base),face,std::move(coordinates)});return face;
    }
    void clear(){entries.clear();}
    uint32_t size()const{return uint32_t(entries.size());}
    uint32_t hits()const{return hits_;}
    uint32_t misses()const{return misses_;}
};
bool nelyxSameFontStream(const SkTypeface& face,const SkTypeface& base){
    if(face.uniqueID()==base.uniqueID())return true;
    int faceIndex=-1,baseIndex=-1;auto a=face.openStream(&faceIndex),b=base.openStream(&baseIndex);
    if(!a||!b||faceIndex!=baseIndex||!a->getLength()||a->getLength()>kNelyxFontLimit||a->getLength()!=b->getLength())return false;
    const auto size=a->getLength();const auto aMemory=a->getMemoryBase(),bMemory=b->getMemoryBase();
    // Variation clones normally share the same immutable SkData. Independently
    // decoded equal streams still match exactly; family/style names are not an
    // origin identity and a short hash cannot substitute for these bytes.
    if(aMemory&&bMemory)return aMemory==bMemory||std::memcmp(aMemory,bMemory,size)==0;
    std::array<uint8_t,4096> aBytes,bBytes;
    if(!a->rewind()||!b->rewind())return false;
    for(size_t offset=0;offset<size;){const auto length=std::min(aBytes.size(),size-offset);
        if(a->read(aBytes.data(),length)!=length||b->read(bBytes.data(),length)!=length||
            std::memcmp(aBytes.data(),bBytes.data(),length)!=0)return false;
        offset+=length;
    }
    return true;
}
SkSerialReturnType nelyxWriteTypeface(SkTypeface* face,void* context){
    auto& fonts=*static_cast<NelyxPictureFonts*>(context);
    const auto found=std::find_if(fonts.faces.begin(),fonts.faces.end(),[&](const auto& value){return value->uniqueID()==face->uniqueID();});
    const auto index=found-fonts.faces.begin();
    if(found==fonts.faces.end()){
        if(fonts.faces.size()>=kNelyxFaceLimit){fonts.valid=false;return SkData::MakeEmpty();}
        const auto origin=std::find_if(fonts.bases.begin(),fonts.bases.end(),[&](const auto& base){return nelyxSameFontStream(*face,*base);});
        if(origin==fonts.bases.end()){fonts.valid=false;return SkData::MakeEmpty();}
        const size_t source=origin-fonts.bases.begin();
        fonts.faces.push_back(sk_ref_sp(face));
        fonts.sources.push_back(source);fonts.identities.push_back(fonts.baseIdentities[source]);
    }
    const auto& identity=fonts.identities[index];
    const uint32_t reference[]={kNelyxFontReference,uint32_t(index),uint32_t(identity.size())};
    auto data=SkData::MakeUninitialized(sizeof(reference)+identity.size());
    if(!data){fonts.valid=false;return SkData::MakeEmpty();}
    std::memcpy(data->writable_data(),reference,sizeof(reference));
    std::memcpy(static_cast<uint8_t*>(data->writable_data())+sizeof(reference),identity.data(),identity.size());
    return data;
}
sk_sp<SkTypeface> nelyxReadTypeface(SkStream& stream,void* context){
    // SkPicture supplies the enclosing stream, not a stream limited to this
    // typeface. Consume exactly our bounded reference and leave the next
    // font/section untouched.
    auto& fonts=*static_cast<NelyxPictureFonts*>(context);uint32_t reference[3];
    if(stream.read(reference,sizeof(reference))!=sizeof(reference)||reference[0]!=kNelyxFontReference||reference[1]>=fonts.faces.size()||
        !reference[2]||reference[2]>kNelyxIdentityLimit){
        fonts.valid=false;return nullptr;
    }
    std::array<char,kNelyxIdentityLimit> identity;
    if(stream.read(identity.data(),reference[2])!=reference[2]||
        fonts.identities[reference[1]]!=std::string(identity.data(),reference[2])){fonts.valid=false;return nullptr;}
    return fonts.faces[reference[1]];
}
emscripten::val nelyxSerializePicture(const SkPicture& picture,emscripten::val bases,emscripten::val identities){
    using emscripten::val;NelyxPictureFonts fonts;SkSerialProcs procs;
    const auto count=bases["length"].as<size_t>();
    if(!count||count>kNelyxOriginLimit||identities["length"].as<size_t>()!=count)return val::null();
    for(size_t i=0;i<count;++i){auto base=bases[i].as<sk_sp<SkTypeface>>();const auto identity=identities[i].as<std::string>();
        if(!base||identity.empty()||identity.size()>kNelyxIdentityLimit)return val::null();
        fonts.bases.push_back(std::move(base));fonts.baseIdentities.push_back(identity);
    }
    procs.fTypefaceProc=nelyxWriteTypeface;procs.fTypefaceCtx=&fonts;
    auto data=picture.serialize(&procs);
    if(!data||!fonts.valid||data->size()>kNelyxPictureLimit)return val::null();
    auto result=val::object(),descriptors=val::array();
    for(size_t i=0;i<fonts.faces.size();++i){
        const auto& face=fonts.faces[i];
        const int count=face->getVariationDesignPosition({});
        if(count<0||size_t(count)>kNelyxAxisLimit)return val::null();
        std::vector<SkFontArguments::VariationPosition::Coordinate> coordinates(count);
        if(count&&face->getVariationDesignPosition({coordinates.data(),coordinates.size()})!=count)return val::null();
        auto descriptor=val::object(),axes=val::array();descriptor.set("source",uint32_t(fonts.sources[i]));
        for(size_t j=0;j<coordinates.size();++j){auto axis=val::object();axis.set("axis",coordinates[j].axis);axis.set("value",coordinates[j].value);axes.set(j,axis);}
        descriptor.set("coordinates",axes);descriptors.set(i,descriptor);
    }
    result.set("fonts",descriptors);
    result.set("bytes",val(emscripten::typed_memory_view(data->size(),data->bytes())).call<val>("slice"));
    return result;
}
sk_sp<SkPicture> nelyxMakePicture(emscripten::val input,emscripten::val bases,emscripten::val variations,emscripten::val identities,NelyxPictureFontCache& cache){
    const auto size=input["byteLength"].as<size_t>(),count=bases["length"].as<size_t>();
    if(!size||size>kNelyxPictureLimit||count>kNelyxFaceLimit||variations["length"].as<size_t>()!=count||identities["length"].as<size_t>()!=count)return nullptr;
    NelyxPictureFonts fonts;
    for(size_t i=0;i<count;++i){
        auto base=bases[i].as<sk_sp<SkTypeface>>();auto axes=variations[i];const auto length=axes["length"].as<size_t>();
        const auto identity=identities[i].as<std::string>();
        if(!base||length>kNelyxAxisLimit||identity.empty()||identity.size()>kNelyxIdentityLimit)return nullptr;
        fonts.identities.push_back(identity);
        std::vector<SkFontArguments::VariationPosition::Coordinate> coordinates;
        for(size_t j=0;j<length;++j){const auto axis=axes[j]["axis"].as<uint32_t>();const auto value=axes[j]["value"].as<double>();
            if(!std::isfinite(value)||std::abs(value)>1e6||std::any_of(coordinates.begin(),coordinates.end(),[&](const auto& c){return c.axis==axis;}))return nullptr;
            coordinates.push_back({axis,float(value)});
        }
        auto face=cache.resolve(std::move(base),std::move(coordinates));if(!face)return nullptr;fonts.faces.push_back(std::move(face));
    }
    auto data=SkData::MakeUninitialized(size);if(!data)return nullptr;
    emscripten::val(emscripten::typed_memory_view(size,static_cast<uint8_t*>(data->writable_data()))).call<void>("set",input);
    SkDeserialProcs procs;procs.fTypefaceStreamProc=nelyxReadTypeface;procs.fTypefaceCtx=&fonts;procs.fAllowSkSL=false;
    auto picture=SkPicture::MakeFromData(data.get(),&procs);return fonts.valid?picture:nullptr;
}
// Each collection is immutable after publication. Reuse decoded base faces;
// rebuilding a fallback order never registers/copies the bundled font bytes.
sk_sp<skia::textlayout::TypefaceFontProvider> nelyxMakeFontProvider(emscripten::val faces,emscripten::val names){
    const auto count=faces["length"].as<size_t>();
    if(!count||count>72||names["length"].as<size_t>()!=count)return nullptr;
    auto provider=sk_make_sp<skia::textlayout::TypefaceFontProvider>();
    for(size_t i=0;i<count;++i){auto face=faces[i].as<sk_sp<SkTypeface>>();const auto name=names[i].as<std::string>();
        if(!face||name.empty()||name.size()>256||name.front()==' '||name.back()==' ')return nullptr;
        for(const auto c:name)if(uint8_t(c)<32||uint8_t(c)==127)return nullptr;
        provider->registerTypeface(std::move(face),SkString(name.data(),name.size()));
    }
    return provider;
}
}
EMSCRIPTEN_BINDINGS(NelyxPicture) {
    emscripten::function("nelyxPictureApiVersion",emscripten::optional_override([](){return 3;}));
    emscripten::class_<NelyxPictureFontCache>("NelyxPictureFontCache")
        .constructor<>().function("clear",&NelyxPictureFontCache::clear)
        .function("size",&NelyxPictureFontCache::size).function("hits",&NelyxPictureFontCache::hits)
        .function("misses",&NelyxPictureFontCache::misses);
    emscripten::function("nelyxSerializePicture",&nelyxSerializePicture);
    emscripten::function("nelyxMakePicture",&nelyxMakePicture);
    emscripten::function("nelyxFontApiVersion",emscripten::optional_override([](){return 1;}));
    emscripten::function("nelyxMakeFontProvider",&nelyxMakeFontProvider);
}
