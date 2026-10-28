-- Safe to repeat. Fictional facilities only; no Auth users/passwords are created.
insert into public.facilities(id, name, district, facility_type) values
  ('10000000-0000-4000-8000-000000000001', 'DEMO G. Madugula PHC', 'DEMO ASR District', 'phc'),
  ('10000000-0000-4000-8000-000000000002', 'DEMO Paderu Referral Hospital', 'DEMO ASR District', 'hospital'),
  ('10000000-0000-4000-8000-000000000003', 'DEMO District Office', 'DEMO ASR District', 'district')
on conflict (id) do nothing;
