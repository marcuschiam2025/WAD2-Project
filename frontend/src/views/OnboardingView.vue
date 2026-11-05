<script setup>
// Onboarding: a new student fills in the degree form (components/DegreeForm.vue). Undecided students go to the quiz.
import { useRouter } from 'vue-router';
import DegreeForm from '@/components/DegreeForm.vue';
import iconBack from '@/assets/v2/back.svg';

const router = useRouter();

function finished({ undecided }) {
  router.push(undecided ? '/quiz/attempt' : '/dashboard');
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex items-center gap-4 bg-card px-8 py-5">
      <button
        type="button"
        class="rounded-md border border-border bg-card p-2 hover:bg-muted"
        @click="router.push('/')"
      >
        <img :src="iconBack" alt="" class="size-4" />
      </button>
      <p class="text-overline text-muted-foreground">Set up your profile</p>
    </header>

    <main class="flex flex-1 justify-center px-8 pt-12 pb-16">
      <div class="flex w-[720px] max-w-full flex-col gap-6">
        <div class="flex flex-col gap-1.5">
          <h1 class="text-[30px] leading-normal font-bold tracking-[-0.3px]">Tell us about your degree</h1>
          <p class="text-[15px] text-muted-foreground">
            We use this to build your roadmap, check prerequisites and work out how much you can bid.
          </p>
        </div>
        <DegreeForm @saved="finished" />
      </div>
    </main>
  </div>
</template>
