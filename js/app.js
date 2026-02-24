/**
 * app.js  —  TradeLog v2 Main Orchestrator
 * Depends on: calculations.js, storage.js, validation.js, ui.js
 */

const app = {

    // ---------------------------------------------------------------- STATE
    state: null,

    // ---------------------------------------------------------------- INIT
    init() {
        this.state = Storage.load();

        if (document.getElementById('view-container')) {
            this._initDashboard();
        } else if (document.getElementById('loginForm')) {
            this._initLogin();
        }
    },

    _initDashboard() {
        if (!this.state.user) {
            window.location.href = 'index.html';
            return;
        }

        this._setupNav();
        this._setupDashboardSelectors();
        this._setupModalListeners();
        this._setupDataIO();
        this._setupImportExport();

        UI.initCharts();

        // Restore last view
        const lastView = this.state.currentView || 'dashboard';
        if (lastView === 'journal' && this.state.lastAccountId) {
            this.viewJournal(this.state.lastAccountId, true);
        } else {
            UI.switchView(lastView, () => this._onViewChanged(lastView));
        }
    },

    _initLogin() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            if (!username) return;
            this.state.user = { username };
            Storage.save(this.state);
            window.location.href = 'dashboard.html';
        });
    },

    // --------------------------------------------------------------- NAV
    _setupNav() {
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.state.currentView = view;
                Storage.save(this.state);
                UI.switchView(view, () => this._onViewChanged(view));
            });
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.state.user = null;
            Storage.save(this.state);
            window.location.href = 'index.html';
        });

        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            UI.toggleSidebar();
        });
        document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
            UI.toggleSidebar(true);
        });
    },

    _onViewChanged(viewId) {
        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'accounts') this.renderAccountsList();
        if (viewId === 'settings') this.renderSettings();
    },

    // ------------------------------------------------ DASHBOARD SELECTORS
    _setupDashboardSelectors() {
        const typeFilter = document.getElementById('activeTypeFilter');
        const accSelect = document.getElementById('activeAccountSelect');

        if (typeFilter) {
            typeFilter.value = this.state.activeTypeFilter;
            typeFilter.addEventListener('change', (e) => {
                this.state.activeTypeFilter = e.target.value;
                // Reset account selection when type changes
                this.state.activeAccountId = 'all';
                Storage.save(this.state);
                this.updateAccountSelectors();
                this.renderDashboard();
                this._updateDashboardCharts();
            });
        }

        if (accSelect) {
            accSelect.addEventListener('change', (e) => {
                this.state.activeAccountId = e.target.value;
                Storage.save(this.state);
                this.renderDashboard();
                this._updateDashboardCharts();
            });
        }
    },

    // -------------------------------------------------- MODAL LISTENERS
    _setupModalListeners() {
        // Account form
        document.getElementById('accountForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAccountSubmit();
        });

        // Trade form
        document.getElementById('tradeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTradeSubmit();
        });

        // Live trade form calculations
        ['tradeEntry', 'tradeClose', 'tradeLot', 'tradeSL', 'tradeTP'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.updateTradeFormCalculations();
            });
        });
        document.getElementById('tradeDir')?.addEventListener('change', () => {
            this.updateTradeFormCalculations();
        });

        // Modal close on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) UI.closeModal(modal.id);
            });
        });

        // ESC key closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.modal-open').forEach(m => {
                    UI.closeModal(m.id);
                });
            }
        });
    },

    // ------------------------------------------- IMPORT / EXPORT
    _setupImportExport() {
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            Storage.exportJSON(this.state);
            UI.toast('Backup exported successfully!', 'success');
        });

        document.getElementById('importBtn')?.addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const ok = await UI.confirm('Importing will REPLACE all current data. Are you sure?');
            if (!ok) { e.target.value = ''; return; }

            try {
                const newState = await Storage.importJSON(file);
                newState.user = this.state.user; // keep current user session
                this.state = newState;
                Storage.save(this.state);
                UI.toast('Data imported successfully!', 'success');
                this.renderDashboard();
                this.renderAccountsList();
                this._updateDashboardCharts();
                this.updateAccountSelectors();
            } catch (err) {
                UI.toast(err.message, 'error');
            } finally {
                e.target.value = '';
            }
        });
    },

    // ------------------------------------------- DATA IO BUTTONS
    _setupDataIO() {
        // handled via _setupImportExport
    },

    // ================================================================
    //  ACCOUNT CRUD
    // ================================================================
    showAccountModal(accountId = null) {
        const form = document.getElementById('accountForm');
        form.reset();
        document.querySelector('.form-error-banner')?.remove();

        if (accountId) {
            const acc = this.state.accounts.find(a => a.id === accountId);
            if (!acc) return;
            document.getElementById('accountModalTitle').textContent = 'Edit Account';
            document.getElementById('accountModalSubmit').textContent = 'Save Changes';
            document.getElementById('editAccountId').value = acc.id;
            document.getElementById('accName').value = acc.name;
            document.getElementById('accType').value = acc.type;
            document.getElementById('accBalance').value = acc.initialBalance;
        } else {
            document.getElementById('accountModalTitle').textContent = 'Add New Account';
            document.getElementById('accountModalSubmit').textContent = 'Create Account';
            document.getElementById('editAccountId').value = '';
        }

        UI.openModal('accountModal');
    },

    handleAccountSubmit() {
        const data = {
            name: document.getElementById('accName').value.trim(),
            type: document.getElementById('accType').value,
            initialBalance: parseFloat(document.getElementById('accBalance').value)
        };

        const { valid, errors } = Validation.validateAccount(data);
        if (!valid) { UI.showFormErrors(errors); return; }
        document.querySelector('.form-error-banner')?.remove();

        const id = document.getElementById('editAccountId').value;
        if (id) {
            const idx = this.state.accounts.findIndex(a => a.id === id);
            if (idx !== -1) Object.assign(this.state.accounts[idx], data);
        } else {
            this.state.accounts.push({
                id: 'acc_' + Date.now(),
                createdAt: new Date().toISOString(),
                ...data
            });
        }

        Storage.save(this.state);
        UI.closeModal('accountModal');
        UI.toast(id ? 'Account updated!' : 'Account created!', 'success');
        this.renderAccountsList();
        this.updateAccountSelectors();
        this.renderDashboard();
    },

    async deleteAccount(id) {
        const ok = await UI.confirm('Delete this account and ALL its trades? This cannot be undone.');
        if (!ok) return;

        this.state.accounts = this.state.accounts.filter(a => a.id !== id);
        this.state.trades = this.state.trades.filter(t => t.accountId !== id);

        if (this.state.activeAccountId === id) this.state.activeAccountId = 'all';
        if (this.state.viewingAccountId === id) this.state.viewingAccountId = null;
        if (this.state.lastAccountId === id) this.state.lastAccountId = null;

        Storage.save(this.state);
        UI.toast('Account deleted.', 'warning');
        this.renderAccountsList();
        this.updateAccountSelectors();
        this.renderDashboard();

        // If we were in journal, go back to accounts
        if (this.state.currentView === 'journal') {
            UI.switchView('accounts', () => this.renderAccountsList());
        }
    },

    // ================================================================
    //  TRADE CRUD
    // ================================================================
    showTradeModal(tradeId = null) {
        if (this.state.accounts.length === 0) {
            UI.toast('Please create an account first.', 'error');
            return;
        }

        const form = document.getElementById('tradeForm');
        form.reset();
        document.querySelector('.form-error-banner')?.remove();

        if (tradeId) {
            const t = this.state.trades.find(tr => tr.id === tradeId);
            if (!t) return;
            document.getElementById('tradeModalTitle').textContent = 'Edit Trade';
            document.getElementById('tradeModalSubmit').textContent = 'Save Changes';
            document.getElementById('editTradeId').value = t.id;
            document.getElementById('tradeDate').value = t.date;
            document.getElementById('tradePair').value = t.pair;
            document.getElementById('tradeTF').value = t.tf;
            document.getElementById('tradeDir').value = t.dir;
            document.getElementById('tradeLot').value = t.lot;
            document.getElementById('tradeEntry').value = t.entry;
            document.getElementById('tradeClose').value = t.close || '';
            document.getElementById('tradeSL').value = t.sl || '';
            document.getElementById('tradeTP').value = t.tp || '';
            document.getElementById('tradeRisk').value = t.risk || '';
            document.getElementById('tradeEmotion').value = t.emotion || '';
            document.getElementById('tradeNotes').value = t.notes || '';
            document.getElementById('tradeManualResult').checked = t.isManualResult || false;
        } else {
            document.getElementById('tradeModalTitle').textContent = 'Add New Trade';
            document.getElementById('tradeModalSubmit').textContent = 'Save Trade';
            document.getElementById('editTradeId').value = '';
            document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('tradePair').value = 'XAUUSD';
            document.getElementById('tradeManualResult').checked = false;
        }

        this.toggleResultMode();
        this.updateTradeFormCalculations();
        UI.openModal('tradeModal');
    },

    handleTradeSubmit() {
        const accId = this.state.viewingAccountId ||
            (this.state.activeAccountId !== 'all'
                ? this.state.activeAccountId
                : this.state.accounts[0]?.id);

        const acc = this.state.accounts.find(a => a.id === accId);
        if (!acc) { UI.toast('No account found.', 'error'); return; }

        const entryVal = document.getElementById('tradeEntry').value;
        const closeVal = document.getElementById('tradeClose').value;
        const slVal = document.getElementById('tradeSL').value;
        const tpVal = document.getElementById('tradeTP').value;
        const lotVal = document.getElementById('tradeLot').value;
        const dir = document.getElementById('tradeDir').value;

        const entry = parseFloat(entryVal);
        const close = closeVal !== '' ? parseFloat(closeVal) : null;
        const sl = slVal !== '' ? parseFloat(slVal) : null;
        const tp = tpVal !== '' ? parseFloat(tpVal) : null;
        const lot = parseFloat(lotVal);

        const isManual = document.getElementById('tradeManualResult').checked;
        let result = parseFloat(document.getElementById('tradeResult').value) || 0;

        if (!isManual && close !== null && isFinite(close)) {
            result = Calc.result(acc.type, dir, entry, close, lot);
        }

        const pips = (close !== null && isFinite(close))
            ? Calc.pips(dir, entry, close)
            : 0;

        const data = {
            date: document.getElementById('tradeDate').value,
            pair: document.getElementById('tradePair').value.trim(),
            tf: document.getElementById('tradeTF').value.trim(),
            dir,
            lot,
            entry,
            close: close,          // null if not entered (open trade)
            pips,
            sl: sl,                // null if not entered
            tp: tp,                // null if not entered
            result,
            isManualResult: isManual,
            risk: parseFloat(document.getElementById('tradeRisk').value) || 0,
            emotion: document.getElementById('tradeEmotion').value.trim(),
            notes: document.getElementById('tradeNotes').value.trim()
        };

        const { valid, errors } = Validation.validateTrade(data);
        if (!valid) { UI.showFormErrors(errors); return; }
        document.querySelector('.form-error-banner')?.remove();

        const id = document.getElementById('editTradeId').value;
        if (id) {
            const idx = this.state.trades.findIndex(t => t.id === id);
            if (idx !== -1) this.state.trades[idx] = { ...this.state.trades[idx], ...data };
        } else {
            this.state.trades.push({ id: 'tr_' + Date.now(), accountId: accId, ...data });
        }

        this.state.pagination.currentPage = 1;
        Storage.save(this.state);
        UI.closeModal('tradeModal');
        UI.toast(id ? 'Trade updated!' : 'Trade saved!', 'success');

        this.renderJournal();
        this.renderDashboard();
        this._updateDashboardCharts();
    },

    async deleteTrade(id) {
        const ok = await UI.confirm('Delete this trade? This cannot be undone.');
        if (!ok) return;

        this.state.trades = this.state.trades.filter(t => t.id !== id);
        Storage.save(this.state);
        UI.toast('Trade deleted.', 'warning');
        this.renderJournal();
        this.renderDashboard();
        this._updateDashboardCharts();
    },

    // ================================================================
    //  LIVE FORM CALCULATIONS
    // ================================================================
    updateTradeFormCalculations() {
        const accId = this.state.viewingAccountId ||
            (this.state.activeAccountId !== 'all'
                ? this.state.activeAccountId
                : this.state.accounts[0]?.id);
        const acc = this.state.accounts.find(a => a.id === accId);

        const entry = parseFloat(document.getElementById('tradeEntry').value);
        const closeEl = document.getElementById('tradeClose');
        const close = parseFloat(closeEl.value);
        const lot = parseFloat(document.getElementById('tradeLot').value);
        const sl = parseFloat(document.getElementById('tradeSL').value);
        const tp = parseFloat(document.getElementById('tradeTP').value);
        const dir = document.getElementById('tradeDir').value;
        const isManual = document.getElementById('tradeManualResult').checked;

        // Entry required before Close
        if (isNaN(entry)) {
            closeEl.disabled = true;
            closeEl.placeholder = 'Enter entry first';
            document.getElementById('tradePips').value = '';
            document.getElementById('tradeRR').value = '';
            if (!isManual) document.getElementById('tradeResult').value = '';
            return;
        }
        closeEl.disabled = false;
        closeEl.placeholder = '';

        // Pips
        if (!isNaN(close)) {
            document.getElementById('tradePips').value = Calc.pips(dir, entry, close).toFixed(1);
        } else {
            document.getElementById('tradePips').value = '';
        }

        // RR
        const rrVal = Calc.rr(dir, entry, sl, tp);
        document.getElementById('tradeRR').value = rrVal !== '-' ? rrVal : '';

        // Result
        if (!isManual && !isNaN(close) && !isNaN(lot) && lot > 0 && acc) {
            const res = Calc.result(acc.type, dir, entry, close, lot);
            document.getElementById('tradeResult').value = res.toFixed(2);
        } else if (!isManual) {
            document.getElementById('tradeResult').value = '';
        }
    },

    toggleResultMode() {
        const isManual = document.getElementById('tradeManualResult').checked;
        const resultEl = document.getElementById('tradeResult');
        if (isManual) {
            resultEl.removeAttribute('readonly');
            resultEl.placeholder = 'e.g. -12.50';
        } else {
            resultEl.setAttribute('readonly', true);
            resultEl.placeholder = 'Auto';
            this.updateTradeFormCalculations();
        }
    },

    // ================================================================
    //  RENDERING — DASHBOARD
    // ================================================================
    renderDashboard() {
        const trades = this._getFilteredTrades();
        const initialBal = this._getDashboardInitialBalance();
        const s = Calc.stats(trades, initialBal);

        const typeFilter = this.state.activeTypeFilter;
        const accType = typeFilter === 'Cent' ? 'Cent' : 'Standard';

        // Stats cards
        this._setText('stat-total-balance', UI.formatCurrency(s.balance, accType));
        this._setText('stat-total-growth', `${s.growth >= 0 ? '+' : ''}${s.growth.toFixed(2)}%`);
        this._setClass('stat-total-growth', s.growth >= 0 ? 'summary-value text-success' : 'summary-value text-danger');
        this._setText('stat-winrate', `${s.winrate.toFixed(1)}%`);
        this._setText('stat-trades', `${s.total}`);
        this._setText('stat-drawdown', `${s.drawdown.toFixed(2)}%`);
        this._setText('stat-profit-factor', s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2));
        this._setText('stat-avg-rr', s.avgRR ? `1 : ${s.avgRR}` : '-');
        this._setText('stat-win-streak', `${s.maxWinStreak}`);
        this._setText('stat-loss-streak', `${s.maxLossStreak}`);

        this.renderRecentTrades(trades);
        this.updateAccountSelectors();
        this._renderMonthlyPerformance(trades);
        this._updateDashboardCharts();
    },

    _getDashboardInitialBalance() {
        const filteredAccs = this.state.activeTypeFilter === 'all'
            ? this.state.accounts
            : this.state.accounts.filter(a => a.type === this.state.activeTypeFilter);

        if (this.state.activeAccountId === 'all') {
            return filteredAccs.reduce((sum, a) => sum + a.initialBalance, 0);
        }
        const acc = this.state.accounts.find(a => a.id === this.state.activeAccountId);
        return acc ? acc.initialBalance : 0;
    },

    _getFilteredTrades() {
        let trades = this.state.trades;
        if (this.state.activeTypeFilter !== 'all') {
            const typeAccIds = this.state.accounts
                .filter(a => a.type === this.state.activeTypeFilter)
                .map(a => a.id);
            trades = trades.filter(t => typeAccIds.includes(t.accountId));
        }
        if (this.state.activeAccountId !== 'all') {
            trades = trades.filter(t => t.accountId === this.state.activeAccountId);
        }
        return trades;
    },

    _updateDashboardCharts() {
        const trades = this._getFilteredTrades();
        const initialBal = this._getDashboardInitialBalance();
        UI.updateCharts(trades, initialBal);
    },

    renderRecentTrades(trades) {
        const tbody = document.querySelector('#recentTradesTable tbody');
        if (!tbody) return;

        const recent = [...trades]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 8);

        if (recent.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="9" style="text-align:center;padding:2.5rem;">
                    ${UI.emptyState('chart-line', 'No trades yet', 'Trades will appear here once recorded')}
                </td></tr>`;
            return;
        }

        const dash = `<span class="text-muted">-</span>`;
        const fmt = (v) => (v !== null && v !== undefined && v !== 0 && v !== '') ? v : dash;

        tbody.innerHTML = recent.map(t => {
            const acc = this.state.accounts.find(a => a.id === t.accountId);
            const accType = acc?.type || 'Standard';
            return `
                <tr>
                    <td>${t.date}</td>
                    <td><strong>${t.pair}</strong></td>
                    <td>${UI.dirBadge(t.dir)}</td>
                    <td>${t.lot}</td>
                    <td>${t.entry}</td>
                    <td>${fmt(t.close)}</td>
                    <td>${(t.close !== null && t.close !== 0) ? UI.pipsCell(t.pips) : dash}</td>
                    <td>${UI.resultCell(t.result, accType)}</td>
                    <td>${acc ? `<span class="badge badge-secondary">${acc.name}</span>` : '-'}</td>
                </tr>`;
        }).join('');
    },

    _renderMonthlyPerformance(trades) {
        const container = document.getElementById('monthlyPerformanceBody');
        if (!container) return;

        const monthly = Calc.monthlyPerformance(trades);
        if (monthly.length === 0) {
            container.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:2rem;">No data</td></tr>`;
            return;
        }

        // Show last 6 months
        const recent = monthly.slice(-6).reverse();
        container.innerHTML = recent.map(m => {
            const cls = m.result >= 0 ? 'text-success' : 'text-danger';
            const sign = m.result >= 0 ? '+' : '';
            return `
                <tr>
                    <td><strong>${m.month}</strong></td>
                    <td>${m.trades}</td>
                    <td class="${cls}">${sign}$${Math.abs(m.result).toFixed(2)}</td>
                    <td>${m.winrate.toFixed(1)}%</td>
                </tr>`;
        }).join('');
    },

    // ================================================================
    //  RENDERING — ACCOUNTS LIST
    // ================================================================
    renderAccountsList() {
        const list = document.getElementById('accountsList');
        if (!list) return;

        if (this.state.accounts.length === 0) {
            list.innerHTML = UI.emptyState('wallet', 'No Accounts Yet', 'Click "Add Account" to create your first trading account.');
            return;
        }

        list.innerHTML = this.state.accounts.map(acc => {
            const accTrades = this.state.trades.filter(t => t.accountId === acc.id);
            const s = Calc.stats(accTrades, acc.initialBalance);
            const growthCls = s.growth >= 0 ? 'text-success' : 'text-danger';
            const growthSign = s.growth >= 0 ? '+' : '';

            return `
            <div class="account-card card animate-fade">
                <div class="account-card-header">
                    <div>
                        <h3>${acc.name}</h3>
                        <span class="badge badge-${acc.type.toLowerCase()}-type">${acc.type}</span>
                    </div>
                    <div class="action-btns">
                        <button class="action-btn edit" title="Edit Account"
                            onclick="app.showAccountModal('${acc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" title="Delete Account"
                            onclick="app.deleteAccount('${acc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="account-balance">${UI.formatCurrency(s.balance, acc.type)}</div>

                <div class="account-stats-row">
                    <div class="account-stat">
                        <span class="account-stat-label">Initial</span>
                        <span class="account-stat-value">${UI.formatCurrency(acc.initialBalance, acc.type)}</span>
                    </div>
                    <div class="account-stat">
                        <span class="account-stat-label">Growth</span>
                        <span class="account-stat-value ${growthCls}">${growthSign}${s.growth.toFixed(2)}%</span>
                    </div>
                    <div class="account-stat">
                        <span class="account-stat-label">Win Rate</span>
                        <span class="account-stat-value">${s.winrate.toFixed(1)}%</span>
                    </div>
                    <div class="account-stat">
                        <span class="account-stat-label">Trades</span>
                        <span class="account-stat-value">${s.total}</span>
                    </div>
                </div>

                <div class="account-mini-stats">
                    <div class="mini-stat">
                        <span class="text-muted">Max DD</span>
                        <span class="text-danger">${s.drawdown.toFixed(2)}%</span>
                    </div>
                    <div class="mini-stat">
                        <span class="text-muted">P.Factor</span>
                        <span>${s.profitFactor === Infinity ? '∞' : s.profitFactor}</span>
                    </div>
                    <div class="mini-stat">
                        <span class="text-muted">Avg RR</span>
                        <span>${s.avgRR ? '1:' + s.avgRR : '-'}</span>
                    </div>
                </div>

                <button class="btn btn-outline w-full" style="margin-top:1.25rem;"
                    onclick="app.viewJournal('${acc.id}')">
                    View Journal <i class="fas fa-chevron-right" style="font-size:0.75rem;margin-left:4px;"></i>
                </button>
            </div>`;
        }).join('');
    },

    // ================================================================
    //  RENDERING — JOURNAL
    // ================================================================
    viewJournal(accountId, silent = false) {
        this.state.viewingAccountId = accountId;
        this.state.lastAccountId = accountId;
        this.state.currentView = 'journal';
        this.state.pagination.currentPage = 1;
        Storage.save(this.state);
        UI.switchView('journal', () => this.renderJournal());
    },

    renderJournal() {
        const accId = this.state.viewingAccountId;
        const acc = this.state.accounts.find(a => a.id === accId);
        if (!acc) return;

        const accTrades = this.state.trades.filter(t => t.accountId === accId);
        const s = Calc.stats(accTrades, acc.initialBalance);

        // Update header bar stats
        document.getElementById('journalAccountName').textContent = acc.name;
        document.getElementById('journalBadgeType').textContent = acc.type;
        document.getElementById('journalBalance').textContent = UI.formatCurrency(s.balance, acc.type);
        document.getElementById('journalGrowthVal').textContent = `${s.growth >= 0 ? '+' : ''}${s.growth.toFixed(2)}%`;
        document.getElementById('journalGrowthVal').className = s.growth >= 0 ? 'text-success' : 'text-danger';
        document.getElementById('journalWinrate').textContent = `${s.winrate.toFixed(1)}%`;
        document.getElementById('journalTradeCount').textContent = `${s.total} trades`;

        // Journal-level equity chart
        const journalChartEl = document.getElementById('journalEquityChart');
        if (journalChartEl) {
            this._renderJournalChart(accTrades, acc);
        }

        // Table
        const tbody = document.querySelector('#journalTable tbody');
        if (!tbody) return;

        const sorted = [...accTrades].sort((a, b) => new Date(b.date) - new Date(a.date));
        const total = sorted.length;
        const perPage = this.state.pagination.itemsPerPage;
        const pages = Math.max(1, Math.ceil(total / perPage));
        if (this.state.pagination.currentPage > pages) this.state.pagination.currentPage = pages;

        const startIdx = (this.state.pagination.currentPage - 1) * perPage;
        const pageTrades = sorted.slice(startIdx, startIdx + perPage);

        // Update pagination UI
        const infoEl = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const selEl = document.getElementById('itemsPerPage');

        if (infoEl) infoEl.textContent = `Page ${this.state.pagination.currentPage} of ${pages}`;
        if (prevBtn) prevBtn.disabled = this.state.pagination.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.state.pagination.currentPage >= pages;
        if (selEl) selEl.value = perPage;

        if (pageTrades.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="13" style="text-align:center;padding:3rem;">
                    ${UI.emptyState('plus-circle', 'No Trades Yet', 'Click "New Trade" to start recording your trades.')}
                </td></tr>`;
            return;
        }

        const dash = `<span class="text-muted">-</span>`;
        const fmt = (v) => (v !== null && v !== undefined && v !== 0 && v !== '') ? v : dash;

        tbody.innerHTML = pageTrades.map(t => {
            const rrVal = Calc.rr(t.dir, t.entry, t.sl, t.tp);
            return `
                <tr>
                    <td>${t.date}</td>
                    <td><strong>${t.pair}</strong></td>
                    <td><span class="text-muted" style="font-size:0.8rem;">${t.tf}</span></td>
                    <td>${UI.dirBadge(t.dir)}</td>
                    <td>${t.lot}</td>
                    <td>${t.entry}</td>
                    <td>${fmt(t.close)}</td>
                    <td>${(t.close !== null && t.close !== 0) ? UI.pipsCell(t.pips) : dash}</td>
                    <td>${UI.resultCell(t.result, acc.type)}</td>
                    <td>${rrVal !== '-' ? `<span class="rr-badge">${rrVal}</span>` : dash}</td>
                    <td>${fmt(t.sl)}</td>
                    <td>${fmt(t.tp)}</td>
                    <td>
                        <div class="cell-scrollable">${t.emotion || dash}</div>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn edit" title="Edit Trade"
                                onclick="app.showTradeModal('${t.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" title="Delete Trade"
                                onclick="app.deleteTrade('${t.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    _journalChart: null,
    _renderJournalChart(trades, acc) {
        const ctx = document.getElementById('journalEquityChart')?.getContext('2d');
        if (!ctx) return;

        const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
        let bal = acc.initialBalance;
        const labels = ['Start'];
        const data = [bal];
        sorted.forEach(t => {
            bal = parseFloat((bal + t.result).toFixed(2));
            data.push(bal);
            labels.push(t.date ? t.date.substring(5) : '');
        });

        if (this._journalChart) {
            this._journalChart.data.labels = labels;
            this._journalChart.data.datasets[0].data = data;
            this._journalChart.update();
        } else {
            this._journalChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Balance',
                        data,
                        borderColor: '#10b981',
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        fill: true,
                        backgroundColor: (c) => {
                            const g = c.chart.ctx.createLinearGradient(0, 0, 0, 180);
                            g.addColorStop(0, 'rgba(16,185,129,0.2)');
                            g.addColorStop(1, 'rgba(16,185,129,0)');
                            return g;
                        },
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }, tooltip: {
                            backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
                            titleColor: '#94a3b8', bodyColor: '#f8fafc',
                            callbacks: { label: (ctx) => ` $${ctx.parsed.y.toFixed(2)}` }
                        }
                    },
                    scales: {
                        y: { grid: { color: 'rgba(30,41,59,0.7)' }, ticks: { color: '#94a3b8', callback: v => '$' + v } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 8, maxRotation: 0 } }
                    }
                }
            });
        }
    },

    changePage(delta) {
        this.state.pagination.currentPage += delta;
        this.renderJournal();
    },

    changeItemsPerPage(val) {
        this.state.pagination.itemsPerPage = parseInt(val);
        this.state.pagination.currentPage = 1;
        this.renderJournal();
    },

    // ================================================================
    //  ACCOUNT SELECTORS
    // ================================================================
    updateAccountSelectors() {
        const select = document.getElementById('activeAccountSelect');
        if (!select) return;

        const cur = select.value;
        const filtered = this.state.activeTypeFilter === 'all'
            ? this.state.accounts
            : this.state.accounts.filter(a => a.type === this.state.activeTypeFilter);

        select.innerHTML = '<option value="all">All Accounts</option>' +
            filtered.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        if (filtered.find(a => a.id === cur)) select.value = cur;
        else this.state.activeAccountId = 'all';
    },

    // ================================================================
    //  SETTINGS VIEW
    // ================================================================
    renderSettings() {
        const nameEl = document.getElementById('settingsUsername');
        if (nameEl && this.state.user) nameEl.textContent = this.state.user.username;
    },

    // ================================================================
    //  HELPERS
    // ================================================================
    _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    },
    _setClass(id, cls) {
        const el = document.getElementById(id);
        if (el) el.className = cls;
    },

    // Public aliases for HTML onclick handlers
    closeModal: (id) => UI.closeModal(id),
    toggleSidebar: (f) => UI.toggleSidebar(f),
    switchView: (v) => {
        app.state.currentView = v;
        Storage.save(app.state);
        UI.switchView(v, () => app._onViewChanged(v));
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
