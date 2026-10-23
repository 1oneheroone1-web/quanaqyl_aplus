'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { useAuthLanguage } from '@/lib/use-auth-language';
import { profileLimits } from '@/lib/profile';
import styles from './auth.module.css';

const copy = {
  ru: {
    language: 'Язык', signIn: 'Войти', signUp: 'Создать аккаунт',
    title: 'Продолжи свой путь в физике', intro: 'Войди в аккаунт QuanAQYL A+, чтобы сохранять профиль и прогресс.',
    registerIntro: 'Создай аккаунт QuanAQYL A+ для своих занятий и результатов.',
    name: 'Имя', email: 'Электронная почта', password: 'Пароль',
    passwordNote: 'От 12 до 128 символов. Используй отдельный пароль для этого сайта.',
    waiting: 'Подождите…', newAccount: 'Ещё нет аккаунта?', existingAccount: 'Уже есть аккаунт?',
    back: 'На главную', invalid: 'Проверь почту и пароль.',
    exists: 'Аккаунт с этой почтой уже существует. Попробуй войти.',
    invalidName: 'Введи имя длиной от 1 до 60 символов.',
    limited: 'Слишком много попыток. Подожди минуту и попробуй снова.',
    unavailable: 'Вход временно недоступен. Попробуй ещё раз позже.',
    failed: 'Не удалось выполнить запрос. Проверь подключение и повтори.',
  },
  en: {
    language: 'Language', signIn: 'Sign in', signUp: 'Create account',
    title: 'Continue your physics journey', intro: 'Sign in to QuanAQYL A+ to save your profile and progress.',
    registerIntro: 'Create a QuanAQYL A+ account for your learning and results.',
    name: 'Name', email: 'Email', password: 'Password',
    passwordNote: '12–128 characters. Use a unique password for this site.',
    waiting: 'Please wait…', newAccount: 'New here?', existingAccount: 'Already have an account?',
    back: 'Back to home', invalid: 'Check your email and password.',
    exists: 'An account with this email already exists. Try signing in.',
    invalidName: 'Enter a name between 1 and 60 characters.',
    limited: 'Too many attempts. Wait a minute and try again.',
    unavailable: 'Sign in is temporarily unavailable. Please try again later.',
    failed: 'The request failed. Check your connection and try again.',
  },
  kk: {
    language: 'Тіл', signIn: 'Кіру', signUp: 'Аккаунт құру',
    title: 'Физикадағы жолыңды жалғастыр', intro: 'Профиль мен жетістіктерді сақтау үшін QuanAQYL A+ аккаунтына кір.',
    registerIntro: 'Оқуың мен нәтижелерің үшін QuanAQYL A+ аккаунтын құр.',
    name: 'Есім', email: 'Электрондық пошта', password: 'Құпиясөз',
    passwordNote: '12–128 таңба. Осы сайтқа бөлек құпиясөз қолдан.',
    waiting: 'Күте тұр…', newAccount: 'Аккаунтың жоқ па?', existingAccount: 'Аккаунтың бар ма?',
    back: 'Басты бетке', invalid: 'Пошта мен құпиясөзді тексер.',
    exists: 'Бұл поштамен аккаунт бар. Кіріп көр.',
    invalidName: '1–60 таңбадан тұратын есім енгіз.',
    limited: 'Тым көп әрекет. Бір минут күтіп, қайталап көр.',
    unavailable: 'Кіру уақытша қолжетімсіз. Кейінірек қайталап көр.',
    failed: 'Сұрау орындалмады. Байланысты тексеріп, қайталап көр.',
  },
};

function errorKey(error: { code?: string; status?: number }): keyof typeof copy.ru {
  if (error.status === 429) return 'limited';
  if (error.status === 503 || error.status === 500 || error.code === 'AUTH_UNAVAILABLE') return 'unavailable';
  if (['INVALID_EMAIL_OR_PASSWORD', 'INVALID_PASSWORD', 'USER_NOT_FOUND', 'INVALID_EMAIL'].includes(error.code || '')) return 'invalid';
  if (['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'].includes(error.code || '')) return 'exists';
  if (['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG'].includes(error.code || '')) return 'passwordNote';
  if (error.code === 'INVALID_NAME') return 'invalidName';
  return 'failed';
}

export default function AuthForm({ returnTo }: { returnTo: string }) {
  const [lang, changeLanguage] = useAuthLanguage();
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<keyof typeof copy.ru | null>(null);
  const t = copy[lang];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const name = String(data.get('name') || '').trim();
    if (register && (!name || name.length > profileLimits.name)) { setError('invalidName'); return; }
    if (register && (password.length < 12 || password.length > 128)) { setError('passwordNote'); return; }
    setPending(true);
    setError(null);
    try {
      const result = register
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password, rememberMe: true });
      if (result.error) {
        setError(errorKey(result.error));
        setPending(false);
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setError('failed');
      setPending(false);
    }
  }

  return <main className="login-page" lang={lang}>
    <div className="login-language"><label className={styles.language}>{t.language}
      <select value={lang} onChange={event => changeLanguage(event.target.value)}>
        <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
      </select>
    </label></div>
    <section className={`card login-card ${styles.card}`} aria-labelledby="auth-title">
      <Link href="/" className={styles.brand}>QuanAQYL <span>A+</span></Link>
      <h1 id="auth-title">{register ? t.signUp : t.title}</h1>
      <p>{register ? t.registerIntro : t.intro}</p>
      <form onSubmit={submit} aria-busy={pending} className={styles.form}>
        <fieldset disabled={pending} className={styles.fields}>
          {register && <label className={styles.field} htmlFor="auth-name">{t.name}
            <input id="auth-name" name="name" autoComplete="name" required maxLength={profileLimits.name} />
          </label>}
          <label className={styles.field} htmlFor="auth-email">{t.email}
            <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label className={styles.field} htmlFor="auth-password">{t.password}
            <input id="auth-password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? 'auth-password-note' : undefined} />
          </label>
          {register && <p id="auth-password-note" className={styles.note}>{t.passwordNote}</p>}
          {error && <p role="alert" className={styles.error}>{t[error]}</p>}
          <button type="submit" className={`primary ${styles.submit}`}>{pending ? t.waiting : register ? t.signUp : t.signIn}</button>
        </fieldset>
      </form>
      <p className={styles.switch}>{register ? t.existingAccount : t.newAccount}{' '}
        <button type="button" disabled={pending} onClick={() => { setRegister(!register); setError(null); }}>{register ? t.signIn : t.signUp}</button>
      </p>
      <Link href="/" className={styles.back}>{t.back}</Link>
    </section>
  </main>;
}
