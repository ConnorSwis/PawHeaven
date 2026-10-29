-- Guest-safe list of open visit times and volunteer shifts, so people can look before signing in.
-- Expand-only: a new function, nothing existing changes. Returns ids so a guest's choice can be
-- booked after sign-in, and no personal data.
create function public.get_public_availability()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'visits', coalesce((select jsonb_agg(v order by v ->> 'startsAt') from (
      select jsonb_build_object('id', slot.id, 'startsAt', slot.starts_at, 'endsAt', slot.ends_at, 'spotsLeft', slot.capacity - booked.n) as v
      from public.visit_slots slot
      cross join lateral (select count(*)::integer n from public.appointments a where a.slot_id = slot.id and a.status = 'booked') booked
      where slot.status = 'published' and slot.starts_at > now() and slot.starts_at < now() + interval '45 days' and booked.n < slot.capacity
      order by slot.starts_at limit 120) q), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(v order by v ->> 'startsAt') from (
      select jsonb_build_object('id', sh.id, 'title', sh.title, 'description', sh.description, 'requirements', sh.requirements, 'minAge', sh.min_age,
        'startsAt', sh.starts_at, 'endsAt', sh.ends_at, 'capacity', sh.capacity, 'spotsLeft', sh.capacity - reg.n) as v
      from public.volunteer_shifts sh
      cross join lateral (select count(*)::integer n from public.volunteer_registrations r where r.shift_id = sh.id and r.status = 'registered') reg
      where sh.status = 'published' and sh.starts_at > now() and sh.starts_at < now() + interval '60 days' and reg.n < sh.capacity
      order by sh.starts_at limit 150) q), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_public_availability() from public, anon, authenticated;
grant execute on function public.get_public_availability() to anon, authenticated;

comment on function public.get_public_availability() is
  'Open visit times and volunteer shifts for guests: ids, times, and places left only.';
