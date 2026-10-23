import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { defaultProfile } from '@/lib/profile';
import { getShopState } from '@/lib/shop-server';
export function database() { const db = (env as any).DB as D1Database; if (!db)
    throw new Error('Storage unavailable'); return db; }
export function bucket() { const b = (env as any).BUCKET as R2Bucket; if (!b)
    throw new Error('Upload storage unavailable'); return b; }
export async function identity() { const u = await getChatGPTUser(); if (!u)
    throw new ApiError('unauthorized', 401); return u; }
export class ApiError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export function failure(e: unknown) { if (e instanceof ApiError)
    return json({ error: e.message }, e.status); console.error('Account operation failed', e); return json({ error: 'storage_unavailable' }, 503); }
export function protect(req: Request) { const origin = req.headers.get('origin'); if (origin && origin !== new URL(req.url).origin)
    throw new ApiError('forbidden', 403); if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new ApiError('forbidden', 403); }
export async function limitedBody(req: Request, max = 65536) {
    if (Number(req.headers.get('content-length') || 0) > max)
        throw new ApiError('too_large', 413);
    if (!req.body)
        return new Uint8Array();
    const reader = req.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > max) {
                await reader.cancel();
                throw new ApiError('too_large', 413);
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
export async function payload(req: Request) {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
        throw new ApiError('invalid_input', 415);
    const str = new TextDecoder().decode(await limitedBody(req));
    try {
        const value = JSON.parse(str);
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error();
        return value;
    }
    catch {
        throw new ApiError('invalid_input');
    }
}
export async function ensureProfile(user: {
    userId: string;
    displayName: string;
}) { const data = defaultProfile(user.displayName); await database().prepare('INSERT INTO profiles (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId, JSON.stringify(data), Date.now()).run(); }
export async function account(user: {
    userId: string;
    displayName: string;
    email: string;
}) { await ensureProfile(user); const db = database(); const [p, a, w, f, shop] = await Promise.all([db.prepare('SELECT data,photo_key,updated_at FROM profiles WHERE user_id=?').bind(user.userId).first<any>(), db.prepare('SELECT data FROM attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 500').bind(user.userId).all<any>(), db.prepare('SELECT key,amount,created_at FROM awards WHERE user_id=? ORDER BY created_at DESC').bind(user.userId).all<any>(), db.prepare('SELECT id,start,end FROM pauses WHERE user_id=? ORDER BY start DESC').bind(user.userId).all<any>(), getShopState(db, user.userId)]); return { shop, profile: { ...defaultProfile(user.displayName), ...JSON.parse(p.data) }, photo: p.photo_key ? '/api/photo?v=' + p.updated_at : null, attempts: a.results.map(r => JSON.parse(r.data)), awards: w.results, pauses: f.results, email: user.email }; }
