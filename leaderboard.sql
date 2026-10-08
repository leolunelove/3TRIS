-- 3TRIS shared leaderboard. Apply only to the selected Supabase project.
-- Tables and RPCs are accessible to the Edge Function's server role only.
create table public.tris_run_tickets (
  id uuid primary key,
  player_hash text not null,
  ip_hash text not null,
  mode text not null check (mode in ('endless', 'sprint')),
  started_at timestamptz not null default now(),
  submitted boolean not null default false
);
create index tris_tickets_rate on public.tris_run_tickets (ip_hash, started_at);
create index tris_tickets_player on public.tris_run_tickets (player_hash, started_at);
create index tris_tickets_expiry on public.tris_run_tickets (started_at);
create table public.tris_scores (
  player_hash text not null,
  mode text not null check (mode in ('endless', 'sprint')),
  id uuid not null unique,
  nickname text not null check (nickname ~ '^[A-Za-z0-9 _-]{2,16}$'),
  score bigint not null check (score > 0 and score <= 1000000000),
  lines integer not null check (lines between 0 and 100000),
  level integer not null check (level between 1 and 10001),
  time_ms bigint not null check (time_ms between 1 and 86400000),
  created_at timestamptz not null default now(),
  primary key (player_hash, mode)
);
create index tris_scores_endless on public.tris_scores (score desc, created_at asc, id asc) where mode = 'endless';
create index tris_scores_sprint on public.tris_scores (time_ms asc, created_at asc, id asc) where mode = 'sprint';
alter table public.tris_run_tickets enable row level security;
alter table public.tris_scores enable row level security;
revoke all on public.tris_run_tickets, public.tris_scores from public, anon, authenticated;
grant select, insert, update, delete on public.tris_run_tickets, public.tris_scores to service_role;

create function public.tris_begin_run(p_id uuid, p_player text, p_ip text, p_mode text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_mode not in ('endless', 'sprint') then raise exception 'Invalid mode'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip, 0));
  if (select count(*) from public.tris_run_tickets where ip_hash = p_ip and started_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many starts. Wait a minute and try again.';
  end if;
  delete from public.tris_run_tickets where started_at < now() - interval '1 day';
  insert into public.tris_run_tickets(id, player_hash, ip_hash, mode) values (p_id, p_player, p_ip, p_mode);
  return jsonb_build_object('ok', true);
end;
$$;

create function public.tris_submit_score(p_id uuid, p_player text, p_name text, p_score bigint, p_lines integer, p_level integer, p_time bigint, p_pieces integer, p_completed boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ticket public.tris_run_tickets%rowtype;
  best public.tris_scores%rowtype;
  did_improve boolean := false;
  position bigint;
begin
  select * into ticket from public.tris_run_tickets where id = p_id and player_hash = p_player for update;
  if not found then raise exception 'Run session expired. Start a new run to post a score.'; end if;
  if p_name !~ '^[A-Za-z0-9 _-]{2,16}$' or btrim(p_name) <> p_name then raise exception 'Use 2–16 letters, numbers, spaces, underscores or hyphens.'; end if;
  if p_time < 1 or p_time > 86400000 or p_time > extract(epoch from (now() - ticket.started_at)) * 1000 + 3000 then raise exception 'Run timing could not be verified.'; end if;
  if p_pieces < 1 or p_pieces > 1000000 or p_pieces > p_time / 15 + 20 or p_lines < 0 or p_lines * 10 > p_pieces * 4 or p_score < 1 or p_score > 1000000000 then raise exception 'Invalid run result.'; end if;
  if ticket.mode = 'sprint' and (not p_completed or p_lines not between 40 and 43 or p_level <> 1) then raise exception 'Finish 40 lines to post a sprint time.'; end if;
  if ticket.mode = 'endless' and p_level <> p_lines / 10 + 1 then raise exception 'Invalid run level.'; end if;
  -- Serialize each mode so simultaneous submissions cannot exceed the ten-row cap.
  perform pg_advisory_xact_lock(hashtextextended('tris-leaderboard:' || ticket.mode, 0));
  if not ticket.submitted then
    insert into public.tris_scores(player_hash, mode, id, nickname, score, lines, level, time_ms)
    values (p_player, ticket.mode, p_id, p_name, p_score, p_lines, p_level, p_time)
    on conflict (player_hash, mode) do update set
      id = excluded.id, nickname = excluded.nickname, score = excluded.score,
      lines = excluded.lines, level = excluded.level, time_ms = excluded.time_ms, created_at = now()
    where (excluded.mode = 'endless' and excluded.score > tris_scores.score)
       or (excluded.mode = 'sprint' and excluded.time_ms < tris_scores.time_ms);
    did_improve := found;
    update public.tris_run_tickets set submitted = true where id = p_id;
  end if;
  delete from public.tris_scores where id in (
    select id from public.tris_scores where mode = ticket.mode
    order by case when mode = 'endless' then score end desc,
             case when mode = 'sprint' then time_ms end asc,
             created_at asc, id asc offset 10
  );
  select * into best from public.tris_scores where player_hash = p_player and mode = ticket.mode;
  if not found then return jsonb_build_object('improved', false, 'rank', null); end if;
  select count(*) + 1 into position from public.tris_scores s where s.mode = ticket.mode and (
    (s.mode = 'endless' and s.score > best.score) or (s.mode = 'sprint' and s.time_ms < best.time_ms) or
    ((case when s.mode = 'endless' then s.score = best.score else s.time_ms = best.time_ms end) and (s.created_at, s.id) < (best.created_at, best.id))
  );
  return jsonb_build_object('improved', did_improve, 'rank', case when position <= 10 then position else null end);
end;
$$;
revoke all on function public.tris_begin_run(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.tris_submit_score(uuid, text, text, bigint, integer, integer, bigint, integer, boolean) from public, anon, authenticated;
grant execute on function public.tris_begin_run(uuid, text, text, text) to service_role;
grant execute on function public.tris_submit_score(uuid, text, text, bigint, integer, integer, bigint, integer, boolean) to service_role;
