import { gradeTopics, topicNames } from './catalog';
export type LearningAttempt = {
    id: string;
    mode: 'diagnostic' | 'practice';
    date: number;
    total: number;
    correct: number;
    answers: {
        problemId: string;
        topic: number;
        checks: boolean[];
        correct: boolean;
    }[];
};
/** Use the latest response to each problem, so old mistakes do not permanently lower progress. */
export function topicEvidence(attempts: LearningAttempt[], topic: number) {
    const latest = new Map<string, LearningAttempt['answers'][number]>();
    [...attempts].sort((a, b) => b.date - a.date).forEach(attempt => {
        attempt.answers.filter(a => a.topic === topic).forEach(answer => {
            if (!latest.has(answer.problemId))
                latest.set(answer.problemId, answer);
        });
    });
    const answers = [...latest.values()];
    const total = answers.reduce((n, a) => n + a.checks.length, 0);
    const correct = answers.reduce((n, a) => n + a.checks.filter(Boolean).length, 0);
    return { total, correct, score: total ? Math.round(correct / total * 100) : null };
}
/** Transparent study recommendations, not an LLM or a prediction of exam grades. */
export function learningPath(attempts: LearningAttempt[], level: string) {
    return (gradeTopics[level] ?? gradeTopics.a).map(topic => {
        const evidence = topicEvidence(attempts, topic);
        const status = evidence.score === null ? 'unexplored' : evidence.score < 80 ? 'focus' : 'review';
        return { topic, ...evidence, status };
    }).sort((a, b) => {
        const rank = { focus: 0, unexplored: 1, review: 2 };
        return rank[a.status as keyof typeof rank] - rank[b.status as keyof typeof rank]
            || (a.score ?? 0) - (b.score ?? 0) || a.topic - b.topic;
    });
}
function dayKey(date: Date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
export function recentActivity(attempts: LearningAttempt[], now = new Date()) {
    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
        const count = attempts.filter(a => dayKey(new Date(a.date)) === dayKey(date))
            .reduce((sum, a) => sum + a.answers.length, 0);
        return { date, count };
    });
}
export function studyStreak(attempts: LearningAttempt[], now = new Date()) {
    const active = new Set(attempts.map(a => dayKey(new Date(a.date))));
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!active.has(dayKey(cursor)))
        cursor.setDate(cursor.getDate() - 1);
    let days = 0;
    while (active.has(dayKey(cursor))) {
        days++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return days;
}
export const topicCount = topicNames.length;
