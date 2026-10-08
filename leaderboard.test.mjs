import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let handler;
let calls = [];
let fail = false;
const source = ts.transpileModule(readFileSync('leaderboard-edge.ts','utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
new Function('Deno','fetch', source)(
  { env: { get: key => ({ SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-server-secret', SUPABASE_PUBLISHABLE_KEYS: '{"default":"test-public-key"}' })[key] }, serve: fn => { handler = fn; } },
  async (url, opts) => { calls.push({url, ...opts}); return new Response(JSON.stringify(fail ? {code:'P0001', message:'Too many starts. Wait a minute and try again.'} : url.includes('tris_scores?') ? [] : {ok:true}), { status: fail ? 400 : 200 }); }
);
const publicKey = readFileSync('src/lib/game/leaderboard-config.ts','utf8').match(/LEADERBOARD_KEY = "([^"]+)"/)[1];
const headers = { apikey: publicKey, 'content-type':'application/json' };
const run = { action:'start', mode:'endless', runId:'a1b2c3d4-1234-4123-8123-a1b2c3d4e5f6', playerToken:'a'.repeat(64) };
const send = body => handler(new Request('https://example.test/functions/v1/tris-leaderboard', {method:'POST', headers, body:JSON.stringify(body)}));
assert.equal((await handler(new Request('https://example.test?mode=endless'))).status, 401);
assert.equal(calls.length, 0);
assert.equal((await handler(new Request('https://example.test?mode=invalid',{headers}))).status, 400);
for (const mode of ['endless','sprint']) {
  const response = await handler(new Request(`https://example.test?mode=${mode}`,{headers}));
  assert.equal(response.status,200);
  const url = new URL(calls.at(-1).url);
  assert.equal(url.searchParams.get('limit'),'10');
  assert.equal(url.searchParams.get('order'),`${mode === 'endless' ? 'score.desc' : 'time_ms.asc'},created_at.asc,id.asc`);
  assert.equal(url.searchParams.get('select').includes('player_hash'),false);
}
assert.equal((await send(run)).status,200);
const start = JSON.parse(calls.at(-1).body);
assert.match(start.p_player,/^[a-f0-9]{64}$/);
assert.notEqual(start.p_player,run.playerToken);
assert.notEqual(start.p_ip,'unknown');
assert.equal((await send({...run,playerToken:'bad'})).status,400);
assert.equal((await send({...run,action:'submit',nickname:'<script>'})).status,400);
const submission = {...run,action:'submit',nickname:'Player 1',score:100,lines:0,level:1,timeMs:1000,pieces:2,completed:false};
assert.equal((await send({...submission,score:'100'})).status,400);
assert.equal((await send(submission)).status,200);
assert.equal(JSON.parse(calls.at(-1).body).p_name,'Player 1');
fail=true;
assert.equal((await send(run)).status,429);
console.log('Passed: leaderboard API authentication, mode sorting, top-10 limit, private field protection, input validation and rate-limit errors.');
