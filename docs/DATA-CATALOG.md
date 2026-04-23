# IDSO Data Catalog

Machine-generated inventory of all BigQuery datasets and tables in the `reconciliation-dashboard` project. The IDSO app generator reads this catalog at plan time so it can ground generated apps in real tables and columns instead of hallucinating them.

**DO NOT EDIT MANUALLY.** Regenerate with `scripts/refresh-catalog.sh`.

- Project: `reconciliation-dashboard`
- Generated: 2026-04-23T01:56:34.072Z
- Datasets: 5
- Tables: 80
- Columns (flattened): 764

## Datasets

### `ADP_system` (6 tables)

#### `ADP_system.adp_payroll_output`

> ADP payroll output - one row per employee × payment × department allocation
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

_1 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sync_entity` | STRING | NULLABLE |  |
| `last_processed_item_id` | STRING | NULLABLE |  |
| `last_processed_skip` | INTEGER | NULLABLE |  |
| `total_processed_all_time` | INTEGER | NULLABLE |  |
| `updated_timestamp` | TIMESTAMP | NULLABLE |  |

#### `ADP_system.sync_metadata`

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

#### `Dentira_system.dentira_invoice_items`

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

_86 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `location_id` | STRING | NULLABLE |  |
| `clinic_name` | STRING | NULLABLE |  |
| `email` | STRING | NULLABLE |  |

#### `Dentira_system.dentira_suppliers`

_79 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `supplier_id` | STRING | NULLABLE |  |
| `supplier_name` | STRING | NULLABLE |  |
| `vendor_id` | STRING | NULLABLE |  |
| `vendor_alias` | STRING | NULLABLE |  |

### `PMS_system` (48 tables)

#### `PMS_system.AcceptedMatches`

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

_48,865 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `payer_clean` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_Excluded_Archive`

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

_1,052 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `n1` | STRING | NULLABLE |  |
| `s1` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_MapFuzzy`

_0 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_MapStrict`

_0 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_MapTemp`

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

_1 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.BankTxn_Staging`

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

_0 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Payer_Name_Description` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.Bank_Transaction_Timing` _(EXTERNAL)_

_0 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `PMS_Mappings` | STRING | NULLABLE |  |
| `Priority_Date` | INTEGER | NULLABLE |  |
| `Exclude_Date` | STRING | NULLABLE |  |
| `Possible_Merchant_Fee` | FLOAT | NULLABLE |  |

#### `PMS_system.Bank_Transaction_Timing_BQ`

_56 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `PMS_Mappings` | STRING | NULLABLE |  |
| `Priority_Date` | INTEGER | NULLABLE |  |
| `Exclude_Date` | STRING | NULLABLE |  |
| `Possible_Merchant_Fee` | FLOAT | NULLABLE |  |

#### `PMS_system.BatchDecisions`

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

_1 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `run_date` | DATE | NULLABLE |  |
| `total_inserts` | INTEGER | NULLABLE |  |
| `matched_count` | INTEGER | NULLABLE |  |
| `unmatched_count` | INTEGER | NULLABLE |  |
| `last_insert_time` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.FuzzyMap`

_1,052 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.LLM_BatchPayload`

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

_194 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Channel` | STRING | NULLABLE |  |
| `ToleranceCents` | INTEGER | NULLABLE |  |
| `BusinessDayWindow` | INTEGER | NULLABLE |  |

#### `PMS_system.PMSTxn`

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

_1 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `checkpoint_name` | STRING | NULLABLE |  |
| `last_banktxn_id` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.ReconciliationApprovals`

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

_98 rows, 2 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `ID` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.clean_txn`

_583 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `desc_clean` | STRING | NULLABLE |  |
| `extracted_payer` | STRING | NULLABLE |  |

#### `PMS_system.final_cleaned_result`

_583 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `match_source` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |

#### `PMS_system.location_id_mapping` _(EXTERNAL)_

_0 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Location` | STRING | NULLABLE |  |
| `Bank_Acct_No` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |

#### `PMS_system.location_xwalk`

_17 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `bank_location_id` | STRING | NULLABLE |  |
| `pms_practice_id` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `PMS_system.mapping_norm`

_837 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Payer_Name_Description` | STRING | NULLABLE |  |
| `norm_full_key` | STRING | NULLABLE |  |
| `norm_fuzzy_key` | STRING | NULLABLE |  |
| `PMS_Mapping` | STRING | NULLABLE |  |

#### `PMS_system.sage_bank_account_mapping`

_0 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sage_bank_account_id` | STRING | REQUIRED |  |
| `bank_acct_no` | STRING | NULLABLE |  |
| `location_id` | STRING | REQUIRED |  |
| `Location` | STRING | REQUIRED |  |

#### `PMS_system.transaction_types_custom_categories_raw` _(EXTERNAL)_

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

_583 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `Bank_Transaction_ID` | STRING | NULLABLE |  |
| `Payment_Description` | STRING | NULLABLE |  |
| `payer_name` | STRING | NULLABLE |  |
| `extracted_payer` | STRING | NULLABLE |  |
| `mapped_pms` | STRING | NULLABLE |  |

### `Sage_system_v2` (9 tables)

#### `Sage_system_v2.bank_id_practice_mapping`

_72 rows, 3 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `bank_account_id` | STRING | NULLABLE |  |
| `practice_name` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `Sage_system_v2.bank_transaction_summaries`

_0 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sage_key` | STRING | REQUIRED |  |
| `id` | STRING | NULLABLE |  |
| `href` | STRING | NULLABLE |  |
| `posting_date` | DATE | NULLABLE |  |
| `fetched_at` | TIMESTAMP | REQUIRED |  |

#### `Sage_system_v2.entry_tracking`

_0 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sage_key` | STRING | REQUIRED |  |
| `posting_date` | DATE | NULLABLE |  |
| `last_updated` | TIMESTAMP | NULLABLE |  |
| `fetched_at` | TIMESTAMP | REQUIRED |  |

#### `Sage_system_v2.gl_journal_entry_lines`

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

_569 rows, 4 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `sync_name` | STRING | REQUIRED |  |
| `last_sync_time` | TIMESTAMP | NULLABLE |  |
| `sync_completed_at` | TIMESTAMP | REQUIRED |  |
| `created_at` | TIMESTAMP | REQUIRED |  |

#### `Sage_system_v2.sync_state`

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

_1 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `id` | STRING | REQUIRED |  |
| `last_key` | INTEGER | NULLABLE |  |
| `batch_number` | INTEGER | NULLABLE |  |
| `records_loaded_total` | INTEGER | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |

#### `Sage_system_v2.temp_gl_lines_1773341871`

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

#### `dim_mappings.bank_account_mapping`

_176 rows, 5 columns_

| Column | Type | Mode | Description |
|---|---|---|---|
| `bank_account_id` | STRING | REQUIRED |  |
| `practice_name` | STRING | NULLABLE |  |
| `updated_at` | TIMESTAMP | NULLABLE |  |
| `updated_by` | STRING | NULLABLE |  |
| `location_id` | STRING | NULLABLE |  |

#### `dim_mappings.bank_description_mapping`

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
