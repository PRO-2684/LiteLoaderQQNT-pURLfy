const slug = "purlfy";
const pluginPath = LiteLoader.plugins[slug].path.plugin.replace(":\\", "://").replaceAll("\\", "/"); // Normalized plugin path

async function onSettingWindowCreated(view) {
    const $ = view.querySelector.bind(view);
    view.innerHTML = await (await fetch(`local:///${pluginPath}/settings.html`)).text();
    const logo = $(".logo");
    logo.src = `local:///${pluginPath}/icons/icon.svg`;
    purlfy.queryIsDebug().then(isDebug => {
        if (isDebug) {
            $("#purlfy-debug").toggleAttribute("is-active", isDebug);
        }
    });
    const input = $("#purlfy-clean-input");
    input.addEventListener("keyup", async (event) => {
        if (event.key === "Enter") {
            const result = input.value ? await purlfy.purify(input.value) : { url: "", rule: "" };
            $("#purlfy-clean-url").value = result.url;
            $("#purlfy-clean-rule").value = result.rule;
        }
    });
    $("#purlfy-reload-rules").addEventListener("click", purlfy.reloadRules);

    // Statistics and temp disable
    const tempDisableButton = $("#purlfy-temp-disable");
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
    async function updateTempDisable(tempDisable) {
        tempDisableButton.toggleAttribute("is-active", tempDisable);
        tempDisableButton.parentElement.classList.toggle("is-loading", false);
    }
    tempDisableButton.addEventListener("click", async () => {
        tempDisableButton.parentElement.classList.toggle("is-loading", true);
        purlfy.setTempDisable(!tempDisableButton.hasAttribute("is-active"));
    });
    purlfy.onStatisticsChange(async (event, statistics) => {
        updateStatistics(statistics);
    });
    purlfy.onTempDisableChange(async (event, tempDisable) => {
        updateTempDisable(tempDisable);
    });
    const info = await purlfy.getInfo();
    updateStatistics(info.statistics);
    updateTempDisable(info.tempDisable);
}

export {
    onSettingWindowCreated
}