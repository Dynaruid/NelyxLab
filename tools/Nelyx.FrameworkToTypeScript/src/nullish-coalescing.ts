// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';

/** Null normalization is redundant when the value immediately has another fallback.
 * Keep the final null, operand order and lazy evaluation, including optional calls. */
export function createNullishCoalescing(left: ts.Expression, right: ts.Expression): ts.Expression {
  const operands: ts.Expression[] = [];
  const collect = (expression: ts.Expression): void => {
    let value = expression;
    while (ts.isParenthesizedExpression(value)) value = value.expression;
    if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      collect(value.left);
      collect(value.right);
    } else {
      operands.push(expression);
    }
  };
  collect(left);
  collect(right);
  const retained = operands.filter((operand, index) => {
    let value = operand;
    while (ts.isParenthesizedExpression(value)) value = value.expression;
    return index === operands.length - 1 || value.kind !== ts.SyntaxKind.NullKeyword;
  });
  return retained.slice(1).reduce<ts.Expression>(
    (value, operand) => ts.factory.createBinaryExpression(value, ts.SyntaxKind.QuestionQuestionToken, operand),
    retained[0]!,
  );
}
