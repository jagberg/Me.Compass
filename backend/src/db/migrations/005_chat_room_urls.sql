-- Move stored Chat links to the canonical web deep-link shape the app actually routes to:
--   https://chat.google.com/spaces/<S>/threads/<T>  ->  https://chat.google.com/room/<S>/<T>
-- (migration 004 had only decoded the %2F; the spaces/.../threads/... path does not open the thread).
-- Account pinning (?authuser=) is added at serve time from ME_EMAIL, so it is not stored here.
UPDATE action
SET source_url = REPLACE(REPLACE(source_url, 'chat.google.com/spaces/', 'chat.google.com/room/'), '/threads/', '/')
WHERE source_type = 'chat' AND source_url LIKE 'https://chat.google.com/spaces/%';
