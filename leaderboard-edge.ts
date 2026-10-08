// Supabase Edge Function: tris-leaderboard. All database credentials stay on the server.
const url = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Public identifier for this app only; it grants no direct database access.
const applicationKey = 'tris_public_e5f14027bda1f1cff122566fe7a6c6b9334119efa3f3fe33';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
async function hash(value: string) {
  const data = new TextEncoder().encode(`${secret}:${value}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
}
async function database(path: string, body?: unknown) {
  const res = await fetch(`${url}/rest/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) {
    if (data.code === 'P0001') throw new Error(data.message);
    console.error('3TRIS database request failed', res.status, data.code);
    throw new Error('Leaderboard unavailable. Please try again.');
  }
  return data;
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  // Custom API-key authentication allows current publishable keys without JWT verification.
  if (req.headers.get('apikey') !== applicationKey) return response({ error: 'Invalid application key.' }, 401);
  try {
    if (req.method === 'GET') {
      const mode = new URL(req.url).searchParams.get('mode');
      if (mode !== 'endless' && mode !== 'sprint') return response({ error: 'Invalid mode.' }, 400);
      const order = mode === 'endless' ? 'score.desc' : 'time_ms.asc';
      const entries = await database(`tris_scores?mode=eq.${mode}&select=id,nickname,score,lines,level,time_ms&order=${order},created_at.asc,id.asc&limit=10`);
      return response({ entries });
    }
    if (req.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);
    if (Number(req.headers.get('content-length') || 0) > 2048) return response({ error: 'Request too large.' }, 413);
    const raw = await req.text();
    if (raw.length > 2048) return response({ error: 'Request too large.' }, 413);
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return response({ error: 'Invalid request.' }, 400);
    if (!/^[a-f0-9]{64}$/.test(data.playerToken) || !/^[a-f0-9-]{36}$/.test(data.runId)) return response({ error: 'Invalid player or run.' }, 400);
    const player = await hash(data.playerToken);
    if (data.action === 'start') {
      if (data.mode !== 'endless' && data.mode !== 'sprint') return response({ error: 'Invalid mode.' }, 400);
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      return response(await database('rpc/tris_begin_run', { p_id: data.runId, p_player: player, p_ip: await hash(ip), p_mode: data.mode }));
    }
    if (data.action !== 'submit') return response({ error: 'Invalid action.' }, 400);
    if (typeof data.nickname !== 'string' || !/^[A-Za-z0-9 _-]{2,16}$/.test(data.nickname.trim()) || typeof data.completed !== 'boolean' || !['score','lines','level','timeMs','pieces'].every(k => Number.isSafeInteger(data[k]))) return response({ error: 'Invalid result or player name.' }, 400);
    return response(await database('rpc/tris_submit_score', { p_id: data.runId, p_player: player, p_name: data.nickname.trim(), p_score: data.score, p_lines: data.lines, p_level: data.level, p_time: data.timeMs, p_pieces: data.pieces, p_completed: data.completed }));
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid request.' : error instanceof Error ? error.message : 'Leaderboard unavailable. Please try again.';
    return response({ error: message }, message.includes('Too many') ? 429 : 400);
  }
});
