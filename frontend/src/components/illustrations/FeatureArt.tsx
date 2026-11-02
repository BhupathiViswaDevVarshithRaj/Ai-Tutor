import type { ReactElement } from 'react'

import { Headphones, Microphone } from './Audio'
import { GlobeTalk, MindMapArt, QuizCard, Trophy, VideoThumb, WhiteboardArt } from './Visual'
import { Notebook } from './Books'
import { PhoneChat } from './Devices'
import { RobotTutor } from './Robot'

/** The illustration that represents each workspace route. */
const ART: Record<string, (className?: string) => ReactElement> = {
  '/app/tutor': (c) => (
    <div className={`relative ${c ?? ''}`}>
      <RobotTutor className="w-3/5" />
      <PhoneChat className="absolute right-0 bottom-0 w-2/5 rotate-6" />
    </div>
  ),
  '/app/languages': (c) => <GlobeTalk className={c} />,
  '/app/voice': (c) => (
    <div className={`relative ${c ?? ''}`}>
      <Microphone className="w-1/2" />
      <Headphones className="absolute right-0 bottom-0 w-1/2" />
    </div>
  ),
  '/app/mind-maps': (c) => <MindMapArt className={c} />,
  '/app/whiteboard': (c) => <WhiteboardArt className={c} />,
  '/app/videos': (c) => <VideoThumb className={c} scene="science" />,
  '/app/quizzes': (c) => <QuizCard className={c} />,
  '/app/progress': (c) => <Trophy className={c} />,
  '/app/history': (c) => <Notebook className={c} />,
}

export function FeatureArt({ to, className }: { to: string; className?: string }) {
  const render = ART[to]
  return render ? render(className) : null
}
