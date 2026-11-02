-- ============================================================================
-- 급식 NEXT · Supabase 전체 설치 파일
-- 생성 기준: 2026-07-19
--
-- 사용법: Supabase Dashboard > SQL Editor > New query에서 파일 전체를 실행합니다.
-- 안전성:
--   1) 전체 작업을 한 트랜잭션으로 실행하므로 중간 오류 시 모두 롤백됩니다.
--   2) 타입·테이블·컬럼·인덱스는 존재 여부를 확인합니다.
--   3) 정책과 트리거는 이름 기준으로 제거 후 다시 생성합니다.
--   4) 함수는 CREATE OR REPLACE를 사용합니다.
--   5) 기본 분류 데이터는 ON CONFLICT DO NOTHING으로 중복을 막습니다.
--
-- 주의: 같은 이름의 테이블을 다른 서비스가 이미 사용 중인 프로젝트에는 실행하지
-- 마세요. 기존 급식 NEXT DB에 재실행하는 것은 허용되지만 실행 전 백업을 권장합니다.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.meal_time as enum ('breakfast','lunch','dinner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.share_status as enum ('pending','approved','rejected','revoked','expired');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.variable_type as enum ('number','boolean','single_select','multi_select');
exception when duplicate_object then null; end $$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_code text unique not null,
  school_level text not null,
  province text not null,
  district text not null,
  student_count int not null check(student_count>=0),
  meal_target_count int not null check(meal_target_count>=0),
  male_count int not null default 0,
  female_count int not null default 0,
  gender_type text not null,
  boarding_type text not null,
  serves_breakfast boolean not null default false,
  serves_lunch boolean not null default true,
  serves_dinner boolean not null default false,
  latitude numeric,
  longitude numeric,
  meal_record_count int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.school_members (
  school_id uuid references public.schools on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'manager',
  primary key(school_id,user_id)
);
create table if not exists public.meal_categories (
  id smallserial primary key,
  name text unique not null
);
create table if not exists public.standard_tags (
  id smallserial primary key,
  name text unique not null
);
create table if not exists public.meal_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools on delete cascade,
  meal_date date not null,
  meal_time public.meal_time not null,
  target_count int not null check(target_count>0),
  menu_text text not null,
  weather_status text,
  temperature numeric,
  has_precipitation boolean not null default false,
  prepared_count int not null check(prepared_count>=0),
  actual_count int not null check(actual_count>=0),
  waste_kg numeric not null check(waste_kg>=0),
  private_note text,
  other_tag_text text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.meal_record_categories (
  meal_record_id uuid references public.meal_records on delete cascade,
  category_id smallint references public.meal_categories,
  primary key(meal_record_id,category_id)
);
create table if not exists public.meal_record_tags (
  meal_record_id uuid references public.meal_records on delete cascade,
  tag_id smallint references public.standard_tags,
  primary key(meal_record_id,tag_id)
);
create table if not exists public.custom_variable_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools on delete cascade,
  name text not null,
  description text,
  input_type public.variable_type not null,
  unit text,
  applies_breakfast boolean default false,
  applies_lunch boolean default false,
  applies_dinner boolean default false,
  required boolean not null default false,
  use_for_prediction boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(school_id,name)
);
create table if not exists public.custom_variable_options (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.custom_variable_templates on delete cascade,
  label text not null,
  sort_order int not null default 0
);
create table if not exists public.custom_variable_values (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.custom_variable_templates on delete cascade,
  meal_record_id uuid not null references public.meal_records on delete cascade,
  number_value numeric,
  boolean_value boolean,
  text_value text,
  json_value jsonb,
  unique(template_id,meal_record_id)
);
create table if not exists public.data_share_requests (
  id uuid primary key default gen_random_uuid(),
  requester_school_id uuid not null references public.schools,
  provider_school_id uuid not null references public.schools,
  purpose text not null,
  requested_meal_times public.meal_time[] not null,
  requested_data_start date,
  requested_data_end date,
  message text,
  status public.share_status not null default 'pending',
  requested_by uuid references auth.users,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check(requester_school_id<>provider_school_id)
);
create table if not exists public.data_share_permissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique not null references public.data_share_requests on delete cascade,
  granted_meal_times public.meal_time[] not null,
  data_start date not null,
  data_end date not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  max_records int not null check(max_records>0),
  allowed_custom_template_ids uuid[] not null default '{}',
  additional_terms text,
  terms_accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users,
  created_at timestamptz not null default now(),
  check(data_start<=data_end),
  check(valid_from<valid_until)
);
create table if not exists public.external_dataset_blocks (
  id uuid primary key default gen_random_uuid(),
  permission_id uuid unique not null references public.data_share_permissions on delete cascade,
  requester_school_id uuid not null references public.schools,
  active boolean not null default false,
  prediction_enabled boolean not null default false,
  activated_at timestamptz,
  revoked_at timestamptz,
  record_count int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.data_share_audit_logs (
  id bigint generated always as identity primary key,
  request_id uuid references public.data_share_requests,
  actor_school_id uuid references public.schools,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools,
  prediction_date date not null,
  meal_time public.meal_time not null,
  target_count int not null,
  expected_count int not null,
  expected_rate numeric not null,
  lower_count int,
  upper_count int,
  confidence text,
  input_snapshot jsonb not null,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create table if not exists public.prediction_references (
  prediction_id uuid references public.predictions on delete cascade,
  meal_record_id uuid references public.meal_records,
  source_type text not null check(source_type in('own','external')),
  similarity numeric not null,
  weight numeric not null,
  primary key(prediction_id,meal_record_id)
);

-- 이전 두 migration 중 하나가 이미 실행된 DB에 누락된 컬럼을 안전하게 보완합니다.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.data_share_requests add column if not exists requested_data_start date;
alter table public.data_share_requests add column if not exists requested_data_end date;
alter table public.data_share_permissions add column if not exists additional_terms text;
alter table public.external_dataset_blocks add column if not exists prediction_enabled boolean not null default false;
alter table public.external_dataset_blocks add column if not exists activated_at timestamptz;
alter table public.external_dataset_blocks add column if not exists revoked_at timestamptz;
alter table public.external_dataset_blocks add column if not exists record_count int not null default 0;
alter table public.meal_records add column if not exists other_tag_text text;
alter table public.schools add column if not exists meal_record_count int not null default 0;

create index if not exists meal_records_school_date_idx on public.meal_records(school_id,meal_date);
create index if not exists share_requester_idx on public.data_share_requests(requester_school_id,created_at desc);
create index if not exists share_provider_idx on public.data_share_requests(provider_school_id,created_at desc);
create index if not exists permission_validity_idx on public.data_share_permissions(valid_from,valid_until) where revoked_at is null;

insert into public.meal_categories(name) values
 ('밥류'),('국·찌개류'),('육류'),('생선·해산물'),('면류'),('분식'),('채식'),('디저트'),('특별식'),('기타')
on conflict do nothing;
insert into public.standard_tags(name) values
 ('시험'),('체험학습'),('체육대회'),('축제'),('방학 전후'),('학생 대회 참가'),('외출 인원 증가'),('결석 증가'),('운동부 경기'),('학교 행사'),('기타')
on conflict do nothing;

update public.schools s
set meal_record_count=(select count(*) from public.meal_records m where m.school_id=s.id);

create or replace function public.refresh_school_meal_count()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school=coalesce(new.school_id,old.school_id);
  update schools set meal_record_count=(select count(*) from meal_records where school_id=v_school) where id=v_school;
  return coalesce(new,old);
end $$;
drop trigger if exists meal_record_count_refresh on public.meal_records;
create trigger meal_record_count_refresh
after insert or delete or update of school_id on public.meal_records
for each row execute function public.refresh_school_meal_count();

-- RLS를 모든 사용자 데이터 테이블에 적용합니다.
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_members enable row level security;
alter table public.meal_categories enable row level security;
alter table public.standard_tags enable row level security;
alter table public.meal_records enable row level security;
alter table public.meal_record_categories enable row level security;
alter table public.meal_record_tags enable row level security;
alter table public.custom_variable_templates enable row level security;
alter table public.custom_variable_options enable row level security;
alter table public.custom_variable_values enable row level security;
alter table public.data_share_requests enable row level security;
alter table public.data_share_permissions enable row level security;
alter table public.external_dataset_blocks enable row level security;
alter table public.data_share_audit_logs enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_references enable row level security;

create or replace function public.is_school_member(s uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from school_members where school_id=s and user_id=auth.uid())
$$;

-- 정책은 재실행 시 이름 충돌이 없도록 모두 제거 후 최종 안전 정책만 만듭니다.
drop policy if exists schools_member_read on public.schools;
drop policy if exists schools_authenticated_read on public.schools;
drop policy if exists schools_member_update on public.schools;
create policy schools_authenticated_read on public.schools for select to authenticated using(true);
create policy schools_member_update on public.schools for update to authenticated using(is_school_member(id)) with check(is_school_member(id));

drop policy if exists profiles_self_all on public.profiles;
create policy profiles_self_all on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists members_self_read on public.school_members;
create policy members_self_read on public.school_members for select to authenticated using(user_id=auth.uid());

drop policy if exists meal_categories_authenticated_read on public.meal_categories;
create policy meal_categories_authenticated_read on public.meal_categories for select to authenticated using(true);
drop policy if exists standard_tags_authenticated_read on public.standard_tags;
create policy standard_tags_authenticated_read on public.standard_tags for select to authenticated using(true);

drop policy if exists own_meals_all on public.meal_records;
create policy own_meals_all on public.meal_records for all to authenticated using(is_school_member(school_id)) with check(is_school_member(school_id));
drop policy if exists own_meal_category_links on public.meal_record_categories;
create policy own_meal_category_links on public.meal_record_categories for all to authenticated
using(exists(select 1 from meal_records m where m.id=meal_record_id and is_school_member(m.school_id)))
with check(exists(select 1 from meal_records m where m.id=meal_record_id and is_school_member(m.school_id)));
drop policy if exists own_meal_tag_links on public.meal_record_tags;
create policy own_meal_tag_links on public.meal_record_tags for all to authenticated
using(exists(select 1 from meal_records m where m.id=meal_record_id and is_school_member(m.school_id)))
with check(exists(select 1 from meal_records m where m.id=meal_record_id and is_school_member(m.school_id)));

drop policy if exists own_templates_all on public.custom_variable_templates;
create policy own_templates_all on public.custom_variable_templates for all to authenticated using(is_school_member(school_id)) with check(is_school_member(school_id));
drop policy if exists own_variable_options on public.custom_variable_options;
create policy own_variable_options on public.custom_variable_options for all to authenticated
using(exists(select 1 from custom_variable_templates t where t.id=template_id and is_school_member(t.school_id)))
with check(exists(select 1 from custom_variable_templates t where t.id=template_id and is_school_member(t.school_id)));
drop policy if exists own_variable_values on public.custom_variable_values;
create policy own_variable_values on public.custom_variable_values for all to authenticated
using(exists(select 1 from custom_variable_templates t where t.id=template_id and is_school_member(t.school_id)))
with check(exists(select 1 from custom_variable_templates t where t.id=template_id and is_school_member(t.school_id)));

drop policy if exists requester_create on public.data_share_requests;
drop policy if exists provider_update on public.data_share_requests;
drop policy if exists share_parties_read on public.data_share_requests;
create policy share_parties_read on public.data_share_requests for select to authenticated
using(is_school_member(requester_school_id) or is_school_member(provider_school_id));
drop policy if exists provider_permission_write on public.data_share_permissions;
drop policy if exists permission_parties_read on public.data_share_permissions;
create policy permission_parties_read on public.data_share_permissions for select to authenticated
using(exists(select 1 from data_share_requests r where r.id=request_id and (is_school_member(r.requester_school_id) or is_school_member(r.provider_school_id))));
drop policy if exists requester_blocks_all on public.external_dataset_blocks;
drop policy if exists external_block_requester_read on public.external_dataset_blocks;
create policy external_block_requester_read on public.external_dataset_blocks for select to authenticated using(is_school_member(requester_school_id));
drop policy if exists audit_parties_read on public.data_share_audit_logs;
create policy audit_parties_read on public.data_share_audit_logs for select to authenticated
using(exists(select 1 from data_share_requests r where r.id=request_id and (is_school_member(r.requester_school_id) or is_school_member(r.provider_school_id))));

drop policy if exists own_predictions_all on public.predictions;
create policy own_predictions_all on public.predictions for all to authenticated using(is_school_member(school_id)) with check(is_school_member(school_id));
drop policy if exists own_prediction_references on public.prediction_references;
create policy own_prediction_references on public.prediction_references for select to authenticated
using(exists(select 1 from predictions p where p.id=prediction_id and is_school_member(p.school_id)));

create or replace function public.register_my_school(
  p_name text,p_level text,p_province text,p_district text,
  p_student_count int,p_target_count int,p_male_count int,p_female_count int,
  p_gender_type text,p_boarding_type text,
  p_breakfast boolean,p_lunch boolean,p_dinner boolean
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_school_id uuid; v_meta jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if exists(select 1 from school_members where user_id=auth.uid()) then raise exception '이미 소속 학교가 등록되어 있습니다.'; end if;
  if p_student_count<1 or p_target_count<1 or p_male_count<0 or p_female_count<0 or p_male_count+p_female_count>p_student_count then raise exception '학교 인원 정보를 확인해 주세요.'; end if;
  if not(p_breakfast or p_lunch or p_dinner) then raise exception '급식 시간대를 한 개 이상 선택해 주세요.'; end if;
  insert into schools(name,school_code,school_level,province,district,student_count,meal_target_count,male_count,female_count,gender_type,boarding_type,serves_breakfast,serves_lunch,serves_dinner)
  values(trim(p_name),'SC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),p_level,trim(p_province),trim(p_district),p_student_count,p_target_count,p_male_count,p_female_count,p_gender_type,p_boarding_type,p_breakfast,p_lunch,p_dinner)
  returning id into v_school_id;
  insert into school_members(school_id,user_id,role) values(v_school_id,auth.uid(),'admin');
  select coalesce(raw_user_meta_data,'{}'::jsonb) into v_meta from auth.users where id=auth.uid();
  insert into profiles(id,display_name,avatar_url)
  values(auth.uid(),coalesce(v_meta->>'full_name',v_meta->>'name'),coalesce(v_meta->>'avatar_url',v_meta->>'picture'))
  on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url;
  return v_school_id;
end $$;

create or replace function public.request_data_share(
  p_provider_school_id uuid,p_purpose text,p_meal_times meal_time[],p_message text,p_data_start date,p_data_end date
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_requester uuid; v_id uuid;
begin
  select school_id into v_requester from school_members where user_id=auth.uid() limit 1;
  if v_requester is null then raise exception '소속 학교 등록이 필요합니다.'; end if;
  if v_requester=p_provider_school_id then raise exception '자기 학교에는 요청할 수 없습니다.'; end if;
  if p_data_start>p_data_end or cardinality(p_meal_times)=0 then raise exception '요청 기간과 급식 시간대를 확인해 주세요.'; end if;
  if not exists(select 1 from schools where id=p_provider_school_id) then raise exception '요청할 학교를 찾을 수 없습니다.'; end if;
  if exists(select 1 from data_share_requests where requester_school_id=v_requester and provider_school_id=p_provider_school_id and status in('pending','approved')) then raise exception '이미 진행 중인 공유 요청이 있습니다.'; end if;
  insert into data_share_requests(requester_school_id,provider_school_id,purpose,requested_meal_times,message,requested_data_start,requested_data_end,status,requested_by)
  values(v_requester,p_provider_school_id,trim(p_purpose),p_meal_times,trim(p_message),p_data_start,p_data_end,'pending',auth.uid()) returning id into v_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action,metadata)
  values(v_id,v_requester,'requested',jsonb_build_object('meal_times',p_meal_times,'data_start',p_data_start,'data_end',p_data_end));
  return v_id;
end $$;

create or replace function public.approve_data_share(
  p_request_id uuid,p_meal_times meal_time[],p_data_start date,p_data_end date,
  p_valid_from date,p_valid_until date,p_max_records int,p_custom_template_ids uuid[],p_additional_terms text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_req data_share_requests%rowtype; v_permission uuid;
begin
  select * into v_req from data_share_requests where id=p_request_id for update;
  if v_req.id is null or not is_school_member(v_req.provider_school_id) then raise exception '제공 학교만 요청을 승인할 수 있습니다.'; end if;
  if v_req.status<>'pending' then raise exception '대기 중인 요청만 승인할 수 있습니다.'; end if;
  if p_data_start>p_data_end or p_valid_from>p_valid_until or p_max_records<1 or cardinality(p_meal_times)=0 then raise exception '승인 조건을 확인해 주세요.'; end if;
  if exists(select 1 from unnest(coalesce(p_custom_template_ids,'{}'::uuid[])) x where not exists(select 1 from custom_variable_templates t where t.id=x and t.school_id=v_req.provider_school_id)) then raise exception '다른 학교의 맞춤 변수는 제공할 수 없습니다.'; end if;
  update data_share_requests set status='approved',decided_at=now() where id=p_request_id;
  insert into data_share_permissions(request_id,granted_meal_times,data_start,data_end,valid_from,valid_until,max_records,allowed_custom_template_ids,additional_terms)
  values(p_request_id,p_meal_times,p_data_start,p_data_end,p_valid_from::timestamptz,(p_valid_until+1)::timestamptz-interval '1 second',p_max_records,coalesce(p_custom_template_ids,'{}'::uuid[]),nullif(trim(p_additional_terms),'')) returning id into v_permission;
  insert into external_dataset_blocks(permission_id,requester_school_id,active,prediction_enabled,record_count)
  select v_permission,v_req.requester_school_id,false,false,least(p_max_records,count(*)::int)
  from meal_records m where m.school_id=v_req.provider_school_id and m.meal_time=any(p_meal_times) and m.meal_date between p_data_start and p_data_end;
  insert into data_share_audit_logs(request_id,actor_school_id,action,metadata)
  values(p_request_id,v_req.provider_school_id,'approved',jsonb_build_object('permission_id',v_permission,'max_records',p_max_records,'valid_until',p_valid_until));
  return v_permission;
end $$;

create or replace function public.reject_data_share(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_req data_share_requests%rowtype;
begin
  select * into v_req from data_share_requests where id=p_request_id for update;
  if v_req.id is null or not is_school_member(v_req.provider_school_id) then raise exception '제공 학교만 요청을 거절할 수 있습니다.'; end if;
  if v_req.status<>'pending' then raise exception '대기 중인 요청만 거절할 수 있습니다.'; end if;
  update data_share_requests set status='rejected',decided_at=now() where id=p_request_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(p_request_id,v_req.provider_school_id,'rejected');
end $$;

create or replace function public.revoke_data_share(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_req data_share_requests%rowtype;
begin
  select * into v_req from data_share_requests where id=p_request_id for update;
  if v_req.id is null or not is_school_member(v_req.provider_school_id) then raise exception '제공 학교만 공유 권한을 회수할 수 있습니다.'; end if;
  if v_req.status<>'approved' then raise exception '승인된 공유만 회수할 수 있습니다.'; end if;
  update data_share_requests set status='revoked' where id=p_request_id;
  update data_share_permissions set revoked_at=now(),revoked_by=auth.uid() where request_id=p_request_id;
  update external_dataset_blocks b set active=false,prediction_enabled=false,revoked_at=now()
  from data_share_permissions p where b.permission_id=p.id and p.request_id=p_request_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(p_request_id,v_req.provider_school_id,'revoked');
end $$;

create or replace function public.expire_data_shares()
returns int language plpgsql security definer set search_path=public as $$
declare v_count int;
begin
  with expired as (
    update data_share_requests r set status='expired'
    from data_share_permissions p where p.request_id=r.id and r.status='approved' and p.valid_until<now()
    returning r.id,r.requester_school_id
  ), disabled as (
    update external_dataset_blocks b set active=false,prediction_enabled=false
    from data_share_permissions p,expired e where b.permission_id=p.id and p.request_id=e.id
    returning e.id,e.requester_school_id
  )
  insert into data_share_audit_logs(request_id,actor_school_id,action)
  select id,requester_school_id,'expired' from disabled;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.accept_and_activate_dataset(p_block_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_requester uuid;
begin
  select p.request_id,b.requester_school_id into v_request_id,v_requester
  from external_dataset_blocks b join data_share_permissions p on p.id=b.permission_id join data_share_requests r on r.id=p.request_id
  where b.id=p_block_id and b.deleted_at is null and r.status='approved' and p.revoked_at is null and now() between p.valid_from and p.valid_until for update of b,p;
  if v_request_id is null or not is_school_member(v_requester) then raise exception '유효한 외부 데이터 권한이 없습니다.'; end if;
  update data_share_permissions set terms_accepted_at=coalesce(terms_accepted_at,now()) where request_id=v_request_id;
  update external_dataset_blocks set active=true,prediction_enabled=true,activated_at=coalesce(activated_at,now()) where id=p_block_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(v_request_id,v_requester,'terms_accepted_and_activated');
end $$;

create or replace function public.set_external_dataset_active(p_block_id uuid,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_requester uuid;
begin
  select p.request_id,b.requester_school_id into v_request_id,v_requester
  from external_dataset_blocks b join data_share_permissions p on p.id=b.permission_id join data_share_requests r on r.id=p.request_id
  where b.id=p_block_id and b.deleted_at is null and r.status='approved' and p.terms_accepted_at is not null and p.revoked_at is null and now() between p.valid_from and p.valid_until for update of b;
  if v_request_id is null or not is_school_member(v_requester) then raise exception '외부 데이터셋을 변경할 권한이 없습니다.'; end if;
  update external_dataset_blocks set active=p_active,prediction_enabled=p_active where id=p_block_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action,metadata)
  values(v_request_id,v_requester,case when p_active then 'reactivated' else 'deactivated' end,jsonb_build_object('prediction_enabled',p_active));
end $$;

create or replace function public.delete_external_dataset(p_block_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_requester uuid;
begin
  select p.request_id,b.requester_school_id into v_request_id,v_requester
  from external_dataset_blocks b join data_share_permissions p on p.id=b.permission_id
  where b.id=p_block_id and b.deleted_at is null for update of b;
  if v_request_id is null or not is_school_member(v_requester) then raise exception '외부 데이터셋을 삭제할 권한이 없습니다.'; end if;
  update external_dataset_blocks set active=false,prediction_enabled=false,deleted_at=now() where id=p_block_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(v_request_id,v_requester,'dataset_deleted');
end $$;

create or replace function public.get_authorized_external_meals(p_permission_id uuid)
returns table(id uuid,meal_date date,meal_time meal_time,target_count int,menu_text text,weather_status text,temperature numeric,has_precipitation boolean,prepared_count int,actual_count int,waste_kg numeric,categories text[],tags text[],custom_values jsonb)
language plpgsql security definer set search_path=public as $$
declare v_provider uuid; v_limit int;
begin
  select r.provider_school_id,p.max_records into v_provider,v_limit
  from data_share_permissions p join data_share_requests r on r.id=p.request_id join external_dataset_blocks b on b.permission_id=p.id
  where p.id=p_permission_id and is_school_member(r.requester_school_id) and r.status='approved'
    and p.terms_accepted_at is not null and p.revoked_at is null and now() between p.valid_from and p.valid_until
    and b.active and b.prediction_enabled and b.deleted_at is null and b.revoked_at is null;
  if v_provider is null then return; end if;
  return query
  select gen_random_uuid(),m.meal_date,m.meal_time,m.target_count,m.menu_text,m.weather_status,m.temperature,m.has_precipitation,m.prepared_count,m.actual_count,m.waste_kg,
    coalesce((select array_agg(c.name order by c.name) from meal_record_categories mc join meal_categories c on c.id=mc.category_id where mc.meal_record_id=m.id),'{}'::text[]),
    coalesce((select array_agg(t.name order by t.name) from meal_record_tags mt join standard_tags t on t.id=mt.tag_id where mt.meal_record_id=m.id),'{}'::text[]),
    coalesce((select jsonb_object_agg(t.name,coalesce(to_jsonb(cv.number_value),to_jsonb(cv.boolean_value),to_jsonb(cv.text_value),cv.json_value)) from custom_variable_values cv join custom_variable_templates t on t.id=cv.template_id where cv.meal_record_id=m.id and cv.template_id=any(p.allowed_custom_template_ids)),'{}'::jsonb)
  from meal_records m join data_share_permissions p on p.id=p_permission_id
  where m.school_id=v_provider and m.meal_time=any(p.granted_meal_times) and m.meal_date between p.data_start and p.data_end
  order by m.meal_date desc limit v_limit;
end $$;

-- SECURITY DEFINER 함수는 익명 사용자가 실행하지 못하도록 한 뒤 authenticated에만 허용합니다.
revoke all on function public.register_my_school(text,text,text,text,int,int,int,int,text,text,boolean,boolean,boolean) from public;
revoke all on function public.request_data_share(uuid,text,meal_time[],text,date,date) from public;
revoke all on function public.approve_data_share(uuid,meal_time[],date,date,date,date,int,uuid[],text) from public;
revoke all on function public.reject_data_share(uuid) from public;
revoke all on function public.revoke_data_share(uuid) from public;
revoke all on function public.expire_data_shares() from public;
revoke all on function public.accept_and_activate_dataset(uuid) from public;
revoke all on function public.set_external_dataset_active(uuid,boolean) from public;
revoke all on function public.delete_external_dataset(uuid) from public;
revoke all on function public.get_authorized_external_meals(uuid) from public;

grant execute on function public.register_my_school(text,text,text,text,int,int,int,int,text,text,boolean,boolean,boolean) to authenticated;
grant execute on function public.request_data_share(uuid,text,meal_time[],text,date,date) to authenticated;
grant execute on function public.approve_data_share(uuid,meal_time[],date,date,date,date,int,uuid[],text) to authenticated;
grant execute on function public.reject_data_share(uuid) to authenticated;
grant execute on function public.revoke_data_share(uuid) to authenticated;
grant execute on function public.expire_data_shares() to authenticated;
grant execute on function public.accept_and_activate_dataset(uuid) to authenticated;
grant execute on function public.set_external_dataset_active(uuid,boolean) to authenticated;
grant execute on function public.delete_external_dataset(uuid) to authenticated;
grant execute on function public.get_authorized_external_meals(uuid) to authenticated;

commit;

-- 완료 확인용 읽기 전용 결과입니다. 마지막 결과가 한 행으로 보이면 설치가 완료된 것입니다.
select
  '급식 NEXT Supabase 설치 완료' as result,
  (select count(*) from public.meal_categories) as meal_category_count,
  (select count(*) from public.standard_tags) as standard_tag_count;
