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
const data = LiteLoader.api.config.get(slug, {
    statistics: {
        url: 0,
        param: 0,
        decoded: 0,
        char: 0
    },
    lambdaEnabled: false,
});
let { statistics, lambdaEnabled } = data;
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

// === pURLfy CORE start ===

const decoders = {
    "url": decodeURIComponent,
    "base64": atob,
};

function validRule(rule) { // Check if the given rule is valid
    if (!rule || !rule.mode || !rule.description || !rule.author) return false;
    switch (rule.mode) {
        case "white":
        case "black":
            return Array.isArray(rule.params);
        case "regex":
            return false; // Not implemented yet
        case "param":
            return Array.isArray(rule.params) && Array.isArray(rule.decode);
        case "lambda":
            return lambdaEnabled && typeof rule.lambda === "string";
        default:
            return false;
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
        const possibleRule = nestedMatchedRule ?? currentRules[rulePath];
        if (isMatched && matchedParts > maxMatchedParts && validRule(possibleRule)) {
            matchedRule = possibleRule;
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
    let urlObj;
    try {
        urlObj = new URL(url);
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
    if (!rule) { // No matching rule found
        log(`No matching rule found for ${url}.`);
        return url;
    }
    log(`Matching rule for ${url}: ${rule.description} by ${rule.author}`);
    const mode = rule.mode;
    const paramsCntBefore = urlObj.searchParams.size
    switch (mode) {
        case "white": { // Whitelist mode
            const newParams = new URLSearchParams();
            for (const param of rule.params) {
                if (urlObj.searchParams.has(param)) {
                    newParams.set(param, urlObj.searchParams.get(param));
                }
            }
            urlObj.search = newParams.toString();
            break;
        }
        case "black": { // Blacklist mode
            for (const param of rule.params) {
                urlObj.searchParams.delete(param);
            }
            break;
        }
        case "regex": { // Regex mode
            log("Regex mode not implemented yet");
            break;
        }
        case "param": { // Specific param mode
            // Decode given parameter to be used as a new URL
            let paramValue = null;
            for (const param of rule.params) { // Find the first available parameter value
                if (urlObj.searchParams.has(param)) {
                    paramValue = urlObj.searchParams.get(param);
                    break;
                }
            }
            if (!paramValue) {
                log("Parameter(s) not found:", rule.params.join(", "));
                break;
            }
            let dest = paramValue;
            for (const name of rule.decode) {
                const decoder = decoders[name] ?? (s => s);
                dest = decoder(dest);
            }
            log(`Decoded URL: ${dest}`);
            if (rule.recursive ?? true) { // Recursively purify the decoded URL, default to true
                log("Recursive purifying... {");
                dest = purifyURL(dest).url;
                log("} Recursive purifying finished.");
            }
            urlObj = new URL(dest);
            break;
        }
        case "lambda": {
            if (!lambdaEnabled) {
                log("Lambda mode is disabled.");
                break;
            }
            try {
                const lambda = new Function("url", rule.lambda);
                urlObj = lambda(urlObj);
            } catch (e) {
                log("Error executing lambda:", e);
            }
            if (rule.recursive ?? true) { // Recursively purify the decoded URL, default to true
                log("Recursive purifying... {");
                urlObj = new URL(purifyURL(urlObj.href).url);
                log("} Recursive purifying finished.");
            }
            break;
        }
        default: {
            log("Invalid mode:", mode);
            break;
        }
    }
    const newURL = urlObj.href;
    const paramsCntAfter = urlObj.searchParams.size;
    if (newURL === url) { // No changes made
        log("No changes made to URL:", url);
        return {
            url: url,
            rule: `* ${rule.description} by ${rule.author}`
        };
    }
    log(`Purified URL:`, newURL);
    statistics.url++;
    statistics.param += (["white", "black"].includes(mode)) ? (paramsCntBefore - paramsCntAfter) : 0;
    statistics.decoded += (mode === "param") ? 1 : 0;
    statistics.char += Math.max(url.length - newURL.length, 0); // Prevent negative char count
    notifyStatisticsChange();
    return {
        url: newURL,
        rule: `${rule.description} by ${rule.author}`
    };
}

// === pURLfy CORE end ===

function notifyStatisticsChange() { // Notify the setting window about statistics change
    if (settingWindow) {
        log("Notify statistics change");
        settingWindow.webContents.send("LiteLoader.purlfy.statisticsChange", statistics);
    }
}

function notifyLambdaEnabledChange() { // Notify the setting window about lambda enabled change
    if (settingWindow) {
        log("Notify lambda enabled change:", lambdaEnabled);
        settingWindow.webContents.send("LiteLoader.purlfy.lambdaEnabledChange", lambdaEnabled);
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
    if (lambdaEnabled === value) {
        return;
    }
    lambdaEnabled = value;
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
        statistics: statistics,
        tempDisable: tempDisable,
        isDebug: isDebug,
        lambdaEnabled: lambdaEnabled
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
    LiteLoader.api.config.set(slug, {
        statistics: statistics,
        lambdaEnabled: lambdaEnabled
    });
    log("Statistics saved:", statistics);
});
