/* ============================================================
 *  ☁️ OPTIONAL — Firebase cloud sync (Firestore)
 *  Local browser storage (IndexedDB/localStorage) সবসময় কাজ করবেই।
 *  Cloud sync চাইলে:
 *   1. https://console.firebase.google.com → নতুন project
 *   2. Build → Firestore Database → Create database
 *   3. Project settings → Your apps → Web (</>) → config কপি
 *   4. নিচে FIREBASE_CONFIG-এ paste করে FIREBASE_SYNC = true দাও
 *   5. index.html-এ firebase এর দুটো <script> tag uncomment করো
 *  নোট: শুধু question packs + settings sync হয়; images device-এ থাকে।
 * ============================================================ */
window.FIREBASE_CONFIG = null;
/* উদাহরণ:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
*/
window.FIREBASE_SYNC = false;
