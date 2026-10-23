//import functions from firebase's own library
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = getApps().length
  ? getApps()[0] //if getApps().length >0, evaluates to true, firebase connection is already set up, reuse that connection
  : initializeApp({
      //else, initialise firebase

      //The following puts the relevant id,email and key in the format required by the firebase function:
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });

//Exports 1 object:
//auth used by middleware function requireAuth() to verify login token
//(user info such as role is stored in MongoDB, see features/auth/models/User.js)
export const auth = getAuth(app);

//Exports 1 function:
//verifyFirebase() checks that the firebase connection is working properly and prints the success message on the console
export async function verifyFirebase() {
  await auth.listUsers(1);
  console.log(`Firebase connected: ${process.env.FIREBASE_PROJECT_ID}`);
}
