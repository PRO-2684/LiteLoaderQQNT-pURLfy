const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("purlfy", {
    onStatisticsChange: (callback) => ipcRenderer.on(
        "LiteLoader.purlfy.statisticsChange",
        callback
    ),
    reloadRules: () => ipcRenderer.send(
        "LiteLoader.purlfy.reloadRules"
    ),
    getStatistics: () => ipcRenderer.invoke(
        "LiteLoader.purlfy.getStatistics"
    ),
    queryIsDebug: () => ipcRenderer.invoke(
        "LiteLoader.purlfy.queryIsDebug"
    ),
    purify: (url) => ipcRenderer.invoke(
        "LiteLoader.purlfy.purify",
        url
    ),
});