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
      throw new Error('تعذر تسجيل الدخول من هذا العنوان حالياً. يرجى المحاولة لاحقاً أو التواصل مع مالك الموقع.');
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('تم حجب نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة في المتصفح ثم المحاولة مرة أخرى.');
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('تم إغلاق نافذة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    }
    throw error;
  }
};

export const logout = () => signOut(auth);
