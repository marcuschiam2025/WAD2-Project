<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@backend/stores/user'
import BrandLogo from './BrandLogo.vue'
import iconBell from '@/assets/figma/icon-bell.svg'
import avatarRing from '@/assets/figma/avatar-ring-32.svg'
import iconSettings from '@/assets/figma/icon-settings.svg'
import iconLogout from '@/assets/figma/icon-logout.svg'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const links = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { key: 'planner', label: 'Planner', to: '/planner' },
  { key: 'bidding', label: 'Bidding', to: '/bidding' },
  { key: 'quiz', label: 'Track Quiz', to: '/quiz' },
  { key: 'rooms', label: 'Collab Rooms', to: '/rooms' },
]

const menuOpen = ref(false)
const menuRef = ref(null)

function onDocClick(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function go(path) {
  menuOpen.value = false
  router.push(path)
}

function logOut() {
  menuOpen.value = false
  user.signOut()
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-5">
    <div class="flex items-center gap-7">
      <BrandLogo to="/dashboard" />
      <nav class="flex items-center gap-[22px]">
        <RouterLink
          v-for="link in links"
          :key="link.key"
          :to="link.to"
          class="relative flex flex-col text-[13.5px] whitespace-nowrap"
          :class="route.meta.nav === link.key ? 'font-medium text-primary' : 'text-muted-foreground hover:text-foreground'"
        >
          {{ link.label }}
          <span v-if="route.meta.nav === link.key" class="absolute -bottom-2 left-0 h-0.5 w-full bg-primary" />
        </RouterLink>
      </nav>
    </div>

    <div class="flex items-center gap-3.5">
      <div class="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 whitespace-nowrap">
        <span class="font-mono text-[12.5px] font-medium text-black">e$ {{ user.balance.toLocaleString() }}</span>
        <span class="text-[12px] text-muted-foreground">left</span>
      </div>
      <button type="button" aria-label="Notifications" class="size-8">
        <img :src="iconBell" alt="" class="size-8" />
      </button>
      <div ref="menuRef" class="relative">
        <button
          type="button"
          aria-label="Account menu"
          :aria-expanded="menuOpen"
          class="relative block size-8"
          @click="menuOpen = !menuOpen"
        >
          <span class="absolute inset-[-6.25%]">
            <img :src="avatarRing" alt="" class="block size-full max-w-none" />
          </span>
          <span class="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-black">
            {{ user.profile.initials }}
          </span>
        </button>
        <!-- Overlay / Avatar menu -->
        <div
          v-if="menuOpen"
          class="absolute top-11 right-0 flex w-48 flex-col gap-1 rounded-md border border-border bg-card p-2 shadow-sm"
        >
          <button type="button" class="flex h-10 items-center gap-3 rounded-sm px-3 text-left text-small hover:bg-muted" @click="go('/profile')">
            <img :src="iconSettings" alt="" class="size-4" /> Settings
          </button>
          <div class="h-px bg-border" />
          <button type="button" class="flex h-10 items-center gap-3 rounded-sm px-3 text-left text-small hover:bg-muted" @click="logOut">
            <img :src="iconLogout" alt="" class="size-4" /> Log out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
