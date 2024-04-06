const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, shell, app } = require("electron");
let rules = {};
let settingWindow = null;
let tempDisable = false;

const slug = "purlfy";
const name = LiteLoader.plugins[slug].manifest.name;
const isDebug = process.argv.includes(`--${slug}-debug`);
const log = isDebug ? console.log.bind(console, "\x1b[38;2;220;20;60m%s\x1b[0m", `[${name}]`) : () => { };

const pluginPath = LiteLoader.plugins[slug].path.plugin;
const rulesPath = path.join(pluginPath, "rules.json");
const statistics = LiteLoader.api.config.get(slug, {
    url: 0,
    param: 0,
    char: 0
});
log("Statistics loaded:", statistics);

function loadRules() { // Load rules from `rules.json`
    try {
        rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    } catch (e) {
        log("Error loading rules:", e);
    } finally {
        log(`Rules for ${Object.keys(rules).length} domains loaded.`)
    }
}

function matchRule(parts, currentRules) { // Recursively match the longest rule for the given URL parts
    let matchedRule = null; // Matched rule
    let maxMatchedParts = 0; // Matched parts count
    for (const rulePath in currentRules) {
        if (rulePath === "") continue; // Fallback rule should be handled last
        const ruleParts = rulePath.split("/");
        const effectiveRuleLength = ruleParts[ruleParts.length - 1] === "" ? ruleParts.length - 1 : ruleParts.length; // Ignore trailing slash
        if (effectiveRuleLength > parts.length) { // Impossible to match
            continue;
        }
        let matchedParts = 0;
        let isMatched = true;
        let nestedMatchedRule = null;
        for (let i = 0; i < ruleParts.length; i++) {
            if (ruleParts[i] === parts[i]) {
                matchedParts++;
            } else if (ruleParts[i] === "" && i === ruleParts.length - 1) { // Ending with a slash - recursive matching
                const nextRules = currentRules[rulePath];
                const nextPathParts = parts.slice(i);
                const [nextRule, nextMatchedParts] = matchRule(nextPathParts, nextRules);
                if (nextRule) {
                    matchedParts += nextMatchedParts;
                    nestedMatchedRule = nextRule;
                } else {
                    isMatched = false;
                }
            } else {
                isMatched = false;
                break;
            }
        }
        if (isMatched && matchedParts > maxMatchedParts) {
            matchedRule = nestedMatchedRule ?? currentRules[rulePath];
            maxMatchedParts = matchedParts;
        }
    }
    matchedRule ??= currentRules[""]; // Fallback
    // Returns the matched rule and matched parts count
    return [matchedRule, maxMatchedParts];
}

function purifyURL(url) { // Purify the given URL based on `rules`
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
    const hostAndPath = urlObj.host + urlObj.pathname;
    const parts = hostAndPath.split("/").filter(part => part !== "");
    const rule = matchRule(parts, rules)[0];
    log(`Matching rule for ${url}: ${rule.description} by ${rule.author}`);
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
    if (newURL === url) { // No changes made
        log("No changes made to URL:", url);
        return {
            url: url,
            rule: ""
        };
    }
    log(`Purified URL:`, newURL);
    statistics.url++;
    statistics.param += paramsCntBefore - paramsCntAfter;
    statistics.char += url.length - newURL.length;
    notifyStatisticsChange();
    return {
        url: newURL,
        rule: `${rule.description} by ${rule.author}`
    };
}

function notifyStatisticsChange() { // Notify the setting window about statistics change
    if (settingWindow) {
        log("Notify statistics change");
        settingWindow.webContents.send("LiteLoader.purlfy.statisticsChange", statistics);
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
        statistics: statistics,
        tempDisable: tempDisable,
        isDebug: isDebug
    };
});
ipcMain.handle("LiteLoader.purlfy.purify", (event, url) => {
    return purifyURL(url);
});

// Hooks
const originalOpen = shell.openExternal;
shell.openExternal = function (url, options) {
    return originalOpen(tempDisable ? url : purifyURL(url).url, options);
};

// Cleanup - Save statistics
app.on("will-quit", () => {
    LiteLoader.api.config.set(slug, statistics);
    log("Statistics saved:", statistics);
});
