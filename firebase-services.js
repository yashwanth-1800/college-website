import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

const sameOriginAuth = window.location.hostname.endsWith(".vercel.app");

export const firebaseConfig = {
  apiKey: "AIzaSyD7NMp66LLaZYi_5uqbrbU-SFCJRCRyTmY",
  authDomain: sameOriginAuth ? window.location.hostname : "emergency-app-f2850.firebaseapp.com",
  projectId: "emergency-app-f2850",
  storageBucket: "emergency-app-f2850.firebasestorage.app",
  messagingSenderId: "206775317622",
  appId: "1:206775317622:web:8b051ba2dfe92858ca1b57",
};

export const app = getApps()[0] || initializeApp(firebaseConfig);
export const auth = getAuth(app);

let database;
try {
  database = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // initializeFirestore throws when another module has already obtained the instance.
  database = getFirestore(app);
}

export const db = database;
export const storage = getStorage(app);

