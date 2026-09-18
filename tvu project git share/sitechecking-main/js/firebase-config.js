/**
 * TVU Books & Materials - Centralized Firebase Configuration
 * 
 * Instructions:
 * Replace the placeholder values below with your Firebase Project Configuration keys.
 * Obtain these from the Firebase Console (Project Settings -> General -> Your apps -> Web app).
 */

const firebaseConfig = {
  apiKey: "AIzaSyA-mEAgBkksHLLpTGz9fwOSFAWkhs_b61g",
  authDomain: "ecomerce-23100.firebaseapp.com",
  projectId: "ecomerce-23100",
  storageBucket: "ecomerce-23100.firebasestorage.app",
  messagingSenderId: "711521189701",
  appId: "1:711521189701:web:ec1031a888a24ce5d6882c",
  measurementId: "G-VDVXLM8F0F"
};

// Initialize Firebase (Compat SDK for robust bundleless vanilla JS execution)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global Firebase service instances
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Google Auth Settings
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configuration validation helper
function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" && 
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

// Export references to window for browser script access
window.auth = auth;
window.db = db;
window.googleProvider = googleProvider;
window.isFirebaseConfigured = isFirebaseConfigured;
