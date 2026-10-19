<script setup>
import BrandLogo from '@/components/layout/BrandLogo.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import heroNode from '@/assets/figma/hero-node.svg'
import heroLine1 from '@/assets/figma/hero-line-1.svg'
import heroLine2 from '@/assets/figma/hero-line-2.svg'
import heroLine3 from '@/assets/figma/hero-line-3.svg'
import dotPrimary from '@/assets/figma/dot-primary.svg'

// Constellation decoration inside the hero (positions from the Figma frame)
const nodes = [
  [187.2, 70.4],
  [748.8, 208],
  [884, 128],
  [104, 224],
  [572, 48],
  [956.8, 256],
]

const features = [
  { title: 'Degree planning', body: '8-semester roadmap with LOA, exchange terms, and reverse prerequisite auto-scheduling.' },
  { title: 'Smart bidding', body: 'Data-driven reference bids from 3-semester historical medians and live demand ratios.' },
  { title: 'Syllabus stress tracking', body: '16-week matrix flags deliverable pile-ups before you commit to a timetable.' },
  { title: 'Social co-bidding', body: 'Compare sections with friends and align on the incoming semester together.' },
]
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center justify-between bg-card px-16 py-6">
      <BrandLogo />
      <RouterLink to="/signin" class="text-[14px] font-medium text-primary hover:underline">Log in with Google →</RouterLink>
    </header>

    <main class="flex flex-1 flex-col px-16 pt-[23px] pb-10">
      <section
        class="relative h-80 overflow-hidden rounded-xl"
        style="background: radial-gradient(50% 50% at 50% 50%, rgb(28 28 46) 0%, rgb(20 20 30) 50%, rgb(11 11 15) 100%)"
      >
        <div v-for="([x, y], i) in nodes" :key="i" class="absolute size-2" :style="{ left: `${x}px`, top: `${y}px` }">
          <div class="absolute inset-[-150%]"><img :src="heroNode" alt="" class="block size-full max-w-none" /></div>
        </div>
        <div class="absolute top-12 left-[187.2px] h-[22.4px] w-[384.8px]">
          <div class="absolute inset-[-2.23%_0]"><img :src="heroLine1" alt="" class="block size-full max-w-none" /></div>
        </div>
        <div class="absolute top-12 left-[572px] h-20 w-[312px]">
          <div class="absolute inset-[-0.61%_0]"><img :src="heroLine2" alt="" class="block size-full max-w-none" /></div>
        </div>
        <div class="absolute top-32 left-[748.8px] h-20 w-[135.2px]">
          <div class="absolute inset-[-0.54%_-0.19%]"><img :src="heroLine3" alt="" class="block size-full max-w-none" /></div>
        </div>

        <div
          class="absolute top-[60px] left-10 flex w-[400px] flex-col items-start gap-3.5 rounded-lg border border-white/12 bg-white/6 px-[26px] py-6 backdrop-blur-md"
        >
          <h1 class="text-[24px] font-bold text-white">Plan your degree. Win your bids.</h1>
          <p class="text-[13.5px] text-white/65">
            Interactive onboarding, reverse prerequisite scheduling, and a live BOSS bidding simulator — all in one planner.
          </p>
          <BaseButton to="/signin" class="h-9! text-[13px]!">Get started</BaseButton>
        </div>
      </section>

      <h2 class="mt-5 w-[700px] max-w-full text-h2">Everything from onboarding to bid submission, in one place</h2>

      <div class="mt-6 flex flex-wrap gap-5">
        <article v-for="f in features" :key="f.title" class="card flex w-[302px] flex-col gap-2 px-5 py-[22px]">
          <img :src="dotPrimary" alt="" class="size-2" />
          <h3 class="text-h4">{{ f.title }}</h3>
          <p class="text-small text-muted-foreground">{{ f.body }}</p>
        </article>
      </div>
    </main>

    <footer class="border-t border-border bg-card px-16 py-7">
      <p class="text-small text-muted-foreground">
        © 2025 BidMaxxer · Built for SMU students · Not affiliated with BOSS or SMU
      </p>
    </footer>
  </div>
</template>
