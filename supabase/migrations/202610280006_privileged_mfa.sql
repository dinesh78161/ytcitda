-- Enforce authenticator verification at every browser data/workflow boundary.
-- Existing users enroll through the app after ordinary sign-in. Never provision
-- their authenticator secrets in SQL or use user-editable metadata for this rule.
begin;

create function app_private.has_required_assurance() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select active and (
    role not in ('medical_officer','specialist','district_admin')
    or coalesce(auth.jwt()->>'aal','aal1')='aal2'
  ) from public.profiles where id=auth.uid()),false);
$$;
revoke all on function app_private.has_required_assurance() from public,anon;
grant execute on function app_private.has_required_assurance() to authenticated;

-- An AAL1 user can still read their own profile to reach MFA enrollment. No
-- application records are fetched until verification succeeds.
do $$ declare t text; begin
  foreach t in array array[
    'facilities','patients','patient_assignments','consents','screenings','images',
    'ai_analyses','clinical_reviews','referrals','appointments','investigations',
    'navigation_tasks','audit_events','treatments','treatment_events',
    'patient_documents','outreach_events','appointment_reminders','care_decisions'
  ] loop
    execute format('create policy require_privileged_mfa on public.%I as restrictive to authenticated using ((select app_private.has_required_assurance())) with check ((select app_private.has_required_assurance()))',t);
  end loop;
end $$;

create or replace function app_private.can_access_patient(target_patient uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select app_private.has_required_assurance() and exists (
    select 1 from public.patient_assignments a join public.profiles p on p.id=a.user_id
    where a.patient_id=target_patient and a.user_id=auth.uid()
      and a.revoked_at is null and p.active and p.role<>'district_admin'
  );
$$;

-- SECURITY DEFINER RPCs bypass table policies, so guard their entry points too.
alter function public.submit_workflow(uuid,text,jsonb) rename to submit_workflow_without_mfa;
revoke all on function public.submit_workflow_without_mfa(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.submit_workflow(request_id uuid,action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.has_required_assurance() then
    raise exception 'Active staff and authenticator verification required' using errcode='42501';
  end if;
  return public.submit_workflow_without_mfa(request_id,action,payload);
end $$;
revoke all on function public.submit_workflow(uuid,text,jsonb) from public,anon;
grant execute on function public.submit_workflow(uuid,text,jsonb) to authenticated;

alter function public.dashboard_summary() rename to dashboard_summary_without_mfa;
revoke all on function public.dashboard_summary_without_mfa() from public,anon,authenticated,service_role;
create function public.dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.has_required_assurance() then
    raise exception 'Active staff and authenticator verification required' using errcode='42501';
  end if;
  return public.dashboard_summary_without_mfa();
end $$;
revoke all on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;

-- Authenticated rollout check; no secrets or patient data.
create function public.security_policy() returns jsonb
language sql stable set search_path='' as $$
  select '{"version":1,"privileged_mfa":true,"privileged_roles":["medical_officer","specialist","district_admin"]}'::jsonb;
$$;
revoke all on function public.security_policy() from public,anon;
grant execute on function public.security_policy() to authenticated;

notify pgrst,'reload schema';
commit;
