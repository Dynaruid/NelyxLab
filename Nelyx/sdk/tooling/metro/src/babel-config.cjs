// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Keep RN's preset at the config root: its Metro transformer also supplies that
// same preset when probing config names, and Babel deduplicates its identity.
module.exports = {
  plugins: [require.resolve('@babel/plugin-transform-class-static-block')],
  presets: [require('@react-native/babel-preset')],
};
