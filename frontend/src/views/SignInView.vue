<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import logo from '@/assets/bidmaxxer_logo.png'
import iconGoogle from '@/assets/figma/icon-google.svg'
import iconLock from '@/assets/figma/icon-lock.svg'

const router = useRouter()
const user = useUserStore()

// TODO(Backend 2): swap for Firebase signInWithPopup(GoogleAuthProvider) restricted to @smu.edu.sg
function continueWithGoogle() {
  user.signIn()
  router.push(user.onboarded ? '/dashboard' : '/onboarding')
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center p-4">
    <div class="flex w-[440px] flex-col items-center gap-5 rounded-xl border border-border bg-card px-11 pb-10 shadow-lg">
      <div class="grid">
        <div class="col-start-1 row-start-1 mt-[29.73px] ml-[5.64px] h-[168.179px] w-[149.596px] bg-white" />
        <img :src="logo" alt="BidMaxxer" class="col-start-1 row-start-1 h-[223px] w-[154.966px] object-cover" />
      </div>
      <p class="text-[22px] font-bold">Bid<span class="text-primary">Maxxer</span></p>
      <div class="flex flex-col gap-1.5 text-center">
        <h1 class="text-h2">Sign in to plan your degree</h1>
        <p class="text-body text-muted-foreground">
          Use your SMU Google account so we can pull in your modules and BOSS history.
        </p>
      </div>
      <button
        type="button"
        class="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-card px-4 text-[14px] font-medium hover:bg-muted"
        @click="continueWithGoogle"
      >
        <img :src="iconGoogle" alt="" class="size-[18px]" />
        Continue with Google
      </button>
      <div class="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2.5">
        <img :src="iconLock" alt="" class="size-3.5" />
        <p class="flex-1 text-[12px] text-muted-foreground">
          Only @smu.edu.sg accounts. We never post or send email on your behalf.
        </p>
      </div>
      <p class="text-center text-[12px] text-muted-foreground">By continuing you agree to the Terms and Privacy Policy.</p>
    </div>
  </main>
</template>
