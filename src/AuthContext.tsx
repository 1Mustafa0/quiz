import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch role from Firestore
          let userDoc;
          try {
            userDoc = await getDoc(doc(db, 'users', user.uid));
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
          
          let userRole = 'user';
          
          if (userDoc && userDoc.exists()) {
            userRole = userDoc.data().role || 'user';
            // Ensure the specific email always gets admin role if not already set
            if (user.email === 'mstfyalswdany913@gmail.com' && userRole !== 'admin') {
              userRole = 'admin';
              try {
                await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
              }
            }
          } else {
            // Create user doc if it doesn't exist
            userRole = user.email === 'mstfyalswdany913@gmail.com' ? 'admin' : 'user';
            try {
              await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: userRole,
                createdAt: Timestamp.now()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
            }
            setShowWelcome(true);
          }
          console.log('User role:', userRole);
          setRole(userRole);
        } catch (error) {
          console.error('Error fetching user role:', error);
          setRole('user');
        }
      } else {
        setRole(null);
      }
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const user = await loginWithGoogle();
    setUser(user);
    return user;
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
      logout: handleLogout 
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
