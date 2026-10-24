#pragma once
// SPDX-License-Identifier: BSD-3-Clause
#include "ShutdownSignals.h"
#include "DevelopmentSource.h"
#include <RNSkLinuxHost.h>
#include <react-native-linux/RNLinuxApplication.h>
#include <filesystem>
#include <iostream>
#include <string>
namespace Nelyx {
struct LinuxApplicationOptions {std::string name;std::string windowSystem="x11";};
inline int runLinuxApplication(int argc,char** argv,LinuxApplicationOptions options){
  try{
    const auto directory=std::filesystem::canonical("/proc/self/exe").parent_path();
    const auto development=nelyxDevelopmentSource(std::getenv("NELYX_LINUX_DEV_URL"));
    const auto assets=std::filesystem::canonical(directory/"bundle");
    std::string bundleUri;
    if(development)bundleUri=development->bundle;
    else{const auto bundle=std::filesystem::canonical(directory/"bundle/index.linux.bundle");if(!std::filesystem::is_regular_file(bundle))throw std::runtime_error("Packaged Linux bundle missing");auto* encoded=g_filename_to_uri(bundle.c_str(),nullptr,nullptr);if(!encoded)throw std::runtime_error("Invalid packaged Linux bundle path");bundleUri=encoded;g_free(encoded);}
    rnlinux::RNLinuxApplication app([bundleUri,assets,development,options]{
      rnlinux::RNLinuxHost::Config config;
      config.applicationId=std::string("app.nelyx.")+options.name;config.componentName=options.name;config.windowTitle=options.name;
      config.bundleUrl=bundleUri;config.initialWidth=960;config.initialHeight=640;
      RNSkia::LinuxSkiaHostOptions skia;skia.assetRoots={assets.string()};
      if(development)skia.developmentAssetOrigin=development->origin;
      skia.windowSystem=options.windowSystem=="wayland"?RNSkia::LinuxSkiaWindowSystem::Wayland:RNSkia::LinuxSkiaWindowSystem::X11;
      RNSkia::RNSkLinuxHost::install(config,std::move(skia));return config;
    });
    NelyxShutdownSignals shutdownSignals;return app.run(argc,argv);
  }catch(const std::exception& error){std::cerr<<"Nelyx Linux startup failed: "<<error.what()<<std::endl;return 2;}
}

}
