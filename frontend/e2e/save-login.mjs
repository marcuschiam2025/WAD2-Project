// Saves a signed-in session for the E2E tests, so nobody types their account details during a test run.
// Start the frontend and backend, then run this from frontend/ and log in using the browser window:
//   node e2e/save-login.mjs student-a
// The account must already be onboarded. The saved file works like a password: never commit or share it.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const name = process.argv[2] ?? 'student-a'
const authDir = new URL('../playwright/.auth/', import.meta.url)
mkdirSync(authDir, { recursive: true })

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext()
const page = await context.newPage()

await page.goto('http://localhost:5173/signin')
console.log('Log in using the browser window...')

// Gives you 5 minutes to log in, and continues once you reach the dashboard
await page.waitForURL('**/dashboard', { timeout: 300_000 })

// Firebase keeps its login in IndexedDB, which storageState leaves out by default
await context.storageState({ path: fileURLToPath(new URL(`${name}.json`, authDir)), indexedDB: true })
console.log(`Saved playwright/.auth/${name}.json`)
await browser.close()
