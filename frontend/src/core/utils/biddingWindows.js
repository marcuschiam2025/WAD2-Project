// Derive from timestamps so a window fetched before opening can become open without reloading.
export function roundStatus(round, now) {
  if (!round.closesAt)
    return { state: 'unconfigured', countdown: 'Not configured', label: 'Deadline not configured' };
  if (round.closesAt <= now) return { state: 'closed', countdown: 'Closed', label: 'Round closed' };
  const upcoming = round.opensAt > now;
  const deadline = upcoming ? round.opensAt : round.closesAt;
  const mins = Math.max(0, Math.floor((deadline - now) / 60_000));
  const countdown =
    mins >= 1440
      ? `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
      : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return {
    state: upcoming ? 'upcoming' : 'open',
    deadline,
    countdown,
    label: `${upcoming ? 'Opens' : 'Closes'} in ${countdown}`,
  };
}

// "Wed 4 Nov, 10:00" in Singapore time
export function sgtStamp(value) {
  const date = new Date(value);
  const part = (options) => date.toLocaleString('en-GB', { timeZone: 'Asia/Singapore', ...options });
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })}, ${part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
}

// The term's windows in order, each marked closed, open or upcoming at `now` (ms), with its own wording
export function windowsFor(term, now, windows) {
  return windows
    .filter((w) => w.term === term)
    .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt))
    .map((w) => {
      const state =
        now >= Date.parse(w.closesAt) ? 'closed' : now >= Date.parse(w.opensAt) ? 'open' : 'upcoming';
      const when = {
        closed: `Closed ${sgtStamp(w.closesAt)}`,
        open: `Closes ${sgtStamp(w.closesAt)}`,
        upcoming: `Opens ${sgtStamp(w.opensAt)}`,
      }[state];
      return {
        id: `${w.term}_${w.round}_W${w.window}`,
        name: `Round ${w.round} · Window ${w.window}`,
        state,
        when,
        inferred: !!w.inferred,
      };
    });
}
