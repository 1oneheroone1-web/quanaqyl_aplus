import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from './chatgpt-auth';
import LearningApp from '@/components/learning-app';
export const dynamic='force-dynamic';
export default async function Home() {
  const user=await getChatGPTUser();
  return <LearningApp user={user?{name:user.displayName,email:user.email}:null}
    signInUrl={chatGPTSignInPath('/')} signOutUrl={chatGPTSignOutPath('/')} />;
}
