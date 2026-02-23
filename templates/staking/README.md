# Staking Contract Template

A secure, production-ready staking contract for Stellar/Soroban. This template allows developers to easily create staking systems where users can lock assets to earn rewards over time.

## Features

- **Asset Locking**: Users can stake any Soroban-compatible token.
- **Flexible Lock Periods**: Support for custom staking durations with enforced time-locks.
- **Accrual Reward System**: Precise, time-based reward calculation.
- **Admin Controls**: Functions to manage reward rates and emergency pausing.
- **Security First**: Built with overflow protection and strict authorization checks.

## Quick Start

### 1. Initialization
The contract must be initialized with an admin address, the address of the token to be staked, and the reward rate.

```rust
// rate is units per staked unit per second (e.g., 1 = 100% per sec, usually much lower)
client.initialize(&admin, &token_address, &reward_rate);
```

### 2. Staking Assets
Users can stake assets by specifying the amount and a lock duration (in seconds).

```rust
// Stake 1000 tokens for 30 days
let duration = 30 * 24 * 60 * 60;
client.stake(&user, &1000, &duration);
```

### 3. Claiming Rewards
Users can claim their accrued rewards at any time without unstaking their principal.

```rust
client.claim_rewards(&user);
```

### 4. Unstaking
Principal can only be withdrawn after the `lock_end_time` has passed.

```rust
client.unstake(&user, &1000);
```

## Configuration Options

- **Reward Rate**: The `reward_rate` determines how many reward units are accrued per staked unit per second.
  - *Formula*: `newly_accrued = stake_amount * reward_rate * elapsed_seconds`
- **Lock Periods**: You can implement different reward tiers by checking the `lock_duration` in a wrapper function or by updating the reward rate for specific users based on their choices.

## Security Considerations

1. **Precision**: The current reward calculation assumes a simple linear model. For production use, consider scaling the `reward_rate` (e.g., by 10^7) to handle fractional percentages.
2. **Reward Funding**: The contract must hold enough tokens to pay out claimed rewards. Admins should monitor the contract balance.
3. **Authorization**: All sensitive functions (`stake`, `unstake`, `claim_rewards`) require the user's signature (`require_auth`).
4. **Emergency Pause**: The `pause` function can be used by the admin to halt new staking in case of a vulnerability detection.

## Integration Example

```rust
#[test]
fn example_usage() {
    let env = Env::default();
    // ... setup token and contract ...
    
    // User stakes tokens
    client.stake(&user, &500_0000000, &(7 * 24 * 3600)); // 1 week
    
    // Move time forward
    env.ledger().with_mut(|li| li.timestamp += 3600); // 1 hour
    
    // Check rewards
    let pending = client.get_pending_rewards(&user);
    println!("Pending rewards after 1 hour: {}", pending);
}
```
