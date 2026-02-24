/**
 * validation.js
 * All form-level validation rules in one place.
 * Returns { valid: bool, errors: string[] }
 */

const Validation = (() => {

    function validateAccount(data) {
        const errors = [];
        if (!data.name || !data.name.trim()) {
            errors.push('Account name is required.');
        }
        if (!['Standard', 'Cent'].includes(data.type)) {
            errors.push('Account type must be Standard or Cent.');
        }
        if (!isFinite(data.initialBalance) || data.initialBalance < 0) {
            errors.push('Initial balance must be a non-negative number.');
        }
        return { valid: errors.length === 0, errors };
    }

    function validateTrade(data) {
        const errors = [];

        if (!data.date) {
            errors.push('Date is required.');
        }
        if (!data.pair || !data.pair.trim()) {
            errors.push('Pair is required.');
        }
        if (!data.tf || !data.tf.trim()) {
            errors.push('Timeframe is required.');
        }
        if (!isFinite(data.lot) || data.lot <= 0) {
            errors.push('Lot must be a positive number greater than 0.');
        }
        if (!isFinite(data.entry) || data.entry <= 0) {
            errors.push('Entry price is required and must be greater than 0.');
        }
        // Close is optional (open trade), but if provided must be valid
        if (data.close !== '' && data.close !== null && data.close !== undefined) {
            const c = parseFloat(data.close);
            if (!isFinite(c) || c <= 0) {
                errors.push('Close price must be a positive number if provided.');
            }
        }
        // SL/TP — sepenuhnya opsional. Validasi hanya jika ada nilainya (bukan null/0/empty)
        if (data.sl !== null && data.sl !== 0 && data.sl !== '' && data.sl !== undefined) {
            const v = parseFloat(data.sl);
            if (!isFinite(v) || v <= 0) errors.push('Stop Loss harus berupa angka positif jika diisi.');
        }
        if (data.tp !== null && data.tp !== 0 && data.tp !== '' && data.tp !== undefined) {
            const v = parseFloat(data.tp);
            if (!isFinite(v) || v <= 0) errors.push('Take Profit harus berupa angka positif jika diisi.');
        }

        // Result boleh 0 (trade masih open / belum ada close)
        if (!isFinite(data.result)) {
            errors.push('Result harus berupa angka yang valid.');
        }

        return { valid: errors.length === 0, errors };
    }

    return { validateAccount, validateTrade };
})();
