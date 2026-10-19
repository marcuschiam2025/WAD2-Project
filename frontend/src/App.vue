<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNavBar from '@/components/layout/AppNavBar.vue'

const route = useRoute()
// Quiz results is registered as a 'bare' route in the shared router, but the V2 design shows the nav bar on it
const showNav = computed(() => route.meta.layout === 'app' || route.name === 'quiz-results')
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppNavBar v-if="showNav" />
    <RouterView />
  </div>
</template>
