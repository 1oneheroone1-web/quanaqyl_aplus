'use client';

import { ArrowRight, Atom, BookOpen, ExternalLink, GraduationCap, LibraryBig, Play } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';
import { physicsGrades, theoryModulesForGrade, type PhysicsGrade, type PhysicsTheoryResource } from '@/lib/physics-theory';

export function TheoryShortcut({ lang, onOpen }: { lang: Lang; onOpen: () => void }) {
  return <section className="card theory-shortcut">
    <span className="theory-shortcut-icon"><LibraryBig size={25} /></span>
    <div><h2>{tr('theoryShortcutTitle', lang)}</h2><p>{tr('theoryShortcutBody', lang)}</p></div>
    <button className="secondary" onClick={onOpen}>{tr('theoryShortcutOpen', lang)}<ArrowRight size={16} /></button>
  </section>;
}

function TheoryResource({ resource, lang }: { resource: PhysicsTheoryResource; lang: Lang }) {
  const t = (key: string) => tr(key, lang);
  const support = resource.role === 'support';
  const video = resource.type === 'YouTube video';
  const collection = !video && resource.type !== 'Theory page';
  return <section className={'physics-resource ' + (support ? 'physics-support' : 'physics-primary')} aria-labelledby={resource.id}>
    <div className="physics-resource-copy">
      <span className="physics-resource-role">{support ? <Play size={14} /> : <BookOpen size={15} />}{t(support ? 'theorySupport' : 'theoryPrimary')}</span>
      <h4 id={resource.id} lang="en">{resource.title}</h4>
      <p className="physics-provider" lang="en">{resource.provider}</p>
      {support && <p className="physics-support-focus"><strong>{t('theorySupportFocus')}: </strong>{resource.focus[lang]}</p>}
      {collection && <p className="physics-collection-note">{t('theoryCollectionNote')}</p>}
    </div>
    <a className={support ? 'secondary' : 'primary'} href={resource.url} target="_blank" rel="noopener noreferrer" aria-label={`${t(video ? 'watchTheory' : 'openTheory')}: ${resource.title} (${t('theoryNewTab')})`}>
      {t(video ? 'watchTheory' : 'openTheory')}<ExternalLink size={16} />
    </a>
  </section>;
}

export default function TheoryLibrary({ lang, grade, onGradeChange, openModule, onModuleChange, onExplore }: {
  lang: Lang;
  grade: PhysicsGrade;
  onGradeChange: (grade: PhysicsGrade) => void;
  openModule: string;
  onModuleChange: (id: string) => void;
  onExplore: () => void;
}) {
  const t = (key: string) => tr(key, lang);
  const chapters = theoryModulesForGrade(grade);
  return <div className="physics-theory">
    <section className="card physics-grade-card" aria-labelledby="physics-theory-heading">
      <div className="physics-theory-heading"><div><h2 id="physics-theory-heading">{t('theory')}</h2><p>{t('theoryIntro')}</p></div><GraduationCap size={30} aria-hidden="true" /></div>
      <p id="physics-grade-label" className="physics-grade-label">{t('chooseGrade')}</p>
      <RadioGroup className="physics-grade-options" value={String(grade)} onValueChange={value => onGradeChange(Number(value) as PhysicsGrade)} aria-labelledby="physics-grade-label">
        {physicsGrades.map(value => <label key={value} htmlFor={'physics-grade-' + value} data-selected={grade === value}>
          <RadioGroupItem id={'physics-grade-' + value} value={String(value)} className="sr-only" aria-label={`${t('class')} ${value}`} />
          <span>{value}</span>
        </label>)}
      </RadioGroup>
    </section>
    {chapters.length === 0 ? <section className="card physics-coming" aria-labelledby="physics-coming-heading">
      <span className="physics-coming-icon"><BookOpen size={32} strokeWidth={1.5} /></span>
      <span className="badge">{t('theoryComingSoon')}</span>
      <h2 id="physics-coming-heading">{t('theoryComingTitle').replace('{grade}', String(grade))}</h2>
      <p>{t('theoryComingBody')}</p>
      <button className="primary" onClick={onExplore}><Atom size={18} />{t('tryPhysicsAction')}<ArrowRight size={17} /></button>
    </section> : <section aria-labelledby="physics-chapters-heading">
      <div className="physics-chapters-heading"><h2 id="physics-chapters-heading">{t('class')} {grade}</h2><span>{t('theoryChapters')}: {chapters.length}</span></div>
      <Accordion className="physics-chapters" type="single" collapsible value={openModule} onValueChange={onModuleChange}>
        {chapters.map((chapter, index) => <AccordionItem className="physics-chapter" value={chapter.id} key={chapter.id}>
          <AccordionTrigger className="physics-chapter-trigger">
            <span className="physics-chapter-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="physics-chapter-label"><span className="physics-module-code" lang="en">{chapter.module}</span><span>{chapter.topic[lang]}</span></span>
            {chapter.resources.length > 1 && <span className="physics-resource-count" aria-label={`${t('theoryMaterials')}: ${chapter.resources.length}`}><BookOpen size={14} />{chapter.resources.length}</span>}
          </AccordionTrigger>
          <AccordionContent className="physics-chapter-content">
            <p className="physics-chapter-focus"><span>{t('theoryFocus')}</span>{chapter.focus[lang]}</p>
            {chapter.resources.map(resource => <TheoryResource key={resource.id} resource={resource} lang={lang} />)}
          </AccordionContent>
        </AccordionItem>)}
      </Accordion>
      <p className="physics-source-note"><ExternalLink size={15} /><span>{t('theoryExternalNote')}</span></p>
    </section>}
  </div>;
}
