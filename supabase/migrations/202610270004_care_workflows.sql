begin;
update storage.buckets set allowed_mime_types=array['application/pdf','image/jpeg'] where id='pathology-reports';
create table public.treatments (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id),
  referral_id uuid not null, clinician_id uuid not null references public.profiles(id),
  plan text not null check(length(trim(plan)) between 1 and 5000),
  status text not null check(status in ('planned','active','completed','stopped')),
  next_review_at timestamptz, revision integer not null default 1,
  created_at timestamptz not null default now(), unique(id,patient_id),
  foreign key(referral_id,patient_id) references public.referrals(id,patient_id)
);
create table public.treatment_events (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id),
  treatment_id uuid not null, recorded_by uuid not null references public.profiles(id),
  notes text not null check(length(trim(notes)) between 1 and 5000),
  status text not null check(status in ('planned','active','completed','stopped')),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(treatment_id,patient_id) references public.treatments(id,patient_id)
);
alter table public.investigations add unique(id,patient_id);
create table public.patient_documents (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id),
  investigation_id uuid, uploaded_by uuid not null references public.profiles(id),
  name text not null check(length(name) between 1 and 150),
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg')),
  object_key text not null unique check(object_key not like '%://%'),
  size_bytes integer not null check(size_bytes between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), created_at timestamptz not null default now(),
  foreign key(investigation_id,patient_id) references public.investigations(id,patient_id)
);
create table public.outreach_events (
  id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id),
  recorded_by uuid not null references public.profiles(id), village text not null check(length(trim(village)) between 1 and 120),
  held_on date not null, attendees integer not null check(attendees between 0 and 100000),
  screened integer not null check(screened between 0 and attendees), created_at timestamptz not null default now()
);
create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id),
  appointment_id uuid not null references public.appointments(id), due_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','sent','acknowledged','cancelled','failed')),
  attempts integer not null default 0, lease_until timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_due on public.appointment_reminders(status,due_at);
create index treatment_patient on public.treatments(patient_id);
create index treatment_history on public.treatment_events(treatment_id,created_at);
create index document_patient on public.patient_documents(patient_id);

do $$ declare t text; begin
  foreach t in array array['treatments','treatment_events','patient_documents','outreach_events','appointment_reminders'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function app_private.audit_change()',t);
  end loop;
  foreach t in array array['treatments','treatment_events','patient_documents'] loop
    execute format('create policy assigned_clinician on public.%I for select to authenticated using (app_private.current_role() in (''medical_officer'',''specialist'') and app_private.can_access_patient(patient_id))',t);
  end loop;
end $$;
create trigger immutable_history before update or delete on public.treatment_events for each row execute function app_private.reject_mutation();
revoke update,delete on public.treatment_events from service_role;
create trigger treatment_clinician before insert or update on public.treatments for each row execute function app_private.check_clinician();
create policy assigned_reminders on public.appointment_reminders for select to authenticated using(app_private.can_access_patient(patient_id));
create policy facility_outreach on public.outreach_events for select to authenticated using(
  app_private.current_role() in ('health_worker','medical_officer','specialist','navigator') and facility_id=(select facility_id from public.profiles where id=auth.uid())
);

create function app_private.schedule_reminder() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.starts_at=old.starts_at and new.status=old.status then return new; end if;
  update public.appointment_reminders set status='cancelled',lease_until=null where appointment_id=new.id and status in ('pending','failed');
  if new.status in ('requested','confirmed','rescheduled') then
    insert into public.appointment_reminders(patient_id,appointment_id,due_at) values(new.patient_id,new.id,greatest(now(),new.starts_at-interval '24 hours'));
  end if;
  return new;
end $$;
create trigger appointment_reminder after insert or update on public.appointments for each row execute function app_private.schedule_reminder();
insert into public.appointment_reminders(patient_id,appointment_id,due_at)
  select patient_id,id,greatest(now(),starts_at-interval '24 hours') from public.appointments where status in ('requested','confirmed','rescheduled');

-- Preserve the existing command implementation and its retry ledger.
alter function public.submit_workflow(uuid,text,jsonb) rename to submit_workflow_v1;
do $$ begin
  execute replace(pg_get_functiondef('public.submit_workflow_v1(uuid,text,jsonb)'::regprocedure), 'submit_workflow.request_id', 'submit_workflow_v1.request_id');
end $$;
revoke all on function public.submit_workflow_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.submit_workflow(request_id uuid,action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor public.profiles%rowtype; previous app_private.workflow_requests%rowtype;
  a public.appointments%rowtype; t public.treatments%rowtype; r public.referrals%rowtype;
  i public.investigations%rowtype; reminder public.appointment_reminders%rowtype;
  person uuid; rid uuid; result jsonb; starts timestamptz;
begin
  if action='analyze' then raise exception 'Use the configured research model API' using errcode='22023'; end if;
  if action not in ('reschedule','treatment','treatment_update','investigation','outreach','consent','reminder') then
    return public.submit_workflow_v1(request_id,action,payload);
  end if;
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null then raise exception 'Active staff required' using errcode='42501'; end if;
  if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Request ID and payload required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text||request_id::text,0));
  select * into previous from app_private.workflow_requests w where w.actor_id=actor.id and w.request_id=submit_workflow.request_id;
  if found then
    if previous.action is distinct from action or previous.payload is distinct from payload then raise exception 'Request ID reused with different content' using errcode='23505'; end if;
    return previous.result;
  end if;
  if action='outreach' then
    if actor.role not in ('health_worker','medical_officer') then raise exception 'Worker or medical officer required' using errcode='42501'; end if;
    if (payload->>'held_on')::date> (now() at time zone 'Asia/Kolkata')::date then raise exception 'Record completed events only' using errcode='23514'; end if;
    insert into public.outreach_events(facility_id,recorded_by,village,held_on,attendees,screened)
      values(actor.facility_id,actor.id,trim(payload->>'village'),(payload->>'held_on')::date,(payload->>'attendees')::integer,(payload->>'screened')::integer) returning id into rid;
  elsif action='reschedule' then
    if actor.role not in ('medical_officer','specialist','navigator') then raise exception 'Role not permitted' using errcode='42501'; end if;
    select * into a from public.appointments where id=(payload->>'appointment_id')::uuid for update;
    if a.id is null or not app_private.can_access_patient(a.patient_id) then raise exception 'Assigned appointment required' using errcode='42501'; end if;
    if a.status not in ('confirmed','requested','rescheduled','missed') then raise exception 'Appointment is closed' using errcode='23514'; end if;
    if a.starts_at is distinct from (payload->>'previous_starts_at')::timestamptz then raise exception 'Appointment changed; refresh' using errcode='40001'; end if;
    starts := (payload->>'starts_at')::timestamptz;
    if starts is null or starts<=now() then raise exception 'Choose a future appointment time' using errcode='23514'; end if;
    perform pg_advisory_xact_lock(hashtextextended(a.clinician_id::text,1));
    if exists(select 1 from public.appointments other where other.id<>a.id and other.clinician_id=a.clinician_id and other.status in ('confirmed','requested','rescheduled') and other.starts_at<starts+interval '30 minutes' and other.ends_at>starts) then raise exception 'Clinician already booked at that time' using errcode='23514'; end if;
    update public.appointments set starts_at=starts,ends_at=starts+interval '30 minutes',status='rescheduled' where id=a.id;
    rid:=a.id;
  elsif action in ('treatment','treatment_update','investigation') then
    if actor.role not in ('medical_officer','specialist') then raise exception 'Clinician required' using errcode='42501'; end if;
    if action='treatment_update' then
      select * into t from public.treatments where id=(payload->>'treatment_id')::uuid for update;
      person:=t.patient_id;
      if t.revision is distinct from (payload->>'revision')::integer then raise exception 'Treatment changed; refresh' using errcode='40001'; end if;
      if t.status in ('completed','stopped') then raise exception 'Treatment is closed' using errcode='23514'; end if;
    else
      select * into r from public.referrals where id=(payload->>'referral_id')::uuid for update;
      person:=r.patient_id;
      if r.status in ('closed','declined') then raise exception 'Referral closed' using errcode='23514'; end if;
    end if;
    if person is null or not app_private.can_access_patient(person) then raise exception 'Assigned patient required' using errcode='42501'; end if;
    if action='treatment' then
      insert into public.treatments(patient_id,referral_id,clinician_id,plan,status,next_review_at)
        values(person,r.id,actor.id,payload->>'plan',payload->>'status',nullif(payload->>'next_review_at','')::timestamptz) returning * into t;
    elsif action='treatment_update' then
      update public.treatments set status=payload->>'status',next_review_at=nullif(payload->>'next_review_at','')::timestamptz,revision=revision+1 where id=t.id returning * into t;
    else
      if payload->>'status' in ('reported','reviewed') and coalesce(length(trim(payload->>'notes')),0) not between 1 and 5000 then raise exception 'Result notes required' using errcode='23514'; end if;
      if payload->>'investigation_id' is not null then
        select * into i from public.investigations where id=(payload->>'investigation_id')::uuid and referral_id=r.id for update;
        if i.id is null or i.status is distinct from payload->>'previous_status' then raise exception 'Investigation changed; refresh' using errcode='40001'; end if;
        if i.status='reviewed' or array_position(array['requested','collected','reported','reviewed'],payload->>'status')<array_position(array['requested','collected','reported','reviewed'],i.status) then raise exception 'Invalid investigation transition' using errcode='23514'; end if;
        update public.investigations set status=payload->>'status',clinician_diagnosis=left(payload->>'notes',5000) where id=i.id returning id into rid;
      else
        insert into public.investigations(patient_id,referral_id,clinician_id,kind,status,clinician_diagnosis)
          values(person,r.id,actor.id,payload->>'kind',payload->>'status',left(payload->>'notes',5000)) returning id into rid;
      end if;
    end if;
    if action in ('treatment','treatment_update') then
      insert into public.treatment_events(patient_id,treatment_id,recorded_by,notes,status) values(person,t.id,actor.id,payload->>'notes',t.status);
      rid:=t.id;
    end if;
  elsif action='consent' then
    person:=(payload->>'patient_id')::uuid;
    if actor.role not in ('health_worker','medical_officer','specialist') or not app_private.can_access_patient(person) then raise exception 'Assigned clinical staff required' using errcode='42501'; end if;
    perform 1 from public.patients where id=person for update;
    insert into public.consents(patient_id,purpose,granted,language,consent_version,recorded_by,recorded_at)
      values(person,payload->>'purpose',(payload->>'granted')::boolean,coalesce(payload->>'language','en'),'care-v2',actor.id,clock_timestamp()) returning id into rid;
  elsif action='reminder' then
    if actor.role not in ('medical_officer','specialist','navigator') then raise exception 'Care team required' using errcode='42501'; end if;
    select * into reminder from public.appointment_reminders where id=(payload->>'reminder_id')::uuid for update;
    if reminder.id is null or not app_private.can_access_patient(reminder.patient_id) then raise exception 'Assigned reminder required' using errcode='42501'; end if;
    if reminder.status not in ('pending','failed','sent') then raise exception 'Reminder is closed' using errcode='23514'; end if;
    update public.appointment_reminders set status='acknowledged',lease_until=null where id=reminder.id;
    rid:=reminder.id;
  end if;
  result:=jsonb_build_object('id',rid);
  insert into app_private.workflow_requests(actor_id,request_id,action,payload,result) values(actor.id,request_id,action,payload,result);
  return result;
end $$;
revoke all on function public.submit_workflow(uuid,text,jsonb) from public,anon;
grant execute on function public.submit_workflow(uuid,text,jsonb) to authenticated;

-- Service worker uses short leases; provider must honor the reminder ID as an idempotency key.
create function public.claim_reminders() returns setof public.appointment_reminders language sql security definer set search_path='' as $$
  update public.appointment_reminders set lease_until=now()+interval '5 minutes',attempts=attempts+1 where id in (
    select r.id from public.appointment_reminders r join public.appointments a on a.id=r.appointment_id
    where r.status in ('pending','failed') and r.attempts<5 and r.due_at<=now() and (r.lease_until is null or r.lease_until<now())
    and a.status in ('confirmed','requested','rescheduled') and a.starts_at>now()
    order by r.due_at limit 25 for update of r skip locked
  ) returning *;
$$;
revoke all on function public.claim_reminders() from public,anon,authenticated;
grant execute on function public.claim_reminders() to service_role;

alter function public.dashboard_summary() rename to dashboard_summary_v1;
revoke all on function public.dashboard_summary_v1() from public,anon,authenticated;
create function public.dashboard_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; district_name text; extra jsonb; begin
  base:=public.dashboard_summary_v1();
  select f.district into district_name from public.profiles p join public.facilities f on f.id=p.facility_id where p.id=auth.uid();
  with people as (select p.id from public.patients p join public.facilities f on f.id=p.facility_id where f.district=district_name),
  followups as (select n.* from public.navigation_tasks n where patient_id in(select id from people)),
  outreach as (select e.* from public.outreach_events e join public.facilities f on f.id=e.facility_id where f.district=district_name)
  select jsonb_build_object(
    'completed_follow_ups',(select count(*) from followups where status='completed'),
    'total_follow_ups',(select count(*) from followups),
    'follow_up_completion_rate',(select coalesce(round(100.0*count(*) filter(where status='completed')/nullif(count(*),0)),0) from followups),
    'outreach_events',(select count(*) from outreach),'outreach_attendees',(select coalesce(sum(attendees),0) from outreach),
    'outreach_screened',(select coalesce(sum(screened),0) from outreach),
    'active_treatments',(select count(*) from public.treatments where status='active' and patient_id in(select id from people))
  ) into extra;
  return base||extra;
end $$;
revoke all on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;
revoke all on function app_private.schedule_reminder() from public,anon,authenticated;
create function public.record_private_file(actor_id uuid,kind text,metadata jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; person uuid; c public.consents%rowtype; s uuid; rid uuid; table_name text;
begin
  select * into actor from public.profiles where id=actor_id and active;
  if actor.id is null or actor.role not in ('health_worker','medical_officer','specialist') or (kind='report' and actor.role='health_worker') then raise exception 'Clinical role required' using errcode='42501'; end if;
  if kind not in ('oral','report') then raise exception 'Invalid file kind' using errcode='23514'; end if;
  person:=(metadata->>'patient_id')::uuid; rid:=(metadata->>'id')::uuid;
  if not exists(select 1 from public.patient_assignments where patient_id=person and user_id=actor.id and revoked_at is null) then raise exception 'Assigned patient required' using errcode='42501'; end if;
  perform 1 from public.patients where id=person for update;
  select * into c from public.consents where patient_id=person and purpose=case when kind='oral' then 'image_capture' else 'screening' end order by recorded_at desc limit 1;
  if c.granted is distinct from true then raise exception 'Current consent required' using errcode='23514'; end if;
  if kind='oral' then
    select id into s from public.screenings where patient_id=person order by created_at desc limit 1;
    insert into public.images(id,patient_id,screening_id,consent_id,uploaded_by,object_key,sha256,oral_view,quality_status,quality_details)
      values(rid,person,s,c.id,actor.id,metadata->>'object_key',metadata->>'sha256',metadata->>'oral_view',metadata->>'quality_status',metadata->'quality_details');
    table_name:='images';
  else
    insert into public.patient_documents(id,patient_id,investigation_id,uploaded_by,name,mime_type,object_key,size_bytes,sha256)
      values(rid,person,(metadata->>'investigation_id')::uuid,actor.id,metadata->>'name',metadata->>'mime_type',metadata->>'object_key',(metadata->>'size_bytes')::integer,metadata->>'sha256');
    table_name:='patient_documents';
  end if;
  insert into public.audit_events(actor_id,action,resource_type,resource_id) values(actor.id,'UPLOAD',table_name,rid);
  return rid;
end $$;
revoke all on function public.record_private_file(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_private_file(uuid,text,jsonb) to service_role;
commit;
