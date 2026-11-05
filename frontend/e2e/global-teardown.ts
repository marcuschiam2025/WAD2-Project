// Runs once after the E2E tests: one last reset, so the accounts end the run the way they started it
import { resetTestData } from './reset';

export default async function globalTeardown() {
  await resetTestData();
}
