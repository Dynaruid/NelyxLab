// SPDX-License-Identifier: BSD-3-Clause
const { createRunnerConfig } = require('@nelyx/metro/runner-config');
module.exports = createRunnerConfig({
  target: 'windows',
  runnerRoot: __dirname,
  appRoot: require('node:path').resolve(__dirname, '../..'),
});
