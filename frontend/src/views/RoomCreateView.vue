<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomsStore } from '@core/stores/rooms';
import { useUserStore } from '@core/stores/user';
import { useBiddingStore } from '@core/stores/bidding';
import { alreadyTaken } from '@core/utils/roomEligibility';
import { api } from '@core/services/api';
import PageHeader from '@/components/layout/PageHeader.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
const rooms = useRoomsStore(),
  router = useRouter(),
  user = useUserStore(),
  bidding = useBiddingStore();
// Party size, chosen with a - 2 + stepper. The backend allows 2 to 8 (MAX_PARTY_SIZE in
// backend/features/parties/models/Party.js).
const MIN_SIZE = 2,
  MAX_SIZE = 8;
const name = ref(''),
  module = ref(null),
  maxMembers = ref(MIN_SIZE);
const step = (by) => {
  maxMembers.value = Math.min(MAX_SIZE, Math.max(MIN_SIZE, maxMembers.value + by));
};
const query = ref(''),
  matches = ref([]),
  searching = ref(false),
  searchError = ref(''),
  error = ref('');
let ticket = 0,
  timer;
watch(query, (value) => {
  clearTimeout(timer);
  const request = ++ticket;
  matches.value = [];
  searchError.value = '';
  searching.value = false;
  if (!value.trim()) return;
  searching.value = true;
  timer = setTimeout(async () => {
    try {
      const result = await api.modules({ q: value.trim(), limit: 8 });
      if (request === ticket) matches.value = result;
    } catch (failure) {
      if (request === ticket) searchError.value = failure.message;
    } finally {
      if (request === ticket) searching.value = false;
    }
  }, 250);
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  ticket++;
});
function pick(item) {
  module.value = item;
  query.value = '';
  matches.value = [];
}
const moduleCode = computed(() => module.value?._id ?? module.value?.code);
const taken = computed(
  () => !!module.value && alreadyTaken(user.profile, moduleCode.value, bidding.round.term),
);
async function create() {
  if (rooms.busy || !module.value || taken.value) return;
  error.value = '';
  try {
    const id = await rooms.createRoom({
      name: name.value.trim(),
      module: moduleCode.value,
      maxMembers: maxMembers.value,
    });
    router.push(`/rooms/${id}`);
  } catch (failure) {
    error.value = failure.message;
  }
}
</script>
<template>
  <div>
    <PageHeader overline="Collab Rooms" title="Create a room" />
    <main class="mx-auto max-w-xl px-5 py-8">
      <form class="card flex flex-col gap-5 p-5" @submit.prevent="create">
        <fieldset :disabled="rooms.busy" class="flex min-w-0 flex-col gap-5">
          <label class="flex flex-col gap-2 text-sm"
            >Party name<input
              v-model="name"
              required
              maxlength="80"
              placeholder="IS216 study friends"
              class="rounded-md border border-border p-3"
          /></label>
          <div class="flex flex-col gap-2 text-sm">
            <label for="room-module">Module code</label>
            <div
              v-if="module"
              class="flex items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <span>{{ module._id || module.code }} · {{ module.title || module.name }}</span
              ><button type="button" class="text-primary underline" @click="module = null">Change</button>
            </div>
            <p v-if="taken" role="alert" class="text-destructive">
              You have already taken {{ moduleCode }} or are taking it now, so you can't create a room for it.
            </p>
            <template v-if="!module">
              <input
                id="room-module"
                v-model="query"
                autocomplete="off"
                placeholder="Search by module code or name"
                class="rounded-md border border-border p-3"
              />
              <p v-if="searching" role="status">Searching modules…</p>
              <p v-if="searchError" role="alert" class="text-destructive">{{ searchError }}</p>
              <ul v-if="matches.length" class="max-h-64 overflow-y-auto rounded-md border border-border">
                <li v-for="item in matches" :key="item._id || item.code">
                  <button type="button" class="w-full p-3 text-left hover:bg-muted" @click="pick(item)">
                    {{ item._id || item.code }} · {{ item.title || item.name }}
                  </button>
                </li>
              </ul>
              <p v-else-if="query.trim() && !searching && !searchError" class="text-muted-foreground">
                No matching modules.
              </p>
            </template>
          </div>
          <div class="flex flex-col gap-2 text-sm" role="group" aria-labelledby="room-size-label">
            <span id="room-size-label">Number of members</span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded-md border border-border text-lg hover:bg-muted disabled:opacity-40"
                aria-label="Fewer members"
                :disabled="maxMembers <= MIN_SIZE"
                @click="step(-1)"
              >
                −
              </button>
              <output class="w-10 text-center font-mono text-lg font-semibold" aria-live="polite">{{
                maxMembers
              }}</output>
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded-md border border-border text-lg hover:bg-muted disabled:opacity-40"
                aria-label="More members"
                :disabled="maxMembers >= MAX_SIZE"
                @click="step(1)"
              >
                +
              </button>
            </div>
            <span class="text-xs text-muted-foreground"
              >Including you, from {{ MIN_SIZE }} to {{ MAX_SIZE }}. Nobody can join once the room is
              full.</span
            >
          </div>
          <p class="text-sm text-muted-foreground">
            After creating the room, share its invite code with your friends so they can join.
          </p>
        </fieldset>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <BaseButton variant="ghost" to="/rooms">Cancel</BaseButton
          ><button
            type="submit"
            :disabled="rooms.busy || !name.trim() || !module || taken"
            class="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {{ rooms.busy ? 'Creating…' : 'Create room' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>
