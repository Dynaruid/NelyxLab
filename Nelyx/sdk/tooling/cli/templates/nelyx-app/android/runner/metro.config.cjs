// SPDX-License-Identifier: BSD-3-Clause
const path=require('node:path'),{createRunnerConfig}=require('@nelyx/metro/runner-config');
module.exports=createRunnerConfig({target:'android',runnerRoot:__dirname,appRoot:path.resolve(__dirname,'../..')},{maxWorkers:2});
