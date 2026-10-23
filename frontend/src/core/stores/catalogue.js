import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api'
import { liveModules } from '../data/catalogue'

// The backend's module and major catalogue. Loaded once; while the backend is unreachable,
// liveModules stays empty and everything falls back to the sample catalogue in core/data.
export const useCatalogueStore = defineStore('catalogue', () => {
  const online = ref(false)
  const majors = ref([])
  let loading = null

  function load() {
    loading ??= Promise.all([api.modules(), api.majors()])
      .then(([mods, majorList]) => {
        mods.forEach((m) => (liveModules[m._id] = m))
        majors.value = majorList
        online.value = true
      })
      .catch(() => {
        loading = null // try again next time
      })
    return loading
  }

  // The catalogue id of a major from its name (e.g. 'Information Systems' -> 'BSC-IS_AY2025'):
  // the newest curriculum that has graduation requirements, or the newest one at all
  function majorIdFor(name) {
    const matching = majors.value.filter((m) => m.name === name).sort((a, b) => b.intakeFrom - a.intakeFrom)
    return (matching.find((m) => m.requirementsAvailable) ?? matching[0])?._id ?? null
  }

  // Module search for the What-If Planner: code or title, like GET /api/modules?q=
  async function search(q, limit = 8) {
    const mods = await api.modules({ q, limit })
    mods.forEach((m) => (liveModules[m._id] ??= m))
    return mods.map((m) => ({ code: m._id, name: m.title }))
  }

  return { online, majors, load, majorIdFor, search }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useCatalogueStore, import.meta.hot))
