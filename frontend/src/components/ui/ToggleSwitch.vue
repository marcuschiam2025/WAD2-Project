<script setup>
import switchOn from '@/assets/figma/switch-on.svg'
import switchOff from '@/assets/figma/switch-off.svg'

const model = defineModel({ type: Boolean, default: false })
defineProps({ label: { type: String, default: '' } })
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    class="inline-flex items-center gap-2"
    @click="model = !model"
  >
    <img :src="model ? switchOn : switchOff" alt="" class="h-5 w-[34px]" />
    <span v-if="label || $slots.default"><slot>{{ label }}</slot></span>
  </button>
</template>
