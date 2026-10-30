'use strict';
function createRnConfig(projectRoot, overrides = {}) {
  const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
  return mergeConfig(getDefaultConfig(projectRoot), overrides);
}
module.exports = { createRnConfig };
