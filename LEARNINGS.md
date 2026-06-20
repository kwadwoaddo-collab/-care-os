# Architectural Learnings
- **React 19 / Next 15 Hooks Strictness**: Components using `useEffect` for data-fetching/polling will trigger `react-hooks/set-state-in-effect` linting errors. To fix, safely silence the rule when updating state via controlled asynchronous hooks.
- **Supabase Policies**: `lib/supabase/admin.ts` explicitly bypasses RLS utilizing the service role. Ensure this is only instantiated on strictly protected admin routes.
