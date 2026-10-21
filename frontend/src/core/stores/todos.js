import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'bidmaxxer:todos'

// Starter items for a student who has not written any yet.
// TODO(Backend 2): GET / POST / PATCH / DELETE /api/users/me/todos
const sample = [
  { id: 1, text: 'Confirm KAIST exchange mapping', done: false },
  { id: 2, text: 'Pick sections for IS442 with the Yappers room', done: false },
  { id: 3, text: 'Check which Year 2 prerequisites are still open', done: true },
]

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : null
  } catch {
    return null
  }
}

export const useTodosStore = defineStore('todos', () => {
  const items = ref(load() ?? structuredClone(sample))
  let nextId = Math.max(0, ...items.value.map((i) => i.id)) + 1

  function add(text) {
    const t = text.trim()
    if (t) items.value.push({ id: nextId++, text: t, done: false })
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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
      } catch {
        // storage can be full or blocked; the list still works for this session
      }
    },
    { deep: true },
  )

  return { items, add, toggle, remove, clearDone }
})
