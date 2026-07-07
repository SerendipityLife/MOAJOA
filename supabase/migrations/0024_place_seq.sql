-- 0024_place_seq.sql — Phase 23 Web-First Foundation (MOA-01 순번 영구 채번).
-- places.seq_no + trips.last_place_seq 단조증가 카운터 + 기존 행 backfill
-- + advisory-lock SECURITY DEFINER 채번 트리거.
--
-- Why counter, not max(seq_no)+1: places에는 hard DELETE 정책이 실존한다
-- (0016 "places: delete if added_by self or trip owner"). 최고 순번 행이 hard
-- delete되면 max+1은 그 번호를 재사용해 MOA-01(순번 절대 재부여 금지)을 위반.
-- trips.last_place_seq 카운터는 단조증가라 어떤 삭제 경로에서도 재부여 불가.
-- 순서가 곧 정합성: ①nullable 추가 → ②backfill(tiebreak=id) → ③not null 승격
-- → ④unique 인덱스 → ⑤카운터 동기화 → ⑥트리거.
--
-- Append-only: 0016..0023 are NEVER modified.

alter table trips add column last_place_seq int not null default 0;
alter table places add column seq_no int;

-- backfill: created_at 순, 동률(같은 추출 배치)은 id로 tiebreak. hidden 행 포함(순번 영구성).
with numbered as (
  select id, row_number() over (partition by trip_id order by created_at, id) as rn
  from places
)
update places p set seq_no = n.rn from numbered n where p.id = n.id;

update trips t set last_place_seq = coalesce(
  (select max(seq_no) from places where trip_id = t.id), 0);

alter table places alter column seq_no set not null;
create unique index places_trip_seq_key on places (trip_id, seq_no);

-- 채번 트리거. security definer 필수: places INSERT는 editor 허용(0016 L477~480)이지만
-- trips UPDATE는 owner 전용(0016 L187~191) — invoker면 editor insert 시 트리거 실패 (Pitfall 2).
create or replace function assign_place_seq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 클라이언트 제공 seq_no는 신뢰하지 않음 — 항상 트리거가 채번 (forge 차단)
  perform pg_advisory_xact_lock(hashtextextended('place_seq:' || new.trip_id::text, 0));
  update trips set last_place_seq = last_place_seq + 1
    where id = new.trip_id
    returning last_place_seq into new.seq_no;
  if new.seq_no is null then
    raise exception 'trip % not found for seq assignment', new.trip_id;
  end if;
  return new;
end;
$$;

create trigger places_seq_before_insert
  before insert on places
  for each row execute function assign_place_seq();
