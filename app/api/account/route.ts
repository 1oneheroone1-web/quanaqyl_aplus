import { identity,account,json,failure } from '@/lib/server';
export async function GET(){try{return json(await account(await identity()))}catch(e){return failure(e)}}
