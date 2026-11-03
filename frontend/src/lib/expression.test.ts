import { describe, expect, it } from 'vitest'

import { ExpressionError, compileExpression, parseExpression } from './expression'

// Kept in step with backend/tests/test_diagram_unit.py: both sides accept and reject the same formulas.
const VALID = ['x^2 - 2*x + 1', 'sin(x)', '-x', '2*pi*x', 'sqrt(abs(x))', 'e^(-x^2)', 'ln(x) / log(10)', 'x**3', '.5*x', '((x))']
const INVALID = ['', '2x', 'x +', 'sin x', '(x', 'x)', 'y + 1', "__import__('os')", 'exp(x); 1', 'x == 1', 'lambda: x', 'open(x)', 'x[0]', '1e5']

describe('formula grammar', () => {
  it.each(VALID)('accepts %s', (source) => {
    expect(() => parseExpression(source)).not.toThrow()
  })

  it.each(INVALID)('rejects %s', (source) => {
    expect(() => parseExpression(source)).toThrow(ExpressionError)
  })
})

describe('evaluation', () => {
  const at = (source: string, x: number) => compileExpression(source)(x)

  it('follows the usual precedence', () => {
    expect(at('x^2 - 2*x + 1', 3)).toBe(4)
    expect(at('-x^2', 3)).toBe(-9) // the power binds tighter than the minus
    expect(at('2^3^2', 0)).toBe(512) // powers group to the right
    expect(at('1 + 2*3', 0)).toBe(7)
    expect(at('(1 + 2)*3', 0)).toBe(9)
    expect(at('8/4/2', 0)).toBe(1)
  })

  it('knows its functions and constants', () => {
    expect(at('sin(pi/2)', 0)).toBeCloseTo(1)
    expect(at('ln(e)', 0)).toBeCloseTo(1)
    expect(at('log(1000)', 0)).toBeCloseTo(3)
    expect(at('abs(x)', -4)).toBe(4)
  })

  it('gives NaN or infinity where the function is undefined', () => {
    expect(at('sqrt(x)', -1)).toBeNaN()
    expect(at('1/x', 0)).toBe(Infinity)
  })
})
