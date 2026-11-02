-- Resolve registering health workers only for patients the clinician can access.
-- Keep staff profiles private and retain assignment and MFA checks.
begin;

create function public.patient_registration_staff()
returns table(patient_id uuid, staff_name text)
language sql stable security definer set search_path='' as $$
  select p.id, worker.display_name
  from public.patients p
  join public.profiles worker on worker.id=p.registered_by
  where worker.role='health_worker'
    and app_private.current_role() in ('medical_officer','specialist')
    and app_private.can_access_patient(p.id);
$$;
revoke all on function public.patient_registration_staff() from public,anon,service_role;
grant execute on function public.patient_registration_staff() to authenticated;

notify pgrst,'reload schema';
commit;
