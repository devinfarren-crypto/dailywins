-- Add schools.schedules JSONB column with shape validation.
-- Shape matches src/lib/schedules-schema.ts:
-- {
--   "Regular": {
--     "periods": [
--       { "label": "Period 1", "start": "8:30", "end": "9:20" }
--     ]
--   }
-- }

alter table schools
  add column if not exists schedules jsonb;

create or replace function is_valid_schedules(p_schedules jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_variant record;
  v_period jsonb;
begin
  if p_schedules is null then
    return true;
  end if;

  if jsonb_typeof(p_schedules) <> 'object' then
    return false;
  end if;

  if not exists (select 1 from jsonb_each(p_schedules)) then
    return false;
  end if;

  for v_variant in
    select key, value
    from jsonb_each(p_schedules)
  loop
    if jsonb_typeof(v_variant.value) <> 'object' then
      return false;
    end if;

    if not (v_variant.value ? 'periods') then
      return false;
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_variant.value) as k(key)
      where k.key <> 'periods'
    ) then
      return false;
    end if;

    if jsonb_typeof(v_variant.value -> 'periods') <> 'array' then
      return false;
    end if;

    for v_period in
      select value
      from jsonb_array_elements(v_variant.value -> 'periods')
    loop
      if jsonb_typeof(v_period) <> 'object' then
        return false;
      end if;

      if exists (
        select 1
        from jsonb_object_keys(v_period) as k(key)
        where k.key not in ('label', 'start', 'end')
      ) then
        return false;
      end if;

      if not (v_period ? 'label' and v_period ? 'start' and v_period ? 'end') then
        return false;
      end if;

      if jsonb_typeof(v_period -> 'label') <> 'string'
         or jsonb_typeof(v_period -> 'start') <> 'string'
         or jsonb_typeof(v_period -> 'end') <> 'string' then
        return false;
      end if;

      if btrim(v_period ->> 'label') = ''
         or btrim(v_period ->> 'start') = ''
         or btrim(v_period ->> 'end') = '' then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schools_schedules_valid'
      and conrelid = 'schools'::regclass
  ) then
    alter table schools
      add constraint schools_schedules_valid
      check (is_valid_schedules(schedules));
  end if;
end;
$$;
