// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Shared by package emission and the package ownership audit. */
export function readShaderAsset(packageRoot, importer, specifier) {
  const root = fs.realpathSync(packageRoot),
    shaders = path.join(root, 'assets', 'shaders');
  const inside = (file, directory) => {
    const relative = path.relative(directory, file);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  };
  if (!specifier.startsWith('.') || !specifier.endsWith('.sksl'))
    throw new Error('SkSL requires a relative .sksl path: ' + specifier);
  const asset = path.resolve(path.dirname(importer), specifier);
  if (!inside(asset, shaders))
    throw new Error('SkSL must belong to this package assets/shaders: ' + asset);
  const real = fs.realpathSync(asset);
  if (!inside(real, shaders))
    throw new Error('SkSL cannot link outside package assets/shaders: ' + asset);
  const source = fs.readFileSync(real, 'utf8');
  // Match Core RuntimeShader's source transport limits before publishing a package.
  /* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
  if (!source.trim() || source.length > 16384 || !/^[\x09\x0a\x0d\x20-\x7e]+$/.test(source))
    /* oxlint-enable no-control-regex */
    throw new Error('SkSL must contain at most 16384 ASCII characters: ' + asset);
  return { asset, source };
}

/** Embed package-owned SkSL at build time so ESM, Metro and Hermes need no file loader. */
export function shaderAssetImports(packageRoot) {
  return (context) => {
    const factory = context.factory;
    return (sourceFile) => {
      const visit = (node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text.endsWith('.sksl')
        ) {
          const specifier = node.moduleSpecifier.text,
            clause = node.importClause;
          if (
            !specifier.startsWith('.') ||
            !clause?.name ||
            clause.isTypeOnly ||
            clause.namedBindings ||
            node.attributes
          )
            throw new Error('SkSL requires a relative default import: ' + sourceFile.fileName);
          const { asset, source } = readShaderAsset(packageRoot, sourceFile.fileName, specifier);
          const embedded = factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  clause.name,
                  undefined,
                  undefined,
                  factory.createStringLiteral(source),
                ),
              ],
              ts.NodeFlags.Const,
            ),
          );
          ts.setTextRange(embedded, node);
          ts.addSyntheticLeadingComment(
            embedded,
            ts.SyntaxKind.SingleLineCommentTrivia,
            ' Embedded from ' + path.relative(packageRoot, asset).replaceAll('\\', '/'),
            true,
          );
          return embedded;
        }
        const unsupported = ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
            ? node.arguments[0]
            : undefined;
        if (unsupported && ts.isStringLiteral(unsupported) && unsupported.text.endsWith('.sksl'))
          throw new Error('SkSL requires a static default import: ' + sourceFile.fileName);
        return ts.visitEachChild(node, visit, context);
      };
      return ts.visitNode(sourceFile, visit);
    };
  };
}
