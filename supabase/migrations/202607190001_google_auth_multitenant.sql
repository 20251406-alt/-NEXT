-- 급식 NEXT: Google Auth 기반 실제 다중 사용자·학교 공유 기능
-- 202607180001_initial.sql 실행 후 적용하세요.

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

update public.schools s set meal_record_count=(select count(*) from public.meal_records m where m.school_id=s.id);
create or replace function public.refresh_school_meal_count() returns trigger language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school=coalesce(new.school_id,old.school_id);
  update schools set meal_record_count=(select count(*) from meal_records where school_id=v_school) where id=v_school;
  return coalesce(new,old);
end $$;
drop trigger if exists meal_record_count_refresh on public.meal_records;
create trigger meal_record_count_refresh after insert or delete or update of school_id on public.meal_records for each row execute function public.refresh_school_meal_count();

create index if not exists share_requester_idx on public.data_share_requests(requester_school_id, created_at desc);
create index if not exists share_provider_idx on public.data_share_requests(provider_school_id, created_at desc);
create index if not exists permission_validity_idx on public.data_share_permissions(valid_from, valid_until) where revoked_at is null;

alter table public.profiles enable row level security;
alter table public.meal_record_categories enable row level security;
alter table public.meal_record_tags enable row level security;
alter table public.custom_variable_options enable row level security;
alter table public.custom_variable_values enable row level security;
alter table public.data_share_audit_logs enable row level security;
alter table public.prediction_references enable row level security;

drop policy if exists schools_authenticated_read on public.schools;
create policy schools_authenticated_read on public.schools for select to authenticated using (true);
drop policy if exists schools_member_update on public.schools;
create policy schools_member_update on public.schools for update to authenticated using(public.is_school_member(id)) with check(public.is_school_member(id));
drop policy if exists profiles_self_all on public.profiles;
create policy profiles_self_all on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists meal_categories_authenticated_read on public.meal_categories;
create policy meal_categories_authenticated_read on public.meal_categories for select to authenticated using(true);
drop policy if exists standard_tags_authenticated_read on public.standard_tags;
create policy standard_tags_authenticated_read on public.standard_tags for select to authenticated using(true);
drop policy if exists own_meal_category_links on public.meal_record_categories;
create policy own_meal_category_links on public.meal_record_categories for all to authenticated using(exists(select 1 from public.meal_records m where m.id=meal_record_id and public.is_school_member(m.school_id))) with check(exists(select 1 from public.meal_records m where m.id=meal_record_id and public.is_school_member(m.school_id)));
drop policy if exists own_meal_tag_links on public.meal_record_tags;
create policy own_meal_tag_links on public.meal_record_tags for all to authenticated using(exists(select 1 from public.meal_records m where m.id=meal_record_id and public.is_school_member(m.school_id))) with check(exists(select 1 from public.meal_records m where m.id=meal_record_id and public.is_school_member(m.school_id)));
drop policy if exists own_variable_options on public.custom_variable_options;
create policy own_variable_options on public.custom_variable_options for all to authenticated using(exists(select 1 from public.custom_variable_templates t where t.id=template_id and public.is_school_member(t.school_id))) with check(exists(select 1 from public.custom_variable_templates t where t.id=template_id and public.is_school_member(t.school_id)));
drop policy if exists own_variable_values on public.custom_variable_values;
create policy own_variable_values on public.custom_variable_values for all to authenticated using(exists(select 1 from public.custom_variable_templates t where t.id=template_id and public.is_school_member(t.school_id))) with check(exists(select 1 from public.custom_variable_templates t where t.id=template_id and public.is_school_member(t.school_id)));

-- 제공 학교만 상태를 바꾸도록 직접 UPDATE 정책을 제거하고 보안 RPC만 허용합니다.
drop policy if exists provider_update on public.data_share_requests;
drop policy if exists provider_permission_write on public.data_share_permissions;
drop policy if exists requester_blocks_all on public.external_dataset_blocks;
drop policy if exists requester_create on public.data_share_requests;

drop policy if exists external_block_requester_read on public.external_dataset_blocks;
create policy external_block_requester_read on public.external_dataset_blocks for select to authenticated using(public.is_school_member(requester_school_id));
drop policy if exists audit_parties_read on public.data_share_audit_logs;
create policy audit_parties_read on public.data_share_audit_logs for select to authenticated using(exists(select 1 from public.data_share_requests r where r.id=request_id and (public.is_school_member(r.requester_school_id) or public.is_school_member(r.provider_school_id))));
drop policy if exists own_prediction_references on public.prediction_references;
create policy own_prediction_references on public.prediction_references for select to authenticated using(exists(select 1 from public.predictions p where p.id=prediction_id and public.is_school_member(p.school_id)));

create or replace function public.register_my_school(
  p_name text, p_level text, p_province text, p_district text,
  p_student_count int, p_target_count int, p_male_count int, p_female_count int,
  p_gender_type text, p_boarding_type text,
  p_breakfast boolean, p_lunch boolean, p_dinner boolean
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_school_id uuid; v_meta jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if exists(select 1 from school_members where user_id=auth.uid()) then raise exception '이미 소속 학교가 등록되어 있습니다.'; end if;
  if p_student_count < 1 or p_target_count < 1 or p_male_count < 0 or p_female_count < 0 or p_male_count+p_female_count > p_student_count then raise exception '학교 인원 정보를 확인해 주세요.'; end if;
  if not (p_breakfast or p_lunch or p_dinner) then raise exception '급식 시간대를 한 개 이상 선택해 주세요.'; end if;
  insert into schools(name,school_code,school_level,province,district,student_count,meal_target_count,male_count,female_count,gender_type,boarding_type,serves_breakfast,serves_lunch,serves_dinner)
  values(trim(p_name),'SC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),p_level,trim(p_province),trim(p_district),p_student_count,p_target_count,p_male_count,p_female_count,p_gender_type,p_boarding_type,p_breakfast,p_lunch,p_dinner)
  returning id into v_school_id;
  insert into school_members(school_id,user_id,role) values(v_school_id,auth.uid(),'admin');
  select coalesce(raw_user_meta_data,'{}'::jsonb) into v_meta from auth.users where id=auth.uid();
  insert into profiles(id,display_name,avatar_url) values(auth.uid(),coalesce(v_meta->>'full_name',v_meta->>'name'),coalesce(v_meta->>'avatar_url',v_meta->>'picture')) on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url;
  return v_school_id;
end $$;

create or replace function public.request_data_share(
  p_provider_school_id uuid, p_purpose text, p_meal_times public.meal_time[],
  p_message text, p_data_start date, p_data_end date
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
  insert into data_share_audit_logs(request_id,actor_school_id,action,metadata) values(v_id,v_requester,'requested',jsonb_build_object('meal_times',p_meal_times,'data_start',p_data_start,'data_end',p_data_end));
  return v_id;
end $$;

create or replace function public.approve_data_share(
  p_request_id uuid, p_meal_times public.meal_time[], p_data_start date, p_data_end date,
  p_valid_from date, p_valid_until date, p_max_records int,
  p_custom_template_ids uuid[], p_additional_terms text
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
  values(p_request_id,p_meal_times,p_data_start,p_data_end,p_valid_from::timestamptz,(p_valid_until::date+1)::timestamptz-interval '1 second',p_max_records,coalesce(p_custom_template_ids,'{}'::uuid[]),nullif(trim(p_additional_terms),'')) returning id into v_permission;
  insert into external_dataset_blocks(permission_id,requester_school_id,active,prediction_enabled,record_count)
  select v_permission,v_req.requester_school_id,false,false,least(p_max_records,count(*)::int)
  from meal_records m where m.school_id=v_req.provider_school_id and m.meal_time=any(p_meal_times) and m.meal_date between p_data_start and p_data_end;
  insert into data_share_audit_logs(request_id,actor_school_id,action,metadata) values(p_request_id,v_req.provider_school_id,'approved',jsonb_build_object('permission_id',v_permission,'max_records',p_max_records,'valid_until',p_valid_until));
  return v_permission;
end $$;

create or replace function public.reject_data_share(p_request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_req data_share_requests%rowtype;
begin
  select * into v_req from data_share_requests where id=p_request_id for update;
  if v_req.id is null or not is_school_member(v_req.provider_school_id) then raise exception '제공 학교만 요청을 거절할 수 있습니다.'; end if;
  if v_req.status<>'pending' then raise exception '대기 중인 요청만 거절할 수 있습니다.'; end if;
  update data_share_requests set status='rejected',decided_at=now() where id=p_request_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(p_request_id,v_req.provider_school_id,'rejected');
end $$;

create or replace function public.revoke_data_share(p_request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_req data_share_requests%rowtype;
begin
  select * into v_req from data_share_requests where id=p_request_id for update;
  if v_req.id is null or not is_school_member(v_req.provider_school_id) then raise exception '제공 학교만 공유 권한을 회수할 수 있습니다.'; end if;
  if v_req.status<>'approved' then raise exception '승인된 공유만 회수할 수 있습니다.'; end if;
  update data_share_requests set status='revoked' where id=p_request_id;
  update data_share_permissions set revoked_at=now(),revoked_by=auth.uid() where request_id=p_request_id;
  update external_dataset_blocks b set active=false,prediction_enabled=false,revoked_at=now() from data_share_permissions p where b.permission_id=p.id and p.request_id=p_request_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(p_request_id,v_req.provider_school_id,'revoked');
end $$;

create or replace function public.expire_data_shares() returns int language plpgsql security definer set search_path=public as $$
declare v_count int;
begin
  with expired as (
    update data_share_requests r set status='expired'
    from data_share_permissions p
    where p.request_id=r.id and r.status='approved' and p.valid_until<now()
    returning r.id,r.requester_school_id
  ), disabled as (
    update external_dataset_blocks b set active=false,prediction_enabled=false
    from data_share_permissions p,expired e
    where b.permission_id=p.id and p.request_id=e.id
    returning e.id,e.requester_school_id
  )
  insert into data_share_audit_logs(request_id,actor_school_id,action)
  select id,requester_school_id,'expired' from disabled;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.accept_and_activate_dataset(p_block_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_requester uuid;
begin
  select p.request_id,b.requester_school_id into v_request_id,v_requester from external_dataset_blocks b join data_share_permissions p on p.id=b.permission_id join data_share_requests r on r.id=p.request_id where b.id=p_block_id and b.deleted_at is null and r.status='approved' and p.revoked_at is null and now() between p.valid_from and p.valid_until for update of b,p;
  if v_request_id is null or not is_school_member(v_requester) then raise exception '유효한 외부 데이터 권한이 없습니다.'; end if;
  update data_share_permissions set terms_accepted_at=coalesce(terms_accepted_at,now()) where request_id=v_request_id;
  update external_dataset_blocks set active=true,prediction_enabled=true,activated_at=coalesce(activated_at,now()) where id=p_block_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(v_request_id,v_requester,'terms_accepted_and_activated');
end $$;

create or replace function public.set_external_dataset_active(p_block_id uuid,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_requester uuid;
begin
  select p.request_id,b.requester_school_id into v_request_id,v_requester from external_dataset_blocks b join data_share_permissions p on p.id=b.permission_id join data_share_requests r on r.id=p.request_id where b.id=p_block_id and b.deleted_at is null and r.status='approved' and p.terms_accepted_at is not null and p.revoked_at is null and now() between p.valid_from and p.valid_until for update of b;
  if v_request_id is null or not is_school_member(v_requester) then raise exception '외부 데이터셋을 변경할 권한이 없습니다.'; end if;
  update external_dataset_blocks set active=p_active,prediction_enabled=p_active where id=p_block_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action,metadata) values(v_request_id,v_requester,case when p_active then 'reactivated' else 'deactivated' end,jsonb_build_object('prediction_enabled',p_active));
end $$;

create or replace function public.delete_external_dataset(p_block_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_request_id uuid; v_requester uuid;
begin
  select p.request_id,b.requester_school_id into v_request_id,v_requester from external_dataset_blocks b join data_share_permissions p on p.id=b.permission_id where b.id=p_block_id and b.deleted_at is null for update of b;
  if v_request_id is null or not is_school_member(v_requester) then raise exception '외부 데이터셋을 삭제할 권한이 없습니다.'; end if;
  update external_dataset_blocks set active=false,prediction_enabled=false,deleted_at=now() where id=p_block_id;
  insert into data_share_audit_logs(request_id,actor_school_id,action) values(v_request_id,v_requester,'dataset_deleted');
end $$;

-- 직접 급식 원자료 조회를 허용하지 않고, 모든 조건을 서버에서 검사한 익명 필드만 반환합니다.
create or replace function public.get_authorized_external_meals(p_permission_id uuid)
returns table(id uuid,meal_date date,meal_time public.meal_time,target_count int,menu_text text,weather_status text,temperature numeric,has_precipitation boolean,prepared_count int,actual_count int,waste_kg numeric,categories text[],tags text[],custom_values jsonb)
language plpgsql security definer set search_path=public as $$
declare v_provider uuid; v_limit int;
begin
  select r.provider_school_id,p.max_records into v_provider,v_limit
  from data_share_permissions p join data_share_requests r on r.id=p.request_id join external_dataset_blocks b on b.permission_id=p.id
  where p.id=p_permission_id and is_school_member(r.requester_school_id) and r.status='approved' and p.terms_accepted_at is not null and p.revoked_at is null and now() between p.valid_from and p.valid_until and b.active and b.prediction_enabled and b.deleted_at is null and b.revoked_at is null;
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

grant execute on function public.register_my_school(text,text,text,text,int,int,int,int,text,text,boolean,boolean,boolean) to authenticated;
grant execute on function public.request_data_share(uuid,text,public.meal_time[],text,date,date) to authenticated;
grant execute on function public.approve_data_share(uuid,public.meal_time[],date,date,date,date,int,uuid[],text) to authenticated;
grant execute on function public.reject_data_share(uuid) to authenticated;
grant execute on function public.revoke_data_share(uuid) to authenticated;
grant execute on function public.expire_data_shares() to authenticated;
grant execute on function public.accept_and_activate_dataset(uuid) to authenticated;
grant execute on function public.set_external_dataset_active(uuid,boolean) to authenticated;
grant execute on function public.delete_external_dataset(uuid) to authenticated;
grant execute on function public.get_authorized_external_meals(uuid) to authenticated;

-- 공개 스키마 함수의 기본 실행 권한을 제한합니다.
revoke all on function public.register_my_school(text,text,text,text,int,int,int,int,text,text,boolean,boolean,boolean) from public;
revoke all on function public.request_data_share(uuid,text,public.meal_time[],text,date,date) from public;
revoke all on function public.approve_data_share(uuid,public.meal_time[],date,date,date,date,int,uuid[],text) from public;
revoke all on function public.reject_data_share(uuid) from public;
revoke all on function public.revoke_data_share(uuid) from public;
revoke all on function public.expire_data_shares() from public;
revoke all on function public.accept_and_activate_dataset(uuid) from public;
revoke all on function public.set_external_dataset_active(uuid,boolean) from public;
revoke all on function public.delete_external_dataset(uuid) from public;
revoke all on function public.get_authorized_external_meals(uuid) from public;
