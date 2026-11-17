import { emptyResponse, InputError, rateLimited, readBody, requestEnvironment, simulateFailure, stringField, type GrowthEnv } from '../lib/growth';
import { requireSecret } from '../lib/security';

function configured(env: GrowthEnv) {
  try { return env.FEEDBACK_ENABLED === 'true' && !!env.DB && !!requireSecret(env, 'ADMIN_SECRET'); }
  catch { return false; }
}

export const onRequestGet = async ({ env }: { env: GrowthEnv }) => {
  let enabled = configured(env);
  if (enabled) {
    try { await env.DB.prepare('SELECT id FROM feedback LIMIT 1').first(); }
    catch { enabled = false; }
  }
  return new Response(JSON.stringify({ enabled }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: GrowthEnv }) => {
  try {
    if (rateLimited(request)) return emptyResponse(429);
    if (simulateFailure(request)) return emptyResponse(500);
    if (!configured(env)) return emptyResponse(503);
    const body = await readBody(request);
    const email = stringField(body, 'email', 254), message = stringField(body, 'message', 500);
    if ((!email && !message) || (email && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email))) return emptyResponse(400);
    if (!env.DB) return emptyResponse(503);
    await env.DB.prepare('INSERT INTO feedback (id, env, email, message) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), requestEnvironment(request), email || null, message || null).run();
    return emptyResponse();
  } catch (error) { return emptyResponse(error instanceof InputError ? error.status : 503); }
};
