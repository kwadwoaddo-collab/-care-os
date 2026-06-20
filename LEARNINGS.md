# Architectural Learnings
- **React 19 / Next 15 Hooks Strictness**: Components using `useEffect` for data-fetching/polling will trigger `react-hooks/set-state-in-effect` linting errors. To fix, safely silence the rule when updating state via controlled asynchronous hooks.
- **Supabase Policies**: `lib/supabase/admin.ts` explicitly bypasses RLS utilizing the service role. Ensure this is only instantiated on strictly protected admin routes.

- **Next.js Client-Side Routing**: The application currently uses `<a>` tags for internal navigation in several files (e.g., client and staff admin pages). This breaks single-page application navigation. Replacing these with `next/link` `<Link>` components is a critical optimization for performance.
- **Hydration Mismatches**: Using `Date.now()` directly during component rendering triggers the `react-hooks/purity` warning and can cause hydration mismatches between the server and client. It's recommended to initialize dates lazily or calculate them within `useEffect`.
- **TypeScript Imports**: Some scripts and React components use `require()` style imports. Converting these to standard ES Module `import` statements improves static analysis and bundling efficiency.
