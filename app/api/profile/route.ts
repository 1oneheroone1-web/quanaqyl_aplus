import { identity,database,ensureProfile,protect,payload,json,failure,ApiError } from '@/lib/server';
import {validateProfile} from '@/lib/profile';
export async function PUT(req:Request) {
  try {
    protect(req);
    const user=await identity();
    const profile=validateProfile(await payload(req));
    if (typeof profile==='string') throw new ApiError(profile);
    await ensureProfile(user);
    await database().prepare('UPDATE profiles SET data=?,updated_at=? WHERE user_id=?')
      .bind(JSON.stringify(profile),Date.now(),user.userId).run();
    return json({profile});
  } catch(e) { return failure(e); }
}
