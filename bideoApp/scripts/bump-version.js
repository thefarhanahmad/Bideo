const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const appJsonPath = path.join(rootDir, 'app.json');
const packageJsonPath = path.join(rootDir, 'package.json');

if (!fs.existsSync(appJsonPath)) {
  console.error('Error: app.json not found at ' + appJsonPath);
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = fs.existsSync(packageJsonPath) 
  ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) 
  : null;

const currentVersion = appJson.expo?.version || '1.0.0';
const currentCode = appJson.expo?.android?.versionCode || 1;

const args = process.argv.slice(2);
let newVersion = currentVersion;
let newCode = currentCode + 1;

if (args.length > 0) {
  const arg = args[0].trim();
  if (/^\d+\.\d+\.\d+$/.test(arg)) {
    newVersion = arg;
  } else if (arg === 'minor') {
    const parts = currentVersion.split('.').map(Number);
    newVersion = `${parts[0]}.${(parts[1] || 0) + 1}.0`;
  } else if (arg === 'major') {
    const parts = currentVersion.split('.').map(Number);
    newVersion = `${(parts[0] || 0) + 1}.0.0`;
  } else {
    // default patch bump
    const parts = currentVersion.split('.').map(Number);
    const patch = (parts[2] || 0) + 1;
    newVersion = `${parts[0]}.${parts[1]}.${patch}`;
  }

  if (args[1] && !isNaN(Number(args[1]))) {
    newCode = Number(args[1]);
  }
} else {
  // default patch bump
  const parts = currentVersion.split('.').map(Number);
  const patch = (parts[2] || 0) + 1;
  newVersion = `${parts[0]}.${parts[1]}.${patch}`;
}

appJson.expo = appJson.expo || {};
appJson.expo.version = newVersion;
appJson.expo.android = appJson.expo.android || {};
appJson.expo.android.versionCode = newCode;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');

if (packageJson) {
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
}

console.log('==============================================');
console.log(`Version successfully updated:`);
console.log(`  Version Name : ${currentVersion} -> ${newVersion}`);
console.log(`  Version Code : ${currentCode} -> ${newCode}`);
console.log('==============================================');
console.log('Now you can build:');
console.log('  Local APK : npm run build:apk');
console.log('  Local AAB : npm run build:aab');
