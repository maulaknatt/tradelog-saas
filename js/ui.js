/**
 * ui.js
 * All DOM rendering, chart management, and UI utilities.
 * Depends on: Calc, Storage, Validation (globals from other module files).
 */

const UI = (() => {

    // ------------------------------------------------------------------ charts
    const charts = { equity: null, winLoss: null };

    function initCharts() {
        const ctxEq = document.getElementById('equityChart')?.getContext('2d');
        const ctxWL = document.getElementById('winLossChart')?.getContext('2d');

        const chartDefaults = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeInOutQuart' }
        };

        if (ctxEq) {
            charts.equity = new Chart(ctxEq, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Equity',
                        data: [],
                        borderColor: '#6366f1',
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#6366f1',
                        fill: true,
                        backgroundColor: (ctx) => {
                            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
                            g.addColorStop(0, 'rgba(99,102,241,0.25)');
                            g.addColorStop(1, 'rgba(99,102,241,0)');
                            return g;
                        },
                        tension: 0.4
                    }]
                },
                options: {
                    ...chartDefaults,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#94a3b8',
                            bodyColor: '#f8fafc',
                            borderColor: '#334155',
                            borderWidth: 1,
                            callbacks: {
                                label: (ctx) => ` $${ctx.parsed.y.toFixed(2)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(30,41,59,0.7)' },
                            ticks: { color: '#94a3b8', callback: v => '$' + v.toLocaleString() }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', maxTicksLimit: 8, maxRotation: 0 }
                        }
                    }
                }
            });
        }

        if (ctxWL) {
            charts.winLoss = new Chart(ctxWL, {
                type: 'doughnut',
                data: {
                    labels: ['Win', 'Loss', 'B/E'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                        borderWidth: 0,
                        hoverOffset: 6
                    }]
                },
                options: {
                    ...chartDefaults,
                    cutout: '72%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#94a3b8', padding: 16, boxWidth: 12, font: { size: 12 } }
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#94a3b8',
                            bodyColor: '#f8fafc',
                            borderColor: '#334155',
                            borderWidth: 1
                        }
                    }
                }
            });
        }
    }

    function updateCharts(trades, initialBalance) {
        const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

        if (charts.equity) {
            let cumulative = initialBalance;
            const labels = ['Start'];
            const data = [initialBalance];
            sorted.forEach(t => {
                cumulative = parseFloat((cumulative + t.result).toFixed(2));
                data.push(cumulative);
                labels.push(t.date ? t.date.substring(5) : ''); // "MM-DD"
            });
            charts.equity.data.labels = labels;
            charts.equity.data.datasets[0].data = data;
            charts.equity.update();
        }

        if (charts.winLoss) {
            const wins = trades.filter(t => t.result > 0).length;
            const losses = trades.filter(t => t.result < 0).length;
            const be = trades.filter(t => t.result === 0).length;
            charts.winLoss.data.datasets[0].data = [wins, losses, be];
            charts.winLoss.update();
        }
    }

    // ----------------------------------------------------------------- toasts
    function toast(message, type = 'success') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(t => t.remove());

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'exclamation-triangle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(el);

        // Trigger animation
        requestAnimationFrame(() => el.classList.add('show'));

        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 400);
        }, 3000);
    }

    // --------------------------------------------------------------- modals
    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('modal-open'));
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('modal-open');
            setTimeout(() => { modal.style.display = 'none'; }, 250);
        }
    }

    // ---------------------------------------------------------- confirm dialog
    function confirm(message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            const msg = document.getElementById('confirmMessage');
            const yesBtn = document.getElementById('confirmYes');
            const noBtn = document.getElementById('confirmNo');

            if (!modal) { resolve(window.confirm(message)); return; }

            msg.textContent = message;
            openModal('confirmModal');

            const cleanup = (result) => {
                closeModal('confirmModal');
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
                resolve(result);
            };

            const onYes = () => cleanup(true);
            const onNo = () => cleanup(false);

            yesBtn.addEventListener('click', onYes, { once: true });
            noBtn.addEventListener('click', onNo, { once: true });
        });
    }

    // -------------------------------------------------------- form error display
    function showFormErrors(errors) {
        const existing = document.querySelector('.form-error-banner');
        if (existing) existing.remove();

        if (!errors || errors.length === 0) return;

        const banner = document.createElement('div');
        banner.className = 'form-error-banner';
        banner.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>
        `;

        // Prepend to open modal form
        const openForm = document.querySelector('.modal[style*="flex"] form') ||
            document.querySelector('.modal.modal-open form');
        if (openForm) openForm.prepend(banner);
    }

    // ------------------------------------------------- currency formatting
    function formatCurrency(amount, type) {
        const abs = Math.abs(amount);
        const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (type === 'Cent') {
            return `${amount < 0 ? '-' : ''}${formatted} USC`;
        }
        return `${amount < 0 ? '-$' : '$'}${formatted}`;
    }

    // ---------------------------------------------------- empty state helper
    function emptyState(icon, title, subtitle) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-${icon}"></i></div>
                <h3>${title}</h3>
                <p>${subtitle}</p>
            </div>
        `;
    }

    // --------------------------------------------- sidebar toggle
    function toggleSidebar(forceClose = false) {
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
    }

    // --------------------------------------------- view switching
    function switchView(viewId, callback) {
        document.querySelectorAll('.view').forEach(v => {
            v.style.display = 'none';
            v.classList.remove('view-active');
        });
        const target = document.getElementById(`${viewId}-view`);
        if (target) {
            target.style.display = 'block';
            requestAnimationFrame(() => target.classList.add('view-active'));
        }
        // Update nav
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });
        toggleSidebar(true);
        if (callback) callback();
    }

    // -------------------------------------------- badge helper
    function dirBadge(dir) {
        return `<span class="badge badge-${dir.toLowerCase()}">${dir}</span>`;
    }

    // ------------------------------------------- result cell
    function resultCell(result, type) {
        const cls = result > 0 ? 'text-success' : result < 0 ? 'text-danger' : 'text-muted';
        const sign = result > 0 ? '+' : '';
        return `<span class="${cls}">${sign}${formatCurrency(result, type)}</span>`;
    }

    // ----------------------------------------- pips cell
    function pipsCell(pips) {
        if (pips === 0 || pips === null || pips === undefined) return '<span class="text-muted">-</span>';
        const cls = pips > 0 ? 'text-success' : 'text-danger';
        return `<span class="${cls}">${pips > 0 ? '+' : ''}${pips.toFixed(1)}</span>`;
    }

    return {
        initCharts,
        updateCharts,
        toast,
        openModal,
        closeModal,
        confirm,
        showFormErrors,
        formatCurrency,
        emptyState,
        toggleSidebar,
        switchView,
        dirBadge,
        resultCell,
        pipsCell
    };
})();
