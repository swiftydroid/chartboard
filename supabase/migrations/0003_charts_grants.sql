-- 0002_charts.sql defined RLS policies but never granted the underlying
-- table-level privileges to the authenticated role. RLS only governs which
-- rows a role can see/touch; Postgres still requires the base GRANT before
-- RLS is evaluated at all. Without this, every request from the app
-- (running as the authenticated role) fails with "permission denied for
-- table charts" (Postgres error 42501), even though the RLS policies
-- themselves are correct.
grant select, insert, update on public.charts to authenticated;
