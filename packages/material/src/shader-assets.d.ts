// SPDX-License-Identifier: BSD-3-Clause
// Nelyx's package build embeds these UTF-8 assets into ordinary JavaScript.
declare module '*.sksl' {
  const source: string;
  export default source;
}
