import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useUserStore } from './user'
import { useBiddingStore } from './bidding'
import { api } from '../services/api'
import { authClient } from '../services/firebase'
import { buildIcs, hasTeachingDates } from '../utils/ics'

function googleError(error) {
  if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return 'Google Calendar access was cancelled.'
  if (error.code === 'auth/popup-blocked') return 'Your browser blocked the Google popup. Allow popups for this site and try again.'
  if (error.code === 'auth/user-mismatch') return 'Choose the Google account you signed in to BidMaxxer with.'
  return error.message
}

export const useCalendarExportStore = defineStore('calendarExport', () => {
  const user = useUserStore(), bidding = useBiddingStore()
  const adding = ref(null), error = ref(''), message = ref('')
  let revision = 0
  function cancel() {
    revision++
    adding.value = null
    error.value = ''
    message.value = ''
  }
  watch(() => [user.uid, user.isSignedIn, bidding.round.term], cancel, { flush: 'sync' })

  async function addToGoogle(copy, termStart, weeks) {
    if (adding.value !== null) return false
    error.value = ''; message.value = ''
    if (!user.isSignedIn || !user.uid || !bidding.round.term) {
      error.value = 'Sign in and select a catalogue term before exporting.'
      return false
    }
    const version = revision
    const name = copy.name
    adding.value = copy.id
    try {
      const sections = copy.items.map(item => item.section).filter(Boolean)
      // Validate the same calendar data as the download before requesting Google permission.
      buildIcs(sections, termStart, weeks)
      const ids = sections.map(section => section.id)
      const start = sections.some(section => !hasTeachingDates(section)) ? termStart : ''
      const token = await authClient.calendarAccessToken()
      if (version !== revision) return false
      const { created } = await api.exportCalendar(token, ids, start, weeks)
      if (version !== revision) return false
      message.value = `Added ${created} weekly class series from ${name} to your Google Calendar.`
      return true
    } catch (failure) {
      if (version !== revision) return false
      if (/not granted/.test(failure.message)) authClient.forgetCalendarToken()
      error.value = googleError(failure)
      return false
    } finally {
      if (version === revision) adding.value = null
    }
  }
  return { adding, error, message, addToGoogle, cancel }
})
