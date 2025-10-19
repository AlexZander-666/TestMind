# Verification Guide for format.test.ts

## Pre-submission Checklist

Before submitting this PR to Shannon, please complete the following verification steps:

---

## Step 1: Verify Expected Values

The generated tests assume certain formatting behaviors. Please verify these assumptions by running the actual function:

### Quick Verification Script

```bash
cd Shannon-main/observability/dashboard
node --input-type=module << 'EOF'
import { formatTokensAbbrev } from './lib/format.js';

console.log('=== Verification Results ===\n');

// Test cases from the test file
const cases = [
  [null, '"0"'],
  [0, '"0"'],
  [-12345, '"0"'],
  [1, '"1"'],
  [123, '"123"'],
  [999, '"999"'],
  [1000, '"1K"'],
  [1500, '"1.5K"'],
  [1_000_000, '"1M"'],
  [1_500_000, '"1.5M"'],
  [1_000_000_000, '"1B"'],
  [1_000_000_000_000, '"1T"'],
];

cases.forEach(([input, expected]) => {
  const actual = formatTokensAbbrev(input);
  const status = actual === expected.replace(/"/g, '') ? '✅' : '❌';
  console.log(`${status} formatTokensAbbrev(${input}) => "${actual}" (expected: ${expected})`);
});
EOF
```

### Known Potential Issues

⚠️ **Case sensitivity**: Verify whether Shannon uses uppercase or lowercase for abbreviations:
- Expected in tests: `"1K"`, `"1M"`, `"1B"`, `"1T"` (uppercase)
- If Shannon uses: `"1k"`, `"1m"`, `"1b"`, `"1t"` (lowercase)
- **Action**: Update all expect() statements in the test file

⚠️ **Decimal places**: Tests assume 1 decimal place by default (e.g., `"1.5K"`)
- Verify this matches Shannon's actual behavior
- **Action**: Adjust expectations if different

⚠️ **Edge cases**: Verify how Shannon handles:
- Negative numbers (tests expect `"0"`)
- Very large numbers (> trillions)
- Decimal inputs (e.g., 999.9)

---

## Step 2: Run Tests Locally

```bash
cd Shannon-main/observability/dashboard

# Copy the test file
cp /path/to/format.test.ts lib/format.test.ts

# Run the tests
pnpm test lib/format.test.ts

# Expected output:
# ✓ formatTokensAbbrev (11 tests) 
# Tests: 11 passed (11 total)
```

### If Tests Fail

1. **Check the error message** - It will tell you which expectation failed
2. **Verify the actual behavior** - Use the verification script above
3. **Update the test expectations** - Modify the expect() statements to match actual behavior
4. **Re-run tests** - Ensure all 11 tests pass

---

## Step 3: Fix Import Path (if needed)

The test file assumes:
```typescript
import { formatTokensAbbrev } from '../../lib/format';
```

**Verify the correct path based on where you place the test:**

| Test Location | Correct Import |
|---------------|----------------|
| `lib/format.test.ts` | `import { formatTokensAbbrev } from './format';` |
| `__tests__/format.test.ts` | `import { formatTokensAbbrev } from '../lib/format';` |
| `lib/__tests__/format.test.ts` | `import { formatTokensAbbrev } from '../format';` |

**Action**: Update line 2 of the test file with the correct path.

---

## Step 4: Code Quality Check

Run Shannon's linter and type checker:

```bash
# Lint
pnpm lint lib/format.test.ts

# Type check
pnpm typecheck
```

**Fix any errors** before submitting the PR.

---

## Step 5: Final Review

### Checklist

- [ ] All 11 tests pass locally
- [ ] Import path is correct
- [ ] Expected values match actual behavior
- [ ] No linter errors
- [ ] No type errors
- [ ] Test file follows Shannon's conventions
- [ ] Commit message is descriptive
- [ ] PR description is complete

---

## Step 6: Create PR (Manual Process)

⚠️ **IMPORTANT**: Do NOT use automated scripts. Perform all Git operations manually.

### Commands

```bash
# 1. Create branch
cd Shannon-main
git checkout -b add-tests-format

# 2. Add the test file
cp /path/to/format.test.ts observability/dashboard/lib/format.test.ts
git add observability/dashboard/lib/format.test.ts

# 3. Commit (use the commit message from COMMIT_MESSAGE.txt)
git commit -F /path/to/COMMIT_MESSAGE.txt

# 4. Push to your fork
git push origin add-tests-format

# 5. Create PR on GitHub
# Visit: https://github.com/YOUR_USERNAME/Shannon/pull/new/add-tests-format
# Copy PR description from PR_DESCRIPTION.md
```

---

## Troubleshooting

### Issue: Tests fail with "Cannot find module"

**Solution**: Check the import path (Step 3)

### Issue: Expected values don't match

**Solution**: Run the verification script (Step 1) and update expectations

### Issue: TypeScript errors

**Possible causes**:
1. Missing type definition for `FormatAbbrevOptions`
   - **Fix**: Import it from the source file or define it locally
2. Wrong return type assumptions
   - **Fix**: Check the actual function signature

### Issue: Linter errors

**Common issues**:
- Missing semicolons (if Shannon uses them)
- Wrong indentation
- **Fix**: Run `pnpm lint --fix`

---

## Expected Timeline

- Step 1-3: **15 minutes** (verification and adjustments)
- Step 4: **5 minutes** (quality checks)
- Step 5-6: **10 minutes** (PR creation)

**Total**: ~30 minutes

---

## Success Criteria

✅ All 11 tests pass  
✅ No linter/type errors  
✅ PR created with proper description  
✅ Ready for maintainer review

---

## Contact

If you encounter issues during verification:
1. Check the generated test comments for hints
2. Review Shannon's existing test files for conventions
3. Document any deviations in the PR description

---

**Good luck with your contribution!** 🎉





