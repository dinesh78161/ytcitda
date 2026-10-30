-- ============================================================================
-- Aarogya Drishti: Supabase Database Migration (ABDM Identifiers & Anatomical Sub-sites)
-- Copy and paste this ENTIRE script into your open Supabase SQL Editor tab and click RUN.
-- ============================================================================

begin;

-- 1. Add ABDM and ITDA tribal administrative fields to public.patients
alter table public.patients
  add column if not exists mandal text,
  add column if not exists habitation text,
  add column if not exists subcenter text,
  add column if not exists abha_id text,
  add column if not exists aadhaar_last4 text check (aadhaar_last4 is null or length(trim(aadhaar_last4)) = 4);

-- 2. Upgrade the registration action in submit_workflow_v1 to persist these columns
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

-- 3. Upgrade images table check constraint to support all 6 anatomical sub-sites
alter table public.images drop constraint if exists images_oral_view_check;

alter table public.images add constraint images_oral_view_check
  check (oral_view in (
    'cheek',
    'tongue',
    'palate',
    'gums',
    'floor_of_mouth',
    'left_buccal_mucosa',
    'right_buccal_mucosa',
    'lateral_tongue',
    'lower_labial_sulcus'
  ));

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';

commit;

-- Verification check (should return the updated table columns and constraints)
select column_name, data_type 
from information_schema.columns 
where table_schema = 'public' and table_name = 'patients' and column_name in ('mandal', 'habitation', 'subcenter', 'abha_id', 'aadhaar_last4');

