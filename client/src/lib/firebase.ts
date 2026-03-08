
// Import Firebase SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration from original shared.js
const firebaseConfig = {
    apiKey: "AIzaSyBrtOCOwXp8UloT0nDqzQDpZpHgtrJUQBs",
    authDomain: "legal-13d13.firebaseapp.com",
    projectId: "legal-13d13",
    storageBucket: "legal-13d13.appspot.com",
    messagingSenderId: "482238213242",
    appId: "1:482238213242:web:435d5002b58d97b3349fc3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// App ID constant from original code
export const FIREBASE_APP_ID = 'legal-13d13';
