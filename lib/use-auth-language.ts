'use client';

import { useSyncExternalStore } from 'react';
import type { Lang } from '@/lib/catalog';

const storageKey = 'quanaqyl-language';
const changeEvent = 'quanaqyl-language-change';
let fallback: Lang = 'ru';

function language(value: string | null): Lang | null {
  return value === 'ru' || value === 'en' || value === 'kk' ? value : null;
}

function snapshot(): Lang {
  try { return language(localStorage.getItem(storageKey)) || fallback; }
  catch { return fallback; }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function changeLanguage(value: string) {
  const next = language(value);
  if (!next) return;
  fallback = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Optional preference. */ }
  window.dispatchEvent(new Event(changeEvent));
}

export function useAuthLanguage() {
  const lang = useSyncExternalStore(subscribe, snapshot, () => 'ru' as Lang);
  return [lang, changeLanguage] as const;
}
