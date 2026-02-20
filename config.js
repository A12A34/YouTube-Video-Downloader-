const CONFIG = {
    // API mode: 'piped' for GitHub Pages (no backend), 'local' for Flask server
    mode: 'piped',

    // Piped API instances with automatic fallback (used in 'piped' mode)
    // If one instance is down, the next one is tried automatically
    pipedInstances: [
        'https://pipedapi.kavin.rocks',
        'https://pipedapi-libre.kavin.rocks',
        'https://pipedapi.leptons.xyz',
    ],

    // Legacy single-instance setting (first instance in pipedInstances is preferred)
    pipedApiUrl: 'https://pipedapi.kavin.rocks',
};
