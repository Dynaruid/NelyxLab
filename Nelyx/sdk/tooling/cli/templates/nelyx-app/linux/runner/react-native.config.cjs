// SPDX-License-Identifier: BSD-3-Clause
const path=require('node:path'),cli=require('@lucid-softworks/react-native-linux-cli');
// Community CLI uses null to disable autolinking for a dependency. The pinned
// RNL adapter predates that convention; preserve it at this app-owned boundary.
function runnerConfiguration(){
  const linux={...cli.platforms.linux,dependencyConfig(root,config){return config===null?null:cli.platforms.linux.dependencyConfig(root,config);}};
  return {commands:cli.commands,platforms:{...cli.platforms,linux},reactNativePath:path.dirname(require.resolve('react-native/package.json')),project:{linux:{sourceDir:'..',executableName:'rn-linux-app'}}};
}
module.exports=runnerConfiguration();
