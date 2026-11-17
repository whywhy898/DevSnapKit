import { attribution, emptyResponse, eventNames, InputError, rateLimited, readBody, simulateFailure, writeEvent, type GrowthEnv, type GrowthEvent } from '../lib/growth';

export const onRequestPost = async ({ request, env }: { request: Request; env: GrowthEnv }) => {
  try {
    if (rateLimited(request)) return emptyResponse(429);
    if (simulateFailure(request)) return emptyResponse(500);
    const body = await readBody(request);
    if (!eventNames.has(body.event)) return emptyResponse(400);
    const data = attribution(body);
    if (body.event === 'payment') return emptyResponse(403);
    await writeEvent(env, request, body.event as GrowthEvent, data);
    return emptyResponse();
  } catch (error) { return emptyResponse(error instanceof InputError ? error.status : 204); }
};
export const onRequestOptions = async () => emptyResponse();
