// SPDX-License-Identifier: BSD-3-Clause
/** URL.origin is opaque on custom-scheme WebViews. Compare the URL tuple. */
export function isAppUrl(url: URL, root: URL): boolean {
  const rootPath = root.pathname || '/';
  const pathname = url.pathname || '/';
  if (
    !(
      ['http:', 'https:'].includes(root.protocol) ||
      (root.protocol === 'tauri:' && root.hostname === 'localhost' && !root.port)
    ) ||
    !rootPath.endsWith('/') ||
    root.username ||
    root.password ||
    root.search ||
    root.hash
  )
    return false;
  return (
    url.protocol === root.protocol &&
    url.hostname === root.hostname &&
    url.port === root.port &&
    !url.username &&
    !url.password &&
    !/%(?:2f|5c)/i.test(pathname) &&
    pathname.startsWith(rootPath)
  );
}
