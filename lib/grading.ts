import { problems, markAnswer, parseAnswer } from './catalog';
export class InvalidAttempt extends Error {
}
export function gradeAttempt(input: unknown, now = Date.now()) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new InvalidAttempt();
    const body = input as Record<string, unknown>;
    if (typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)
        || !['diagnostic', 'practice'].includes(body.mode as string)
        || !Array.isArray(body.responses) || body.responses.length < 1 || body.responses.length > 14)
        throw new InvalidAttempt();
    const seen = new Set<string>();
    const answers = body.responses.map((response: unknown) => {
        if (!response || typeof response !== 'object' || Array.isArray(response))
            throw new InvalidAttempt();
        const r = response as Record<string, unknown>;
        const problem = problems.find(p => p.id === r.problemId);
        if (!problem || seen.has(problem.id) || !Array.isArray(r.values) || r.values.length !== problem.parts.length
            || !r.values.every(v => parseAnswer(v) !== null))
            throw new InvalidAttempt();
        seen.add(problem.id);
        const values = r.values as string[];
        const checks = problem.parts.map((part, i) => markAnswer(values[i], part));
        return { problemId: problem.id, topic: problem.topic, kind: problem.kind, values, checks, correct: checks.every(Boolean) };
    });
    if (body.mode === 'diagnostic' && answers.some(a => a.kind !== 'foundation' || !a.problemId.endsWith('-0')))
        throw new InvalidAttempt();
    if (body.mode === 'practice') {
        if (answers[0].kind === 'challenge') {
            if (answers.length !== 1)
                throw new InvalidAttempt();
        }
        else if (answers.length !== 2 || answers.some(a => a.kind !== 'foundation' || a.topic !== answers[0].topic))
            throw new InvalidAttempt();
    }
    return {
        id: body.id, mode: body.mode as 'diagnostic' | 'practice', answers,
        total: answers.reduce((n, a) => n + a.checks.length, 0),
        correct: answers.reduce((n, a) => n + a.checks.filter(Boolean).length, 0), date: now,
    };
}
