<script setup>
import { useUserStore } from '@/stores/user'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import avatar64 from '@/assets/figma/avatar-64.svg'

const user = useUserStore()
</script>

<template>
  <div>
    <PageHeader overline="ACCOUNT · PRIVACY · CONNECTED APPS" title="Profile & Settings" />

    <main class="flex flex-col gap-5 px-16 py-6">
      <section class="card flex items-center gap-4 p-[22px]">
        <div class="relative size-16 shrink-0">
          <img :src="avatar64" alt="" class="absolute inset-0 size-16" />
          <span class="absolute inset-0 flex items-center justify-center text-[23px] font-semibold text-black">
            {{ user.profile.initials }}
          </span>
        </div>
        <div class="flex flex-col gap-0.5">
          <p class="text-h4">{{ user.profile.displayName }}</p>
          <p class="text-small text-muted-foreground">{{ user.profile.email }} · {{ user.degreeLabel }}</p>
        </div>
      </section>

      <section class="card flex flex-col gap-3.5 p-[22px]">
        <h2 class="text-h4">Student Email Consent &amp; Privacy Controls</h2>
        <p class="text-small text-muted-foreground">
          BidMaxxer requests read-only access (gmail.readonly) to parse academic emails into calendar events, and
          calendar.events to write them to your primary Google Calendar. Access is explicit and revocable at any time —
          BidMaxxer cannot send, delete, or modify your emails.
        </p>
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <p class="text-[14px] font-medium">Gmail deadline sync</p>
            <p class="text-small text-muted-foreground">gmail.readonly — parses academic emails into calendar events</p>
          </div>
          <ToggleSwitch v-model="user.consents.gmail" label="Gmail deadline sync" class="text-[14px] text-black" />
        </div>
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-0.5">
            <p class="text-[14px] font-medium">Outlook connector</p>
            <p class="text-small text-muted-foreground">Alternative connector for university Outlook inboxes</p>
          </div>
          <ToggleSwitch v-model="user.consents.outlook" label="Outlook connector" class="text-[14px] text-black" />
        </div>
        <div class="h-px bg-border" />
        <div class="flex items-center justify-between">
          <p class="text-small text-muted-foreground">
            Revoking removes BidMaxxer's access to your Gmail and Google Calendar immediately.
          </p>
          <BaseButton variant="destructive" @click="user.revokeAccess()">Revoke access</BaseButton>
        </div>
      </section>
    </main>
  </div>
</template>
