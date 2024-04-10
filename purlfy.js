class Purlfy extends EventTarget {
    redirectEnabled = false;
    lambdaEnabled = false;
    maxIterations = 5;
    #log = console.log.bind(console, "\x1b[38;2;220;20;60m[pURLfy]\x1b[0m");
    #paramDecoders = {
        "url": decodeURIComponent,
        "base64": s => decodeURIComponent(escape(atob(s.replaceAll('_', '/').replaceAll('-', '+')))),
        "slice": (s, start, end) => s.slice(parseInt(start), end ? parseInt(end) : undefined),
    };
    #statistics = {
        url: 0,
        param: 0,
        decoded: 0,
        redirected: 0,
        char: 0
    };
    #rules = {};

    constructor(options) {
        super();
        this.redirectEnabled = options?.redirectEnabled ?? this.redirectEnabled;
        this.lambdaEnabled = options?.lambdaEnabled ?? this.lambdaEnabled;
        this.maxIterations = options?.maxIterations ?? this.maxIterations;
        Object.assign(this.#statistics, options?.statistics);
        this.#log = options?.log ?? this.#log;
    }

    clearStatistics() {
        this.#statistics = {
            url: 0,
            param: 0,
            decoded: 0,
            redirected: 0,
            char: 0
        };
        this.#onStatisticsChange();
    }

    clearRules() {
        this.#rules = {};
    }

    getStatistics() {
        return this.#statistics;
    }

    importRules(rules) {
        Object.assign(this.#rules, rules);
    }

    #udfOrType(value, type) { // If the given value is of the given type or undefined
        return value === undefined || typeof value === type;
    }

    #validRule(rule) { // Check if the given rule is valid
        if (!rule || !rule.mode || !rule.description || !rule.author) return false;
        switch (rule.mode) {
            case "white":
            case "black":
                return Array.isArray(rule.params);
            case "param":
                return Array.isArray(rule.params) && (rule.decode === undefined || Array.isArray(rule.decode)) && this.#udfOrType(rule.continue, "boolean");
            case "regex":
                return false; // Not implemented yet
            case "redirect":
                return this.redirectEnabled && this.#udfOrType(rule.continue, "boolean");
            case "lambda":
                return this.lambdaEnabled && typeof rule.lambda === "string" && this.#udfOrType(rule.continue, "boolean");
            default:
                return false;
        }
    }

    #matchRule(parts) { // Iteratively match the longest rule for the given URL parts
        let fallbackRule = null; // Most precise fallback rule
        let currentRules = this.#rules;
        for (const part of parts) {
            if (currentRules.hasOwnProperty("")) {
                fallbackRule = currentRules[""];
            }
            if (currentRules.hasOwnProperty(part + "/")) {
                currentRules = currentRules[part + "/"];
            } else if (currentRules.hasOwnProperty(part)) {
                const rule = currentRules[part];
                if (this.#validRule(rule)) {
                    return rule;
                }
            }
        }
        if (this.#validRule(fallbackRule)) {
            return fallbackRule;
        }
        return null;
    }

    async #applyRule(urlObj, rule, logFunc) { // Apply the given rule to the given URL object, returning the new URL object and whether to continue
        const mode = rule.mode;
        const lengthBefore = urlObj.href.length;
        const paramsCntBefore = urlObj.searchParams.size;
        let shallContinue = false;
        switch (mode) { // Purifies `urlObj` based on the rule
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
                    logFunc("Parameter(s) not found:", rule.params.join(", "));
                    break;
                }
                let dest = paramValue;
                let success = true;
                for (const cmd of (rule.decode ?? ["url"])) {
                    const args = cmd.split(":");
                    const name = args[0];
                    const decoder = this.#paramDecoders[name];
                    if (!decoder) {
                        logFunc("Invalid decoder:", cmd);
                        success = false;
                        break;
                    }
                    try {
                        dest = decoder(dest, ...args.slice(1));
                    } catch (e) {
                        logFunc(`Error decoding parameter with decoder "${name}":`, e);
                        break;
                    }
                }
                if (!success) break;
                if (URL.canParse(dest)) { // Valid URL
                    urlObj = new URL(dest);
                } else { // Invalid URL
                    logFunc("Invalid URL:", dest);
                    break;
                }
                shallContinue = rule.continue ?? true;
                this.#statistics.decoded++;
                break;
            }
            case "regex": { // Regex mode
                logFunc("Regex mode not implemented yet");
                break;
            }
            case "redirect": { // Redirect mode
                if (!this.redirectEnabled) {
                    logFunc("Redirect mode is disabled.");
                    break;
                }
                let r = null;
                try {
                    r = await fetch(urlObj.href, {
                        method: "HEAD",
                        redirect: "manual"
                    });
                } catch (e) {
                    logFunc("Error fetching URL:", e);
                    break;
                }
                if ((r.status === 301 || r.status === 302) && r.headers.has("location")) {
                    let dest = r.headers.get("location");
                    urlObj = new URL(dest);
                    shallContinue = rule.continue ?? true;
                    this.#statistics.redirected++;
                }
                break;
            }
            case "lambda": {
                if (!this.lambdaEnabled) {
                    logFunc("Lambda mode is disabled.");
                    break;
                }
                try {
                    const lambda = new Function("url", rule.lambda);
                    urlObj = lambda(urlObj);
                    shallContinue = rule.continue ?? true;
                } catch (e) {
                    logFunc("Error executing lambda:", e);
                }
                break;
            }
            default: {
                logFunc("Invalid mode:", mode);
                break;
            }
        }
        const paramsCntAfter = urlObj.searchParams.size;
        this.#statistics.param += (["white", "black"].includes(mode)) ? (paramsCntBefore - paramsCntAfter) : 0;
        this.#statistics.char += Math.max(lengthBefore - urlObj.href.length, 0); // Prevent negative char count
        return [urlObj, shallContinue];
    }

    #onStatisticsChange() {
        if (typeof CustomEvent === "function") {
            this.dispatchEvent(new CustomEvent("statisticschange", {
                detail: this.#statistics
            }));
        } else {
            this.dispatchEvent(new Event("statisticschange"));
        }
    }

    async purify(originalUrl) { // Purify the given URL based on `rules`
        let shallContinue = true;
        let firstRule = null;
        let iteration = 0;
        let urlObj;
        this.#log("Purifying URL:", originalUrl);
        if (URL.canParse(originalUrl)) {
            urlObj = new URL(originalUrl);
        } else {
            log(`Cannot parse URL ${originalUrl}`);
            return originalUrl;
        }
        while (shallContinue && iteration++ < this.maxIterations) {
            const logi = (...args) => this.#log(`[#${iteration}]`, ...args);
            const protocol = urlObj.protocol;
            if (protocol !== "http:" && protocol !== "https:") { // Not a valid HTTP URL
                logi(`Not a HTTP URL: ${urlObj.href}`);
                return urlObj.href;
            }
            const hostAndPath = urlObj.host + urlObj.pathname;
            const parts = hostAndPath.split("/").filter(part => part !== "");
            const rule = this.#matchRule(parts);
            if (!rule) { // No matching rule found
                logi(`No matching rule found for ${urlObj.href}.`);
                return urlObj.href;
            }
            firstRule ??= rule;
            logi(`Matching rule: ${rule.description} by ${rule.author}`);
            [urlObj, shallContinue] = await this.#applyRule(urlObj, rule, logi);
            logi("Purified URL:", urlObj.href);
        }
        if (originalUrl === urlObj.href) { // No changes made
            this.#log("No changes made.");
            return {
                url: originalUrl,
                rule: `* ${firstRule.description} by ${firstRule.author}`
            };
        }
        this.#statistics.url++;
        this.#onStatisticsChange();
        return {
            url: urlObj.href,
            rule: `${firstRule.description} by ${firstRule.author}`
        };
    }
}

module.exports = Purlfy;
