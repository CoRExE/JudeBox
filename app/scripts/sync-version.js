const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const appJsonPath = path.join(__dirname, '../app.json');

// Lire package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const newVersion = packageJson.version;

// Lire app.json
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Mettre à jour la version globale
appJson.expo.version = newVersion;

// Mettre à jour iOS buildNumber
let currentIosBuild = parseInt(appJson.expo.ios?.buildNumber || "0", 10);
if (isNaN(currentIosBuild)) currentIosBuild = 0;
if (!appJson.expo.ios) appJson.expo.ios = {};
appJson.expo.ios.buildNumber = (currentIosBuild + 1).toString();

// Mettre à jour Android versionCode
let currentAndroidVersionCode = appJson.expo.android?.versionCode || 0;
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = currentAndroidVersionCode + 1;

// Sauvegarder app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

console.log(`✅ Synchronisé app.json (Version: ${newVersion}, iOS Build: ${appJson.expo.ios.buildNumber}, Android Code: ${appJson.expo.android.versionCode})`);
