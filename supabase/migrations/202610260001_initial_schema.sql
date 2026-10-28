-- Aarogya Drishti: synthetic-data-only database foundation.
-- Run once in a NEW Supabase project's SQL Editor, as the database owner.
begin;

create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  district text not null,
  facility_type text not null check (facility_type in ('phc', 'hospital', 'district')),
  created_at timestamptz not null default now()
);

-- Provision roles from a trusted server or SQL Editor, never signup metadata.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  role text not null check (role in (
    'health_worker', 'medical_officer', 'specialist', 'navigator', 'district_admin'
  )),
  facility_id uuid not null references public.facilities(id),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id),
  registered_by uuid not null references public.profiles(id),
  display_name text not null check (length(trim(display_name)) > 0),
  age_years integer check (age_years between 0 and 120),
  village text not null,
  contact_phone text,
  preferred_language text not null default 'te' check (preferred_language in ('en', 'te')),
  is_synthetic boolean not null default true check (is_synthetic),
  created_at timestamptz not null default now()
);

create table public.patient_assignments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  user_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);
create unique index one_active_assignment on public.patient_assignments(patient_id, user_id)
  where revoked_at is null;
create index assignments_by_user on public.patient_assignments(user_id, patient_id)
  where revoked_at is null;

-- Append a new event to grant or withdraw consent. Existing events are immutable.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  purpose text not null check (purpose in ('screening', 'image_capture', 'teleconsultation')),
  granted boolean not null,
  language text not null check (language in ('en', 'te')),
  consent_version text not null,
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default clock_timestamp(),
  unique (id, patient_id),
  unique (patient_id, purpose, recorded_at)
);
create index consent_history on public.consents(patient_id, purpose, recorded_at desc);

create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  examiner_id uuid not null references public.profiles(id),
  consent_id uuid not null,
  symptoms jsonb not null default '{}'::jsonb check (jsonb_typeof(symptoms) = 'object'),
  tobacco_history jsonb not null default '{}'::jsonb check (jsonb_typeof(tobacco_history) = 'object'),
  examination_notes text,
  status text not null default 'screened' check (status in (
    'screened', 'awaiting_clinician', 'reviewed', 'referral_planned', 'appointed',
    'assessed', 'diagnostics_pending', 'result_reviewed', 'care_linked', 'closed'
  )),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  unique (id, patient_id),
  foreign key (consent_id, patient_id) references public.consents(id, patient_id)
);
create index screenings_by_patient on public.screenings(patient_id, created_at desc);

create table public.images (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  screening_id uuid not null,
  consent_id uuid not null,
  uploaded_by uuid not null references public.profiles(id),
  object_key text not null unique check (object_key not like '%://%'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  oral_view text not null check (oral_view in ('cheek', 'tongue', 'palate', 'gums', 'floor_of_mouth')),
  quality_status text not null default 'pending' check (quality_status in ('pending', 'acceptable', 'recapture')),
  quality_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (screening_id, patient_id) references public.screenings(id, patient_id),
  foreign key (consent_id, patient_id) references public.consents(id, patient_id)
);
create index images_by_screening on public.images(screening_id);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id),
  provider text not null check (provider in ('mock', 'research')),
  model_version text not null,
  status text not null check (status in ('queued', 'completed', 'failed')),
  research_label text,
  score numeric check (score between 0 and 1),
  clinical_use boolean not null default false check (not clinical_use),
  requires_clinician_review boolean not null default true check (requires_clinician_review),
  warning text not null default 'NOT FOR CLINICAL USE' check (warning = 'NOT FOR CLINICAL USE'),
  created_at timestamptz not null default now(),
  check (provider <> 'mock' or score is null)
);
create index analyses_by_image on public.ai_analyses(image_id);

create table public.clinical_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  screening_id uuid not null,
  doctor_id uuid not null references public.profiles(id),
  findings text not null,
  clinical_decision text not null check (clinical_decision in ('refer', 'follow_up', 'close')),
  signed_at timestamptz not null default now(),
  supersedes_id uuid,
  unique (id, patient_id),
  foreign key (screening_id, patient_id) references public.screenings(id, patient_id),
  foreign key (supersedes_id, patient_id) references public.clinical_reviews(id, patient_id)
);
create index reviews_by_screening on public.clinical_reviews(screening_id);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  review_id uuid not null,
  destination_facility_id uuid not null references public.facilities(id),
  specialty text not null,
  priority text not null check (priority in ('routine', 'priority', 'urgent')),
  status text not null default 'planned' check (status in ('planned', 'booked', 'attended', 'closed', 'declined')),
  created_at timestamptz not null default now(),
  unique (id, patient_id),
  foreign key (review_id, patient_id) references public.clinical_reviews(id, patient_id)
);
create index referrals_by_patient on public.referrals(patient_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  referral_id uuid not null,
  clinician_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null check (mode in ('video', 'in_person')),
  status text not null default 'requested' check (status in (
    'requested', 'confirmed', 'completed', 'missed', 'cancelled', 'rescheduled'
  )),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (referral_id, patient_id) references public.referrals(id, patient_id)
);
create index appointments_by_patient on public.appointments(patient_id, starts_at);
-- Provider meeting IDs/tokens belong in the server's private configuration, not here.

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  referral_id uuid not null,
  clinician_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('biopsy', 'pathology', 'other')),
  status text not null default 'requested' check (status in ('requested', 'collected', 'reported', 'reviewed')),
  report_object_key text check (report_object_key not like '%://%'),
  clinician_diagnosis text,
  is_simulated boolean not null default true check (is_simulated),
  created_at timestamptz not null default now(),
  foreign key (referral_id, patient_id) references public.referrals(id, patient_id)
);
create index investigations_by_patient on public.investigations(patient_id);

create table public.navigation_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  referral_id uuid not null,
  owner_id uuid not null references public.profiles(id),
  task_type text not null check (task_type in ('contact', 'transport', 'missed_visit', 'follow_up')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'declined', 'lost_contact')),
  created_at timestamptz not null default now(),
  foreign key (referral_id, patient_id) references public.referrals(id, patient_id)
);
create index navigation_by_owner on public.navigation_tasks(owner_id, status, due_at);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index audit_by_resource on public.audit_events(resource_type, resource_id, occurred_at);

-- SECURITY DEFINER helpers have a fixed search_path and no caller-selected actor.
create function app_private.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and active;
$$;

create function app_private.can_access_patient(target_patient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_assignments a
    join public.profiles p on p.id = a.user_id
    where a.patient_id = target_patient and a.user_id = (select auth.uid())
      and a.revoked_at is null and p.active and p.role <> 'district_admin'
  );
$$;

create function app_private.can_read_clinical(target_patient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.current_role() in ('health_worker', 'medical_officer', 'specialist')
    and app_private.can_access_patient(target_patient);
$$;

create function app_private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create function app_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_id, action, resource_type, resource_id)
  values (
    (select id from public.profiles where id = (select auth.uid())),
    tg_op, tg_table_name, case when tg_op = 'DELETE' then old.id else new.id end
  );
  return null;
end;
$$;

create function app_private.check_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare expected_purpose text; current_consent uuid;
begin
  expected_purpose := case when tg_table_name = 'images' then 'image_capture' else 'screening' end;
  select id into current_consent from public.consents
    where patient_id = new.patient_id and purpose = expected_purpose
    order by recorded_at desc limit 1;
  if not exists (
    select 1 from public.consents where id = new.consent_id and id = current_consent
      and patient_id = new.patient_id and purpose = expected_purpose and granted
  ) then
    raise exception 'Current granted % consent is required', expected_purpose using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger screening_consent before insert on public.screenings
  for each row execute function app_private.check_consent();
create trigger image_consent before insert on public.images
  for each row execute function app_private.check_consent();

create function app_private.check_clinician() returns trigger
language plpgsql security definer set search_path = '' as $$
declare clinician uuid;
begin
  if tg_table_name = 'clinical_reviews' then clinician := new.doctor_id;
  else clinician := new.clinician_id; end if;
  if not exists (
    select 1 from public.profiles p join public.patient_assignments a on a.user_id = p.id
    where p.id = clinician and p.active and p.role in ('medical_officer', 'specialist')
      and a.patient_id = new.patient_id and a.revoked_at is null
  ) then
    raise exception 'An active assigned clinician is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger review_clinician before insert on public.clinical_reviews
  for each row execute function app_private.check_clinician();
create trigger investigation_clinician before insert or update on public.investigations
  for each row execute function app_private.check_clinician();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'facilities', 'profiles', 'patients', 'patient_assignments', 'consents', 'screenings',
    'images', 'ai_analyses', 'clinical_reviews', 'referrals', 'appointments',
    'investigations', 'navigation_tasks', 'audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    if table_name <> 'audit_events' then
      execute format('grant select on public.%I to authenticated', table_name);
      execute format('create trigger audit_change after insert or update or delete on public.%I
        for each row execute function app_private.audit_change()', table_name);
    end if;
  end loop;
  foreach table_name in array array['consents', 'clinical_reviews', 'audit_events'] loop
    execute format('revoke update, delete on public.%I from service_role', table_name);
    execute format('create trigger immutable_history before update or delete on public.%I
      for each row execute function app_private.reject_mutation()', table_name);
  end loop;
end;
$$;

create policy active_staff_facilities on public.facilities for select to authenticated
  using (app_private.current_role() is not null);
create policy own_profile on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy assigned_patients on public.patients for select to authenticated
  using (app_private.can_access_patient(id));
create policy own_assignments on public.patient_assignments for select to authenticated
  using (user_id = (select auth.uid()) and app_private.can_access_patient(patient_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['consents', 'screenings', 'images', 'clinical_reviews'] loop
    execute format('create policy assigned_clinical_read on public.%I for select to authenticated
      using (app_private.can_read_clinical(patient_id))', table_name);
  end loop;
  foreach table_name in array array['referrals', 'appointments', 'navigation_tasks'] loop
    execute format('create policy assigned_logistics_read on public.%I for select to authenticated
      using (app_private.can_access_patient(patient_id))', table_name);
  end loop;
end;
$$;

create policy assigned_ai_read on public.ai_analyses for select to authenticated using (
  exists (select 1 from public.images i where i.id = image_id
    and app_private.can_read_clinical(i.patient_id))
);
create policy assigned_investigation_read on public.investigations for select to authenticated using (
  app_private.current_role() in ('medical_officer', 'specialist')
  and app_private.can_access_patient(patient_id)
);

-- District admins get district-scoped aggregate counts, not underlying records.
create function public.dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare admin_district text; result jsonb;
begin
  select f.district into admin_district from public.profiles p
    join public.facilities f on f.id = p.facility_id
    where p.id = (select auth.uid()) and p.active and p.role = 'district_admin';
  if admin_district is null then
    raise exception 'District administrator required' using errcode = '42501';
  end if;
  with district_patients as (
    select p.id from public.patients p join public.facilities f on f.id = p.facility_id
    where f.district = admin_district
  )
  select jsonb_build_object(
    'patients', (select count(*) from district_patients),
    'screenings', (select count(*) from public.screenings where patient_id in (select id from district_patients)),
    'referrals', (select count(*) from public.referrals where patient_id in (select id from district_patients)),
    'missed_appointments', (select count(*) from public.appointments where status = 'missed'
      and patient_id in (select id from district_patients)),
    'pending_follow_ups', (select count(*) from public.navigation_tasks where status = 'pending'
      and patient_id in (select id from district_patients))
  ) into result;
  return result;
end;
$$;

revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.current_role() to authenticated;
grant execute on function app_private.can_access_patient(uuid) to authenticated;
grant execute on function app_private.can_read_clinical(uuid) to authenticated;
revoke all on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;

commit;
