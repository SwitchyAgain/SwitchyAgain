export type PrintOptions = {
  beautify?: boolean;
  comments?: boolean;
};

export type Node = {
  kind: string;
  comments?: string[];
  print_to_string(options?: PrintOptions): string;
  [key: string]: unknown;
};

type PrintContext = {
  beautify: boolean;
  comments: boolean;
  level: number;
};

const PREC_ASSIGN = 1;
const PREC_CONDITIONAL = 2;
const PREC_LOGICAL_OR = 3;
const PREC_LOGICAL_AND = 4;
const PREC_EQUALITY = 8;
const PREC_RELATIONAL = 9;
const PREC_ADDITIVE = 11;
const PREC_UNARY = 13;
const PREC_CALL = 14;
const PREC_MEMBER = 15;
const PREC_PRIMARY = 16;

function create(kind: string, props: Record<string, unknown> = {}): Node {
  const result = {
    kind,
    ...props,
    print_to_string(options?: PrintOptions) {
      return print(result as Node, {
        beautify: !!options?.beautify,
        comments: !!options?.comments,
        level: 0
      });
    }
  };
  return result as Node;
}

function child(ctx: PrintContext): PrintContext {
  return {
    ...ctx,
    level: ctx.level + 1
  };
}

function indent(ctx: PrintContext): string {
  return ctx.beautify ? '    '.repeat(ctx.level) : '';
}

function stringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function commentLiteral(value: string): string {
  return '/*' + value.replace(/\*\//g, '*\\/') + '*/';
}

function withComments(node: Node, text: string, ctx: PrintContext): string {
  if (!ctx.comments || !node.comments?.length) {
    return text;
  }
  const separator = ctx.beautify ? '\n' + indent(ctx) : '';
  return node.comments.map(commentLiteral).join(separator) + separator + text;
}

function binaryPrecedence(operator: string): number {
  switch (operator) {
    case '||':
      return PREC_LOGICAL_OR;
    case '&&':
      return PREC_LOGICAL_AND;
    case '===':
    case '!==':
    case '==':
    case '!=':
      return PREC_EQUALITY;
    case '<':
    case '<=':
    case '>':
    case '>=':
    case 'in':
    case 'instanceof':
      return PREC_RELATIONAL;
    case '+':
    case '-':
      return PREC_ADDITIVE;
    default:
      return PREC_ADDITIVE + 1;
  }
}

function wrap(text: string, precedence: number, parentPrecedence: number): string {
  return precedence < parentPrecedence ? '(' + text + ')' : text;
}

function print(node: Node, ctx: PrintContext): string {
  return node.kind === 'Toplevel' ? printToplevel(node, ctx) : printExpression(node, ctx, 0);
}

function printToplevel(node: Node, ctx: PrintContext): string {
  const body = node.body as Node[];
  const separator = ctx.beautify ? '\n' : '';
  return body.map((stmt) => printStatement(stmt, ctx)).join(separator);
}

function printFunction(node: Node, ctx: PrintContext): string {
  const argnames = node.argnames as string[];
  return 'function(' + argnames.join(',') + ')' + printBlock(node.body as Node[], ctx);
}

function printObject(node: Node, ctx: PrintContext): string {
  const properties = node.properties as Node[];
  if (!properties.length) {
    return '{}';
  }
  if (!ctx.beautify) {
    return '{' + properties.map((property) => printObjectProperty(property, ctx)).join(',') + '}';
  }
  const inner = child(ctx);
  return '{\n' +
    properties.map((property) => indent(inner) + printObjectProperty(property, inner)).join(',\n') +
    '\n' + indent(ctx) + '}';
}

function printObjectProperty(node: Node, ctx: PrintContext): string {
  return stringLiteral(node.key as string) + ':' + (ctx.beautify ? ' ' : '') + printExpression(node.value as Node, ctx, 0);
}

function printExpression(node: Node, ctx: PrintContext, parentPrecedence: number): string {
  let text: string;
  let precedence = PREC_PRIMARY;
  switch (node.kind) {
    case 'String':
      text = stringLiteral(node.value as string);
      break;
    case 'Number':
      text = String(node.value);
      break;
    case 'RegExp':
      text = String(node.value);
      break;
    case 'True':
      text = 'true';
      break;
    case 'False':
      text = 'false';
      break;
    case 'This':
      text = 'this';
      break;
    case 'Symbol':
      text = node.name as string;
      break;
    case 'Object':
      text = printObject(node, ctx);
      break;
    case 'Function':
      text = printFunction(node, ctx);
      break;
    case 'Call': {
      precedence = PREC_CALL;
      const expression = node.expression as Node;
      const callee = expression.kind === 'Function'
        ? '(' + printExpression(expression, ctx, 0) + ')'
        : printExpression(expression, ctx, PREC_CALL);
      const args = (node.args as Node[]).map((arg) => printExpression(arg, ctx, 0)).join(',');
      text = callee + '(' + args + ')';
      break;
    }
    case 'New': {
      precedence = PREC_CALL;
      const args = (node.args as Node[]).map((arg) => printExpression(arg, ctx, 0)).join(',');
      text = 'new ' + printExpression(node.expression as Node, ctx, PREC_CALL) + '(' + args + ')';
      break;
    }
    case 'Dot': {
      precedence = PREC_MEMBER;
      const expression = node.expression as Node;
      const base = expression.kind === 'Function'
        ? '(' + printExpression(expression, ctx, 0) + ')'
        : printExpression(expression, ctx, PREC_MEMBER);
      text = base + '.' + node.property;
      break;
    }
    case 'Sub':
      precedence = PREC_MEMBER;
      text = printExpression(node.expression as Node, ctx, PREC_MEMBER) +
        '[' + printExpression(node.property as Node, ctx, 0) + ']';
      break;
    case 'Assign':
      precedence = PREC_ASSIGN;
      text = printExpression(node.left as Node, ctx, PREC_ASSIGN) +
        (node.operator as string) +
        printExpression(node.right as Node, ctx, PREC_ASSIGN);
      break;
    case 'Binary': {
      const operator = node.operator as string;
      precedence = binaryPrecedence(operator);
      const separator = ctx.beautify ? ' ' + operator + ' ' : operator;
      text = printExpression(node.left as Node, ctx, precedence) +
        separator +
        printExpression(node.right as Node, ctx, precedence + 1);
      break;
    }
    case 'UnaryPrefix': {
      precedence = PREC_UNARY;
      const operator = node.operator as string;
      text = operator + (/[a-z]$/i.test(operator) ? ' ' : '') +
        printExpression(node.expression as Node, ctx, PREC_UNARY);
      break;
    }
    case 'Conditional':
      precedence = PREC_CONDITIONAL;
      text = printExpression(node.condition as Node, ctx, PREC_CONDITIONAL) + '?' +
        printExpression(node.consequent as Node, ctx, 0) + ':' +
        printExpression(node.alternative as Node, ctx, 0);
      break;
    default:
      throw new Error('Unsupported PAC expression node: ' + node.kind);
  }
  return withComments(node, wrap(text, precedence, parentPrecedence), ctx);
}

function printBlock(body: Node[], ctx: PrintContext): string {
  if (!body.length) {
    return '{}';
  }
  if (!ctx.beautify) {
    return '{' + body.map((stmt) => printStatement(stmt, child(ctx))).join('') + '}';
  }
  const inner = child(ctx);
  return '{\n' +
    body.map((stmt) => indent(inner) + printStatement(stmt, inner)).join('\n') +
    '\n' + indent(ctx) + '}';
}

function statementAsBlock(node: Node, ctx: PrintContext): string {
  if (node.kind === 'BlockStatement') {
    return printStatement(node, ctx);
  }
  if (!ctx.beautify) {
    return '{' + printStatement(node, child(ctx)) + '}';
  }
  const inner = child(ctx);
  return '{\n' + indent(inner) + printStatement(node, inner) + '\n' + indent(ctx) + '}';
}

function printStatement(node: Node, ctx: PrintContext): string {
  let text: string;
  switch (node.kind) {
    case 'Directive':
      text = stringLiteral(node.value as string) + ';';
      break;
    case 'Return':
      text = 'return ' + printExpression(node.value as Node, ctx, 0) + ';';
      break;
    case 'Var':
      text = 'var ' + (node.definitions as Node[]).map((definition) => printVarDef(definition, ctx)).join(',') + ';';
      break;
    case 'SimpleStatement':
      text = printExpression(node.body as Node, ctx, 0) + ';';
      break;
    case 'BlockStatement':
      text = printBlock(node.body as Node[], ctx);
      break;
    case 'If':
      text = 'if(' + printExpression(node.condition as Node, ctx, 0) + ')' +
        (ctx.beautify ? ' ' : '') + statementAsBlock(node.body as Node, ctx);
      break;
    case 'Do':
      text = 'do' + statementAsBlock(node.body as Node, ctx) +
        'while(' + printExpression(node.condition as Node, ctx, 0) + ');';
      break;
    case 'Switch':
      text = printSwitch(node, ctx);
      break;
    case 'RawStatement':
      text = node.raw as string;
      break;
    default:
      text = printExpression(node, ctx, 0) + ';';
      break;
  }
  return withComments(node, text, ctx);
}

function printVarDef(node: Node, ctx: PrintContext): string {
  const value = node.value as Node | null;
  return node.name + (value ? '=' + printExpression(value, ctx, 0) : '');
}

function printSwitch(node: Node, ctx: PrintContext): string {
  const body = node.body as Node[];
  if (!ctx.beautify) {
    return 'switch(' + printExpression(node.expression as Node, ctx, 0) + '){' +
      body.map((item) => printSwitchBranch(item, child(ctx))).join('') +
      '}';
  }
  const inner = child(ctx);
  return 'switch(' + printExpression(node.expression as Node, ctx, 0) + ') {\n' +
    body.map((item) => indent(inner) + printSwitchBranch(item, inner)).join('\n') +
    '\n' + indent(ctx) + '}';
}

function printSwitchBranch(node: Node, ctx: PrintContext): string {
  const label = node.kind === 'Case'
    ? 'case ' + printExpression(node.expression as Node, ctx, 0) + ':'
    : 'default:';
  const body = node.body as Node[];
  if (!ctx.beautify) {
    return label + body.map((stmt) => printStatement(stmt, child(ctx))).join('');
  }
  const inner = child(ctx);
  return label + (body.length ? '\n' + body.map((stmt) => indent(inner) + printStatement(stmt, inner)).join('\n') : '');
}

export function addComment(node: Node, comment: string): Node {
  if (!node.comments) {
    node.comments = [];
  }
  node.comments.push(comment);
  return node;
}

export function compact(ast: Node): Node {
  return ast;
}

export function toplevel(body: Node[]): Node {
  return create('Toplevel', {body});
}

export function object(properties: Node[]): Node {
  return create('Object', {properties});
}

export function objectKeyVal(key: string, value: Node): Node {
  return create('ObjectKeyVal', {key, value});
}

export function rawStatement(raw: string): Node {
  return create('RawStatement', {raw});
}

export function fn(argnames: string[], body: Node[]): Node {
  return create('Function', {argnames, body});
}

export function str(value: string): Node {
  return create('String', {value});
}

export function num(value: number): Node {
  return create('Number', {value});
}

export function regexp(value: RegExp): Node {
  return create('RegExp', {value});
}

export function trueNode(): Node {
  return create('True');
}

export function falseNode(): Node {
  return create('False');
}

export function thisNode(): Node {
  return create('This');
}

export function symbol(name: string): Node {
  return create('Symbol', {name});
}

export function symbolVar(name: string): Node {
  return symbol(name);
}

export function directive(value: string): Node {
  return create('Directive', {value});
}

export function returnStmt(value: Node): Node {
  return create('Return', {value});
}

export function varDef(name: string, value: Node | null): Node {
  return create('VarDef', {name, value});
}

export function varStmt(definitions: Node[]): Node {
  return create('Var', {definitions});
}

export function call(expression: Node, args: Node[] = []): Node {
  return create('Call', {expression, args});
}

export function newExpr(expression: Node, args: Node[] = []): Node {
  return create('New', {expression, args});
}

export function dot(expression: Node, property: string): Node {
  return create('Dot', {expression, property});
}

export function sub(expression: Node, property: Node): Node {
  return create('Sub', {expression, property});
}

export function assign(left: Node, right: Node, operator = '='): Node {
  return create('Assign', {left, operator, right});
}

export function binary(left: Node, operator: string, right: Node): Node {
  return create('Binary', {left, operator, right});
}

export function unaryPrefix(operator: string, expression: Node): Node {
  return create('UnaryPrefix', {operator, expression});
}

export function conditional(condition: Node, consequent: Node, alternative: Node): Node {
  return create('Conditional', {condition, consequent, alternative});
}

export function block(body: Node[]): Node {
  return create('BlockStatement', {body});
}

export function simple(body: Node): Node {
  return create('SimpleStatement', {body});
}

export function ifStmt(condition: Node, body: Node): Node {
  return create('If', {condition, body});
}

export function doWhile(body: Node, condition: Node): Node {
  return create('Do', {body, condition});
}

export function switchStmt(expression: Node, body: Node[]): Node {
  return create('Switch', {expression, body});
}

export function caseStmt(expression: Node, body: Node[]): Node {
  return create('Case', {expression, body});
}

export function defaultStmt(body: Node[]): Node {
  return create('Default', {body});
}
