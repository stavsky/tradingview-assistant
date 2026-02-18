const UI_SCHEMA = {
    branding: {
        appTitle: "TradingView Assistant",
    },
    sections: {
        usability: {
            title: "Keyboard Navigation",
            options: {
                enableArrowsForChartNav: "Fast chart scrolling using Left/Right keys",
                disableUpDownForSymbols: "Disable symbol change using Up/Down keys",
                disableSpaceForSymbols: "Disable symbol change using Space key"
            }
        },
        zoom: {
            title: "Vertical Zoom",
            options: {
                enableAltMouseWheelForVZoom: "Using Alt + Mouse wheel",
                enableAltUpDownKeysForVZoom: "Using Alt + Up/Down keys",
                enableAltMouseDragForVZoom: "Using Alt + Mouse drag",
            }
        },

    }
};

// Flatten all option keys for storage access
const ALL_KEYS = Object.values(UI_SCHEMA.sections).flatMap(s => Object.keys(s.options));

document.addEventListener('DOMContentLoaded', () => {
    // 1. HYDRATE BRANDING
    const headerEl = document.querySelector('[data-header]');
    if (headerEl) {
        headerEl.textContent = UI_SCHEMA.branding.appTitle;
        console.log("Header injected:", UI_SCHEMA.branding.appTitle);
    } else {
        console.error("Data-header element not found!");
    }

    // 2. HYDRATE SECTIONS & LABELS
    Object.entries(UI_SCHEMA.sections).forEach(([sectionKey, sectionData]) => {
        const titleEl = document.querySelector(`[data-section="${sectionKey}"]`);
        if (titleEl) titleEl.textContent = sectionData.title;

        Object.entries(sectionData.options).forEach(([key, labelText]) => {
            const labelEl = document.querySelector(`[data-label="${key}"]`);
            if (labelEl) labelEl.textContent = labelText;
        });
    });

    // 3. STORAGE LOGIC
    chrome.storage.sync.get(ALL_KEYS, (data) => {
        ALL_KEYS.forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                el.checked = (data[key] === undefined) ? true : data[key];
                el.addEventListener('change', () => {
                    chrome.storage.sync.set({ [key]: el.checked });
                });
            }
        });
    });
});

// Live Sync
chrome.storage.onChanged.addListener((changes) => {
    for (let [key, { newValue }] of Object.entries(changes)) {
        const el = document.getElementById(key);
        if (el) el.checked = newValue;
    }
});