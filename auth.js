import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { auth as firebaseAuth, db } from "./firebase-services.js";

const usesSameOriginRedirect = window.location.hostname.endsWith(".vercel.app");
const VERCEL_AUTH_DOMAIN = usesSameOriginRedirect ? window.location.hostname : "";
const SESSION_KEY = "campusEmergencySession";
const ROLES = ["Student", "Volunteer", "Doctor", "Administrator"];

let currentUser = null;
let currentProfile = null;
let unsubscribeProfile = null;
let authStateReady = false;
let resolveReady;
const readyPromise = new Promise((resolve) => {
  resolveReady = resolve;
});

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => window.clearTimeout(timer));
}

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
  if (!currentUser || !currentProfile || currentProfile.status !== "active" || !ROLES.includes(currentProfile.role)) return null;
  return {
    uid: currentUser.uid,
    email: currentUser.email || "Google account",
    name: currentUser.displayName || currentUser.email || "Google user",
    role: currentProfile.role,
    timestamp: currentProfile.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
  };
}

function chooseRole(role) {
  // The selected browser control is no longer an authority. Firestore supplies
  // the assigned role and Security Rules enforce it for every data operation.
  if (!ROLES.includes(role) || role !== currentProfile?.role) return null;
  return getSession();
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
      detail: { ready: authStateReady, user: publicUser(currentUser), profile: currentProfile, error },
    }),
  );
}

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    if (usesSameOriginRedirect) {
      window.dispatchEvent(new CustomEvent("google-auth-progress", { detail: "Redirecting securely to Google…" }));
      await signInWithRedirect(firebaseAuth, provider);
      return true;
    }

    window.dispatchEvent(new CustomEvent("google-auth-progress", { detail: "Opening the Google account chooser…" }));
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
  unsubscribeProfile?.();
  unsubscribeProfile = null;
  currentProfile = null;
  await signOut(firebaseAuth);
}

window.Auth = {
  chooseRole,
  getSession,
  getUser: () => publicUser(currentUser),
  getProfile: () => currentProfile,
  getIdToken: async () => currentUser?.getIdToken() || "",
  isReady: () => authStateReady,
  logout,
  roles: [...ROLES],
  signInWithGoogle,
  whenReady: () => readyPromise,
};

window.dispatchEvent(new Event("auth-module-ready"));

async function initializeAuthentication() {
  try {
    await setPersistence(firebaseAuth, browserLocalPersistence);
  } catch {
    // Firebase uses an available fallback when durable persistence is unavailable.
  }

  let redirectError = "";
  if (usesSameOriginRedirect) {
    try {
      await getRedirectResult(firebaseAuth);
    } catch {
      redirectError = "Google sign-in could not be completed. Please try again.";
    }
  }

  onAuthStateChanged(
    firebaseAuth,
    async (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      currentUser = user;
      currentProfile = null;
      if (!user) {
        clearStoredSession();
        authStateReady = true;
        resolveReady();
        emitAuthState(redirectError);
        return;
      }

      const profileReference = doc(db, "users", user.uid);
      try {
        const snapshot = await withTimeout(
          getDoc(profileReference),
          20000,
          "Firebase did not return your access profile. Check your connection and refresh the page.",
        );
        if (!snapshot.exists()) {
          await setDoc(profileReference, {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "Campus user",
            photoURL: user.photoURL || "",
            role: "Student",
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const existing = snapshot.data();
          const legacyRoles = { student: "Student", volunteer: "Volunteer", doctor: "Doctor", administrator: "Administrator" };
          const normalizedRole = ROLES.includes(existing.role) ? existing.role : legacyRoles[existing.role] || "Student";
          await setDoc(profileReference, {
            email: user.email || "",
            displayName: user.displayName || "Campus user",
            photoURL: user.photoURL || "",
            role: normalizedRole,
            status: existing.status === "suspended" ? "suspended" : "active",
            lastSeenAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
        unsubscribeProfile = onSnapshot(profileReference, (profileSnapshot) => {
          currentProfile = profileSnapshot.exists() ? profileSnapshot.data() : null;
          authStateReady = true;
          resolveReady();
          emitAuthState(redirectError);
        }, (error) => {
          authStateReady = true;
          resolveReady();
          emitAuthState(`Your access profile could not be loaded: ${error.message}`);
        });
      } catch (error) {
        authStateReady = true;
        resolveReady();
        emitAuthState(`Your secure profile could not be initialized: ${error?.message || "Unknown error"}`);
      }
    },
    () => {
      currentUser = null;
      authStateReady = true;
      clearStoredSession();
      resolveReady();
      emitAuthState("Google authentication could not be initialized. Refresh the page and try again.");
    },
  );
}

initializeAuthentication();

