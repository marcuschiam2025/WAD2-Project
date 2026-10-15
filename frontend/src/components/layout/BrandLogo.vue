<script setup>
import logo from '@/assets/bidmaxxer_logo.png'

defineProps({ to: { type: String, default: '/' } })
</script>

<template>
  <RouterLink :to="to" class="flex shrink-0 items-center gap-2">
    <!-- Crop matches the Figma logo frame (38 × 32) -->
    <span class="relative h-8 w-[38.154px] overflow-hidden">
      <img :src="logo" alt="BidMaxxer logo" class="absolute top-[-32.9%] left-0 h-[171.58%] w-full max-w-none" />
    </span>
    <span class="text-[15px] font-bold text-black">Bid<span class="text-brand">Maxxer</span></span>
  </RouterLink>
</template>
