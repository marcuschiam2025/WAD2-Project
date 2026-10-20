<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@core/stores/user'
import { popEnter, popLeave } from '@/motion'
import BrandLogo from './BrandLogo.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import iconBell from '@/assets/v2/bell.svg'
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
  <header class="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-6">
    <div class="flex items-center gap-8">
      <BrandLogo to="/dashboard" />
      <nav class="flex items-start gap-6">
        <RouterLink
          v-for="link in links"
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

    <div class="flex items-center gap-4">
      <!-- TODO(backend): balance comes from the user store; wire it to GET /api/users/me -->
      <div class="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 leading-normal whitespace-nowrap">
        <span class="font-mono text-[12.5px] font-bold">e$ {{ user.balance.toLocaleString() }}</span>
        <span class="text-[12px] text-muted-foreground">left</span>
      </div>
      <button type="button" aria-label="Notifications" class="size-8 rounded-full hover:bg-muted">
        <img :src="iconBell" alt="" class="size-8" />
      </button>
      <div ref="menuRef" class="relative">
        <button
          type="button"
          aria-label="Account menu"
          :aria-expanded="menuOpen"
          class="block rounded-full"
          @click="menuOpen = !menuOpen"
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
  </header>
</template>
