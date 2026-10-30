const path = require('node:path');
const { createRunnerConfig } = require('@nelyx/metro/runner-config');
module.exports = createRunnerConfig({
  target: 'ios',
  runnerRoot: __dirname,
  appRoot: path.resolve(__dirname, '../..'),
});
