const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("purlfy", {
    onStatisticsChange: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.statisticsChange",
        callback
    ),
    onTempDisableChange: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.tempDisableChange",
        callback
    ),
    reloadRules: () => ipcRenderer.send(
        "LiteLoader.purlfy.reloadRules"
    ),
    setTempDisable: (tempDisable) => ipcRenderer.send(
        "LiteLoader.purlfy.setTempDisable",
        tempDisable
    ),
    getInfo: () => ipcRenderer.invoke(
        "LiteLoader.purlfy.getInfo"
    ),
    // queryIsDebug: () => ipcRenderer.invoke(
    //     "LiteLoader.purlfy.queryIsDebug"
    // ),
    purify: (url) => ipcRenderer.invoke(
        "LiteLoader.purlfy.purify",
        url
    )
});