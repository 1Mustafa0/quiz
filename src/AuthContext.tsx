import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout } from './firebaseAuth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { OWNER_EMAIL } from './utils/owner';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  loginLoading: boolean;
  loginError: string | null;
  isQuizActive: boolean;
  setIsQuizActive: (active: boolean) => void;
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
  login: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const syncUserToServer = async (firebaseUser: any, userRole: string) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || null,
          role: userRole,
        }),
      });
    } catch (e: any) {
      console.warn('[AuthContext] syncUserToServer error:', e?.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isOwner = firebaseUser.email === OWNER_EMAIL;
        let userRole: string = isOwner ? 'admin' : 'user';

        try {
          const [{ db }, { doc, getDoc, setDoc, updateDoc, Timestamp }] = await Promise.all([
            import('./firebase'),
            import('firebase/firestore'),
          ]);
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef).catch(() => null);

          if (userDoc && userDoc.exists()) {
            const data = userDoc.data();
            userRole = isOwner ? 'admin' : (data.role || 'user');

            const updates: Record<string, string | null> = {};
            if (firebaseUser.email && data.email !== firebaseUser.email) updates.email = firebaseUser.email;
            if (firebaseUser.displayName && data.displayName !== firebaseUser.displayName) updates.displayName = firebaseUser.displayName;
            if (data.photoURL !== (firebaseUser.photoURL || null)) updates.photoURL = firebaseUser.photoURL || null;
            if (isOwner && data.role !== 'admin') updates.role = 'admin';
            if (Object.keys(updates).length > 0) {
              updateDoc(userRef, updates).catch(() => {});
            }
          } else {
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || null,
              role: userRole,
              createdAt: Timestamp.now(),
            };

            const firestoreOk = await setDoc(userRef, newProfile)
              .then(() => true)
              .catch((err) => {
                console.warn('[AuthContext] Direct Firestore write failed:', err?.code, err?.message);
                return false;
              });

            if (!firestoreOk) {
              try {
                const idToken = await firebaseUser.getIdToken();
                await fetch('/api/user/ensure-profile', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                  body: JSON.stringify({ profileData: { ...newProfile, createdAt: undefined } }),
                });
              } catch (fallbackErr: any) {
                console.error('[AuthContext] Server fallback error:', fallbackErr?.message);
              }
            }
            setShowWelcome(true);
          }
        } catch (err) {
          console.error('Auth profile error:', err);
        }

        await syncUserToServer(firebaseUser, userRole);
        setRole(userRole);
      } else {
        setRole(null);
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    setLoginLoading(true);
    setLoginError(null);

    try {
      const u = await loginWithGoogle();
      setUser(u);
      return u;
    } catch (err: any) {
      const message = err?.message || 'تعذر تسجيل الدخول. حاول مرة أخرى.';
      setLoginError(message);
      throw err;
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loading,
      loginLoading,
      loginError,
      isQuizActive,
      setIsQuizActive,
      showWelcome,
      setShowWelcome,
      login,
      logout: handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
