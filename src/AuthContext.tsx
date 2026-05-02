import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

const OWNER_EMAIL = 'mstfyalswdany913@gmail.com';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
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
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

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
            // New user — create profile document
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || null,
              role: userRole,
              createdAt: Timestamp.now(),
            };

            await setDoc(userRef, newProfile).catch((err) => {
              console.error('Failed to create user profile:', err);
            });

            setShowWelcome(true);
          }
        } catch (err) {
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
    const u = await loginWithGoogle();
    setUser(u);
    return u;
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
