# Releasing a new version

A release has two parts: the npm package and the kiosk browser APK. Both have the same version. `android/app/build.gradle.kts` reads the APK version from `package.json`, and `install_kiosk` downloads the APK of its own version.

## Prerequisites

- npm account with publish access to `dragon-touch-mcp`
- `npm login` completed in the local shell
- Repository secrets for the APK signature (one-time setup, see below)

## Steps

```bash
# 1. Make sure main is clean and up to date
git checkout main
git pull

# 2. Bump version: updates package.json, creates a commit and git tag automatically
npm version patch   # 0.2.0 → 0.2.1  (bug fixes)
npm version minor   # 0.2.0 → 0.3.0  (new tools)
npm version major   # 0.2.0 → 1.0.0  (breaking changes)

# 3. Push commit and tag to GitHub
git push origin main --tags

# 4. Publish to npm (runs build automatically via "prepare" script)
npm publish
```

The tag starts `.github/workflows/release.yml`. The workflow builds the signed APK, runs the kiosk unit tests and creates the GitHub release with `dragon-touch-kiosk-<version>.apk` attached. Check that the release has the APK before you announce the npm version: `install_kiosk` fails with HTTP 404 until the APK exists.

## APK signing secrets

The release workflow signs the APK with a keystore from four repository secrets. Android accepts an update only with the same signing key, so every release must use the same keystore. Keep a backup of the keystore and its password outside the repository.

| Secret | Content |
|---|---|
| `KIOSK_KEYSTORE_BASE64` | The keystore file, base64-encoded |
| `KIOSK_KEYSTORE_PASSWORD` | Keystore password |
| `KIOSK_KEY_ALIAS` | Alias of the key in the keystore |
| `KIOSK_KEY_PASSWORD` | Key password (the same as the keystore password for a PKCS12 keystore) |

To create a keystore and set the secrets:

```bash
keytool -genkeypair -keystore kiosk-release.jks -storetype PKCS12 -alias kiosk \
  -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Dragon Touch Kiosk Browser"
base64 -i kiosk-release.jks | gh secret set KIOSK_KEYSTORE_BASE64
gh secret set KIOSK_KEYSTORE_PASSWORD
gh secret set KIOSK_KEY_PASSWORD
printf kiosk | gh secret set KIOSK_KEY_ALIAS
```
