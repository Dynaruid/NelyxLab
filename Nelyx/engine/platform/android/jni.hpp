// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jni.h>
#include <stdexcept>
#include <string>
namespace nelyx::v2::android {
inline JavaVM* vm=nullptr;
inline jclass httpClass=nullptr;
class JniScope {
 public:
  JNIEnv* env=nullptr;bool attached=false;
  JniScope(){if(!vm)throw std::runtime_error("Android JVM unavailable");if(vm->GetEnv(reinterpret_cast<void**>(&env),JNI_VERSION_1_6)!=JNI_OK){if(vm->AttachCurrentThread(&env,nullptr)!=JNI_OK)throw std::runtime_error("JNI attachment failed");attached=true;}}
  ~JniScope(){if(attached)vm->DetachCurrentThread();}
};
inline void checked(JNIEnv* env){if(env->ExceptionCheck()){env->ExceptionDescribe();env->ExceptionClear();throw std::runtime_error("Android OS service failed");}}
inline std::string string(JNIEnv* env,jstring value){if(!value)return {};const auto size=env->GetStringLength(value);const auto* chars=env->GetStringChars(value,nullptr);if(!chars)throw std::runtime_error("JNI string allocation failed");std::u16string result(reinterpret_cast<const char16_t*>(chars),size);env->ReleaseStringChars(value,chars);return utf8(result);}
inline jstring string(JNIEnv* env,const std::string& value){const auto text=utf16({reinterpret_cast<const uint8_t*>(value.data()),value.size()});return env->NewString(reinterpret_cast<const jchar*>(text.data()),jsize(text.size()));}
}
