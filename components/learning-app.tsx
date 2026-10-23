'use client';
import { useState, useEffect, useRef, useCallback, type FormEvent, type ReactNode } from 'react';
import { ShoppingBag, Home, BookOpen, BarChart3, Atom, ClipboardCheck, UserRound, Gift, ArrowRight, Check, Upload, Trash2, Save, School, MapPin, Target, Clock, ShieldCheck, LogOut, Phone, Snowflake, ChevronLeft, ChevronRight, RotateCcw, Lightbulb, Menu, Trophy, Wallet, Sparkles } from 'lucide-react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TopicIcon, TopicDescription, topicTones } from '@/components/topic-style';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { tr } from '@/lib/i18n';
import Dashboard from '@/components/dashboard';
import { TheoryShortcut } from '@/components/theory-library';
import PhysicsHub from '@/components/physics-hub';
import KyomeiShop from '@/components/kyomei-shop';
import ShopCollection from '@/components/shop-collection';
import FocusProvider from '@/components/focus-provider';
import FocusTimer from '@/components/focus-timer';
import FocusStats from '@/components/focus-stats';
import type { ShopState } from '@/lib/shop';
import { theoryModulesForTopic, theoryEntryForTopic } from '@/lib/physics-theory';
import { useLearningTools } from '@/hooks/use-learning-tools';
import { learningPath, topicEvidence } from '@/lib/learning';
import { problems, basics, challenges, topicNames, gradeTopics, parseAnswer, markAnswer, type Lang, type Problem } from '@/lib/catalog';
import { validateProfile, profileLimits, type Profile } from '@/lib/profile';
type View = 'home' | 'learn' | 'progress' | 'physics' | 'diagnostic' | 'profile' | 'practice' | 'rewards' | 'shop';
type ResponseItem = {
    problemId: string;
    values: string[];
};
type Attempt = {
    id: string;
    mode: 'diagnostic' | 'practice';
    answers: (ResponseItem & {
        topic: number;
        kind: string;
        checks: boolean[];
        correct: boolean;
    })[];
    correct: number;
    total: number;
    date: number;
};
type Account = {
    shop: ShopState;
    profile: Profile;
    photo: string | null;
    email: string;
    attempts: Attempt[];
    awards: {
        key: string;
        amount: number;
        created_at: number;
    }[];
    pauses: {
        id: string;
        start: number;
        end: number | null;
    }[];
};
type Session = {
    id: string;
    mode: 'diagnostic' | 'practice';
    ids: string[];
};
const navigation: {
    key: View;
    Icon: typeof Home;
}[] = [{ key: 'home', Icon: Home }, { key: 'learn', Icon: BookOpen }, { key: 'progress', Icon: BarChart3 }, { key: 'physics', Icon: Atom }, { key: 'diagnostic', Icon: ClipboardCheck }, { key: 'rewards', Icon: Gift }, { key: 'shop', Icon: ShoppingBag }, { key: 'profile', Icon: UserRound }, { key: 'practice', Icon: Target }];
const locales = { en: 'en-GB', ru: 'ru-RU', kk: 'kk-KZ' };
const viewKeys = navigation.map(n => n.key);
const dateString = (date: number, lang: Lang) => new Intl.DateTimeFormat(locales[lang], { dateStyle: 'medium' }).format(date);
async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch('/api/' + path, { ...options, credentials: 'same-origin', cache: 'no-store' });
    const body = await response.json().catch(() => ({})) as {
        error?: string;
    };
    if (!response.ok)
        throw new Error(body.error || 'error');
    return body as T;
}
const send = (body: unknown, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function useT(lang: Lang) { return (key: string) => tr(key, lang); }
function Avatar({ name, photo, large = false }: {
    name: string;
    photo: string | null;
    large?: boolean;
}) { return <span className={'avatar ' + (large ? 'avatar-large' : '')}>{photo ? <img src={photo} alt=""/> : <span>{name.trim().slice(0, 1).toUpperCase() || <UserRound />}</span>}</span>; }
function Choice({ value, onChange, label, items, id }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
    items: {
        value: string;
        label: string;
    }[];
    id?: string;
}) { return <Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-label={label} className="choice"><SelectValue /></SelectTrigger><SelectContent>{items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select>; }
function Language({ lang, onChange }: {
    lang: Lang;
    onChange: (l: Lang) => void;
}) { return <Choice label={tr('language', lang)} value={lang} onChange={v => onChange(v as Lang)} items={[{ value: 'ru', label: 'Русский' }, { value: 'kk', label: 'Қазақша' }, { value: 'en', label: 'English' }]}/>; }
function Level({ value, onChange, lang, id }: {
    value: string;
    onChange: (v: string) => void;
    lang: Lang;
    id?: string;
}) { const t = useT(lang); return <Choice id={id} label={t('level')} value={value} onChange={onChange} items={[...['7', '8', '9', '10', '11', '12'].map(v => ({ value: v, label: t('class') + ' ' + v })), { value: 'a', label: 'A-level' }, { value: 'uni', label: t('university') }]}/>; }
function Heading({ title, subtitle }: {
    title: string;
    subtitle?: string;
}) { return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="page-orbit" aria-hidden="true"/></div>; }
function Empty({ lang }: {
    lang: Lang;
}) { const t = useT(lang); return <div className="empty-state"><Target size={34}/><h3>{t('empty')}</h3><p>{t('emptySub')}</p></div>; }
function AppNavigation({ view, navigate, lang, signOutUrl }: {
    view: View;
    navigate: (v: View) => void;
    lang: Lang;
    signOutUrl: string;
}) { const t = useT(lang), { setOpenMobile } = useSidebar(); return <><SidebarContent><nav aria-label={t('menu')}><SidebarMenu>{navigation.map(({ key, Icon }) => <SidebarMenuItem key={key}><SidebarMenuButton isActive={view === key} onClick={() => { navigate(key); setOpenMobile(false); }} className="nav-item" aria-current={view === key ? 'page' : undefined}><Icon /><span>{t(key)}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></nav></SidebarContent><SidebarFooter className="nav-footer"><div className="sidebar-quote"><span>Білім</span><span>жарық болашаққа</span><span>бастайды</span></div><a href={signOutUrl} target="_top"><LogOut size={18}/>{t('signout')}</a></SidebarFooter></>; }
export default function LearningApp({ user, signInUrl, signOutUrl }: {
    user: {
        name: string;
        email: string;
    } | null;
    signInUrl: string;
    signOutUrl: string;
}) {
    const [lang, setLang] = useState<Lang>('ru'), [view, setView] = useState<View>('home'), [account, setAccount] = useState<Account | null>(null), [loadError, setLoadError] = useState(''), [session, setSession] = useState<Session | null>(null), [dirty, setDirty] = useState(false), [pendingNav, setPendingNav] = useState<View | null>(null), [sessionFinished, setSessionFinished] = useState(false);
    const t = useT(lang), loaded = useRef(false);
    const [physicsModuleId, setPhysicsModuleId] = useState<string | undefined>();
    const [physicsVisit, setPhysicsVisit] = useState(0);
    const [profileCollection, setProfileCollection] = useState(false);
    useLearningTools(account, lang);
    const changeLang = (l: Lang) => {
        setLang(l);
        try {
            localStorage.setItem('quanaqyl-language', l);
        }
        catch { }
    };
    const load = useCallback(async () => {
        setLoadError('');
        try {
            const a = await api<Account>('account');
            setAccount(a);
            if (!loaded.current) {
                let preferred: string | null = null;
                try {
                    preferred = localStorage.getItem('quanaqyl-language');
                }
                catch { }
                setLang(['en', 'ru', 'kk'].includes(preferred || '') ? preferred as Lang : a.profile.lang);
                loaded.current = true;
            }
        }
        catch (e) {
            setLoadError((e as Error).message);
        }
    }, []);
    useEffect(() => {
        try {
            const l = localStorage.getItem('quanaqyl-language');
            if (l && ['ru', 'kk', 'en'].includes(l))
                setLang(l as Lang);
        }
        catch { }
        const hash = location.hash.slice(1) === 'theory' ? 'physics' : location.hash.slice(1);
        if (viewKeys.includes(hash as View))
            setView(hash as View);
        if (user)
            void load();
    }, [user, load]);
    useEffect(() => { document.documentElement.lang = lang; }, [lang]);
    useEffect(() => {
        if (!dirty && (!session || sessionFinished))
            return;
        const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', guard);
        return () => window.removeEventListener('beforeunload', guard);
    }, [dirty, session, sessionFinished]);
    const navigate = (v: View) => {
        if (v === 'physics') { setPhysicsModuleId(undefined); setPhysicsVisit(n => n + 1); }
        if (dirty || (session && !sessionFinished)) {
            setPendingNav(v);
            return;
        }
        go(v);
    };
    const go = (v: View) => { setProfileCollection(false); setSession(null); setSessionFinished(false); setDirty(false); setView(v); history.replaceState(null, '', '#' + v); window.scrollTo({ top: 0, behavior: 'instant' }); };
    const start = (ids: string[], mode: 'diagnostic' | 'practice') => {
        if (account?.pauses.some(p => p.end === null) && mode === 'practice') {
            toast.error(t('paused'));
            return;
        }
        setSessionFinished(false);
        setSession({ id: crypto.randomUUID(), ids, mode });
        window.scrollTo({ top: 0, behavior: 'instant' });
    };
    const openTheory = (topic: number | null) => {
        navigate('physics');
        setPhysicsModuleId(topic === null ? undefined : theoryEntryForTopic(topic, account?.profile.level ?? '9')?.id);
    };
    const onSaved = async () => { setSessionFinished(true); await load(); };
    if (!user)
        return <div className="login-page"><div className="login-language"><Language lang={lang} onChange={changeLang}/></div><section className="card login-card"><img className="login-logo" src="/assets/logo.png" alt="QuanAQYL A+"/><div className="eyebrow">QUANAQYL A+</div><h1>{t('register')}</h1><p>{t('loginInfo')}</p><a className="primary" href={signInUrl} target="_top"><ShieldCheck size={20}/>{t('signin')}</a><p className="muted">{t('loginNote')}</p><div className="notice"><Phone size={20}/><span>{t('phoneUnavailable')}</span></div></section></div>;
    return <FocusProvider lang={lang}><SidebarProvider style={{ '--sidebar-width': '260px' } as React.CSSProperties}>
  <a className="skip-link" href="#main-content">{t('skip')}</a>
  <Sidebar className="site-sidebar"><AppNavigation view={view} navigate={navigate} lang={lang} signOutUrl={signOutUrl}/></Sidebar>
  <div className="workspace"><header className="app-header"><SidebarTrigger aria-label={t('menu')} className="mobile-menu"/><button className="brand" onClick={() => navigate('home')} aria-label="QuanAQYL A+"><img src="/assets/logo.png" alt="QuanAQYL A+"/></button><p className="header-tagline">{lang === 'ru' ? 'Твой путь к пониманию физики' : lang === 'kk' ? 'Физиканы түсінуге бастайтын жолың' : 'Your path to understanding physics'}</p><div className="header-controls"><Language lang={lang} onChange={changeLang}/><button className="user-button" onClick={() => navigate('profile')} aria-label={t('profile')}><Avatar name={account?.profile.name || user.name} photo={account?.photo || null}/><span>{account?.profile.name || user.name}</span></button></div></header>
  <main id="main-content" tabIndex={-1}>
   <nav className="portal-breadcrumb" aria-label={lang === 'ru' ? 'Путь по сайту' : lang === 'kk' ? 'Сайттағы жол' : 'Breadcrumb'}><button onClick={() => navigate('home')}>QuanAQYL A+</button><ChevronRight size={14}/><span>{session ? t(session.mode) : t(view)}</span></nav>
   {!account ? <section className="card loading" role="status"><Atom className={!loadError ? 'spin' : ''}/><p>{loadError ? t('loadError') : t('loading')}</p>{loadError && <button className="primary" onClick={() => void load()}>{t('retry')}</button>}</section> :
            session ? <ProblemSession key={session.id} session={session} lang={lang} onExit={() => navigate(view)} onSaved={onSaved} onPlan={() => go('learn')}/> :
                <>
     {view === 'home' && <Dashboard account={account} lang={lang} navigate={navigate}/>}
     {view === 'profile' && <ProfileView account={account} lang={lang} setLang={changeLang} onDirty={setDirty} onUpdate={a => setAccount(a)} signOutUrl={signOutUrl} showCollection={profileCollection} onShop={() => navigate('shop')}/>}
     {view === 'diagnostic' && <Diagnostic account={account} lang={lang} start={start}/>}
     {view === 'learn' && <Study account={account} lang={lang} start={start} refresh={load} navigate={navigate} onTheory={openTheory}/>}
     {view === 'practice' && <><Heading title={t('challenge')} subtitle={t('challengeSub')}/><ChallengeList account={account} lang={lang} start={start}/></>}
     {view === 'progress' && <ProgressView account={account} lang={lang}/>}
     {view === 'shop' && <KyomeiShop shop={account.shop} lang={lang} onUpdate={shop => setAccount(current => current ? { ...current, shop } : current)} onEarn={() => navigate('learn')} onCollection={() => { navigate('profile'); setProfileCollection(true); }}/>}
     {view === 'rewards' && <Rewards account={account} lang={lang} navigate={navigate}/>}
     {view === 'physics' && <PhysicsHub key={physicsVisit} lang={lang} level={account.profile.level} initialModuleId={physicsModuleId} simulation={<Motion lang={lang} embedded/>}/>}
    </>}
  </main></div><FocusTimer lang={lang}/><Toaster position="bottom-right" richColors/>
  <AlertDialog open={pendingNav !== null} onOpenChange={v => {
            if (!v)
                setPendingNav(null);
        }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{dirty ? t('unsaved') : t('exitTitle')}</AlertDialogTitle><AlertDialogDescription>{dirty ? t('discardInfo') : t('exitInfo')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => {
            if (pendingNav)
                go(pendingNav);
            setPendingNav(null);
        }}>{dirty ? t('discard') : t('exit')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </SidebarProvider></FocusProvider>;
}
function stats(a: Account) { const total = a.attempts.reduce((n, v) => n + v.total, 0), correct = a.attempts.reduce((n, v) => n + v.correct, 0); return { total, correct, accuracy: total ? Math.round(correct / total * 100) : 0, mastered: a.awards.filter(a => a.key.startsWith('topic-')).length, points: a.awards.reduce((n, v) => n + v.amount, 0) }; }
function Stats({ account, lang }: {
    account: Account;
    lang: Lang;
}) { const t = useT(lang), s = stats(account); return <div className="stats-grid">{[{ label: 'answers', value: s.total, Icon: ClipboardCheck }, { label: 'accuracy', value: s.accuracy + '%', Icon: Target }, { label: 'mastered', value: s.mastered + ' / 14', Icon: BookOpen }].map(({ label, value, Icon }) => <div className="card stat" key={label}><span className="stat-icon"><Icon /></span><div><p>{t(label)}</p><strong>{value}</strong></div></div>)}</div>; }
function ProfileView({ account, lang, setLang, onDirty, onUpdate, signOutUrl, onShop, showCollection }: {
    showCollection: boolean;
    onShop: () => void;
    account: Account;
    lang: Lang;
    setLang: (l: Lang) => void;
    onDirty: (b: boolean) => void;
    onUpdate: (a: Account) => void;
    signOutUrl: string;
}) {
    const t = useT(lang), [draft, setDraft] = useState({ ...account.profile, lang }), [saving, setSaving] = useState(false), [photoBusy, setPhotoBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const changed = JSON.stringify(draft) !== JSON.stringify(account.profile);
    useEffect(() => {
        if (!showCollection) return;
        const heading = document.getElementById('my-collection-heading');
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ block: 'start' });
    }, [showCollection]);
    useEffect(() => { onDirty(changed); }, [changed, onDirty]);
    useEffect(() => { setDraft(v => ({ ...v, lang })); }, [lang]);
    const edit = (key: keyof Profile, value: string) => { setDraft(v => ({ ...v, [key]: value })); setStatus(''); setError(''); };
    async function save(e: FormEvent) {
        e.preventDefault();
        const validated = validateProfile(draft);
        if (typeof validated === 'string') {
            setError(validated);
            return;
        }
        setSaving(true);
        setError('');
        try {
            const result = await api<{
                profile: Profile;
            }>('profile', send(validated, 'PUT'));
            onUpdate({ ...account, profile: result.profile });
            setDraft(result.profile);
            setStatus('saved');
            toast.success(t('saved'));
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    async function photo(file: File | null, remove = false) {
        if (!file && !remove)
            return;
        setPhotoBusy(true);
        setError('');
        try {
            let options: RequestInit = { method: 'DELETE' };
            if (file) {
                if (file.size > 2 * 1024 * 1024)
                    throw new Error('photo_size');
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
                    throw new Error('photo_type');
                const form = new FormData();
                form.set('photo', file);
                options = { method: 'POST', body: form };
            }
            const r = await api<{
                photo: string | null;
            }>('photo', options);
            onUpdate({ ...account, photo: r.photo });
            toast.success(t('saved'));
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setPhotoBusy(false);
            if (input.current)
                input.current.value = '';
        }
    }
    const field = (key: keyof Profile, opts: {
        textarea?: boolean;
        type?: string;
        placeholder?: string;
        wide?: boolean;
    } = {}) => <label className={'field ' + (opts.wide ? 'span-two' : '')} htmlFor={'profile-' + key} key={key}><span>{t(key)}{key === 'name' ? ' *' : ''}</span>{opts.textarea ? <textarea id={'profile-' + key} value={draft[key]} maxLength={profileLimits[key]} rows={key === 'bio' ? 5 : 3} onChange={e => edit(key, e.target.value)} placeholder={opts.placeholder}/> : <input id={'profile-' + key} type={opts.type || 'text'} value={draft[key]} maxLength={profileLimits[key]} onChange={e => edit(key, e.target.value)} autoComplete={key === 'name' ? 'name' : key === 'phone' ? 'tel' : key === 'city' ? 'address-level2' : undefined} required={key === 'name'} min={key === 'hours' ? 0 : undefined} max={key === 'hours' ? 60 : undefined} placeholder={opts.placeholder} aria-describedby={key === 'phone' ? 'phone-note' : undefined}/>}{opts.textarea && <small className="character-count">{draft[key].length} / {profileLimits[key]}</small>}</label>;
    return <><Heading title={t('profile')} subtitle={t('profileSub')}/><div className="profile-layout"><aside className="profile-summary"><section className="card identity-card"><div className="profile-cover"/><Avatar name={draft.name} photo={account.photo} large/><h2>{draft.name || t('name')}</h2><p>{draft.school || t('school')}</p>{draft.classCourse && <p className="profile-course">{draft.classCourse}</p>}{draft.city && <span className="location"><MapPin size={16}/>{draft.city}</span>}<div className="profile-photo-actions"><input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('upload')} disabled={photoBusy || saving} onChange={e => void photo(e.target.files?.[0] || null)}/><button className="secondary" onClick={() => input.current?.click()} disabled={photoBusy || saving}><Upload size={16}/>{photoBusy ? t('saving') : t('upload')}</button>{account.photo && <button className="text-button" onClick={() => void photo(null, true)} disabled={photoBusy || saving}><Trash2 size={15}/>{t('removePhoto')}</button>}<small>{t('photoInfo')}</small></div></section><section className="card privacy-note"><ShieldCheck /><div><strong>{t('privateProfile')}</strong><p>{t('progressSaved')}</p></div></section></aside>
 <form className="card profile-editor" onSubmit={save}><fieldset disabled={saving || photoBusy}><h2><UserRound />{t('about')}</h2><div className="form-grid">{field('name')}{field('city')}{field('school', { wide: true })}{field('classCourse')}<label className="field" htmlFor="profile-level"><span>{t('level')}</span><Level id="profile-level" value={draft.level} onChange={v => edit('level', v)} lang={lang}/></label>{field('interests', { wide: true })}</div><div className="form-section"><h2><Target />{t('goal')}</h2><div className="form-grid">{field('goal', { textarea: true, wide: true, placeholder: t('goalEmpty') })}{field('hours', { type: 'number' })}<label className="field"><span>{t('language')}</span><Language lang={lang} onChange={setLang}/></label>{field('bio', { textarea: true, wide: true })}</div></div><div className="form-section"><h2><Phone />{t('phone')}</h2>{field('phone', { type: 'tel', placeholder: '+7 700 123 45 67' })}<p className="field-note" id="phone-note">{t('phoneInfo')}</p></div></fieldset><div className="save-bar"><p aria-live="polite" className={error ? 'error-text' : 'muted'}>{error ? t(error) : status ? t(status) : changed ? t('unsaved') : t('saved')}</p><button className="primary" type="submit" disabled={saving || photoBusy || !changed}><Save size={18}/>{saving ? t('saving') : t('save')}</button></div><div className="account-info"><ShieldCheck size={18}/><div><strong>{t('signed')}</strong><span>{account.email}</span></div><a href={signOutUrl} target="_top">{t('signout')}</a></div></form></div><ShopCollection shop={account.shop} lang={lang} onShop={onShop}/></>;
}
function Diagnostic({ account, lang, start }: {
    account: Account;
    lang: Lang;
    start: (ids: string[], mode: 'diagnostic' | 'practice') => void;
}) {
    const t = useT(lang), [level, setLevel] = useState(account.profile.level);
    const [selected, setSelected] = useState<number[]>(gradeTopics[account.profile.level]);
    const visible = gradeTopics[level];
    const levelLabel = (value: string) => value === 'a' ? 'Cambridge A Level Physics' : value === 'uni' ? t('university') : lang === 'en' ? `Grade ${value}` : `${value} ${lang === 'kk' ? 'сынып' : 'класс'}`;
    return <><Heading title={t('diagnostic')} subtitle={t('diagSub')}/>
    <div className="soft-notice"><Target /><div><strong>{lang === 'ru' ? 'Проверь понимание в своём темпе' : lang === 'kk' ? 'Түсінігіңді өз қарқыныңмен тексер' : 'Explore what you understand, at your pace'}</strong><p>{lang === 'ru' ? 'По одному вопросу на тему. После теста — разбор и рекомендации.' : lang === 'kk' ? 'Әр тақырыпқа бір сұрақ. Тесттен кейін — талдау мен ұсыныстар.' : 'One question per topic. A review and recommendations after the test.'}</p></div><span className="notice-time"><Clock size={19}/>{selected.length * 2} {t('minutes')}</span></div>
    <div className="diagnostic-layout"><section className="card level-card"><h2>{t('chooseLevel')}</h2><RadioGroup className="level-options" value={level} onValueChange={v => { setLevel(v); setSelected(gradeTopics[v]); }} aria-label={t('chooseLevel')}>
      {['7', '8', '9', '10', '11', '12', 'a', 'uni'].map(value => <label className={'level-option ' + (level === value ? 'selected' : '')} key={value} htmlFor={'level-' + value}><RadioGroupItem id={'level-' + value} value={value}/><span>{levelLabel(value)}</span></label>)}
    </RadioGroup><p className="field-note">{t('diagNote')}</p></section>
    <section className="card diagnostic-topics"><div className="section-heading"><div><h2>{levelLabel(level)}{!['a', 'uni'].includes(level) ? ' · ' + t('physics') : ''}</h2><p>{t('chooseTopics')}</p></div><label className="check-label">{t('allTopics')}<Checkbox checked={selected.length === visible.length ? true : selected.length ? 'indeterminate' : false} onCheckedChange={v => setSelected(v === true ? [...visible] : [])}/></label></div>
    <div className="topic-list">{visible.map(i => { const evidence = topicEvidence(account.attempts, i); return <label className={'topic-row ' + (selected.includes(i) ? 'selected' : '')} data-tone={topicTones[i]} key={i}><span className="topic-number">{i + 1}</span><TopicIcon topic={i}/><span className="topic-copy"><strong>{topicNames[i][lang]}</strong><TopicDescription topic={i} lang={lang}/></span><span className="topic-confidence"><Progress value={evidence.score ?? 0} aria-label={topicNames[i][lang]}/><span>{evidence.score === null ? '—' : evidence.score + '%'}</span></span><Checkbox aria-label={topicNames[i][lang]} checked={selected.includes(i)} onCheckedChange={v => setSelected(s => v === true ? [...s, i] : s.filter(n => n !== i))}/></label>; })}</div>
    <div className="section-footer"><span>{t('selected')}: {selected.length} / {visible.length}</span><button className="primary" disabled={!selected.length} onClick={() => start(selected.map(i => `f${i}-0`), 'diagnostic')}>{t('startDiagnostic')}</button></div></section></div></>;
}
function Study({ account, lang, start, refresh, navigate, onTheory }: {
    onTheory: (topic: number | null) => void;
    account: Account;
    lang: Lang;
    start: (ids: string[], mode: 'diagnostic' | 'practice') => void;
    refresh: () => Promise<void>;
    navigate: (view: View) => void;
}) {
    const t = useT(lang), path = learningPath(account.attempts, account.profile.level), paused = account.pauses.some(p => p.end === null);
    const [tab, setTab] = useState('plan');
    const assessed = account.attempts.some(a => a.mode === 'diagnostic');
    const explanation = { en: 'Your latest answers help us put the topics that need attention first. New topics and revision follow.', ru: 'По последним ответам выбираем, чему уделить внимание сначала. Затем — новые темы и повторение.', kk: 'Соңғы жауаптарың бойынша алдымен бекітуді қажет ететін тақырыптарды таңдаймыз. Одан кейін — жаңа тақырыптар мен қайталау.' };
    const labels = { focus: { en: 'Focus next', ru: 'Стоит подтянуть', kk: 'Бекіту керек' }, unexplored: { en: 'Not assessed yet', ru: 'Ещё не проверено', kk: 'Әлі тексерілмеген' }, review: { en: 'Ready to review', ru: 'Можно повторить', kk: 'Қайталауға дайын' } };
    return <><Heading title={t('learn')} subtitle={t('learnSub')}/><Tabs value={tab} onValueChange={setTab}><TabsList className="view-tabs"><TabsTrigger value="plan">{t('plan')}</TabsTrigger><TabsTrigger value="rewards">Kyōmei</TabsTrigger><TabsTrigger value="pause">{t('freezing')}</TabsTrigger></TabsList>
    <TabsContent value="plan"><TheoryShortcut lang={lang} onOpen={() => onTheory(null)}/><div className="soft-notice"><Target /><div><strong>{assessed ? (lang === 'ru' ? 'Твой план становится точнее с каждым занятием' : lang === 'kk' ? 'Әр сабақ сайын жоспарың нақтыланады' : 'Your plan grows with you') : (lang === 'ru' ? 'Начни с базовых тем' : lang === 'kk' ? 'Негізгі тақырыптардан баста' : 'Start with the foundations')}</strong><p>{assessed ? explanation[lang] : lang === 'ru' ? 'Пройди диагностику, чтобы расставить темы по приоритету.' : lang === 'kk' ? 'Тақырыптардың басымдығын анықтау үшін диагностикадан өт.' : 'Take a diagnostic to discover which topics to focus on.'}</p></div>{!assessed && <button className="secondary" onClick={() => navigate('diagnostic')}>{t('diagnostic')}</button>}</div>
    {paused && <p className="notice">{t('paused')}</p>}<section className="card study-path"><div className="section-heading"><h2>{t('nextStep')}</h2><span className="badge">{stats(account).mastered} / 14 · {t('mastered')}</span></div>
    {path.map(item => <div className="lesson-row" data-tone={topicTones[item.topic]} key={item.topic}><span className="topic-number">{item.topic + 1}</span><div><h3>{topicNames[item.topic][lang]}</h3><TopicDescription topic={item.topic} lang={lang}/><div className="lesson-meta"><span className="badge">{t('twoQuestions')} · +100 共</span>{item.score !== null && <span className={'badge ' + (item.status === 'focus' ? 'warm' : '')}>{labels[item.status as keyof typeof labels][lang]} · {item.score}%</span>}</div></div><div className="lesson-actions">{theoryModulesForTopic(item.topic).length > 0 && <button className="secondary" onClick={() => onTheory(item.topic)}><BookOpen size={16}/>{t('theory')}</button>}<button className="primary" disabled={paused} onClick={() => start([`f${item.topic}-0`, `f${item.topic}-1`], 'practice')}>{t(account.awards.some(a => a.key === 'topic-' + item.topic) ? 'repeat' : 'start')}</button></div></div>)}
    </section></TabsContent><TabsContent value="rewards"><Rewards account={account} lang={lang} navigate={v => v === 'learn' ? setTab('plan') : navigate(v)} compact/></TabsContent><TabsContent value="pause"><Freeze account={account} lang={lang} refresh={refresh}/></TabsContent></Tabs></>;
}
function Freeze({ account, lang, refresh }: {
    account: Account;
    lang: Lang;
    refresh: () => Promise<void>;
}) {
    const t = useT(lang), active = account.pauses.find(p => !p.end), [busy, setBusy] = useState(false);
    async function change() {
        setBusy(true);
        try {
            await api('freeze', send({ action: active ? 'resume' : 'pause' }));
            await refresh();
        }
        catch (e) {
            toast.error(t((e as Error).message));
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="two-columns"><section className="card"><Snowflake className="large-icon"/><h2>{t('pauseTitle')}</h2><p>{t('pauseInfo')}</p><p className="muted">{t('pauseLimit')}</p><button className="primary" disabled={busy} onClick={() => void change()}>{busy ? t('saving') : t(active ? 'resume' : 'pause')}</button></section><section className="card"><h2>{t('pauseHistory')}</h2>{!account.pauses.length ? <p className="muted">—</p> : account.pauses.map(p => <div className="history-row" key={p.id}><span>{dateString(p.start, lang)}{p.end ? ' — ' + dateString(p.end, lang) : ''}</span><span className="badge">{t(p.end ? 'ended' : 'active')}</span></div>)}</section></div>;
}
function ChallengeList({ account, lang, start }: {
    account: Account;
    lang: Lang;
    start: (ids: string[], mode: 'diagnostic' | 'practice') => void;
}) { const t = useT(lang); return <><div className="challenge-grid">{challenges.map((q, i) => <section className="card challenge-card" key={q.id}><div className="section-heading"><span className="topic-number">{String(i + 1).padStart(2, '0')}</span><span className="badge">{t('hardLabel')}</span></div><p className="topic-caption">{topicNames[q.topic][lang]}</p><h2>{q.title[lang]}</h2><p>{q.parts.length} {t('parts')} · {q.minutes} {t('minutes')}</p><button className="secondary" onClick={() => start([q.id], 'practice')}>{t(account.awards.some(a => a.key === q.id) ? 'repeat' : 'start')}</button>{account.awards.some(a => a.key === q.id) && <span className="complete-label"><Check size={15}/>{t('complete')}</span>}</section>)}</div><p className="source-note">{t('sourceNote')}</p></>; }
function ProblemSession({ session, lang, onExit, onSaved, onPlan }: {
    session: Session;
    lang: Lang;
    onExit: () => void;
    onSaved: () => Promise<void>;
    onPlan: () => void;
}) {
    const t = useT(lang), [index, setIndex] = useState(0), [responses, setResponses] = useState<ResponseItem[]>([]), [values, setValues] = useState<string[]>([]), [working, setWorking] = useState(''), [checked, setChecked] = useState(false), [hint, setHint] = useState(false), [error, setError] = useState(''), [saving, setSaving] = useState(false), [result, setResult] = useState<Attempt | null>(null);
    const q = problems.find(p => p.id === session.ids[index])!;
    const answers = q.parts.map((_, i) => values[i] || '');
    const final = index === session.ids.length - 1;
    async function advance() {
        const next = [...responses, { problemId: q.id, values: answers }];
        if (final) {
            setSaving(true);
            setError('');
            try {
                const r = await api<Attempt>('attempts', send({ id: session.id, mode: session.mode, responses: next }));
                setResult(r);
                await onSaved();
            }
            catch (e) {
                setError((e as Error).message);
            }
            finally {
                setSaving(false);
            }
        }
        else {
            setResponses(next);
            setIndex(i => i + 1);
            setValues([]);
            setWorking('');
            setChecked(false);
            setHint(false);
            setError('');
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
    if (result)
        return <div className="quiz-wrap"><section className="card result-card"><span className="eyebrow">{t('result')}</span><div className="big-score">{result.correct}<span> / {result.total}</span></div><h1>{t(result.correct === result.total ? 'perfect' : 'resultsSub')}</h1><p>{t('saved')}</p><button className="primary" onClick={onPlan}>{t('viewPlan')}</button></section><section className="card"><h2>{t('review')}</h2>{result.answers.map(a => { const problem = problems.find(p => p.id === a.problemId)!; return <details key={a.problemId} className="review-details"><summary><span>{problem.title[lang]}</span><span>{a.checks.filter(Boolean).length} / {a.checks.length}</span></summary><p>{problem.stem[lang]}</p>{problem.parts.map((p, i) => <p key={i} className={a.checks[i] ? 'correct-text' : 'error-text'}>{p.label[lang]}: {a.values[i]} {p.unit} · {t('expected')}: {Number(p.answer.toPrecision(5))} {p.unit}</p>)}<ol>{problem.steps.map((s, i) => <li key={i}>{s[lang]}</li>)}</ol></details>; })}</section></div>;
    return <div className="quiz-wrap"><div className="quiz-toolbar"><button className="text-button" onClick={onExit} disabled={saving}><ChevronLeft size={18}/>{t('exit')}</button><span>{index + 1} / {session.ids.length}</span><span className="badge">{t(q.kind === 'challenge' ? 'challenge' : 'found')}</span></div><Progress value={index / session.ids.length * 100} aria-label={t('progress')}/><section className="card question-card"><div className="eyebrow">{topicNames[q.topic][lang]}</div><h1>{q.title[lang]}</h1><p className="problem-stem">{q.stem[lang]}</p><p className="field-note">{t('answerRule')}</p><div className="answer-fields">{q.parts.map((p, i) => <label className="field" htmlFor={'answer-' + i} key={q.id + i}><span><b className="part-letter">{String.fromCharCode(97 + i)}</b>{p.label[lang]}</span><div className={'answer-input ' + (checked ? (markAnswer(answers[i], p) ? 'right' : 'wrong') : '')}><input id={'answer-' + i} value={answers[i]} onChange={e => setValues(v => { const n = [...v]; n[i] = e.target.value; return n; })} disabled={checked || saving} autoComplete="off" spellCheck={false} maxLength={80}/><span>{p.unit}</span></div>{checked && <small>{t(markAnswer(answers[i], p) ? 'correct' : 'incorrect')} · {t('expected')}: {Number(p.answer.toPrecision(5))} {p.unit}</small>}</label>)}</div><label className="field working-field" htmlFor="working"><span>{t('yourWorking')}</span><textarea id="working" rows={3} value={working} onChange={e => setWorking(e.target.value)} maxLength={3000}/><small>{t('workingNote')}</small></label>{session.mode === 'practice' && <button className="text-button" onClick={() => setHint(v => !v)}><Lightbulb size={18}/>{t('hint')}</button>}{session.mode === 'practice' && hint && <div className="hint-box">{q.hint[lang]}</div>}{checked && <div className="solution-box"><h2>{t('solution')}</h2><ol>{q.steps.map((s, i) => <li key={i}>{s[lang]}</li>)}</ol></div>}<div className="quiz-actions"><p role="alert" className="error-text">{error ? t(error) : ''}</p>{!checked ? <button className="primary" disabled={saving} onClick={() => {
                if (answers.some(v => parseAnswer(v) === null)) {
                    setError('enterAll');
                    return;
                }
                setError('');
                if (session.mode === 'diagnostic') {
                    void advance();
                }
                else
                    setChecked(true);
            }}>{saving ? t('saving') : t(session.mode === 'diagnostic' ? (final ? 'finish' : 'next') : 'check')}<Check size={18}/></button> : <button className="primary" disabled={saving} onClick={() => void advance()}>{saving ? t('saving') : t(final ? 'finish' : 'next')}</button>}</div></section></div>;
}
function ProgressView({ account, lang }: {
    account: Account;
    lang: Lang;
}) { const t = useT(lang); return <><Heading title={t('progress')} subtitle={t('progressSub')}/><Stats account={account} lang={lang}/><FocusStats lang={lang}/><div className="two-columns"><section className="card"><h2>{t('calendar')}</h2><Calendar account={account} lang={lang}/></section><section className="card"><h2>{t('byTopic')}</h2><div className="topic-results">{topicNames.map((name, i) => { const { total: n, correct: c } = topicEvidence(account.attempts, i); return <div key={i}><span>{name[lang]}</span><Progress value={n ? c / n * 100 : 0} aria-label={name[lang]}/><b>{n ? Math.round(c / n * 100) + '%' : '—'}</b></div>; })}</div></section></div><section className="card"><h2>{t('history')}</h2>{!account.attempts.length ? <Empty lang={lang}/> : <Table><TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('topic')}</TableHead><TableHead>{t('mode')}</TableHead><TableHead>{t('score')}</TableHead></TableRow></TableHeader><TableBody>{account.attempts.map(a => <TableRow key={a.id}><TableCell>{dateString(a.date, lang)}</TableCell><TableCell>{Array.from(new Set(a.answers.map(a => topicNames[a.topic][lang]))).join(', ')}</TableCell><TableCell>{t(a.mode)}</TableCell><TableCell>{a.correct} / {a.total}</TableCell></TableRow>)}</TableBody></Table>}</section></>; }
function Calendar({ account, lang }: {
    account: Account;
    lang: Lang;
}) { const t = useT(lang), [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), offset = (month.getDay() + 6) % 7; const active = new Set(account.attempts.map(a => { const d = new Date(a.date); return [d.getFullYear(), d.getMonth(), d.getDate()].join('-'); })); return <><div className="calendar-heading"><button className="icon-button" aria-label={t('previousMonth')} onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft /></button><strong>{new Intl.DateTimeFormat(locales[lang], { month: 'long', year: 'numeric' }).format(month)}</strong><button className="icon-button" aria-label={t('nextMonth')} onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight /></button></div><div className="calendar">{Array.from({ length: 7 }, (_, i) => <span className="day-name" key={'w' + i}>{new Intl.DateTimeFormat(locales[lang], { weekday: 'short' }).format(new Date(2026, 8, 21 + i))}</span>)}{Array.from({ length: offset }, (_, i) => <span key={'b' + i}/>)}{Array.from({ length: days }, (_, i) => { const key = [month.getFullYear(), month.getMonth(), i + 1].join('-'); return <span className={'calendar-day ' + (active.has(key) ? 'studied' : '')} key={i}>{i + 1}</span>; })}</div></>; }
function Rewards({ account, lang, navigate, compact = false }: {
    account: Account;
    lang: Lang;
    navigate: (view: View) => void;
    compact?: boolean;
}) {
    const t = useT(lang), summary = stats(account);
    const words = { en: { blocks: 'Completed blocks', perBlock: 'Per foundation block', once: 'Once per topic', title: 'How does it work?', choose: 'Choose a study block', chooseBody: 'Open a topic in your personal study plan.', solve: 'Understand and solve', solveBody: 'Complete both problems correctly. Review the solution and try again when you need to.', earn: 'Earn 100 共', earnBody: 'Each topic earns points once. Multi-step challenges earn 150 共.', empty: 'Your first award is ahead', emptyBody: 'Complete a study block with all answers correct.', wallet: 'Your achievements in physics' }, ru: { blocks: 'Освоено блоков', perBlock: 'За базовый блок', once: 'Один раз за каждую тему', title: 'Как это работает?', choose: 'Выбери учебный блок', chooseBody: 'Открой тему в персональном плане.', solve: 'Разберись и ответь верно', solveBody: 'Выполни оба задания. При ошибке изучи разбор и повтори.', earn: 'Получи 100 共', earnBody: 'Награда за тему начисляется один раз. Многошаговая задача приносит 150 共.', empty: 'Первая награда впереди', emptyBody: 'Заверши учебный блок без ошибок.', wallet: 'Твои достижения в физике' }, kk: { blocks: 'Меңгерілген блоктар', perBlock: 'Негізгі блок үшін', once: 'Әр тақырып үшін бір рет', title: 'Бұл қалай жұмыс істейді?', choose: 'Оқу блогын таңда', chooseBody: 'Жеке оқу жоспарыңнан тақырыпты аш.', solve: 'Түсініп, дұрыс жауап бер', solveBody: 'Екі тапсырманы орында. Қате болса, шешу жолын талдап, қайтала.', earn: '100 共 жина', earnBody: 'Тақырып үшін ұпай бір рет беріледі. Көпқадамды есеп үшін 150 共 беріледі.', empty: 'Алғашқы марапатың алда', emptyBody: 'Оқу блогын қатесіз аяқта.', wallet: 'Физикадағы жетістіктерің' } }[lang];
    return <>{!compact && <Heading title={t('rewards')} subtitle={t('rewardsSub')}/>}<div className="stats-grid reward-stats">
    {[{ Icon: Gift, label: t('shopEarned'), value: summary.points + ' 共', note: t('progressSaved'), tone: 'sky' }, { Icon: Check, label: words.blocks, value: summary.mastered, note: t('twoQuestions'), tone: 'mint' }, { Icon: Trophy, label: words.perBlock, value: '100 共', note: words.once, tone: 'amber' }].map(({ Icon, label, value, note, tone }) => <section className="card stat" data-tone={tone} key={label}><span className="stat-icon"><Icon /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></section>)}
    </div><div className="two-columns reward-overview"><section className="card wallet"><h2><Wallet />Kyōmei Wallet</h2><p>{t('shopBalance')}</p><strong>{account.shop.balance}<span>共</span></strong><p>{t('rewardInfo')}</p><button className="secondary" onClick={() => navigate('shop')}><ShoppingBag size={18}/>{t('shopGoShop')}</button><span className="wallet-watermark" aria-hidden="true">共</span></section><section className="card rewards-explainer"><h2>{words.title}</h2><ol>{[[words.choose, words.chooseBody], [words.solve, words.solveBody], [words.earn, words.earnBody]].map(([title, body], i) => <li key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section></div>
    <section className="card reward-history"><h2>{t('rewardHistory')}</h2>{!account.awards.length ? <div className="empty-state"><BookOpen size={36}/><h3>{words.empty}</h3><p>{words.emptyBody}</p><button className="primary" onClick={() => navigate('learn')}>{t('viewPlan')}</button></div> : account.awards.map(a => <div className="history-row" key={a.key}><span>{a.key.startsWith('topic-') ? topicNames[Number(a.key.slice(6))][lang] : problems.find(p => p.id === a.key)?.title[lang]}<small>{dateString(a.created_at, lang)}</small></span><strong>+{a.amount} 共</strong></div>)}</section></>;
}
function Motion({ lang, embedded = false }: {
    lang: Lang;
    embedded?: boolean;
}) {
    const t = useT(lang), [v, setV] = useState(4), [a, setA] = useState(2), [time, setTime] = useState(5);
    const x = v * time + .5 * a * time * time, endV = v + a * time;
    const points = Array.from({ length: 101 }, (_, i) => { const n = time * i / 100; return { t: n, x: v * n + .5 * a * n * n }; });
    const lo = Math.min(0, ...points.map(p => p.x)), hi = Math.max(1, ...points.map(p => p.x)), xMap = (n: number) => 60 + n / Math.max(time, .01) * 500, yMap = (n: number) => 225 - (n - lo) / (hi - lo) * 185;
    const path = points.map((p, i) => (i ? 'L' : 'M') + xMap(p.t).toFixed(2) + ' ' + yMap(p.x).toFixed(2)).join(' ');
    return <>{!embedded && <Heading title={t('physics')} subtitle={t('physicsSub')}/>}<div className="two-columns simulation"><section className="card"><h2>{t('motion')}</h2><p>{t('motionInfo')}</p>{[{ key: 'velocity', value: v, min: -20, max: 20, step: .5, set: setV, unit: 'm/s' }, { key: 'acceleration', value: a, min: -10, max: 10, step: .5, set: setA, unit: 'm/s²' }, { key: 'time', value: time, min: .1, max: 20, step: .1, set: setTime, unit: 's' }].map(p => <div className="range-field" key={p.key}><label htmlFor={'motion-' + p.key}>{t(p.key)}<input id={'motion-' + p.key} type="number" value={p.value} min={p.min} max={p.max} step={p.step} onChange={e => {
                const n = Number(e.target.value);
                if (Number.isFinite(n))
                    p.set(Math.min(p.max, Math.max(p.min, n)));
            }}/><span>{p.unit}</span></label><Slider min={p.min} max={p.max} step={p.step} value={[p.value]} onValueChange={v => p.set(v[0])} aria-label={t(p.key)}/></div>)}<button className="secondary" onClick={() => { setV(4); setA(2); setTime(5); }}><RotateCcw size={17}/>{t('reset')}</button></section><section className="card"><h2>x(t) = v₀t + ½at²</h2><svg className="motion-chart" viewBox="0 0 610 275" role="img" aria-label={t('position') + ' x(t)'}><text x="12" y="20">x (m)</text>{Array.from({ length: 5 }, (_, i) => { const n = lo + (hi - lo) * i / 4; return <g key={i}><line x1="60" y1={yMap(n)} x2="560" y2={yMap(n)} stroke="#dce8f6"/><text x="48" y={yMap(n) + 5} textAnchor="end">{n.toFixed(1)}</text><text x={60 + i * 125} y="250" textAnchor="middle">{(time * i / 4).toFixed(1)}</text></g>; })}<line x1="60" x2="560" y1={yMap(0)} y2={yMap(0)} stroke="#90a9d1"/><path d={path} fill="none" stroke="#087cff" strokeWidth="3.5"/><circle cx={xMap(time)} cy={yMap(x)} r="6" fill="#087cff"/><text x="582" y="250">t (s)</text></svg><div className="simulation-values"><div><span>{t('position')}</span><strong>{x.toFixed(2)} m</strong></div><div><span>{t('finalVelocity')}</span><strong>{endV.toFixed(2)} m/s</strong></div></div><p className="field-note">{t('positionNote')}</p></section></div></>;
}
