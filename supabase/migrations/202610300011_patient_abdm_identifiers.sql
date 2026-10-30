-- Add ABDM and ITDA tribal administrative fields to public.patients
begin;

alter table public.patients
  add column if not exists mandal text,
  add column if not exists habitation text,
  add column if not exists subcenter text,
  add column if not exists abha_id text,
  add column if not exists aadhaar_last4 text check (aadhaar_last4 is null or length(trim(aadhaar_last4)) = 4);

-- Upgrade the register action in submit_workflow_v1 to persist these columns
do $$
declare source text;
begin
  source := pg_get_functiondef('public.submit_workflow_v1(uuid,text,jsonb)'::regprocedure);
  source := replace(
    source,
    'insert into public.patients(id, facility_id, registered_by, display_name, age_years, village, contact_phone, preferred_language)',
    'insert into public.patients(id, facility_id, registered_by, display_name, age_years, village, contact_phone, preferred_language, mandal, habitation, subcenter, abha_id, aadhaar_last4)'
  );
  source := replace(
    source,
    'trim(payload->>''village''), nullif(payload->>''contact_phone'',''''), coalesce(payload->>''language'',''en''));',
    'trim(payload->>''village''), nullif(payload->>''contact_phone'',''''), coalesce(payload->>''language'',''en''), nullif(trim(payload->>''mandal''),''''), nullif(trim(payload->>''habitation''),''''), nullif(trim(payload->>''subcenter''),''''), nullif(trim(payload->>''abha_id''),''''), nullif(trim(payload->>''aadhaar_last4''),''''));'
  );
  execute source;
end $$;

commit;

