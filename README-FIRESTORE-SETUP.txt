JIOWIN FIRESTORE + THREE TELEGRAM BOTS SETUP

1) Render -> your Jiowin web service -> Environment. Add these variables. Do not put secret values in this README or public GitHub.

FIREBASE_PROJECT_ID = your Firebase project ID (example: comparex-cebd8)
FIREBASE_CLIENT_EMAIL = client_email from a NEW service-account JSON key
FIREBASE_PRIVATE_KEY = private_key from that NEW JSON key. Paste into Render only. If using escaped newlines, keep the \n sequences; server converts them. Never send the key in chat.

Telegram Bot 1 (existing Add Money/Withdrawal):
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID

Telegram Bot 2 (existing Live Chat):
SUPPORT_TELEGRAM_BOT_TOKEN
SUPPORT_TELEGRAM_ADMIN_CHAT_ID

Telegram Bot 3 (Login/Register):
LOGIN_TELEGRAM_BOT_TOKEN
LOGIN_TELEGRAM_ADMIN_CHAT_ID

After setting variables, deploy. GET /api/health should show firestoreConfigured:true and the three bot configured flags true. If firestoreConfigured:false, check the three FIREBASE variables and logs.

The app copies existing JSON requests/chat/live-bets into Firestore the first time if those Firestore documents are empty. New registrations and Add Money/Withdrawal requests are blocked unless Firestore is configured; this prevents accepting these records when only ephemeral Render disk storage is available. Requests require a logged-in account and are stored in Firestore under jiowinData/requests; account records are stored in jiowinUsers. After a server restart users may need to log in again because sessions are in memory, but their account and request records remain in Firestore. Existing browser game balances are still localStorage-based and are NOT a server-side wallet ledger.

Security: Never commit service-account JSON to GitHub. Revoke exposed keys and create a new key. Use Firestore server-side access only; do not make Firestore rules public. Free-tier quotas/availability are subject to Firebase limits.
