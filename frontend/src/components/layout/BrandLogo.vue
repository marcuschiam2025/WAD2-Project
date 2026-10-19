<script setup>
import logo from '@/assets/bidmaxxer_logo.png'

defineProps({
  to: { type: String, default: '/' },
  large: Boolean, // 18px wordmark on the sign-in screen, 16px elsewhere
})
</script>

<template>
  <RouterLink :to="to" class="flex shrink-0 items-center gap-2">
    <img :src="logo" alt="" class="h-8 w-[38px] object-contain" />
    <span class="leading-normal font-bold text-foreground" :class="large ? 'text-[18px]' : 'text-[16px]'">
      Bid<span class="text-primary">Maxxer</span>
    </span>
  </RouterLink>
</template>
