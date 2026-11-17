import { emptyResponse, InputError, readBody, stringField, type GrowthEnv } from '../../lib/growth';
import { requireSecret, verifyAdminToken } from '../../lib/security';

// Fulfil deletion requests received at support@devsnapkit.com using an existing
// admin session. No public search/list route exposes submitted email or text.
export const onRequestDelete = async ({ request, env }: { request: Request; env: GrowthEnv }) => {
  let secret: string;
  try { secret = requireSecret(env, 'ADMIN_SECRET'); }
  catch { return emptyResponse(503); }
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || !await verifyAdminToken(authorization.slice(7).trim(), secret)) return emptyResponse(401);
  try {
    if (!env.DB) return emptyResponse(503);
    const body = await readBody(request);
    const id = stringField(body, 'id', 64);
    if (!id) return emptyResponse(400);
    const result = await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ deleted: Number(result.meta?.changes || 0) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (error) { return emptyResponse(error instanceof InputError ? error.status : 503); }
};
