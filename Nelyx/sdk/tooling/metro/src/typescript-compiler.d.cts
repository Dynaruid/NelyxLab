export interface TypeScriptCompiler {
  readonly version: string;
  readonly entry: string;
}
export interface TypeScriptCompilerResult extends TypeScriptCompiler {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}
export declare function resolveTypeScriptCompiler(
  root: string,
  packageName?: 'typescript' | '@typescript/native',
): TypeScriptCompiler;
export declare function runTypeScriptCompiler(
  root: string,
  args: readonly string[],
  packageName?: 'typescript' | '@typescript/native',
): TypeScriptCompilerResult;
