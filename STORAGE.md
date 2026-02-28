# Local Storage Schema

This tool uses versioned local storage via `StorageVersionManager`. **If you modify the data structure stored in localStorage, you MUST update the schema version and add a migration.**

## Current Schema

**Key:** `payrollCheckerSaveSlots`
**Version:** 1

```javascript
[
    {
        id: string,              // Unique ID ('autosave' for auto-save slot, UUID for others)
        name: string,            // User-defined name
        savedAt: string,         // ISO date string
        config: {
            annualGross: number,
            expectedMonthlyGross: number,
            expectedWallet: number,
            tolerance: number,
            baseline: object | null,
            expectedNetPay: object,
            validationOverrides: object,
            compCategories: object,
            displayCurrency: string,
            eurToUsdRate: number,
            numberFormat: string
        },
        payslips: [
            {
                period: string,
                month: number,
                year: number,
                earnings: array,
                deductions: array,
                totals: object
            }
        ]
    }
]
```

## Other Storage Keys

- `payrollCheckerDisclaimerAccepted` - Simple boolean flag, not versioned (no complex structure)

## How to Make Schema Changes

1. **Bump the version number** in the schema definition
2. **Add a migration function** for the new version
3. **Update the default** if the structure changes

### Example: Adding a new field to config

```javascript
const payrollSaveSlotsSchema = StorageVersionManager.defineSchema('payrollCheckerSaveSlots', {
    version: 2,  // <-- Bumped from 1 to 2
    default: [],
    migrations: {
        1: (data) => {
            // ... existing v1 migration ...
        },
        // New migration for v2
        2: (data) => {
            return data.map(slot => ({
                ...slot,
                config: {
                    ...slot.config,
                    newField: 'default value'  // <-- Add new field
                }
            }));
        }
    }
});
```

### Example: Restructuring payslip data

```javascript
migrations: {
    // ... existing migrations ...
    3: (data) => {
        return data.map(slot => ({
            ...slot,
            payslips: slot.payslips.map(ps => ({
                ...ps,
                // Convert earnings from array to categorized object
                earningsByType: ps.earnings.reduce((acc, e) => {
                    acc[e.type] = acc[e.type] || [];
                    acc[e.type].push(e);
                    return acc;
                }, {})
            }))
        }));
    }
}
```

## Important Rules

1. **Never modify existing migrations** - they must remain stable for users with old data
2. **Always increment version by 1** - migrations run sequentially
3. **Test migrations** - load old data format and verify it migrates correctly
4. **Handle nested structures carefully** - this schema has deeply nested data
5. **Update this document** when you change the schema

## Files

- Schema definition: `index.html` (search for `payrollSaveSlotsSchema`)
- Version manager library: `../lib/storage-version-manager.js`
- Existing README: `README.md` (general usage documentation)
