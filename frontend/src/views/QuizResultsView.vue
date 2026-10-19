<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { useUserStore } from '@/stores/user'
import { usePlannerStore } from '@/stores/planner'
import { modules, tracks, trackName } from '@/data/catalogue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackMatchRow from '@/components/TrackMatchRow.vue'
import ModuleDetailModal from '@/components/modals/ModuleDetailModal.vue'
import iconSparkles from '@/assets/figma/icon-sparkles.svg'
import chevronRight from '@/assets/figma/chevron-right.svg'

const route = useRoute()
const router = useRouter()
const quiz = useQuizStore()
const user = useUserStore()
const planner = usePlannerStore()

const attempt = computed(
  () => quiz.attempts.find((a) => String(a.id) === route.query.attempt) ?? quiz.latest,
)
if (!attempt.value) router.replace('/quiz')

const expanded = ref(attempt.value?.results[0]?.code)
const openModule = ref(null)

// How many answers leaned most towards this track
function leaningCount(code) {
  return attempt.value.answers.filter((optIdx, qi) => {
    const opt = quiz.questions[qi].options[optIdx]
    if (!opt) return false
    const best = Math.max(...Object.values(opt.weights))
    return opt.weights[code] === best
  }).length
}

function explain(code) {
  const t = tracks.find((x) => x.code === code)
  return `${leaningCount(code)} of your ${quiz.questions.length} answers leaned towards ${t.name}. ${t.blurb}`
}

function recommended(code) {
  return (tracks.find((t) => t.code === code)?.recommended ?? []).slice(0, 3)
}

function retake() {
  quiz.start()
  router.push('/quiz/attempt')
}
</script>

<template>
  <main v-if="attempt" class="flex justify-center px-4 pt-16 pb-20">
    <div class="flex w-[840px] max-w-full flex-col gap-4">
      <div class="flex gap-1.5">
        <span class="h-1 w-5 rounded-[2px] bg-primary" />
        <span class="h-1 w-5 rounded-[2px] bg-primary" />
        <span class="h-1 w-5 rounded-[2px] bg-primary" />
        <span class="h-1 w-7 rounded-[2px] bg-primary" />
      </div>
      <header class="flex flex-col gap-2 py-2">
        <p class="text-overline text-muted-foreground">STEP 4 OF 4 · YOUR TRACK MATCH</p>
        <h1 class="text-h2">Hey {{ user.profile.firstName }}! You’re most aligned with these tracks, in this order.</h1>
        <p class="text-body text-muted-foreground">
          Based on your {{ quiz.questions.length }} quiz answers and the modules you’ve already completed. Open a track to
          see why, and up to 3 recommended modules.
        </p>
      </header>

      <template v-for="(r, i) in attempt.results" :key="r.code">
        <section
          v-if="expanded === r.code"
          class="flex flex-col overflow-hidden rounded-lg border-[1.5px] border-primary bg-card shadow-md"
        >
          <button type="button" class="text-left" @click="expanded = null">
            <TrackMatchRow :rank="i + 1" :track="trackName(r.code)" :pct="r.pct" :bordered="false" />
          </button>
          <div class="flex flex-col gap-3.5 px-5 pt-1 pb-5">
            <div class="flex items-start gap-3 rounded-md bg-primary-soft px-4 py-3.5">
              <img :src="iconSparkles" alt="" class="size-[18px]" />
              <div class="flex flex-col gap-1 text-[13px]">
                <p class="font-semibold text-primary">Why {{ trackName(r.code) }}?</p>
                <p class="leading-[18px]">{{ explain(r.code) }}</p>
              </div>
            </div>
            <p class="text-[13px] font-semibold">Here are some recommended modules</p>
            <div class="flex flex-col gap-2">
              <button
                v-for="code in recommended(r.code)"
                :key="code"
                type="button"
                class="flex items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-2.5 text-left text-[13px] hover:border-primary"
                @click="openModule = { code, track: r.code }"
              >
                <span class="font-semibold">{{ code }}</span>
                <span class="flex-1 text-muted-foreground">{{ modules[code].name }}</span>
                <img :src="chevronRight" alt="" class="size-3.5" />
              </button>
            </div>
          </div>
        </section>
        <button v-else type="button" class="text-left" @click="expanded = r.code">
          <TrackMatchRow :rank="i + 1" :track="trackName(r.code)" :pct="r.pct" class="hover:border-primary" />
        </button>
      </template>

      <div class="flex items-center gap-2.5 pt-2">
        <p class="flex-1 text-[13px] text-muted-foreground">Saved modules go to your What-If Planner basket.</p>
        <BaseButton variant="ghost" @click="retake">Retake quiz</BaseButton>
        <BaseButton to="/planner">Continue to What-If Planner</BaseButton>
      </div>
    </div>

    <ModuleDetailModal
      v-if="openModule"
      :code="openModule.code"
      :track-label="`${openModule.track} TRACK ${modules[openModule.code].compulsory ? 'CORE' : 'ELECTIVE'}`"
      :saved="planner.basket.includes(openModule.code)"
      @close="openModule = null"
      @save="planner.addToBasket(openModule.code)"
    />
  </main>
</template>
