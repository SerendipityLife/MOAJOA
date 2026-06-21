-- 0014_profile_gender_birthday.sql
-- "내 정보" tab: user-editable gender + birthday on profiles.
-- Both nullable — no backfill, no downtime. The existing "profiles: update own"
-- policy (0001) already lets a user write these columns on their own row.

alter table profiles
  add column gender text check (gender in ('male', 'female', 'other')),
  add column birthday date;
