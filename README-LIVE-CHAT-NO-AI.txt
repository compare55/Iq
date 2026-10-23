JIOWIN LIVE CHAT — NO AI API

This update adds offline, keyword-based fixed replies to the existing support chat.
- Known FAQs (greetings, Add Money steps, Withdraw steps, login/register, referral) get a canned response.
- Unknown questions, payment-status cases and explicit requests for a person are handed off to the configured Support Telegram admin.
- Admin replies continue to use: /reply VISITOR_ID Your reply here
- No AI API key is used or required.

Render environment variables for the existing support bot:
SUPPORT_TELEGRAM_BOT_TOKEN
SUPPORT_TELEGRAM_ADMIN_CHAT_ID

Existing website chat polling and Firestore persistence remain in place. Deploy and test on Render to confirm the real Telegram credentials and Firestore permissions. This ZIP is code-updated but live integration has not been verified from here.
