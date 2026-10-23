Jiowin Telegram approval + spam-handling patch

Changes in this ZIP:
- Telegram Approve/Reject callback is acknowledged immediately, preventing the Telegram button spinner from waiting on Firestore/network work.
- Approval persistence failures are logged and reported to the admin; request status is reverted to PENDING in memory/local JSON rather than claiming success.
- Duplicate concurrent callback processing for the same request is guarded; already-processed requests cannot be approved a second time.
- Add Money/Withdraw submissions are rate-limited to 5 per customer ID per minute.
- Live Chat is rate-limited to 10 messages per visitor ID per minute and Telegram alerts are throttled to one notification per visitor every 5 seconds; accepted chat messages are still saved.
- Existing game files, game logic, page layout, sounds, animations, and CSS were not intentionally changed.

Render:
- Keep existing environment variables unchanged.
- Optional: TELEGRAM_ADMIN_USER_ID can be set to the numeric Telegram user ID of the approving admin. This is useful if the payment bot's admin chat is a group; set it to the authorized user's ID. For a private admin chat, the existing TELEGRAM_ADMIN_CHAT_ID should normally match the admin user ID.

Important limitation:
- This code records the request as APPROVED/REJECTED. It does not verify bank settlement or create a secure server-side real-money wallet ledger. The payment page in this ZIP explicitly identifies the wallet as a browser demo wallet.
- Deployment and real Telegram/Firestore behavior must be verified in the user's Render service; this ZIP has only been checked locally for JavaScript syntax and basic HTTP behavior.
