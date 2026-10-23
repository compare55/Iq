JIOWIN REFERRAL FEATURE

Referral code/link and registration tracking are available at /referral.html. Reward policy: ₹50 for a referrer, once per referred account, after that account’s first deposit request is approved by the Telegram admin.

Safety rules:
- Deposit request is eligible only if the user is logged in when submitting it; the server links the request to the session user ID. Requests submitted anonymously or before this update do not qualify.
- Only requests with type=deposit and status=APPROVED qualify. Pending/rejected withdrawals and deposits do not qualify.
- The referrer’s user record stores the credited referred-user IDs and reward balance together; repeat approvals do not double-credit the same referred account.
- Approval records the admin decision only; it does not verify settlement with a bank/UPI provider. Do not treat this reward balance as a withdrawable real-money wallet unless a proper audited ledger and compliance review are implemented.
- Firestore should be configured for persistent deployment. Local JSON fallback may not survive ephemeral hosting/restarts.

Tests run locally: node --check server.js, node --check auth.js, static HTML presence checks, and ZIP integrity. Live Telegram/Firestore/Render flow still needs deployment testing.
