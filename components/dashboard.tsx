'use client';
import { Atom, BookOpen, Check, ClipboardCheck, Flame, FlaskConical, Focus, GraduationCap, Orbit, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { L, topicNames, type Lang } from '@/lib/catalog';
import { tr } from '@/lib/i18n';
import { learningPath, recentActivity, studyStreak, type LearningAttempt } from '@/lib/learning';
import { TheoryShortcut } from '@/components/theory-library';
import type { Profile } from '@/lib/profile';
import type { ShopState } from '@/lib/shop';
type View = 'home' | 'learn' | 'progress' | 'physics' | 'diagnostic' | 'profile' | 'practice' | 'rewards';
type Account = {
    shop: ShopState;
    profile: Profile;
    photo: string | null;
    attempts: LearningAttempt[];
    awards: {
        key: string;
        amount: number;
    }[];
};
const text = {
    overview: L('YOUR LEARNING SPACE', 'ТВОЙ УЧЕБНЫЙ КАБИНЕТ', 'СЕНІҢ ОҚУ КАБИНЕТІҢ'),
    hello: L('A little curiosity. A big discovery.', 'Большие открытия начинаются с малого.', 'Үлкен жаңалық кішкентай қадамнан басталады.'),
    heroLabel: L('YOUR PERSONAL LEARNING PATH', 'ТВОЙ ПЕРСОНАЛЬНЫЙ МАРШРУТ', 'СЕНІҢ ЖЕКЕ ОҚУ ЖОЛЫҢ'),
    heroTitle: L('Understand physics.\nDiscover your potential.', 'Понимай физику.\nОткрывай возможности.', 'Физиканы түсін.\nМүмкіндігіңді аш.'),
    heroBody: L('Start with a short diagnostic. Find your strengths and what to work on next.', 'Начни с короткой диагностики. Узнай свои сильные стороны и темы, которым стоит уделить время.', 'Қысқа диагностикадан баста. Мықты жақтарыңды және қай тақырыптарды қайталау керегін анықта.'),
    takeTest: L('Start diagnostic', 'Пройти диагностику', 'Диагностиканы бастау'),
    continue: L('Continue learning', 'Продолжить обучение', 'Оқуды жалғастыру'),
    noPressure: L('At your pace · No time limit', 'В твоём темпе · Без таймера', 'Өз қарқыныңмен · Уақыт шектеусіз'),
    correct: L('Correct answers', 'Верных ответов', 'Дұрыс жауаптар'),
    accuracy: L('Answer accuracy', 'Точность ответов', 'Жауап дәлдігі'),
    streak: L('Study streak', 'Дней подряд', 'Қатарынан оқу'),
    points: L('Learning points', 'Учебных баллов', 'Оқу ұпайлары'),
    saved: L('From completed attempts', 'В завершённых попытках', 'Аяқталған әрекеттерден'),
    empty: L('Your first step is ahead', 'Первый шаг ещё впереди', 'Алғашқы қадамың алда'),
    next: L('Your next step', 'Твой следующий шаг', 'Келесі қадамың'),
    why: L('Recommended from your latest answers', 'По твоим последним ответам', 'Соңғы жауаптарың бойынша'),
    first: L('Let’s find your starting point', 'Найдём твою отправную точку', 'Бастапқы деңгейіңді анықтайық'),
    firstBody: L('Choose your level and topics. Your answers will shape a personal study plan.', 'Выбери свой уровень и темы. По ответам мы составим персональный план занятий.', 'Деңгей мен тақырыптарды таңда. Жауаптарың негізінде жеке оқу жоспарын құрамыз.'),
    practiceBody: L('Two short problems, a useful hint and a step-by-step solution.', 'Две короткие задачи, полезная подсказка и пошаговое решение.', 'Екі қысқа есеп, пайдалы кеңес және қадамдық шешім.'),
    plan: L('Open study plan', 'Открыть учебный план', 'Оқу жоспарын ашу'),
    week: L('This week', 'За неделю', 'Осы аптада'),
    activity: L('Your learning rhythm', 'Твой учебный ритм', 'Сенің оқу ырғағың'),
    tasks: L('problems attempted', 'задач выполнено', 'есеп орындалды'),
    subjects: L('Explore physics', 'Открывай физику', 'Физиканы зертте'),
    all: L('All topics', 'Все темы', 'Барлық тақырыптар'),
    mechanics: L('Motion & forces', 'Движение и силы', 'Қозғалыс және күштер'),
    mechanicsBody: L('From the first step to an orbit', 'От первого шага до орбиты', 'Алғашқы қадамнан орбитаға дейін'),
    energy: L('Energy & matter', 'Энергия и материя', 'Энергия және материя'),
    energyBody: L('Understand what makes things change', 'Что заставляет мир меняться', 'Әлемді өзгертетін не?'),
    electricity: L('Fields & electricity', 'Поля и электричество', 'Өрістер және электр тогы'),
    electricityBody: L('Discover the invisible connections', 'Исследуй невидимые связи', 'Көрінбейтін байланыстарды зертте'),
    challenge: L('Ready for a challenge?', 'Время сложных задач', 'Күрделі есептерге көшейік'),
    challengeBody: L('Connect ideas with multi-step A-level problems.', 'Соединяй знания в многошаговых задачах A-level.', 'Көпқадамды A-level есептерімен біліміңді біріктір.'),
    try: L('Explore problems', 'Выбрать задачу', 'Есеп таңдау'),
    goal: L('Your learning goal', 'Твоя учебная цель', 'Оқу мақсатың'),
    goalBody: L('A clear goal gives your learning direction.', 'Чёткая цель задаёт направление учёбе.', 'Нақты мақсат оқуыңа бағыт береді.'),
    setGoal: L('Set a goal', 'Поставить цель', 'Мақсат қою'),
    guide: L('A plan that follows your progress', 'План, который учитывает твой прогресс', 'Прогресіңді ескеретін жоспар'),
    guideBody: L('Recommendations update after each completed session. Based on your results, not an exam prediction.', 'Рекомендации обновляются после каждого занятия. Это ориентир по результатам, а не прогноз оценки.', 'Ұсыныстар әр сабақтан кейін жаңарады. Бұл бағаны болжау емес, нәтижеге негізделген бағыт.'),
};
export default function Dashboard({ account, lang, navigate }: {
    account: Account;
    lang: Lang;
    navigate: (v: View) => void;
}) {
    const t = (key: keyof typeof text) => text[key][lang];
    const total = account.attempts.reduce((n, a) => n + a.total, 0);
    const correct = account.attempts.reduce((n, a) => n + a.correct, 0);
    const points = account.shop.balance;
    const activity = recentActivity(account.attempts);
    const activityCount = activity.reduce((n, d) => n + d.count, 0);
    const next = learningPath(account.attempts, account.profile.level)[0];
    const hasDiagnostic = account.attempts.some(a => a.mode === 'diagnostic');
    const locale = lang === 'kk' ? 'kk-KZ' : lang === 'ru' ? 'ru-RU' : 'en-GB';
    const metrics = [
        { label: t('correct'), value: correct, note: total ? `${correct} / ${total}` : t('empty'), icon: Check, color: 'blue' },
        { label: t('accuracy'), value: total ? `${Math.round(correct / total * 100)}%` : '—', note: t('saved'), icon: Target, color: 'violet' },
        { label: t('streak'), value: studyStreak(account.attempts), note: t('noPressure').split(' · ')[0], icon: Flame, color: 'orange' },
        { label: tr('shopBalance', lang), value: points, note: 'Kyōmei', icon: Trophy, color: 'green' },
    ];
    return <div className="dashboard">
    <div className="dashboard-welcome"><div><span className="eyebrow">{t('overview')}</span><h1>{tr('greeting', lang)}, {account.profile.name.split(' ')[0]}<span className="greeting-dot">.</span></h1><p>{t('hello')}</p></div><span className="level-pill"><GraduationCap size={17}/>{account.profile.level === 'a' ? 'A-level Physics' : account.profile.level === 'uni' ? tr('university', lang) : `${tr('class', lang)} ${account.profile.level}`}</span></div>
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="discovery-card"><div className="discovery-copy"><span className="hero-kicker"><Sparkles size={15}/>{t('heroLabel')}</span><h2>{t('heroTitle')}</h2><p>{t('heroBody')}</p><div className="hero-actions"><button className="primary" onClick={() => navigate(hasDiagnostic ? 'learn' : 'diagnostic')}>{hasDiagnostic ? t('continue') : t('takeTest')}</button><small>{t('noPressure')}</small></div></div><div className="discovery-art" aria-hidden="true"/><span className="discovery-formula" aria-hidden="true">E = mc²</span></section>
        <div className="dashboard-metrics">{metrics.map(({ label, value, note, icon: Icon, color }) => <section className="metric-card" key={label}><span className={'metric-icon ' + color}><Icon size={19}/></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></section>)}</div>
        <div className="section-heading dashboard-section-heading"><h2>{t('next')}</h2><span className="soft-label"><Sparkles size={14}/>{t('why')}</span></div>
        <section className="next-lesson card"><span className="next-lesson-icon">{hasDiagnostic ? <BookOpen /> : <ClipboardCheck />}</span><div><span className="eyebrow">{hasDiagnostic ? tr('recommended', lang) : tr('diagnostic', lang)}</span><h3>{hasDiagnostic ? topicNames[next.topic][lang] : t('first')}</h3><p>{hasDiagnostic ? t('practiceBody') : t('firstBody')}</p>{hasDiagnostic && next.score !== null && <Progress value={next.score} aria-label={topicNames[next.topic][lang]}/>}</div><button className="secondary" onClick={() => navigate(hasDiagnostic ? 'learn' : 'diagnostic')}>{hasDiagnostic ? t('plan') : tr('start', lang)}</button></section>
        <div className="section-heading dashboard-section-heading"><h2>{t('subjects')}</h2><button className="text-button" onClick={() => navigate('learn')}>{t('all')}</button></div>
        <div className="subject-grid">{[{ title: 'mechanics', body: 'mechanicsBody', icon: Orbit, color: 'blue' }, { title: 'energy', body: 'energyBody', icon: FlaskConical, color: 'violet' }, { title: 'electricity', body: 'electricityBody', icon: Zap, color: 'orange' }].map(({ title, body, icon: Icon, color }, i) => <button className={'subject-card ' + color} key={title} onClick={() => navigate(i === 0 ? 'physics' : 'learn')}><span className="subject-index">0{i + 1}</span><Icon size={30} strokeWidth={1.6}/><h3>{t(title as keyof typeof text)}</h3><p>{t(body as keyof typeof text)}</p><span className="subject-bottom">{i === 0 ? tr('explore', lang) : tr('learn', lang)}</span></button>)}</div>
        <section className="challenge-strip"><span className="challenge-emblem"><Focus size={28}/></span><div><h3>{t('challenge')}</h3><p>{t('challengeBody')}</p></div><button className="secondary" onClick={() => navigate('practice')}>{t('try')}</button></section>
      </div>
      <aside className="dashboard-rail">
        <TheoryShortcut lang={lang} onOpen={() => navigate('physics')}/>
        <section className="card rhythm-card"><div className="section-heading"><h2>{t('activity')}</h2><span className="week-label">7 {lang === 'en' ? 'days' : lang === 'ru' ? 'дней' : 'күн'}</span></div><div className="activity-total"><strong>{activityCount}</strong><span>{t('tasks')}</span></div><div className="weekly-bars" role="img" aria-label={activity.map(d => `${d.date.toLocaleDateString(locale)}: ${d.count}`).join('; ')}>{activity.map((d, i) => <div className="week-column" key={i}><div className="bar-track"><div className="bar-fill" style={{ height: `${d.count ? Math.max(10, d.count / Math.max(1, ...activity.map(d => d.count)) * 100) : 0}%` }}/></div><span>{d.date.toLocaleDateString(locale, { weekday: 'short' })}</span></div>)}</div><button className="rail-link" onClick={() => navigate('progress')}>{tr('progress', lang)}</button></section>
        <section className="card goal-card"><span className="goal-icon"><Target size={24}/></span><h2>{t('goal')}</h2><p>{account.profile.goal || t('goalBody')}</p><button className="secondary" onClick={() => navigate('profile')}>{account.profile.goal ? tr('editProfile', lang) : t('setGoal')}</button></section>
        <section className="guide-note"><Atom size={25}/><h3>{t('guide')}</h3><p>{t('guideBody')}</p><span>QUANAQYL A+</span></section>
      </aside>
    </div>
  </div>;
}
