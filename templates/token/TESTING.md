# Token Contract Test Documentation

This document describes the testing strategy and scenarios for the standard Token Contract template.

## Test Strategy

The test suite is designed to ensure the security, reliability, and accuracy of the token's core functionality. It utilizes the `soroban-sdk` test utilities to simulate the ledger and multiple user authorizations.

## Test Categories

### 1. Initialization Tests
- `test_initialize_sets_admin_and_supply`: Verifies that the admin and initial supply are correctly set.
- `test_double_initialize_fails`: Ensures the contract cannot be re-initialized.

### 2. Unit Tests
- **Minting**:
    - `test_mint_increases_balance_and_total_supply`: Basic success path.
    - `test_non_admin_cannot_mint`: Security check for admin authorization.
- **Transfers**:
    - `test_transfer_moves_tokens_between_accounts`: Basic success path.
    - `test_transfer_to_self`: Verifies balance consistency during self-transfers.
- **Burning**:
    - `test_burn_reduces_balance_and_total_supply`: Basic success path.

### 3. Edge Case Tests
- `test_mint_zero_amount_fails`: Prevents zero-value minting.
- `test_mint_negative_amount_fails`: Prevents negative minting.
- `test_transfer_zero_amount_fails`: Prevents zero-value transfers.
- `test_transfer_fails_with_insufficient_balance`: Ensures balances cannot go negative.
- `test_burn_fails_with_insufficient_balance`: Prevents burning more than available.
- `test_burn_zero_amount_fails`: Prevents zero-value burning.
- `test_max_supply_overflow_protection`: Verifies that `checked_add` prevents i128 overflows.

### 4. Integration Tests
- `test_integration_multi_user_flow`: Simulates a real-world scenario with multiple users (Alice, Bob, Charlie) interacting over a sequence of operations (mint -> transfer -> transfer -> burn).
- `test_balance_accuracy_after_multiple_operations`: Running multiple repeated operations to ensure no rounding or logic errors accumulate.

## Running Tests

To run the test suite, ensure you have the Soroban environment set up and run:

```bash
cargo test
```

## Coverage Plan

The current test suite aims for **100% statement coverage** of the `lib.rs` file.
- **Mint**: Covered for success, unauthorized access, zero value, and overflow.
- **Transfer**: Covered for success, self-transfer, insufficient balance, and zero value.
- **Burn**: Covered for success, insufficient balance, and zero value.
- **Storage**: Instance storage keys are verified through balance and supply checks.
