import { identity, ensureProfile, protect, json, failure, ApiError, limitedBody } from '@/lib/server';
import { getPool, withTransaction } from '@/lib/database';

export async function GET() {
    try {
        const user = await identity();
        const result = await getPool().query<{ bytes: Buffer; content_type: string }>(
            'SELECT bytes,content_type FROM photos WHERE user_id=$1', [user.userId]);
        const photo = result.rows[0];
        if (!photo) return new Response(null, { status: 404 });
        return new Response(new Uint8Array(photo.bytes), { headers: {
            'Content-Type': photo.content_type,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        } });
    } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
    try {
        protect(req);
        const user = await identity();
        let data: FormData;
        try {
            const body = await limitedBody(req, 2_200_000);
            data = await new Response(body.buffer as ArrayBuffer, {
                headers: { 'Content-Type': req.headers.get('content-type') || '' },
            }).formData();
        } catch (error) {
            if (error instanceof ApiError) throw new ApiError('photo_size', 413);
            throw new ApiError('photo_type');
        }
        const file = data.get('photo');
        if (!(file instanceof File) || file.size > 2_097_152 || file.size === 0) throw new ApiError('photo_size');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const png = bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
        const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
        const type = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : null;
        if (!type || file.type !== type) throw new ApiError('photo_type');
        await ensureProfile(user);
        const stamp = Date.now(), marker = 'photos/' + crypto.randomUUID();
        await withTransaction(async client => {
            await client.query(`INSERT INTO photos (user_id,content_type,bytes,updated_at) VALUES ($1,$2,$3,$4)
                ON CONFLICT(user_id) DO UPDATE SET content_type=EXCLUDED.content_type,bytes=EXCLUDED.bytes,updated_at=EXCLUDED.updated_at`,
            [user.userId, type, Buffer.from(bytes), stamp]);
            await client.query('UPDATE profiles SET photo_key=$1,updated_at=$2 WHERE user_id=$3', [marker, stamp, user.userId]);
        });
        return json({ photo: '/api/photo?v=' + stamp });
    } catch (error) { return failure(error); }
}

export async function DELETE(req: Request) {
    try {
        protect(req);
        const user = await identity();
        await withTransaction(async client => {
            await client.query('DELETE FROM photos WHERE user_id=$1', [user.userId]);
            await client.query('UPDATE profiles SET photo_key=NULL,updated_at=$1 WHERE user_id=$2', [Date.now(), user.userId]);
        });
        return json({ photo: null });
    } catch (error) { return failure(error); }
}
