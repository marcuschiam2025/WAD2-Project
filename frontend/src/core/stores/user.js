import { defineStore } from 'pinia'
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
  // balance: the student's current e$ (e-credit) balance.
  // TODO(Backend 2): PATCH /api/users/me with these fields
  function completeOnboarding({ major, tracks, currentSem, takenBySem = {}, balance: eCredits }) {
    profile.value = {
      ...profile.value,
      major,
      tracks,
      currentSem,
      year: Number(currentSem.match(/\d/)[0]),
      takenBySem,
      completed: Object.values(takenBySem).flat(),
    }
    if (eCredits != null) balance.value = eCredits
    onboarded.value = true
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
    revokeAccess,
  }
})
