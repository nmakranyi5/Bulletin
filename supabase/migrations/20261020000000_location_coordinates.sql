-- Locations can now be picked on a map. The place name stays in `location`; the pin's
-- coordinates (rounded to roughly 100 m) are stored next to it for distance features.
alter table public.profiles
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

alter table public.positions
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

alter table public.profiles
  add constraint profiles_location_coords_valid
    check ((location_lat is null) = (location_lng is null)
           and (location_lat is null or (location_lat between -90 and 90 and location_lng between -180 and 180)));

alter table public.positions
  add constraint positions_location_coords_valid
    check ((location_lat is null) = (location_lng is null)
           and (location_lat is null or (location_lat between -90 and 90 and location_lng between -180 and 180)));
