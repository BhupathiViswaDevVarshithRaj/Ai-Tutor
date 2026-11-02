import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Markdown } from '../components/Markdown'
import { parseBlocks } from './markdown'

describe('parseBlocks', () => {
  it('splits paragraphs, headings, lists and code', () => {
    const blocks = parseBlocks(
      '## Title\nLine one\nline two\n\n- a\n- b\n\n1. first\n2. second\n\n```\nx = 1\n```',
    )
    expect(blocks).toEqual([
      { kind: 'h', level: 2, text: 'Title' },
      { kind: 'p', text: 'Line one line two' },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'ol', items: ['first', 'second'] },
      { kind: 'code', text: 'x = 1' },
    ])
  })
})

describe('Markdown', () => {
  it('renders inline formatting', () => {
    render(<Markdown source={'A **bold** idea with *care* and `code`.'} />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('care').tagName).toBe('EM')
    expect(screen.getByText('code').tagName).toBe('CODE')
  })

  it('never interprets HTML from model output', () => {
    const { container } = render(<Markdown source={'<img src=x onerror="alert(1)"> <b>hi</b>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)"> <b>hi</b>')
  })
})
