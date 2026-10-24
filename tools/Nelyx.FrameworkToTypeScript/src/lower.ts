// SPDX-License-Identifier: BSD-3-Clause
export interface Syntax {
  kind: string; line: number; column: number;
  fields: Record<string, Syntax | Syntax[] | string | string[]>;
  symbol: {kind: string; name: string; isStatic: boolean; owner: string | null} | null;
  type: string | null;
}
export class Unsupported extends Error {
  constructor(readonly node: Syntax, reason: string) { super(`${node.line}:${node.column} ${node.kind}: ${reason}`); }
}
const node = (n: Syntax, field: string): Syntax => {
  const value = n.fields[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Unsupported(n, `missing ${field}`);
  return value;
};
const nodes = (n: Syntax, field: string): Syntax[] => (n.fields[field] ?? []) as Syntax[];
const token = (n: Syntax, field: string): string => String(n.fields[field] ?? '');
const has = (n: Syntax, modifier: string): boolean => (n.fields.Modifiers as string[] ?? []).includes(modifier);
const types: Record<string, string> = {double: 'number', float: 'number', bool: 'boolean', string: 'string', void: 'void'};
export function lower(root: Syntax, excluded: readonly string[], imports:Readonly<Record<string,string>>={}): string {
  function modifiers(n:Syntax,allowed:readonly string[]):void {
    if(nodes(n,'AttributeLists').length)throw new Unsupported(n,'attributes require an explicit semantic port');
    for(const modifier of n.fields.Modifiers as string[]??[])if(!allowed.includes(modifier))throw new Unsupported(n,`modifier ${modifier} requires a semantic rule`);
  }
  modifiers(root,['public','internal']);
  const className = token(root, 'Identifier');
  const properties = new Set(nodes(root, 'Members').filter(n => n.kind === 'PropertyDeclaration' || n.kind === 'FieldDeclaration').flatMap(n => n.kind === 'PropertyDeclaration' ? [token(n, 'Identifier')] : nodes(node(n, 'Declaration'), 'Variables').map(v => token(v, 'Identifier'))));
  let locals = new Set<string>();
  function type(n: Syntax): string {
    if (n.kind === 'PredefinedType') {
      const keyword = token(n, 'Keyword');
      if (!types[keyword]) throw new Unsupported(n, `${keyword} requires an explicit numeric/runtime port`);
      return types[keyword]!;
    }
    if (n.kind === 'IdentifierName') {const name=token(n,'Identifier');if(name!==className && !Object.hasOwn(imports,name))throw new Unsupported(n,`missing direct import/port for ${name}`);return name;}
    throw new Unsupported(n, 'type needs an explicit mapping');
  }
  function expression(n: Syntax): string {
    switch (n.kind) {
      case 'IdentifierName': {
        const name = token(n, 'Identifier');
        if (properties.has(name) && !locals.has(name)) return `${n.symbol?.isStatic ? className : 'this'}.${name}`;
        return name;
      }
      case 'ThisExpression': return 'this';
      case 'NumericLiteralExpression': case 'TrueLiteralExpression': case 'FalseLiteralExpression': return token(n, 'Token');
      case 'StringLiteralExpression': return JSON.stringify(token(n, 'Token'));
      case 'ParenthesizedExpression': return `(${expression(node(n, 'Expression'))})`;
      case 'SimpleMemberAccessExpression': {
        const owner = expression(node(n, 'Expression')), name = token(node(n, 'Name'), 'Identifier');
        const math: Record<string, string> = {Sqrt:'sqrt', Pow:'pow', Abs:'abs', Sin:'sin', Cos:'cos', Exp:'exp', Min:'min', Max:'max', PI:'PI', E:'E'};
        if (owner === 'Math' && !math[name]) throw new Unsupported(n, 'unmapped Math operation');
        return `${owner}.${owner === 'Math' ? math[name] : name}`;
      }
      case 'ObjectCreationExpression': return `new ${type(node(n, 'Type'))}(${argumentsOf(n)})`;
      case 'InvocationExpression': return `${expression(node(n, 'Expression'))}(${argumentsOf(n)})`;
      case 'UnaryMinusExpression': case 'LogicalNotExpression': return `${token(n, 'OperatorToken')}(${expression(node(n, 'Operand'))})`;
      case 'SimpleAssignmentExpression': case 'AddExpression': case 'SubtractExpression': case 'MultiplyExpression': case 'DivideExpression':
      case 'LessThanExpression': case 'GreaterThanExpression': case 'LogicalAndExpression': case 'LogicalOrExpression':
        if (n.kind === 'DivideExpression' && n.type !== 'double' && n.type !== 'float') throw new Unsupported(n, 'integer division needs truncation semantics');
        return `${expression(node(n, 'Left'))} ${token(n, 'OperatorToken')} ${expression(node(n, 'Right'))}`;
      case 'EqualsExpression': case 'NotEqualsExpression': throw new Unsupported(n, 'equality requires a value/identity policy');
      case 'ConditionalExpression': return `${expression(node(n, 'Condition'))} ? ${expression(node(n, 'WhenTrue'))} : ${expression(node(n, 'WhenFalse'))}`;
      default: throw new Unsupported(n, 'manual semantic port required');
    }
  }
  function argumentsOf(n: Syntax): string {
    if (!n.fields.ArgumentList) return '';
    return nodes(node(n, 'ArgumentList'), 'Arguments').map(a => {
      if (a.fields.NameColon || a.fields.RefKindKeyword) throw new Unsupported(a, 'named/ref argument mapping required');
      return expression(node(a, 'Expression'));
    }).join(', ');
  }
  function parameters(n: Syntax): string {
    const values = nodes(node(n, 'ParameterList'), 'Parameters');
    locals = new Set(values.map(p => token(p, 'Identifier')));
    return values.map(p => `${token(p, 'Identifier')}: ${type(node(p, 'Type'))}${p.fields.Default ? ` = ${expression(node(node(p, 'Default'), 'Value'))}` : ''}`).join(', ');
  }
  function statement(n: Syntax): string {
    switch (n.kind) {
      case 'Block': return `{\n${nodes(n, 'Statements').map(statement).join('\n')}\n}`;
      case 'ExpressionStatement': return `${expression(node(n, 'Expression'))};`;
      case 'ReturnStatement': return `return ${expression(node(n, 'Expression'))};`;
      case 'LocalDeclarationStatement': {
        const declaration=node(n,'Declaration'),declaredType=node(declaration,'Type');
        if(declaredType.kind!=='IdentifierName'||token(declaredType,'Identifier')!=='var')type(declaredType);
        return nodes(declaration, 'Variables').map(v => {
        const name = token(v, 'Identifier'); locals.add(name);
        const initializer=node(node(v,'Initializer'),'Value');if(['int','long','uint','ulong'].includes(initializer.type??''))throw new Unsupported(initializer,'inferred integer local needs numeric semantics review');
        return `let ${name} = ${expression(initializer)};`;
      }).join('\n');}
      default: throw new Unsupported(n, 'statement needs a semantic rule');
    }
  }
  if (root.kind !== 'ClassDeclaration' || root.fields.BaseList || root.fields.TypeParameterList) throw new Unsupported(root, 'inheritance/generic dispatch needs review');
  const members = nodes(root, 'Members').filter(m => !excluded.includes(token(m, 'Identifier'))).map(m => {
    modifiers(m,m.kind==='FieldDeclaration'?['public','private','static','readonly','const']:['public','private','static']);
    locals = new Set();
    const prefix = has(m, 'private') ? 'private ' : '';
    const staticPrefix = has(m, 'static') || has(m, 'const') ? 'static ' : '';
    const name = token(m, 'Identifier');
    switch (m.kind) {
      case 'PropertyDeclaration': {
        if(m.fields.Initializer)throw new Unsupported(m,'property initializer needs a lowering rule');
        const accessors = nodes(node(m, 'AccessorList'), 'Accessors');
        if (accessors.some(a => a.kind !== 'GetAccessorDeclaration' || a.fields.Body || a.fields.ExpressionBody)) throw new Unsupported(m, 'only get-only storage is automatic');
        return `${prefix}${staticPrefix}readonly ${name}: ${type(node(m, 'Type'))};`;
      }
      case 'FieldDeclaration': {
        const declaration = node(m, 'Declaration');
        return nodes(declaration, 'Variables').map(v => `${prefix}${staticPrefix}${has(m,'readonly') || has(m,'const') ? 'readonly ' : ''}${token(v,'Identifier')}: ${type(node(declaration,'Type'))} = ${expression(node(node(v,'Initializer'),'Value'))};`).join('\n');
      }
      case 'ConstructorDeclaration': {
        if(has(m,'static')||has(m,'private'))throw new Unsupported(m,'static/private constructor semantics require review');
        if (m.fields.Initializer) throw new Unsupported(m, 'base constructor dispatch needs review');
        const params = parameters(m); return `constructor(${params}) ${statement(node(m, 'Body'))}`;
      }
      case 'MethodDeclaration': {
        const params = parameters(m);
        const body = m.fields.Body ? statement(node(m,'Body')) : `{ return ${expression(node(node(m,'ExpressionBody'),'Expression'))}; }`;
        return `${prefix}${staticPrefix}${name}(${params}): ${type(node(m,'ReturnType'))} ${body}`;
      }
      default: throw new Unsupported(m, 'member needs a semantic rule');
    }
  });
  return `export class ${className} {\n${members.join('\n')}\n}\n`;
}
