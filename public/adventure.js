(function () {
    function getPin() {
        const saved = sessionStorage.getItem('adventurePin') || '';
        const pin = window.prompt('Enter your DigiPog PIN', saved);
        if (pin == null || pin === '') return null;
        sessionStorage.setItem('adventurePin', pin);
        fetch('/adventure/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ pin })
        }).catch(() => {});
        return pin;
    }

    async function api(url, options) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            ...options
        });
        const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
        if (!res.ok || data.ok === false) {
            const err = new Error(data.error || res.statusText || 'Request failed');
            err.data = data;
            throw err;
        }
        return data;
    }

    function showError(err) {
        alert(err.message || String(err));
    }

    // Join
    const joinForm = document.getElementById('joinForm');
    if (joinForm) {
        joinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startZone = document.getElementById('startZone').value;
            try {
                await api('/adventure/join', {
                    method: 'POST',
                    body: JSON.stringify({ startZone })
                });
                window.location.reload();
            } catch (err) {
                showError(err);
            }
        });
    }

    // Travel countdown
    const travelStatus = document.getElementById('travelStatus');
    const travelCountdown = document.getElementById('travelCountdown');
    let travelUntil = (window.ADVENTURE && window.ADVENTURE.travelUntil) || 0;

    function updateTravelUi() {
        const remaining = Math.max(0, travelUntil - Date.now());
        const moving = remaining > 0;
        if (travelStatus) {
            travelStatus.classList.toggle('hidden', !moving);
        }
        if (travelCountdown) {
            travelCountdown.textContent = String(Math.ceil(remaining / 1000));
        }
        document.querySelectorAll('.move-btn').forEach((btn) => {
            if (moving) btn.disabled = true;
        });
        if (moving) {
            requestAnimationFrame(() => setTimeout(updateTravelUi, 250));
        } else if (travelUntil) {
            // Unlock buttons that were only travel-blocked (re-enable canMove ones by reload)
            window.location.reload();
        }
    }
    if (travelUntil > Date.now()) updateTravelUi();

    // Move
    document.querySelectorAll('.move-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const toZone = btn.getAttribute('data-to');
            const pin = getPin();
            if (pin == null) return;
            btn.disabled = true;
            try {
                const data = await api('/adventure/move', {
                    method: 'POST',
                    body: JSON.stringify({ toZone, pin })
                });
                travelUntil = data.travelUntil || Date.now() + 20000;
                if (window.ADVENTURE) window.ADVENTURE.travelUntil = travelUntil;
                window.location.reload();
            } catch (err) {
                btn.disabled = false;
                showError(err);
            }
        });
    });

    // Shop
    document.querySelectorAll('.shop-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const itemName = btn.getAttribute('data-item');
            const pin = getPin();
            if (pin == null) return;
            try {
                await api('/adventure/shop', {
                    method: 'POST',
                    body: JSON.stringify({ itemName, pin, qty: 1 })
                });
                window.location.reload();
            } catch (err) {
                showError(err);
            }
        });
    });

    // Withdraw transfer
    document.querySelectorAll('.transfer-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const itemName = btn.getAttribute('data-item');
            const direction = btn.getAttribute('data-direction') || 'withdraw';
            try {
                await api('/adventure/transfers', {
                    method: 'POST',
                    body: JSON.stringify({ itemName, direction })
                });
                window.location.reload();
            } catch (err) {
                showError(err);
            }
        });
    });

    // Deposit
    const depositBtn = document.getElementById('depositBtn');
    if (depositBtn) {
        depositBtn.addEventListener('click', async () => {
            const itemName = (document.getElementById('depositItem').value || '').trim();
            if (!itemName) {
                alert('Enter an item name to deposit');
                return;
            }
            try {
                await api('/adventure/transfers', {
                    method: 'POST',
                    body: JSON.stringify({ itemName, direction: 'deposit' })
                });
                window.location.reload();
            } catch (err) {
                showError(err);
            }
        });
    }

    // Cancel transfer
    document.querySelectorAll('.cancel-transfer-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            try {
                await api('/adventure/transfers/' + id + '/cancel', { method: 'POST', body: '{}' });
                window.location.reload();
            } catch (err) {
                showError(err);
            }
        });
    });

    // GM close
    document.querySelectorAll('.gm-close-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (!window.confirm('Close transfer #' + id + ' after completing the real-world handoff?')) {
                return;
            }
            try {
                await api('/adventure/transfers/' + id + '/close', { method: 'POST', body: '{}' });
                window.location.reload();
            } catch (err) {
                showError(err);
            }
        });
    });
})();
