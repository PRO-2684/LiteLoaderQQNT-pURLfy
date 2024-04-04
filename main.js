const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, webContents, shell, app } = require("electron");
let rules = {};
let settingWindow = null;

const slug = "purlfy";
const name = LiteLoader.plugins[slug].manifest.name;
const isDebug = process.argv.includes(`--${slug}-debug`);
const log = isDebug ? console.log.bind(console, "\x1b[36m%s\x1b[0m", `[${name}]`) : () => { };

const pluginPath = LiteLoader.plugins[slug].path.plugin;
const rulesPath = path.join(pluginPath, "rules.json");
const statistics = LiteLoader.api.config.get(slug, {
    url: 0,
    param: 0,
    char: 0
});
log("Statistics loaded:", statistics);

function loadRules() {
    try {
        rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    } catch (e) {
        log("Error loading rules:", e);
    } finally {
        log(`Rules for ${Object.keys(rules).length} domains loaded.`)
    }
}

function removeSlashes(pathname) { // Remove leading and trailing slashes
    return pathname.replace(/^\/+|\/+$/g, "");
}

function purifyURL(url) {
    if (!url.startsWith("http")) { // Not a valid URL
        return url;
    }
    try {
        var urlObj = new URL(url);
    } catch (e) {
        log(`Error parsing URL ${url}:`, e);
        return url;
    }
    const protocol = urlObj.protocol;
    if (protocol !== "http:" && protocol !== "https:") { // Not a valid HTTP URL
        return url;
    }
    const host = urlObj.host ?? "";
    const pathname = removeSlashes(urlObj.pathname) ?? "";
    const rule = rules[host]?.[pathname] ?? rules[host]?.[""] ?? rules[""]?.[""];
    log(`Matching rule for ${url}:`, rule);
    if (!rule) { // No matching rule found
        return url;
    }
    const mode = rule.mode;
    const params = rule.params;
    const paramsCntBefore = urlObj.searchParams.size
    switch (mode) {
        case 0: { // Whitelist mode
            const newParams = new URLSearchParams();
            for (const param of params) {
                if (urlObj.searchParams.has(param)) {
                    newParams.set(param, urlObj.searchParams.get(param));
                }
            }
            urlObj.search = newParams.toString();
            break;
        }
        case 1: { // Blacklist mode
            for (const param of params) {
                urlObj.searchParams.delete(param);
            }
            break;
        }
        case 2: { // Regex mode
            log("Regex mode not implemented yet");
            break;
        }
        case 3: { // Decode mode
            // Decode given parameter to be used as a new URL
            log("Decode mode not implemented yet");
            break;
        }
        default: {
            log("Invalid mode:", mode);
            break;
        }
    }
    const newURL = urlObj.toString();
    const paramsCntAfter = urlObj.searchParams.size;
    log(`Purified URL:`, newURL);
    statistics.url++;
    statistics.param += paramsCntBefore - paramsCntAfter;
    statistics.char += url.length - newURL.length;
    notifyStatisticsChange();
    return {
        url: newURL,
        rule: rule
    };
}

function notifyStatisticsChange() {
    if (settingWindow) {
        settingWindow.webContents.send("LiteLoader.purlfy.statisticsChange", statistics);
    }
}

// Load rules
loadRules();

// IPC handlers
ipcMain.on("LiteLoader.purlfy.reloadRules", () => {
    loadRules();
});
ipcMain.handle("LiteLoader.purlfy.getStatistics", (event) => {
    settingWindow = BrowserWindow.fromWebContents(event.sender);
    log("Setting window created");
    settingWindow.on("closed", () => {
        log("Setting window closed");
        settingWindow = null;
    });
    return statistics;
});
ipcMain.handle("LiteLoader.purlfy.queryIsDebug", () => {
    return isDebug;
});
ipcMain.handle("LiteLoader.purlfy.purify", (event, url) => {
    return purifyURL(url);
});

// Hooks
const originalOpen = shell.openExternal;
shell.openExternal = function (url, options) {
    return originalOpen(purifyURL(url).url, options);
};

// Cleanup
app.on("will-quit", () => {
    LiteLoader.api.config.set(slug, statistics);
    log("Statistics saved:", statistics);
});
