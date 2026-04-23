# IDSO Data Catalog

Machine-generated inventory of all BigQuery datasets and tables in the `reconciliation-dashboard` project, merged with human-curated descriptions from `docs/catalog-descriptions.yaml`. The IDSO app generator reads this catalog at plan time so it can ground generated apps in real tables and columns.

**DO NOT EDIT MANUALLY.** Regenerate with `scripts/refresh-catalog.sh` (pulls fresh schemas) or `node scripts/build-catalog.js` (rebuild from existing schemas + descriptions).

- Project: `reconciliation-dashboard`
- Generated: 2026-04-23T02:38:52.454Z
- Datasets: 5
- Tables: 80
- Columns (flattened): 764

## Datasets

### `ADP_system` (6 tables)

ADP payroll and HR data. Ingested from ADP Workforce Now exports. Covers
payroll line items (every pay stub row), employee dimension (roster with
department / job title / cost center), and timecards. Use this for any
question about compensation, headcount, hours worked, or allocations of
payroll to departments / cost centers / GL accounts.

#### `ADP_system.adp_payroll_output`

Payroll fact table: one row per employee per pay-period per pay
category (earnings, deductions, taxes). Includes pay period start/end,
payment date, employee name, department, business unit, job title,
location, and GL account code. This is the primary source for
"what did we pay whom, when, and for what GL line."

_102,447 rows, 32 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `item_id` | STRING | NULLABLE |  |
| `payroll_group` | STRING | NULLABLE |  |
| `payroll_group_name` | STRING | NULLABLE |  |
| `payroll_year` | INTEGER | NULLABLE |  |
| `payroll_week` | INTEGER | NULLABLE |  |
| `pay_period_start` | DATE | NULLABLE |  |
| `pay_period_end` | DATE | NULLABLE |  |
| `payment_date` | DATE | NULLABLE |  |
| `associate_oid` | STRING | NULLABLE |  |
| `employee_name` | STRING | NULLABLE |  |
| `department_code` | STRING | NULLABLE |  |
| `business_unit_code` | STRING | NULLABLE |  |
| `job_title` | STRING | NULLABLE |  |
| `ids_location_id` | STRING | NULLABLE |  |
| `gl_category` | STRING | NULLABLE |  |
| `gross_earnings` | FLOAT | NULLABLE |  |
| `regular_earnings` | FLOAT | NULLABLE |  |
| `overtime_earnings` | FLOAT | NULLABLE |  |
| `bonus_earnings` | FLOAT | NULLABLE |  |
| `other_earnings` | FLOAT | NULLABLE |  |
| `hours_worked` | FLOAT | NULLABLE |  |
| `hourly_rate` | FLOAT | NULLABLE |  |
| `pay_basis` | STRING | NULLABLE |  |
| `net_payment` | FLOAT | NULLABLE |  |
| `employer_fica_ss` | FLOAT | NULLABLE |  |
| `employer_fica_med` | FLOAT | NULLABLE |  |
| `employer_futa` | FLOAT | NULLABLE |  |
| `employer_sui` | FLOAT | NULLABLE |  |
| `employer_total_taxes` | FLOAT | NULLABLE |  |
| `ingested_at` | TIMESTAMP | NULLABLE |  |
| `run_status` | STRING | NULLABLE |  |
| `composite_key` | STRING | NULLABLE |  |

#### `ADP_system.employees_dim`

Active employee dimension: one row per employee with current
identifying and HR attributes (name, email, hire/termination date,
employment status, job title, department, cost center, GL account).
Join on employee_id from adp_payroll_output or timecards_dim.

_4,577 rows, 14 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `employee_id` | STRING | REQUIRED |  |
| `first_name` | STRING | NULLABLE |  |
| `last_name` | STRING | NULLABLE |  |
| `email` | STRING | NULLABLE |  |
| `hire_date` | DATE | NULLABLE |  |
| `termination_date` | DATE | NULLABLE |  |
| `employment_status` | STRING | NULLABLE |  |
| `job_title` | STRING | NULLABLE |  |
| `department` | STRING | NULLABLE |  |
| `cost_center_code` | STRING | NULLABLE |  |
| `gl_account_code` | STRING | NULLABLE |  |
| `created_date` | TIMESTAMP | NULLABLE |  |
| `modified_date` | TIMESTAMP | NULLABLE |  |
| `_load_timestamp` | TIMESTAMP | NULLABLE |  |

#### `ADP_system.employees_dim_staging`

Staging copy of employees_dim used during the ADP sync pipeline. Do
not query directly for reporting; use employees_dim instead.

_4,577 rows, 14 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `employee_id` | STRING | REQUIRED |  |
| `first_name` | STRING | NULLABLE |  |
| `last_name` | STRING | NULLABLE |  |
| `email` | STRING | NULLABLE |  |
| `hire_date` | DATE | NULLABLE |  |
| `termination_date` | DATE | NULLABLE |  |
| `employment_status` | STRING | NULLABLE |  |
| `job_title` | STRING | NULLABLE |  |
| `department` | STRING | NULLABLE |  |
| `cost_center_code` | STRING | NULLABLE |  |
| `gl_account_code` | STRING | NULLABLE |  |
| `created_date` | TIMESTAMP | NULLABLE |  |
| `modified_date` | TIMESTAMP | NULLABLE |  |
| `_load_timestamp` | TIMESTAMP | NULLABLE |  |

#### `ADP_system.payroll_sync_state`

Operational bookkeeping for the ADP payroll sync pipeline (last
processed item, batch cursors). Not useful for business reporting.

_1 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sync_entity` | STRING | NULLABLE |  |
| `last_processed_item_id` | STRING | NULLABLE |  |
| `last_processed_skip` | INTEGER | NULLABLE |  |
| `total_processed_all_time` | INTEGER | NULLABLE |  |
| `updated_timestamp` | TIMESTAMP | NULLABLE |  |

#### `ADP_system.sync_metadata`

Operational bookkeeping for the ADP sync pipeline (run-level status,
batch counts, timestamps). Not useful for business reporting.

_2 rows, 6 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sync_entity` | STRING | REQUIRED |  |
| `last_modified_timestamp` | TIMESTAMP | NULLABLE |  |
| `last_checked_timestamp` | TIMESTAMP | NULLABLE |  |
| `batch_count` | INTEGER | NULLABLE |  |
| `sync_status` | STRING | NULLABLE |  |
| `updated_timestamp` | TIMESTAMP | NULLABLE |  |

#### `ADP_system.timecards_dim`

Timecard facts: one row per employee per pay period with total hours
worked. Join to employees_dim on employee_id for name / department
context. Empty or near-empty for salaried employees.

_0 rows, 8 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `timecard_id` | STRING | NULLABLE | Unique ID: associateOID_periodStartDate |
| `employee_id` | STRING | NULLABLE | ADP associateOID |
| `period_start_date` | DATE | NULLABLE | Period start date |
| `period_end_date` | DATE | NULLABLE | Period end date |
| `hours_worked` | NUMERIC | NULLABLE | Hours worked |
| `total_hours` | NUMERIC | NULLABLE | Total hours |
| `_load_timestamp` | TIMESTAMP | NULLABLE | Load timestamp |
| `_load_id` | STRING | NULLABLE | Load batch ID |

### `Dentira_system` (7 tables)

Dentira dental-supplies e-procurement data. Ingested from the Dentira
platform that IDSO practices use to order dental supplies, equipment,
and services from vendors. Covers invoices, orders, line items, the
practice catalog, and the supplier / vendor catalog. Use this for
supply-chain spend, vendor performance, supplier consolidation, and
practice-level ordering analysis.

#### `Dentira_system.dentira_invoice_items`

Supplier invoice line items: one row per line on each invoice with
SKU, item name, unit price, quantity, total, and GL account code.
Join to dentira_invoices on invoice_number.

_31,085 rows, 25 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `load_id` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `invoice_number` | STRING | NULLABLE |  |
| `supplier_id` | STRING | NULLABLE |  |
| `sku` | STRING | NULLABLE |  |
| `item_name` | STRING | NULLABLE |  |
| `unit_price` | FLOAT | NULLABLE |  |
| `quantity` | FLOAT | NULLABLE |  |
| `total` | FLOAT | NULLABLE |  |
| `gl_code` | STRING | NULLABLE |  |
| `account_code_parent_id` | STRING | NULLABLE |  |
| `account_code_location_id` | STRING | NULLABLE |  |
| `account_code_account` | STRING | NULLABLE |  |
| `supplier_name` | STRING | NULLABLE |  |
| `vendor_id` | STRING | NULLABLE |  |
| `source_file` | STRING | NULLABLE |  |
| `processed_date` | TIMESTAMP | NULLABLE |  |
| `invoice_date` | STRING | NULLABLE |  |
| `invoice_received_date` | STRING | NULLABLE |  |
| `order_item_received_date` | STRING | NULLABLE |  |
| `invoice_due_date` | STRING | NULLABLE |  |
| `order_date` | STRING | NULLABLE |  |
| `invoice_status` | STRING | NULLABLE |  |
| `payment_status` | STRING | NULLABLE |  |
| `account_code` | STRING | NULLABLE |  |

#### `Dentira_system.dentira_invoices`

Supplier invoice headers: one row per invoice received through
Dentira. Includes invoice number, date, status, supplier, vendor,
clinic/practice, and vendor/supplier cross-references.

_3,558 rows, 14 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `load_id` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `invoice_number` | STRING | NULLABLE |  |
| `supplier_id` | STRING | NULLABLE |  |
| `supplier_name` | STRING | NULLABLE |  |
| `clinic_name` | STRING | NULLABLE |  |
| `email` | STRING | NULLABLE |  |
| `invoice_date` | STRING | NULLABLE |  |
| `invoice_type` | STRING | NULLABLE |  |
| `status` | STRING | NULLABLE |  |
| `vendor_id` | STRING | NULLABLE |  |
| `total_amount` | FLOAT | NULLABLE |  |
| `source_file` | STRING | NULLABLE |  |
| `load_timestamp` | TIMESTAMP | NULLABLE |  |

#### `Dentira_system.dentira_load_audit`

Operational bookkeeping for the Dentira ingestion pipeline (load
timestamps, row counts, error messages, load status). Not useful
for business reporting.

_12 rows, 11 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `load_id` | STRING | NULLABLE |  |
| `source_file` | STRING | NULLABLE |  |
| `upload_timestamp` | TIMESTAMP | NULLABLE |  |
| `load_start` | TIMESTAMP | NULLABLE |  |
| `load_end` | TIMESTAMP | NULLABLE |  |
| `status` | STRING | NULLABLE |  |
| `row_count` | INTEGER | NULLABLE |  |
| `rows_inserted` | INTEGER | NULLABLE |  |
| `rows_updated` | INTEGER | NULLABLE |  |
| `error_message` | STRING | NULLABLE |  |
| `processing_duration_seconds` | FLOAT | NULLABLE |  |

#### `Dentira_system.dentira_orders`

Supplier order headers (purchase orders placed through Dentira). One
row per order with practice, supplier, vendor, order date, received
date, status, approver, and catalog flags.

_2,658 rows, 20 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `location_id` | STRING | NULLABLE |  |
| `po_id` | STRING | NULLABLE |  |
| `clinic_name` | STRING | NULLABLE |  |
| `email` | STRING | NULLABLE |  |
| `order_date` | STRING | NULLABLE |  |
| `received_date` | STRING | NULLABLE |  |
| `status` | STRING | NULLABLE |  |
| `supplier_name` | STRING | NULLABLE |  |
| `vendor_id` | STRING | NULLABLE |  |
| `order_type` | STRING | NULLABLE |  |
| `orderer_name` | STRING | NULLABLE |  |
| `orderer_email` | STRING | NULLABLE |  |
| `order_approver` | STRING | NULLABLE |  |
| `is_dentira_order` | BOOLEAN | NULLABLE |  |
| `is_off_catalog` | BOOLEAN | NULLABLE |  |
| `is_trusted` | BOOLEAN | NULLABLE |  |
| `total_amount` | FLOAT | NULLABLE |  |
| `source_file` | STRING | NULLABLE |  |
| `load_id` | STRING | NULLABLE |  |
| `load_timestamp` | TIMESTAMP | NULLABLE |  |

#### `Dentira_system.dentira_orders_items`

Order line items: one row per line on each purchase order with
product, item name, UOM, category, manufacturer, unit price,
ordered quantity, received quantity, and total.

_19,355 rows, 26 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `location_id` | STRING | NULLABLE |  |
| `po_id` | STRING | NULLABLE |  |
| `unspsc` | STRING | NULLABLE |  |
| `supplier_product_id` | STRING | NULLABLE |  |
| `item_name` | STRING | NULLABLE |  |
| `supplier_name` | STRING | NULLABLE |  |
| `supplier_id` | STRING | NULLABLE |  |
| `uom` | STRING | NULLABLE |  |
| `category` | STRING | NULLABLE |  |
| `manufacturer_name` | STRING | NULLABLE |  |
| `unit_price` | FLOAT | NULLABLE |  |
| `ordered_quantity` | FLOAT | NULLABLE |  |
| `received_quantity` | FLOAT | NULLABLE |  |
| `total` | FLOAT | NULLABLE |  |
| `gl_code` | STRING | NULLABLE |  |
| `source_file` | STRING | NULLABLE |  |
| `load_id` | STRING | NULLABLE |  |
| `processed_date` | TIMESTAMP | NULLABLE |  |
| `order_date` | STRING | NULLABLE |  |
| `status` | STRING | NULLABLE |  |
| `manufacturer_id` | STRING | NULLABLE |  |
| `invoice_number` | STRING | NULLABLE |  |
| `invoice_date` | STRING | NULLABLE |  |
| `invoice_status` | STRING | NULLABLE |  |
| `vendor_id` | STRING | NULLABLE |  |
| `supplier` | STRING | NULLABLE |  |

#### `Dentira_system.dentira_practices`

Practice (clinic) dimension for Dentira: location_id, clinic name,
email. Small lookup table used to join orders / invoices to a
practice.

_86 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `location_id` | STRING | NULLABLE |  |
| `clinic_name` | STRING | NULLABLE |  |
| `email` | STRING | NULLABLE |  |

#### `Dentira_system.dentira_suppliers`

Supplier / vendor dimension: supplier_id, supplier name, vendor_id,
vendor_name, vendor_alias. Lookup for Dentira orders and invoices.

_79 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `supplier_id` | STRING | NULLABLE |  |
| `supplier_name` | STRING | NULLABLE |  |
| `vendor_id` | STRING | NULLABLE |  |
| `vendor_alias` | STRING | NULLABLE |  |

### `PMS_system` (48 tables)

Practice-Management-System payment transactions AND the reconciliation
engine that matches them to the bank side. PMSTxn holds dental
insurance carrier payments, patient payments, and other receipts that
were recorded in the practice-management system. The rest of the
dataset (ReconBatches, BatchRankings, Criteria*_Candidates, FuzzyMap,
LLM_BatchPayload, LLM_RankResults, Match_Config, Reconciliations,
StrictMatch) is the IDSO-built ML/LLM pipeline that matches each PMS
payment to the corresponding bank deposit in Sage Intacct. Use PMSTxn
for PMS-side revenue questions; use Reconciliations or Reconciliation_view
for "what got matched vs. what is still open."

#### `PMS_system.AcceptedMatches`

Historical record of matches that were accepted (by human or auto-rule) in the reconciliation workflow. Join to PMSTxn and BankTxn on MatchID to get the matched pair. Status / UndoneBy / UndoReason let you see matches that were later reversed.

_67 rows, 10 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `MatchID` | STRING | REQUIRED |  |
| `BankTxn` | STRING | REQUIRED |  |
| `PMSTxn` | STRING | REQUIRED |  |
| `AcceptedBatchID` | STRING | REQUIRED |  |
| `Status` | STRING | REQUIRED |  |
| `AcceptedBy` | STRING | REQUIRED |  |
| `AcceptedAt` | TIMESTAMP | REQUIRED |  |
| `UndoneAt` | TIMESTAMP | NULLABLE |  |
| `UndoneBy` | STRING | NULLABLE |  |
| `UndoReason` | STRING | NULLABLE |  |

#### `PMS_system.AuditLogs`

Append-only audit trail of user actions in the reconciliation dashboard: who did what (Action, EntityType, EntityID), when, from which IP, with changes and notes. Use for compliance, forensics, and "who changed X" questions.

_82 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `AuditID` | STRING | REQUIRED |  |
| `Action` | STRING | REQUIRED |  |
| `EntityType` | STRING | REQUIRED |  |
| `EntityID` | STRING | REQUIRED |  |
| `UserEmail` | STRING | REQUIRED |  |
| `Timestamp` | TIMESTAMP | REQUIRED |  |
| `Changes` | JSON | NULLABLE |  |
| `Notes` | STRING | NULLABLE |  |
| `IPAddress` | STRING | NULLABLE |  |

#### `PMS_system.BankList_FuzzyNorm`

Fuzzy-normalised bank payer list with PMS mapping candidates and soundex/phonetic keys (n2, n3). Input to the fuzzy matcher.

_841 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Payer_Name_Description` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |
| `n2` | STRING | NULLABLE |  |
| `s2` | STRING | NULLABLE |  |

#### `PMS_system.BankPayerList_Normalized`

_842 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Payer_Name_Description` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |
| `normalized_list` | STRING | NULLABLE |  |
| `soundex_list` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn`

Raw bank transactions as ingested (before normalisation). One row per bank line with Bank_Transaction_ID, Date, Transaction_Type, Payment_Description, Amount, Status, Bank_Acct_No, location_id, payer_name, pms_mapping. This is the PMS_system view of the bank side; see Sage_system_v2.sage_bank_transactions_v2 for the canonical Sage export.

_48,865 rows, 14 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Date` | DATE | NULLABLE |  |
| `Transaction_Type` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `Amount` | NUMERIC | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `pms_mapping` | STRING | NULLABLE |  |
| `ID` | STRING | NULLABLE |  |
| `Location` | STRING | NULLABLE |  |
| `ContentHash` | STRING | NULLABLE |  |
| `sage_description` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_CSV_files_Upload_Log`

Per-file upload audit for bank CSVs: filename, Bank_Acct_No, inserted_rows, skipped_loan_sweep_rows, processed_at, LogID. Operational only.

_3,759 rows, 7 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `FileName` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `Inserted_Rows` | INTEGER | NULLABLE |  |
| `Skipped_Loan_Sweep_Rows` | INTEGER | NULLABLE |  |
| `Processed_At` | TIMESTAMP | NULLABLE |  |
| `ID` | STRING | NULLABLE |  |
| `LogID` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_CleanTemp`

Temporary table used by the bank-txn cleaning step. Not authoritative.

_48,865 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `payer_clean` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_Excluded_Archive`

Bank transactions explicitly excluded from reconciliation (loans, sweeps, transfers). Kept for audit so exclusions are reversible.

_19,446 rows, 12 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Date` | DATE | NULLABLE |  |
| `Transaction_Type` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `Amount` | NUMERIC | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `pms_mapping` | STRING | NULLABLE |  |
| `ID` | STRING | NULLABLE |  |
| `Location` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_FuzzyNorm`

Fuzzy-normalised BankTxn with phonetic / soundex keys (n1, s1) for the fuzzy matcher. Intermediate; do not query for reporting.

_1,052 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `n1` | STRING | NULLABLE |  |
| `s1` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_MapFuzzy`

Per-row mapping result from the fuzzy matcher (ID -> PMS_Mapping). Intermediate.

_0 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_MapStrict`

Per-row mapping result from the strict matcher (ID -> PMS_Mapping). Intermediate.

_0 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_MapTemp`

Temporary mapping table during BankTxn processing. Intermediate.

_63 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_Normalized`

_63 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `normalized_desc` | STRING | NULLABLE |  |
| `soundex_desc` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_RematchTemp`

Temporary working table used when re-running the matcher against a bounded subset of bank txns. Intermediate.

_1 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_Staging`

Staging copy of BankTxn before it is promoted to BankTxn / BankTxn_Normalised. Includes __insertIdContentHash for dedupe. Operational only.

_0 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Date` | DATE | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `Amount` | NUMERIC | NULLABLE |  |
| `Transaction_Type` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `FileName` | STRING | NULLABLE |  |
| `__insertIdContentHash` | STRING | NULLABLE |  |

#### `PMS_system.Bank_Payer_List` _(EXTERNAL)_

Raw observed-bank-payer list (Payer_Name_Description + PMS_Mapping) before normalisation. Superseded by BankPayersList_Normalised.

_0 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Payer_Name_Description` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.Bank_Transaction_Timing` _(EXTERNAL)_

Mapping rules that classify bank txns by PMS_Mapping + priority date windows (+ exclude dates, possible merchant fee). Used by the matcher to enforce business-day windows.

_0 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `PMS_Mappings` | STRING | NULLABLE |  |
| `Priority_Date` | INTEGER | NULLABLE |  |
| `Exclude_Date` | STRING | NULLABLE |  |
| `Possible_Merchant_Fee` | FLOAT | NULLABLE |  |

#### `PMS_system.Bank_Transaction_Timing_BQ`

Profiling / timing metadata for SageIntacct_BankTransactions loads.
Operational only.

_56 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `PMS_Mappings` | STRING | NULLABLE |  |
| `Priority_Date` | INTEGER | NULLABLE |  |
| `Exclude_Date` | STRING | NULLABLE |  |
| `Possible_Merchant_Fee` | FLOAT | NULLABLE |  |

#### `PMS_system.BatchDecisions`

Per-batch decision outcomes: DecisionID, Decision, DecisionBy,
DecisionAt, Reason. Links the human/LLM approval to a batch.

_0 rows, 7 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `DecisionID` | STRING | REQUIRED |  |
| `BatchID` | STRING | REQUIRED |  |
| `BankTxn` | STRING | REQUIRED |  |
| `Decision` | STRING | REQUIRED |  |
| `DecisionBy` | STRING | REQUIRED |  |
| `DecisionAt` | TIMESTAMP | REQUIRED |  |
| `Reason` | STRING | NULLABLE |  |

#### `PMS_system.BatchRankings`

Per-batch candidate rankings produced by the matching engine, with
rank, confidence, and LLM rationale. Drives which candidates get
surfaced first in the review UI.

_0 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BatchID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `Criteria` | STRING | NULLABLE |  |
| `Rank` | INTEGER | NULLABLE |  |
| `Confidence` | STRING | NULLABLE |  |
| `RankedBy` | STRING | NULLABLE |  |
| `RankedAt` | TIMESTAMP | NULLABLE |  |
| `Notes` | STRING | NULLABLE |  |
| `LLMRationale` | STRING | NULLABLE |  |

#### `PMS_system.Criteria1_Candidates`

Candidate PMS-Bank pairs generated by matching rule set 1 (typically
exact amount + date proximity). Consumed by the downstream ranking /
batching logic.

_0 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BankTxn` | STRING | NULLABLE |  |
| `PMSTxn` | STRING | NULLABLE |  |
| `AmountApplied` | NUMERIC | NULLABLE |  |
| `BankDate` | DATE | NULLABLE |  |
| `PMSDate` | DATE | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `pms_mapping` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |
| `business_day_diff` | INTEGER | NULLABLE |  |

#### `PMS_system.Criteria2_Candidates`

Candidate PMS-Bank pairs generated by matching rule set 2 (looser
date window, partial description match).

_0 rows, 21 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `BankDate` | DATE | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `pms_mapping` | STRING | NULLABLE |  |
| `BankAmount` | NUMERIC | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `Transactions_ID` | STRING | NULLABLE |  |
| `PMSDate` | DATE | NULLABLE |  |
| `PMSAmount` | NUMERIC | NULLABLE |  |
| `AmountApplied` | NUMERIC | NULLABLE |  |
| `PracticeID` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |
| `Payment_type` | STRING | NULLABLE |  |
| `Carrier_name` | STRING | NULLABLE |  |
| `Patient_Full_Name` | STRING | NULLABLE |  |
| `Payment_Code_ID` | STRING | NULLABLE |  |
| `custom_type` | STRING | NULLABLE |  |
| `Claim_id` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `business_day_diff` | INTEGER | NULLABLE |  |

#### `PMS_system.Criteria3_Candidates`

Candidate PMS-Bank pairs generated by matching rule set 3 (fuzzy /
multi-field).

_0 rows, 21 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `BankDate` | DATE | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `pms_mapping` | STRING | NULLABLE |  |
| `BankAmount` | NUMERIC | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `Transactions_ID` | STRING | NULLABLE |  |
| `PMSDate` | DATE | NULLABLE |  |
| `PMSAmount` | NUMERIC | NULLABLE |  |
| `AmountApplied` | NUMERIC | NULLABLE |  |
| `PracticeID` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |
| `Payment_type` | STRING | NULLABLE |  |
| `Carrier_name` | STRING | NULLABLE |  |
| `Patient_Full_Name` | STRING | NULLABLE |  |
| `Payment_Code_ID` | STRING | NULLABLE |  |
| `custom_type` | STRING | NULLABLE |  |
| `Claim_id` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `business_day_diff` | INTEGER | NULLABLE |  |

#### `PMS_system.DailyReconciliationSummary`

Daily rollup of reconciliation status: per-day counts of matched /
unmatched / reviewed pairs. Drives the ops dashboard KPIs.

_1 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `run_date` | DATE | NULLABLE |  |
| `total_inserts` | INTEGER | NULLABLE |  |
| `matched_count` | INTEGER | NULLABLE |  |
| `unmatched_count` | INTEGER | NULLABLE |  |
| `last_insert_time` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.FuzzyMap`

Fuzzy-match lookup table between PMS and bank payer strings (carrier
name variants, payer aliases). Used to bridge spelling / formatting
differences before candidate ranking.

_1,052 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.LLM_BatchPayload`

Raw input payload sent to the LLM for each reconciliation batch
(candidates + context). Useful for replaying or debugging AI
decisions.

_0 rows, 6 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BatchID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `Criteria` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |
| `PayloadJSON` | STRING | NULLABLE |  |

#### `PMS_system.LLM_RankResults`

Raw LLM ranking output per batch: ranked candidates with confidence
and rationale. Joined into BatchRankings for downstream use.

_5 rows, 15 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ResultID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `Criteria` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |
| `SchemaVersion` | STRING | NULLABLE |  |
| `Model` | STRING | NULLABLE |  |
| `PromptVersion` | STRING | NULLABLE |  |
| `InputPayloadJSON` | STRING | NULLABLE |  |
| `OutputJSON` | STRING | NULLABLE |  |
| `ChosenBatchIDs` | STRING | REPEATED |  |
| `Rankings` | RECORD | REPEATED |  |
| `Rankings.BatchID` | STRING | NULLABLE |  |
| `Rankings.Rank` | INTEGER | NULLABLE |  |
| `Rankings.Confidence` | STRING | NULLABLE |  |
| `Rankings.Rationale` | STRING | NULLABLE |  |

#### `PMS_system.Match_Config`

Configuration for the matching engine: per-channel tolerance cents,
business-day windows, criteria toggles. Edit here to tune the
matcher without code changes.

_194 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Channel` | STRING | NULLABLE |  |
| `ToleranceCents` | INTEGER | NULLABLE |  |
| `BusinessDayWindow` | INTEGER | NULLABLE |  |

#### `PMS_system.PMSTxn`

Raw payment transactions from practice-management systems. One row
per payment: carrier_name, claim_id, amount, practice_id,
payment_type, status, bank_vendor, PMS_Date. This is the PMS side
of reconciliation (vs. SageIntacct_BankTransactions on the bank
side).

_1,477,731 rows, 13 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Transactions_ID` | STRING | NULLABLE |  |
| `Patient_Full_Name` | STRING | NULLABLE |  |
| `Date_of_Transaction` | DATE | NULLABLE |  |
| `Payment_Code_ID` | STRING | NULLABLE |  |
| `custom_type` | STRING | NULLABLE |  |
| `Amount` | NUMERIC | NULLABLE |  |
| `PracticeID` | STRING | NULLABLE |  |
| `Claim_id` | STRING | NULLABLE |  |
| `Carrier_name` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `Payment_type` | STRING | NULLABLE |  |
| `claim` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |

#### `PMS_system.PMS_Criteria2`

PMS-side intermediate used by the Criteria 2 matcher. Aggregates
PMS transactions by practice / vendor / payment type before
candidate generation.

_0 rows, 7 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `PracticeID` | STRING | NULLABLE |  |
| `Payment_type` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |
| `bank_vendor_norm` | STRING | NULLABLE |  |
| `PMS_Date` | DATE | NULLABLE |  |
| `Total_PMS_Amount` | NUMERIC | NULLABLE |  |
| `PMS_Transactions_List` | STRING | REPEATED |  |

#### `PMS_system.ReconBatchItems`

Items (candidate PMS x Bank pairs) inside each reconciliation batch
with status, AI flag, flag reason, and computed flag fields. Join
to ReconBatches on BatchID.

_18,320 rows, 10 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BatchItemID` | STRING | NULLABLE |  |
| `BatchID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `PMSTxn` | STRING | NULLABLE |  |
| `AmountApplied` | NUMERIC | NULLABLE |  |
| `PMSDate` | DATE | NULLABLE |  |
| `Vendor` | STRING | NULLABLE |  |
| `IsFlagged` | BOOLEAN | NULLABLE |  |
| `FlagReason` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.ReconBatchItems_UI`

UI-facing view of ReconBatchItems for the reconciliation dashboard.

_0 rows, 12 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BatchItemID` | STRING | NULLABLE |  |
| `BatchID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `PMSTxn` | STRING | NULLABLE |  |
| `AmountApplied` | NUMERIC | NULLABLE |  |
| `PMSDate` | DATE | NULLABLE |  |
| `Vendor` | STRING | NULLABLE |  |
| `IsFlagged` | BOOLEAN | NULLABLE |  |
| `FlagReason` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |
| `ComputedIsFlagged` | BOOLEAN | NULLABLE |  |
| `ComputedFlagReason` | STRING | NULLABLE |  |

#### `PMS_system.ReconBatches`

Batches of reconciliation candidates produced by the matching engine.
One row per batch run; join to ReconBatchItems for the items
inside each batch.

_3,946 rows, 15 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BatchID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `Criteria` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `Rank` | INTEGER | NULLABLE |  |
| `Confidence` | STRING | NULLABLE |  |
| `CreatedBy` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |
| `Notes` | STRING | NULLABLE |  |
| `LLMRationale` | STRING | NULLABLE |  |
| `RejectedBy` | STRING | NULLABLE |  |
| `RejectedAt` | DATE | NULLABLE |  |
| `UpdatedBy` | STRING | NULLABLE |  |
| `UpdatedAt` | DATE | NULLABLE |  |
| `ModificationAction` | STRING | NULLABLE |  |

#### `PMS_system.ReconBatches_UI`

UI-facing view of ReconBatches, same shape with formatting /
labels tuned for the internal reconciliation dashboard app.

_0 rows, 14 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BatchID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `Criteria` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `Rank` | INTEGER | NULLABLE |  |
| `Confidence` | STRING | NULLABLE |  |
| `CreatedBy` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |
| `Notes` | STRING | NULLABLE |  |
| `LLMRationale` | STRING | NULLABLE |  |
| `UpdatedBy` | STRING | NULLABLE |  |
| `UpdatedAt` | DATE | NULLABLE |  |
| `ModificationAction` | STRING | NULLABLE |  |
| `ComputedStatus` | STRING | NULLABLE |  |

#### `PMS_system.ReconCheckpoint`

Checkpoint markers for long-running reconciliation jobs (last
processed bank txn id). Operational only.

_1 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `checkpoint_name` | STRING | NULLABLE |  |
| `last_banktxn_id` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.ReconciliationApprovals`

Approval audit trail for reconciliations: who approved which
batch/txn, when, and any attached notes.

_2 rows, 6 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `BankTxnId` | STRING | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `ApprovedBy` | STRING | NULLABLE |  |
| `ApprovedAt` | TIMESTAMP | NULLABLE |  |
| `Notes` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.Reconciliation_view2`

Convenience view that joins Reconciliations back to the underlying
PMS and bank rows (with location, practice, amount, carrier). Use
for reporting when you need the matched pair plus context in one
row.

_0 rows, 11 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Bank_Date` | DATE | NULLABLE |  |
| `PMS_Date` | DATE | NULLABLE |  |
| `Bank_side_Vendor` | STRING | NULLABLE |  |
| `PMS_side_Vendor` | STRING | NULLABLE |  |
| `Payment_type` | STRING | NULLABLE |  |
| `Bank_Amount` | NUMERIC | NULLABLE |  |
| `Total_PMS_Amount` | NUMERIC | NULLABLE |  |
| `PracticeID` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `business_day_diff` | INTEGER | NULLABLE |  |

#### `PMS_system.Reconciliations`

Authoritative match results: one row per reconciled pair
(PMS payment x Bank transaction) with amount applied, created/updated
timestamps, status, modification history, and rejection reason.
Start here for "what is matched, what is still open" questions.

_914 rows, 16 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ReconID` | STRING | NULLABLE |  |
| `BankTxn` | STRING | NULLABLE |  |
| `PMSTxn` | STRING | NULLABLE |  |
| `AmountApplied` | NUMERIC | NULLABLE |  |
| `CreatedBy` | STRING | NULLABLE |  |
| `CreatedAt` | TIMESTAMP | NULLABLE |  |
| `UpdatedBy` | STRING | NULLABLE |  |
| `UpdatedAt` | TIMESTAMP | NULLABLE |  |
| `Status` | STRING | NULLABLE |  |
| `IsActive` | BOOLEAN | NULLABLE |  |
| `ModificationAction` | STRING | NULLABLE |  |
| `ModificationTimestamp` | TIMESTAMP | NULLABLE |  |
| `OriginalReconID` | STRING | NULLABLE |  |
| `RejectedBy` | STRING | NULLABLE |  |
| `RejectedAt` | DATE | NULLABLE |  |
| `Notes` | STRING | NULLABLE |  |

#### `PMS_system.SageIntacct_BankTransactions`

Bank-side view of transactions exported from Sage Intacct, filtered
and enriched for the matching engine. One row per bank line with
account, posting date, amount, payer, description, and transaction
type. Pair with PMSTxn for reconciliation queries.

_0 rows, 16 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `account_type` | STRING | NULLABLE |  |
| `bank_account_id` | STRING | REQUIRED |  |
| `bank_name` | STRING | NULLABLE |  |
| `posting_date` | DATE | REQUIRED |  |
| `document_type` | STRING | NULLABLE |  |
| `match_sequence` | STRING | NULLABLE |  |
| `document_number` | STRING | REQUIRED |  |
| `currency` | STRING | NULLABLE |  |
| `amount` | NUMERIC | REQUIRED |  |
| `payee` | STRING | NULLABLE |  |
| `description` | STRING | NULLABLE |  |
| `transaction_type` | STRING | NULLABLE |  |
| `reconciliation_status` | STRING | NULLABLE |  |
| `amount_to_match` | NUMERIC | NULLABLE |  |
| `etl_loaded_at` | TIMESTAMP | REQUIRED |  |
| `etl_source` | STRING | REQUIRED |  |

#### `PMS_system.StrictMatch`

Strict exact-match candidates (amount + date + identifier equality).
Highest-confidence subset, usually auto-approved.

_98 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.clean_txn`

Cleaned / normalised copy of PMSTxn and bank rows used as the input
to the matching pipeline. Do not query for reporting; use PMSTxn
or SageIntacct_BankTransactions.

_583 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `desc_clean` | STRING | NULLABLE |  |
| `extracted_payer` | STRING | NULLABLE |  |

#### `PMS_system.final_cleaned_result`

Final cleaned output of the reconciliation pipeline for a run.
Typically consumed by downstream dashboards.

_583 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `match_source` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |

#### `PMS_system.location_id_mapping` _(EXTERNAL)_

Mapping from raw PMS location identifiers to IDSO location_id. Used
to normalise practice-level keys across PMS vendors.

_0 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Location` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |

#### `PMS_system.location_xwalk`

Cross-walk between bank-account-level location identifiers and PMS
location_id. Joins bank rows (where only an account is present) to
a practice.

_17 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `bank_location_id` | STRING | NULLABLE |  |
| `pms_practice_id` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.mapping_norm`

Normalised payer-name -> canonical-vendor mapping used by the
fuzzy matcher. Regenerated from dim_mappings.bank_description_*.

_837 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Payer_Name_Description` | STRING | NULLABLE |  |
| `norm_full_key` | STRING | NULLABLE |  |
| `norm_fuzzy_key` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.sage_bank_account_mapping`

Bank account id (Sage) -> practice / entity mapping. Same idea as
location_xwalk but at the bank-account grain.

_0 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sage_bank_account_id` | STRING | REQUIRED |  |
| `bank_acct_no` | STRING | NULLABLE |  |
| `location_id` | STRING | REQUIRED |  |
| `Location` | STRING | REQUIRED |  |

#### `PMS_system.transaction_types_custom_categories_raw` _(EXTERNAL)_

User-defined overrides for transaction type / category classification
used in reconciliation. Tweak here to reclassify payment types.

_0 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `category` | STRING | NULLABLE |  |
| `description` | STRING | NULLABLE |  |
| `ledger_category` | STRING | NULLABLE |  |
| `name` | STRING | NULLABLE |  |
| `remote_id` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `location_name` | STRING | NULLABLE |  |
| `approval_status` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |

#### `PMS_system.update_mapped`

Audit log of mapping-table updates (when a cross-walk row was added
or edited, by whom).

_583 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `extracted_payer` | STRING | NULLABLE |  |
| `mapped_pms` | STRING | NULLABLE |  |

### `Sage_system_v2` (9 tables)

Sage Intacct general ledger and bank data. This is the authoritative
accounting source: every GL journal entry line and every bank-side
transaction as booked in Sage. Join gl_journal_entry_lines to the
dim_* columns to slice by department, location, vendor, customer,
project, employee, item, or class. Use for any finance, close,
cash-flow, or revenue-by-dimension question.

#### `Sage_system_v2.bank_id_practice_mapping`

Bank account -> practice crosswalk at the Sage level. Join
sage_bank_transactions_v2.bank_account_id to get a practice_id.

_72 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `bank_account_id` | STRING | NULLABLE |  |
| `practice_name` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `Sage_system_v2.bank_transaction_summaries`

Rolled-up bank transaction summaries (by bank, day, and posting
status). Faster for dashboards than scanning the raw txn table.

_0 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sage_key` | STRING | REQUIRED |  |
| `id` | STRING | NULLABLE |  |
| `href` | STRING | NULLABLE |  |
| `posting_date` | DATE | NULLABLE |  |
| `fetched_at` | TIMESTAMP | REQUIRED |  |

#### `Sage_system_v2.entry_tracking`

Tracking table: which GL journal entries have been picked up by
downstream pipelines (reconciliation, reporting). Operational only.

_0 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sage_key` | STRING | REQUIRED |  |
| `posting_date` | DATE | NULLABLE |  |
| `last_updated` | TIMESTAMP | NULLABLE |  |
| `fetched_at` | TIMESTAMP | REQUIRED |  |

#### `Sage_system_v2.gl_journal_entry_lines`

The GL fact: one row per journal-entry line with GL account, debit/
credit amount, dimension keys (department, location, vendor,
customer, project, employee, item, class), currency, and
reconciliation status. The primary source for financial reporting.

_967,036 rows, 45 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `id` | STRING | REQUIRED |  |
| `key` | INTEGER | REQUIRED |  |
| `lineNumber` | INTEGER | NULLABLE |  |
| `txnType` | STRING | NULLABLE |  |
| `entryDate` | DATE | NULLABLE |  |
| `state` | STRING | NULLABLE |  |
| `description` | STRING | NULLABLE |  |
| `baseAmount` | FLOAT | NULLABLE |  |
| `txnAmount` | FLOAT | NULLABLE |  |
| `numberOfUnits` | FLOAT | NULLABLE |  |
| `glAccount_id` | STRING | NULLABLE |  |
| `glAccount_key` | INTEGER | NULLABLE |  |
| `glAccount_name` | STRING | NULLABLE |  |
| `journalEntry_id` | STRING | NULLABLE |  |
| `journalEntry_key` | INTEGER | NULLABLE |  |
| `dimension_department_id` | STRING | NULLABLE |  |
| `dimension_location_id` | STRING | NULLABLE |  |
| `dimension_location_name` | STRING | NULLABLE |  |
| `dimension_vendor_id` | STRING | NULLABLE |  |
| `dimension_vendor_name` | STRING | NULLABLE |  |
| `dimension_customer_id` | STRING | NULLABLE |  |
| `dimension_customer_name` | STRING | NULLABLE |  |
| `dimension_project_id` | STRING | NULLABLE |  |
| `dimension_project_name` | STRING | NULLABLE |  |
| `dimension_employee_id` | STRING | NULLABLE |  |
| `dimension_employee_name` | STRING | NULLABLE |  |
| `dimension_item_id` | STRING | NULLABLE |  |
| `dimension_item_name` | STRING | NULLABLE |  |
| `dimension_class_id` | STRING | NULLABLE |  |
| `dimension_class_name` | STRING | NULLABLE |  |
| `currency_baseCurrency` | STRING | NULLABLE |  |
| `currency_txnCurrency` | STRING | NULLABLE |  |
| `currency_exchangeRate` | FLOAT | NULLABLE |  |
| `currency_exchangeRateDate` | STRING | NULLABLE |  |
| `reconciliation_cleared` | BOOLEAN | NULLABLE |  |
| `reconciliation_clearingDate` | STRING | NULLABLE |  |
| `reconciliation_reconciliationDate` | STRING | NULLABLE |  |
| `isBillable` | BOOLEAN | NULLABLE |  |
| `isBilled` | BOOLEAN | NULLABLE |  |
| `createdDateTime` | STRING | NULLABLE |  |
| `modifiedDateTime` | STRING | NULLABLE |  |
| `createdBy` | STRING | NULLABLE |  |
| `modifiedBy` | STRING | NULLABLE |  |
| `etl_loaded_at` | STRING | NULLABLE |  |
| `etl_source` | STRING | NULLABLE |  |

#### `Sage_system_v2.sage_bank_transactions_v2`

Bank-side transactions as exported from Sage Intacct bank feeds.
One row per bank line with account, posting date, amount, payer,
description. Pairs with PMS_system.PMSTxn in the reconciliation
pipeline.

_89,207 rows, 17 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `composite_key` | STRING | NULLABLE |  |
| `account_type` | STRING | NULLABLE |  |
| `bank_account_id` | STRING | NULLABLE |  |
| `bank_name` | STRING | NULLABLE |  |
| `posting_date` | DATE | NULLABLE |  |
| `document_type` | STRING | NULLABLE |  |
| `match_sequence` | STRING | NULLABLE |  |
| `document_number` | STRING | NULLABLE |  |
| `currency` | STRING | NULLABLE |  |
| `amount` | FLOAT | NULLABLE |  |
| `payee` | STRING | NULLABLE |  |
| `description` | STRING | NULLABLE |  |
| `transaction_type` | STRING | NULLABLE |  |
| `reconciliation_status` | STRING | NULLABLE |  |
| `amount_to_match` | FLOAT | NULLABLE |  |
| `etl_loaded_at` | TIMESTAMP | NULLABLE |  |
| `etl_source` | STRING | NULLABLE |  |

#### `Sage_system_v2.sync_metadata`

Operational bookkeeping for the Sage sync pipeline. Not for
reporting.

_569 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sync_name` | STRING | REQUIRED |  |
| `last_sync_time` | TIMESTAMP | NULLABLE |  |
| `sync_completed_at` | TIMESTAMP | REQUIRED |  |
| `created_at` | TIMESTAMP | REQUIRED |  |

#### `Sage_system_v2.sync_state`

Operational sync cursor for bank-side rows. Not for reporting.

_1 rows, 7 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `id` | STRING | NULLABLE |  |
| `last_posting_date` | DATE | NULLABLE |  |
| `last_key` | STRING | NULLABLE |  |
| `last_sync_time` | TIMESTAMP | NULLABLE |  |
| `batch_number` | INTEGER | NULLABLE |  |
| `records_loaded_total` | INTEGER | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `Sage_system_v2.sync_state_gl`

Operational sync cursor for GL rows. Not for reporting.

_1 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `id` | STRING | REQUIRED |  |
| `last_key` | INTEGER | NULLABLE |  |
| `batch_number` | INTEGER | NULLABLE |  |
| `records_loaded_total` | INTEGER | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `Sage_system_v2.temp_gl_lines_1773341871`

Temporary scratch table from a specific GL backfill run (suffix is
the run id). Not authoritative; do not query for reporting.

_250 rows, 45 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `id` | STRING | NULLABLE |  |
| `key` | INTEGER | NULLABLE |  |
| `lineNumber` | INTEGER | NULLABLE |  |
| `txnType` | STRING | NULLABLE |  |
| `entryDate` | DATE | NULLABLE |  |
| `state` | STRING | NULLABLE |  |
| `description` | STRING | NULLABLE |  |
| `baseAmount` | FLOAT | NULLABLE |  |
| `txnAmount` | FLOAT | NULLABLE |  |
| `numberOfUnits` | FLOAT | NULLABLE |  |
| `glAccount_id` | STRING | NULLABLE |  |
| `glAccount_key` | INTEGER | NULLABLE |  |
| `glAccount_name` | STRING | NULLABLE |  |
| `journalEntry_id` | STRING | NULLABLE |  |
| `journalEntry_key` | INTEGER | NULLABLE |  |
| `dimension_department_id` | STRING | NULLABLE |  |
| `dimension_location_id` | STRING | NULLABLE |  |
| `dimension_location_name` | STRING | NULLABLE |  |
| `dimension_vendor_id` | STRING | NULLABLE |  |
| `dimension_vendor_name` | STRING | NULLABLE |  |
| `dimension_customer_id` | STRING | NULLABLE |  |
| `dimension_customer_name` | STRING | NULLABLE |  |
| `dimension_project_id` | STRING | NULLABLE |  |
| `dimension_project_name` | STRING | NULLABLE |  |
| `dimension_employee_id` | STRING | NULLABLE |  |
| `dimension_employee_name` | STRING | NULLABLE |  |
| `dimension_item_id` | STRING | NULLABLE |  |
| `dimension_item_name` | STRING | NULLABLE |  |
| `dimension_class_id` | STRING | NULLABLE |  |
| `dimension_class_name` | STRING | NULLABLE |  |
| `currency_baseCurrency` | STRING | NULLABLE |  |
| `currency_txnCurrency` | STRING | NULLABLE |  |
| `currency_exchangeRate` | FLOAT | NULLABLE |  |
| `currency_exchangeRateDate` | STRING | NULLABLE |  |
| `reconciliation_cleared` | BOOLEAN | NULLABLE |  |
| `reconciliation_clearingDate` | STRING | NULLABLE |  |
| `reconciliation_reconciliationDate` | STRING | NULLABLE |  |
| `isBillable` | BOOLEAN | NULLABLE |  |
| `isBilled` | BOOLEAN | NULLABLE |  |
| `createdDateTime` | STRING | NULLABLE |  |
| `modifiedDateTime` | STRING | NULLABLE |  |
| `createdBy` | STRING | NULLABLE |  |
| `modifiedBy` | STRING | NULLABLE |  |
| `etl_loaded_at` | STRING | NULLABLE |  |
| `etl_source` | STRING | NULLABLE |  |

### `dim_mappings` (10 tables)

Shared dimension / lookup tables used across the other datasets
(especially PMS_system's reconciliation engine). Bank-description
parsing rules, payment-category mappings, bank-vendor rules, and
PMS provider / location mappings. Treat as slowly-changing reference
data. Backup tables ("..._backup_YYYYMMDD") are point-in-time
snapshots retained for audit; use the non-backup version for current
lookups.

#### `dim_mappings.bank_account_mapping`

Canonical map from bank_account_id -> practice_name / location_id /
updated_by / updated_at. Used to put a practice label on any bank
row.

_176 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `bank_account_id` | STRING | REQUIRED |  |
| `practice_name` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |
| `updated_by` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |

#### `dim_mappings.bank_description_mapping`

Rules that parse a raw bank transaction description into vendor /
category / is_carrier flag / approval status. Used by PMS_system
fuzzy matching.

_70,292 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `description` | STRING | REQUIRED |  |
| `parsed_vendor` | STRING | REQUIRED |  |
| `category` | STRING | REQUIRED |  |
| `is_carrier` | BOOLEAN | REQUIRED |  |
| `status` | STRING | REQUIRED |  |
| `approved_by` | STRING | REQUIRED |  |
| `approved_at` | TIMESTAMP | REQUIRED |  |
| `created_at` | TIMESTAMP | REQUIRED |  |
| `updated_at` | TIMESTAMP | REQUIRED |  |

#### `dim_mappings.bank_description_mapping_backup_20260409`

Point-in-time snapshot of bank_description_mapping taken 2026-04-09.
Audit only.

_65,876 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `description` | STRING | NULLABLE |  |
| `parsed_vendor` | STRING | NULLABLE |  |
| `category` | STRING | NULLABLE |  |
| `is_carrier` | BOOLEAN | NULLABLE |  |
| `status` | STRING | NULLABLE |  |
| `approved_by` | STRING | NULLABLE |  |
| `approved_at` | TIMESTAMP | NULLABLE |  |
| `created_at` | TIMESTAMP | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `dim_mappings.bank_description_mapping_backup_20260410`

Point-in-time snapshot of bank_description_mapping taken 2026-04-10.
Audit only.

_65,876 rows, 9 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `description` | STRING | NULLABLE |  |
| `parsed_vendor` | STRING | NULLABLE |  |
| `category` | STRING | NULLABLE |  |
| `is_carrier` | BOOLEAN | NULLABLE |  |
| `status` | STRING | NULLABLE |  |
| `approved_by` | STRING | NULLABLE |  |
| `approved_at` | TIMESTAMP | NULLABLE |  |
| `created_at` | TIMESTAMP | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `dim_mappings.bank_description_staging`

Staging area for proposed bank_description_mapping changes before
they get promoted to the live table. Includes confidence,
first_seen_at, processed_at.

_59,121 rows, 6 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `description` | STRING | REQUIRED |  |
| `parsed_vendor` | STRING | NULLABLE |  |
| `suggested_category` | STRING | NULLABLE |  |
| `confidence` | STRING | REQUIRED |  |
| `first_seen_at` | TIMESTAMP | REQUIRED |  |
| `processed_at` | TIMESTAMP | REQUIRED |  |

#### `dim_mappings.bank_vendor_rules`

Prefix / vendor rules table: maps raw description prefixes to
canonical vendors. Paired with bank_description_mapping for
bank-side normalisation.

_9,565 rows, 6 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `prefix` | STRING | REQUIRED |  |
| `vendor` | STRING | REQUIRED |  |
| `category` | STRING | REQUIRED |  |
| `added_by` | STRING | REQUIRED |  |
| `created_at` | TIMESTAMP | REQUIRED |  |
| `updated_at` | TIMESTAMP | REQUIRED |  |

#### `dim_mappings.payment_category_mapping`

Maps normalised payment types to a GL category / ledger category,
scoped by location and vendor. Drives auto-categorisation of
incoming bank rows.

_1,181 rows, 11 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `category` | STRING | REQUIRED |  |
| `description` | STRING | REQUIRED |  |
| `ledger_category` | STRING | NULLABLE |  |
| `name` | STRING | NULLABLE |  |
| `remote_id` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `approval_status` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |
| `created_at` | DATE | NULLABLE |  |
| `updated_at` | DATE | NULLABLE |  |
| `updated_by` | STRING | NULLABLE |  |

#### `dim_mappings.payment_category_mapping_backup_20260409`

Point-in-time snapshot of payment_category_mapping taken
2026-04-09. Audit only.

_1,181 rows, 11 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `category` | STRING | NULLABLE |  |
| `description` | STRING | NULLABLE |  |
| `ledger_category` | STRING | NULLABLE |  |
| `name` | STRING | NULLABLE |  |
| `remote_id` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `approval_status` | STRING | NULLABLE |  |
| `bank_vendor` | STRING | NULLABLE |  |
| `created_at` | DATE | NULLABLE |  |
| `updated_at` | DATE | NULLABLE |  |
| `updated_by` | STRING | NULLABLE |  |

#### `dim_mappings.pms_location_mapping`

Location dimension enriched from the PMS side: location_id,
location_name, regional grouping, deal name, full name, PMS name,
updated_by. Used to label PMS rows with the standard IDSO
location hierarchy.

_49 rows, 12 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `location_id` | STRING | REQUIRED |  |
| `location_name` | STRING | NULLABLE |  |
| `regional` | STRING | NULLABLE |  |
| `location_name_full` | STRING | NULLABLE |  |
| `deal` | STRING | NULLABLE |  |
| `pms` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |
| `updated_by` | STRING | NULLABLE |  |
| `address_1` | STRING | NULLABLE |  |
| `address_2` | STRING | NULLABLE |  |
| `state` | STRING | NULLABLE |  |
| `zip` | STRING | NULLABLE |  |

#### `dim_mappings.pms_provider_mapping`

Provider (doctor / hygienist) dimension from the PMS side:
location_id, location_name, provider_name, position, updated_by,
additional_data. Use for provider-level reporting such as
"production by doctor."

_8,011 rows, 12 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `display_name` | STRING | NULLABLE |  |
| `name` | STRING | NULLABLE |  |
| `remote_id` | STRING | REQUIRED |  |
| `type` | STRING | NULLABLE |  |
| `update_time` | TIMESTAMP | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |
| `location_name` | STRING | NULLABLE |  |
| `provider_name` | STRING | NULLABLE |  |
| `position` | STRING | NULLABLE |  |
| `additional_data` | JSON | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |
| `updated_by` | STRING | NULLABLE |  |
