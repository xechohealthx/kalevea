# Tech Debt Register

## Middleware convention deprecation

- **Issue**: Next.js warns that the `middleware` file convention is deprecated in favor of `proxy`.
- **Current status**: Existing `middleware.ts` still works and is not blocking app behavior.
- **Action later**: Migrate route protection logic from `middleware.ts` to the `proxy` convention in a dedicated upgrade task.
- **Reason deferred**: Phase 1 closeout focuses on safety and stability without introducing routing behavior changes.
