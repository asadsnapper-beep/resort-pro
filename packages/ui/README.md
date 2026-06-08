# @resort-pro/ui

Minimal design-system starter for Resort Pro.

Contents:
- `src/tokens.ts` — design tokens (colors, spacing, typography)
- `src/Button.tsx` — basic `Button` component using tokens
- `src/index.ts` — public exports

Build:

```bash
# from workspace root
cd packages/ui
pnpm install
pnpm run build
```

Usage (in repo packages):

```ts
import { Button } from '@resort-pro/ui';
```

Next steps:
- Add Storybook and stories for `Button` and other future components
- Add Tailwind / CSS-in-JS integration if desired
- Add automated visual regression tests
