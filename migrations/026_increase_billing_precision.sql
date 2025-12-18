-- Migration 026: Increase billing_ledger amount precision
-- The current DECIMAL(10,4) rounds small costs like $0.00011251 to $0.0000
-- Changing to DECIMAL(12,8) to support micro-transaction precision

ALTER TABLE billing_ledger
ALTER COLUMN amount TYPE DECIMAL(12,8);
