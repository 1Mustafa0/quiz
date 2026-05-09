import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

const OWNER_EMAIL = 'mstfyalswdany913@gmail.com';

interface AuthContextType {
  user: User | null;
  role: string | null;
  plan: 'free' | 'pro';
  loading: boolean;
  isQuizActive: boolean;
  setIsQuizActive: (active: boolean) => void;
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
  login: () => Promise<User>;
  logout: () => Promise<void>;
  refreshPlan: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [loading, setLoading] = useState(true);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const fetchPlan = async (firebaseUser: any): Promise<'free' | 'pro'> => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/user/plan', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.plan === 'pro' ? 'pro' : 'free';
      }
    } catch (e: any) {
      console.warn('[AuthContext] fetchPlan error:', e?.message);
    }
    return 'free';
  };

  const refreshPlan = async () => {
    if (!user) return;
    const p = await fetchPlan(user);
    setPlan(p);
  };

  const syncUserToServer = async (firebaseUser: any, userRole: string): Promise<'free' | 'pro'> => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/user/sync', {
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
      if (res.ok) {
        const data = await res.json();
        return data.plan === 'pro' ? 'pro' : 'free';
      }
    } catch (e: any) {
      console.warn('[AuthContext] syncUserToServer error:', e?.message);
    }
    return 'free';
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isOwner = firebaseUser.email === OWNER_EMAIL;
        let userRole: string = isOwner ? 'admin' : 'user';

        try {
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

        const userPlan = await syncUserToServer(firebaseUser, userRole);
        setPlan(userPlan);
        setRole(userRole);
      } else {
        setRole(null);
        setPlan('free');
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    const u = await loginWithGoogle();
    setUser(u);
    return u;
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setRole(null);
    setPlan('free');
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      plan,
      loading,
      isQuizActive,
      setIsQuizActive,
      showWelcome,
      setShowWelcome,
      login,
      logout: handleLogout,
      refreshPlan,
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
