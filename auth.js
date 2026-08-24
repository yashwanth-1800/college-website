import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7NMp66LLaZYi_5uqbrbU-SFCJRCRyTmY",
  authDomain: "emergency-app-f2850.firebaseapp.com",
  projectId: "emergency-app-f2850",
  storageBucket: "emergency-app-f2850.firebasestorage.app",
  messagingSenderId: "206775317622",
  appId: "1:206775317622:web:8b051ba2dfe92858ca1b57",
};

const SESSION_KEY = "campusEmergencySession";
const ROLES = ["Student", "Volunteer", "Doctor"];
const app = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(app);

let currentUser = null;
let authStateReady = false;
let resolveReady;
const readyPromise = new Promise((resolve) => {
  resolveReady = resolve;
});

function readStoredSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (
      !value ||
      !ROLES.includes(value.role) ||
      typeof value.uid !== "string" ||
      typeof value.email !== "string" ||
      typeof value.timestamp !== "string"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Firebase can still sign out if browser session storage is unavailable.
  }
}

function getSession() {
  const storedSession = readStoredSession();
  if (!currentUser || !storedSession || storedSession.uid !== currentUser.uid) return null;
  return storedSession;
}

function chooseRole(role) {
  if (!currentUser || !ROLES.includes(role)) return null;

  const session = {
    uid: currentUser.uid,
    email: currentUser.email || "Google account",
    name: currentUser.displayName || currentUser.email || "Google user",
    role,
    timestamp: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || user.email || "Google user",
    photoURL: user.photoURL || "",
  };
}

function emitAuthState(error = "") {
  window.dispatchEvent(
    new CustomEvent("google-auth-state", {
      detail: { ready: authStateReady, user: publicUser(currentUser), error },
    }),
  );
}

async function signInWithGoogle() {
  window.dispatchEvent(new CustomEvent("google-auth-progress", { detail: "Opening the Google account chooser…" }));
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(firebaseAuth, provider);
    return true;
  } catch (error) {
    const messages = {
      "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
      "auth/popup-closed-by-user": "The Google sign-in window was closed before sign-in finished.",
      "auth/cancelled-popup-request": "A Google sign-in request is already open.",
      "auth/unauthorized-domain": "This website is not authorized for Google sign-in yet.",
      "auth/account-exists-with-different-credential": "This email is already linked to another sign-in method.",
    };
    emitAuthState(messages[error?.code] || "Google sign-in failed. Please try again.");
    return false;
  }
}

async function logout() {
  clearStoredSession();
  await signOut(firebaseAuth);
}

window.Auth = {
  chooseRole,
  getSession,
  getUser: () => publicUser(currentUser),
  isReady: () => authStateReady,
  logout,
  roles: [...ROLES],
  signInWithGoogle,
  whenReady: () => readyPromise,
};

window.dispatchEvent(new Event("auth-module-ready"));

try {
  await setPersistence(firebaseAuth, browserLocalPersistence);
} catch {
  // Firebase uses an available fallback when durable persistence is unavailable.
}

onAuthStateChanged(
  firebaseAuth,
  (user) => {
    currentUser = user;
    authStateReady = true;
    if (!user) clearStoredSession();
    resolveReady();
    emitAuthState();
  },
  () => {
    currentUser = null;
    authStateReady = true;
    clearStoredSession();
    resolveReady();
    emitAuthState("Google authentication could not be initialized. Refresh the page and try again.");
  },
);

