<script setup>
import { computed } from 'vue'
import { useUserStore } from '@backend/stores/user'
import { useBiddingStore } from '@backend/stores/bidding'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import dotDestructive from '@/assets/figma/dot-destructive.svg'
import dotWarning from '@/assets/figma/dot-warning.svg'
import dotMuted from '@/assets/figma/dot-muted.svg'

const user = useUserStore()
const bidding = useBiddingStore()
const dots = { urgent: dotDestructive, soon: dotWarning, later: dotMuted }

// Sample widget data — TODO: GET /api/users/me/dashboard
const widgets = [
  {
    title: 'Upcoming Deadlines',
    items: [
      { tone: 'urgent', title: 'IS442 Midterm', meta: 'Fri, Week 7 · in 2 days' },
      { tone: 'soon', title: 'IS111 Quiz 3', meta: 'Mon, Week 8 · in 5 days' },
      { tone: 'later', title: 'IS216 Assignment 2', meta: 'Wed, Week 9 · in 12 days' },
    ],
  },
  {
    title: 'To-do',
    items: [
      { tone: 'later', title: 'Submit Round 1B bid cart', meta: 'Due before 5:00pm today' },
      { tone: 'later', title: 'Review IS442 syllabus', meta: 'Week 6 stress check' },
      { tone: 'later', title: 'Confirm KAIST exchange mapping', meta: 'Optional' },
    ],
  },
  {
    title: 'Pinned Emails',
    items: [
      { tone: 'urgent', title: 'BOSS: Round 1B closes in 2h 15m', meta: 'boss-notify@smu.edu.sg' },
      { tone: 'soon', title: 'IS442: Midterm venue change', meta: 'prof.tan@smu.edu.sg' },
      { tone: 'later', title: 'SEP: KAIST application receipt', meta: 'exchange@smu.edu.sg' },
    ],
  },
]

const spentRatio = computed(() => bidding.allocated / user.balance)
// Sample until the requirement checker API is wired up
const cuDone = 104
const cuTotal = 152
</script>

<template>
  <div>
    <PageHeader overline="AY24/25 · SEM 1 · ROUND 1B" :title="`Welcome back, ${user.profile.firstName}`">
      <template #actions>
        <BaseButton to="/bidding/finalised">Sync to Calendar</BaseButton>
      </template>
    </PageHeader>

    <main class="flex flex-col gap-6 px-16 py-6">
      <div class="grid grid-cols-3 gap-6">
        <section v-for="w in widgets" :key="w.title" class="card flex flex-col gap-3 p-5">
          <h2 class="text-h4">{{ w.title }}</h2>
          <div v-for="item in w.items" :key="item.title" class="flex items-center gap-2">
            <img :src="dots[item.tone]" alt="" class="size-[7px]" />
            <div class="flex flex-col gap-0.5">
              <span class="text-[13.5px]">{{ item.title }}</span>
              <span class="text-small text-muted-foreground">{{ item.meta }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <section class="card flex flex-col gap-2.5 p-5">
          <h2 class="text-h4 text-black">e$ Budget Spent</h2>
          <ProgressBar :value="spentRatio" :color="spentRatio > 0.75 ? 'bg-warning' : 'bg-primary'" />
          <p class="text-[12px] text-muted-foreground">
            e$ {{ bidding.allocated.toLocaleString() }} / {{ user.balance.toLocaleString() }} allocated
            ({{ Math.round(spentRatio * 100) }}%)
          </p>
        </section>
        <section class="card flex flex-col gap-2.5 p-5">
          <h2 class="text-h4 text-black">Graduation Progress</h2>
          <ProgressBar :value="cuDone / cuTotal" />
          <p class="text-[12px] text-muted-foreground">
            {{ cuDone }} / {{ cuTotal }} CU completed ({{ Math.round((cuDone / cuTotal) * 100) }}%)
          </p>
        </section>
      </div>
    </main>
  </div>
</template>
