// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "jni.hpp"
#include <unistd.h>

namespace nelyx::v2::android {
/** One generation's UI view; no JNI reference is exposed to App/Hermes. */
class AppServiceView final {
  jobject view=nullptr;jmethodID executeMethod=nullptr;pid_t ui=gettid();
 public:
  AppServiceView(JNIEnv* env,jobject value){
    if(!value)throw std::runtime_error("Android App service view is required");
    auto klass=env->GetObjectClass(value);checked(env);
    executeMethod=env->GetMethodID(klass,"appService","(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    env->DeleteLocalRef(klass);checked(env);
    view=env->NewGlobalRef(value);checked(env);if(!view)throw std::runtime_error("Android App service reference failed");
  }
  ~AppServiceView(){if(view){JniScope scope;scope.env->DeleteGlobalRef(view);}}
  AppServiceView(const AppServiceView&)=delete;AppServiceView& operator=(const AppServiceView&)=delete;
  std::string execute(const std::string& method,const std::string& text){
    if(gettid()!=ui)throw std::runtime_error("Android App service requires its UI owner");
    JniScope scope;auto env=scope.env;
    if(env->PushLocalFrame(8)!=JNI_OK)throw std::runtime_error("Android App service local frame failed");
    struct Frame{JNIEnv* env;~Frame(){env->PopLocalFrame(nullptr);}}frame{env};
    auto name=env->NewStringUTF(method.c_str()),value=string(env,text);checked(env);
    const auto result=static_cast<jstring>(env->CallObjectMethod(view,executeMethod,name,value));checked(env);
    if(!result||env->GetStringLength(result)>65536)throw std::runtime_error("Android App service result exceeds its text limit");
    return string(env,result);
  }
};
}
