<script setup>
// Plan settings for the active What-If plan: current semester, tracks, exchange terms, add semester, delete plan.
// Not a separate Figma frame: it holds the controls the V2 planner moved behind the "Plan settings" button.
import { computed } from 'vue';
import { usePlannerStore } from '@core/stores/planner';
import { useCatalogueStore } from '@core/stores/catalogue';
import BaseModal from '@/components/ui/BaseModal.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import SelectField from '@/components/ui/SelectField.vue';
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue';
import iconX from '@/assets/figma/icon-x.svg';

const emit = defineEmits(['close']);
const planner = usePlannerStore();
const catalogue = useCatalogueStore();
const plan = computed(() => planner.activePlan);

const semesterOptions = computed(() =>
  plan.value.semesters
    .filter((s) => !s.loa)
    .map((s) => ({ value: s.id, label: s.label.replace('S', 'Sem ') })),
);
// Only the tracks on this plan's curriculum
const trackOptions = computed(() =>
  catalogue.tracksFor(plan.value.majorId).map((t) => ({ value: t.code, label: t.name })),
);
const firstTrackOptions = computed(() => [{ value: '', label: 'Not decided' }, ...trackOptions.value]);
const secondTrackOptions = computed(() => [
  { value: '', label: 'None' },
  ...trackOptions.value.filter((o) => o.value !== plan.value.tracks[0]),
]);
const firstTrack = computed({
  get: () => plan.value.tracks[0] ?? '',
  // A 2nd track needs a 1st, so "Not decided" clears both
  set: (v) => (plan.value.tracks = v ? [v, ...plan.value.tracks.slice(1).filter((c) => c !== v)] : []),
});
const secondTrack = computed({
  get: () => plan.value.tracks[1] ?? '',
  set: (v) => (plan.value.tracks = v ? [plan.value.tracks[0], v] : [plan.value.tracks[0]]),
});

// Only semesters that haven't happened yet can become exchange terms
const futureSems = computed(() =>
  plan.value.semesters.filter((s) => !s.loa && planner.semStatus(plan.value, s.id) !== 'done'),
);

async function deletePlan() {
  if (await planner.deletePlan(plan.value.id)) emit('close');
}
</script>

<template>
  <BaseModal width="w-[480px]" @close="emit('close')">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <p class="text-overline text-primary">{{ plan.name }}</p>
        <h2 class="text-h3">Plan settings</h2>
      </div>
      <button type="button" class="rounded-sm p-0.5 hover:bg-muted" @click="emit('close')">
        <img :src="iconX" alt="" class="size-4" />
      </button>
    </div>

    <SelectField v-model="plan.currentSem" label="Current semester" :options="semesterOptions" />
    <SelectField v-model="firstTrack" label="1st track" :options="firstTrackOptions" />
    <SelectField v-if="firstTrack" v-model="secondTrack" label="2nd track" :options="secondTrackOptions" />

    <div class="flex flex-col gap-2">
      <p class="text-[13px] font-medium">Exchange semesters</p>
      <div class="grid grid-cols-3 gap-2">
        <ToggleSwitch
          v-for="s in futureSems"
          :key="s.id"
          :model-value="s.exchange"
          class="text-[13px]"
          @update:model-value="planner.toggleExchange(s.id)"
          >{{ s.label }}</ToggleSwitch
        >
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <BaseButton
        variant="destructive-outline"
        size="sm"
        :disabled="!planner.online || planner.planActionPending || planner.plans.length <= 1"
        @click="deletePlan"
      >
        Delete plan
      </BaseButton>
      <div class="flex flex-wrap gap-2">
        <BaseButton
          v-if="planner.removableSemester"
          variant="outline"
          size="sm"
          @click="planner.removeSemester()"
          >Remove {{ planner.removableSemester.label }}</BaseButton
        >
        <BaseButton
          variant="outline"
          size="sm"
          :disabled="!planner.canAddSemester"
          @click="planner.addSemester()"
          >Add semester</BaseButton
        >
        <BaseButton size="sm" @click="emit('close')">Done</BaseButton>
      </div>
    </div>
    <p v-if="!planner.canAddSemester" class="text-sm text-muted-foreground">
      Semester limit reached (Y9 · S2).
    </p>
    <p v-if="planner.planActionPending" role="status" class="text-sm text-muted-foreground">
      Updating plans…
    </p>
    <p v-if="planner.planActionError || planner.syncError" role="alert" class="text-sm text-destructive">
      {{ planner.planActionError || planner.syncError }}
    </p>
  </BaseModal>
</template>
