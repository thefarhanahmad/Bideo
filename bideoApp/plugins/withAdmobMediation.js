const { withAppBuildGradle, withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to inject Google Mobile Ads mediation dependencies into android/app/build.gradle
 * and ensure com.google.android.gms.permission.AD_ID is retained for Meta Audience Network.
 */
const withAdmobMediation = (config) => {
  config = withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    const mediationDependencies = `
    // Google Mobile Ads Mediation - Unity Ads
    implementation 'com.google.ads.mediation:unity:4.14.2.0'
    implementation 'com.unity3d.ads:unity-ads:4.14.2'

    // Google Mobile Ads Mediation - Meta Audience Network (Facebook)
    implementation 'com.google.ads.mediation:facebook:6.18.0.0'
`;

    if (!contents.includes('com.google.ads.mediation:unity')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {${mediationDependencies}`
      );
      gradleConfig.modResults.contents = contents;
    } else if (!contents.includes('com.google.ads.mediation:facebook')) {
      contents = contents.replace(
        "implementation 'com.unity3d.ads:unity-ads:4.14.2'",
        `implementation 'com.unity3d.ads:unity-ads:4.14.2'

    // Google Mobile Ads Mediation - Meta Audience Network (Facebook)
    implementation 'com.google.ads.mediation:facebook:6.18.0.0'`
      );
      gradleConfig.modResults.contents = contents;
    }

    return gradleConfig;
  });

  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const hasAdId = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'com.google.android.gms.permission.AD_ID'
    );
    if (!hasAdId) {
      manifest['uses-permission'].push({
        $: {
          'android:name': 'com.google.android.gms.permission.AD_ID',
        },
      });
    }
    return manifestConfig;
  });

  return config;
};

module.exports = createRunOncePlugin(withAdmobMediation, 'withAdmobMediation', '1.0.0');
