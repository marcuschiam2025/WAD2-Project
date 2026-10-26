import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useUserStore } from './user'

function load(key) {
  if (!key) return []
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    if (!Array.isArray(saved)) return []
    const valid = saved.every(i => i && Number.isSafeInteger(i.id) && i.id > 0 && i.id < Number.MAX_SAFE_INTEGER && typeof i.text === 'string' && typeof i.done === 'boolean')
    return valid && new Set(saved.map(i => i.id)).size === saved.length ? saved : []
  } catch {
    return []
  }
}

export const useTodosStore = defineStore('todos', () => {
  const user = useUserStore()
  const storageKey = computed(() => user.isSignedIn && user.uid ? `bidmaxxer:todos:${user.uid}` : null)
  const items = ref([])
  let nextId = 1
  // The old shared key has no account owner, so it cannot be safely imported.
  watch(storageKey, key => {
    items.value = load(key)
    nextId = items.value.reduce((max, i) => Math.max(max, i.id), 0) + 1
  }, { immediate: true, flush: 'sync' })

  function add(text) {
    if (!storageKey.value) return
    const t = text.trim()
    if (t) items.value.push({ id: nextId++, text: t.slice(0, 120), done: false })
  }

  function toggle(id) {
    const item = items.value.find((i) => i.id === id)
    if (item) item.done = !item.done
  }

  function remove(id) {
    items.value = items.value.filter((i) => i.id !== id)
  }

  function clearDone() {
    items.value = items.value.filter((i) => !i.done)
  }

  watch(
    items,
    () => {
      if (!storageKey.value) return
      try {
        localStorage.setItem(storageKey.value, JSON.stringify(items.value))
      } catch {
        // storage can be full or blocked; the list still works for this session
      }
    },
    { deep: true, flush: 'sync' },
  )

  return { items, add, toggle, remove, clearDone }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTodosStore, import.meta.hot))
