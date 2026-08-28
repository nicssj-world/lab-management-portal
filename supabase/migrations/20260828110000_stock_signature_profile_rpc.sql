-- Allow the LABCBH Stock server action to save a drawn receipt signature into
-- the Portal profile source. The Stock server uploads the private PNG first;
-- this RPC is the only database write for the profile row and records audit.

begin;

create or replace function public.save_profile_signature(
  p_actor_id uuid,
  p_signature_path text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_signature_path text;
  v_previous_signature_path text;
  v_profile_status text;
  v_profile_deleted_at timestamptz;
begin
  v_signature_path := nullif(btrim(coalesce(p_signature_path, '')), '');

  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required';
  end if;

  if v_signature_path is null or v_signature_path <> p_actor_id::text || '.png' then
    raise exception using errcode = '22023', message = 'signature path is not allowed';
  end if;

  select profile.signature_url, profile.status, profile.deleted_at
  into v_previous_signature_path, v_profile_status, v_profile_deleted_at
  from public.profiles as profile
  where profile.id = p_actor_id
  for update;

  if not found or v_profile_status <> 'active' or v_profile_deleted_at is not null then
    raise exception using errcode = '42501', message = 'actor profile is not active';
  end if;

  update public.profiles as profile
  set signature_url = v_signature_path,
      signature_updated_at = now(),
      signature_updated_by = p_actor_id
  where profile.id = p_actor_id;

  insert into public.audit_log(action, user_id, target, detail)
  values (
    'requisition.receipt_signature_drawn',
    p_actor_id,
    p_actor_id::text,
    jsonb_build_object(
      'source', 'requisition_receipt',
      'signature_path', v_signature_path
    )::text
  );

  return jsonb_build_object(
    'id', p_actor_id,
    'signature_url', v_signature_path,
    'previous_signature_path', v_previous_signature_path
  );
end
$function$;

revoke execute on function public.save_profile_signature(uuid, text) from public;
revoke execute on function public.save_profile_signature(uuid, text) from anon;
revoke execute on function public.save_profile_signature(uuid, text) from authenticated;
grant execute on function public.save_profile_signature(uuid, text) to service_role;

commit;
