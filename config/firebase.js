const { initializeApp } = require("firebase/app");
const { getStorage } = require("firebase/storage");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

let storage = null;

if (!firebaseConfig.projectId) {
  console.warn("\n⚠️ WARNING: Firebase environment variables are missing in your .env file.");
  console.warn("Uploads and downloads of Notes & Question Banks to/from Firebase Storage will not function until they are set.\n");
} else {
  try {
    const app = initializeApp(firebaseConfig);
    storage = getStorage(app);
  } catch (err) {
    console.error("❌ ERROR: Failed to initialize Firebase Storage:", err.message);
  }
}

module.exports = { storage };
