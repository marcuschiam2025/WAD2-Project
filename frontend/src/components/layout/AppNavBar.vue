<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@core/stores/user'
import { popEnter, popLeave } from '@/motion'
import BrandLogo from './BrandLogo.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import iconBell from '@/assets/v2/bell.svg'
import iconProfile from '@/assets/v2/user.svg'
import iconSettings from '@/assets/v2/settings.svg'
import iconLogout from '@/assets/v2/logout.svg'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const links = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { key: 'quiz', label: 'Track Quiz', to: '/quiz' },
  { key: 'planner', label: 'Planner', to: '/planner' },
  { key: 'bidding', label: 'Bidding', to: '/bidding' },
  { key: 'rooms', label: 'Collab Rooms', to: '/rooms' },
]

// quiz-results has no meta.nav in the shared router, so fall back to the path
const activeKey = computed(() => route.meta.nav ?? (route.path.startsWith('/quiz') ? 'quiz' : null))

const menuOpen = ref(false)
const navOpen = ref(false) // hamburger drawer below xl
const allLinks = computed(() => [...links, ...(user.profile.role === 'admin' ? [{ key: 'admin', label: 'Admin', to: '/admin' }] : [])])
watch(() => route.fullPath, () => (navOpen.value = false))
const menuRef = ref(null)
const notifOpen = ref(false)
const notifRef = ref(null)
// TODO(backend): notifications come from the backend (no endpoint yet); until then there is never anything unread
const notifications = computed(() => [])

function onDocClick(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) menuOpen.value = false
  if (notifRef.value && !notifRef.value.contains(e.target)) notifOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function go(path) {
  menuOpen.value = false
  router.push(path)
}

async function logOut() {
  menuOpen.value = false
  await user.signOut()
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-card">
   <div class="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
    <div class="flex shrink-0 items-center gap-3 xl:gap-8">
      <button
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-muted xl:hidden"
        :aria-label="navOpen ? 'Close menu' : 'Open menu'"
        :aria-expanded="navOpen"
        @click.stop="navOpen = !navOpen"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path v-if="navOpen" d="M6 6l12 12M18 6L6 18" />
          <path v-else d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <BrandLogo to="/dashboard" class="max-sm:[&>span]:hidden" />
      <nav class="hidden items-start gap-6 xl:flex">
        <RouterLink
          v-for="link in allLinks"
          :key="link.key"
          :to="link.to"
          class="relative border-b-2 pt-[22px] pb-5 text-[14px] leading-normal whitespace-nowrap transition-colors"
          :class="
            activeKey === link.key
              ? 'border-primary font-medium text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          {{ link.label }}
        </RouterLink>
      </nav>
    </div>

    <div class="flex shrink-0 items-center gap-2 md:gap-4">
      <!-- TODO(backend): balance comes from the user store; wire it to GET /api/users/me -->
      <div class="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 leading-normal whitespace-nowrap">
        <span class="font-mono text-[12.5px] font-bold">e$ {{ user.balance.toLocaleString() }}</span>
        <span class="hidden text-[12px] text-muted-foreground sm:inline">left</span>
      </div>
      <div ref="notifRef" class="relative">
        <button
          type="button"
          aria-label="Notifications"
          :aria-expanded="notifOpen"
          class="relative block size-8 rounded-full hover:bg-muted"
          @click="notifOpen = !notifOpen; menuOpen = false"
        >
          <img :src="iconBell" alt="" class="size-8" />
          <span v-if="notifications.length" class="absolute top-[5px] right-[5px] size-2 rounded-full border border-white bg-destructive" />
        </button>
        <Transition :css="false" @enter="popEnter" @leave="popLeave">
          <div
            v-if="notifOpen"
            class="absolute top-11 right-0 z-50 flex w-72 max-w-[calc(100vw-2rem)] origin-top-right flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-md"
          >
            <p class="text-overline text-muted-foreground">Notifications</p>
            <ul v-if="notifications.length" class="flex flex-col gap-2">
              <li v-for="n in notifications" :key="n.id" class="text-[13px]">{{ n.text }}</li>
            </ul>
            <p v-else class="text-[13px] text-muted-foreground">You're all caught up. Nothing new right now.</p>
          </div>
        </Transition>
      </div>
      <div ref="menuRef" class="relative">
        <button
          type="button"
          aria-label="Account menu"
          :aria-expanded="menuOpen"
          class="block rounded-full"
          @click="menuOpen = !menuOpen; notifOpen = false"
        >
          <UserAvatar :initials="user.profile.initials" :size="32" you />
        </button>
        <!-- Overlay / Avatar menu -->
        <Transition :css="false" @enter="popEnter" @leave="popLeave">
          <div
            v-if="menuOpen"
            class="absolute top-11 right-0 flex w-48 origin-top-right flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-md"
          >
            <button
              type="button"
              class="flex items-center gap-2.5 rounded-sm p-2.5 text-left text-[14px] hover:bg-muted"
              @click="go('/profile')"
            >
              <img :src="iconProfile" alt="" class="size-4" /> Profile
            </button>
            <button
              type="button"
              class="flex items-center gap-2.5 rounded-sm p-2.5 text-left text-[14px] hover:bg-muted"
              @click="go('/settings')"
            >
              <img :src="iconSettings" alt="" class="size-4" /> Settings
            </button>
            <div class="h-px bg-border" />
            <button
              type="button"
              class="flex items-center gap-2.5 rounded-sm p-2.5 text-left text-[14px] hover:bg-muted"
              @click="logOut"
            >
              <img :src="iconLogout" alt="" class="size-4" /> Log out
            </button>
          </div>
        </Transition>
      </div>
    </div>
   </div>
    <!-- Mobile / tablet nav drawer -->
    <nav v-if="navOpen" class="flex flex-col border-t border-border px-4 py-2 md:px-6 xl:hidden" aria-label="Main">
      <RouterLink
        v-for="link in allLinks"
        :key="link.key"
        :to="link.to"
        class="rounded-md px-3 py-3 text-[14px]"
        :class="activeKey === link.key ? 'bg-primary-tint font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
      >{{ link.label }}</RouterLink>
    </nav>
  </header>
</template>
