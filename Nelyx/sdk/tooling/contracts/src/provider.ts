// SPDX-License-Identifier: BSD-3-Clause
/** Pure tool-selection contract. Importing it never initializes a runtime host. */
export type Target = 'windows' | 'android' | 'web' | 'ios' | 'macos' | 'linux';
export type Operation = 'check' | 'build' | 'bundle' | 'run' | 'pack' | 'dev';
export interface ToolDescriptor {
  readonly schema: 'nelyx.tool/v1';
  readonly target: Target;
  readonly package: `@nelyx/tool-${Target}`;
  readonly version: string;
  readonly entry: `@nelyx/tool-${Target}/${string}`;
  readonly operations: readonly Operation[];
}
export interface ToolRequest {
  readonly target: Target;
  readonly operation: Operation;
  readonly appRoot: string;
  readonly args: readonly string[];
}
export interface ToolResult {
  readonly exitCode: number;
  readonly artifacts: readonly string[];
}
export interface PlatformTool {
  execute(request: ToolRequest): Promise<ToolResult>;
}
export function selectTool(
  descriptors: readonly ToolDescriptor[],
  target: Target,
  operation: Operation,
): ToolDescriptor {
  const matches = descriptors.filter(
    (value) => value.target === target && value.operations.includes(operation),
  );
  if (matches.length !== 1)
    throw new Error(`Expected one ${target}/${operation} tool, found ${matches.length}`);
  const selected = matches[0]!;
  if (
    selected.schema !== 'nelyx.tool/v1' ||
    selected.package !== `@nelyx/tool-${target}` ||
    !selected.entry.startsWith(selected.package + '/') ||
    selected.entry.includes('..') ||
    !/^\d+\.\d+\.\d+$/.test(selected.version)
  )
    throw new Error('Invalid platform tool descriptor');
  return selected;
}
