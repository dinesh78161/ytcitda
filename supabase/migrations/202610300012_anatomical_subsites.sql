-- Support all 6 standardized anatomical sub-sites for oral cancer examination
begin;

alter table public.images drop constraint if exists images_oral_view_check;

alter table public.images add constraint images_oral_view_check
  check (oral_view in (
    'cheek',
    'tongue',
    'palate',
    'gums',
    'floor_of_mouth',
    'left_buccal_mucosa',
    'right_buccal_mucosa',
    'lateral_tongue',
    'lower_labial_sulcus'
  ));

commit;

