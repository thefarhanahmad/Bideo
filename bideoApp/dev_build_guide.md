# Development Build Guide

> Project: **Bideo (React Native + Expo + Native Android)**
>
> This guide explains the complete development and release build workflow for the project.

---

# 1. Daily Development Workflow

## Step 1 - Pull Latest Changes (if working with Git)

```bash
git pull
```

---

## Step 2 - Install Dependencies (Only if package.json changed)

```bash
npm install
```

> No need to run `npm install` every time.

---

## Step 3 - Start Development

```bash
npx expo start
```

or

```bash
npx expo start --clear
```

if Metro cache causes issues.

---

# 2. Building Release APK

Go to android folder

```bash
cd android
```

Build Release APK

```bash
./gradlew assembleRelease
```

Windows

```powershell
.\gradlew assembleRelease
```

APK Output

```
android/app/build/outputs/apk/release/app-release.apk
```

---

# 3. Building Play Store Bundle (AAB)

Go to android folder

```bash
cd android
```

Generate AAB

```bash
./gradlew bundleRelease
```

Windows

```powershell
.\gradlew bundleRelease
```

Output

```
android/app/build/outputs/bundle/release/app-release.aab
```

Upload this file to Google Play Console.

---

# 4. Installing APK on Physical Device

Install

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

If signature mismatch occurs

```bash
adb uninstall com.farhan.bideoapp
```

Then install again

```bash
adb install app/build/outputs/apk/release/app-release.apk
```

---

# 5. When Should You Run Gradle Clean?

Run only when:

- Native dependency added
- Native dependency removed
- build.gradle changed
- AndroidManifest.xml changed
- MainApplication.kt changed
- MainActivity.kt changed
- Gradle build behaves unexpectedly

Command

```bash
cd android

./gradlew clean
```

Windows

```powershell
.\gradlew clean
```

Then rebuild.

---

# 6. When Should You Delete node_modules?

Delete only when

- npm install fails
- dependency conflict
- corrupted packages

Commands

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

Windows PowerShell

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

npm install
```

This is **NOT** required before every build.

---

# 7. When Should You Run Expo Prebuild?

Only if

- New Expo native module installed
- Expo plugin added
- Expo plugin removed
- app.json native configuration changed

Command

```bash
npx expo prebuild --clean
```

Do **NOT** run this regularly.

---

# 8. Version Management

Before every Play Store release

Increase

```gradle
versionCode
```

Example

```gradle
versionCode 8
```

Optional

```gradle
versionName "1.0.1"
```

Rules

- versionCode must always increase
- versionName is user-visible

---

# 9. Backend Deployment Workflow

SSH into VPS

```bash
ssh root@YOUR_SERVER_IP
```

Go to project

```bash
cd ~/Bideo
```

Pull latest changes

```bash
git pull
```

Deploy

```bash
./deploy.sh
```

or

```bash
docker compose up -d --build
```

---

# 10. Nginx Upload Limit

Current configuration

```nginx
client_max_body_size 500M;
```

Location

```
/etc/nginx/sites-available/bideo
```

Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

# 11. Useful ADB Commands

Check devices

```bash
adb devices
```

Clear logs

```bash
adb logcat -c
```

View React Native logs

```bash
adb logcat ReactNativeJS:V AndroidRuntime:E *:S
```

Install APK

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Uninstall

```bash
adb uninstall com.farhan.bideoapp
```

---

# 12. Common Errors

## INSTALL_FAILED_VERSION_DOWNGRADE

Reason

Installed app has higher versionCode.

Solution

Increase

```gradle
versionCode
```

or uninstall existing app.

---

## INSTALL_FAILED_UPDATE_INCOMPATIBLE

Reason

APK signed with different keystore.

Solution

```bash
adb uninstall com.farhan.bideoapp
```

Install again.

---

## 413 Request Entity Too Large

Reason

Nginx upload limit exceeded.

Solution

```nginx
client_max_body_size 500M;
```

Reload nginx.

---

## Ninja build.ninja dirty after 100 tries

Reason

Project stored inside OneDrive.

Solution

Move project outside OneDrive.

Example

```
D:\Projects\Bideo
```

Avoid

```
C:\Users\<user>\OneDrive\...
```

---

## Hard link failed. Doing slower copy instead.

Safe to ignore.

Build will continue normally.

---

## Deprecated Gradle warnings

Safe to ignore.

Upgrade dependencies in future releases.

---

# 13. Things NOT to Do Before Every Build

Do NOT

- Delete node_modules
- Delete package-lock.json
- Delete android folder
- Run expo prebuild
- Run gradlew clean
- Clear Gradle cache

Only perform these actions when there is an actual issue.

---

# 14. Recommended Development Workflow

```
Code Changes
      │
      ▼
npm install (only if package.json changed)
      │
      ▼
cd android
      │
      ▼
gradlew assembleRelease
      │
      ▼
Install APK
      │
      ▼
Test on Device
      │
      ▼
Fix Issues
      │
      ▼
Repeat
```

---

# 15. Recommended Play Store Release Workflow

```
Complete Development
        │
        ▼
Test on Physical Device
        │
        ▼
Update versionCode
        │
        ▼
Update versionName (optional)
        │
        ▼
Build AAB
        │
        ▼
Upload to Play Console
        │
        ▼
Publish Release
```

---

# Notes

- Always test Release builds before sharing.
- Use a production keystore for Play Store releases.
- Never publish a debug-signed APK to the Play Store.
- Keep backend and mobile app versions compatible.
- Commit code to Git before generating production builds.
