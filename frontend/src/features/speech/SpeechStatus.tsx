import { Check, LoaderCircle, Minus } from 'lucide-react'

import { Badge } from '../../components/ui/feedback'
import type { SpeechProviderInfo } from '../../lib/api/types'
import { useSpeechInfo } from './useSpeechInfo'

function ProviderRow({ label, info }: { label: string; info: SpeechProviderInfo }) {
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{label}</span>
        {!info.available ? (
          <Badge tone="danger">Unavailable</Badge>
        ) : info.is_mock ? (
          <Badge tone="sun" title="Placeholder speech for development. Gnani is not connected yet.">
            Mock
          </Badge>
        ) : (
          <Badge tone="success">Ready</Badge>
        )}
      </div>
      <p className="text-sm text-muted">
        Provider: <span className="capitalize">{info.provider}</span>
        {info.unavailable_reason && <> · {info.unavailable_reason}</>}
      </p>
    </li>
  )
}

function Supported({ yes, what }: { yes: boolean; what: string }) {
  return yes ? (
    <Check className="mx-auto size-4" aria-label={`${what} supported`} />
  ) : (
    <Minus className="mx-auto size-4 text-muted" aria-label={`${what} not supported`} />
  )
}

/** Live speech provider status and per-language support, from GET /speech/info. */
export function SpeechStatus() {
  const { data, isPending, isError, error } = useSpeechInfo()

  if (isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Checking speech services…
      </p>
    )
  }
  if (isError) {
    return (
      <p role="alert" className="text-sm text-[#b42318] dark:text-rose">
        Couldn't check speech services: {error.message}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-3">
        <ProviderRow label="Speech recognition" info={data.stt} />
        <ProviderRow label="Read-aloud" info={data.tts} />
      </ul>
      <table className="w-full text-sm">
        <caption className="sr-only">Language support</caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="py-1 font-medium">Language</th>
            <th scope="col" className="py-1 text-center font-medium">Tutor</th>
            <th scope="col" className="py-1 text-center font-medium">Voice input</th>
            <th scope="col" className="py-1 text-center font-medium">Read-aloud</th>
          </tr>
        </thead>
        <tbody>
          {data.languages.map((lang) => (
            <tr key={lang.code} className="border-t border-line">
              <th scope="row" className="py-1.5 text-left font-medium">{lang.name}</th>
              <td><Supported yes={lang.tutor} what={`${lang.name} tutor`} /></td>
              <td><Supported yes={lang.stt} what={`${lang.name} speech recognition`} /></td>
              <td><Supported yes={lang.tts} what={`${lang.name} read-aloud`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
