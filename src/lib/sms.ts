// Text-message fallback. SMS gets through on signal too weak for data, as long
// as the message is plain enough to fit one 160-character SMS.
import { isIOS } from './view'

/** Strip anything that would force the slower 70-character SMS encoding. */
export const plain = (s: string) =>
  s
    .replace(/·/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Opens Messages with the text filled in; you pick who it goes to. */
export const smsHref = (body: string) => `sms:${isIOS() ? '&' : '?'}body=${encodeURIComponent(plain(body).slice(0, 160))}`

const clock = (t: number) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function spotSms(o: { name: string; where: string; at: number; status?: string; note?: string; battery?: number | null }) {
  const extra = [o.status && o.status !== 'Vibing' ? o.status : '', o.note ? `"${o.note}"` : '', o.battery != null ? `${o.battery}% battery` : '']
    .filter(Boolean)
    .join(', ')
  return `Crew: ${o.name} is at ${o.where} (${clock(o.at)}).${extra ? ` ${extra}.` : ''} No data here, so texting.`
}

export function sosSms(o: { name: string; where: string; at: number; battery?: number | null }) {
  return `SOS from ${o.name}: I need help. ${o.where} (${clock(o.at)}).${o.battery != null ? ` ${o.battery}% battery.` : ''} Please come or call me.`
}
