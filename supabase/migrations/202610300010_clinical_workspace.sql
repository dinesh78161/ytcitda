-- Explicitly separate clinical records from evaluation data. Activation is a
-- database-owner operation on an empty, dedicated project, never a browser toggle.
begin;
create table app_private.workspace_configuration (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'evaluation' check (mode in ('evaluation','clinical')),
  approval_reference text,
  consent_version text not null default 'evaluation-v1',
  check (mode <> 'clinical' or (
    length(trim(approval_reference)) > 0 and approval_reference is not null
    and consent_version <> 'evaluation-v1' and length(trim(consent_version)) > 0
  ))
);
insert into app_private.workspace_configuration(singleton) values(true);
revoke all on app_private.workspace_configuration from public,anon,authenticated,service_role;

create function app_private.protect_workspace_mode() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.mode is distinct from old.mode then
    lock table public.patients in share row exclusive mode;
    if exists(select 1 from public.patients) then
      raise exception 'Use an empty dedicated project to change workspace mode' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger protect_workspace_mode before update on app_private.workspace_configuration
for each row execute function app_private.protect_workspace_mode();

create function public.workspace_policy() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.has_required_assurance() then
    raise exception 'Active staff and authenticator verification required' using errcode='42501';
  end if;
  return (select jsonb_build_object('version',1,'mode',mode,'ai_clinical_use',false,
    'consent_version',consent_version) from app_private.workspace_configuration where singleton);
end $$;
revoke all on function public.workspace_policy() from public,anon;
grant execute on function public.workspace_policy() to authenticated;

-- Older Gemini deployments also consult this capability before sending photos.
create or replace function public.image_findings_policy() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version',case when mode='clinical' then 0 else 1 end)
  from app_private.workspace_configuration where singleton;
$$;
revoke all on function public.image_findings_policy() from public,anon;
grant execute on function public.image_findings_policy() to authenticated;

alter table public.patients drop constraint patients_is_synthetic_check;
alter table public.investigations drop constraint investigations_is_simulated_check;
create function app_private.enforce_record_mode() returns trigger
language plpgsql security definer set search_path='' as $$
declare clinical boolean;
begin
  select mode='clinical' into strict clinical from app_private.workspace_configuration where singleton for share;
  if tg_table_name='patients' then
    if not clinical and not new.is_synthetic then
      raise exception 'Evaluation workspaces accept test patients only' using errcode='23514';
    end if;
    if tg_op='UPDATE' and new.is_synthetic is distinct from old.is_synthetic then
      raise exception 'Record origin cannot be changed' using errcode='23514';
    end if;
    new.is_synthetic := not clinical;
  else
    if not clinical and not new.is_simulated then
      raise exception 'Evaluation workspaces accept simulated investigations only' using errcode='23514';
    end if;
    if tg_op='UPDATE' and new.is_simulated is distinct from old.is_simulated then
      raise exception 'Record origin cannot be changed' using errcode='23514';
    end if;
    new.is_simulated := not clinical;
  end if;
  return new;
end $$;
create trigger enforce_patient_mode before insert or update on public.patients
for each row execute function app_private.enforce_record_mode();
create trigger enforce_investigation_mode before insert or update on public.investigations
for each row execute function app_private.enforce_record_mode();

create function app_private.stamp_consent_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.consent_version := (select consent_version from app_private.workspace_configuration where singleton);
  return new;
end $$;
create trigger stamp_consent_version before insert on public.consents
for each row execute function app_private.stamp_consent_version();

-- Current AI integrations are research-only, regardless of API configuration.
create function app_private.restrict_research_analysis() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.images i join public.patients p on p.id=i.patient_id
    where i.id=new.image_id and p.is_synthetic)
    or exists(select 1 from app_private.workspace_configuration where mode='clinical') then
    raise exception 'Research AI is unavailable for clinical patient records' using errcode='23514';
  end if;
  return new;
end $$;
create trigger restrict_research_analysis before insert or update on public.ai_analyses
for each row execute function app_private.restrict_research_analysis();
revoke all on function app_private.protect_workspace_mode(),app_private.enforce_record_mode(),
  app_private.stamp_consent_version(),app_private.restrict_research_analysis() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
