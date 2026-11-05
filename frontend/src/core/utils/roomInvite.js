// Shareable join links: /rooms?join=CODE opens the join dialog with the code filled in. A friend who isn't signed in
// has to sign in (and maybe onboard) first, so the code is kept for this tab until they reach the app.
const KEY = 'bidmaxxer:pendingJoin';

export const inviteLink = (code, origin = window.location.origin) =>
  `${origin}/rooms?join=${encodeURIComponent(code)}`;

export function rememberJoin(code) {
  try {
    sessionStorage.setItem(KEY, String(code));
  } catch {
    // storage blocked: they can still type the code
  }
}

// Returns the kept code once, then forgets it
export function takeJoin() {
  try {
    const code = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
