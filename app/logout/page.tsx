import type { Metadata } from 'next';
import { safeRelativeReturnPath } from '@/app/chatgpt-auth';
import LogoutForm from './logout-form';

export const metadata: Metadata = { title: 'Выход — QuanAQYL A+' };

export default async function LogoutPage({ searchParams }: {
  searchParams: Promise<{ return_to?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safeRelativeReturnPath(typeof params.return_to === 'string' ? params.return_to : '/');
  return <LogoutForm returnTo={returnTo} />;
}
