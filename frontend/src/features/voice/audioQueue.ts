/**
 * Plays audio clips one after another (the tutor's reply, sentence by sentence).
 * `clear()` stops at once — used when the learner interrupts.
 */
export class AudioQueue {
  private readonly audio = new Audio()
  private readonly clips: Blob[] = []
  private url: string | null = null
  private rate = 1
  private playing = false
  private readonly onChange: (playing: boolean) => void
  private readonly onError: (message: string) => void

  constructor(onChange: (playing: boolean) => void, onError: (message: string) => void) {
    this.onChange = onChange
    this.onError = onError
    this.audio.onended = () => this.next()
    this.audio.onerror = () => this.next()
  }

  get isPlaying(): boolean {
    return this.playing
  }

  enqueue(clip: Blob): void {
    this.clips.push(clip)
    if (!this.playing) this.next()
  }

  setRate(rate: number): void {
    this.rate = rate
    this.audio.playbackRate = rate
  }

  clear(): void {
    this.clips.length = 0
    this.audio.pause()
    this.release()
    this.setPlaying(false)
  }

  dispose(): void {
    this.clear()
    this.audio.onended = this.audio.onerror = null
  }

  private next(): void {
    this.release()
    const clip = this.clips.shift()
    if (!clip) {
      this.setPlaying(false)
      return
    }
    this.url = URL.createObjectURL(clip)
    this.audio.src = this.url
    this.audio.playbackRate = this.rate
    this.setPlaying(true)
    this.audio.play().catch((err: unknown) => {
      const blocked = err instanceof DOMException && err.name === 'NotAllowedError'
      this.clear()
      this.onError(blocked ? 'Your browser blocked audio. Press the microphone or send a message to continue.' : 'The reply could not be played.')
    })
  }

  private release(): void {
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
  }

  private setPlaying(playing: boolean): void {
    if (this.playing !== playing) {
      this.playing = playing
      this.onChange(playing)
    }
  }
}
