const CONFIG = {
    // API mode:
    // - 'local' → use Flask backend at the same origin (recommended when running `python server.py`)
    // - 'piped' → use public Piped instances only (for static hosting like GitHub Pages)
    mode: 'local',

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
