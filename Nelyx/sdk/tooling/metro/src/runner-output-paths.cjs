// SPDX-License-Identifier: BSD-3-Clause
'use strict';
/** Native package publication and Metro's own outputs are opaque to its watcher. */
module.exports = function runnerOutputPaths({
  appRoot,
  target,
  blockList = [],
  caseSensitive = process.platform !== 'win32',
}) {
  const previous = Array.isArray(blockList) ? blockList : [blockList],
    flags = previous[0]?.flags ?? '';
  // Metro combines these expressions only when their flags agree. Keep user
  // expressions intact and encode Windows ASCII case folding in our literals.
  const escaped = (value) =>
    value
      .split(/[\\/]/)
      .map((part) => {
        const literal = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return caseSensitive
          ? literal
          : literal.replace(
              /[a-z]/gi,
              (char) => '[' + char.toLowerCase() + char.toUpperCase() + ']',
            );
      })
      .join('[/\\\\]');
  const generated = new RegExp(
    '^' +
      escaped(appRoot) +
      '(?:[/\\\\][^/\\\\]+)*[/\\\\](?:' +
      ['.nelyx', '.metro-cache', '.bundle'].map(escaped).join('|') +
      ')(?:[/\\\\]|$)',
    flags,
  );
  const result = [...previous, generated];
  if (target === 'windows')
    result.push(
      new RegExp(
        '^' +
          escaped(appRoot) +
          '[/\\\\]' +
          escaped('windows') +
          '[/\\\\](?!' +
          escaped('runner') +
          '(?:[/\\\\]|$))',
        flags,
      ),
    );
  return result;
};
