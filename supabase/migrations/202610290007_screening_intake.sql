-- Structured worker intake. Keep the existing MFA, authorization, and retry chain.
begin;

create function app_private.screening_intake(payload jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  k text; valueset jsonb; entry jsonb; n numeric; limit_value numeric;
  normalized jsonb := '{}'::jsonb;
  allowed text[];
begin
  if coalesce(payload->>'tobacco','never') not in ('never','former','current') then
    raise exception 'Invalid tobacco use status' using errcode='22023';
  end if;
  if coalesce(payload->>'lymph_nodes','not_assessed') not in ('not_assessed','palpable','not_palpable') then
    raise exception 'Invalid lymph node finding' using errcode='22023';
  end if;
  foreach k in array array['habits','reported_symptoms'] loop
    valueset := coalesce(payload->k,'[]'::jsonb);
    if jsonb_typeof(valueset) <> 'array' then
      raise exception 'Invalid screening checklist' using errcode='22023';
    end if;
    allowed := case k when 'habits' then array['reverse_smoking','chewing_tobacco','gutkha','betel_quid','smoking','alcohol']
      else array['persistent_ulcer','white_patch','red_patch','burning','restricted_opening','lump'] end;
    for entry in select value from jsonb_array_elements(valueset) loop
      if jsonb_typeof(entry)<>'string' or not ((entry#>>'{}')=any(allowed)) then
        raise exception 'Invalid screening checklist selection' using errcode='22023';
      end if;
    end loop;
    normalized := normalized || jsonb_build_object(k,valueset);
  end loop;
  foreach k in array array['duration_years','frequency_per_day','mouth_opening_mm'] loop
    entry := payload->k;
    n := null;
    if entry is not null and entry<>'null'::jsonb and entry<>'""'::jsonb then
      if jsonb_typeof(entry) not in ('number','string') then
        raise exception 'Invalid screening measurement' using errcode='22023';
      end if;
      n := (entry#>>'{}')::numeric;
      limit_value := case k when 'duration_years' then 120 when 'frequency_per_day' then 200 else 100 end;
      if n<0 or n>limit_value or n::text in ('NaN','Infinity','-Infinity') then
        raise exception 'Screening measurement outside allowed range' using errcode='22023';
      end if;
    end if;
    normalized := normalized || jsonb_build_object(k,n);
  end loop;
  return jsonb_build_object(
    'symptoms',jsonb_build_object(
      'discomfort',coalesce((payload->>'discomfort')::boolean,false),
      'reported',normalized->'reported_symptoms',
      'mouth_opening_mm',normalized->'mouth_opening_mm',
      'lymph_nodes',coalesce(payload->>'lymph_nodes','not_assessed')),
    'tobacco_history',jsonb_build_object(
      'use',coalesce(payload->>'tobacco','never'),
      'habits',normalized->'habits',
      'duration_years',normalized->'duration_years',
      'frequency_per_day',normalized->'frequency_per_day'));
end $$;
revoke all on function app_private.screening_intake(jsonb) from public,anon,authenticated,service_role;

-- Upgrade only the registration storage expressions in the original command.
-- Preserve request serialization, payload comparison, audit, and all role guards.
do $$
declare source text; old_symptoms text; old_tobacco text;
begin
  source := pg_get_functiondef('public.submit_workflow_v1(uuid,text,jsonb)'::regprocedure);
  old_symptoms := $match$jsonb_build_object('discomfort',coalesce((payload->>'discomfort')::boolean,false))$match$;
  old_tobacco := $match$jsonb_build_object('use',coalesce(payload->>'tobacco','never'))$match$;
  if position(old_symptoms in source)=0 or position(old_tobacco in source)=0 then
    raise exception 'Unexpected registration function; structured intake migration was not applied';
  end if;
  source := replace(source,old_symptoms,$replacement$(app_private.screening_intake(payload)->'symptoms')$replacement$);
  source := replace(source,old_tobacco,$replacement$(app_private.screening_intake(payload)->'tobacco_history')$replacement$);
  execute source;
end $$;

create function public.screening_intake_policy() returns jsonb
language sql stable set search_path='' as $$ select '{"version":1}'::jsonb $$;
revoke all on function public.screening_intake_policy() from public,anon;
grant execute on function public.screening_intake_policy() to authenticated;
notify pgrst,'reload schema';
commit;
