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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isOwner = firebaseUser.email === OWNER_EMAIL;
        let userRole: string = isOwner ? 'admin' : 'user';

        try {
          const [{ db }, { doc, getDoc, setDoc, Timestamp }] = await Promise.all([
            import('./firebase'),
            import('firebase/firestore'),
          ]);
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef).catch(() => null);
          const existingData = userDoc?.exists() ? userDoc.data() : null;

          userRole = isOwner ? 'admin' : (existingData?.role || 'user');

          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || null,
            role: userRole,
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
