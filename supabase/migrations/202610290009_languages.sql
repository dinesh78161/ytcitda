-- Add patient communication and consent languages without rewriting past records.
begin;
alter table public.patients drop constraint patients_preferred_language_check;
alter table public.patients add constraint patients_preferred_language_check
  check (preferred_language in ('en','te','hi','ta','kn','ml','mr','bn','or'));
alter table public.consents drop constraint consents_language_check;
alter table public.consents add constraint consents_language_check
  check (language in ('en','te','hi','ta','kn','ml','mr','bn','or'));
create function public.language_policy() returns jsonb
language sql stable set search_path='' as $$
  select '{"version":1,"languages":["en","te","hi","ta","kn","ml","mr","bn","or"]}'::jsonb;
$$;
revoke all on function public.language_policy() from public,anon;
grant execute on function public.language_policy() to authenticated;
notify pgrst,'reload schema';
commit;
