<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNavBar from '@/components/layout/AppNavBar.vue'

const route = useRoute()
const showNav = computed(() => route.meta.layout === 'app')
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppNavBar v-if="showNav" />
    <RouterView />
  </div>
</template>
