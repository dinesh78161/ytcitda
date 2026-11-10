-- Clinician-requested draft observations from a separately configured clinical
-- model service. Existing research providers remain excluded from real records.
begin;
alter table public.consents drop constraint consents_purpose_check;
alter table public.consents add constraint consents_purpose_check
  check (purpose in ('screening','image_capture','teleconsultation','ai_assistance'));

alter table public.ai_analyses drop constraint ai_analyses_provider_check;
alter table public.ai_analyses add constraint ai_analyses_provider_check
  check (provider in ('mock','research','clinical_assistance'));
alter table public.ai_analyses drop constraint ai_analyses_warning_check;
alter table public.ai_analyses add constraint ai_analyses_warning_check check (
  (provider='clinical_assistance' and warning='AI DRAFT - CLINICIAN REVIEW REQUIRED') or
  (provider<>'clinical_assistance' and warning='NOT FOR CLINICAL USE'));
alter table public.ai_analyses drop constraint image_findings_object;
alter table public.ai_analyses add constraint image_findings_object check (
  findings is null or (jsonb_typeof(findings)='object' and provider in ('research','clinical_assistance') and score is null));
alter table public.ai_analyses add column requested_by uuid references public.profiles(id);
alter table public.ai_analyses add column assistance_consent_id uuid references public.consents(id);
alter table public.ai_analyses add constraint clinical_assistance_scope check (
  provider<>'clinical_assistance' or (requested_by is not null and assistance_consent_id is not null
    and score is null and findings is not null and status='completed'
    and (findings->>'engine') is not distinct from 'clinical' and requires_clinician_review and not clinical_use));

create function public.clinical_image_assistance_policy() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.has_required_assurance() then
    raise exception 'Active staff and authenticator verification required' using errcode='42501';
  end if;
  return (select jsonb_build_object('version',1,'mode',mode,'requires_clinician_review',true)
    from app_private.workspace_configuration where singleton);
end $$;
revoke all on function public.clinical_image_assistance_policy() from public,anon;
grant execute on function public.clinical_image_assistance_policy() to authenticated;

create or replace function app_private.restrict_research_analysis() returns trigger
language plpgsql security definer set search_path='' as $$
declare person uuid; clinical boolean; permission public.consents%rowtype;
begin
  select mode='clinical' into strict clinical from app_private.workspace_configuration where singleton for share;
  select patient_id into strict person from public.images where id=new.image_id;
  -- Consent updates also lock this row, serializing withdrawal with persistence.
  perform 1 from public.patients where id=person for update;
  if new.provider='clinical_assistance' then
    if not clinical or not exists(select 1 from public.patients where id=person and not is_synthetic) then
      raise exception 'Clinical assistance requires a clinical patient record' using errcode='23514';
    end if;
    if not exists(select 1 from public.profiles p join public.patient_assignments a on a.user_id=p.id
      where p.id=new.requested_by and p.active and p.role in ('medical_officer','specialist')
        and a.patient_id=person and a.revoked_at is null) then
      raise exception 'Active assigned clinician required for AI assistance' using errcode='23514';
    end if;
    select * into permission from public.consents where patient_id=person and purpose='ai_assistance'
      order by recorded_at desc limit 1;
    if permission.id is null or not permission.granted or permission.id is distinct from new.assistance_consent_id then
      raise exception 'Current AI assistance consent is required' using errcode='23514';
    end if;
    select * into permission from public.consents where patient_id=person and purpose='image_capture'
      order by recorded_at desc limit 1;
    if permission.id is null or not permission.granted then
      raise exception 'Current image capture consent is required' using errcode='23514';
    end if;
    if not exists(select 1 from public.images where id=new.image_id and quality_status='acceptable') then
      raise exception 'Acceptable image quality required' using errcode='23514';
    end if;
  elsif clinical or not exists(select 1 from public.patients where id=person and is_synthetic) then
    raise exception 'Research AI is unavailable for clinical patient records' using errcode='23514';
  end if;
  return new;
end $$;

-- A draft never becomes a diagnosis through an edit to its row.
create trigger immutable_clinical_assistance before update on public.ai_analyses
for each row when (old.provider='clinical_assistance') execute function app_private.reject_mutation();

-- Persist attribution and its audit event in the same database transaction.
create function app_private.audit_clinical_assistance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_events(actor_id,action,resource_type,resource_id)
    values(new.requested_by,'CLINICIAN_ASSISTANCE_DRAFT','ai_analyses',new.id);
  return null;
end $$;
revoke all on function app_private.audit_clinical_assistance() from public,anon,authenticated,service_role;
create trigger clinical_assistance_audit after insert on public.ai_analyses
for each row when (new.provider='clinical_assistance') execute function app_private.audit_clinical_assistance();

drop policy assigned_ai_read on public.ai_analyses;
create policy assigned_ai_read on public.ai_analyses for select to authenticated using (
  exists(select 1 from public.images i where i.id=image_id and app_private.can_read_clinical(i.patient_id))
  and (provider<>'clinical_assistance' or app_private.current_role() in ('medical_officer','specialist')));

notify pgrst,'reload schema';
commit;
