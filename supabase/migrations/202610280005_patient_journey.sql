begin;
create function app_private.normalize_initial_stage() returns trigger language plpgsql set search_path='' as $$
begin if new.status='screened' then new.status:='awaiting_clinician'; end if; return new; end $$;
create trigger normalize_initial_stage before insert or update on public.screenings for each row execute function app_private.normalize_initial_stage();
revoke all on function app_private.normalize_initial_stage() from public,anon,authenticated;
alter table public.navigation_tasks alter column referral_id drop not null;
create table public.care_decisions (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id),
  screening_id uuid not null, clinician_id uuid not null references public.profiles(id),
  category text not null check(category in ('diagnostics','treatment','case')),
  decision text not null, notes text not null check(length(trim(notes)) between 1 and 5000),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(screening_id,patient_id) references public.screenings(id,patient_id),
  check((category='case' and decision in ('close','reopen')) or (category in ('diagnostics','treatment') and decision in ('required','not_required')))
);
alter table public.care_decisions enable row level security;
revoke all on public.care_decisions from public,anon,authenticated;
grant select on public.care_decisions to authenticated;
grant select,insert on public.care_decisions to service_role;
create policy assigned_clinician on public.care_decisions for select to authenticated using(app_private.current_role() in ('medical_officer','specialist') and app_private.can_access_patient(patient_id));
create trigger immutable_history before update or delete on public.care_decisions for each row execute function app_private.reject_mutation();
create trigger audit_change after insert on public.care_decisions for each row execute function app_private.audit_change();
create trigger decision_clinician before insert on public.care_decisions for each row execute function app_private.check_clinician();
create index care_decisions_history on public.care_decisions(screening_id,category,created_at desc);

create function app_private.stage_for_screening(target uuid) returns text language sql stable security definer set search_path='' as $$
  with refs as (select r.id from public.referrals r join public.clinical_reviews v on v.id=r.review_id where v.screening_id=target),
  investigations as(select * from public.investigations where referral_id in(select id from refs)),
  appointments as(select * from public.appointments where referral_id in(select id from refs))
  select case
    when (select status from public.screenings where id=target)='closed' then 'closed'
    when exists(select 1 from investigations where status<>'reviewed') then 'diagnostics_pending'
    when exists(select 1 from public.treatments where referral_id in(select id from refs)) then 'care_linked'
    when exists(select 1 from investigations where status='reviewed') then 'result_reviewed'
    when exists(select 1 from appointments where status in ('confirmed','requested','rescheduled')) then 'appointed'
    when exists(select 1 from appointments where status='completed') then 'assessed'
    when exists(select 1 from public.referrals where id in(select id from refs) and status not in ('closed','declined')) then 'referral_planned'
    when exists(select 1 from public.clinical_reviews where screening_id=target) then 'reviewed'
    else 'awaiting_clinician' end;
$$;
create function app_private.refresh_patient_stage(person uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.screenings%rowtype; next_stage text; begin
  select * into s from public.screenings where patient_id=person order by created_at desc,id desc limit 1 for update;
  if s.id is null then return; end if;
  next_stage:=app_private.stage_for_screening(s.id);
  update public.screenings set status=next_stage,revision=revision+1 where id=s.id and status is distinct from next_stage;
end $$;
create function app_private.refresh_journey_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin perform app_private.refresh_patient_stage(new.patient_id); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['clinical_reviews','referrals','appointments','investigations','treatments'] loop
    execute format('create trigger refresh_journey after insert or update on public.%I for each row execute function app_private.refresh_journey_trigger()',t);
  end loop;
end $$;

create function app_private.closure_blockers(target uuid) returns text[] language sql stable security definer set search_path='' as $$
  with refs as(select r.id from public.referrals r join public.clinical_reviews v on v.id=r.review_id where v.screening_id=target),
  latest_decisions as(select distinct on(category) category,decision from public.care_decisions where screening_id=target order by category,created_at desc,id desc)
  select array_remove(array[
    case when not exists(select 1 from public.clinical_reviews where screening_id=target) then 'review' end,
    case when exists(select 1 from public.appointments where referral_id in(select id from refs) and status in ('requested','confirmed','rescheduled')) then 'appointments' end,
    case when exists(select 1 from public.investigations where referral_id in(select id from refs) and status<>'reviewed') then 'investigations' end,
    case when exists(select 1 from public.treatments where referral_id in(select id from refs) and status in ('planned','active')) then 'treatments' end,
    case when exists(select 1 from public.navigation_tasks n join public.screenings s on s.id=target where n.patient_id=s.patient_id and n.status='pending' and (n.referral_id in(select id from refs) or (n.referral_id is null and n.created_at>=s.created_at))) then 'followups' end,
    case when exists(select 1 from refs) and not exists(select 1 from public.investigations where referral_id in(select id from refs)) and not exists(select 1 from latest_decisions where category='diagnostics' and decision='not_required') then 'diagnostic_decision' end,
    case when exists(select 1 from refs) and not exists(select 1 from public.treatments where referral_id in(select id from refs)) and not exists(select 1 from latest_decisions where category='treatment' and decision='not_required') then 'treatment_decision' end
  ]::text[],null);
$$;

create function app_private.check_appointment_slot() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status not in ('confirmed','requested','rescheduled') then return new; end if;
  if tg_op='UPDATE' and old.starts_at=new.starts_at and old.ends_at=new.ends_at and old.status=new.status and old.clinician_id=new.clinician_id then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.clinician_id::text,1));
  if exists(select 1 from public.appointments a where a.id<>new.id and a.status in ('confirmed','requested','rescheduled') and (a.referral_id=new.referral_id or (a.clinician_id=new.clinician_id and a.starts_at<new.ends_at and a.ends_at>new.starts_at))) then
    raise exception 'Clinician or referral already has an appointment at that time; reschedule the existing appointment' using errcode='23514';
  end if;
  return new;
end $$;
create trigger appointment_slot before insert or update on public.appointments for each row execute function app_private.check_appointment_slot();

alter function public.submit_workflow(uuid,text,jsonb) rename to submit_workflow_v2;
do $$ begin execute replace(pg_get_functiondef('public.submit_workflow_v2(uuid,text,jsonb)'::regprocedure),'submit_workflow.request_id','submit_workflow_v2.request_id'); end $$;
revoke all on function public.submit_workflow_v2(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.submit_workflow(request_id uuid,action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; s public.screenings%rowtype; prior app_private.workflow_requests%rowtype;
 person uuid; result jsonb; rid uuid; navigator_id uuid; blockers text[]; category text; decision text;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null then raise exception 'Active staff required' using errcode='42501'; end if;
  if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Request ID and object payload required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text||request_id::text,0));
  select * into prior from app_private.workflow_requests w where w.actor_id=actor.id and w.request_id=$1;
  if found then
    if prior.action is distinct from action or prior.payload is distinct from payload then raise exception 'Request ID reused with different content' using errcode='23505'; end if;
    return prior.result;
  end if;
  person:=coalesce((payload->>'patient_id')::uuid,
    (select patient_id from public.referrals where id=(payload->>'referral_id')::uuid),
    (select patient_id from public.appointments where id=(payload->>'appointment_id')::uuid),
    (select patient_id from public.treatments where id=(payload->>'treatment_id')::uuid));
  if person is not null and action<>'register' then
    if not app_private.can_access_patient(person) then raise exception 'Assigned patient required' using errcode='42501'; end if;
    select * into s from public.screenings where patient_id=person order by created_at desc,id desc limit 1 for update;
    if s.status='closed' and action not in ('care_decision','consent','reminder') then raise exception 'Reopen this case before making changes' using errcode='23514'; end if;
  end if;
  if action='care_decision' then
    if actor.role not in ('medical_officer','specialist') or s.id is null then raise exception 'Assigned clinician required' using errcode='42501'; end if;
    if s.revision is distinct from (payload->>'revision')::integer then raise exception 'Case changed; refresh' using errcode='40001'; end if;
    if not exists(select 1 from public.clinical_reviews where screening_id=s.id) then raise exception 'Signed clinician review required' using errcode='23514'; end if;
    category:=payload->>'category'; decision:=payload->>'decision';
    if s.status='closed' and not(category='case' and decision='reopen') then raise exception 'Reopen this case before making changes' using errcode='23514'; end if;
    if category='case' and decision='reopen' and s.status<>'closed' then raise exception 'Case is already open' using errcode='23514'; end if;
    if category='case' and decision='close' and cardinality(app_private.closure_blockers(s.id))>0 then raise exception 'Resolve appointments, investigations, treatment decisions and follow-ups before closing this case' using errcode='23514'; end if;
    if category='diagnostics' and decision='not_required' and exists(select 1 from public.investigations i join public.referrals r on r.id=i.referral_id join public.clinical_reviews v on v.id=r.review_id where v.screening_id=s.id and i.status<>'reviewed') then raise exception 'Review outstanding investigations first' using errcode='23514'; end if;
    if category='treatment' and decision='not_required' and exists(select 1 from public.treatments t join public.referrals r on r.id=t.referral_id join public.clinical_reviews v on v.id=r.review_id where v.screening_id=s.id and t.status in ('planned','active')) then raise exception 'Complete or stop existing treatment first' using errcode='23514'; end if;
    insert into public.care_decisions(patient_id,screening_id,clinician_id,category,decision,notes) values(person,s.id,actor.id,category,decision,payload->>'notes') returning id into rid;
    update public.screenings set status=case when category='case' and decision='close' then 'closed' when category='case' and decision='reopen' then 'reviewed' else status end,revision=revision+1 where id=s.id;
    result:=jsonb_build_object('id',rid);
    insert into app_private.workflow_requests(actor_id,request_id,action,payload,result) values(actor.id,request_id,action,payload,result);
  else
    if action='appoint' and ((payload->>'starts_at')::timestamptz is null or (payload->>'starts_at')::timestamptz<=now()) then raise exception 'Choose a future appointment time' using errcode='23514'; end if;
    if action='review' and payload->>'decision'='close' and cardinality(array_remove(app_private.closure_blockers(s.id),'review'))>0 then raise exception 'Resolve outstanding care before closing this case' using errcode='23514'; end if;
    if action='review' and payload->>'decision'='follow_up' then
      if (payload->>'followup_at')::timestamptz is null or (payload->>'followup_at')::timestamptz<=now() then raise exception 'Choose a future follow-up date' using errcode='23514'; end if;
      select p.id into navigator_id from public.profiles p join public.patient_assignments a on a.user_id=p.id where a.patient_id=person and a.revoked_at is null and p.active and p.role='navigator' order by p.id limit 1;
      if navigator_id is null then raise exception 'Assign a navigator before scheduling follow-up' using errcode='23514'; end if;
    end if;
    result:=public.submit_workflow_v2(request_id,action,payload);
    if action='review' and payload->>'decision'='follow_up' then
      insert into public.navigation_tasks(patient_id,referral_id,owner_id,task_type,due_at) values(person,null,navigator_id,'follow_up',(payload->>'followup_at')::timestamptz);
    end if;
  end if;
  if person is not null then perform app_private.refresh_patient_stage(person); end if;
  return result;
end $$;
revoke all on function public.submit_workflow(uuid,text,jsonb) from public,anon;
grant execute on function public.submit_workflow(uuid,text,jsonb) to authenticated;

alter function public.dashboard_summary() rename to dashboard_summary_v2;
revoke all on function public.dashboard_summary_v2() from public,anon,authenticated;
create function public.dashboard_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; district_name text; counts jsonb; begin
  result:=public.dashboard_summary_v2();
  select f.district into district_name from public.profiles p join public.facilities f on f.id=p.facility_id where p.id=auth.uid();
  select coalesce(jsonb_object_agg(status,n),'{}') into counts from (
    select s.status,count(*) n from public.screenings s join public.patients p on p.id=s.patient_id join public.facilities f on f.id=p.facility_id where f.district=district_name group by s.status
  ) totals;
  return result||jsonb_build_object('stage_counts',counts,'completed_cases',coalesce((counts->>'closed')::integer,0));
end $$;
revoke all on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;
revoke all on function app_private.stage_for_screening(uuid),app_private.refresh_patient_stage(uuid),app_private.refresh_journey_trigger(),app_private.closure_blockers(uuid),app_private.check_appointment_slot() from public,anon,authenticated;
-- File uploads follow the same closed-case boundary as workflow commands.
alter function public.record_private_file(uuid,text,jsonb) rename to record_private_file_v1;
revoke all on function public.record_private_file_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.record_private_file(actor_id uuid,kind text,metadata jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.screenings%rowtype; begin
  if not exists(select 1 from public.patient_assignments where patient_id=(metadata->>'patient_id')::uuid and user_id=actor_id and revoked_at is null) then raise exception 'Assigned patient required' using errcode='42501'; end if;
  select * into s from public.screenings where patient_id=(metadata->>'patient_id')::uuid order by created_at desc,id desc limit 1 for update;
  if s.status='closed' then raise exception 'Reopen this case before attaching files' using errcode='23514'; end if;
  return public.record_private_file_v1(actor_id,kind,metadata);
end $$;
revoke all on function public.record_private_file(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_private_file(uuid,text,jsonb) to service_role;
do $$ declare p record; begin for p in select id from public.patients loop perform app_private.refresh_patient_stage(p.id); end loop; end $$;
commit;
