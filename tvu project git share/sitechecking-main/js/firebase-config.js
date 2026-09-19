/**
 * TVU Books & Materials - Centralized Firebase Configuration
 * Compat SDK configuration for vanilla JS execution.
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

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" && 
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

window.auth = auth;
window.db = db;
window.googleProvider = googleProvider;
window.isFirebaseConfigured = isFirebaseConfigured;