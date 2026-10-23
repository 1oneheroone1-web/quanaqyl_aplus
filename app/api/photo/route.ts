import { identity, database, bucket, ensureProfile, protect, json, failure, ApiError, limitedBody } from '@/lib/server';
export async function GET() { try {
    const u = await identity();
    const p = await database().prepare('SELECT photo_key FROM profiles WHERE user_id=?').bind(u.userId).first<any>();
    if (!p?.photo_key)
        return new Response(null, { status: 404 });
    const file = await bucket().get(p.photo_key);
    if (!file)
        return new Response(null, { status: 404 });
    return new Response(file.body, { headers: { 'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
catch (e) {
    return failure(e);
} }
export async function POST(req: Request) { try {
    protect(req);
    const u = await identity();
    if (Number(req.headers.get('content-length') || 0) > 2200000)
        throw new ApiError('photo_size', 413);
    let data: FormData;
    try {
        const bytes = await limitedBody(req, 2200000);
        data = await new Response(bytes.buffer as ArrayBuffer, { headers: { 'Content-Type': req.headers.get('content-type') || '' } }).formData();
    }
    catch (e) {
        if (e instanceof ApiError)
            throw new ApiError('photo_size', 413);
        throw new ApiError('photo_type');
    }
    const file = data.get('photo');
    if (!(file instanceof File) || file.size > 2097152 || file.size === 0)
        throw new ApiError('photo_size');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    const type = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : null;
    if (!type || file.type !== type)
        throw new ApiError('photo_type');
    await ensureProfile(u);
    const old = await database().prepare('SELECT photo_key FROM profiles WHERE user_id=?').bind(u.userId).first<any>();
    const key = 'photos/' + crypto.randomUUID();
    await bucket().put(key, bytes, { httpMetadata: { contentType: type } });
    const stamp = Date.now();
    try {
        await database().prepare('UPDATE profiles SET photo_key=?,updated_at=? WHERE user_id=?').bind(key, stamp, u.userId).run();
    }
    catch (e) {
        await bucket().delete(key);
        throw e;
    }
    if (old?.photo_key)
        await bucket().delete(old.photo_key).catch(() => { });
    return json({ photo: '/api/photo?v=' + stamp });
}
catch (e) {
    return failure(e);
} }
export async function DELETE(req: Request) { try {
    protect(req);
    const u = await identity();
    const old = await database().prepare('SELECT photo_key FROM profiles WHERE user_id=?').bind(u.userId).first<any>();
    await database().prepare('UPDATE profiles SET photo_key=NULL,updated_at=? WHERE user_id=?').bind(Date.now(), u.userId).run();
    if (old?.photo_key)
        await bucket().delete(old.photo_key).catch(() => { });
    return json({ photo: null });
}
catch (e) {
    return failure(e);
} }
