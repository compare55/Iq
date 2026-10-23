JIOWIN ANDROID APP — APK BUILD

This is an Android WebView app that opens the existing Jiowin website at:
https://jiowin-com.onrender.com/

The project source is included. A compiled APK is not bundled in this ZIP because the preparation environment has no Android SDK/Gradle build environment. Use the cloud build below to create an installable DEBUG/test APK.

BUILD FROM IPHONE USING GITHUB ACTIONS
1. Extract this ZIP and upload the contents of the Jiowin-main folder to a GitHub repository. The .github folder must be at repository root (same level as server.js and android-app/).
2. In GitHub, open the repository's Actions tab.
3. Select “Build Jiowin Android APK” and press “Run workflow”. If Actions is disabled, enable it in repository settings.
4. Wait for the workflow to finish with a green check mark.
5. Open that workflow run, scroll to Artifacts, and download “jiowin-android-debug-apk”.
6. Extract the downloaded artifact. It contains app-debug.apk and SHA256SUMS.txt.
7. Transfer app-debug.apk to an Android phone and install it for testing. Android may ask permission to install unknown apps; only proceed if you trust the file and its source.

IMPORTANT
- This cloud workflow creates a DEBUG/test APK, not a signed public-release APK.
- Test login/register, all games, sound, Firebase requests, Telegram approval, support chat, and back navigation on a real Android phone before sharing it.
- To enable the website's “Android APK” download page, place the tested APK in the website's downloads/ folder and name it jiowin.apk, then redeploy Render. The APK download button remains disabled until the file actually exists.
- For public distribution, create a protected release signing key and build a signed release APK. Never upload the signing key or passwords to a public repository.
- The Android app loads the existing website; it does not copy Firebase secrets into the APK and does not bypass website login or payment approval.
