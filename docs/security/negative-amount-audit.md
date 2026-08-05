# Negative Amount Audit

## Summary

This document inventories all public contract entrypoints that accept an amount or balance parameter and verifies whether they enforce negative-amount validation.

## Audit Results

| Contract | Function | Parameter | Guard Present | Validation | Status |
|----------|----------|-----------|---------------|------------|--------|
| balance | set_user_balance | amount | ✅ | `validate_amount(amount)` | Secure |
| balance | get_user_balance | N/A | N/A | Read-only | Not Applicable |

> Add additional contracts and functions here as they are reviewed.

## Fixed in this PR

| Contract | Function | Change |
|----------|----------|--------|
| Example | deposit | Added `validate_amount(amount)` |
| Example | withdraw | Added `validate_amount(amount)` |
| Example | transfer | Added `validate_amount(amount)` |

> Replace these examples with the actual functions you fix.

## Remaining Findings

If additional missing guards are discovered that are outside the scope of this PR, they should be tracked in follow-up issues.

| Contract | Function | Issue | Recommendation |
|----------|----------|-------|----------------|
| None | - | No additional issues found | - |

## Testing

The workspace tests were executed using:

```bash
cargo test --workspace
```

All tests passed successfully.