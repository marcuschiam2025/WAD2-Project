<script setup>
import dotSuccess from '@/assets/figma/dot-success.svg'
import dotInfo from '@/assets/figma/dot-info.svg'
import dotWarning from '@/assets/figma/dot-warning-6.svg'

defineProps({
  variant: { type: String, default: 'neutral' }, // neutral | success | info | warning
  dot: Boolean,
})

const styles = {
  neutral: 'bg-secondary text-foreground',
  success: 'bg-success-soft text-success',
  info: 'bg-primary-soft text-primary',
  warning: 'bg-warning-chip text-warning font-semibold',
}
const dots = { success: dotSuccess, info: dotInfo, warning: dotWarning }
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[12px] font-medium whitespace-nowrap"
    :class="styles[variant]"
  >
    <img v-if="dot && dots[variant]" :src="dots[variant]" alt="" class="size-1.5" />
    <slot />
  </span>
</template>
