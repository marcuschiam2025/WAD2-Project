<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@core/stores/rooms'
import { api } from '@core/services/api'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
const rooms = useRoomsStore(), router = useRouter()
const name = ref(''), module = ref(null)
const query = ref(''), matches = ref([]), searching = ref(false), searchError = ref(''), error = ref('')
let ticket = 0, timer
watch(query, value => {
  clearTimeout(timer)
  const request = ++ticket
  matches.value = []; searchError.value = ''; searching.value = false
  if (!value.trim()) return
  searching.value = true
  timer = setTimeout(async () => {
    try {
      const result = await api.modules({q:value.trim(),limit:8})
      if (request === ticket) matches.value = result
    } catch (failure) { if (request === ticket) searchError.value = failure.message }
    finally { if (request === ticket) searching.value = false }
  }, 250)
})
onBeforeUnmount(() => { clearTimeout(timer); ticket++ })
function pick(item) { module.value = item; query.value = ''; matches.value = [] }
async function create() {
  if (rooms.busy || !module.value) return
  error.value = ''
  try {
    const id = await rooms.createRoom({name:name.value.trim(),module:module.value._id ?? module.value.code})
    router.push(`/rooms/${id}`)
  } catch (failure) { error.value = failure.message }
}
</script>
<template>
  <div>
    <PageHeader overline="Collab Rooms" title="Create a room" />
    <main class="mx-auto max-w-xl px-5 py-8">
      <form class="card flex flex-col gap-5 p-5" @submit.prevent="create">
        <fieldset :disabled="rooms.busy" class="flex min-w-0 flex-col gap-5">
          <label class="flex flex-col gap-2 text-sm">Party name<input v-model="name" required maxlength="80" placeholder="IS216 study friends" class="rounded-md border border-border p-3" /></label>
          <div class="flex flex-col gap-2 text-sm">
            <label for="room-module">Module code</label>
            <div v-if="module" class="flex items-center justify-between gap-2 rounded-md border border-border p-3"><span>{{ module._id || module.code }} · {{ module.title || module.name }}</span><button type="button" class="text-primary underline" @click="module = null">Change</button></div>
            <template v-else>
              <input id="room-module" v-model="query" autocomplete="off" placeholder="Search by module code or name" class="rounded-md border border-border p-3" />
              <p v-if="searching" role="status">Searching modules…</p><p v-if="searchError" role="alert" class="text-destructive">{{ searchError }}</p>
              <ul v-if="matches.length" class="max-h-64 overflow-y-auto rounded-md border border-border"><li v-for="item in matches" :key="item._id || item.code"><button type="button" class="w-full p-3 text-left hover:bg-muted" @click="pick(item)">{{ item._id || item.code }} · {{ item.title || item.name }}</button></li></ul>
              <p v-else-if="query.trim() && !searching && !searchError" class="text-muted-foreground">No matching modules.</p>
            </template>
          </div>
          <p class="text-sm text-muted-foreground">After creating the room, share its invite code with your friends so they can join.</p>
        </fieldset>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2"><BaseButton variant="ghost" to="/rooms">Cancel</BaseButton><button type="submit" :disabled="rooms.busy || !name.trim() || !module" class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{{ rooms.busy ? 'Creating…' : 'Create room' }}</button></div>
      </form>
    </main>
  </div>
</template>
