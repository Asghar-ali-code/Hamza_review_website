// Paste the config from Firebase console → Project settings → Your apps → Web app.
// These values are public by design. Do not put a service account or private key here.
// Security is the Firestore rules file, not a hidden config.

// Optional. Leave blank to ask guests to speak to Hamza about removing a review.
export const removalEmail = "";

export const firebaseConfig = {
  apiKey: "AIzaSyA5ZeqKVUqlIgfV3TwQw0MRkp7ZSrwIoYs",
  authDomain: "hamzareviews-14c94.firebaseapp.com",
  projectId: "hamzareviews-14c94",
  storageBucket: "hamzareviews-14c94.firebasestorage.app",
  messagingSenderId: "1001379782318",
  appId: "1:1001379782318:web:1a1829de8c46a4f7dc573f",
  measurementId: "G-SY5GZYJEC3",
};

export function isFirebaseConfigured(config = firebaseConfig) {
  if (!config || typeof config !== "object") return false;
  const placeholder = (value) => {
    const text = String(value || "").trim();
    return text.length < 8 || text.includes("YOUR_");
  };
  return !placeholder(config.apiKey) && !placeholder(config.projectId) && !placeholder(config.appId);
}
