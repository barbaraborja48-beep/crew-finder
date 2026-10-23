import { describe, expect, it } from 'vitest'
import { plain, sosSms, spotSms } from './sms'

describe('SMS fallback text', () => {
  it('uses only plain characters, so it fits the 160-character SMS format', () => {
    expect(plain('Brunch! · front L “phone dying” Iñaki ¡vamos!')).toBe('Brunch! - front L "phone dying" Inaki vamos!')
  })

  it('a long spot update still fits in one SMS', () => {
    const t = plain(spotSms({ name: 'Bárbara', where: 'Bar · by Brunch! & Entrada · right end', at: Date.now(), status: 'Lost', note: 'phone dying, by the speakers', battery: 12 }))
    expect(t.length).toBeLessThanOrEqual(160)
    expect(t).toMatch(/^Crew: Barbara is at Bar - by Brunch! & Entrada - right end \(\d\d:\d\d\)\. Lost, "phone dying, by the speakers", 12% battery\./)
  })

  it('SOS text says who, where and asks for help', () => {
    const t = plain(sosSms({ name: 'Ana', where: 'Water · by Food trucks', at: Date.now(), battery: 9 }))
    expect(t.length).toBeLessThanOrEqual(160)
    expect(t).toMatch(/^SOS from Ana: I need help\. Water - by Food trucks \(\d\d:\d\d\)\. 9% battery\. Please come or call me\.$/)
  })
})
