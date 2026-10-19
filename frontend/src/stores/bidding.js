import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { bidHistory, sections, slots, days } from '../data/bidding'

export const useBiddingStore = defineStore('bidding', () => {
  // module code -> booked section id
  const booked = ref({
    IS212: 'IS212-G3',
    IS213: 'IS213-G1',
    IS214: 'IS214-G2',
    IS215: 'IS215-G5',
    COR3001: 'COR3001-G12',
    IS442: 'IS442-G1',
  })
  // module code -> e$ bid
  const bids = ref({ IS212: 42, IS213: 30, IS214: 22, IS215: 18, COR3001: 36, IS442: 20 })
  const selectedModule = ref(null)
  const savedAt = ref(null)

  const bookedSections = computed(() =>
    Object.values(booked.value).map((id) => sections.find((s) => s.id === id)),
  )
  const allocated = computed(() => Object.values(bids.value).reduce((a, b) => a + (Number(b) || 0), 0))

  function sectionsFor(code) {
    return sections.filter((s) => s.module === code)
  }

  // Booked sections that share a day + slot with another booked section
  const clashes = computed(() => {
    const seen = {}
    bookedSections.value.forEach((s) => {
      const key = `${s.day}-${s.slot}`
      seen[key] = [...(seen[key] ?? []), s.id]
    })
    return new Set(Object.values(seen).filter((ids) => ids.length > 1).flat())
  })

  function swapSection(code, sectionId) {
    booked.value[code] = sectionId
  }

  function setBid(code, amount) {
    bids.value[code] = amount
  }

  // TODO(Backend 3): PUT /api/bidding/cart
  function save() {
    savedAt.value = new Date()
  }

  function slotLabel(s) {
    return `${days[s.day]} · ${slots[s.slot].start}–${slots[s.slot].end}`
  }

  return {
    booked,
    bids,
    selectedModule,
    savedAt,
    bookedSections,
    allocated,
    clashes,
    bidHistory,
    sectionsFor,
    swapSection,
    setBid,
    save,
    slotLabel,
  }
})
