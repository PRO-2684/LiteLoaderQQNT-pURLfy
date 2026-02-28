const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("purlfy", {
    onStatisticsChange: (callback) =>
        ipcRenderer.on("PRO-2684.purlfy.statisticsChange", callback),
    onLambdaEnabledChange: (callback) =>
        ipcRenderer.on("PRO-2684.purlfy.lambdaEnabledChange", callback),
    onTempDisableChange: (callback) =>
        ipcRenderer.on("PRO-2684.purlfy.tempDisableChange", callback),
    reloadRules: () => ipcRenderer.send("PRO-2684.purlfy.reloadRules"),
    setLambdaEnabled: (lambdaEnabled) =>
        ipcRenderer.send("PRO-2684.purlfy.setLambdaEnabled", lambdaEnabled),
    setTempDisable: (tempDisable) =>
        ipcRenderer.send("PRO-2684.purlfy.setTempDisable", tempDisable),
    toggle: (name, enabled) =>
        ipcRenderer.invoke("PRO-2684.purlfy.toggle", name, enabled),
    updateRules: () => ipcRenderer.invoke("PRO-2684.purlfy.updateRules"),
    getInfo: () => ipcRenderer.invoke("PRO-2684.purlfy.getInfo"),
    purify: (url) => ipcRenderer.invoke("PRO-2684.purlfy.purify", url),
    openUrl: (url) => ipcRenderer.send("PRO-2684.purlfy.openUrl", url),
});
