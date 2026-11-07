// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/interaction/editing.hpp"
#include "jni.hpp"
#include <condition_variable>
#include <thread>
#include <mutex>
#include <vector>
namespace nelyx::v2::native {
/** Bounded IO owner. Java owns only URLConnection/bytes, never an engine or Runtime. */
class AppHttpRequest:public std::enable_shared_from_this<AppHttpRequest> {
 public:
  static constexpr uint64_t creditBytes=512*1024;
  struct State {uint32_t phase=0,status=0,error=0;int64_t size=-1;uint64_t bytes=0,requests=0;bool closed=false;};
 private:
  std::unique_ptr<ExternalLease> memory;
  std::mutex gate;std::condition_variable changed;State state;
  std::vector<uint8_t> storage;bool closing=false,borrowed=false;
  jobject transport=nullptr;
  void run(std::string base,std::string key,std::string headers){
    try{
      android::JniScope scope;auto* env=scope.env;
      const auto type=android::httpClass;
      const auto ctor=env->GetMethodID(type,"<init>","()V"),open=env->GetMethodID(type,"open","(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V"),read=env->GetMethodID(type,"read","()[B"),close=env->GetMethodID(type,"close","()V");
      auto object=env->NewObject(type,ctor);android::checked(env);
      {std::lock_guard lock(gate);transport=env->NewGlobalRef(object);android::checked(env);if(closing){env->CallVoidMethod(object,env->GetMethodID(type,"cancel","()V"));android::checked(env);}}
      struct Close{AppHttpRequest& owner;JNIEnv* env;jobject object;jmethodID close;~Close(){env->CallVoidMethod(object,close);if(env->ExceptionCheck())env->ExceptionClear();{std::lock_guard lock(owner.gate);env->DeleteGlobalRef(owner.transport);owner.transport=nullptr;}env->DeleteLocalRef(object);}} cleanup{*this,env,object,close};
      auto a=android::string(env,base),b=android::string(env,key),c=android::string(env,headers);
      env->CallVoidMethod(object,open,a,b,c);env->DeleteLocalRef(a);env->DeleteLocalRef(b);env->DeleteLocalRef(c);android::checked(env);
      {std::lock_guard lock(gate);state.status=uint32_t(env->GetIntField(object,env->GetFieldID(type,"status","I")));state.size=env->GetLongField(object,env->GetFieldID(type,"size","J"));state.requests=uint64_t(env->GetIntField(object,env->GetFieldID(type,"requests","I")));state.phase=1;}
      for(;;){
        {std::unique_lock lock(gate);changed.wait(lock,[&]{return closing||state.phase==2;});if(closing)break;}
        auto bytes=static_cast<jbyteArray>(env->CallObjectMethod(object,read));android::checked(env);
        std::lock_guard lock(gate);if(!bytes){state.phase=4;continue;}
        const auto count=env->GetArrayLength(bytes);if(count<1||count>65536){env->DeleteLocalRef(bytes);throw std::runtime_error("HTTP chunk exceeds admitted storage");}
        storage.resize(size_t(count));env->GetByteArrayRegion(bytes,0,count,reinterpret_cast<jbyte*>(storage.data()));env->DeleteLocalRef(bytes);android::checked(env);state.bytes+=uint64_t(count);state.phase=3;
      }
    }catch(...){std::lock_guard lock(gate);state.error=1;state.phase=5;}
    std::lock_guard lock(gate);state.closed=true;
  }
 public:
  explicit AppHttpRequest(const std::shared_ptr<Ledger>& ledger):memory(std::make_unique<ExternalLease>(ledger,6,4,creditBytes)){}
  void start(const std::string& base,const std::string& key,const std::string& headers={}){
    if(base.empty()||base.size()>4096||key.size()>4096||headers.size()>16384)throw std::runtime_error("Android HTTP input budget exceeded");
    auto self=shared_from_this();std::thread([self,base,key,headers]{self->run(base,key,headers);}).detach();
  }
  State snapshot(){std::lock_guard lock(gate);return state;}
  void read(){std::lock_guard lock(gate);if(closing||state.phase!=1||borrowed)throw std::runtime_error("Network read is pending/borrowed/closed");state.phase=2;changed.notify_all();}
  struct Chunk {
    std::shared_ptr<AppHttpRequest> owner;std::vector<uint8_t> bytes;
    Chunk(std::shared_ptr<AppHttpRequest> owner,std::vector<uint8_t> bytes):owner(std::move(owner)),bytes(std::move(bytes)){}
    Chunk(Chunk&&)=default;Chunk(const Chunk&)=delete;
    ~Chunk(){if(owner){std::lock_guard lock(owner->gate);owner->borrowed=false;}}
  };
  Chunk chunk(){std::lock_guard lock(gate);if(closing||state.phase!=3||borrowed)throw std::runtime_error("Network chunk is unavailable/borrowed/closed");state.phase=1;borrowed=true;return {shared_from_this(),std::move(storage)};}
  void cancel(){std::lock_guard lock(gate);closing=true;if(transport){android::JniScope scope;scope.env->CallVoidMethod(transport,scope.env->GetMethodID(android::httpClass,"cancel","()V"));android::checked(scope.env);}changed.notify_all();}
};
}
