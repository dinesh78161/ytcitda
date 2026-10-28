-- Authenticated, atomic workflow commands. No service key is needed in the PWA.
begin;
create table app_private.workflow_requests (
  actor_id uuid not null references public.profiles(id),
  request_id uuid not null,
  action text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);
revoke all on app_private.workflow_requests from public, anon, authenticated;

create function public.submit_workflow(request_id uuid, action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype; previous app_private.workflow_requests%rowtype;
  person uuid; screening public.screenings%rowtype; referral public.referrals%rowtype;
  appointment public.appointments%rowtype; task public.navigation_tasks%rowtype;
  image_record public.images%rowtype;
  consent_id uuid; review_id uuid; referral_id uuid; result_id uuid;
  facility uuid; clinician uuid; navigator uuid; superseded uuid;
  result jsonb; starts timestamptz;
begin
  select * into actor from public.profiles where id = (select auth.uid()) and active;
  if actor.id is null then raise exception 'Active staff account required' using errcode = '42501'; end if;
  if request_id is null or payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Request ID and object payload required' using errcode = '22023';
  end if;
  -- Serialize retrying requests, including simultaneous requests from two tabs.
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text || request_id::text, 0));
  select * into previous from app_private.workflow_requests w
    where w.actor_id = actor.id and w.request_id = submit_workflow.request_id;
  if found then
    if previous.action is distinct from action or previous.payload is distinct from payload then
      raise exception 'Request ID reused with different content' using errcode = '23505';
    end if;
    return previous.result;
  end if;

  if action = 'register' then
    if actor.role <> 'health_worker' then raise exception 'Health worker required' using errcode = '42501'; end if;
    if (payload->>'consent')::boolean is distinct from true
      or coalesce(length(trim(payload->>'display_name')),0) not between 1 and 120
      or coalesce(length(trim(payload->>'village')),0) not between 1 and 120
      or payload->>'age_years' is null or (payload->>'age_years')::integer not between 0 and 120
      or payload->>'patient_id' is null or payload->>'screening_id' is null then
      raise exception 'Valid details and screening consent required' using errcode = '23514';
    end if;
    person := (payload->>'patient_id')::uuid;
    insert into public.patients(id, facility_id, registered_by, display_name, age_years, village, contact_phone, preferred_language)
    values (person, actor.facility_id, actor.id, trim(payload->>'display_name'), (payload->>'age_years')::integer,
      trim(payload->>'village'), nullif(payload->>'contact_phone',''), coalesce(payload->>'language','en'));
    insert into public.patient_assignments(patient_id, user_id, assigned_by)
      select person, p.id, actor.id from public.profiles p
      where p.active and (p.id = actor.id or (p.facility_id = actor.facility_id and p.role in ('medical_officer','navigator')));
    insert into public.consents(patient_id,purpose,granted,language,consent_version,recorded_by)
      values(person,'screening',true,coalesce(payload->>'language','en'),'demo-v1',actor.id) returning id into consent_id;
    if (payload->>'photo_consent')::boolean is true then
      insert into public.consents(patient_id,purpose,granted,language,consent_version,recorded_by)
        values(person,'image_capture',true,coalesce(payload->>'language','en'),'demo-v1',actor.id);
    end if;
    insert into public.screenings(id,patient_id,examiner_id,consent_id,symptoms,tobacco_history,examination_notes,status)
      values((payload->>'screening_id')::uuid,person,actor.id,consent_id,
        jsonb_build_object('discomfort',coalesce((payload->>'discomfort')::boolean,false)),
        jsonb_build_object('use',coalesce(payload->>'tobacco','never')),left(payload->>'notes',5000),'awaiting_clinician');
    result := jsonb_build_object('patient_id',person);

  elsif action = 'review' then
    person := (payload->>'patient_id')::uuid;
    if actor.role not in ('medical_officer','specialist') or not app_private.can_access_patient(person) then
      raise exception 'Assigned clinician required' using errcode = '42501';
    end if;
    select * into screening from public.screenings where patient_id = person order by created_at desc limit 1 for update;
    if screening.id is null then raise exception 'Screening not found' using errcode = '22023'; end if;
    if screening.revision is distinct from (payload->>'revision')::integer then
      raise exception 'Record changed; refresh before reviewing' using errcode = '40001';
    end if;
    if screening.status in ('closed','care_linked') or coalesce(length(trim(payload->>'findings')),0) not between 1 and 5000 then
      raise exception 'Review requires an open case and findings' using errcode = '23514';
    end if;
    select id into superseded from public.clinical_reviews where screening_id = screening.id order by signed_at desc limit 1;
    insert into public.clinical_reviews(patient_id,screening_id,doctor_id,findings,clinical_decision,supersedes_id)
      values(person,screening.id,actor.id,payload->>'findings',payload->>'decision',superseded) returning id into review_id;
    update public.screenings set status = case payload->>'decision' when 'refer' then 'referral_planned'
      when 'close' then 'closed' else 'reviewed' end, revision = revision + 1 where id = screening.id;
    if payload->>'decision' = 'refer' then
      select f.id into facility from public.facilities f join public.facilities home on home.id = actor.facility_id
        where f.facility_type = 'hospital' and f.district = home.district order by f.id limit 1;
      if facility is null then raise exception 'No referral hospital configured' using errcode = '23514'; end if;
      insert into public.referrals(patient_id,review_id,destination_facility_id,specialty,priority)
        values(person,review_id,facility,'Oral medicine',coalesce(payload->>'priority','routine')) returning id into referral_id;
      insert into public.patient_assignments(patient_id,user_id,assigned_by)
        select person,p.id,actor.id from public.profiles p where p.active and p.facility_id = facility and p.role = 'specialist'
        on conflict(patient_id,user_id) where revoked_at is null do nothing;
      select p.id into navigator from public.profiles p join public.patient_assignments a on a.user_id=p.id
        where a.patient_id=person and a.revoked_at is null and p.active and p.role='navigator' order by p.id limit 1;
      if navigator is not null then
        insert into public.navigation_tasks(patient_id,referral_id,owner_id,task_type,due_at)
          values(person,referral_id,navigator,'follow_up',coalesce((payload->>'followup_at')::timestamptz,now()));
      end if;
    end if;
    result := jsonb_build_object('review_id',review_id,'referral_id',referral_id);

  elsif action in ('appoint','diagnosis') then
    if actor.role not in ('medical_officer','specialist','navigator')
      or (action='diagnosis' and actor.role='navigator') then
      raise exception 'Role does not permit this action' using errcode = '42501';
    end if;
    select * into referral from public.referrals where id=(payload->>'referral_id')::uuid for update;
    if referral.id is null or not app_private.can_access_patient(referral.patient_id) then
      raise exception 'Assigned referral required' using errcode = '42501';
    end if;
    if referral.status in ('closed','declined') then raise exception 'Referral is closed' using errcode = '23514'; end if;
    if action='appoint' then
      starts := (payload->>'starts_at')::timestamptz;
      if starts is null then raise exception 'Appointment date required' using errcode = '23514'; end if;
      select p.id into clinician from public.profiles p join public.patient_assignments a on a.user_id=p.id
        where a.patient_id=referral.patient_id and a.revoked_at is null and p.active and p.role='specialist'
          and p.facility_id=referral.destination_facility_id order by p.id limit 1;
      if clinician is null then raise exception 'Assign a specialist at the referral hospital first' using errcode = '23514'; end if;
      insert into public.appointments(patient_id,referral_id,clinician_id,starts_at,ends_at,mode,status)
        values(referral.patient_id,referral.id,clinician,starts,starts+interval '30 minutes',payload->>'mode','confirmed') returning id into result_id;
      update public.referrals set status='booked' where id=referral.id;
    else
      if coalesce(length(trim(payload->>'diagnosis')),0) not between 1 and 5000 then
        raise exception 'Simulated clinician outcome required' using errcode = '23514';
      end if;
      insert into public.investigations(patient_id,referral_id,clinician_id,kind,status,clinician_diagnosis)
        values(referral.patient_id,referral.id,actor.id,'pathology','reviewed',payload->>'diagnosis') returning id into result_id;
      update public.screenings set status='result_reviewed',revision=revision+1
        where id=(select screening_id from public.clinical_reviews where id=referral.review_id);
    end if;
    result := jsonb_build_object('id',result_id);

  elsif action = 'attendance' then
    if actor.role not in ('medical_officer','specialist','navigator') then raise exception 'Role not permitted' using errcode = '42501'; end if;
    select * into appointment from public.appointments where id=(payload->>'appointment_id')::uuid for update;
    if appointment.id is null or not app_private.can_access_patient(appointment.patient_id) then
      raise exception 'Assigned appointment required' using errcode = '42501';
    end if;
    if appointment.status not in ('requested','confirmed','rescheduled') or coalesce(payload->>'status','') not in ('completed','missed','cancelled') then
      raise exception 'Invalid attendance transition' using errcode = '23514';
    end if;
    update public.appointments set status=payload->>'status' where id=appointment.id;
    if payload->>'status'='missed' then
      select p.id into navigator from public.profiles p join public.patient_assignments a on a.user_id=p.id
        where a.patient_id=appointment.patient_id and a.revoked_at is null and p.active and p.role='navigator' order by p.id limit 1;
      if navigator is null then raise exception 'Assign a navigator before recording a missed appointment' using errcode = '23514'; end if;
      insert into public.navigation_tasks(patient_id,referral_id,owner_id,task_type,due_at)
        values(appointment.patient_id,appointment.referral_id,navigator,'missed_visit',now());
    end if;
    result := jsonb_build_object('id',appointment.id);

  elsif action = 'followup' then
    if actor.role not in ('navigator','medical_officer','specialist') then raise exception 'Role not permitted' using errcode = '42501'; end if;
    select * into task from public.navigation_tasks where id=(payload->>'task_id')::uuid for update;
    if task.id is null or not app_private.can_access_patient(task.patient_id) then raise exception 'Assigned task required' using errcode = '42501'; end if;
    if task.status<>'pending' or coalesce(payload->>'status','') not in ('completed','declined','lost_contact') then
      raise exception 'Invalid task transition' using errcode = '23514';
    end if;
    update public.navigation_tasks set status=payload->>'status' where id=task.id;
    result := jsonb_build_object('id',task.id);

  elsif action = 'analyze' then
    select * into image_record from public.images where id=(payload->>'image_id')::uuid;
    if image_record.id is null or not app_private.can_read_clinical(image_record.patient_id) then
      raise exception 'Assigned clinical user required' using errcode = '42501';
    end if;
    if image_record.quality_status <> 'acceptable' then raise exception 'Acceptable image required' using errcode = '23514'; end if;
    insert into public.ai_analyses(image_id,provider,model_version,status,research_label)
      values(image_record.id,'mock','mock-v1','completed','demo_review_required') returning id into result_id;
    result := jsonb_build_object('id',result_id);
  else
    raise exception 'Unsupported workflow action' using errcode = '22023';
  end if;

  insert into app_private.workflow_requests(actor_id,request_id,action,payload,result)
    values(actor.id,request_id,action,payload,result);
  return result;
end;
$$;
revoke all on function public.submit_workflow(uuid,text,jsonb) from public,anon;
grant execute on function public.submit_workflow(uuid,text,jsonb) to authenticated;
commit;
