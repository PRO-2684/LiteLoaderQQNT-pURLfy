const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, shell, app } = require("electron");
const Purlfy = require("./purlfy");
let settingWindow = null;
let tempDisable = false;

const slug = "purlfy";
const name = LiteLoader.plugins[slug].manifest.name;
const urlPattern = /https?:\/\/.(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?!&\/\/=]*)/gm;
const isDebug = process.argv.includes(`--${slug}-debug`);
const log = isDebug ? console.log.bind(console, "\x1b[38;2;220;20;60m%s\x1b[0m", `[${name}]`) : () => { };

const pluginPath = LiteLoader.plugins[slug].path.plugin;
const rulesPath = path.join(pluginPath, "rules");
const defaultConfig = {
    statistics: {
        url: 0,
        param: 0,
        decoded: 0,
        redirected: 0,
        char: 0
    },
    hooks: {
        "shell.openExternal": true,
        "sendMessage": false
    },
    lambdaEnabled: false,
};
const config = LiteLoader.api.config.get(slug, defaultConfig);
log("Statistics loaded:", config.statistics);

// pURLfy instance
const purifier = new Purlfy({
    redirectEnabled: true,
    lambdaEnabled: config.lambdaEnabled,
    statistics: config.statistics,
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
    config.statistics = statistics;
}

function notifyLambdaEnabledChange() { // Notify the setting window about lambda enabled change
    if (settingWindow) {
        log("Notify lambda enabled change:", purifier.lambdaEnabled);
        settingWindow.webContents.send("LiteLoader.purlfy.lambdaEnabledChange", purifier.lambdaEnabled);
    }
    config.lambdaEnabled = purifier.lambdaEnabled;
}

function notifyTempDisableChange() { // Notify the setting window about temp disable change
    if (settingWindow) {
        log("Notify temp disable change:", tempDisable);
        settingWindow.webContents.send("LiteLoader.purlfy.tempDisableChange", tempDisable);
    }
}

async function purifyText(text) { // Purify URLs in text
    const urls = text.match(urlPattern);
    if (urls) {
        try {
            for (const url of urls) {
                text = text.replace(url, (await purifier.purify(url)).url);
            }
        } catch (e) {
            log("Error purifying text:", e);
        }
    }
    return text;
}

// Load rules
loadRules();

// IPC handlers
ipcMain.on("LiteLoader.purlfy.reloadRules", loadRules);
ipcMain.on("LiteLoader.purlfy.setLambdaEnabled", (event, value) => {
    log("setLambdaEnabled:", value);
    purifier.lambdaEnabled = value;
    notifyLambdaEnabledChange();
});
ipcMain.on("LiteLoader.purlfy.setTempDisable", (event, value) => {
    log("setTempDisable:", value);
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
config.hooks ??= defaultConfig.hooks;
if (config.hooks["shell.openExternal"]) {
    const originalOpen = shell.openExternal;
    shell.openExternal = async function (url, options) {
        return originalOpen(tempDisable ? url : (await purifier.purify(url)).url, options);
    };
}
function onBrowserWindowCreated(window) {
    if (!config.hooks.sendMessage) { // No need to hook
        return;
    }
    const events = window.webContents._events;
    function patch(ipcFunc) { // Adapted from https://github.com/MisaLiu/LiteLoaderQQNT-Pangu/blob/7d1b393319df2f42e7b9b42a9471463b28c04bca/src/hook.ts#L18
        if (!ipcFunc || typeof ipcFunc !== "function") {
            log("Invalid ipcFunc:", ipcFunc);
            return ipcFunc;
        }
        async function patched(...args) {
            const channel = args[2];
            const data = args[3]?.[1];
            if (tempDisable || channel.startsWith("LiteLoader.") || !data || !(data instanceof Array)) {
                return ipcFunc.apply(this, args);
            }
            const [command, ...payload] = data;
            if (command === "nodeIKernelMsgService/sendMsg") {
                const elements = payload[0]?.msgElements;
                if (elements?.length) {
                    for (const element of elements) {
                        if (element.elementType !== 1 || element.textElement.atType !== 0) {
                            // Do not purify non-text elements or at elements
                            continue;
                        }
                        const textEl = element.textElement;
                        textEl.content = await purifyText(textEl.content);
                    }
                }
                args[3][1] = [command, ...payload];
            }
            return ipcFunc.apply(this, args);
        }
        return patched;
    }
    if (events["-ipc-message"]?.[0]) {
        events["-ipc-message"][0] = patch(events["-ipc-message"][0]);
    } else {
        events["-ipc-message"] = patch(events["-ipc-message"]);
    }
}

// Cleanup - Save statistics
app.on("will-quit", () => {
    const statistics = purifier.getStatistics();
    LiteLoader.api.config.set(slug, config);
    log("Statistics saved:", statistics);
});

module.exports = {
    onBrowserWindowCreated,
};
