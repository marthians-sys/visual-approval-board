// ── Firebase Configuration ──
// Replace the config below with your Firebase project config

const firebaseConfig = {
  apiKey: "AIzaSyCAZJGCpBipK0_qTe0Idw0UquuTPy1QHqM",
  authDomain: "system-schvalovani-vizualu.firebaseapp.com",
  projectId: "system-schvalovani-vizualu",
  storageBucket: "system-schvalovani-vizualu.firebasestorage.app",
  messagingSenderId: "605372267986",
  appId: "1:605372267986:web:ed9f78221e872a84685c0b"
};

let firebaseReady = false;
let firebaseUser = null;
let db = null;
let fbStorage = null;

// Check if Firebase config is set
const firebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

if (firebaseConfigured && typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  fbStorage = firebase.storage();

  // Anonymous auth
  firebase.auth().signInAnonymously()
    .then((cred) => {
      firebaseUser = cred.user;
      firebaseReady = true;
      console.log('[Firebase] Authenticated anonymously:', firebaseUser.uid);
      // Start sync after auth
      if (typeof firebaseStartSync === 'function') {
        firebaseStartSync();
      }
    })
    .catch((err) => {
      console.warn('[Firebase] Auth failed:', err);
      // Show visible error so user knows sync won't work
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;padding:8px 14px;border-radius:8px;background:#ef4444;color:#fff;font:400 12px "DM Mono",monospace;';
      errDiv.textContent = 'Firebase auth failed — check console';
      document.body.appendChild(errDiv);
    });
} else {
  if (!firebaseConfigured) {
    console.log('[Firebase] Not configured — running in local-only mode');
  }
}
