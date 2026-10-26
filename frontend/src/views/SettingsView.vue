<script setup>
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
</script>

<template>
  <div>
    <PageHeader overline="Account · Calendar access" title="Settings" />

    <main class="flex flex-col gap-6 px-5 pt-8 pb-12 lg:px-16">
      <div v-enter class="flex flex-col gap-1">
        <h2 class="text-h3">Calendar export</h2>
        <p class="text-[14px] text-muted-foreground">Manage how you add your saved classes to a calendar.</p>
      </div>

      <section v-enter="0.05" class="card flex max-w-3xl flex-col gap-4 p-5" aria-labelledby="google-calendar-heading">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 id="google-calendar-heading" class="text-h4">Google Calendar</h3>
          <StatusPill tone="neutral">On-demand permission</StatusPill>
        </div>
        <p class="text-sm">Calendar access is requested separately when you add classes from your saved bidding plans. Signing in to BidMaxxer alone does not grant Calendar access.</p>
        <p class="text-sm text-muted-foreground">This page does not verify your current Google permission status. Google may ask for Calendar permission when you select “Add to Google Calendar”.</p>
        <div class="flex flex-col gap-2 border-t border-border pt-4">
          <h4 class="font-semibold">What the permission allows</h4>
          <p class="text-sm text-muted-foreground">Google's Calendar permission allows viewing and editing events on your calendars. BidMaxxer uses it to add the saved class timetable you select.</p>
          <a href="https://developers.google.com/workspace/calendar/api/auth" target="_blank" rel="noopener" class="self-start text-sm font-medium text-primary hover:underline">Google Calendar permission details ↗</a>
        </div>
        <div class="flex flex-col items-start gap-3 border-t border-border pt-4">
          <BaseButton to="/bidding/finalised">Open saved bidding plans</BaseButton>
          <p class="text-sm text-muted-foreground">You can also download a calendar file from your saved plans and import it into another calendar app.</p>
        </div>
      </section>

      <section v-enter="0.1" class="card flex max-w-3xl flex-col items-start gap-3 p-5" aria-labelledby="google-access-heading">
        <h3 id="google-access-heading" class="text-h4">Manage Google access</h3>
        <p class="text-sm text-muted-foreground">Review or remove permissions granted to BidMaxxer in your Google Account.</p>
        <BaseButton variant="outline" href="https://myaccount.google.com/connections">Manage access in Google ↗</BaseButton>
      </section>
    </main>
  </div>
</template>
