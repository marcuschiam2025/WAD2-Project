<script setup>
import BrandLogo from '@/components/layout/BrandLogo.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import iconPlanning from '@/assets/v2/feature-planning.svg'
import iconBidding from '@/assets/v2/feature-bidding.svg'
import iconStress from '@/assets/v2/feature-stress.svg'
import iconCobid from '@/assets/v2/feature-cobid.svg'

// Product visual: a mini What-If Planner. Marketing copy, so it stays static.
const semesters = [
  { label: 'Y2 S1', modules: ['IS211', 'IS216', 'STAT151'] },
  { label: 'Y2 S2 · Now', current: true, modules: ['IS442', 'IS215'], highlight: 'IS460' },
  { label: 'Y3 S1', modules: ['IS424', 'IS428'] },
  { label: 'Y3 S2', modules: ['IS483'] },
]

const features = [
  { icon: iconPlanning, title: 'Degree planning', body: '8-semester roadmap with LOA and exchange terms' },
  { icon: iconBidding, title: 'Smart bidding', body: 'Reference bids from 3-semester medians' },
  { icon: iconStress, title: 'Syllabus stress', body: '16-week matrix flags deliverable pile-ups' },
  { icon: iconCobid, title: 'Co-bidding', body: 'Vote on sections with friends in a room' },
]
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center justify-between border-b border-border bg-card px-16 py-4">
      <BrandLogo />
      <BaseButton to="/signin" variant="link">Log in with Google →</BaseButton>
    </header>

    <main class="flex flex-1 flex-col gap-4 px-16 pt-12 pb-8">
      <section v-enter class="card flex items-center gap-10 rounded-xl p-10"> <!-- motion: hero section fades in on mount -->
        <div class="flex w-[540px] shrink-0 flex-col items-start gap-3">
          <p class="text-[13px] font-semibold text-primary">Built for SMU students</p>
          <h1 class="text-[48px] leading-[54px] font-extrabold tracking-[-0.96px]">
            Plan your degree.<br />Win your bids.
          </h1>
          <p class="w-[460px] text-[16px] leading-6 text-muted-foreground">
            Map all eight semesters, check prerequisites as you go, and test your BOSS bids against three semesters of
            medians before the round opens.
          </p>
          <div class="flex items-center gap-3">
            <BaseButton to="/signin" size="lg">Get started</BaseButton>
            <BaseButton to="/signin" variant="ghost" size="lg">See how bidding works</BaseButton>
          </div>
        </div>

        <!-- Product visual -->
        <div class="flex min-w-0 flex-1 flex-col gap-2.5 rounded-lg border border-border bg-muted p-4">
          <div v-stagger="0.15" class="flex gap-2"> <!-- motion: semester columns stagger in 150ms apart -->
            <div
              v-for="sem in semesters"
              :key="sem.label"
              class="flex h-[180px] min-w-0 flex-1 flex-col gap-1.5 rounded-sm border bg-card px-1.5 py-2"
              :class="sem.current ? 'border-primary' : 'border-border'"
            >
              <p class="font-mono text-[10px] font-medium" :class="sem.current ? 'text-primary' : 'text-muted-foreground'">
                {{ sem.label }}
              </p>
              <span
                v-for="code in sem.modules"
                :key="code"
                class="rounded-[4px] bg-secondary px-1.5 py-[5px] font-mono text-[11px] font-medium"
              >{{ code }}</span>
              <span
                v-if="sem.highlight"
                class="rounded-[4px] border-[1.5px] border-primary bg-primary-tint px-1.5 py-[5px] font-mono text-[11px] font-medium text-primary"
              >{{ sem.highlight }}</span>
            </div>
          </div>
          <p class="text-[11px] text-muted-foreground">What-If Planner · Plan 1 · Business Analytics</p>
        </div>
      </section>

      <div v-stagger="0.2" class="flex items-start gap-3"> <!-- motion: feature cards stagger in 200ms apart -->
        <article
          v-for="f in features"
          :key="f.title"
          class="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border bg-card p-4"
        >
          <span class="mb-1 flex self-start rounded-md bg-primary-tint p-[7px]">
            <img :src="f.icon" alt="" class="size-3.5" />
          </span>
          <h2 class="text-[14px] font-semibold">{{ f.title }}</h2>
          <p class="text-[13px] text-muted-foreground">{{ f.body }}</p>
        </article>
      </div>
    </main>

    <footer class="border-t border-border bg-card px-16 py-6">
      <p class="text-[13px] text-muted-foreground">
        © 2025 BidMaxxer · Built for SMU students · Not affiliated with BOSS or SMU
      </p>
    </footer>
  </div>
</template>
