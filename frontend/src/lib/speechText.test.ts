import { describe, expect, it } from 'vitest'

import { splitForSpeech, toSpeechText } from './speechText'

describe('toSpeechText', () => {
  it('reads Markdown as plain sentences and skips code', () => {
    const md = '## Light reactions\nPlants use **sunlight** and `chlorophyll`.\n\n- water\n- carbon dioxide\n\n```\nx = 1\n```\n\nSee [the diagram](http://x).'
    expect(toSpeechText(md)).toBe(
      'Light reactions. Plants use sunlight and chlorophyll. water. carbon dioxide. See the diagram.',
    )
  })

  it('keeps existing sentence endings, including the danda', () => {
    expect(toSpeechText('पौधे भोजन बनाते हैं।\n\nWhat next?')).toBe('पौधे भोजन बनाते हैं। What next?')
  })
})

describe('splitForSpeech', () => {
  it('packs whole sentences into pieces up to the limit', () => {
    expect(splitForSpeech('One two. Three four! Five six?', 20)).toEqual(['One two. Three four!', 'Five six?'])
  })

  it('splits after the Devanagari danda', () => {
    expect(splitForSpeech('पहला वाक्य। दूसरा वाक्य।', 15)).toEqual(['पहला वाक्य।', 'दूसरा वाक्य।'])
  })

  it('breaks an over-long sentence between words', () => {
    const pieces = splitForSpeech('alpha beta gamma delta epsilon', 12)
    expect(pieces).toEqual(['alpha beta', 'gamma delta', 'epsilon'])
    expect(pieces.every((p) => p.length <= 12)).toBe(true)
  })

  it('returns nothing for empty text', () => {
    expect(splitForSpeech('   ')).toEqual([])
  })
})
