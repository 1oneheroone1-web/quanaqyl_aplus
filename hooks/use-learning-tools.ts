'use client';
import { useEffect } from 'react';
import { learningPath, type LearningAttempt } from '@/lib/learning';
import { topicNames, type Lang } from '@/lib/catalog';

type ModelContext = {
  registerTool: (tool: {
    name: string; title: string; description: string; inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
  }, options: { signal: AbortSignal }) => void | Promise<void>;
};

export function useLearningTools(account: { attempts: LearningAttempt[]; profile: { level: string } } | null, lang: Lang) {
  useEffect(() => {
    if (!account) return;
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: 'get_learning_plan', title: 'Read your learning plan',
      description: 'Read the signed-in student’s study priorities and latest topic scores, matching the visible study plan. Does not submit answers or change progress.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
        return { basis: 'latest responses, rule-based', level: account.profile.level,
          topics: learningPath(account.attempts, account.profile.level).map(item => ({
            topic: topicNames[item.topic][lang], score: item.score, status: item.status,
          })) };
      },
    };
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
    catch { /* Unsupported experimental browser capability must not block learning. */ }
    return () => lifecycle.abort();
  }, [account, lang]);
}
