# Testing

**Framework:** Vitest v4 + @testing-library/react + jsdom

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence. Without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Run tests

```bash
cd client
npm test          # single run
npm run test:watch  # watch mode
```

## Test layers

- **Unit tests** — pure functions in `src/utils.js` (score colors, compass labels, sky emojis, UV helpers). Location: `src/__tests__/`. Fast, no browser needed.
- **Component tests** — React components via @testing-library/react. Test behavior users see, not implementation details.
- **No E2E tests yet** — the app is small enough that manual QA + unit coverage is sufficient. Add Playwright if the interactive surface grows.

## Conventions

- Files: `src/__tests__/*.test.js`
- Assertion style: `expect(x).toBe(y)`, `expect(x).toBeNull()`, `expect(x).toMatchSnapshot()`
- Mock externals (fetch, Date) at the test file level with `vi.fn()` / `vi.spyOn()`
- Test what the code DOES for a user, not implementation details

## Expectations

- New utility functions → write a test
- Bug fix → add a regression test proving the old behavior fails without the fix
- New conditional branch → test both paths
- Never commit code that makes existing tests fail
