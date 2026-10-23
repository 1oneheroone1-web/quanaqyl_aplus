import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';

// Names are retained for existing app imports; identity now comes from database-backed sessions.
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie') || '';
  if (!/(?:^|;\s*)(?:__Secure-)?quanaqyl\.session_token=/.test(cookie)) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return {
    userId: session.user.id,
    displayName: session.user.name || session.user.email,
    email: session.user.email,
    fullName: session.user.name || null,
  };
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  return `/login?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  return `/logout?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || /^\/(?:login|logout|api\/auth|signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(url.pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}
