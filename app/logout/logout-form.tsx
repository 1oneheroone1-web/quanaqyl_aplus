'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { useAuthLanguage } from '@/lib/use-auth-language';
import styles from '@/app/login/auth.module.css';

const copy = {
  ru: { title: 'Выйти из аккаунта?', note: 'Твой профиль и прогресс сохранятся.', signOut: 'Выйти', cancel: 'Остаться в аккаунте', waiting: 'Выход…', error: 'Не удалось выйти. Проверь подключение и повтори.' },
  en: { title: 'Sign out of your account?', note: 'Your profile and progress will stay saved.', signOut: 'Sign out', cancel: 'Stay signed in', waiting: 'Signing out…', error: 'Could not sign out. Check your connection and try again.' },
  kk: { title: 'Аккаунттан шығу керек пе?', note: 'Профиль мен жетістіктерің сақталады.', signOut: 'Шығу', cancel: 'Аккаунтта қалу', waiting: 'Шығу…', error: 'Шығу мүмкін болмады. Байланысты тексеріп, қайталап көр.' },
};

export default function LogoutForm({ returnTo }: { returnTo: string }) {
  const [lang] = useAuthLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const t = copy[lang];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      // State changes only after explicit submission, using Better Auth's CSRF-protected POST.
      const result = await authClient.signOut();
      if (result.error) { setError(true); setPending(false); return; }
      window.location.assign(returnTo);
    } catch { setError(true); setPending(false); }
  }

  return <main className="login-page" lang={lang}>
    <section className={`card login-card ${styles.card}`} aria-labelledby="logout-title">
      <Link href="/" className={styles.brand}>QuanAQYL <span>A+</span></Link>
      <h1 id="logout-title">{t.title}</h1>
      <p>{t.note}</p>
      <form onSubmit={submit} aria-busy={pending} className={styles.actions}>
        {error && <p role="alert" className={styles.error}>{t.error}</p>}
        <button className={`primary ${styles.submit}`} type="submit" disabled={pending}>{pending ? t.waiting : t.signOut}</button>
        <Link href={returnTo} className={styles.back}>{t.cancel}</Link>
      </form>
    </section>
  </main>;
}
