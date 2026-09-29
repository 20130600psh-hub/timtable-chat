-- Supabase SQL Editor에서 전체 실행하세요.
-- 이 SQL은 채팅 메시지 테이블과 공개 읽기/쓰기 정책을 만듭니다.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_name text not null check (char_length(room_name) between 1 and 50),
  nickname text not null check (char_length(nickname) between 1 and 30),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx
on public.chat_messages (room_name, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Anyone can read chat messages" on public.chat_messages;
create policy "Anyone can read chat messages"
on public.chat_messages for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can send chat messages" on public.chat_messages;
create policy "Anyone can send chat messages"
on public.chat_messages for insert
to anon, authenticated
with check (
  char_length(room_name) between 1 and 50
  and char_length(nickname) between 1 and 30
  and char_length(message) between 1 and 1000
);

-- 이미 추가되어 있으면 오류가 날 수 있으므로, 오류가 나면 이 줄은 건너뛰어도 됩니다.
alter publication supabase_realtime add table public.chat_messages;
