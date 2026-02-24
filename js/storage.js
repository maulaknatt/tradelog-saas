/**
 * storage.js
 * All localStorage access is centralised here.
 * Provides integrity checks, import, and export.
 */

const Storage = (() => {
    const KEY = 'tradelog_v2';

    const DEFAULT_STATE = {
        user: null,
        accounts: [],
        trades: [],
        activeAccountId: 'all',
        activeTypeFilter: 'all',
        viewingAccountId: null,
        currentView: 'dashboard',
        lastAccountId: null,
        pagination: { currentPage: 1, itemsPerPage: 10 }
    };

    /** Load and integrity-check state from localStorage */
    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return deepClone(DEFAULT_STATE);

            const parsed = JSON.parse(raw);

            // Integrity: ensure top-level keys exist
            const state = { ...deepClone(DEFAULT_STATE), ...parsed };

            // Ensure arrays
            if (!Array.isArray(state.accounts)) state.accounts = [];
            if (!Array.isArray(state.trades)) state.trades = [];

            // Ensure pagination object
            if (typeof state.pagination !== 'object' || state.pagination === null) {
                state.pagination = { ...DEFAULT_STATE.pagination };
            }

            // Sanitise trades
            state.trades = state.trades.map(sanitiseTrade).filter(Boolean);

            // Sanitise accounts
            state.accounts = state.accounts.map(sanitiseAccount).filter(Boolean);

            return state;
        } catch (e) {
            console.error('[Storage] Load error, resetting:', e);
            return deepClone(DEFAULT_STATE);
        }
    }

    /** Persist state to localStorage */
    function save(state) {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {
            console.error('[Storage] Save error:', e);
        }
    }

    /** Export full state as JSON file download */
    function exportJSON(state) {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tradelog_backup_${new Date().toISOString().substring(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import JSON file.
     * Returns a Promise that resolves with the parsed state, or rejects on error.
     */
    function importJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.type !== 'application/json') {
                reject(new Error('Please select a valid JSON file.'));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    // Basic validation
                    if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.trades)) {
                        reject(new Error('Invalid backup file structure.'));
                        return;
                    }
                    resolve({ ...deepClone(DEFAULT_STATE), ...parsed });
                } catch (err) {
                    reject(new Error('Failed to parse JSON file.'));
                }
            };
            reader.onerror = () => reject(new Error('File read error.'));
            reader.readAsText(file);
        });
    }

    // --- Helpers ---
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function sanitiseTrade(t) {
        if (!t || typeof t !== 'object') return null;
        return {
            id: String(t.id || `tr_${Date.now()}_${Math.random()}`),
            accountId: String(t.accountId || ''),
            date: String(t.date || ''),
            pair: String(t.pair || 'XAUUSD'),
            tf: String(t.tf || ''),
            dir: t.dir === 'Sell' ? 'Sell' : 'Buy',
            lot: Math.max(0, parseFloat(t.lot) || 0),
            entry: parseFloat(t.entry) || 0,
            close: parseFloat(t.close) || 0,
            pips: parseFloat(t.pips) || 0,
            sl: parseFloat(t.sl) || 0,
            tp: parseFloat(t.tp) || 0,
            result: parseFloat(t.result) || 0,
            isManualResult: !!t.isManualResult,
            risk: parseFloat(t.risk) || 0,
            emotion: String(t.emotion || ''),
            notes: String(t.notes || '')
        };
    }

    function sanitiseAccount(a) {
        if (!a || typeof a !== 'object') return null;
        return {
            id: String(a.id || `acc_${Date.now()}`),
            name: String(a.name || 'Unnamed Account'),
            type: a.type === 'Cent' ? 'Cent' : 'Standard',
            initialBalance: Math.max(0, parseFloat(a.initialBalance) || 0),
            createdAt: String(a.createdAt || new Date().toISOString())
        };
    }

    return { load, save, exportJSON, importJSON };
})();
