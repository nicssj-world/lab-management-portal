-- The previous department-chemical review repair disambiguated the product
-- variable everywhere except the INSERT that creates an SDS version. Keep
-- that final value distinct from the target column name as well.
begin;

do $migration$
declare
  definition text;
  fixed_definition text;
begin
  select pg_get_functiondef(
    'public.review_chemical_department_change_request(uuid, uuid, text, text)'::regprocedure
  )
  into definition;

  if position('VALUES (' || chr(13) || chr(10) || '        product_id, source_file_id' in definition) = 0
     and position('VALUES (' || chr(10) || '        product_id, source_file_id' in definition) = 0 then
    if position('VALUES (' || chr(13) || chr(10) || '        product_id_value, source_file_id' in definition) > 0
       or position('VALUES (' || chr(10) || '        product_id_value, source_file_id' in definition) > 0 then
      return;
    end if;
    raise exception 'review_chemical_department_change_request SDS INSERT does not contain the expected product_id value';
  end if;

  fixed_definition := replace(
    definition,
    'VALUES (' || chr(13) || chr(10) || '        product_id, source_file_id',
    'VALUES (' || chr(13) || chr(10) || '        product_id_value, source_file_id'
  );
  fixed_definition := replace(
    fixed_definition,
    'VALUES (' || chr(10) || '        product_id, source_file_id',
    'VALUES (' || chr(10) || '        product_id_value, source_file_id'
  );

  if position('VALUES (' || chr(13) || chr(10) || '        product_id, source_file_id' in fixed_definition) > 0
     or position('VALUES (' || chr(10) || '        product_id, source_file_id' in fixed_definition) > 0 then
    raise exception 'failed to disambiguate department chemical SDS product_id reference';
  end if;

  execute fixed_definition;
end
$migration$;

commit;
