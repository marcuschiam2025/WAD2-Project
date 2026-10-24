import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, setToken, setTokenProvider } from '../services/api'
import { authClient } from '../services/firebase'

const blankProfile = () => ({ firstName: '', displayName: '', initials: '', email: '', major: 'Information Systems', tracks: [], year: 1, completed: [], exempted: [], takenBySem: {}, markedDone: [] })
export const useUserStore = defineStore('user', () => {
  const isSignedIn = ref(false), uid = ref(null), onboarded = ref(false)
  const profile = ref(blankProfile()), balance = ref(210), consents = ref({ gmail: false, outlook: false })
  const error = ref(''), busy = ref(false)
  let initialized, loadingIdentity
  let revision = 0
  const degreeLabel = computed(() => `BSc ${profile.value.major} · Y${profile.value.year}`)
  function clear() {
    revision++
    setToken(null)
    setTokenProvider(null)
    isSignedIn.value = false
    uid.value = null
    onboarded.value = false
    profile.value = blankProfile()
    balance.value = 210
    consents.value = { gmail: false, outlook: false }
    localStorage.removeItem('bidmaxxer:user')
  }
  function apply(data) {
    const name = data.name || data.email?.split('@')[0] || 'Student'
    profile.value = { ...blankProfile(), ...data, displayName: name, firstName: name.split(' ')[0], initials: name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(), year: data.yearOfStudy ?? 1, completed: data.completedModules ?? [], appliedToPlans: true }
    balance.value = data.balance ?? 210
    consents.value = data.consents ?? { gmail: false, outlook: false }
    onboarded.value = data.onboarded === true
  }
  async function loadIdentity(identity) {
    if (!identity) { clear(); return }
    if (uid.value === identity.uid && isSignedIn.value) return
    if (loadingIdentity?.uid === identity.uid) return loadingIdentity.promise
    clear()
    const version = revision
    uid.value = identity.uid
    setTokenProvider(() => identity.getIdToken())
    const promise = Promise.resolve().then(async () => {
      try {
        const data = await api.me()
        if (version !== revision) return
        apply(data)
        isSignedIn.value = true
        error.value = ''
      } catch (failure) {
        if (version === revision) { clear(); error.value = failure.message; throw failure }
      } finally { if (loadingIdentity?.promise === promise) loadingIdentity = null }
    })
    loadingIdentity = { uid: identity.uid, promise }
    return promise
  }
  function initialize() {
    if (!initialized) initialized = new Promise(resolve => {
      authClient.observe(identity => { loadIdentity(identity).catch(() => {}).finally(resolve) }, failure => {
        clear(); error.value = failure.message; resolve()
      }).catch(failure => { clear(); error.value = failure.message; resolve() })
    })
    return initialized
  }
  async function signIn() {
    busy.value = true
    error.value = ''
    try {
      await loadIdentity(await authClient.signIn())
      if (!isSignedIn.value) throw new Error('Sign-in was interrupted. Please try again.')
    } catch (failure) {
      error.value = failure.code === 'auth/popup-closed-by-user' ? 'Sign-in was cancelled. You can try again.' : failure.message
      throw failure
    } finally { busy.value = false }
  }
  async function signOut() {
    clear()
    try { await authClient.signOut() } catch (failure) { error.value = `Local session cleared, but Google sign-out failed: ${failure.message}` }
  }
  async function save(changes) {
    const version = revision
    const data = await api.updateMe(changes)
    if (version !== revision) throw new Error('Your account changed. Please sign in again before saving.')
    apply(data)
    return data
  }
  async function completeOnboarding(details) {
    await save({ ...details, onboarded: true })
    profile.value.appliedToPlans = false
  }
  async function markDone(id) {
    try { await save({ markedDone: [...new Set([...(profile.value.markedDone ?? []), id])] }) } catch (failure) { error.value = failure.message }
  }
  async function unmarkDone(id) {
    try { await save({ markedDone: (profile.value.markedDone ?? []).filter(done => done !== id) }) } catch (failure) { error.value = failure.message }
  }
  async function revokeAccess() {
    try { await save({ consents: { gmail: false, outlook: false } }) } catch (failure) { error.value = failure.message }
  }
  return { isSignedIn, uid, onboarded, profile, balance, consents, error, busy, degreeLabel, initialize, signIn, signOut, completeOnboarding, markDone, unmarkDone, revokeAccess }
})
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
