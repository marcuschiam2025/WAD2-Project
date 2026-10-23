import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'bidmaxxer:user'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

export const useUserStore = defineStore('user', () => {
  const saved = load()

  const isSignedIn = ref(saved.isSignedIn ?? false)
  const onboarded = ref(saved.onboarded ?? false)
  const profile = ref(
    saved.profile ?? {
      firstName: 'Vignesh',
      displayName: 'Vignesh S.',
      initials: 'VS',
      email: 'vignesh.s.2023@smu.edu.sg',
      major: 'Information Systems',
      tracks: ['BA'],
      year: 3,
    },
  )
  const balance = ref(saved.balance ?? 1240)
  const consents = ref(saved.consents ?? { gmail: true, outlook: false })

  const degreeLabel = computed(() => `BSc ${profile.value.major} · Y${profile.value.year}`)

  // TODO(Backend 2): replace with Firebase Google sign-in, then POST the ID token to /api/users/me
  function signIn() {
    isSignedIn.value = true
  }

  function signOut() {
    isSignedIn.value = false
  }

  // currentSem: the semester the student is in now, e.g. 'Y2S1'.
  // takenBySem: modules already taken, by semester, e.g. { Y1S1: ['IS111'], Y1S2: ['IS112'] }.
  // exempted: modules the student is exempted from (they count as cleared, with no semester).
  // freeExemptions: how many free electives they are exempted from (e.g. diploma credit), not tied to a module.
  // balance: the student's current e$ (e-credit) balance.
  // TODO(Backend 2): PATCH /api/users/me with these fields
  function completeOnboarding({ major, tracks, currentSem, takenBySem = {}, exempted = [], freeExemptions = 0, balance: eCredits }) {
    profile.value = {
      ...profile.value,
      major,
      tracks,
      currentSem,
      year: Number(currentSem.match(/\d/)[0]),
      takenBySem,
      completed: Object.values(takenBySem).flat(),
      exempted,
      freeExemptions,
      // the planner copies these answers into the student's existing plans, then sets this to true
      appliedToPlans: false,
    }
    if (eCredits != null) balance.value = eCredits
    onboarded.value = true
  }

  // Internship / Community Service / Global Exposure, done outside of modules (ids from MARK_DONE in data/degree.js)
  function markDone(id) {
    const done = profile.value.markedDone ?? []
    if (!done.includes(id)) profile.value.markedDone = [...done, id]
  }

  function unmarkDone(id) {
    profile.value.markedDone = (profile.value.markedDone ?? []).filter((d) => d !== id)
  }

  function revokeAccess() {
    consents.value = { gmail: false, outlook: false }
  }

  watch(
    [isSignedIn, onboarded, profile, balance, consents],
    () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          isSignedIn: isSignedIn.value,
          onboarded: onboarded.value,
          profile: profile.value,
          balance: balance.value,
          consents: consents.value,
        }),
      )
    },
    { deep: true },
  )

  return {
    isSignedIn,
    onboarded,
    profile,
    balance,
    consents,
    degreeLabel,
    signIn,
    signOut,
    completeOnboarding,
    markDone,
    unmarkDone,
    revokeAccess,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
