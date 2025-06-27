import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function toTimeString(minutes: number) {
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  const suffix = hh >= 12 ? 'pm' : 'am'
  const hour12 = hh % 12 === 0 ? 12 : hh % 12
  return `${hour12}:${String(mm).padStart(2, '0')}${suffix}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { date, party_size } = req.body
  if (!date || !party_size) return res.status(400).json({ error: 'Missing date or party_size' })

  // 1) Load base time ranges for this weekday
  const day = new Date(date).getDay().toString()
  const { data: hours, error: hourErr } = await supabase
    .from('venue_hours')
    .select('time_ranges')
    .eq('type', 'base')
    .eq('day_of_week', day)
    .single()
  if (hourErr || !hours?.time_ranges) return res.status(500).json({ error: hourErr?.message })

  // 2) Build all 15-min slots
  const duration = party_size <= 2 ? 90 : 120
  const slots: { start: string, end: string, label: string }[] = []
  for (const { start, end } of hours.time_ranges) {
    let [h0, m0] = start.split(':').map(Number)
    let [h1, m1] = end.split(':').map(Number)
    let cursor = h0 * 60 + m0, limit = h1 * 60 + m1
    while (cursor + duration <= limit) {
      const slotStart = new Date(date)
      slotStart.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0)
      const slotEnd = new Date(slotStart.getTime() + duration * 60000)
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        label: toTimeString(cursor)
      })
      cursor += 15
    }
  }

  // 3) Query all reservations for that date in one go
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('start_time, end_time')
    .gte('start_time', dayStart.toISOString())
    .lte('end_time', dayEnd.toISOString())

  if (resErr) return res.status(500).json({ error: resErr?.message })

  // 4) Filter out slots that conflict
  const free = slots.filter(slot => {
    return !reservations.some(conflict =>
      new Date(slot.start) < new Date(conflict.end_time) &&
      new Date(slot.end) > new Date(conflict.start_time)
    )
  }).map(slot => slot.label)

  return res.status(200).json({ slots: free })
} 