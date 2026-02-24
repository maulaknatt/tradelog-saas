/**
 * calculations.js
 * Centralized, correct trading math for XAUUSD / Standard & Cent accounts.
 */

const Calc = (() => {

    /**
     * Calculate pips for XAUUSD (1 pip = 0.10 price move)
     * BUY:  pips = (close - entry) / 0.10
     * SELL: pips = (entry - close) / 0.10
     */
    function pips(dir, entry, close) {
        if (!isFinite(entry) || !isFinite(close)) return 0;
        const raw = dir === 'Buy' ? (close - entry) : (entry - close);
        return parseFloat((raw / 0.10).toFixed(1));
    }

    /**
     * Calculate monetary result.
     * move = |close - entry|  (direction handled by sign from pips logic)
     * Standard: move * lot * 100
     * Cent:     move * lot * 1
     * The result will be positive (win) or negative (loss) based on dir.
     */
    function result(type, dir, entry, close, lot) {
        if (!isFinite(entry) || !isFinite(close) || !isFinite(lot) || lot <= 0) return 0;
        const priceMove = dir === 'Buy' ? (close - entry) : (entry - close);
        const multiplier = type === 'Cent' ? 1 : 100;
        return parseFloat((priceMove * lot * multiplier).toFixed(2));
    }

    /**
     * Calculate R:R ratio.
     * Risk = abs(entry - SL), Reward = abs(TP - entry)
     * Returns "1 : X.XX" or '-' if invalid.
     */
    function rr(dir, entry, sl, tp) {
        entry = parseFloat(entry);
        sl = parseFloat(sl);
        tp = parseFloat(tp);
        // Treat 0 / NaN / undefined as "not provided"
        if (!isFinite(entry) || !isFinite(sl) || !isFinite(tp)) return '-';
        if (sl === 0 || tp === 0) return '-';
        const risk = Math.abs(entry - sl);
        const reward = Math.abs(tp - entry);
        if (risk <= 0 || reward <= 0) return '-';
        return `1 : ${(reward / risk).toFixed(2)}`;
    }

    /**
     * Growth percentage relative to initial balance.
     * growth% = ((currentBalance - initialBalance) / initialBalance) * 100
     */
    function growth(currentBalance, initialBalance) {
        if (!initialBalance || initialBalance === 0) return 0;
        return parseFloat(((currentBalance - initialBalance) / initialBalance * 100).toFixed(2));
    }

    /**
     * Full aggregate stats for a set of trades.
     * Equity curve is cumulative: equity[i] = equity[i-1] + result[i]
     */
    function stats(trades, initialBalance) {
        const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

        let balance = initialBalance;
        let peak = initialBalance;
        let maxDD = 0;

        // Equity array for chart
        const equityPoints = [initialBalance];

        sorted.forEach(t => {
            balance += t.result;
            equityPoints.push(parseFloat(balance.toFixed(2)));
            if (balance > peak) peak = balance;
            const dd = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
            if (dd > maxDD) maxDD = dd;
        });

        const totalResult = balance - initialBalance;
        const growthPct = growth(balance, initialBalance);

        const wins = trades.filter(t => t.result > 0).length;
        const losses = trades.filter(t => t.result < 0).length;
        const breakeven = trades.filter(t => t.result === 0).length;
        const winrate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

        // Profit factor: gross wins / gross losses
        const grossWin = trades.filter(t => t.result > 0).reduce((s, t) => s + t.result, 0);
        const grossLoss = Math.abs(trades.filter(t => t.result < 0).reduce((s, t) => s + t.result, 0));
        const profitFactor = grossLoss > 0 ? parseFloat((grossWin / grossLoss).toFixed(2)) : (grossWin > 0 ? Infinity : 0);

        // Average RR from trades that have sl/tp
        const rrValues = trades
            .map(t => {
                const r = rr(t.dir, t.entry, t.sl, t.tp);
                if (r === '-') return null;
                return parseFloat(r.split(':')[1]);
            })
            .filter(v => v !== null);
        const avgRR = rrValues.length > 0 ? parseFloat((rrValues.reduce((s, v) => s + v, 0) / rrValues.length).toFixed(2)) : 0;

        // Win/Loss streak
        let currentStreak = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        let streakType = null;

        sorted.forEach(t => {
            if (t.result > 0) {
                if (streakType === 'win') {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                    streakType = 'win';
                }
                if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
            } else if (t.result < 0) {
                if (streakType === 'loss') {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                    streakType = 'loss';
                }
                if (currentStreak > maxLossStreak) maxLossStreak = currentStreak;
            } else {
                currentStreak = 0;
                streakType = null;
            }
        });

        return {
            balance: parseFloat(balance.toFixed(2)),
            initialBalance,
            totalResult: parseFloat(totalResult.toFixed(2)),
            growth: growthPct,
            wins,
            losses,
            breakeven,
            total: trades.length,
            winrate: parseFloat(winrate.toFixed(2)),
            drawdown: parseFloat(maxDD.toFixed(2)),
            profitFactor,
            avgRR,
            maxWinStreak,
            maxLossStreak,
            equityPoints
        };
    }

    /**
     * Monthly performance grouping.
     * Returns an array of { month, trades, result, winrate }
     */
    function monthlyPerformance(trades) {
        const groups = {};
        trades.forEach(t => {
            const key = t.date ? t.date.substring(0, 7) : 'Unknown'; // "YYYY-MM"
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        return Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, ts]) => {
                const wins = ts.filter(t => t.result > 0).length;
                const result = parseFloat(ts.reduce((s, t) => s + t.result, 0).toFixed(2));
                const winrate = ts.length > 0 ? parseFloat(((wins / ts.length) * 100).toFixed(2)) : 0;
                return { month, trades: ts.length, result, winrate };
            });
    }

    return { pips, result, rr, growth, stats, monthlyPerformance };
})();
