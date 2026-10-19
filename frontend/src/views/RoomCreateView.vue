<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore, MAX_ROOM_SIZE } from '@backend/stores/rooms'
import { moduleName } from '@backend/data/catalogue'
import PageHeader from '@/components/layout/PageHeader.vue'
import BackButton from '@/components/layout/BackButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import PrereqBanModal from '@/components/modals/PrereqBanModal.vue'
import iconSearch from '@/assets/figma/icon-search.svg'
import iconPlus from '@/assets/figma/plus-14.svg'
import iconRemove from '@/assets/figma/icon-remove.svg'
import iconMinus from '@/assets/figma/icon-minus.svg'

const router = useRouter()
const rooms = useRoomsStore()

const name = ref('')
const description = ref('')
const module = ref('IS442')
const maxMembers = ref(6)
const members = ref([]) // classmate ids
const banned = ref([])
const query = ref('')
const blocked = ref(null) // { person, prereq }

const suggestions = computed(() => rooms.searchClassmates(query.value, [...members.value, ...banned.value]))
const isFull = computed(() => members.value.length + 1 >= maxMembers.value)
const canCreate = computed(() => name.value.trim() && module.value)

function addMember(person) {
  const prereq = rooms.missingPrereq(person.id, module.value)
  query.value = ''
  if (prereq) {
    blocked.value = { person, prereq }
    return
  }
  if (isFull.value) return
  members.value.push(person.id)
}

function addFirstMatch() {
  if (suggestions.value[0]) addMember(suggestions.value[0])
}

function ban() {
  banned.value.push(blocked.value.person.id)
  blocked.value = null
}

function create() {
  const id = rooms.createRoom({
    name: name.value.trim(),
    description: description.value.trim(),
    module: module.value,
    maxMembers: maxMembers.value,
    members: members.value,
  })
  router.push(`/rooms/${id}`)
}

const minMembers = computed(() => Math.max(2, members.value.length + 1))
</script>

<template>
  <div>
    <PageHeader overline="COLLAB ROOMS / NEW" title="Register a room">
      <template #leading><BackButton to="/rooms" /></template>
    </PageHeader>

    <main class="flex justify-center px-16 pt-8 pb-16">
      <form
        class="flex w-[620px] flex-col gap-5 rounded-xl border border-border bg-card p-8 shadow-md"
        @submit.prevent="canCreate && create()"
      >
        <label class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium">Room name</span>
          <input
            v-model="name"
            required
            placeholder="Yappers"
            class="rounded-md border border-border px-3 py-[9px] text-[14px] outline-none focus:border-primary"
          />
        </label>

        <div class="flex flex-col gap-1.5">
          <label for="member-search" class="text-[13px] font-medium">Members</label>
          <div class="relative">
            <div class="flex items-center gap-2 rounded-md border border-border px-3 py-[9px] focus-within:border-primary">
              <img :src="iconSearch" alt="" class="size-4" />
              <input
                id="member-search"
                v-model="query"
                autocomplete="off"
                placeholder="Search classmates by name or email"
                class="min-w-0 flex-1 text-[14px] outline-none"
                @keydown.enter.prevent="addFirstMatch"
              />
              <BaseButton variant="secondary" size="sm" :disabled="!suggestions.length" @click="addFirstMatch">
                <img :src="iconPlus" alt="" class="size-3.5" /> Add
              </BaseButton>
            </div>
            <div
              v-if="suggestions.length"
              class="absolute inset-x-0 top-full z-10 mt-1 flex flex-col rounded-md border border-border bg-card p-1 shadow-md"
            >
              <button
                v-for="p in suggestions"
                :key="p.id"
                type="button"
                class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                @click="addMember(p)"
              >
                <UserAvatar :initials="p.initials" />
                <span class="font-medium">{{ p.name }}</span>
                <span class="text-muted-foreground">{{ p.email }}</span>
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="id in members"
              :key="id"
              class="flex items-center gap-2 rounded-full bg-secondary py-1 pr-2 pl-1 text-[13px] font-medium"
            >
              <UserAvatar :initials="rooms.person(id).initials" />
              {{ rooms.person(id).name }}
              <button type="button" :aria-label="`Remove ${rooms.person(id).name}`" @click="members = members.filter((m) => m !== id)">
                <img :src="iconRemove" alt="" class="size-3.5" />
              </button>
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium">Module</span>
          <div class="flex items-center rounded-md border border-border px-3 py-[9px]">
            <span v-if="module" class="flex items-center gap-2 rounded-sm bg-secondary py-1 pr-2 pl-1 text-[13px] font-medium">
              <span><span class="font-bold">{{ module }}</span> {{ moduleName(module) }}</span>
              <button type="button" aria-label="Remove module" @click="module = ''">
                <img :src="iconRemove" alt="" class="size-3.5" />
              </button>
            </span>
            <select v-else v-model="module" class="flex-1 text-[14px] outline-none">
              <option value="" disabled>Choose the module this room is bidding for</option>
              <option value="IS442">IS442 {{ moduleName('IS442') }}</option>
            </select>
          </div>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium">Description</span>
          <textarea
            v-model="description"
            rows="3"
            placeholder="IS Y3 friends planning Y3S2 bids together — mainly BA track."
            class="h-[88px] resize-none rounded-md border border-border px-3 py-[9px] text-[14px] outline-none focus:border-primary"
          />
        </label>

        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium">Max no. of people</span>
          <div class="flex w-fit items-center rounded-md border border-border">
            <button
              type="button"
              aria-label="Fewer people"
              class="px-3 py-[9px] disabled:opacity-40"
              :disabled="maxMembers <= minMembers"
              @click="maxMembers--"
            >
              <img :src="iconMinus" alt="" class="size-3.5" />
            </button>
            <span class="border-x border-border px-5 py-[9px] font-mono text-[14px] font-medium">{{ maxMembers }}</span>
            <button
              type="button"
              aria-label="More people"
              class="px-3 py-[9px] disabled:opacity-40"
              :disabled="maxMembers >= MAX_ROOM_SIZE"
              @click="maxMembers++"
            >
              <img :src="iconPlus" alt="" class="size-3.5" />
            </button>
          </div>
          <span class="text-[12px] text-muted-foreground">
            Including you · {{ members.length }} invited so far · up to {{ MAX_ROOM_SIZE }}
          </span>
          <span v-if="isFull" class="text-[12px] text-warning">Room is full — raise the limit to invite more people.</span>
        </div>

        <div class="flex justify-end gap-2.5">
          <BaseButton variant="ghost" to="/rooms">Cancel</BaseButton>
          <button
            type="submit"
            :disabled="!canCreate"
            class="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            Create room
          </button>
        </div>
      </form>
    </main>

    <PrereqBanModal
      v-if="blocked"
      :person="blocked.person"
      :module="module"
      :prereq="blocked.prereq"
      @close="blocked = null"
      @ban="ban"
    />
  </div>
</template>
