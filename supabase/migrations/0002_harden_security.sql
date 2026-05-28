-- Cult OS — harden security-definer functions
-- Mirrors the patch applied to project evjlmrhgxyjumbfjzbpq on 2026-05-27.
-- Addresses Supabase advisor warnings flagged after 0001_init.sql.
--
-- 1. set_updated_at had a mutable search_path. Lock it to public.
-- 2. handle_new_user is for the on_auth_user_created trigger only — must not be
--    callable via /rest/v1/rpc. Revoke EXECUTE from all API-facing roles
--    (triggers don't go through the EXECUTE permission check).
-- 3. seed_default_deliverables is admin-only. Revoke from anon. authenticated
--    keeps EXECUTE so the function's internal is_admin() check still gates it.
-- 4. is_admin / is_super_admin / current_client_id stay executable by authenticated
--    because RLS policies on profiles / clients / etc. invoke them. They return
--    false / null for unauthenticated callers and don't leak data, so leaving
--    them callable by anon is the accepted tradeoff.

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.seed_default_deliverables(uuid) from anon, public;
