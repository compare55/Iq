JIOWIN REQUEST HISTORY UPDATE

Added server-backed Add Money and Withdrawal request history. The wallet and payment page display request ID, amount, submitted date, and Pending/Approved/Rejected status. The list refreshes manually and after withdrawal status changes.

The history endpoint uses the existing browser customer ID (jiowinCustomerId). It returns only request status fields and does not expose bank account, IFSC, account holder, or UTR. This is not strong authentication; for real-money use, replace browser customer IDs with authenticated user accounts and server-side wallet/payment ledger.

Test locally with: node --check server.js && node --check script.js. Live Telegram/Firestore/Render was not tested by this edit.
