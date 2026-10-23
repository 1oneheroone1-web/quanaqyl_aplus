import type { Metadata } from 'next';
import { safeRelativeReturnPath } from '@/app/chatgpt-auth';
import AuthForm from './auth-form';

export const metadata: Metadata = { title: 'Вход — QuanAQYL A+' };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ return_to?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeRelativeReturnPath(typeof params.return_to === 'string' ? params.return_to : '/');
  return <AuthForm returnTo={returnTo} />;
}
