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
// (onboarding fills in their first plan). Without a backend the sample data stays.
watch(
  () => user.isSignedIn && user.onboarded,
  async (ready) => {
    if (!ready) return
    await planner.load()
    await bidding.load()
  },
  { immediate: true },
)
// Quiz results is registered as a 'bare' route in the shared router, but the V2 design shows the nav bar on it
const showNav = computed(() => route.meta.layout === 'app' || route.name === 'quiz-results')
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppNavBar v-if="showNav" />
    <RouterView />
  </div>
</template>
