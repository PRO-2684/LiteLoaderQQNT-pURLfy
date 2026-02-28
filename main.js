import fs from "fs";
import path from "path";
import { BrowserWindow, ipcMain, shell, app } from "electron";
import { Purlfy } from "./purlfy";
let settingWindow = null;
let tempDisable = false;

const slug = "purlfy";
const meta = qwqnt.framework.plugins[slug].meta;
const name = meta.packageJson.qwqnt.name;
const urlPattern =
    /https?:\/\/.(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?!&\/\/=]*)/gm;
const isDebug = process.argv.includes(`--${slug}-debug`);
const log = isDebug
    ? console.log.bind(console, "\x1b[38;2;220;20;60m%s\x1b[0m", `[${name}]`)
    : () => {};

const dataPath = qwqnt.framework.paths.data + "/" + slug;
const rulesPath = path.join(dataPath, "rules");
const listPath = path.join(rulesPath, "list.min.json");
const defaultConfig = {
    statistics: {
        url: 0,
        param: 0,
        decoded: 0,
        redirected: 0,
        visited: 0,
        char: 0,
    },
    hooks: {
        "shell.openExternal": true,
        sendMessage: false,
    },
    lambdaEnabled: false,
    etags: {},
    rules: {
        tracking: true,
        outgoing: true,
    },
};
const config = Object.assign(
    {},
    defaultConfig,
    PluginSettings.main.readConfig(slug, defaultConfig),
);
log("Statistics loaded:", config.statistics);

// pURLfy instance
const purifier = new Purlfy({
    fetchEnabled: true,
    lambdaEnabled: config.lambdaEnabled,
    statistics: config.statistics,
    log: log,
});

purifier.addEventListener("statisticschange", () => {
    notifyStatisticsChange(purifier.getStatistics());
});

async function loadRules() {
    // Load rules
    purifier.clearRules();
    if (!fs.existsSync(rulesPath)) {
        log("Rules path not found, creating...");
        fs.mkdirSync(rulesPath, { recursive: true });
    }
    if (!fs.existsSync(listPath)) {
        log("Rules list not found, updating rules...");
        await updateRules(); // Update rules if not exists
    }
    const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
    for (const name of list) {
        if (config.rules[name] !== true) {
            log("Rules not enabled:", name);
            config.rules[name] = false; // Fill missing keys
            continue;
        }
        try {
            const rule = JSON.parse(
                fs.readFileSync(
                    path.join(rulesPath, `${name}.min.json`),
                    "utf8",
                ),
            );
            purifier.importRules(rule);
            log("Rules file loaded:", name);
        } catch (e) {
            log(`Error loading rules ${name}:`, e);
        }
    }
    return true;
}

async function update(name) {
    // Update `name.min.json`, return true if updated
    const url = `https://cdn.jsdelivr.net/gh/PRO-2684/pURLfy-rules@core-0.3.x/${name}.min.json`;
    const localPath = path.join(rulesPath, `${name}.min.json`);
    const etag = fs.existsSync(localPath) ? (config.etags[name] ?? "") : "";
    try {
        const response = await fetch(url, {
            headers: { "If-None-Match": etag },
        });
        if (response.status === 200) {
            fs.writeFileSync(localPath, await response.text(), "utf8");
            const newEtag = response.headers.get("Etag") ?? etag;
            config.etags[name] = newEtag;
            log(`Updated ${name}.min.json, Etag:`, newEtag);
            return true;
        } else if (response.status === 304) {
            log(`${name}.min.json is up-to-date`);
        } else {
            log(
                "Unexpected status code:",
                response.status,
                response.statusText,
            );
        }
        return false;
    } catch (e) {
        log(`Error updating ${name}.min.json:`, e);
        return false;
    }
}

async function updateRules() {
    // Update rules, return true if updated
    let updated = await update("list");
    const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
    for (const name of list) {
        const result = await update(name); // Avoid short-circuiting
        updated ||= result;
    }
    return updated;
}

function notifyStatisticsChange(statistics) {
    // Notify the setting window about statistics change
    if (settingWindow) {
        log("Notify statistics change");
        settingWindow.webContents.send(
            "LiteLoader.purlfy.statisticsChange",
            statistics,
        );
    }
    config.statistics = statistics;
}

function notifyLambdaEnabledChange() {
    // Notify the setting window about lambda enabled change
    if (settingWindow) {
        log("Notify lambda enabled change:", purifier.lambdaEnabled);
        settingWindow.webContents.send(
            "LiteLoader.purlfy.lambdaEnabledChange",
            purifier.lambdaEnabled,
        );
    }
    config.lambdaEnabled = purifier.lambdaEnabled;
}

function notifyTempDisableChange() {
    // Notify the setting window about temp disable change
    if (settingWindow) {
        log("Notify temp disable change:", tempDisable);
        settingWindow.webContents.send(
            "LiteLoader.purlfy.tempDisableChange",
            tempDisable,
        );
    }
}

async function purifyText(text) {
    // Purify URLs in text
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
ipcMain.handle("LiteLoader.purlfy.toggle", (event, name, enabled) => {
    log("toggle:", name, enabled);
    config.rules[name] = enabled;
    return enabled;
});
ipcMain.handle("LiteLoader.purlfy.updateRules", updateRules);
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
        lambdaEnabled: purifier.lambdaEnabled,
        rules: config.rules,
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
        return originalOpen(
            tempDisable ? url : (await purifier.purify(url)).url,
            options,
        );
    };
}
function onBrowserWindowCreated(window) {
    if (!config.hooks.sendMessage) {
        // No need to hook
        return;
    }
    const events = window.webContents._events;
    function patch(ipcFunc) {
        // Adapted from https://github.com/MisaLiu/LiteLoaderQQNT-Pangu/blob/7d1b393319df2f42e7b9b42a9471463b28c04bca/src/hook.ts#L18
        if (!ipcFunc || typeof ipcFunc !== "function") {
            log("Invalid ipcFunc:", ipcFunc);
            return ipcFunc;
        }
        async function patched(...args) {
            const channel = args[2];
            const data = args[3]?.[1];
            if (
                tempDisable ||
                channel.startsWith("LiteLoader.") ||
                !data ||
                !(data instanceof Array)
            ) {
                return ipcFunc.apply(this, args);
            }
            const [command, ...payload] = data;
            if (command === "nodeIKernelMsgService/sendMsg") {
                const elements = payload[0]?.msgElements;
                if (elements?.length) {
                    for (const element of elements) {
                        if (
                            element.elementType !== 1 ||
                            element.textElement.atType !== 0
                        ) {
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
app.on("quit", () => {
    PluginSettings.main.writeConfig(slug, config);
    log("Config saved:", config);
});

log(
    `🎉 Initialized successfully! Plugin version: ${meta.packageJson.version}, pURLfy core version: ${Purlfy.version}.`,
);

module.exports = {
    onBrowserWindowCreated,
};
