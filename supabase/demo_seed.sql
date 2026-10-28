 -- OPTIONAL: run only in a synthetic demo project, after seed.sql.
-- First create these five users in Supabase Authentication > Users (dashboard):
-- worker@aarohanytc.in, doctor@aarohanytc.in, specialist@aarohanytc.in,
-- navigator@aarohanytc.in, admin@aarohanytc.in. Set passwords there.
-- This file contains no passwords and never modifies existing profiles.
begin;
do $$
declare
  worker uuid; doctor uuid; specialist uuid; navigator uuid;
  patient uuid; consent uuid; screening uuid; review uuid; referral uuid;
  item integer;
begin
  if (select count(*) from auth.users where email in (
    'worker@aarohanytc.in', 'doctor@aarohanytc.in', 'specialist@aarohanytc.in',
    'navigator@aarohanytc.in', 'admin@aarohanytc.in'
  )) <> 5 then
    raise exception 'Create the five demo Auth users listed at the top of this file first';
  end if;

  insert into public.profiles(id, display_name, role, facility_id, active)
  select u.id, d.display_name, d.role, d.facility_id::uuid, true
  from (values
    ('worker@aarohanytc.in', 'Demo Health Worker', 'health_worker', '10000000-0000-4000-8000-000000000001'),
    ('doctor@aarohanytc.in', 'Demo Medical Officer', 'medical_officer', '10000000-0000-4000-8000-000000000001'),
    ('specialist@aarohanytc.in', 'Demo Specialist', 'specialist', '10000000-0000-4000-8000-000000000002'),
    ('navigator@aarohanytc.in', 'Demo Navigator', 'navigator', '10000000-0000-4000-8000-000000000001'),
    ('admin@aarohanytc.in', 'Demo District Admin', 'district_admin', '10000000-0000-4000-8000-000000000003')
  ) as d(email, display_name, role, facility_id)
  join auth.users u on u.email = d.email
  on conflict (id) do nothing;

  select id into worker from auth.users where email = 'worker@aarohanytc.in';
  select id into doctor from auth.users where email = 'doctor@aarohanytc.in';
  select id into specialist from auth.users where email = 'specialist@aarohanytc.in';
  select id into navigator from auth.users where email = 'navigator@aarohanytc.in';

  for item in 1..12 loop
    patient := ('20000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
    consent := ('30000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
    screening := ('40000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
    review := ('50000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
    referral := ('60000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;

    insert into public.patients(id, facility_id, registered_by, display_name, age_years, village)
    values (patient, '10000000-0000-4000-8000-000000000001', worker,
      'Synthetic Person ' || item, 30 + item, 'Demo Village') on conflict (id) do nothing;

    insert into public.patient_assignments(patient_id, user_id, assigned_by)
    select patient, member_id, doctor from unnest(array[worker, doctor, navigator]) as member_id
    on conflict (patient_id, user_id) where revoked_at is null do nothing;

    insert into public.consents(id, patient_id, purpose, granted, language, consent_version, recorded_by)
    values (consent, patient, 'screening', true, 'te', 'demo-v1', worker)
    on conflict (id) do nothing;
    insert into public.screenings(id, patient_id, examiner_id, consent_id, examination_notes)
    values (screening, patient, worker, consent, 'Synthetic examination for workflow demonstration only.')
    on conflict (id) do nothing;

    if item <= 4 then
      insert into public.patient_assignments(patient_id, user_id, assigned_by)
      values (patient, specialist, doctor)
      on conflict (patient_id, user_id) where revoked_at is null do nothing;
      insert into public.clinical_reviews(id, patient_id, screening_id, doctor_id, findings, clinical_decision)
      values (review, patient, screening, doctor, 'Simulated clinician review.', 'refer')
      on conflict (id) do nothing;
      insert into public.referrals(id, patient_id, review_id, destination_facility_id, specialty, priority)
      values (referral, patient, review, '10000000-0000-4000-8000-000000000002', 'Oral medicine', 'routine')
      on conflict (id) do nothing;
      insert into public.appointments(id, patient_id, referral_id, clinician_id, starts_at, ends_at, mode, status)
      values (('70000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid,
        patient, referral, specialist, '2026-11-01 04:30:00+00'::timestamptz + item * interval '1 hour',
        '2026-11-01 05:00:00+00'::timestamptz + item * interval '1 hour', 'video',
        case when item = 1 then 'missed' else 'confirmed' end)
      on conflict (id) do nothing;
      insert into public.navigation_tasks(id, patient_id, referral_id, owner_id, task_type, due_at)
      values (('80000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid,
        patient, referral, navigator, case when item = 1 then 'missed_visit' else 'follow_up' end,
        '2026-11-02 04:30:00+00') on conflict (id) do nothing;
    end if;
  end loop;
end;
$$;
commit;
