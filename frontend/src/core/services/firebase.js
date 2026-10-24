let client
export async function firebaseClient() {
  if (!client) client = (async () => {
    const [{ initializeApp, getApps }, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')])
    const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN }
    if (Object.values(config).some(value => !value)) throw new Error('Firebase sign-in is not configured. Check frontend/.env.local and restart Vite.')
    return { ...sdk, auth: sdk.getAuth(getApps()[0] ?? initializeApp(config)) }
  })().catch(error => { client = null; throw error })
  return client
}
export const authClient = {
  async observe(callback, onError) {
    const sdk = await firebaseClient()
    return sdk.onAuthStateChanged(sdk.auth, callback, onError)
  },
  async signIn() {
    const sdk = await firebaseClient()
    const provider = new sdk.GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account', hd: 'smu.edu.sg' })
    return (await sdk.signInWithPopup(sdk.auth, provider)).user
  },
  async signOut() {
    const sdk = await firebaseClient()
    await sdk.signOut(sdk.auth)
  },
}
