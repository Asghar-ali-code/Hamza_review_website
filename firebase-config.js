// Paste the config from Firebase console → Project settings → Your apps → Web app.
// These values are public by design. Do not put a service account or private key here.
// Security is the Firestore rules file, not a hidden config.

// Optional. Leave blank to ask guests to speak to Hamza about removing a review.
export const removalEmail = "";

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export function isFirebaseConfigured(config = firebaseConfig) {
  if (!config || typeof config !== "object") return false;
  const placeholder = (value) => {
    const text = String(value || "").trim();
    return text.length < 8 || text.includes("YOUR_");
  };
  return !placeholder(config.apiKey) && !placeholder(config.projectId) && !placeholder(config.appId);
}
