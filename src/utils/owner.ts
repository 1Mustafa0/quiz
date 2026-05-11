export const OWNER_EMAIL = 'mstfyalswdany913@gmail.com';

type UserLike = {
  email?: string | null;
} | null | undefined;

export const isOwnerEmail = (email?: string | null) =>
  (email || '').trim().toLowerCase() === OWNER_EMAIL.toLowerCase();

export const isOwnerUser = (user: UserLike) => isOwnerEmail(user?.email);

export const getErrorDetail = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return '';
};

export const ownerOnlyError = (
  user: UserLike,
  publicMessage: string,
  error?: unknown,
) => {
  const detail = getErrorDetail(error).trim();
  if (isOwnerUser(user) && detail) {
    return `${publicMessage}\n\nتفاصيل المالك:\n${detail}`;
  }
  return publicMessage;
};
