<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@core/stores/user'
import { usePlannerStore } from '@core/stores/planner'
import { useBiddingStore } from '@core/stores/bidding'
import AppNavBar from '@/components/layout/AppNavBar.vue'

const route = useRoute()
const user = useUserStore()
const planner = usePlannerStore()
const bidding = useBiddingStore()

// Load the student's plans and bids from the backend once they are signed in and onboarded
// Onboarding supplies the first plan. Plan screens wait for the actual saved plans.
watch(
  () => user.isSignedIn && user.onboarded,
  async (ready) => {
    if (!ready) return
    await planner.load()
    if (user.isSignedIn && user.onboarded) await bidding.load()
  },
  { immediate: true },
)
// Quiz results is registered as a 'bare' route in the shared router, but the V2 design shows the nav bar on it
const needsPlans = computed(() => ['dashboard', 'planner', 'bidding'].includes(route.meta.nav))
const showNav = computed(() => route.meta.layout === 'app' || route.name === 'quiz-results')
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppNavBar v-if="showNav" />
    <main v-if="needsPlans && user.isSignedIn && !planner.online" class="mx-auto max-w-xl p-8" aria-live="polite">
      <p>{{ planner.syncError || 'Loading your saved plans…' }}</p>
      <button v-if="planner.syncError" class="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground" @click="planner.reload()">Try again</button>
    </main>
    <RouterView v-else />
  </div>
</template>
