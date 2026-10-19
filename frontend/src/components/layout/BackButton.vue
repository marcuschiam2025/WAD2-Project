<script setup>
import iconBack from '@/assets/v2/back.svg'

defineProps({ to: { type: String, required: true } })
</script>

<template>
  <RouterLink :to="to" aria-label="Back" class="rounded-md border border-border bg-card p-2 transition-colors hover:bg-muted">
    <img :src="iconBack" alt="" class="size-4" />
  </RouterLink>
</template>
