'use client';

import { useState, type ReactNode } from 'react';
import { Atom, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TheoryLibrary from '@/components/theory-library';
import { defaultPhysicsGrade, physicsTheoryModules, type PhysicsGrade } from '@/lib/physics-theory';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';

export default function PhysicsHub({ lang, level, initialModuleId, simulation }: {
  lang: Lang;
  level: string;
  initialModuleId?: string;
  simulation: ReactNode;
}) {
  const t = (key: string) => tr(key, lang);
  const initialModule = physicsTheoryModules.find(module => module.id === initialModuleId);
  const [section, setSection] = useState('theory');
  const [grade, setGrade] = useState<PhysicsGrade>(() => initialModule?.grade ?? defaultPhysicsGrade(level));
  const [openModule, setOpenModule] = useState(initialModule?.id ?? '');
  const changeGrade = (value: PhysicsGrade) => { setGrade(value); setOpenModule(''); };

  return <div className="physics-hub">
    <div className="page-heading"><div><h1>{t('physics')}</h1><p>{t('physicsHubSub')}</p></div><div className="page-orbit" aria-hidden="true" /></div>
    <Tabs value={section} onValueChange={setSection} className="physics-hub-tabs">
      <TabsList className="physics-section-tabs" aria-label={t('physicsSections')}>
        <TabsTrigger value="theory"><BookOpen size={20} /><span>{t('theory')}</span></TabsTrigger>
        <TabsTrigger value="action"><Atom size={21} /><span>{t('physicsAction')}</span></TabsTrigger>
      </TabsList>
      <TabsContent value="theory" forceMount hidden={section !== 'theory'}>
        <TheoryLibrary lang={lang} grade={grade} onGradeChange={changeGrade} openModule={openModule} onModuleChange={setOpenModule} onExplore={() => setSection('action')} />
      </TabsContent>
      <TabsContent value="action" forceMount hidden={section !== 'action'}>
        <div className="physics-action-heading"><h2>{t('physicsAction')}</h2><p>{t('physicsSub')}</p></div>
        {simulation}
      </TabsContent>
    </Tabs>
  </div>;
}
