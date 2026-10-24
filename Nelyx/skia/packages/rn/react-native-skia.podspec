# react-native-skia.podspec

require "json"
require "fileutils"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Apple consumers select their target before evaluating this podspec.
# Only that target's pinned input is required; other Apple payloads may be absent.
require_relative 'apple/skia_pods'
apple_frameworks = NelyxAppleSkia.frameworks(__dir__)
preprocessor_defs = '$(inherited) SK_GRAPHITE=1 SK_IMAGE_READ_PIXELS_DISABLE_LEGACY_API=1 SK_DISABLE_LEGACY_SHAPER_FACTORY=1'

Pod::Spec.new do |s|
  s.name         = "react-native-skia"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = <<-DESC
                  react-native-skia
                   DESC
  s.homepage     = "https://github.com/wcandillon/react-native-skia"
  s.license    = { :type => "BSD-3-Clause AND MIT", :file => "LICENSE.md" }
  s.authors      = {
    "Christian Falch" => "christian.falch@gmail.com",
    "William Candillon" => "wcandillon@gmail.com"
  }
  s.platforms    = { :ios => "15.1", :osx => "11" }
  s.source       = { :git => "https://github.com/wcandillon/react-native-skia.git", :tag => "#{s.version}" }

  s.requires_arc = true
  s.pod_target_xcconfig = {
    'GCC_PREPROCESSOR_DEFINITIONS' => preprocessor_defs,
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'DEFINES_MODULE' => 'YES',
    "HEADER_SEARCH_PATHS" => '"$(PODS_TARGET_SRCROOT)/generated/gpu" "$(PODS_TARGET_SRCROOT)/generated/core" "$(PODS_TARGET_SRCROOT)/cpp"/** "$(PODS_TARGET_SRCROOT)/cpp" "$(PODS_TARGET_SRCROOT)/generated/sdk/skia" "$(PODS_TARGET_SRCROOT)/generated/sdk/dawn/include"'
  }

  s.frameworks = ['MetalKit', 'AVFoundation', 'AVKit', 'CoreMedia', 'ImageIO']

  # Platform-specific vendored frameworks (copied into libs/)
  s.ios.vendored_frameworks = apple_frameworks.fetch('ios', [])
  s.osx.vendored_frameworks = apple_frameworks.fetch('macos', [])

  # Preserve the copied libs directory
  s.preserve_paths = ["libs/**/*", "apple/*.inc"]

  # All iOS cpp/h files
  s.source_files = [
    "apple/**/*.{h,c,cc,cpp,m,mm,swift}",
    "cpp/**/*.{h,cpp}",
    "generated/core/**/*.{h,cpp}",
    "generated/gpu/**/*.h",
    "generated/sdk/skia/modules/jsonreader/SkJSONReader.cpp"
  ]

  install_modules_dependencies(s)
  s.dependency "React"
  s.dependency "React-callinvoker"
  s.dependency "React-Core"
end
