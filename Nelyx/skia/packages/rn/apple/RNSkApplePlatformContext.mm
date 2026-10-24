#import "RNSkApplePlatformContext.h"

#import <React/RCTUtils.h>
#include <set>
#include <utility>

#include "RNDawnContext.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkFontMgr.h"
#include "include/core/SkSurface.h"

#include "include/ports/SkFontMgr_mac_ct.h"

#pragma clang diagnostic pop

namespace RNSkia {
nelyx::gpu::Context &RNSkApplePlatformContext::getGpuContext() {
  if(_gpuClosed.load())throw std::runtime_error("Apple GPU admission closed");
  if(!_gpuPrepared.load())throw std::runtime_error("Apple Metal GPU must be prepared on the JS owner before native surface admission");
  return DawnContext::getInstance();
}
void RNSkApplePlatformContext::prepareCompositionGpu() {
  requireJavascriptOwner();
  if(_gpuClosed.load() || !_gpuPolicyConfigured.load())throw std::runtime_error("Apple hardware Metal GPU policy is not active");
  if(_gpuPrepared.load())return;
  _gpuUsed.store(true); // Failed native construction cannot qualify as a no-GPU rollback.
  if(!DawnContext::getInstance().webGpuDevice())throw std::runtime_error("Apple Metal GPU device creation failed");
  _gpuPrepared.store(true);
}
bool RNSkApplePlatformContext::retireGpuWork() {
  const bool retired=!_gpuUsed.load() || DawnContext::getInstance().retireWork();
  if(retired && _gpuClosed.load())_gpuDrained.store(true);
  return retired;
}
void RNSkApplePlatformContext::configureGpuPolicy(bool allowSoftware) {
  requireJavascriptOwner();if(_gpuClosed.load())throw std::runtime_error("Apple GPU policy admission closed");
  if (allowSoftware) throw std::runtime_error("Apple Graphite requires hardware Metal");
  DawnUtils::configureNelyxDawnAdapterPolicy(false);
  _gpuPolicyConfigured.store(true);
}


void RNSkApplePlatformContext::performStreamOperation(
    const std::string &sourceUri,
    const std::function<void(std::unique_ptr<SkStreamAsset>)> &op) {

  performDataOperation(sourceUri, AppleStreamState::MaxResponse,
      [op](sk_sp<SkData> data) { op(data ? SkMemoryStream::Make(std::move(data)) : nullptr); });
}

void RNSkApplePlatformContext::performDataOperation(
    const std::string &sourceUri, size_t maxBytes,
    std::function<void(sk_sp<SkData>)> op) {
  [_streamLoader loadURI:sourceUri limit:maxBytes completion:std::move(op)];
}

void RNSkApplePlatformContext::raiseError(const std::exception &err) {
  RCTFatal(RCTErrorWithMessage([NSString stringWithUTF8String:err.what()]));
}

bool RNSkApplePlatformContext::mainScreenSupportsP3() {
  static bool supportsP3 = false;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
#if !TARGET_OS_OSX
    supportsP3 =
        [UIScreen mainScreen].traitCollection.displayGamut == UIDisplayGamutP3;
#else
    NSColorSpace *screenColorSpace = [NSScreen mainScreen].colorSpace;
    supportsP3 =
        screenColorSpace != nil &&
        [screenColorSpace isEqual:[NSColorSpace displayP3ColorSpace]];
#endif // !TARGET_OS_OSX
  });
  return supportsP3;
}

float RNSkApplePlatformContext::mainScreenPixelDensity() {
  static float density = 1.0f;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSCAssert([NSThread isMainThread], @"Apple screen snapshot requires main-queue setup");
#if !TARGET_OS_OSX
    density = [UIScreen mainScreen].scale;
#else
    density = [NSScreen mainScreen].backingScaleFactor;
#endif
    if (density <= 0.0f) {
      density = 1.0f;
    }
  });
  return density;
}

sk_sp<SkSurface>
RNSkApplePlatformContext::makeOffscreenSurface(int width, int height,
                                               bool useP3ColorSpace) {
  return getGpuContext().MakeOffscreen(width, height,
                                                  useP3ColorSpace);
}

sk_sp<SkFontMgr> RNSkApplePlatformContext::createFontMgr() {
  return SkFontMgr_New_CoreText(nullptr);
}

std::vector<std::string> RNSkApplePlatformContext::getSystemFontFamilies() {
  std::vector<std::string> families;

  // System UI fonts (e.g., .AppleSystemUIFont) are not enumerated by Skia's
  // font manager. We retrieve them via Core Text's CTFontUIFontType constants.
  // This list covers common system font types as of iOS 17 / macOS 14.
  // Apple may add new CTFontUIFontType values in future OS versions,
  // so this list may need to be updated periodically.
  CTFontUIFontType fontTypes[] = {
      kCTFontUIFontUser,        kCTFontUIFontUserFixedPitch,
      kCTFontUIFontSystem,      kCTFontUIFontEmphasizedSystem,
      kCTFontUIFontSmallSystem, kCTFontUIFontSmallEmphasizedSystem,
      kCTFontUIFontMiniSystem,  kCTFontUIFontMiniEmphasizedSystem,
      kCTFontUIFontLabel,       kCTFontUIFontMessage,
      kCTFontUIFontToolTip,
  };

  std::set<std::string> uniqueFamilies;

  for (CTFontUIFontType fontType : fontTypes) {
    CTFontRef font = CTFontCreateUIFontForLanguage(fontType, 12.0, nullptr);
    if (font) {
      CFStringRef familyName = CTFontCopyFamilyName(font);
      if (familyName) {
        const char *cstr =
            CFStringGetCStringPtr(familyName, kCFStringEncodingUTF8);
        if (cstr) {
          uniqueFamilies.insert(std::string(cstr));
        } else {
          char buffer[256];
          if (CFStringGetCString(familyName, buffer, sizeof(buffer),
                                 kCFStringEncodingUTF8)) {
            uniqueFamilies.insert(std::string(buffer));
          }
        }
        CFRelease(familyName);
      }
      CFRelease(font);
    }
  }

  families.assign(uniqueFamilies.begin(), uniqueFamilies.end());
  return families;
}

std::string
RNSkApplePlatformContext::resolveFontFamily(const std::string &familyName) {
  // Handle special font family names like React Native does
  // See: RCTFont.mm in React Native
  if (familyName == "System" || familyName == "system" ||
      familyName == "sans-serif") {
    return ".AppleSystemUIFont";
  }
  if (familyName == "SystemCondensed" || familyName == "system-condensed") {
    // Return system font - condensed trait is handled via font style
    return ".AppleSystemUIFont";
  }
  // CSS generic font families
  if (familyName == "serif") {
    return "Times New Roman";
  }
  if (familyName == "monospace") {
    return "Courier New";
  }
  // Return as-is if no mapping exists
  return familyName;
}

void RNSkApplePlatformContext::runOnMainThread(std::function<void()> func) {
  auto task=std::make_shared<std::function<void()>>(std::move(func));
  auto closed = _servicesClosed;auto state=_mainState;
  {std::lock_guard lock(state->mutex);if(state->closed)return;++state->jobs;}
  dispatch_async(dispatch_get_main_queue(), ^{
    try{if(!closed->load())(*task)();}catch(...){std::lock_guard lock(state->mutex);state->failed=true;}
    *task={}; // Retire native captures before reporting this job complete.
    std::lock_guard lock(state->mutex);--state->jobs;
  });
}

sk_sp<SkImage>
RNSkApplePlatformContext::takeScreenshotFromViewTag(size_t viewTag) {
  return [_screenshotService
      screenshotOfViewWithTag:[NSNumber numberWithLong:viewTag]];
}

} // namespace RNSkia
