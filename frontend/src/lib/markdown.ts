/** Block-level parser for the minimal Markdown subset used by tutor replies. */

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'code'; text: string }

const UL = /^\s*[-*•]\s+(.*)$/
const OL = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^(#{1,4})\s+(.*)$/

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      flushParagraph()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++])
      blocks.push({ kind: 'code', text: code.join('\n') })
      continue
    }
    const heading = HEADING.exec(line)
    const ul = UL.exec(line)
    const ol = OL.exec(line)
    if (heading) {
      flushParagraph()
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] })
    } else if (ul || ol) {
      flushParagraph()
      const kind = ul ? 'ul' : 'ol'
      const last = blocks.at(-1)
      const item = (ul ?? ol)![1]
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else if (!line.trim()) {
      flushParagraph()
    } else {
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  return blocks
}

