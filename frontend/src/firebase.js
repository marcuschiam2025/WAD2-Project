// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDRTsdOu92a276oYDb7eYPWBcgcz1Q4tmQ",
  authDomain: "wad2-project-cced0.firebaseapp.com",
  projectId: "wad2-project-cced0",
  storageBucket: "wad2-project-cced0.firebasestorage.app",
  messagingSenderId: "874499744467",
  appId: "1:874499744467:web:b654a7a82ebf24a9d7aa26",
  measurementId: "G-Z27YPCGMFK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);