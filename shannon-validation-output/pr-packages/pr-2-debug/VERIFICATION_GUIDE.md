# Verification Guide for debug.test.ts

## Pre-submission Checklist

Before submitting this PR to Shannon, please complete the following verification steps:

---

## Step 1: Verify Debug Function Behavior

The tests assume `debugLog` logs to `console.log` when `config.debug` is true. Verify this:

### Quick Verification Script

```bash
cd Shannon-main/observability/dashboard
node --input-type=module << 'EOF'
import { config } from './lib/config.js';
import { debugLog } from './lib/debug.js';

console.log('=== Verification Results ===\n');

// Test 1: When debug is enabled
config.debug = true;
console.log('✓ Setting config.debug = true');
debugLog('TEST', 'This should appear');
console.log('');

// Test 2: When debug is disabled
config.debug = false;
console.log('✓ Setting config.debug = false');
debugLog('TEST', 'This should NOT appear');
console.log('');

console.log('✓ If you saw "[TEST] This should appear" above, the function works as expected');
EOF
```

### Known Potential Issues

⚠️ **Console method**: Verify which console method `debugLog` actually uses:
- Tests assume: `console.log`
- If Shannon uses: `console.debug` or `console.info`
- **Action**: Update line 18 in test file:
  ```typescript
  // Change from:
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  
  // To (if using console.debug):
  consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  ```

⚠️ **Config import path**: Tests assume:
```typescript
import { config } from '../../lib/config';
```

Verify this path is correct based on your test file location.

---

## Step 2: Run Tests Locally

```bash
cd Shannon-main/observability/dashboard

# Copy the test file
cp /path/to/debug.test.ts lib/debug.test.ts

# Run the tests
pnpm test lib/debug.test.ts

# Expected output:
# ✓ debugLog (9 tests)
#   ✓ when config.debug is true (5)
#   ✓ when config.debug is false (4)
# Tests: 9 passed (9 total)
```

### If Tests Fail

#### Common Issue 1: "Cannot spy on property 'log'"

**Cause**: Wrong console method

**Fix**:
1. Check Shannon's `debugLog` implementation
2. Update the spy to match (console.log vs console.debug)
3. Update all references in the test file

#### Common Issue 2: "Cannot find module './config'"

**Cause**: Wrong import path

**Fix**: Update imports to match Shannon's file structure:
```typescript
// Possible correct paths:
import { config } from './config';           // if test is in lib/
import { config } from '../lib/config';      // if test is in __tests__/
import { config } from '../../lib/config';   // if test is in lib/__tests__/
```

#### Common Issue 3: "config.debug is read-only"

**Cause**: Config might be immutable

**Fix**: Update the test to use a different mocking strategy:
```typescript
vi.mock('../../lib/config', () => ({
  config: { debug: false }, // Set default
}));

// In test:
beforeEach(() => {
  (config as any).debug = true; // Cast to any to override
});
```

---

## Step 3: Fix Import Paths

**Verify correct paths based on test file location:**

| Test Location | Import Paths |
|---------------|--------------|
| `lib/debug.test.ts` | `import { debugLog } from './debug';`<br>`import { config } from './config';` |
| `__tests__/debug.test.ts` | `import { debugLog } from '../lib/debug';`<br>`import { config } from '../lib/config';` |
| `lib/__tests__/debug.test.ts` | `import { debugLog } from '../debug';`<br>`import { config } from '../config';` |

**Action**: Update lines 2-3 of the test file.

---

## Step 4: Verify Vitest Syntax

The tests use Vitest's mocking API. Ensure Shannon is using Vitest (not Jest):

```bash
# Check package.json
grep -A 5 "vitest" Shannon-main/observability/dashboard/package.json
```

If Shannon uses **Jest** instead:

<details>
<summary>Click to see Jest conversion</summary>

**Convert Vitest → Jest syntax:**

```typescript
// 1. Change imports:
- import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+ import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// 2. Replace vi. with jest.:
- vi.mock(...)
+ jest.mock(...)

- vi.spyOn(...)
+ jest.spyOn(...)

- vi.restoreAllMocks()
+ jest.restoreAllMocks()

// 3. Update type:
- let consoleLogSpy: vi.SpyInstance;
+ let consoleLogSpy: jest.SpyInstance;
```

</details>

---

## Step 5: Code Quality Check

```bash
# Lint
pnpm lint lib/debug.test.ts

# Type check
pnpm typecheck
```

**Fix any errors** before submitting.

---

## Step 6: Final Review

### Checklist

- [ ] All 9 tests pass locally
- [ ] Import paths are correct
- [ ] Console method matches (log vs debug)
- [ ] Config mocking works correctly
- [ ] No linter errors
- [ ] No type errors
- [ ] Vitest/Jest syntax matches project
- [ ] Commit message is descriptive
- [ ] PR description is complete

---

## Step 7: Create PR (Manual Process)

⚠️ **IMPORTANT**: Do NOT use automated scripts. Perform all Git operations manually.

### Timing

**Recommended**: Submit this PR **after PR #1 (format.test.ts) is reviewed/merged** to:
- Avoid overwhelming maintainers
- Build trust incrementally
- Incorporate feedback from PR #1

### Commands

```bash
# 1. Create branch (after PR #1 is merged)
cd Shannon-main
git checkout main
git pull upstream main
git checkout -b add-tests-debug

# 2. Add the test file
cp /path/to/debug.test.ts observability/dashboard/lib/debug.test.ts
git add observability/dashboard/lib/debug.test.ts

# 3. Commit
git commit -F /path/to/COMMIT_MESSAGE.txt

# 4. Push to your fork
git push origin add-tests-debug

# 5. Create PR on GitHub
# Visit: https://github.com/YOUR_USERNAME/Shannon/pull/new/add-tests-debug
# Copy PR description from PR_DESCRIPTION.md
```

---

## Troubleshooting

### Issue: Tests fail with mock errors

**Possible causes**:
1. Config is read-only → Use type casting
2. Wrong console method → Check source code
3. Mock not being applied → Check vi.mock() syntax

### Issue: "unexpected console output"

**Solution**: Ensure `.mockImplementation(() => {})` is present on console spy

### Issue: Tests interfere with each other

**Solution**: Verify `vi.restoreAllMocks()` is called in `afterEach`

---

## Expected Timeline

- Step 1-3: **15 minutes** (verification and path fixes)
- Step 4: **10 minutes** (Jest conversion if needed)
- Step 5: **5 minutes** (quality checks)
- Step 6-7: **10 minutes** (PR creation)

**Total**: ~40 minutes

---

## Success Criteria

✅ All 9 tests pass  
✅ No linter/type errors  
✅ Console spy works correctly  
✅ Config mocking works  
✅ PR created with proper description  
✅ Ready for maintainer review

---

## Additional Notes

### Why Mock console.log?

Without mocking, the test output would be polluted with debug messages. The mock:
1. Prevents actual console output
2. Still allows us to verify the function was called
3. Keeps test output clean

### Why Test Both Scenarios?

Testing both `debug = true` and `debug = false` ensures:
1. The function logs when it should
2. The function is silent when it shouldn't
3. The conditional logic works correctly

---

**Good luck with your contribution!** 🎉






