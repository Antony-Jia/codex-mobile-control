const { withAndroidManifest, withGradleProperties } = require("expo/config-plugins");

module.exports = function withCleartextTraffic(config) {
  config = withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (application) {
      application.$ = application.$ || {};
      application.$["android:usesCleartextTraffic"] = "true";
    }
    return result;
  });
  config = withGradleProperties(config, (result) => {
    for (const key of ["systemProp.http.proxyHost", "systemProp.https.proxyHost"]) {
      result.modResults = result.modResults.filter((entry) => entry.key !== key);
      result.modResults.push({ type: "property", key, value: "" });
    }
    const architectures = result.modResults.find((entry) => entry.key === "reactNativeArchitectures");
    if (architectures) architectures.value = "arm64-v8a";
    else result.modResults.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
    const devServerPort = result.modResults.find((entry) => entry.key === "reactNativeDevServerPort");
    if (devServerPort) devServerPort.value = "8083";
    else result.modResults.push({ type: "property", key: "reactNativeDevServerPort", value: "8083" });
    const jvmArgs = result.modResults.find((entry) => entry.key === "org.gradle.jvmargs");
    if (jvmArgs && !String(jvmArgs.value).includes("-Dhttp.proxyHost=")) {
      jvmArgs.value = `${jvmArgs.value} -Dhttp.proxyHost= -Dhttps.proxyHost=`;
    }
    return result;
  });
  return config;
};
