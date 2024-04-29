const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("purlfy", {
    onUpdateResult: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.updateResult",
        callback
    ),
    onStatisticsChange: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.statisticsChange",
        callback
    ),
    onLambdaEnabledChange: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.lambdaEnabledChange",
        callback
    ),
    onTempDisableChange: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.tempDisableChange",
        callback
    ),
    reloadRules: () => ipcRenderer.send(
        "LiteLoader.purlfy.reloadRules"
    ),
    setLambdaEnabled: (lambdaEnabled) => ipcRenderer.send(
        "LiteLoader.purlfy.setLambdaEnabled",
        lambdaEnabled
    ),
    setTempDisable: (tempDisable) => ipcRenderer.send(
        "LiteLoader.purlfy.setTempDisable",
        tempDisable
    ),
    updateRules: () => ipcRenderer.send(
        "LiteLoader.purlfy.updateRules"
    ),
    getInfo: () => ipcRenderer.invoke(
        "LiteLoader.purlfy.getInfo"
    ),
    purify: (url) => ipcRenderer.invoke(
        "LiteLoader.purlfy.purify",
        url
    )
});