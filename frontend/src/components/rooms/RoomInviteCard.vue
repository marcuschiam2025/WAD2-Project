<script setup>
import { computed, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import iconLink from '@/assets/figma/icon-link.svg'
import iconCopy from '@/assets/figma/icon-copy.svg'

const props = defineProps({ room: { type: Object, required: true } })
const copied = ref(false)

const link = computed(
  () => `https://bidmaxxer.app/room/${props.room.id}-${props.room.name.toLowerCase().replace(/\s+/g, '-')}`,
)

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section class="card flex flex-col gap-2.5 p-5">
    <h2 class="text-h4">Invite link</h2>
    <div class="flex items-center gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted px-3 py-[9px]">
        <img :src="iconLink" alt="" class="size-4" />
        <span class="truncate font-mono text-[13px] font-medium">{{ link }}</span>
      </div>
      <BaseButton variant="outline" @click="copy">
        <img :src="iconCopy" alt="" class="size-4" /> {{ copied ? 'Copied' : 'Copy' }}
      </BaseButton>
    </div>
    <p class="text-small text-muted-foreground">
      Anyone with this link can join until the room hits {{ room.maxMembers }} members.
    </p>
  </section>
</template>
