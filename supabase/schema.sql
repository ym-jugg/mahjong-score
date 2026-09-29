-- 麻雀スコア帳：共有用のデータベース設定
-- Supabase の SQL Editor にこのファイルの中身を貼り付けて「Run」を1回押してください（何度実行しても大丈夫です）

create extension if not exists pgcrypto;

-- 卓：ルール・メンバー名・チップなど（state）と、招待用・閲覧用のリンクの鍵
create table if not exists public.mj_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null default '麻雀卓',
  state jsonb not null default '{}'::jsonb,
  invite_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  view_token   text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 卓の参加者
create table if not exists public.mj_members (
  table_id uuid not null references public.mj_tables(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id)
);

-- 半荘の記録（1半荘＝1行。削除は deleted=true）
create table if not exists public.mj_games (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.mj_tables(id) on delete cascade,
  data jsonb not null,
  deleted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mj_games_table_idx on public.mj_games (table_id, created_at);

-- 更新日時を自動で入れる
create or replace function public.mj_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists mj_tables_touch on public.mj_tables;
create trigger mj_tables_touch before update on public.mj_tables for each row execute function public.mj_touch();
drop trigger if exists mj_games_touch on public.mj_games;
create trigger mj_games_touch before update on public.mj_games for each row execute function public.mj_touch();

-- 自分がその卓の参加者か
create or replace function public.mj_is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mj_members where table_id = t and user_id = auth.uid());
$$;

-- アクセス制限：参加者だけが読み書きできる
alter table public.mj_tables  enable row level security;
alter table public.mj_members enable row level security;
alter table public.mj_games   enable row level security;

drop policy if exists mj_tables_select on public.mj_tables;
drop policy if exists mj_tables_update on public.mj_tables;
drop policy if exists mj_tables_delete on public.mj_tables;
create policy mj_tables_select on public.mj_tables for select to authenticated using (public.mj_is_member(id));
create policy mj_tables_update on public.mj_tables for update to authenticated using (public.mj_is_member(id)) with check (public.mj_is_member(id));
create policy mj_tables_delete on public.mj_tables for delete to authenticated using (created_by = auth.uid());

drop policy if exists mj_members_select on public.mj_members;
drop policy if exists mj_members_delete on public.mj_members;
create policy mj_members_select on public.mj_members for select to authenticated using (public.mj_is_member(table_id));
create policy mj_members_delete on public.mj_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists mj_games_select on public.mj_games;
drop policy if exists mj_games_insert on public.mj_games;
drop policy if exists mj_games_update on public.mj_games;
create policy mj_games_select on public.mj_games for select to authenticated using (public.mj_is_member(table_id));
create policy mj_games_insert on public.mj_games for insert to authenticated with check (public.mj_is_member(table_id) and created_by = auth.uid());
create policy mj_games_update on public.mj_games for update to authenticated using (public.mj_is_member(table_id)) with check (public.mj_is_member(table_id));

-- 招待リンク・閲覧リンクの鍵は参加者でも直接は変えられない（作った人だけが作り直せる）
revoke update on public.mj_tables from authenticated, anon;
grant update (name, state) on public.mj_tables to authenticated;
revoke insert on public.mj_tables, public.mj_members from authenticated, anon;

-- 卓を作る（今のデータと記録をまとめて登録し、自分を参加者にする）
create or replace function public.mj_create_table(p_name text, p_state jsonb, p_games jsonb default '[]'::jsonb, p_display_name text default null)
returns public.mj_tables language plpgsql security definer set search_path = public as $$
declare t public.mj_tables; g jsonb;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  insert into public.mj_tables (name, state, created_by) values (coalesce(nullif(trim(p_name), ''), '麻雀卓'), coalesce(p_state, '{}'::jsonb), auth.uid()) returning * into t;
  insert into public.mj_members (table_id, user_id, display_name) values (t.id, auth.uid(), p_display_name);
  for g in select * from jsonb_array_elements(coalesce(p_games, '[]'::jsonb)) loop
    insert into public.mj_games (id, table_id, data, created_by)
    values (coalesce((g->>'id')::uuid, gen_random_uuid()), t.id, g->'data', auth.uid());
  end loop;
  return t;
end $$;

-- 招待リンクで参加する
create or replace function public.mj_join_table(p_token text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  select id into tid from public.mj_tables where invite_token = p_token;
  if tid is null then raise exception '招待リンクが正しくないか、無効になっています'; end if;
  insert into public.mj_members (table_id, user_id, display_name) values (tid, auth.uid(), p_display_name)
  on conflict (table_id, user_id) do update set display_name = coalesce(excluded.display_name, public.mj_members.display_name);
  return tid;
end $$;

-- 閲覧リンクで見る（ログイン不要・読み取りだけ）
create or replace function public.mj_view_table(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', t.name, 'state', t.state, 'updated_at', t.updated_at,
    'games', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'data', g.data) order by g.created_at)
                       from public.mj_games g where g.table_id = t.id and not g.deleted), '[]'::jsonb))
  from public.mj_tables t where t.view_token = p_token;
$$;

-- 招待・閲覧リンクを作り直す（前のリンクは使えなくなる）。卓を作った人だけ
create or replace function public.mj_reset_links(p_table uuid)
returns public.mj_tables language plpgsql security definer set search_path = public as $$
declare t public.mj_tables;
begin
  update public.mj_tables set invite_token = encode(gen_random_bytes(12), 'hex'), view_token = encode(gen_random_bytes(12), 'hex')
  where id = p_table and created_by = auth.uid() returning * into t;
  if t.id is null then raise exception '卓を作った人だけがリンクを作り直せます'; end if;
  return t;
end $$;

revoke all on function public.mj_create_table(text, jsonb, jsonb, text) from public, anon;
revoke all on function public.mj_join_table(text, text) from public, anon;
revoke all on function public.mj_reset_links(uuid) from public, anon;
grant execute on function public.mj_create_table(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.mj_join_table(text, text) to authenticated;
grant execute on function public.mj_reset_links(uuid) to authenticated;
grant execute on function public.mj_view_table(text) to anon, authenticated;

-- 他の人の入力をすぐ画面に反映する（リアルタイム）
do $$ begin
  begin alter publication supabase_realtime add table public.mj_tables; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mj_games;  exception when duplicate_object then null; end;
end $$;
