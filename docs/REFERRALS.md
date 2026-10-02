# Referral & Anti-Abuse Design

## Goals

The referral system rewards legitimate invitations while limiting multi-account, device-farm and high-velocity abuse without treating a single weak signal as proof of fraud.

## Default reward configuration

Seed values are development defaults and are editable through the admin API:

- Inviter reward: 250 COIN
- Invitee reward: 100 COIN
- Daily inviter cap: 2,500 COIN
- Lifetime inviter cap: 25,000 COIN
- Minimum account age: 0 minutes
- Maximum inviter velocity: 10 referrals/hour before risk points apply
- Review threshold: 40
- Block threshold: 70

Production values must be chosen from product/economy testing rather than copied blindly.

## Risk signals

- `self_referral` — hard signal, 100 points
- `same_device` — strong signal
- `same_ip` — weak signal because households/carriers/NAT can share addresses
- `ip_signup_velocity` — multiple accounts created from one IP in a short window
- `device_multi_account` — device proof observed across multiple users
- `inviter_velocity` — inviter creates referrals faster than configured threshold

Risk is additive and capped at 100. Flags preserve evidence for review.

## No automatic account ban

Referral risk changes referral/reward state, not account status. Account bans require a separate moderation decision and evidence trail.

## Concurrency and duplicate prevention

A referral reward is first reserved in `referral_rewards` under a PostgreSQL advisory transaction lock keyed by program + beneficiary. Pending and granted reservations both count toward caps. The wallet transfer then uses an idempotency key:

```text
referral:<referral-id>:inviter
referral:<referral-id>:invitee
```

A retry can complete a pending reward without minting the same reward twice.

## Manual review

Admins can:

- inspect fraud flags
- mark flags reviewing/confirmed/dismissed
- approve a referral and grant its reward
- reject a referral with a reason

Every mutation is written to `admin_audit_logs`.

## Device proof limitation

The current client provides a device proof that is hashed before storage. A determined attacker may spoof a client-generated identifier. A later production phase should integrate platform attestation (for example Android Play Integrity / Apple App Attest or equivalent supported mechanisms) and treat device identity as one risk input rather than a single source of truth.
