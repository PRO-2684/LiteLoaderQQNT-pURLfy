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
            const result = await purlfy.purify(input.value);
            $("#purlfy-clean-url").value = result.url;
            $("#purlfy-clean-rule").value = JSON.stringify(result.rule);
        }
    });
    $("#purlfy-reload-rules").addEventListener("click", purlfy.reloadRules);

    // Statistics
    function format(number) { // Format to readable number (using K, M, G etc.)
        const suffixes = ["", "K", "M", "G", "T", "P", "E", "Z", "Y"];
        let i = 0;
        while (number >= 1000) {
            number /= 1000;
            i++;
        }
        return `${number.toFixed(2)} ${suffixes[i]}`;
    }
    async function updateStatistics(statistics) {
        for (const [key, value] of Object.entries(statistics)) {
            const el = $(`#purlfy-statistics-${key}`);
            if (el) {
                el.textContent = value;
            }
        }
    }
    purlfy.onStatisticsChange(async (event, statistics) => {
        updateStatistics(statistics);
    });
    const statistics = await purlfy.getStatistics();
    updateStatistics(statistics);
}

export {
    onSettingWindowCreated
}