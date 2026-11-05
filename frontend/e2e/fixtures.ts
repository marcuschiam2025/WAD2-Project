// Every E2E test imports test and expect from here instead of '@playwright/test'. It's the same test, plus a reset that
// runs automatically before each one (see reset.ts), so each test starts from the same account state.
import { test as base, expect } from '@playwright/test';
import { resetTestData } from './reset';

export const test = base.extend<{ resetTestData: void }>({
  resetTestData: [
    async ({}, use, testInfo) => {
      await resetTestData(testInfo.title);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
