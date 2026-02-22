/**
 * Trading Journal - Core Application Logic
 * Refactored for Unified Account/Journal Flow & CRUD
 */

const app = {
    // --- STATE ---
    state: {
        user: null,
        accounts: [],
        activeAccountId: 'all', // Used for global dashboard filtering
        activeTypeFilter: 'all', // 'all', 'Standard', 'Cent'
        trades: [],
        viewingAccountId: null, // Used for the "Journal" detail view
        pagination: {
            currentPage: 1,
            itemsPerPage: 10
        }
    },

    // --- INITIALIZATION ---
    init() {
        this.loadState();
        this.setupEventListeners();

        if (document.getElementById('view-container')) {
            this.checkAuth();

            // Restore last view or default to dashboard
            const lastView = this.state.currentView || 'dashboard';
            if (lastView === 'journal' && this.state.lastAccountId) {
                this.viewJournal(this.state.lastAccountId);
            } else {
                this.switchView(lastView);
            }

            this.initCharts();
        } else if (document.getElementById('loginForm')) {
            this.setupLogin();
        }
    },

    loadState() {
        const saved = localStorage.getItem('trade_journal_state');
        const defaultState = {
            user: null,
            accounts: [],
            activeAccountId: 'all',
            activeTypeFilter: 'all',
            trades: [],
            viewingAccountId: null,
            currentView: 'dashboard', // Persistence
            lastAccountId: null,      // Persistence for journal
            pagination: {
                currentPage: 1,
                itemsPerPage: 10
            }
        };

        if (saved) {
            const loaded = JSON.parse(saved);
            this.state = {
                ...defaultState,
                ...loaded,
                pagination: {
                    ...defaultState.pagination,
                    ...(loaded.pagination || {})
                }
            };
        } else {
            this.state = defaultState;
            this.saveState();
        }
    },

    saveState() {
        localStorage.setItem('trade_journal_state', JSON.stringify(this.state));
    },

    // --- AUTHENTICATION ---
    setupLogin() {
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            this.state.user = { username };
            this.saveState();
            window.location.href = 'dashboard.html';
        });
    },

    checkAuth() {
        if (!this.state.user) {
            window.location.href = 'index.html';
        }
    },

    // --- EVENT LISTENERS ---
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                this.switchView(item.dataset.view);
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.state.user = null;
                this.saveState();
                window.location.href = 'index.html';
            });
        }

        // Account Form
        const accountForm = document.getElementById('accountForm');
        if (accountForm) {
            accountForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAccountSubmit();
            });
        }

        // Trade Form
        const tradeForm = document.getElementById('tradeForm');
        if (tradeForm) {
            tradeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTradeSubmit();
            });
        }

        // Global Account Selector (Dashboard)
        const accSelect = document.getElementById('activeAccountSelect');
        if (accSelect) {
            accSelect.addEventListener('change', (e) => {
                this.state.activeAccountId = e.target.value;
                this.saveState();
                this.renderDashboard();
                this.updateCharts();
            });
        }

        const typeFilter = document.getElementById('activeTypeFilter');
        if (typeFilter) {
            typeFilter.value = this.state.activeTypeFilter;
            typeFilter.addEventListener('change', (e) => {
                this.state.activeTypeFilter = e.target.value;
                this.saveState();
                this.renderDashboard();
                this.updateCharts();
            });
        }
    },

    // --- VIEW MANAGEMENT ---
    switchView(viewId) {
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        const activeView = document.getElementById(`${viewId}-view`);
        if (activeView) {
            activeView.style.display = 'block';
            this.state.currentView = viewId;
            this.saveState();

            if (viewId === 'dashboard') this.renderDashboard();
            if (viewId === 'accounts') this.renderAccountsList();
            if (viewId === 'journal') this.renderJournal();
        }
        this.updateActiveNavLink(viewId);
        this.toggleSidebar(true); // Close if mobile
    },

    updateActiveNavLink(viewId) {
        document.querySelectorAll('.nav-item').forEach(i => {
            i.classList.remove('active');
            if (i.dataset.view === viewId) i.classList.add('active');
        });
    },

    toggleSidebar(forceClose = false) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!sidebar || !overlay) return;

        if (forceClose) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        } else {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    },
    // --- ACCOUNT CRUD ---
    showAccountModal(accountId = null) {
        const modal = document.getElementById('accountModal');
        const title = document.getElementById('accountModalTitle');
        const submitBtn = document.getElementById('accountModalSubmit');
        const form = document.getElementById('accountForm');

        form.reset();

        if (accountId) {
            const acc = this.state.accounts.find(a => a.id === accountId);
            title.textContent = 'Edit Account';
            submitBtn.textContent = 'Save Changes';
            document.getElementById('editAccountId').value = acc.id;
            document.getElementById('accName').value = acc.name;
            document.getElementById('accType').value = acc.type || 'Standard';
            document.getElementById('accBalance').value = acc.initialBalance;
        } else {
            title.textContent = 'Add New Account';
            submitBtn.textContent = 'Create Account';
            document.getElementById('editAccountId').value = '';
        }

        modal.style.display = 'flex';
    },

    handleAccountSubmit() {
        const id = document.getElementById('editAccountId').value;
        const name = document.getElementById('accName').value;
        const type = document.getElementById('accType').value;
        const balance = parseFloat(document.getElementById('accBalance').value);

        if (id) {
            // Update
            const index = this.state.accounts.findIndex(a => a.id === id);
            this.state.accounts[index].name = name;
            this.state.accounts[index].type = type;
            this.state.accounts[index].initialBalance = balance;
        } else {
            // Create
            const newAccount = {
                id: 'acc_' + Date.now(),
                name,
                type,
                initialBalance: balance,
                createdAt: new Date().toISOString()
            };
            this.state.accounts.push(newAccount);
        }

        this.saveState();
        this.closeModal('accountModal');
        this.renderAccountsList();
        this.updateAccountSelectors();
        if (this.state.viewingAccountId === id) this.renderJournal(); // Update stats in journal header if editing viewing account
    },

    deleteAccount(id) {
        if (confirm('Are you sure you want to delete this account and all its trades?')) {
            this.state.accounts = this.state.accounts.filter(a => a.id !== id);
            this.state.trades = this.state.trades.filter(t => t.accountId !== id);

            if (this.state.activeAccountId === id) this.state.activeAccountId = 'all';
            if (this.state.viewingAccountId === id) this.switchView('accounts');

            this.saveState();
            this.renderAccountsList();
            this.updateAccountSelectors();
            this.renderDashboard();
        }
    },

    // --- TRADE CRUD ---
    showTradeModal(tradeId = null) {
        if (this.state.accounts.length === 0) {
            alert('Please create an account first');
            return;
        }

        const modal = document.getElementById('tradeModal');
        const title = document.getElementById('tradeModalTitle');
        const submitBtn = document.getElementById('tradeModalSubmit');
        const form = document.getElementById('tradeForm');

        form.reset();

        if (tradeId) {
            const trade = this.state.trades.find(t => t.id === tradeId);
            title.textContent = 'Edit Trade';
            submitBtn.textContent = 'Save Changes';
            document.getElementById('editTradeId').value = trade.id;
            document.getElementById('tradeDate').value = trade.date;
            document.getElementById('tradePair').value = trade.pair;
            document.getElementById('tradeTF').value = trade.tf;
            document.getElementById('tradeDir').value = trade.dir;
            document.getElementById('tradeLot').value = trade.lot;
            document.getElementById('tradeEntry').value = trade.entry;
            document.getElementById('tradeClose').value = trade.close || '';
            document.getElementById('tradePips').value = trade.pips || '';
            document.getElementById('tradeSL').value = trade.sl;
            document.getElementById('tradeTP').value = trade.tp;
            document.getElementById('tradeResult').value = trade.result;
            document.getElementById('tradeManualResult').checked = trade.isManualResult || false;
            document.getElementById('tradeRisk').value = trade.risk;
            document.getElementById('tradeEmotion').value = trade.emotion;
            document.getElementById('tradeNotes').value = trade.notes;
        } else {
            title.textContent = 'Add New Trade';
            submitBtn.textContent = 'Save Trade';
            document.getElementById('editTradeId').value = '';
            document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('tradeManualResult').checked = false;
        }

        this.toggleResultMode(); // Initialize field state
        this.updateTradeFormCalculations();
        modal.style.display = 'flex';
    },

    handleTradeSubmit() {
        const id = document.getElementById('editTradeId').value;
        const activeAccId = this.state.viewingAccountId || (this.state.activeAccountId !== 'all' ? this.state.activeAccountId : this.state.accounts[0].id);
        const acc = this.state.accounts.find(a => a.id === activeAccId);

        const entry = parseFloat(document.getElementById('tradeEntry').value);
        const close = parseFloat(document.getElementById('tradeClose').value) || 0;
        const dir = document.getElementById('tradeDir').value;
        const lot = parseFloat(document.getElementById('tradeLot').value);

        const tradeData = {
            date: document.getElementById('tradeDate').value,
            pair: document.getElementById('tradePair').value,
            tf: document.getElementById('tradeTF').value,
            dir: dir,
            lot: lot,
            entry: entry,
            close: close,
            pips: this.calculatePips(dir, entry, close),
            sl: parseFloat(document.getElementById('tradeSL').value) || 0,
            tp: parseFloat(document.getElementById('tradeTP').value) || 0,
            result: parseFloat(document.getElementById('tradeResult').value) || 0,
            isManualResult: document.getElementById('tradeManualResult').checked,
            risk: parseFloat(document.getElementById('tradeRisk').value) || 0,
            emotion: document.getElementById('tradeEmotion').value,
            notes: document.getElementById('tradeNotes').value
        };

        if (id) {
            // Update
            const index = this.state.trades.findIndex(t => t.id === id);
            this.state.trades[index] = { ...this.state.trades[index], ...tradeData };
        } else {
            // Create
            const newTrade = {
                id: 'tr_' + Date.now(),
                accountId: activeAccId,
                ...tradeData
            };
            this.state.trades.push(newTrade);
        }

        this.saveState();
        this.closeModal('tradeModal');
        this.renderJournal();
        this.renderDashboard();
        this.updateCharts();
    },

    deleteTrade(id) {
        if (confirm('Delete this trade?')) {
            this.state.trades = this.state.trades.filter(t => t.id !== id);
            this.saveState();
            this.renderJournal();
            this.renderDashboard();
            this.updateCharts();
        }
    },

    // --- AUTOMATED CALCULATIONS ---
    updateTradeFormCalculations() {
        const entry = parseFloat(document.getElementById('tradeEntry').value);
        const closeInput = document.getElementById('tradeClose');
        const lot = parseFloat(document.getElementById('tradeLot').value);
        const dir = document.getElementById('tradeDir').value;

        // Protection: Entry required before Close
        if (isNaN(entry)) {
            closeInput.disabled = true;
            closeInput.value = '';
            document.getElementById('tradePips').value = '';
            document.getElementById('tradeResult').value = '';
            return;
        } else {
            closeInput.disabled = false;
        }

        const close = parseFloat(closeInput.value);

        // Pips & Result
        if (!isNaN(entry) && !isNaN(close)) {
            const pips = this.calculatePips(dir, entry, close);
            document.getElementById('tradePips').value = pips.toFixed(1);

            const activeAccId = this.state.viewingAccountId || (this.state.activeAccountId !== 'all' ? this.state.activeAccountId : this.state.accounts[0].id);
            const acc = this.state.accounts.find(a => a.id === activeAccId);

            if (!isNaN(lot) && lot > 0) {
                // Only auto-calc result if NOT in manual mode
                if (!document.getElementById('tradeManualResult').checked) {
                    const result = this.calculateResult(acc.type, dir, entry, close, lot);
                    document.getElementById('tradeResult').value = result.toFixed(2);
                }
            }
        } else {
            document.getElementById('tradePips').value = '';
            if (!document.getElementById('tradeManualResult').checked) {
                document.getElementById('tradeResult').value = '';
            }
        }
    },

    toggleResultMode() {
        const isManual = document.getElementById('tradeManualResult').checked;
        const resultInput = document.getElementById('tradeResult');

        if (isManual) {
            resultInput.removeAttribute('readonly');
            resultInput.placeholder = 'e.g. 5.50';
        } else {
            resultInput.setAttribute('readonly', true);
            resultInput.placeholder = 'Auto';
            this.updateTradeFormCalculations(); // Recalculate if switching back to auto
        }
    },

    calculatePips(dir, entry, close) {
        if (isNaN(entry) || isNaN(close)) return 0;
        return dir === 'Buy' ? (close - entry) * 10 : (entry - close) * 10;
    },

    calculateResult(type, dir, entry, close, lot) {
        if (isNaN(entry) || isNaN(close) || isNaN(lot)) return 0;
        const priceMove = dir === 'Buy' ? (close - entry) : (entry - close);
        const multiplier = type === 'Cent' ? 1 : 100;
        return priceMove * lot * multiplier;
    },

    calculateRR(dir, entry, sl, tp) {
        if (!entry || !sl || !tp) return '-';

        let risk, reward;
        if (dir === 'Buy') {
            risk = entry - sl;
            reward = tp - entry;
        } else {
            risk = sl - entry;
            reward = entry - tp;
        }

        if (risk <= 0 || reward <= 0) return '-';
        return `1:${(reward / risk).toFixed(2)}`;
    },

    // --- RENDERING ---
    renderDashboard() {
        const filteredTrades = this.getFilteredTrades('dashboard');
        const stats = this.calculateStats(filteredTrades);

        // Determine currency display based on type filter
        const currencySuffix = this.state.activeTypeFilter === 'Cent' ? ' USC' : '';
        const currencyPrefix = this.state.activeTypeFilter === 'Cent' ? '' : '$';

        document.getElementById('stat-total-balance').textContent = `${currencyPrefix}${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencySuffix}`;
        document.getElementById('stat-total-growth').textContent = `${stats.growth.toFixed(2)}%`;
        const growthEl = document.getElementById('stat-total-growth');
        growthEl.className = stats.growth >= 0 ? 'summary-value text-success' : 'summary-value text-danger';

        document.getElementById('stat-winrate').textContent = `${stats.winrate.toFixed(2)}%`;
        document.getElementById('stat-trades').textContent = filteredTrades.length;
        document.getElementById('stat-drawdown').textContent = `${stats.drawdown.toFixed(2)}%`;

        this.renderRecentTrades(filteredTrades);
        this.updateAccountSelectors();
    },

    formatCurrency(amount, type) {
        if (type === 'Cent') {
            return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USC`;
        }
        return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    renderRecentTrades(trades) {
        const tbody = document.querySelector('#recentTradesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const recent = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

        recent.forEach(t => {
            const acc = this.state.accounts.find(a => a.id === t.accountId);
            const pnlPercent = acc ? (t.result / acc.initialBalance * 100) : 0;
            const currencyPrefix = acc?.type === 'Cent' ? '' : '$';
            const currencySuffix = acc?.type === 'Cent' ? ' USC' : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.date}</td>
                <td>${t.pair}</td>
                <td><span class="badge badge-${t.dir.toLowerCase()}">${t.dir}</span></td>
                <td>${t.lot}</td>
                <td>${t.entry}</td>
                <td>${t.close || '-'}</td>
                <td>${t.pips ? t.pips.toFixed(1) : '-'}</td>
                <td class="${t.result >= 0 ? 'text-success' : 'text-danger'}">${t.result >= 0 ? '+' : ''}${currencyPrefix}${t.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencySuffix}</td>
                <td class="${t.result >= 0 ? 'text-success' : 'text-danger'}">${pnlPercent.toFixed(2)}%</td>
            `;
            tbody.appendChild(row);
        });
    },

    renderAccountsList() {
        const list = document.getElementById('accountsList');
        if (!list) return;

        list.innerHTML = '';
        if (this.state.accounts.length === 0) {
            list.innerHTML = `<div class="p-6 text-secondary">No accounts yet. Click "Add Account" to get started.</div>`;
            return;
        }

        this.state.accounts.forEach(acc => {
            const accTrades = this.state.trades.filter(t => t.accountId === acc.id);
            const stats = this.calculateStats(accTrades, acc.initialBalance);

            const card = document.createElement('div');
            card.className = 'card summary-card account-card animate-fade';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3>${acc.name}</h3>
                        <span class="badge badge-secondary" style="font-size: 0.7rem;">${acc.type || 'Standard'}</span>
                    </div>
                    <div class="action-btns">
                        <button class="action-btn edit" title="Edit" onclick="event.stopPropagation(); app.showAccountModal('${acc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="event.stopPropagation(); app.deleteAccount('${acc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="summary-value">${this.formatCurrency(stats.balance, acc.type)}</div>
                <div class="summary-label" style="margin-top: 1rem;">
                    Initial: ${this.formatCurrency(acc.initialBalance, acc.type)} | Growth: <span class="${stats.growth >= 0 ? 'text-success' : 'text-danger'}">${stats.growth.toFixed(2)}%</span>
                </div>
                <div class="summary-label">
                    Trades: ${accTrades.length} | Winrate: ${stats.winrate.toFixed(2)}%
                </div>
                <button class="btn btn-outline w-full" style="margin-top: 1.5rem;" onclick="app.viewJournal('${acc.id}')">
                    View Journal <i class="fas fa-chevron-right" style="margin-left: 5px; font-size: 0.8rem;"></i>
                </button>
            `;
            list.appendChild(card);
        });
    },

    viewJournal(accountId) {
        this.state.viewingAccountId = accountId;
        this.state.lastAccountId = accountId;
        this.state.currentView = 'journal';
        this.state.pagination.currentPage = 1;
        this.saveState();
        this.switchView('journal');
    },

    renderJournal() {
        const accId = this.state.viewingAccountId;
        const acc = this.state.accounts.find(a => a.id === accId);
        if (!acc) return;

        // Update Header
        const accTrades = this.state.trades.filter(t => t.accountId === accId);
        const stats = this.calculateStats(accTrades, acc.initialBalance);

        document.getElementById('journalAccountName').textContent = acc.name;
        document.getElementById('journalAccountStats').textContent =
            `Balance: ${this.formatCurrency(stats.balance, acc.type)} | Growth: ${stats.growth.toFixed(2)}% | Trades: ${accTrades.length}`;

        const tbody = document.querySelector('#journalTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        // --- PAGINATION LOGIC ---
        const sortedTrades = [...accTrades].sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalItems = sortedTrades.length;
        const itemsPerPage = this.state.pagination.itemsPerPage;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

        // Clamp current page
        if (this.state.pagination.currentPage > totalPages) this.state.pagination.currentPage = totalPages;
        if (this.state.pagination.currentPage < 1) this.state.pagination.currentPage = 1;

        const startIndex = (this.state.pagination.currentPage - 1) * itemsPerPage;
        const paginatedTrades = sortedTrades.slice(startIndex, startIndex + itemsPerPage);

        // Update UI Controls
        const paginationInfo = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const itemsSelect = document.getElementById('itemsPerPage');

        if (paginationInfo) paginationInfo.textContent = `Page ${this.state.pagination.currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = this.state.pagination.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.state.pagination.currentPage === totalPages;
        if (itemsSelect) itemsSelect.value = itemsPerPage;

        paginatedTrades.forEach(t => {
            const rr = this.calculateRR(t.dir, t.entry, t.sl, t.tp);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.date}</td>
                <td>${t.pair}</td>
                <td>${t.tf}</td>
                <td><span class="badge badge-${t.dir.toLowerCase()}">${t.dir}</span></td>
                <td>${t.lot}</td>
                <td>${t.entry}</td>
                <td>${t.close || '-'}</td>
                <td>${t.pips ? t.pips.toFixed(1) : '-'}</td>
                <td class="${t.result >= 0 ? 'text-success' : 'text-danger'}">${t.result >= 0 ? '+' : ''}${this.formatCurrency(t.result, acc.type)}</td>
                <td>${rr}</td>
                <td><div class="cell-scrollable">${t.emotion || '-'}</div></td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="app.showTradeModal('${t.id}')"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="app.deleteTrade('${t.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    changePage(delta) {
        this.state.pagination.currentPage += delta;
        this.renderJournal();
    },

    changeItemsPerPage(count) {
        this.state.pagination.itemsPerPage = parseInt(count);
        this.state.pagination.currentPage = 1; // Reset to page 1
        this.renderJournal();
    },

    updateAccountSelectors() {
        const select = document.getElementById('activeAccountSelect');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="all">All Accounts</option>';

        const filteredAccounts = this.state.activeTypeFilter === 'all'
            ? this.state.accounts
            : this.state.accounts.filter(acc => acc.type === this.state.activeTypeFilter);

        filteredAccounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name;
            select.appendChild(opt);
        });
        select.value = currentVal;
    },

    // --- CALCULATIONS ---
    getFilteredTrades(mode) {
        if (mode === 'dashboard') {
            let trades = this.state.trades;
            if (this.state.activeTypeFilter !== 'all') {
                const typeAccounts = this.state.accounts.filter(a => a.type === this.state.activeTypeFilter).map(a => a.id);
                trades = trades.filter(t => typeAccounts.includes(t.accountId));
            }
            if (this.state.activeAccountId === 'all') return trades;
            return trades.filter(t => t.accountId === this.state.activeAccountId);
        }
        return this.state.trades.filter(t => t.accountId === this.state.viewingAccountId);
    },

    calculateStats(trades, customBalance = null) {
        let initialBalance = 0;

        if (customBalance !== null) {
            initialBalance = customBalance;
        } else if (this.state.activeAccountId === 'all') {
            const filteredAccounts = this.state.activeTypeFilter === 'all'
                ? this.state.accounts
                : this.state.accounts.filter(a => a.type === this.state.activeTypeFilter);
            initialBalance = filteredAccounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
        } else {
            const acc = this.state.accounts.find(a => a.id === this.state.activeAccountId);
            initialBalance = acc ? acc.initialBalance : 0;
        }

        const totalProfit = trades.reduce((sum, t) => sum + t.result, 0);
        const balance = initialBalance + totalProfit;
        const growth = initialBalance > 0 ? (totalProfit / initialBalance) * 100 : 0;

        const wins = trades.filter(t => t.result > 0).length;
        const winrate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

        let maxBalance = initialBalance;
        let currentBalance = initialBalance;
        let maxDD = 0;

        [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
            currentBalance += t.result;
            if (currentBalance > maxBalance) maxBalance = currentBalance;
            const dd = maxBalance > 0 ? ((maxBalance - currentBalance) / maxBalance) * 100 : 0;
            if (dd > maxDD) maxDD = dd;
        });

        return { balance, growth, winrate, drawdown: maxDD };
    },

    // --- CHART MANAGEMENT ---
    charts: {
        equity: null,
        winLoss: null
    },

    initCharts() {
        const ctxEquity = document.getElementById('equityChart')?.getContext('2d');
        const ctxWL = document.getElementById('winLossChart')?.getContext('2d');

        if (ctxEquity) {
            this.charts.equity = new Chart(ctxEquity, {
                type: 'line',
                data: {
                    labels: [], datasets: [{
                        label: 'Equity',
                        data: [],
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#6366f1',
                        fill: true,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', callback: val => '$' + val } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    }
                }
            });
        }

        if (ctxWL) {
            this.charts.winLoss = new Chart(ctxWL, {
                type: 'doughnut',
                data: {
                    labels: ['Win', 'Loss'], datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20 } } }
                }
            });
        }

        this.updateCharts();
    },

    updateCharts() {
        const trades = this.getFilteredTrades('dashboard').sort((a, b) => new Date(a.date) - new Date(a.date));

        if (this.charts.equity) {
            let current = 0;
            if (this.state.activeAccountId === 'all') {
                const filteredAccounts = this.state.activeTypeFilter === 'all'
                    ? this.state.accounts
                    : this.state.accounts.filter(a => a.type === this.state.activeTypeFilter);
                current = filteredAccounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
            } else {
                const acc = this.state.accounts.find(a => a.id === this.state.activeAccountId);
                current = acc ? acc.initialBalance : 0;
            }

            const data = [current];
            const labels = ['Start'];

            trades.forEach((t, i) => {
                current += t.result;
                data.push(current);
                labels.push(`${t.date}`);
            });

            this.charts.equity.data.labels = labels;
            this.charts.equity.data.datasets[0].data = data;
            this.charts.equity.update();
        }

        if (this.charts.winLoss) {
            const wins = trades.filter(t => t.result > 0).length;
            const losses = trades.filter(t => t.result <= 0).length;

            this.charts.winLoss.data.datasets[0].data = [wins, losses];
            this.charts.winLoss.update();
        }
    },

    // --- MODAL UTILS ---
    closeModal(id) {
        document.getElementById(id).style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
