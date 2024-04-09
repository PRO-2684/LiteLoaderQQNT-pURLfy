const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, shell, app } = require("electron");
const Purlfy = require("./purlfy");
let settingWindow = null;
let tempDisable = false;

const slug = "purlfy";
const name = LiteLoader.plugins[slug].manifest.name;
const isDebug = process.argv.includes(`--${slug}-debug`);
const log = isDebug ? console.log.bind(console, "\x1b[38;2;220;20;60m%s\x1b[0m", `[${name}]`) : () => { };

const pluginPath = LiteLoader.plugins[slug].path.plugin;
const rulesPath = path.join(pluginPath, "rules");
const data = LiteLoader.api.config.get(slug, {
    statistics: {
        url: 0,
        param: 0,
        decoded: 0,
        redirected: 0,
        char: 0
    },
    lambdaEnabled: false,
});
let { statistics: initStatistics, lambdaEnabled: initLambdaEnabled } = data;
log("Statistics loaded:", initStatistics);

// pURLfy instance
const purifier = new Purlfy({
    redirectEnabled: true,
    lambdaEnabled: initLambdaEnabled,
    statistics: initStatistics,
    log: log
});

purifier.addEventListener("statisticschange", () => {
    notifyStatisticsChange(purifier.getStatistics());
});

function loadRules() { // Load rules from `rules.json`
    try {
        purifier.clearRules();
        const files = fs.readdirSync(rulesPath);
        for (const file of files) {
            if (file.endsWith(".json")) {
                const rule = JSON.parse(fs.readFileSync(path.join(rulesPath, file), "utf8"));
                purifier.importRules(rule);
                log("Rules file loaded:", file);
            }
        }
    } catch (e) {
        log("Error loading rules:", e);
    }
}

function notifyStatisticsChange(statistics) { // Notify the setting window about statistics change
    if (settingWindow) {
        log("Notify statistics change");
        settingWindow.webContents.send("LiteLoader.purlfy.statisticsChange", statistics);
    }
}

function notifyLambdaEnabledChange() { // Notify the setting window about lambda enabled change
    if (settingWindow) {
        log("Notify lambda enabled change:", purifier.lambdaEnabled);
        settingWindow.webContents.send("LiteLoader.purlfy.lambdaEnabledChange", initLambdaEnabled);
    }
}

function notifyTempDisableChange() { // Notify the setting window about temp disable change
    if (settingWindow) {
        log("Notify temp disable change:", tempDisable);
        settingWindow.webContents.send("LiteLoader.purlfy.tempDisableChange", tempDisable);
    }
}

// Load rules
loadRules();

// IPC handlers
ipcMain.on("LiteLoader.purlfy.reloadRules", () => {
    loadRules();
});
ipcMain.on("LiteLoader.purlfy.setLambdaEnabled", (event, value) => {
    log("setLambdaEnabled:", value);
    if (purifier.lambdaEnabled === value) {
        return;
    }
    purifier.lambdaEnabled = value;
    notifyLambdaEnabledChange();
});
ipcMain.on("LiteLoader.purlfy.setTempDisable", (event, value) => {
    log("setTempDisable:", value);
    if (tempDisable === value) {
        return;
    }
    tempDisable = value;
    notifyTempDisableChange();
});
ipcMain.handle("LiteLoader.purlfy.getInfo", (event) => {
    settingWindow = BrowserWindow.fromWebContents(event.sender);
    log(`Setting window created: #${settingWindow.id}`);
    settingWindow.on("closed", () => {
        log(`Setting window closed: #${settingWindow.id}`);
        settingWindow = null;
    });
    return {
        statistics: purifier.getStatistics(),
        tempDisable: tempDisable,
        isDebug: isDebug,
        lambdaEnabled: purifier.lambdaEnabled
    };
});
ipcMain.handle("LiteLoader.purlfy.purify", async (event, url) => {
    return await purifier.purify(url);
});

// Hooks
const originalOpen = shell.openExternal;
shell.openExternal = async function (url, options) {
    return originalOpen(tempDisable ? url : (await purifier.purify(url)).url, options);
};

// Cleanup - Save statistics
app.on("will-quit", () => {
    const statistics = purifier.getStatistics();
    LiteLoader.api.config.set(slug, {
        statistics: statistics,
        lambdaEnabled: purifier.lambdaEnabled
    });
    log("Statistics saved:", statistics);
});
