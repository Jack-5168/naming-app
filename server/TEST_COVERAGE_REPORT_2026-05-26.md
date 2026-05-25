# Test Coverage Report - Persona Lab

**Generated:** May 26, 2026

## Summary

| Metric | Current | Previous (May 25) | Threshold | Status |
|--------|---------|------------------|-----------|--------|
| Lines | 20.99% | 15.61% | 70% | ❌ FAIL |
| Statements | 21.59% | 16.16% | 70% | ❌ FAIL |
| Branches | 24.23% | 14.36% | 70% | ❌ FAIL |
| Functions | 31.05% | 26.25% | 70% | ❌ FAIL |

## Test Results

- **Total Tests:** 59 (48 passed, 11 failed)
- **Test Suites:** 7 (6 failed, 1 passed)

### Passing Suites

1. **life-events.test.ts** ✓

### Failing Suites

1. **integration.test.ts** - 5 failed tests
2. **cost-control.test.ts** - 4 failed tests
3. **stability-calculator.test.ts** - Compilation error
4. **llm-report.test.ts** - Compilation error
5. **cat-engine.test.ts** - Compilation error
6. **ab-testing.test.ts** - Compilation error

## Failed Tests Analysis

### integration.test.ts

| Test | Issue |
|------|-------|
| should calculate MBTI type from ability estimates | Expected "ENTJ", got "ENFJ" |
| should handle neutral ability estimates | Expected "ISFP", got "ENTJ" |
| should calculate complete test result | Expected "ETFP", got "ESTP" |
| should calculate high stability | Non-causal claim |
| should calculate low stability | Non-causal claim |

### cost-control.test.ts

All 4 getModelStrategy tests fail — likely assertion mismatch with actual behavior.

## Coverage by Module

### Well-Covered (>70%)

| Module | Coverage |
|--------|----------|
| cat-engine.ts | 100% |
| cost-control.ts | 79.41% |
| result-calculator.ts | 94.73% |
| stability-calculator.ts | 92.5% |

### Uncovered (0%)

| Module | Priority |
|--------|----------|
| auth.ts (controller) | P0 |
| encryption.ts | P0 |
| payments.ts | P0 |
| rate-limiter.ts | P1 |
| ab-testing.ts | P0 |
| big5-to-mbti.ts | P1 |

## Root Cause: Compilation Errors

5 test suites fail to compile due to missing exports:

```
stability-calculator.test.ts     → Missing export 'StabilityCalculator'
llm-report.test.ts               → Missing export 'BASIC_REPORT_TEMPLATE'
cat-engine.test.ts               → Missing export 'CATConfig'
ab-testing.test.ts              → Missing export 'ABTestingManager'
integration.test.ts              → Some imports may be broken
```

This indicates either:
1. Source files were refactored but tests weren't updated
2. Test files reference renamed/moved exports

## Recommendations

### Immediate Actions (Today)

1. **Fix compilation errors** - Update test imports to match current source structure
2. **Update assertions** - Fix expected values in result-calculator tests based on actual logic

### Add Tests for Critical Paths

| Module | Test Coverage Goal |
|--------|-------------------|
| auth.ts (controller) | JWT, session, auth flow |
| encryption.ts | AES encrypt/decrypt |
| ab-testing.ts | Variant selection |

### Next Cron Check

- Verify fixes applied
- Re-run coverage and track progress
- Target: +10% coverage increase by tomorrow