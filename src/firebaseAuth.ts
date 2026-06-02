import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { app } from './firebaseApp';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Login error:', error);

    if (error?.code === 'auth/unauthorized-domain') {
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'هذا الدومين';
      throw new Error(`تعذر تسجيل الدخول لأن الدومين ${currentDomain} غير مضاف في Firebase Authentication. أضفه من Firebase Console > Authentication > Settings > Authorized domains ثم جرّب مرة أخرى.`);
    }

    if (error?.code === 'auth/popup-blocked') {
      throw new Error('تم حظر نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة في المتصفح ثم جرّب مرة أخرى.');
    }

    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('تم إغلاق نافذة تسجيل الدخول. جرّب مرة أخرى.');
    }

    throw error;
  }
};

export const logout = () => signOut(auth);
