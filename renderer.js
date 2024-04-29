const pluginPath = LiteLoader.plugins.purlfy.path.plugin.replace(":\\", "://").replaceAll("\\", "/"); // Normalized plugin path

async function onSettingWindowCreated(view) {
    const $ = view.querySelector.bind(view);
    view.innerHTML = await (await fetch(`local:///${pluginPath}/settings.html`)).text();
    const input = $("#purlfy-clean-input");
    const outputUrl = $("#purlfy-clean-url");
    const outputRule = $("#purlfy-clean-rule");
    input.addEventListener("keyup", async (event) => {
        if (event.key === "Enter") {
            if (!input.value) {
                input.value = input.getAttribute("placeholder");
            }
            input.toggleAttribute("disabled", true);
            input.parentElement.classList.toggle("is-loading", true);
            const result = await purlfy.purify(input.value);
            input.parentElement.classList.toggle("is-loading", false);
            input.toggleAttribute("disabled", false);
            outputUrl.value = result.url;
            outputRule.value = result.rule;
        }
    });
    async function onUpdateRules() {
        this.parentElement.classList.toggle("is-loading", true);
        const r = await purlfy.updateRules();
        this.textContent = r ? "更新成功" : "暂无更新";
        if (r) {
            this.removeEventListener("click", onUpdateRules);
            this.title = "点击重新加载规则";
            this.addEventListener("click", async function () {
                this.parentElement.classList.toggle("is-loading", true);
                await purlfy.reloadRules();
                location.reload();
            });
            this.parentElement.classList.toggle("is-loading", false);
        } else {
            setTimeout(() => {
                this.textContent = "更新规则";
                this.parentElement.classList.toggle("is-loading", false);
            }, 2000);
        }
    }
    async function onReloadRules() {
        this.parentElement.classList.toggle("is-loading", true);
        await purlfy.reloadRules();
        location.reload();
    }
    $("#purlfy-update-rules").addEventListener("click", onUpdateRules);
    $("#purlfy-reload-rules").addEventListener("click", onReloadRules);

    // Statistics and switches
    const lambdaEnabledSwitch = $("#purlfy-lambda-enabled");
    const tempDisableSwitch = $("#purlfy-temp-disable");
    function removeTrailingZeroes(s) {
        return s.replace(/\.?0+$/, "");
    }
    function format(number) { // Format to readable number (using K, M, G etc.)
        const suffixes = ["", "K", "M", "G", "T", "P", "E", "Z", "Y"];
        let i = 0;
        while (number >= 1000) {
            number /= 1000;
            i++;
        }
        return `${removeTrailingZeroes(number.toFixed(2))} ${suffixes[i]}`;
    }
    async function updateStatistics(statistics) {
        for (const [key, value] of Object.entries(statistics)) {
            const el = $(`#purlfy-statistics-${key}`);
            if (el) {
                el.textContent = format(value);
                el.title = value;
            }
        }
    }
    async function updateLambdaEnabled(lambdaEnabled) {
        lambdaEnabledSwitch.toggleAttribute("is-active", lambdaEnabled);
        lambdaEnabledSwitch.parentElement.classList.toggle("is-loading", false);
    }
    async function updateTempDisable(tempDisable) {
        tempDisableSwitch.toggleAttribute("is-active", tempDisable);
        tempDisableSwitch.parentElement.classList.toggle("is-loading", false);
    }
    lambdaEnabledSwitch.addEventListener("click", async () => {
        lambdaEnabledSwitch.parentElement.classList.toggle("is-loading", true);
        purlfy.setLambdaEnabled(!lambdaEnabledSwitch.hasAttribute("is-active"));
    });
    tempDisableSwitch.addEventListener("click", async () => {
        tempDisableSwitch.parentElement.classList.toggle("is-loading", true);
        purlfy.setTempDisable(!tempDisableSwitch.hasAttribute("is-active"));
    });
    purlfy.onStatisticsChange(async (event, statistics) => {
        updateStatistics(statistics);
    });
    purlfy.onLambdaEnabledChange(async (event, lambdaEnabled) => {
        updateLambdaEnabled(lambdaEnabled);
    });
    purlfy.onTempDisableChange(async (event, tempDisable) => {
        updateTempDisable(tempDisable);
    });
    const info = await purlfy.getInfo();
    updateStatistics(info.statistics);
    updateLambdaEnabled(info.lambdaEnabled);
    updateTempDisable(info.tempDisable);
    if (info.isDebug) {
        const debugText = $("#purlfy-debug");
        debugText.removeAttribute("title");
        debugText.textContent = "已启用";
    }
    // Rules
    const container = $("setting-section.rules > setting-panel > setting-list");
    function addRules(name, enabled) {
        const item = container.appendChild(document.createElement("setting-item"));
        item.setAttribute("data-direction", "row");
        const left = item.appendChild(document.createElement("div"));
        const itemName = left.appendChild(document.createElement("setting-text"));
        itemName.textContent = name;
        itemName.title = `${name}.min.json`;
        const switch_ = item.appendChild(document.createElement("setting-switch"));
        switch_.toggleAttribute("is-active", enabled);
        switch_.title = "启用/禁用需重载规则生效";
        switch_.addEventListener("click", async function () {
            this.parentElement.toggleAttribute("is-loading", true);
            const result = await purlfy.toggle(name, this.toggleAttribute("is-active"));
            this.parentElement.toggleAttribute("is-loading", false);
            this.toggleAttribute("is-active", result);
        });
    }
    Object.entries(info.rules).forEach(([name, enabled]) => {
        addRules(name, enabled);
    });
    // Logo
    const logo = $(".logo");
    logo.src = `local:///${pluginPath}/icons/icon.svg`;
    // About - Version
    $("#purlfy-version").textContent = LiteLoader.plugins.purlfy.manifest.version;
    // About - Backgroud image
    ["version", "author", "issues"].forEach(id => {
        $(`#purlfy-about-${id}`).style.backgroundImage = `url("local:///${pluginPath}/icons/${id}.svg")`;
    });
    // Links
    function openURL(e) {
        e.preventDefault();
        const url = e.currentTarget.getAttribute("data-purlfy-url");
        if (url) {
            LiteLoader.api.openExternal(url);
        }
    }
    view.querySelectorAll(".purlfy-link").forEach(link => {
        if (!link.hasAttribute("title")) {
            link.setAttribute("title", link.getAttribute("data-purlfy-url"));
        }
        link.addEventListener("click", openURL);
    });
}

export {
    onSettingWindowCreated
}