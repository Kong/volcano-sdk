# Testing Strategy for volcano-sdk

## Issue #28: Why Tests Didn't Catch the ES Module Bug

### The Problem

The OpenTelemetry integration used `require('@opentelemetry/api')` which failed in pure ES module contexts, even though `@opentelemetry/api` was installed. Users saw this warning:

```
[Volcano] OpenTelemetry API not found. Install with: npm install @opentelemetry/api
```

### Why Our Tests Missed It

1. **Source vs. Dist Testing Gap**
   - Most tests imported from `../src/volcano-sdk.js` (TypeScript source)
   - Source code runs through Vitest's TypeScript transformation
   - The transformation/bundling handles `require()` differently than runtime Node.js does
   - The actual issue only appears when consuming the **compiled** `dist/` package

2. **Development Dependencies Available**
   - Tests run with all devDependencies installed (including `@opentelemetry/api`)
   - Tests don't simulate the "fresh install" scenario
   - The `require()` call worked in the test environment but failed for end users

3. **Module Context Differences**
   - Vitest test environment != Real-world ES module consumer environment
   - `require()` behaves differently in each context
   - Our TypeScript compilation doesn't transform dynamic `require()` calls

### The Fix

Changed from plain `require()` to ES-module compatible `createRequire()`:

```typescript
import { createRequire } from 'node:module';

function tryLoadOtel() {
  if (otelApi) return otelApi;
  
  try {
    const require = createRequire(import.meta.url);
    otelApi = require('@opentelemetry/api');
    return otelApi;
  } catch {
    // handle error
  }
}
```

## Testing Strategy Going Forward

### 1. **E2E Tests Must Use Dist Package**

**✅ DO:**
```typescript
import { createVolcanoTelemetry } from '../dist/volcano-sdk.js';
```

**❌ DON'T (for E2E tests):**
```typescript
import { createVolcanoTelemetry } from '../src/volcano-sdk.js';
```

### 2. **Test Matrix**

| Test Type | Import From | Purpose | Example |
|-----------|-------------|---------|---------|
| Unit Tests | `src/` | Fast iteration, test logic | `agent.validation.test.ts` |
| Integration Tests | `src/` or `dist/` | Test feature interactions | `agent.patterns.test.ts` |
| E2E Tests | `dist/` | Test as consumers use it | `telemetry.dist.e2e.test.ts` |

### 3. **New E2E Test: `telemetry.dist.e2e.test.ts`**

This test specifically validates:
- ✅ Loading `@opentelemetry/api` in ES module context (no warnings)
- ✅ Creating spans using the compiled dist package
- ✅ ES module dynamic imports work correctly (regression test for #28)
- ✅ Metrics work in ES module context

**This test would have caught issue #28.**

### 4. **CI/CD Recommendations**

To prevent similar issues:

1. **Always build before E2E tests:**
   ```bash
   npm run build && npm test -- tests/*.e2e.test.ts
   ```

2. **Consider a "clean install" test:**
   ```bash
   # Create temp dir, npm pack, install in fresh project, run tests
   ```

3. **Test in multiple Node.js environments:**
   - CommonJS projects
   - ESM projects ("type": "module")
   - Different Node.js versions

### 5. **When to Use Each Test Type**

#### Unit Tests (`*.unit.test.ts`)
- Test individual functions/classes
- Mock dependencies
- Fast, isolated
- Import from `src/`

#### Integration Tests (`*.integration.test.ts`)
- Test feature combinations
- Use real dependencies when possible
- Can import from `src/` or `dist/`

#### E2E Tests (`*.e2e.test.ts`)
- **MUST** import from `dist/`
- Test exactly as consumers use the package
- Simulate real-world scenarios
- Catch compilation/bundling issues

## Checklist for New Features

When adding features that involve:
- [ ] Dynamic imports/requires
- [ ] Optional dependencies
- [ ] Module system compatibility
- [ ] Build/compilation steps

**Always add:**
- [ ] Unit tests (test logic)
- [ ] Integration tests (test with other features)
- [ ] **E2E test using `dist/` package** (test as consumers use it)

## Key Takeaway

**The gap between source and dist testing can hide real-world issues.** Always have E2E tests that use the compiled `dist/` package to catch issues that only appear in production environments.

