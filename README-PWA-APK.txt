JIOWIN PWA INSTALL + ANDROID APK

PWA (website install)
- The web app manifest, service worker, icons and Install App controls are included.
- On supported Android browsers, use “Install App”.
- On iPhone/iPad, open the website in Safari, tap Share, then “Add to Home Screen”. The on-page button shows the steps.
- The PWA controls are included on the site's HTML pages. The website must be served over HTTPS for service-worker installation.

ANDROID APK
- The android-app/ folder contains a real Android WebView application project that opens the existing Jiowin website at https://jiowin-com.onrender.com/.
- The .github/workflows/build-android-apk.yml workflow builds an installable DEBUG/test APK in GitHub Actions.
- To build from iPhone: upload the extracted project contents to a GitHub repository with .github/ at the repository root; open Actions; run “Build Jiowin Android APK”; then download the “jiowin-android-debug-apk” artifact from the completed run.
- The compiled APK binary is NOT included in this ZIP because this environment has no Android SDK/Gradle build tools. Do not treat the source project as an already-built APK.
- The website's Android APK download page checks for downloads/jiowin.apk and only enables download when that actual file is deployed. To enable it, place a tested APK at downloads/jiowin.apk and redeploy Render.
- The workflow output is a DEBUG/test APK, not a signed production release. Test on a real Android phone. For public distribution, create a protected signing key and build a signed release APK.

PRESERVATION / LIMITS
- Existing game HTML/JS/CSS/assets, sounds and animations were not intentionally changed for the app wrapper.
- The APK loads the live website; it does not embed Firebase private credentials.
- Live Render installation, actual APK installation, and live Telegram/Firestore flows still require testing after deployment.
