<script setup>
import { useRouter } from 'vue-router';
import { useUserStore } from '@core/stores/user';
import BrandLogo from '@/components/layout/BrandLogo.vue';
import logo from '@/assets/bidmaxxer_logo.png';
import iconInfo from '@/assets/v2/info-primary-16.svg';
import iconGoogle from '@/assets/v2/google.svg';

const router = useRouter();
const user = useUserStore();

async function continueWithGoogle() {
  try {
    await user.signIn();
    await router.push(
      user.profile.role === 'admin' ? '/admin' : user.onboarded ? '/dashboard' : '/onboarding',
    );
  } catch {
    /* The store exposes the sign-in error below. */
  }
}
</script>

<template>
  <main class="flex min-h-screen">
    <section class="flex w-full flex-col justify-center gap-4 bg-card px-6 py-12 md:w-1/2 lg:px-20">
      <div v-stagger class="flex w-[420px] max-w-full flex-col gap-4">
        <!-- motion: sign-in form elements stagger in -->
        <BrandLogo large />
        <h1 class="text-[32px] leading-normal font-bold tracking-[-0.32px]">Sign in to plan your degree</h1>
        <p class="text-[15px] leading-[22px] text-muted-foreground">
          Save your quiz results and degree plans securely. You will enter your completed modules during
          setup.
        </p>
        <div class="flex items-center justify-center gap-2 rounded-md bg-primary-tint px-3 py-2.5">
          <img :src="iconInfo" alt="" class="icon-accent size-4" />
          <p class="text-center text-[13px] font-medium">Students: use your @smu.edu.sg Google account</p>
        </div>
        <button
          type="button"
          class="flex items-center justify-center gap-2.5 rounded-md border border-border bg-card px-4 py-3 text-[14px] font-medium transition-colors hover:bg-muted active:scale-[0.99]"
          :disabled="user.busy"
          @click="continueWithGoogle"
        >
          <img :src="iconGoogle" alt="" data-keep class="size-[18px]" />
          {{ user.busy ? 'Signing in…' : 'Continue with Google' }}
        </button>
        <p v-if="user.error" role="alert" class="text-sm text-destructive">{{ user.error }}</p>
        <p class="text-[12px] leading-[18px] text-muted-foreground">
          Authorised staff can use their registered Google account. Google shares your name and email to
          identify your account.
        </p>
      </div>
    </section>

    <!-- Art panel -->
    <section
      class="hidden w-1/2 flex-col items-center md:flex justify-center gap-5 border-l border-border bg-primary-tint p-16"
    >
      <img v-enter="0.1" :src="logo" alt="" class="h-[374px] w-[260px] object-contain" />
      <!-- motion: hero image fades in, 100ms delay -->
    </section>
  </main>
</template>
