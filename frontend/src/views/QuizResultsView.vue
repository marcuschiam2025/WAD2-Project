<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuizStore, quizTrackNames, tieRunsPastShown, isOlderResult, themeLevel } from '@core/stores/quiz';
import PageHeader from '@/components/layout/PageHeader.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import TrackScoreChart from '@/components/TrackScoreChart.vue';
import QuizAssistant from '@/components/QuizAssistant.vue';
import AssistantFace from '@/components/AssistantFace.vue';
import { api } from '@core/services/api';
import { usePlannerStore } from '@core/stores/planner';
import { useUserStore } from '@core/stores/user';
const route = useRoute();
const router = useRouter();
const quiz = useQuizStore();
const planner = usePlannerStore();
const user = useUserStore();
const addingModule = ref(null);
const basketNotice = ref('');
const basketActionError = ref('');
async function addModule(code) {
  const account = user.uid;
  addingModule.value = code;
  basketNotice.value = '';
  basketActionError.value = '';
  try {
    await planner.load();
    if (account !== user.uid) return;
    if (!planner.online)
      throw new Error(planner.syncError || 'Could not load your saved basket. Please try again.');
    planner.addToBasket(code);
    await planner.saveBasket();
    if (account !== user.uid) return;
    basketNotice.value = `${code} saved to your planner basket.`;
  } catch (error) {
    if (account === user.uid) basketActionError.value = error.message;
  } finally {
    addingModule.value = null;
  }
}
async function retryBasket() {
  const account = user.uid;
  basketActionError.value = '';
  try {
    await planner.saveBasket();
    if (account === user.uid) basketNotice.value = 'Your planner basket is saved.';
  } catch (error) {
    if (account === user.uid) basketActionError.value = error.message;
  }
}
watch(
  () => user.uid,
  () => {
    addingModule.value = null;
    basketNotice.value = '';
    basketActionError.value = '';
  },
);
const loading = ref(true);
const moduleSuggestions = ref(null);
const moduleLoading = ref(false);
const moduleError = ref('');
const explanation = ref(null);
const assistantOpen = ref(false);
// From xl up there is room beside the results, so the explanation docks there; below it slides over the page instead
const wide = ref(false);
let wideQuery;
const syncWide = () => (wide.value = wideQuery.matches);
onMounted(() => {
  wideQuery = window.matchMedia('(min-width: 1280px)');
  syncWide();
  wideQuery.addEventListener('change', syncWide);
});
// The docked panel's top lines up with the top of the two track cards. What sits above them (the heading, a one or
// two line note, an "older result" notice) changes height, so measure it instead of guessing.
const layoutRef = ref(null);
const mainRef = ref(null);
const cardsRef = ref(null);
const dockTop = ref(32);
function measureDock() {
  if (!layoutRef.value || !cardsRef.value) return;
  dockTop.value = Math.max(
    0,
    Math.round(cardsRef.value.getBoundingClientRect().top - layoutRef.value.getBoundingClientRect().top),
  );
}
let layoutObserver;
onMounted(() => {
  layoutObserver = new ResizeObserver(measureDock); // fires when the results above the cards change height
  if (mainRef.value) layoutObserver.observe(mainRef.value);
  measureDock();
});
watch(wide, () => nextTick(measureDock));
onBeforeUnmount(() => {
  wideQuery?.removeEventListener('change', syncWide);
  layoutObserver?.disconnect();
});
watch(
  () => route.query.attempt,
  () => (assistantOpen.value = false),
);
const explanationLoading = ref(false);
const explanationError = ref(null); // the ApiError code, or 'UNREACHABLE' when the server could not be reached
const attempt = computed(
  () =>
    quiz.attempts.find((a) => String(a.id) === String(route.query.attempt)) ??
    (!route.query.attempt ? quiz.latest : null),
);
const provisional = computed(() => attempt.value?.rankingBasis === 'scenario-provisional');
const legacy = computed(() => attempt.value?.rubricVersion === 'legacy-v1');
const blended = computed(() => attempt.value?.rankingBasis === 'blended');
const themes = {
  DATA: 'Evidence and data',
  BUILD: 'Building and iteration',
  FINANCE: 'Financial systems',
  CIVIC: 'Civic and environmental impact',
  RELIABLE: 'Reliability and risk',
  PEOPLE: 'People and stakeholders',
};
const tied = computed(() => attempt.value?.results.filter((r) => r.rank === 1).length > 1);
const close = computed(() => {
  const r = attempt.value?.results;
  return (
    !provisional.value &&
    !legacy.value &&
    !tied.value &&
    r?.length > 1 &&
    r[0].alignmentIndex - r[1].alignmentIndex <= 5
  );
});
const contrasting = computed(() => {
  if (provisional.value || legacy.value || blended.value || !attempt.value) return false;
  const bestScenario = [...attempt.value.results].sort(
    (a, b) => b.scenarioPreferenceIndex - a.scenarioPreferenceIndex,
  )[0];
  return bestScenario.rank > 1;
});
const topResults = computed(() => attempt.value?.results.slice(0, 2) ?? []);
const otherResults = computed(() => attempt.value?.results.slice(2) ?? []);
const pickedAtRandom = computed(() => blended.value && tieRunsPastShown(attempt.value?.results));
const summaryNote = computed(() =>
  legacy.value
    ? 'Saved using the earlier quiz format.'
    : provisional.value
      ? 'Based on scenario choices; more rating evidence is needed.'
      : pickedAtRandom.value
        ? 'More tracks are tied than we can show here, so these were picked at random. Compare all four below.'
        : tied.value
          ? 'The leading tracks are tied. Display order does not break the tie.'
          : close.value
            ? 'Your leading tracks are close, so explore both.'
            : 'Two starting points based on your answers.',
);
const display = (value) => (typeof value === 'number' ? Math.round(value) : '-');
function retake() {
  if (quiz.hasDraft && !window.confirm('Replace your unfinished quiz with a new attempt?')) return;
  quiz.start();
  router.push('/quiz/attempt');
}
async function loadModules() {
  const id = attempt.value?.id;
  moduleSuggestions.value = null;
  moduleError.value = '';
  if (!id || legacy.value) return;
  moduleLoading.value = true;
  try {
    const suggestions = await api.quizModulesV2(id);
    if (attempt.value?.id === id) moduleSuggestions.value = suggestions;
  } catch {
    if (attempt.value?.id === id) moduleError.value = 'Module suggestions could not load.';
  } finally {
    if (attempt.value?.id === id) moduleLoading.value = false;
  }
}
watch(() => attempt.value?.id, loadModules, { immediate: true });
// The explanation only adds to the page; scores and modules never wait for it or depend on it
let explanationFor = null;
async function loadExplanation() {
  const id = attempt.value?.id;
  // A second click while this attempt is still loading would only send a duplicate request
  if (explanationLoading.value && id === explanationFor) return;
  explanationFor = id;
  explanation.value = null;
  explanationError.value = null;
  if (!id || legacy.value) return;
  explanationLoading.value = true;
  try {
    const result = await api.quizExplanationV2(id);
    if (attempt.value?.id === id) explanation.value = result;
  } catch (error) {
    if (attempt.value?.id === id)
      explanationError.value = error.status === 0 ? 'UNREACHABLE' : (error.code ?? 'AI_FAILED');
  } finally {
    if (attempt.value?.id === id) explanationLoading.value = false;
  }
}
watch(() => attempt.value?.id, loadExplanation, { immediate: true });
// A missing API key will not fix itself, so there is nothing to retry
const explanationRetryable = computed(() => explanationError.value !== 'AI_UNAVAILABLE');
const modulesFor = (track) =>
  moduleSuggestions.value?.groups.find((group) => group.track === track)?.modules ?? [];
onMounted(async () => {
  await quiz.initialize();
  loading.value = false;
});
</script>
<template>
  <div>
    <PageHeader
      overline="Track Finder"
      title="Your tracks to explore"
      subtitle="A guide to help you explore, not a prediction. Start with these two and open the details when you need them."
    />
    <div ref="layoutRef" class="mx-auto flex max-w-[1480px] justify-center gap-8 px-5 sm:px-12">
      <main ref="mainRef" class="flex min-w-0 max-w-5xl flex-1 flex-col gap-6 py-8">
        <p v-if="loading" role="status">Loading your saved result…</p>
        <div v-else-if="!attempt" class="card p-6">
          <p>{{ quiz.error || 'This result is no longer in your latest two attempts.' }}</p>
          <BaseButton class="mt-3" to="/quiz">Back to Track Finder</BaseButton>
        </div>
        <template v-else>
          <div>
            <h2 class="text-h4">
              {{ provisional ? 'Two tracks to explore provisionally' : 'Your leading tracks' }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ summaryNote }}</p>
          </div>

          <div
            v-if="isOlderResult(attempt)"
            role="status"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-primary-tint px-4 py-3"
          >
            <p class="text-sm">Saved under an earlier quiz version. Retake for an updated score.</p>
            <BaseButton size="sm" variant="outline" :disabled="quiz.loading" @click="retake"
              >Retake quiz</BaseButton
            >
          </div>

          <!-- The AI explanation lives in a side chat panel; this button opens it -->
          <button
            v-if="!legacy && !assistantOpen && !wide"
            type="button"
            class="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-primary py-2 pr-4 pl-2 text-[14px] font-semibold text-primary-foreground shadow-lg transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.98]"
            :aria-label="`Open explanation: ${topResults.length === 1 ? 'Why this track?' : 'Why these tracks?'}`"
            @click="assistantOpen = true"
          >
            <span class="flex shrink-0 rounded-full bg-primary-foreground p-0.5" aria-hidden="true"
              ><AssistantFace :size="28"
            /></span>
            Why?
            <span
              v-if="explanationLoading"
              class="size-2 animate-pulse rounded-full bg-primary-foreground/70"
              aria-hidden="true"
            />
          </button>

          <div ref="cardsRef" class="grid gap-4 md:grid-cols-2">
            <section
              v-for="(result, index) in topResults"
              :key="result.track"
              class="card flex flex-col gap-3 border-primary p-6"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium text-muted-foreground">{{
                  legacy ? `Position ${index + 1}` : `Rank ${result.rank}`
                }}</span>
                <span class="font-mono text-xl font-semibold">{{
                  legacy
                    ? `${display(result.pct)}%`
                    : provisional
                      ? 'Provisional'
                      : `${display(result.alignmentIndex)} /100`
                }}</span>
              </div>
              <h3 class="text-xl font-semibold leading-7">
                {{ quizTrackNames[result.track] ?? result.track }}
              </h3>
              <span class="text-xs text-muted-foreground">{{
                legacy
                  ? 'Earlier match score'
                  : provisional
                    ? 'Scenario preference ordering'
                    : blended
                      ? 'Quiz match score'
                      : 'Quiz alignment index'
              }}</span>
              <div v-if="modulesFor(result.track).length" class="mt-2 border-t border-border pt-4">
                <h4 class="mb-3 text-sm font-semibold">Modules to explore</h4>
                <ul class="flex flex-col gap-4">
                  <li v-for="module in modulesFor(result.track)" :key="module.code">
                    <a
                      :href="module.sourceUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-sm font-medium text-primary hover:underline"
                      >{{ module.code }} · {{ module.name }} ↗</a
                    >
                    <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {{ module.summary }}
                    </p>
                    <BaseButton
                      class="mt-2"
                      size="sm"
                      variant="outline"
                      :disabled="
                        addingModule !== null ||
                        planner.basketSaving ||
                        (planner.basket.includes(module.code) && !planner.basketError)
                      "
                      @click="addModule(module.code)"
                    >
                      {{
                        addingModule === module.code
                          ? 'Saving…'
                          : planner.basket.includes(module.code)
                            ? planner.basketSaving
                              ? 'Saving…'
                              : planner.basketError
                                ? 'Retry save'
                                : 'In planner basket'
                            : 'Add to planner basket'
                      }}
                    </BaseButton>
                  </li>
                </ul>
                <details class="mt-3 text-xs">
                  <summary class="cursor-pointer text-muted-foreground">Why these modules?</summary>
                  <ul class="mt-2 flex flex-col gap-2">
                    <li v-for="module in modulesFor(result.track)" :key="module.code">
                      <span class="font-medium">{{ module.code }}:</span> {{ module.reason }}
                      <span v-if="module.prerequisiteStatus === 'manual-review'"
                        >Additional course rules need checking.</span
                      >
                    </li>
                  </ul>
                </details>
              </div>
              <p
                v-else-if="moduleSuggestions && moduleSuggestions.intakeStatus !== 'unsupported'"
                class="text-xs text-muted-foreground"
              >
                {{
                  moduleSuggestions.catalogueStatus === 'unavailable'
                    ? 'The shared course catalogue is incomplete or has not been loaded.'
                    : 'No courses match your recorded completion and prerequisite information for this track.'
                }}
              </p>
            </section>
          </div>

          <p v-if="basketNotice" role="status" class="text-sm text-primary">{{ basketNotice }}</p>
          <div
            v-if="basketActionError || planner.basketError"
            role="alert"
            class="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ basketActionError || planner.basketError }}</p>
            <BaseButton variant="link" :disabled="planner.basketSaving" @click="retryBasket"
              >Retry saving basket</BaseButton
            >
          </div>
          <p v-if="moduleLoading" role="status" class="text-xs text-muted-foreground">
            Finding modules to explore…
          </p>
          <div v-if="moduleError" class="flex flex-wrap items-center gap-3 text-sm" role="status">
            <p>{{ moduleError }}</p>
            <BaseButton variant="link" @click="loadModules">Retry modules</BaseButton>
          </div>
          <p v-if="moduleSuggestions" class="text-xs text-muted-foreground">
            {{
              moduleSuggestions.intakeStatus === 'unsupported'
                ? 'This module guide covers AY2024 onwards. Check the curriculum for your intake.'
                : 'Shared IS AY2024 onwards catalogue · Recorded prerequisites checked; other course rules and current offerings need checking in OASIS/BOSS.'
            }}
            <a
              :href="moduleSuggestions.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
              >Official SMU curriculum ↗</a
            >
          </p>

          <details v-if="otherResults.length" class="card p-5">
            <summary class="cursor-pointer text-sm font-medium">Compare all four tracks</summary>
            <div class="mt-4 flex flex-col divide-y divide-border">
              <div
                v-for="(result, index) in attempt.results"
                :key="result.track"
                class="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span
                  >{{ legacy ? index + 1 : result.rank }}.
                  {{ quizTrackNames[result.track] ?? result.track }}</span
                >
                <span class="shrink-0 font-mono">{{
                  legacy
                    ? `${display(result.pct)}%`
                    : provisional
                      ? `${display(result.scenarioPreferenceIndex)} /100 scenario`
                      : `${display(result.alignmentIndex)} /100`
                }}</span>
              </div>
            </div>
          </details>

          <details v-if="!legacy" class="card p-5">
            <summary class="cursor-pointer text-sm font-medium">Understand your results</summary>
            <div class="mt-4 flex flex-col gap-5">
              <p v-if="blended" class="text-sm text-muted-foreground">
                Your match score combines your ratings and scenario choices equally. 50 means no lean towards
                or away from a track, and higher means your answers fit it better. It reflects what you told
                us, not your ability or your chance of success, and the track descriptions behind it are our
                own judgment rather than tested predictions. Scores are rounded; ranking uses full precision.
              </p>
              <p v-else class="text-sm text-muted-foreground">
                Alignment summarises your self-reported preferences and confidence, not ability or a
                probability of success. Scores are rounded; ranking uses full precision.
              </p>
              <p v-if="provisional" class="text-sm">
                No informative ratings for:
                {{ attempt.missingThemes.map((theme) => themes[theme]).join(', ') }}. Your ordering uses
                scenarios only.
              </p>
              <p v-if="contrasting" class="text-sm">
                Your scenario choices point toward a different track from your ratings. Consider both views.
              </p>
              <section>
                <h3 class="text-sm font-semibold">Rating themes</h3>
                <dl class="mt-2 grid gap-2 sm:grid-cols-2">
                  <div
                    v-for="(rating, theme) in attempt.themeRatings"
                    :key="theme"
                    class="rounded-md bg-muted p-3"
                  >
                    <dt class="text-sm">{{ themes[theme] }}</dt>
                    <dd class="text-sm font-medium">
                      {{ themeLevel(rating.index)
                      }}<span
                        v-if="rating.informativeCount < 2"
                        class="text-xs font-normal text-muted-foreground"
                      >
                        · {{ rating.informativeCount }}/2 ratings</span
                      >
                    </dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3 class="text-sm font-semibold">
                  {{
                    blended
                      ? 'Your match score by track'
                      : provisional
                        ? 'Your scenario preference by track'
                        : 'Your alignment by track'
                  }}
                </h3>
                <div class="mt-3">
                  <TrackScoreChart :results="attempt.results" :provisional="provisional" />
                </div>
              </section>
            </div>
          </details>

          <details v-if="!legacy" class="card p-5">
            <summary class="cursor-pointer text-sm font-medium">Review your answers</summary>
            <ol class="mt-4 flex flex-col gap-4">
              <li v-for="answer in attempt.answerLabels" :key="answer.questionId">
                <p class="text-sm font-medium">{{ answer.prompt }}</p>
                <p class="text-sm text-muted-foreground">{{ answer.label ?? 'Skipped' }}</p>
              </li>
            </ol>
          </details>
          <div class="flex flex-wrap gap-3 border-t border-border pt-4">
            <BaseButton to="/planner">Open What-If Planner</BaseButton>
            <BaseButton variant="outline" to="/quiz">Quiz history</BaseButton>
            <BaseButton variant="ghost" :disabled="quiz.loading" @click="retake">Retake quiz</BaseButton>
          </div>
        </template>
      </main>
      <!-- Docked: follows the reader down the page and stops where the page ends -->
      <div
        v-if="wide && attempt && !legacy"
        class="sticky top-20 h-[calc(100vh-6.5rem)] min-h-[480px] w-[440px] shrink-0 self-start"
        :style="{ marginTop: `${dockTop}px` }"
      >
        <QuizAssistant
          docked
          :title="topResults.length === 1 ? 'Why this track?' : 'Why these tracks?'"
          :loading="explanationLoading"
          :explanation="explanation"
          :error="explanationError"
          :retryable="explanationRetryable"
          :track-names="quizTrackNames"
          @retry="loadExplanation"
        />
      </div>
    </div>
    <QuizAssistant
      v-if="!legacy && !wide"
      :open="assistantOpen"
      :title="topResults.length === 1 ? 'Why this track?' : 'Why these tracks?'"
      :loading="explanationLoading"
      :explanation="explanation"
      :error="explanationError"
      :retryable="explanationRetryable"
      :track-names="quizTrackNames"
      @close="assistantOpen = false"
      @retry="loadExplanation"
    />
  </div>
</template>
