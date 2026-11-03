/**
 * Safe formulas in x for function graphs: a tiny parser and evaluator (never `eval`).
 * Same grammar as the backend's check (app/ai/diagram.py):
 *   expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ;
 *   unary := ('+'|'-') unary | power ; power := atom ('^' unary)? ;
 *   atom := number | 'x' | 'pi' | 'e' | fn '(' expr ')' | '(' expr ')'
 */

type Node =
  | { type: 'num'; value: number }
  | { type: 'x' }
  | { type: 'neg'; arg: Node }
  | { type: 'bin'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { type: 'fn'; name: FnName; arg: Node }

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
} as const
type FnName = keyof typeof FUNCTIONS

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }
const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z]+)|(\*\*|[-+*/^(),]))/y

export class ExpressionError extends Error {}

function tokenize(source: string): string[] {
  const text = source.trim()
  const tokens: string[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < text.length) {
    const start = TOKEN.lastIndex
    const match = TOKEN.exec(text)
    if (!match || TOKEN.lastIndex === start) throw new ExpressionError(`Unexpected character in "${source}"`)
    const [, number, name, op] = match
    if (name) {
      const lower = name.toLowerCase()
      if (!(lower in FUNCTIONS) && !(lower in CONSTANTS) && lower !== 'x') {
        throw new ExpressionError(`"${name}" isn't allowed in a formula`)
      }
      tokens.push(lower)
    } else {
      tokens.push(op === '**' ? '^' : (number ?? op))
    }
  }
  if (!tokens.length) throw new ExpressionError('A function needs a formula')
  return tokens
}

export function parseExpression(source: string): Node {
  const tokens = tokenize(source)
  let pos = 0
  const peek = () => tokens[pos]
  const take = (expected?: string) => {
    const token = tokens[pos]
    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw new ExpressionError(`"${source}" isn't a complete formula`)
    }
    pos += 1
    return token
  }

  const expr = (): Node => {
    let node = term()
    while (peek() === '+' || peek() === '-') {
      const op = take() as '+' | '-'
      node = { type: 'bin', op, left: node, right: term() }
    }
    return node
  }
  const term = (): Node => {
    let node = unary()
    while (peek() === '*' || peek() === '/') {
      const op = take() as '*' | '/'
      node = { type: 'bin', op, left: node, right: unary() }
    }
    return node
  }
  const unary = (): Node => {
    if (peek() === '-') {
      take()
      return { type: 'neg', arg: unary() }
    }
    if (peek() === '+') {
      take()
      return unary()
    }
    return power()
  }
  const power = (): Node => {
    const base = atom()
    if (peek() === '^') {
      take()
      return { type: 'bin', op: '^', left: base, right: unary() }
    }
    return base
  }
  const atom = (): Node => {
    const token = take()
    if (token in FUNCTIONS) {
      take('(')
      const arg = expr()
      take(')')
      return { type: 'fn', name: token as FnName, arg }
    }
    if (token === '(') {
      const inner = expr()
      take(')')
      return inner
    }
    if (token === 'x') return { type: 'x' }
    if (token in CONSTANTS) return { type: 'num', value: CONSTANTS[token] }
    if (/^(\d+(\.\d+)?|\.\d+)$/.test(token)) return { type: 'num', value: Number(token) }
    throw new ExpressionError(`"${source}" isn't a valid formula`)
  }

  const tree = expr()
  if (pos !== tokens.length) throw new ExpressionError(`"${source}" has something extra at the end`)
  return tree
}

function evaluate(node: Node, x: number): number {
  switch (node.type) {
    case 'num':
      return node.value
    case 'x':
      return x
    case 'neg':
      return -evaluate(node.arg, x)
    case 'fn':
      return FUNCTIONS[node.name](evaluate(node.arg, x))
    case 'bin': {
      const a = evaluate(node.left, x)
      const b = evaluate(node.right, x)
      switch (node.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return a / b
        case '^':
          return a ** b
      }
    }
  }
}

/** Compile a formula to a function of x (NaN where undefined, e.g. sqrt of a negative). */
export function compileExpression(source: string): (x: number) => number {
  const tree = parseExpression(source)
  return (x: number) => evaluate(tree, x)
}
