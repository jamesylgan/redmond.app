# Payroll Checker

A browser tool that checks Spanish payslips (nóminas), tracks RSU vests for people who moved from the US to Spain, estimates US and Spanish income tax for that situation, and tracks on-call overtime. It runs as a static site, with no server and no build step. Served at https://redmond.app.

This file explains how the code works. Other docs:

- [FEATURES.md](FEATURES.md): what the tool checks and how to configure it.
- [STORAGE.md](STORAGE.md): localStorage layout. It describes schema v1 and the code is now at v2, so read the schema definitions in `index.html` when in doubt.
- [lib/STORAGE-VERSION-MANAGER.md](lib/STORAGE-VERSION-MANAGER.md): the migration helper.

## Run it

```
python3 -m http.server 8000
# open http://localhost:8000
```

Serve it over http rather than opening the file directly. Some of the rate and price lookups are blocked from `file://`.

Deploying means serving the repo root as static files (GitHub Pages works). There is nothing to compile.

## Design in one paragraph

The whole app is one file, `index.html` (about 9,000 lines: CSS, HTML, and one large script). That was a deliberate choice: it can be copied, opened offline, and read top to bottom. State lives in three globals (`config`, `parsedPayslips`, `saveSlots`) plus a separate store for the on-call tracker. Rendering is string templates written into `innerHTML`. Calculations are mostly plain functions that take numbers and return numbers, which makes them easy to check in isolation.

```
 PDF files ──> PDF.js ──> text items with x/y ──> rows ──> concept table ──> payslip objects
                                                                                  │
 Configuration tab ──> config ────────────────────────────────────────────────────┤
 RSU grant table ──> vest events (US/Spain split) ────────────────────────────────┤
 On-call tracker (OC) ──> monthly on-call pay ────────────────────────────────────┘
                                                                                  │
                          displayResults() ──> checks, panels, Beckham analysis
                          US tax tab, Spain tax tab ──> read the same config + vest events
                                                                                  │
                          autosave ──> localStorage (save slots, PII removed)
```

## Code map

Line numbers drift. Search for the function name instead.

| Area | Where to look | What it does |
|---|---|---|
| Page switch | `switchPage`, `#payrollPage`, `#oncallPage` | Two apps share one page. The hash `#oncall` selects the on-call tracker. |
| Tabs | `activatePayrollTab` | Upload, Results, Configuration, Save Slots, Payslip Guide, Equity / US-ES, US Tax Estimate, Spain Tax Estimate. The last three only show in US/ES transfer mode. The active tab is kept in the URL hash and localStorage. |
| PDF parsing | `parsePayslips`, `parsePayslipPDF`, `groupIntoRows`, `parseSpanishNumber` | See "Parsing" below. |
| Concept table | `conceptDefs` inside `parsePayslipPDF`, `earningToCategory`, `itemExplanations` | Maps payslip line names to internal names and categories. |
| Results and checks | `displayResults`, `buildCrossValidationPanel`, `buildEquityOverview`, `buildOncallComparisonPanel` | Everything shown on the Results tab. |
| Beckham checks | `computeBeckhamOverWithholding`, the Beckham sections of `displayResults` and the cross-validation panel | Compares withheld IRPF with 24% of pay. |
| RSU model | `computeVestEvents`, `getRSUYearVests`, `renderRSUGrantsTable`, `renderVestPreview` | Vest schedule and US/Spain split. |
| RSU checks | `findMissingRSUVests`, `findSignificantDiscrepancies`, `computeRSUVestDetails` | Expected versus actual vests on payslips. |
| US tax tab | `computeUSTaxEstimate`, `prefillUSTaxFromConfig`, `US_*_2026` constants | Federal estimate with FTC and FEIE. |
| Spain tax tab | `esTaxCalc`, `computeESTaxEstimate`, `esEstimateWithheld`, `ES_*` constants | IRPF estimate, Beckham versus regular regime. |
| Income letter | `generateIncomeLetter`, `buildLetterContent` | Bilingual income summary letter. |
| Config and storage | `autoSaveConfig`, `applyConfigToUI`, `loadSaveSlots`, `saveToSlot`, `StorageVersionManager` | See "State and storage". |
| Network lookups | `fetchStockPrice`, `fetchEurUsdRate`, `fetchHistoricalEurRate`, `fetchHistoricalPrices` | See "Network calls". |
| On-call tracker | the `OC` module near the end of the script | Separate app with its own data store. |

## Parsing

PDF.js gives a flat list of text items, each with a string and a position. The parser rebuilds the table from the positions:

1. `parsePayslipPDF` collects `{str, x, y, page}` for every item on every page.
2. `groupIntoRows` sorts by page, then by y from top to bottom, and starts a new row when y changes by more than 3 units.
3. Each row is joined into text and tested against `conceptDefs`, a list of regexes such as `Salario Base` or `Imp. Ingr. Cta. Repercutidos`. A match decides the concept's English and Spanish names and whether it is an earning or a deduction.
4. The amount comes from the numeric items in the row. The x position decides the column: quantity, price, earnings, or deductions.
5. The totals row is read by x position (REM. TOTAL, BASE C.C., BASE I.R.P.F., T. DEVENGADO, T. A DEDUCIR), and the net pay is read from the rows after "Líquido a Percibir".
6. Rows with an amount that match no known concept go into `unparsedEarnings` and `unparsedDeductions`, so nothing disappears silently.
7. New payslips merge into `parsedPayslips`, replacing any payslip with the same month and year, then results are drawn and autosave runs.

This depends on one payslip layout, and the x positions are hard-coded. A different layout needs new column positions and possibly new concepts.

Amounts use Spanish number format (`1.234,56`), handled by `parseSpanishNumber`.

## Checks

`displayResults` draws one panel per payslip. The main checks are:

- Quantity times price equals the earning, within the configured tolerance.
- Sum of parsed earnings and deductions equals the payslip's own totals (T. DEVENGADO, T. A DEDUCIR). A mismatch usually means a line was missed or misread.
- Social Security deductions equal rate times base, using `SS_RATES` by year and `getExpectedSSRate`. IRPF equals its percentage times the IRPF base.
- Net pay is checked three ways: parsed, calculated, and expected.
- The cross-validation panel repeats the checks of a payroll spreadsheet (base IRPF, IRPF on cash, IRPF on in-kind pay).
- The Beckham analysis compares the IRPF actually withheld (plus passed-on tax) with 24% of cash and in-kind pay. `computeBeckhamOverWithholding` does this per payslip and is used by both the Results tab and the Spain tax tab. A payslip can be marked as "Beckham should not apply" and is then skipped.
- Expected additional pay (wallet, insurance, on-call, RSU) comes from the Configuration tab, with start months per category.

## State and storage

Globals:

- `config`: everything on the Configuration tab plus RSU data (grants, historical prices, withholding per vest, per-payslip Beckham settings). `autoSaveConfig` reads the form fields into `config`, and `applyConfigToUI` does the reverse.
- `parsedPayslips`: parsed payslip objects for this session.
- `saveSlots`: named snapshots of config plus payslips, with one slot (`autosave`) rewritten after every parse or config change.

localStorage keys:

| Key | Content |
|---|---|
| `payrollCheckerSaveSlots` | Save slots, versioned through `StorageVersionManager` (schema v2). |
| `oncall-tracker` | On-call data, versioned (schema v3). |
| `payroll_historicalEurRates` | Cached daily EUR rates. |
| `payroll_activeTab`, `oncall_activeTab` | Last open tab. |
| `payrollCheckerDisclaimerAccepted` | Disclaimer flag. |

Payslips are stored without PII. The saved copy keeps only period, earnings, deductions, unparsed lines and totals. Names, DNI/NIE and filenames are not saved.

`lib/storage-version-manager.js` wraps localStorage with a schema version and a migration per version. Changing the shape of stored data means bumping `version` in the schema and adding a migration, otherwise existing users' saved data breaks.

Storage is per browser and per origin. Data saved on another domain (for example the old bellevue.tech copy) is not visible here. Use the Save Slots tab to export from the old site and import here, or export a full backup.

## RSU model

RSU income is split between the US and Spain by workdays, following the rule that income is sourced where the work was done between grant and vest.

- The grant table (Configuration tab) holds grant date, shares, vesting schedule, cliff and shares already vested.
- `computeVestEvents` builds the vest dates (`getFixedVestDates`) and, for each vest, counts weekdays from grant date to vest date (`countWeekdays`, vest day included) and how many of those fall before the transfer date. That gives `usPct` and `spainPct` per vest, so every vest has its own split.
- Value per vest is shares times the price on the vest date (`rsuHistoricalPrices`, falling back to the current price), converted to EUR with the configured rate.
- `getRSUYearVests(year)` returns the per-vest rows for a year. Both tax tabs, the vest preview and the equity overview use these same rows, so the tabs cannot disagree about the split.
- On the payslip side, the Spain-sourced share is what should appear as RSU in-kind income. `findMissingRSUVests` and `findSignificantDiscrepancies` compare the schedule with the parsed payslips, and the Results tab has an acknowledge panel to dismiss known differences.

The RSU validation mode (Normal, Exclude, US-ES Transfer) controls whether RSU lines enter the checks and whether the Equity and tax tabs appear.

## Tax estimate tabs

Both tabs are estimates, labelled as such in the UI. Constants are named so they can be updated each year:

- US: `US_TAX_BRACKETS_2026`, `US_STANDARD_DEDUCTION_2026`, `US_FEIE_LIMIT_2026`.
- Spain: `ES_STATE_SCALE`, `ES_REGION_SCALES`, `ES_PERSONAL_MINIMUM`, `ES_WORK_EXPENSES`, `ES_BECKHAM_CAP`, `ES_SS_MAX_BASE_2026`, `SS_RATES`.

**US tab.** `computeUSTaxEstimate` defines one function, `usScenario(filing, strategy)`, that returns tax, foreign tax credit and balance for a filing status (MFJ or MFS) and strategy (FTC only, or FEIE plus FTC). The headline numbers and the four-way comparison table both come from it. FEIE uses the stacking rule (tax on full income minus tax on the excluded amount). The credit limit is tax times foreign-source income divided by AGI, and Spanish tax allocable to excluded income is not credited.

**Spain tab.** `esTaxCalc` is a pure function that returns both regimes from the same inputs:

- Beckham: 24% up to EUR 600,000 and 47% above, on Spain-sourced income only (salary plus the Spain-sourced share of each vest), with no deductions.
- Regular resident: worldwide employment income, minus Social Security and EUR 2,000 of expenses, taxed on a state scale plus an autonomous scale, minus the tax on the personal minimum. It supports the 30% irregular-income reduction per vest (grant to vest over two years) and a credit for US tax on US-sourced RSUs.

The "Spanish tax withheld" figure comes from `esEstimateWithheld`: IRPF and passed-on tax on payslips so far, plus every month without a payslip at a projected rate (24% under Beckham), including the Spain-sourced share of any vest in those months. For Beckham, the over-withholding card shows over-withholding so far, the projected rest of year, and the full-year refund on Modelo 151.

**Connection.** The Spain tab can send its tax to the US tab as "Spanish taxes paid" (`sendESTaxToUSTab`). Under the regular regime the US and Spanish credits depend on each other, and the tool does not iterate that, so the result is approximate.

## On-Call Tracker

The `OC` object is a self-contained module with its own schema (`oncall-tracker`), its own tabs (Calendar, Log, Monthly, Yearly) and its own rendering. It models rotations, daily stipends, PTO, incident responses (with a live timer), overtime pay and an annual cap, using Madrid holidays. The payroll side calls `getOncallCompForPayslip(month, year)` to compare expected on-call pay with the payslip when "include on-call" is enabled.

## Language

Labels use `data-i18n` keys with `translations.en` and `translations.es`. `applyTranslations` fills them, and "Both" mode shows English and Spanish together. Results panels call `t(key)`. Some guide entries and the tax tabs are English only.

## Network calls and privacy

Payslip PDFs and parsed values are never sent anywhere. The tool does make lookups for market data, and these requests contain only a ticker, a date or a currency code:

| Purpose | Service |
|---|---|
| Current EUR/USD | open.er-api.com |
| Historical EUR rates | api.vatcomply.com, cdn.jsdelivr.net (currency-api) |
| Share price | Yahoo Finance, with a Google Finance page fetched through the allorigins.win proxy as a fallback |

All lookups are optional. The matching fields can be filled in by hand, and the tool works offline once loaded.

The page sets `noindex` and related meta tags so it is not indexed.

## Making changes

- New payslip line: add a pattern to `conceptDefs`, a category in `earningToCategory` if it counts toward expected pay, an explanation in `itemExplanations`, and a Payslip Guide entry. Add it to the "known rows" pattern in the unparsed-row filter if it should not be flagged.
- New tax year: update the constants listed above and check them against the official tables.
- New stored field: add it to `autoSaveConfig`, `applyConfigToUI` and the storage schema. If the shape of stored data changes, bump the schema version and add a migration.
- Logic worth testing in isolation: `esTaxCalc`, `esScaleTax`, `computeVestEvents`, `computeBeckhamOverWithholding`, and the `usScenario` closure. There is no test suite. The usual check is to copy the function into a Node script with a stubbed `document` and `config`.

## Known limitations

- One file, global state, no automated tests.
- The parser fits one payslip layout (hard-coded x positions).
- `computeVestEvents` parses grant and transfer dates as UTC, which can shift a vest by a day in US timezones. It is fine in Spain.
- Tax tabs cover employment income only (no savings income, wealth tax or most deductions) and are rough estimates. They are not tax advice.
- The Madrid scale and the 2026 Social Security base were checked against secondary sources, so confirm them before relying on the numbers.

## Attribution

Inspired by [ATPC](https://github.com/friscoMad/atpc) by Ramiro Aparicio (friscoMad). Payroll validation logic is based on Franco Albareti's payslip checking spreadsheet.
