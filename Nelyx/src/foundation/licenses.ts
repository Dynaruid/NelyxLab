// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/foundation/licenses.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a

export class LicenseParagraph {
  static readonly centeredIndent = -1;

  constructor(
    readonly text: string,
    readonly indent: number,
  ) {}
}

export abstract class LicenseEntry {
  abstract get packages(): Iterable<string>;
  abstract get paragraphs(): Iterable<LicenseParagraph>;
}

export class LicenseEntryWithLineBreaks extends LicenseEntry {
  readonly packages: readonly string[];

  constructor(
    packages: readonly string[],
    readonly text: string,
  ) {
    super();
    this.packages = Object.freeze([...packages]);
  }

  get paragraphs(): readonly LicenseParagraph[] {
    const paragraphs: LicenseParagraph[] = [];
    let lines: string[] = [];
    let paragraphIndent = 0;
    let previousIndent = 0;
    const finish = () => {
      if (lines.length) paragraphs.push(new LicenseParagraph(lines.join(' '), paragraphIndent));
      lines = [];
      previousIndent = 0;
    };

    for (const page of this.text.split('\f')) {
      for (const line of page.split(/\r\n|\r|\n/)) {
        let start = 0;
        let indent = 0;
        while (line[start] === ' ' || line[start] === '\t') {
          indent += line[start] === ' ' ? 1 : 8;
          start++;
        }
        if (start === line.length) {
          finish();
          continue;
        }
        // The opening bracket aligns with the continuation of common LGPL notices.
        if (line[start] === '[') indent++;
        if (lines.length && indent > previousIndent) finish();
        if (!lines.length) {
          paragraphIndent = indent > 10 ? LicenseParagraph.centeredIndent : Math.floor(indent / 3);
        }
        lines.push(line.slice(start).trimEnd());
        previousIndent = indent;
      }
      finish();
    }
    return paragraphs;
  }
}

export type LicenseEntryCollector = () =>
  | Iterable<LicenseEntry>
  | AsyncIterable<LicenseEntry>
  | Promise<Iterable<LicenseEntry> | AsyncIterable<LicenseEntry>>;

export class LicenseRegistry {
  private static collectors: LicenseEntryCollector[] = [];
  private constructor() {}

  static addLicense(collector: LicenseEntryCollector): void {
    this.collectors.push(collector);
  }

  static get licenses(): AsyncIterable<LicenseEntry> {
    const collectors = [...this.collectors];
    return (async function* () {
      for (const collect of collectors) {
        for await (const entry of await collect()) yield entry;
      }
    })();
  }

  /** Clears registered collectors for test isolation. */
  static reset(): void {
    this.collectors = [];
  }
}
