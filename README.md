# Payroll Checker (Verificador de Nóminas)

A web-based Spanish payslip (nómina) verification tool. Inspired by [friscoMad/atpc](https://github.com/friscoMad/atpc).

## Core Principles

- **100% Local Processing** - All PDF parsing and calculations happen in the browser. No data is ever transmitted to any server.
- **Privacy First** - PII (names, DNI/NIE, filenames) is stripped from all saved data and never logged.
- **Bilingual** - Full English/Spanish support with option to show both languages side-by-side.

## Features

### PDF Parsing
- Parse Spanish payslip PDFs to extract earnings (devengos) and deductions (deducciones)
- Extract key totals: T. DEVENGADO, T. A DEDUCIR, Líquido a Percibir
- Extract bases: Base C.C., Base I.R.P.F.
- Handle password-protected PDFs
- Position-based column detection for accurate amount extraction

### Validation

#### Earnings Validation
- **Cuantía × Precio = Devengo** - Verify that quantity × unit price equals the earnings amount
  - Green ✓ if exact match
  - Yellow ✓ if within configured tolerance (shows calculated value on hover)
  - Red ⚠ if outside tolerance
- **Sum vs T. DEVENGADO** - Verify parsed earnings sum matches the payslip's T. DEVENGADO total
- **Wallet/Benefits Validation** - Compare against expected monthly amount from config

#### Deductions Validation
- **Tax Rate × Base = Deduction** - Verify percentage-based deductions are correctly calculated
  - Social Security contributions (Contingencias Comunes, MEI, Formación, Desempleo) validated against Base C.C.
  - IRPF validated against Base I.R.P.F.
  - Passed-on Income Tax (Imp. Ingr. Cta. Repercutidos) auto-detects its source earning
- **IRPF + Repercutidos Detection** - When IRPF appears lower than calculated, the tool checks if the difference equals the Passed-on Income Tax amount and shows "✓ (−Rep)" to indicate this is expected
- **Sum vs T. A DEDUCIR** - Verify parsed deductions sum matches the payslip's T. A DEDUCIR total
- **Hover tooltips** - All calculations show their formula on hover (e.g., "Base CC €X × 4.70% = €Y")

#### Net Pay Validation
- **Three-way comparison**:
  - **Calculated Net** - Sum of earnings minus sum of deductions (what we compute)
  - **Payslip Net** - Líquido a Percibir from the PDF (what the payslip says)
  - **Bank Net** - Actual deposit received (user input)
- **Validation indicators** - Green ✓ when calculated matches payslip, warning when discrepancy detected
- **Expandable details** - Click to see per-month breakdown with exact values and differences

#### Validation Overrides & Notes
- **Acknowledge mismatches** - Mark a discrepancy as reviewed (shows yellow ✓)
- **Flag for correction** - Mark items that need fixing (shows red ⚠)
- **Add notes** - Document explanations for any validation item
- **Status tracking** - Overall row status reflects override state:
  - Green ✓ - All OK
  - Yellow ✓ - Reviewed and acknowledged
  - Yellow ⚠ - Unreviewed issues
  - Red ⚠ - Needs correction

#### Annual Salary Projection
- **Base vs Additional Compensation** - Separates contract salary from benefits/variable compensation
- **Compensation Categories** - Configure which earnings are "additional" vs base:
  - Wallet Benefits
  - Awardco
  - Exempt/Taxable Insurance
  - RSUs / Stock Awards
  - ESPP
  - Bonuses
  - Other Benefits
- **Expected Monthly Amounts** - Set expected amount for each category
- **Benefit Start Dates** (Advanced) - Specify when each benefit started for accurate partial-year calculations
- **Prorate for partial years** - Automatically calculate expected earnings based on months employed
- **Extrapolate from payslips** - Project full year earnings from parsed data
- **Color-coded validation**:
  - Green ✓ if within tolerance
  - Yellow ⚠ if within tolerance + 1%
  - Red ⚠ if outside
- **Collapsible breakdowns** - Expand to see:
  - Expected additional compensation by category with monthly × months calculation
  - Parsed additional with comparison to expected, showing which items are accounted for

### Payslip Guide with Tooltips
- Info icon (i) next to each earnings/deductions item
- Hover to see explanation of what each item means
- Covers all common Spanish payslip elements:
  - Salario Base, Plus Convenio, Mejora Absorbible
  - Prorrata Pagas (extra pay proration)
  - Seguros Exentos/Sujetos (exempt/taxable insurance)
  - Social Security contributions (CC, MEI, FP, Desempleo)
  - IRPF withholding
  - In-kind deductions

### Display & Currency Options
- **Currency Conversion** - View amounts in EUR or USD
- **Configurable Exchange Rate** - Set EUR→USD rate manually or fetch current rate
- **Number Format** - Switch between European (1.234,56) and US (1,234.56) formatting

### Save System
- **Save Slots** - Multiple named save slots for different scenarios/years
- **Autosave** - Automatic saving of current session
- **Export/Import** - Download saves as JSON, import from file
- **PII Stripping** - Employee names, DNI, and filenames automatically removed from saved data

## Technical Details

### Libraries
- **PDF.js** - Mozilla's PDF parsing library (local copy, not CDN)
- All dependencies stored locally for offline use and security

### Supported Payslip Format
- Spanish nómina format with standard columns:
  - CUANTIA (quantity/days)
  - PRECIO (unit price)
  - CONCEPTO (concept name)
  - DEVENGOS (earnings)
  - DEDUCCIONES (deductions)

### Column Detection
- Uses x-position coordinates from PDF to accurately separate:
  - Earnings amounts (DEVENGOS column)
  - Deductions amounts (DEDUCCIONES column)
  - Cuantía and Precio values

## Configuration

### Basic Config
- Annual gross salary (from contract)
- Expected monthly wallet amount
- Tolerance % for validation

### Compensation Categories
- Checkbox to mark each category as "additional compensation"
- Expected monthly amount field for each
- Used to separate base salary from benefits in projections

### Advanced Config
- Benefit start dates - specify when each benefit started for accurate calculations when benefits begin mid-year
- Display currency (EUR/USD) with configurable exchange rate
- Number format (European/US)

## Future Improvements (TODOs)

### More Flexible Payslip Parsing
- Improve robustness of PDF text extraction
- Better handling of varying layouts and text positioning
- Fuzzy matching for concept names with typos or variations
- Handle multi-page payslips more reliably

### Support for Other Payslip Formats
- Pluggable parsing architecture for different payslip templates
- Support for payslips from different Spanish payroll providers
- Configurable column positions and field mappings
- Template detection to auto-select the right parser

### RSU (Restricted Stock Unit) Handling
- Track RSU vesting schedules and amounts
- Calculate tax implications of RSU vesting events
- Reconcile RSU income on payslip with vesting records
- Handle different tax treatment (income vs capital gains)
- Track cost basis for future sales

### Leave Management (Parental, Sick, etc.)
- Handle reduced pay during leave periods
- Track Social Security vs employer payments during leave
- Calculate expected pay adjustments for partial months
- Support for different leave types:
  - Parental leave (maternidad/paternidad)
  - Sick leave (incapacidad temporal)
  - Unpaid leave (excedencia)
- Validate government benefit payments vs payslip amounts

### ESPP (Employee Stock Purchase Plan) Tracking
- Track ESPP deductions from each payslip
- Accumulate contributions across purchase periods
- Reconcile purchases at end of period:
  - Verify purchase price calculation (typically 15% discount from lower of start/end price)
  - Track shares purchased vs contribution amount
  - Calculate and track refunds for unused contributions
- Validate refund amounts appear correctly on payslip
- Track cost basis for tax reporting
- Handle multiple concurrent ESPP enrollment periods

## Attribution

Inspired by [ATPC](https://github.com/friscoMad/atpc) by friscoMad.
