const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("purlfy", {
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
    getInfo: () => ipcRenderer.invoke(
        "LiteLoader.purlfy.getInfo"
    ),
    purify: (url) => ipcRenderer.invoke(
        "LiteLoader.purlfy.purify",
        url
    )
});