// SPDX-License-Identifier: BSD-3-Clause
const path = require('node:path');
module.exports = async function (asset) {
  const appRoot = path.resolve(__dirname, '../..'),
    relative = path.relative(appRoot, asset.fileSystemLocation).replaceAll('\\', '/');
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Linux bundle asset must be in an app-owned directory');
  return { ...asset, httpServerLocation: '/' + relative };
};
