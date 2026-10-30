// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/diagnostics.dart.
import { DiagnosticsNode } from './diagnostics.ts';
import type { DiagnosticLevel, DiagnosticsTreeStyle } from './diagnostics.ts';
import { FoundationBuildMode } from './constants.ts';
export interface TextTreeConfigurationOptions {
  readonly prefixLineOne: string;
  readonly prefixOtherLines: string;
  readonly prefixLastChildLineOne: string;
  readonly prefixOtherLinesRootNode: string;
  readonly linkCharacter: string;
  readonly propertyPrefixIfChildren: string;
  readonly propertyPrefixNoChildren: string;
  readonly lineBreak?: string;
  readonly lineBreakProperties?: boolean;
  readonly afterName?: string;
  readonly afterDescriptionIfBody?: string;
  readonly afterDescription?: string;
  readonly beforeProperties?: string;
  readonly afterProperties?: string;
  readonly mandatoryAfterProperties?: string;
  readonly propertySeparator?: string;
  readonly bodyIndent?: string;
  readonly footer?: string;
  readonly showChildren?: boolean;
  readonly addBlankLineIfNoChildren?: boolean;
  readonly isNameOnOwnLine?: boolean;
  readonly isBlankLineBetweenPropertiesAndChildren?: boolean;
  readonly beforeName?: string;
  readonly suffixLineOne?: string;
  readonly mandatoryFooter?: string;
}
export class TextTreeConfiguration {
  readonly prefixLineOne: string;
  readonly prefixOtherLines: string;
  readonly prefixLastChildLineOne: string;
  readonly prefixOtherLinesRootNode: string;
  readonly linkCharacter: string;
  readonly propertyPrefixIfChildren: string;
  readonly propertyPrefixNoChildren: string;
  readonly childLinkSpace: string;
  readonly lineBreak: string;
  readonly lineBreakProperties: boolean;
  readonly afterName: string;
  readonly afterDescriptionIfBody: string;
  readonly afterDescription: string;
  readonly beforeProperties: string;
  readonly afterProperties: string;
  readonly mandatoryAfterProperties: string;
  readonly propertySeparator: string;
  readonly bodyIndent: string;
  readonly footer: string;
  readonly showChildren: boolean;
  readonly addBlankLineIfNoChildren: boolean;
  readonly isNameOnOwnLine: boolean;
  readonly isBlankLineBetweenPropertiesAndChildren: boolean;
  readonly beforeName: string;
  readonly suffixLineOne: string;
  readonly mandatoryFooter: string;
  constructor(o: TextTreeConfigurationOptions) {
    this.prefixLineOne = o.prefixLineOne;
    this.prefixOtherLines = o.prefixOtherLines;
    this.prefixLastChildLineOne = o.prefixLastChildLineOne;
    this.prefixOtherLinesRootNode = o.prefixOtherLinesRootNode;
    this.linkCharacter = o.linkCharacter;
    this.propertyPrefixIfChildren = o.propertyPrefixIfChildren;
    this.propertyPrefixNoChildren = o.propertyPrefixNoChildren;
    this.childLinkSpace = ' '.repeat(o.linkCharacter.length);
    this.lineBreak = o.lineBreak ?? '\n';
    this.lineBreakProperties = o.lineBreakProperties ?? true;
    this.afterName = o.afterName ?? ':';
    this.afterDescriptionIfBody = o.afterDescriptionIfBody ?? '';
    this.afterDescription = o.afterDescription ?? '';
    this.beforeProperties = o.beforeProperties ?? '';
    this.afterProperties = o.afterProperties ?? '';
    this.mandatoryAfterProperties = o.mandatoryAfterProperties ?? '';
    this.propertySeparator = o.propertySeparator ?? '';
    this.bodyIndent = o.bodyIndent ?? '';
    this.footer = o.footer ?? '';
    this.showChildren = o.showChildren ?? true;
    this.addBlankLineIfNoChildren = o.addBlankLineIfNoChildren ?? true;
    this.isNameOnOwnLine = o.isNameOnOwnLine ?? false;
    this.isBlankLineBetweenPropertiesAndChildren =
      o.isBlankLineBetweenPropertiesAndChildren ?? true;
    this.beforeName = o.beforeName ?? '';
    this.suffixLineOne = o.suffixLineOne ?? '';
    this.mandatoryFooter = o.mandatoryFooter ?? '';
  }
}
type _WordWrapParseMode = 'inSpace' | 'inWord' | 'atBreak';
class _PrefixedStringBuilder {
  private prefix: string;
  private nextPrefix: string | null = null;
  private buffer = '';
  private current = '';
  private ranges: number[] = [];
  private numLines = 0;
  constructor(
    readonly prefixLineOne: string,
    prefixOtherLines: string,
    readonly wrapWidth: number | null,
  ) {
    this.prefix = prefixOtherLines;
  }
  get prefixOtherLines(): string {
    return this.nextPrefix ?? this.prefix;
  }
  set prefixOtherLines(value: string) {
    this.prefix = value;
    this.nextPrefix = null;
  }
  incrementPrefixOtherLines(suffix: string, { updateCurrentLine }: { updateCurrentLine: boolean }) {
    if (!this.current || updateCurrentLine) {
      this.prefix = this.prefixOtherLines + suffix;
      this.nextPrefix = null;
    } else this.nextPrefix = this.prefixOtherLines + suffix;
  }
  private currentPrefix(): string {
    return this.buffer ? this.prefix : this.prefixLineOne;
  }
  get requiresMultipleLines(): boolean {
    return (
      this.numLines > 1 ||
      (this.numLines === 1 && this.current.length > 0) ||
      this.current.length + this.currentPrefix().length > this.wrapWidth!
    );
  }
  get isCurrentLineEmpty(): boolean {
    return this.current.length === 0;
  }
  private finalizeLine(addTrailingLineBreak: boolean) {
    const text = this.current;
    this.current = '';
    if (!this.ranges.length) {
      this.writeLine(text, addTrailingLineBreak);
      return;
    }
    const lines = _PrefixedStringBuilder.wordWrapLine(
      text,
      this.ranges,
      this.wrapWidth!,
      this.buffer ? this.prefix.length : this.prefixLineOne.length,
      this.prefix.length,
    );
    for (let i = 0; i < lines.length; i++)
      this.writeLine(lines[i]!, addTrailingLineBreak || i < lines.length - 1);
    this.ranges = [];
  }
  private static wordWrapLine(
    message: string,
    ranges: number[],
    width: number,
    startOffset: number,
    otherLineOffset: number,
  ): string[] {
    const result: string[] = [];
    let lengthStart = -startOffset,
      index = 0,
      mode: _WordWrapParseMode = 'inSpace',
      lastWordStart = 0,
      lastWordEnd: number | null = null,
      start = 0,
      currentChunk = 0;
    const noWrap = (i: number) => {
      while (true) {
        if (currentChunk >= ranges.length) return true;
        if (i < ranges[currentChunk + 1]!) break;
        currentChunk += 2;
      }
      return i < ranges[currentChunk]!;
    };
    while (true) {
      if (mode === 'inSpace') {
        while (index < message.length && message[index] === ' ') index++;
        lastWordStart = index;
        mode = 'inWord';
      }
      if (mode === 'inWord') {
        while (index < message.length && (message[index] !== ' ' || noWrap(index))) index++;
        mode = 'atBreak';
      }
      if (index - lengthStart > width || index === message.length) {
        if (index - lengthStart <= width || lastWordEnd === null) lastWordEnd = index;
        result.push(message.slice(start, lastWordEnd));
        if (lastWordEnd >= message.length) return result;
        if (lastWordEnd === index) {
          while (index < message.length && message[index] === ' ') index++;
          start = index;
          mode = 'inWord';
        } else {
          start = lastWordStart;
          mode = 'atBreak';
        }
        lengthStart = start - otherLineOffset;
        lastWordEnd = null;
      } else {
        lastWordEnd = index;
        mode = 'inSpace';
      }
    }
  }
  write(s: string, { allowWrap = false }: { allowWrap?: boolean } = {}) {
    if (!s) return;
    const lines = s.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        this.finalizeLine(true);
        this.updatePrefix();
      }
      const line = lines[i]!;
      if (line) {
        if (allowWrap && this.wrapWidth !== null) {
          const start = this.current.length,
            end = start + line.length;
          if (this.ranges.at(-1) === start) this.ranges[this.ranges.length - 1] = end;
          else this.ranges.push(start, end);
        }
        this.current += line;
      }
    }
  }
  private updatePrefix() {
    if (this.nextPrefix !== null) {
      this.prefix = this.nextPrefix;
      this.nextPrefix = null;
    }
  }
  private writeLine(line: string, includeLineBreak: boolean) {
    this.buffer += (this.currentPrefix() + line).trimEnd() + (includeLineBreak ? '\n' : '');
    this.numLines++;
  }
  writeRawLines(lines: string) {
    if (!lines) return;
    if (this.current) this.finalizeLine(true);
    this.buffer += lines;
    if (!lines.endsWith('\n')) this.buffer += '\n';
    this.numLines++;
    this.updatePrefix();
  }
  writeStretched(text: string, targetLineLength: number) {
    this.write(text);
    const target = targetLineLength - this.current.length - this.currentPrefix().length;
    if (target > 0) {
      if (!text || text.endsWith('\n')) throw new Error('Stretched text must end in a character');
      this.current += text.at(-1)!.repeat(target);
    }
    this.ranges = [];
  }
  build(): string {
    if (this.current) this.finalizeLine(false);
    return this.buffer;
  }
}
export interface TextTreeRendererOptions {
  readonly minLevel?: DiagnosticLevel;
  readonly wrapWidth?: number;
  readonly wrapWidthProperties?: number;
  readonly maxDescendentsTruncatableNode?: number;
}
export interface TextTreeRenderOptions {
  readonly prefixLineOne?: string;
  readonly prefixOtherLines?: string | null;
  readonly parentConfiguration?: Pick<TextTreeConfiguration, 'lineBreakProperties'> | null;
}
function _isSingleLine(style: DiagnosticsTreeStyle | null): boolean {
  return style === 'singleLine';
}
export class TextTreeRenderer {
  private readonly minLevel: DiagnosticLevel;
  private readonly wrapWidth: number;
  private readonly wrapWidthProperties: number;
  private readonly maxDescendentsTruncatableNode: number;
  constructor(o: TextTreeRendererOptions = {}) {
    this.minLevel = o.minLevel ?? 'debug';
    this.wrapWidth = o.wrapWidth ?? 100;
    this.wrapWidthProperties = o.wrapWidthProperties ?? 65;
    this.maxDescendentsTruncatableNode = o.maxDescendentsTruncatableNode ?? -1;
  }
  private _childTextConfiguration(
    child: DiagnosticsNode,
    style: TextTreeConfiguration,
  ): TextTreeConfiguration {
    return (
      _isSingleLine(child.style) || child.style === 'errorProperty'
        ? style
        : child.textTreeConfiguration
    )!;
  }
  render(node: DiagnosticsNode, o: TextTreeRenderOptions = {}): string {
    return FoundationBuildMode.release ? '' : this._debugRender(node, o);
  }
  private _debugRender(
    node: DiagnosticsNode,
    {
      prefixLineOne = '',
      prefixOtherLines = null,
      parentConfiguration = null,
    }: TextTreeRenderOptions = {},
  ): string {
    const isSingleLine =
      _isSingleLine(node.style) && parentConfiguration?.lineBreakProperties !== true;
    prefixOtherLines ??= prefixLineOne;
    if (node.linePrefix !== null) {
      prefixLineOne += node.linePrefix;
      prefixOtherLines += node.linePrefix;
    }
    const config = node.textTreeConfiguration;
    if (!config) throw new Error('A text tree node must have a renderable style');
    if (!prefixOtherLines) prefixOtherLines += config.prefixOtherLinesRootNode;
    if (node.style === 'truncateChildren') {
      const descendants: string[] = [];
      let depth = 0,
        lines = 0;
      const visitor = (parent: DiagnosticsNode) => {
        for (const child of parent.getChildren()) {
          if (lines < 25) {
            depth++;
            descendants.push(prefixOtherLines + '  '.repeat(depth) + child);
            if (depth < 5) visitor(child);
            depth--;
          } else if (lines === 25)
            descendants.push(
              prefixOtherLines + '  ...(descendants list truncated after ' + lines + ' lines)',
            );
          lines++;
        }
      };
      visitor(node);
      return (
        prefixLineOne +
        (lines > 1
          ? 'This ' + node.name + ' had the following descendants (showing up to depth 5):'
          : descendants.length === 1
            ? 'This ' + node.name + ' had the following child:'
            : 'This ' + node.name + ' has no descendants.') +
        '\n' +
        descendants.join('\n')
      );
    }
    const builder = new _PrefixedStringBuilder(
      prefixLineOne,
      prefixOtherLines,
      Math.max(this.wrapWidth, prefixOtherLines.length + this.wrapWidthProperties),
    );
    let children = [...node.getChildren()],
      description = node.toDescription({ parentConfiguration });
    if (config.beforeName) builder.write(config.beforeName);
    const wrapName = !isSingleLine && node.allowNameWrap,
      wrapDescription = !isSingleLine && node.allowWrap,
      uppercaseTitle = node.style === 'error';
    let name = node.name;
    if (uppercaseTitle) name = name?.toUpperCase() ?? null;
    if (!description) {
      if (node.showName && name !== null) builder.write(name, { allowWrap: wrapName });
    } else {
      let includeName = false;
      if (name !== null && name.length > 0 && node.showName) {
        includeName = true;
        builder.write(name, { allowWrap: wrapName });
        if (node.showSeparator) builder.write(config.afterName, { allowWrap: wrapName });
        builder.write(config.isNameOnOwnLine || description.includes('\n') ? '\n' : ' ', {
          allowWrap: wrapName,
        });
      }
      if (!isSingleLine && builder.requiresMultipleLines && !builder.isCurrentLineEmpty)
        builder.write('\n');
      if (includeName)
        builder.incrementPrefixOtherLines(
          children.length === 0 ? config.propertyPrefixNoChildren : config.propertyPrefixIfChildren,
          { updateCurrentLine: true },
        );
      if (uppercaseTitle) description = description.toUpperCase();
      builder.write(description.trimEnd(), { allowWrap: wrapDescription });
      if (!includeName)
        builder.incrementPrefixOtherLines(
          children.length === 0 ? config.propertyPrefixNoChildren : config.propertyPrefixIfChildren,
          { updateCurrentLine: false },
        );
    }
    if (config.suffixLineOne) builder.writeStretched(config.suffixLineOne, builder.wrapWidth!);
    let properties = node.getProperties().filter((n) => !n.isFiltered(this.minLevel));
    if (this.maxDescendentsTruncatableNode >= 0 && node.allowTruncate) {
      if (properties.length < this.maxDescendentsTruncatableNode)
        properties = [
          ...properties.slice(0, this.maxDescendentsTruncatableNode),
          DiagnosticsNode.message('...'),
        ];
      if (this.maxDescendentsTruncatableNode < children.length)
        children = [
          ...children.slice(0, this.maxDescendentsTruncatableNode),
          DiagnosticsNode.message('...'),
        ];
    }
    if (
      (properties.length > 0 || children.length > 0 || node.emptyBodyDescription !== null) &&
      (node.showSeparator || description.length > 0)
    )
      builder.write(config.afterDescriptionIfBody);
    if (config.lineBreakProperties) builder.write(config.lineBreak);
    if (properties.length) builder.write(config.beforeProperties);
    builder.incrementPrefixOtherLines(config.bodyIndent, { updateCurrentLine: false });
    if (
      node.emptyBodyDescription !== null &&
      !properties.length &&
      !children.length &&
      prefixLineOne
    ) {
      builder.write(node.emptyBodyDescription);
      if (config.lineBreakProperties) builder.write(config.lineBreak);
    }
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i]!;
      if (i > 0) builder.write(config.propertySeparator);
      const style = property.textTreeConfiguration!;
      if (_isSingleLine(property.style)) {
        const rendered = this.render(property, {
          prefixLineOne: style.prefixLineOne,
          prefixOtherLines: style.childLinkSpace + style.prefixOtherLines,
          parentConfiguration: config,
        });
        if (rendered.split('\n').length === 1 && !config.lineBreakProperties)
          builder.write(rendered);
        else {
          builder.write(rendered);
          if (!rendered.endsWith('\n')) builder.write('\n');
        }
      } else
        builder.writeRawLines(
          this.render(property, {
            prefixLineOne: builder.prefixOtherLines + style.prefixLineOne,
            prefixOtherLines:
              builder.prefixOtherLines + style.childLinkSpace + style.prefixOtherLines,
            parentConfiguration: config,
          }),
        );
    }
    if (properties.length) builder.write(config.afterProperties);
    builder.write(config.mandatoryAfterProperties);
    if (!config.lineBreakProperties) builder.write(config.lineBreak);
    const prefixChildrenRaw = prefixOtherLines + config.bodyIndent;
    if (
      !children.length &&
      config.addBlankLineIfNoChildren &&
      builder.requiresMultipleLines &&
      builder.prefixOtherLines.trimEnd()
    )
      builder.write(config.lineBreak);
    if (children.length && config.showChildren) {
      if (
        config.isBlankLineBetweenPropertiesAndChildren &&
        properties.length &&
        children[0]!.textTreeConfiguration!.isBlankLineBetweenPropertiesAndChildren
      )
        builder.write(config.lineBreak);
      builder.prefixOtherLines = prefixOtherLines;
      for (let i = 0; i < children.length; i++) {
        const child = children[i]!,
          childConfig = this._childTextConfiguration(child, config),
          last = i === children.length - 1,
          other =
            prefixChildrenRaw +
            (last
              ? childConfig.childLinkSpace
              : this._childTextConfiguration(children[i + 1]!, config).linkCharacter) +
            childConfig.prefixOtherLines;
        builder.writeRawLines(
          this.render(child, {
            prefixLineOne:
              prefixChildrenRaw +
              (last ? childConfig.prefixLastChildLineOne : childConfig.prefixLineOne),
            prefixOtherLines: other,
            parentConfiguration: config,
          }),
        );
        if (childConfig.footer) {
          builder.prefixOtherLines = prefixChildrenRaw;
          builder.write(
            (last ? childConfig.childLinkSpace : childConfig.linkCharacter) + childConfig.footer,
          );
          if (childConfig.mandatoryFooter)
            builder.writeStretched(
              childConfig.mandatoryFooter,
              Math.max(builder.wrapWidth!, this.wrapWidthProperties + other.length),
            );
          builder.write(config.lineBreak);
        }
      }
    }
    if (parentConfiguration === null && config.mandatoryFooter) {
      builder.writeStretched(config.mandatoryFooter, builder.wrapWidth!);
      builder.write(config.lineBreak);
    }
    return builder.build();
  }
}

export const sparseTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '├─',
  'prefixOtherLines': ' ',
  'prefixLastChildLineOne': '└─',
  'linkCharacter': '│',
  'propertyPrefixIfChildren': '│ ',
  'propertyPrefixNoChildren': '  ',
  'prefixOtherLinesRootNode': ' ',
});
export const dashedTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '╎╌',
  'prefixLastChildLineOne': '└╌',
  'prefixOtherLines': ' ',
  'linkCharacter': '╎',
  'propertyPrefixIfChildren': '│ ',
  'propertyPrefixNoChildren': '  ',
  'prefixOtherLinesRootNode': ' ',
});
export const denseTextConfiguration = new TextTreeConfiguration({
  'propertySeparator': ', ',
  'beforeProperties': '(',
  'afterProperties': ')',
  'lineBreakProperties': false,
  'prefixLineOne': '├',
  'prefixOtherLines': '',
  'prefixLastChildLineOne': '└',
  'linkCharacter': '│',
  'propertyPrefixIfChildren': '│',
  'propertyPrefixNoChildren': ' ',
  'prefixOtherLinesRootNode': '',
  'addBlankLineIfNoChildren': false,
  'isBlankLineBetweenPropertiesAndChildren': false,
});
export const transitionTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '╞═╦══ ',
  'prefixLastChildLineOne': '╘═╦══ ',
  'prefixOtherLines': ' ║ ',
  'footer': ' ╚═══════════',
  'linkCharacter': '│',
  'propertyPrefixIfChildren': '',
  'propertyPrefixNoChildren': '',
  'prefixOtherLinesRootNode': '',
  'afterName': ' ═══',
  'afterDescriptionIfBody': ':',
  'bodyIndent': '  ',
  'isNameOnOwnLine': true,
  'addBlankLineIfNoChildren': false,
  'isBlankLineBetweenPropertiesAndChildren': false,
});
export const errorTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '╞═╦',
  'prefixLastChildLineOne': '╘═╦',
  'prefixOtherLines': ' ║ ',
  'footer': ' ╚═══════════',
  'linkCharacter': '│',
  'propertyPrefixIfChildren': '',
  'propertyPrefixNoChildren': '',
  'prefixOtherLinesRootNode': '',
  'beforeName': '══╡ ',
  'suffixLineOne': ' ╞══',
  'mandatoryFooter': '═════',
  'addBlankLineIfNoChildren': false,
  'isBlankLineBetweenPropertiesAndChildren': false,
});
export const whitespaceTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '',
  'prefixLastChildLineOne': '',
  'prefixOtherLines': ' ',
  'prefixOtherLinesRootNode': '  ',
  'propertyPrefixIfChildren': '',
  'propertyPrefixNoChildren': '',
  'linkCharacter': ' ',
  'addBlankLineIfNoChildren': false,
  'afterDescriptionIfBody': ':',
  'isBlankLineBetweenPropertiesAndChildren': false,
});
export const flatTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '',
  'prefixLastChildLineOne': '',
  'prefixOtherLines': '',
  'prefixOtherLinesRootNode': '',
  'propertyPrefixIfChildren': '',
  'propertyPrefixNoChildren': '',
  'linkCharacter': '',
  'addBlankLineIfNoChildren': false,
  'afterDescriptionIfBody': ':',
  'isBlankLineBetweenPropertiesAndChildren': false,
});
export const singleLineTextConfiguration = new TextTreeConfiguration({
  'propertySeparator': ', ',
  'beforeProperties': '(',
  'afterProperties': ')',
  'prefixLineOne': '',
  'prefixOtherLines': '',
  'prefixLastChildLineOne': '',
  'lineBreak': '',
  'lineBreakProperties': false,
  'addBlankLineIfNoChildren': false,
  'showChildren': false,
  'propertyPrefixIfChildren': '  ',
  'propertyPrefixNoChildren': '  ',
  'linkCharacter': '',
  'prefixOtherLinesRootNode': '',
});
export const errorPropertyTextConfiguration = new TextTreeConfiguration({
  'propertySeparator': ', ',
  'beforeProperties': '(',
  'afterProperties': ')',
  'prefixLineOne': '',
  'prefixOtherLines': '',
  'prefixLastChildLineOne': '',
  'lineBreakProperties': false,
  'addBlankLineIfNoChildren': false,
  'showChildren': false,
  'propertyPrefixIfChildren': '  ',
  'propertyPrefixNoChildren': '  ',
  'linkCharacter': '',
  'prefixOtherLinesRootNode': '',
  'isNameOnOwnLine': true,
});
export const shallowTextConfiguration = new TextTreeConfiguration({
  'prefixLineOne': '',
  'prefixLastChildLineOne': '',
  'prefixOtherLines': ' ',
  'prefixOtherLinesRootNode': '  ',
  'propertyPrefixIfChildren': '',
  'propertyPrefixNoChildren': '',
  'linkCharacter': ' ',
  'addBlankLineIfNoChildren': false,
  'afterDescriptionIfBody': ':',
  'isBlankLineBetweenPropertiesAndChildren': false,
  'showChildren': false,
});
