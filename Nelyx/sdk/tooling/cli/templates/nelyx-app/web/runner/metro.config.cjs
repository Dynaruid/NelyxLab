// SPDX-License-Identifier: BSD-3-Clause
const path=require('node:path'),{createWebRunnerConfig}=require('@nelyx/metro/web-config');
module.exports=createWebRunnerConfig({runnerRoot:__dirname,appRoot:path.resolve(__dirname,'../..')});
