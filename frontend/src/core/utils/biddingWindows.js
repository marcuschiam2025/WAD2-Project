import { BIDDING_WINDOWS } from '../data/biddingWindows.js'

// "Wed 4 Nov, 10:00" in Singapore time
export function sgtStamp(value) {
  const date = new Date(value)
  const part = (options) => date.toLocaleString('en-GB', { timeZone: 'Asia/Singapore', ...options })
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })}, ${part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
}

// The term's windows in order, each marked closed, open or upcoming at `now` (ms), with its own wording
export function windowsFor(term, now, windows = BIDDING_WINDOWS) {
  return windows
    .filter((w) => w.term === term)
    .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt))
    .map((w) => {
      const state = now >= Date.parse(w.closesAt) ? 'closed' : now >= Date.parse(w.opensAt) ? 'open' : 'upcoming'
      const when = { closed: `Closed ${sgtStamp(w.closesAt)}`, open: `Closes ${sgtStamp(w.closesAt)}`, upcoming: `Opens ${sgtStamp(w.opensAt)}` }[state]
      return { id: `${w.term}_${w.round}_W${w.window}`, name: `Round ${w.round} · Window ${w.window}`, state, when, inferred: !!w.inferred }
    })
}
