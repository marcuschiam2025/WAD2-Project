// import { cert, getApps, initializeApp } from 'firebase-admin/app'
// import { getAuth } from 'firebase-admin/auth'

// // Lazily initialise Firebase Admin from the service-account env vars.
// export function firebaseAuth() {
//   if (!getApps().length) {
//     const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env
//     if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
//       throw new Error('Firebase Admin credentials are missing — see .env.example')
//     }
//     initializeApp({
//       credential: cert({
//         projectId: FIREBASE_PROJECT_ID,
//         clientEmail: FIREBASE_CLIENT_EMAIL,
//         privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//       }),
//     })
//   }
//   return getAuth()
// }
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })

export const auth = getAuth(app)
export const db = getFirestore(app)

export async function verifyFirebase() {
  await auth.listUsers(1)
  console.log(`Firebase connected: ${process.env.FIREBASE_PROJECT_ID}`)
}