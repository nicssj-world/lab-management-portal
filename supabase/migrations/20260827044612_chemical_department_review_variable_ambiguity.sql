-- The department-chemical review RPC used PL/pgSQL variables named
-- product_id, canonical_name, and cas_number next to SQL expressions that
-- expose columns with the same names. PostgreSQL resolves those references
-- as ambiguous when the approval path is executed. Rebuild the current
-- definition with distinct variable names while preserving its body, owner,
-- grants, and security mode.
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

  if position('  product_id uuid;' in definition) = 0
     or position('  canonical_name text;' in definition) = 0
     or position('  cas_number text;' in definition) = 0 then
    raise exception 'review_chemical_department_change_request does not contain the expected variables';
  end if;

  fixed_definition := replace(definition, '  product_id uuid;', '  product_id_value uuid;');
  fixed_definition := replace(fixed_definition, '  canonical_name text;', '  canonical_name_value text;');
  fixed_definition := replace(fixed_definition, '  cas_number text;', '  cas_number_value text;');
  fixed_definition := replace(fixed_definition, '    canonical_name :=', '    canonical_name_value :=');
  fixed_definition := replace(fixed_definition, '    cas_number :=', '    cas_number_value :=');
  fixed_definition := replace(fixed_definition, '      product_id := product_row.id;', '      product_id_value := product_row.id;');
  fixed_definition := replace(fixed_definition, 'lower(btrim(canonical_name))', 'lower(btrim(canonical_name_value))');
  fixed_definition := replace(
    fixed_definition,
    'cas_number IS NOT NULL AND product.cas_number = cas_number',
    'cas_number_value IS NOT NULL AND product.cas_number = cas_number_value'
  );
  fixed_definition := replace(
    fixed_definition,
    '        canonical_name,' || chr(13) || chr(10) || '        cas_number,',
    '        canonical_name_value,' || chr(13) || chr(10) || '        cas_number_value,'
  );
  fixed_definition := replace(
    fixed_definition,
    '        canonical_name,' || chr(10) || '        cas_number,',
    '        canonical_name_value,' || chr(10) || '        cas_number_value,'
  );
  fixed_definition := replace(fixed_definition, 'RETURNING id INTO product_id;', 'RETURNING id INTO product_id_value;');
  fixed_definition := replace(fixed_definition, 'SELECT product_id, alias.value', 'SELECT product_id_value, alias.value');
  fixed_definition := replace(
    fixed_definition,
    'VALUES (product_id, current_row.unit_id, canonical_name',
    'VALUES (product_id_value, current_row.unit_id, canonical_name_value'
  );
  fixed_definition := replace(
    fixed_definition,
    'VALUES (' || chr(13) || chr(10) || '      product_id,',
    'VALUES (' || chr(13) || chr(10) || '      product_id_value,'
  );
  fixed_definition := replace(
    fixed_definition,
    'VALUES (' || chr(10) || '      product_id,',
    'VALUES (' || chr(10) || '      product_id_value,'
  );
  fixed_definition := replace(fixed_definition, 'WHERE version.product_id = product_id', 'WHERE version.product_id = product_id_value');
  fixed_definition := replace(
    fixed_definition,
    'source_department_sds_id, product_id, holding_id',
    'source_department_sds_id, product_id_value, holding_id'
  );
  fixed_definition := replace(fixed_definition, '''entity_id'', product_id,', '''entity_id'', product_id_value,');

  if position('  product_id uuid;' in fixed_definition) > 0
     or position('  canonical_name text;' in fixed_definition) > 0
     or position('  cas_number text;' in fixed_definition) > 0
     or position('lower(btrim(canonical_name))' in fixed_definition) > 0
     or position('cas_number IS NOT NULL AND product.cas_number = cas_number' in fixed_definition) > 0
     or position('RETURNING id INTO product_id;' in fixed_definition) > 0
     or position('SELECT product_id, alias.value' in fixed_definition) > 0
     or position('VALUES (product_id, current_row.unit_id, canonical_name' in fixed_definition) > 0
     or position('version.product_id = product_id ' in fixed_definition) > 0
     or position('source_department_sds_id, product_id, holding_id' in fixed_definition) > 0
     or position('''entity_id'', product_id,' in fixed_definition) > 0
     or position('product_id_value' in fixed_definition) = 0
     or position('canonical_name_value' in fixed_definition) = 0
     or position('cas_number_value' in fixed_definition) = 0 then
    raise exception 'failed to disambiguate department chemical review references';
  end if;

  execute fixed_definition;
end
$migration$;

commit;
