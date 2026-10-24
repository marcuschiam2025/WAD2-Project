<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@core/stores/user'
import { api } from '@core/services/api'
import BrandLogo from '@/components/layout/BrandLogo.vue'

const user = useUserStore()
const router = useRouter()
const entries = ref([]), next = ref(null), busy = ref(false), error = ref(''), verified = ref(false)
let generation = 0
async function load(more = false) {
  if (busy.value) return
  busy.value = true; error.value = ''
  const version = ++generation, uid = user.uid
  try {
    await api.adminOverview()
    const history = await api.adminAudit(more ? next.value : undefined)
    if (version !== generation || uid !== user.uid || !user.isSignedIn) return
    entries.value = more ? [...entries.value, ...history.entries] : history.entries
    next.value = history.next
    verified.value = true
  } catch (failure) {
    if (uid !== user.uid || !user.isSignedIn) return
    if (failure.status === 403 || failure.status === 401) { verified.value = false; entries.value = []; next.value = null }
    error.value = failure.message
  } finally { busy.value = false }
}
async function signOut() { generation++; await user.signOut(); await router.push('/signin') }
onMounted(() => load())
const sections = [
  ['Modules', 'Course details, credit units and prerequisites.'],
  ['Sections & schedules', 'Term offerings, class meetings and exams.'],
  ['Tracks & curricula', 'Track modules and requirements by intake.'],
  ['Bidding rounds', 'Terms, rounds and submission deadlines.'],
]
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
    <BrandLogo to="/admin" />
    <div class="flex items-center gap-4 text-sm">
      <span>{{ user.profile.displayName }} · Admin</span>
      <button class="rounded-md border border-border px-3 py-2 hover:bg-muted" @click="signOut">Sign out</button>
    </div>
  </header>
  <main class="mx-auto max-w-5xl px-6 py-10">
    <p class="text-sm font-medium text-primary">Staff workspace</p>
    <h1 class="mt-2 text-3xl font-bold">Academic catalogue</h1>
    <p class="mt-3 text-muted-foreground">Manage the course information students use to explore tracks and plan their studies.</p>
    <p v-if="error" role="alert" class="mt-6 rounded-md border border-destructive p-4 text-destructive">{{ error }}</p>
    <button v-if="error" class="mt-3 rounded-md border border-border px-4 py-2" :disabled="busy" @click="load()">Try again</button>
    <p v-if="busy && !verified" class="mt-6" role="status">Checking staff access…</p>
    <template v-if="verified">
      <section aria-label="Catalogue management" class="mt-8 grid gap-4 sm:grid-cols-2">
        <article v-for="[title, description] in sections" :key="title" class="rounded-lg border border-border bg-card p-5">
          <h2 class="font-semibold">{{ title }}</h2>
          <p class="mt-2 text-sm text-muted-foreground">{{ description }}</p>
          <p class="mt-4 text-xs text-muted-foreground">Editing coming soon</p>
        </article>
      </section>
      <section class="mt-10" aria-labelledby="history-title">
        <div class="flex items-center justify-between gap-4">
          <h2 id="history-title" class="text-xl font-semibold">Recent changes</h2>
          <button class="rounded-md border border-border px-3 py-2 text-sm" :disabled="busy" @click="load()">{{ busy ? 'Loading…' : 'Refresh' }}</button>
        </div>
        <p v-if="!entries.length" class="mt-4 text-sm text-muted-foreground">No staff changes recorded yet. Saved catalogue changes will appear here.</p>
        <ul v-else class="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
          <li v-for="entry in entries" :key="entry._id" class="flex flex-wrap justify-between gap-3 p-4 text-sm">
            <div><p class="font-medium">{{ entry.action }} · {{ entry.entity }} · {{ entry.entityId }}</p><p class="mt-1 text-muted-foreground">{{ entry.actorName }}</p></div>
            <time :datetime="entry.createdAt" class="text-muted-foreground">{{ new Date(entry.createdAt).toLocaleString() }}</time>
          </li>
        </ul>
        <button v-if="next" class="mt-4 rounded-md border border-border px-4 py-2 text-sm" :disabled="busy" @click="load(true)">Load earlier changes</button>
      </section>
    </template>
  </main>
</template>
