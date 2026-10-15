<script setup>
import iconBack from '@/assets/figma/icon-back.svg'

defineProps({ to: { type: String, required: true } })
</script>

<template>
  <RouterLink :to="to" aria-label="Back" class="rounded-md border border-border bg-card p-1.5 hover:bg-muted">
    <img :src="iconBack" alt="" class="size-4" />
  </RouterLink>
</template>
