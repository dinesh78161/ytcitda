-- Persist structured observations from a vision model. Existing research results
-- retain their labels/scores; mock results still cannot carry a prediction score.
begin;
alter table public.ai_analyses add column findings jsonb;
alter table public.ai_analyses add constraint image_findings_object
  check (findings is null or (jsonb_typeof(findings)='object' and provider='research' and score is null));
create function public.image_findings_policy() returns jsonb
language sql stable set search_path='' as $$ select '{"version":1}'::jsonb $$;
revoke all on function public.image_findings_policy() from public,anon;
grant execute on function public.image_findings_policy() to authenticated;
notify pgrst,'reload schema';
commit;