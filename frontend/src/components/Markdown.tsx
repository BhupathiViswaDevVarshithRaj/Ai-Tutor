import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { parseBlocks } from '../lib/markdown'
import { cn } from './ui/cn'

/** Safe Markdown for tutor replies. Builds React elements only; never injects HTML. */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g

function renderInline(text: string): ReactNode {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1)
      return (
        <code key={i} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      )
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn('space-y-3 leading-relaxed', className)}>
      {parseBlocks(source).map((block, i) => {
        switch (block.kind) {
          case 'h':
            return (
              <p key={i} className={cn('font-display font-bold', block.level <= 2 ? 'text-lg' : 'text-base')}>
                {renderInline(block.text)}
              </p>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-brand-500">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:font-bold marker:text-brand-500">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            )
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-2xl bg-[#1f1b2d] p-4 font-mono text-sm text-[#fbf6ec]">
                <code>{block.text}</code>
              </pre>
            )
          default:
            return <p key={i}>{renderInline(block.text)}</p>
        }
      })}
    </div>
  )
}
