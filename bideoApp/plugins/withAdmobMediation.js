const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to inject Google Mobile Ads mediation dependencies into android/app/build.gradle.
 * This ensures that when EAS Build or 'npx expo prebuild' runs, the Unity Ads mediation adapter
 * and Unity Ads SDK are automatically compiled into the native Android application.
 */
const withAdmobMediation = (config) => {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    const mediationDependencies = `
    // Google Mobile Ads Mediation - Unity Ads
    implementation 'com.google.ads.mediation:unity:4.14.2.0'
    implementation 'com.unity3d.ads:unity-ads:4.14.2'
`;

    if (!contents.includes('com.google.ads.mediation:unity')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {${mediationDependencies}`
      );
      gradleConfig.modResults.contents = contents;
    }

    return gradleConfig;
  });
};

module.exports = createRunOncePlugin(withAdmobMediation, 'withAdmobMediation', '1.0.0');
