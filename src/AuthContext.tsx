import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout } from './firebaseAuth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { OWNER_EMAIL } from './utils/owner';

type PlanId = 'free' | 'starter' | 'pro' | 'premium';

interface AuthContextType {
  user: User | null;
  role: string | null;
  plan: PlanId | null;
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
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isOwner = firebaseUser.email === OWNER_EMAIL;
        let userRole: string = isOwner ? 'admin' : 'user';
        let userPlan: PlanId = isOwner ? 'premium' : 'free';

        try {
          const [{ db }, { doc, getDoc, setDoc, Timestamp }] = await Promise.all([
            import('./firebase'),
            import('firebase/firestore'),
          ]);
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef).catch(() => null);
          const existingData = userDoc?.exists() ? userDoc.data() : null;

          userRole = isOwner ? 'admin' : (existingData?.role || 'user');
          userPlan = isOwner ? 'premium' : ((existingData?.plan || 'free') as PlanId);

          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || null,
            role: userRole,
            plan: userPlan,
            createdAt: existingData?.createdAt || Timestamp.now(),
            lastLoginAt: Timestamp.now(),
          }, { merge: true });

          if (!existingData) {
            setShowWelcome(true);
          }
        } catch (err: any) {
          console.warn('[AuthContext] Firestore profile sync failed:', err?.code, err?.message);
          console.error('Auth profile error:', err);
        }

        try {
          const token = await firebaseUser.getIdToken();
          const response = await fetch('/api/user/plan', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            userPlan = (data?.plan || userPlan) as PlanId;
          }
        } catch (err: any) {
          console.warn('[AuthContext] plan fetch failed:', err?.message || err);
        }

        setRole(userRole);
        setPlan(userPlan);
      } else {
        setRole(null);
        setPlan(null);
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
    setPlan(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      plan,
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
