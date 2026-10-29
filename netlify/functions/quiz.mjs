import { getStore } from '@netlify/blobs';
import { createHandler } from '../../lib/game.mjs';

// Site-wide storage survives function cold starts and new deployments.
export default async function quiz(request) {
  try {
    const store = getStore({name:'ratio-arena-rooms-v1',consistency:'strong'});
    return await createHandler(store)(request);
  } catch (error) {
    console.error('Quiz storage unavailable:', error.name);
    return Response.json({error:'雲端儲存未就緒。請確認已連同 Netlify Functions 部署；暫時可用本機示範。'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
