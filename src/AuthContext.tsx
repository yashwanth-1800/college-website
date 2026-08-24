import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./lib/firebase";
import type { Profile, Role } from "./types";

type AuthValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  updateRole: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;

        setUser(currentUser);

        if (!currentUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        try {
          const profileReference = doc(db, "users", currentUser.uid);
          const profileSnapshot = await getDoc(profileReference);

          if (!profileSnapshot.exists()) {
            await setDoc(profileReference, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(
              profileReference,
              {
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }

          const savedProfile = await getDoc(profileReference);
          if (active) {
            setProfile(savedProfile.data() as Profile);
            setAuthError("");
          }
        } catch (error) {
          if (active) {
            setProfile(null);
            setAuthError(
              error instanceof Error
                ? `Signed in, but the profile could not load: ${error.message}`
                : "Signed in, but the profile could not load.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      });

    getRedirectResult(auth).catch((error: unknown) => {
      if (!active) return;
      const code = (error as { code?: string }).code;
      setAuthError(
        code === "auth/web-storage-unsupported"
          ? "This browser blocked the secure Google sign-in storage. Open the site in Chrome, Edge, or Safari and try again."
          : error instanceof Error
            ? error.message
            : "Google sign-in could not be completed.",
      );
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError("");
    // A same-tab redirect works in embedded and mobile browsers that close OAuth popups.
    await signInWithRedirect(auth, googleProvider);
  };

  const updateRole = async (role: Role) => {
    if (!user) throw new Error("You must be signed in to choose a role.");

    const profileReference = doc(db, "users", user.uid);
    const profileSnapshot = await getDoc(profileReference);
    const profileData: Profile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role,
    };

    if (profileSnapshot.exists()) {
      await setDoc(
        profileReference,
        { role, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } else {
      await setDoc(profileReference, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    setProfile(profileData);
    setAuthError("");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        signInWithGoogle,
        updateRole,
        signOut: async () => {
          setProfile(null);
          setAuthError("");
          await firebaseSignOut(auth);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("AuthProvider missing");
  }

  return context;
};

