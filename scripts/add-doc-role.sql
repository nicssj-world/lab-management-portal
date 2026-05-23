alter table profiles
  add column if not exists doc_role text
  check (doc_role in (
    'Laboratory Director',
    'Quality Manager',
    'Document Controller',
    'Reviewer',
    'Viewer'
  ));
