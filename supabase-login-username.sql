-- RPC: Get email by username (for login by username)
-- Allows users to log in with their username instead of email
create or replace function public.get_email_by_username(p_username text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_email text;
begin
  -- Find the user's email by username (case-insensitive)
  select au.email into v_email
  from auth.users au
  join public.profiles p on p.id = au.id
  where lower(p.username) = lower(trim(p_username));

  if v_email is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'email', v_email);
end;
$$;

grant execute on function public.get_email_by_username to authenticated;
