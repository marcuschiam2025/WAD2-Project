let client;
// This scope can view/edit calendar events; BidMaxxer currently uses it to add selected class events.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
let calendarToken = null;
let calendarRevision = 0;
export async function firebaseClient() {
  if (!client)
    client = (async () => {
      const [{ initializeApp, getApps }, sdk] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      };
      if (Object.values(config).some((value) => !value))
        throw new Error('Firebase sign-in is not configured. Check frontend/.env.local and restart Vite.');
      return { ...sdk, auth: sdk.getAuth(getApps()[0] ?? initializeApp(config)) };
    })().catch((error) => {
      client = null;
      throw error;
    });
  return client;
}
export const authClient = {
  async observe(callback, onError) {
    const sdk = await firebaseClient();
    return sdk.onAuthStateChanged(sdk.auth, callback, onError);
  },
  async signIn() {
    const sdk = await firebaseClient();
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return (await sdk.signInWithPopup(sdk.auth, provider)).user;
  },
  // Asks Google for permission to add events to the signed-in student's own calendar and returns an
  // OAuth access token for it. Call it straight from a click so the popup isn't blocked. Google access
  // tokens last about an hour; this one is kept in memory only, so a later export may ask again.
  async calendarAccessToken() {
    const sdk = await firebaseClient();
    const user = sdk.auth.currentUser;
    if (!user) throw new Error('Sign in before adding classes to Google Calendar.');
    if (calendarToken?.uid === user.uid && calendarToken.expires > Date.now()) return calendarToken.value;
    const revision = calendarRevision;
    const provider = new sdk.GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);
    provider.setCustomParameters({ login_hint: user.email ?? '' });
    const result = await sdk.reauthenticateWithPopup(user, provider);
    if (
      revision !== calendarRevision ||
      sdk.auth.currentUser?.uid !== user.uid ||
      result.user?.uid !== user.uid
    )
      throw new Error('Calendar access was cancelled because your signed-in account changed. Try again.');
    const value = sdk.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!value) throw new Error('Google did not return calendar access. Please try again.');
    calendarToken = { uid: user.uid, value, expires: Date.now() + 50 * 60 * 1000 };
    return value;
  },
  // After Google refuses the token (e.g. the calendar box was unticked), so the next try asks again
  forgetCalendarToken() {
    calendarRevision++;
    calendarToken = null;
  },
  async signOut() {
    calendarRevision++;
    calendarToken = null;
    const sdk = await firebaseClient();
    await sdk.signOut(sdk.auth);
  },
};
