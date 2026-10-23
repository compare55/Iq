// ========================
// SHARED WALLET + MENU
// ========================
let balance = Number(localStorage.getItem('demoBalance') ?? 0);
let transactions = JSON.parse(localStorage.getItem('demoTx')) || [];
let lastDailyBonus = localStorage.getItem('lastDailyBonus') || '';
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
let sessionBankAccount = null;

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', () => {
  updateAllBalances();
  renderTx();
  loadRequestHistory();
  setupSoundToggle();
  checkDailyBonus();
});

function setupSoundToggle() {
  const btn = document.getElementById('soundToggle');
  if (!btn) return;
  btn.textContent = soundEnabled ? '🔊' : '🔇';
  btn.onclick = () => {
    soundEnabled = !soundEnabled;
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    localStorage.setItem('soundEnabled', soundEnabled);
  };
}

// ========================
// BALANCE
// ========================
function updateAllBalances() {
  const navBal = document.getElementById('navBalance');
  if (navBal) navBal.textContent = balance;
  const walletBal = document.getElementById('walletBalance');
  if (walletBal) walletBal.textContent = balance;
  localStorage.setItem('demoBalance', balance);
}

// ========================
// TRANSACTIONS
// ========================
function addTx(type, amount, note = '') {
  transactions.unshift({
    type, amount, note,
    time: new Date().toLocaleTimeString()
  });
  transactions = transactions.slice(0, 30);
  localStorage.setItem('demoTx', JSON.stringify(transactions));
  renderTx();
}

function renderTx() {
  const box = document.getElementById('txHistory');
  if (!box) return;
  if (transactions.length === 0) {
    box.innerHTML = '<div style="padding:0.5rem;color:#666;text-align:center;">No transactions yet</div>';
    return;
  }
  box.innerHTML = transactions.map(tx => {
    const sign = (tx.type === 'add' || tx.type === 'win') ? '+' : '-';
    return `<div class="tx-item">
      <span>${tx.note || tx.type}</span>
      <span class="tx-${tx.type}">${sign}${tx.amount}</span>
    </div>`;
  }).join('');
}

// ========================
// WALLET
// ========================
function openWallet() {
  document.getElementById('walletModal').classList.remove('hidden');
  updateAllBalances();
  renderTx();
  loadRequestHistory();
}

function closeWallet() {
  document.getElementById('walletModal').classList.add('hidden');
}

async function loadRequestHistory() {
  const box = document.getElementById('requestHistory');
  if (!box) return;
  let customerId = localStorage.getItem('jiowinCustomerId');
  if (!customerId || !/^[A-Za-z0-9_-]{6,80}$/.test(customerId)) {
    customerId = 'J' + Math.random().toString(36).slice(2, 12).toUpperCase() + Date.now().toString(36).toUpperCase();
    localStorage.setItem('jiowinCustomerId', customerId);
  }
  box.innerHTML = '<div style="padding:.5rem;color:#666">Loading request history…</div>';
  try {
    const response = await fetch('/api/requests?customerId=' + encodeURIComponent(customerId), {headers:{'Accept':'application/json'}, cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'History could not load');
    if (!Array.isArray(data.requests) || !data.requests.length) {
      box.innerHTML = '<div style="padding:.75rem;color:#666;text-align:center">No Add Money or Withdrawal requests yet.</div>';
      return;
    }
    const label = status => status === 'APPROVED' ? 'Approved ✓' : status === 'REJECTED' ? 'Rejected ✕' : 'Pending ⏳';
    const color = status => status === 'APPROVED' ? '#15803d' : status === 'REJECTED' ? '#be123c' : '#a16207';
    box.innerHTML = data.requests.map(r => `<div class="tx-item" style="display:block;padding:12px;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between;gap:8px"><strong>${r.type === 'deposit' ? 'Add Money' : 'Withdrawal'}</strong><strong>₹${Number(r.amount).toLocaleString('en-IN')}</strong></div><div style="font-size:.82rem;color:#666;margin-top:4px">ID: ${escapeRequestText(r.id)}</div><div style="font-size:.9rem;font-weight:700;color:${color(r.status)};margin-top:5px">Status: ${label(r.status)}</div><div style="font-size:.78rem;color:#777;margin-top:3px">Submitted: ${formatRequestDate(r.createdAt)}${r.processedAt ? ' · Updated: ' + formatRequestDate(r.processedAt) : ''}</div></div>`).join('');
  } catch (error) {
    box.innerHTML = '<div style="padding:.75rem;color:#9f1239">Could not load server history. Check internet connection and try Refresh History.</div>';
  }
}
function escapeRequestText(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatRequestDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleString('en-IN'); }

function openDeposit() {
  document.getElementById('depositModal').classList.remove('hidden');
}

function closeDeposit() {
  document.getElementById('depositModal').classList.add('hidden');
}

function openPaymentPage(method) {
  window.location.href = 'payment.html?method=' + encodeURIComponent(method);
}

function openWithdrawPanel() {
  const panel = document.getElementById('withdrawPanel');
  if (panel) panel.classList.toggle('hidden');
}

function saveBankAccount(event) {
  event.preventDefault();
  const holder = document.getElementById('bankHolder').value.trim();
  const bank = document.getElementById('bankName').value.trim();
  const account = document.getElementById('bankAccount').value.trim();
  const ifsc = document.getElementById('bankIfsc').value.trim().toUpperCase();
  if (!holder || !bank || !/^[0-9]{6,20}$/.test(account) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    showToast('Please check the bank details.');
    return;
  }
  // Keep sensitive bank details in memory only; do not store them in browser storage.
  sessionBankAccount = { holder, bank, account, ifsc };
  document.getElementById('savedBankSummary').textContent = `Bank account saved for this session: ${bank} ••••${account.slice(-4)} (${holder})`;
  document.getElementById('savedBankSummary').classList.remove('hidden');
  document.getElementById('withdrawForm').classList.remove('hidden');
  showToast('Bank details saved for this session.');
}

async function submitWithdrawRequest(event) {
  event.preventDefault();
  if (!sessionBankAccount) { showToast('Please add a bank account first.'); return; }
  const amount = Number(document.getElementById('withdrawAmount').value);
  if (!Number.isInteger(amount) || amount <= 0 || amount > balance) {
    showToast('Enter an amount within your available balance.');
    return;
  }
  const customerId = localStorage.getItem('jiowinCustomerId') || ('J' + Math.random().toString(36).slice(2, 12).toUpperCase());
  localStorage.setItem('jiowinCustomerId', customerId);
  try {
    const response = await fetch('/api/requests', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({type:'withdraw', amount, customerId, holder:sessionBankAccount.holder, bank:sessionBankAccount.bank, account:sessionBankAccount.account, ifsc:sessionBankAccount.ifsc})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    showToast('Withdrawal request sent to Telegram admin. Wait for approval.');
    loadRequestHistory();
    document.getElementById('withdrawAmount').value = '';
    const summary = document.getElementById('savedBankSummary');
    if (summary) summary.textContent = `Request ${result.id}: PENDING ••••${sessionBankAccount.account.slice(-4)}`;
    const requestId = result.id;
    const requestedAmount = amount;
    const requestKey = 'jiowin_withdraw_applied_' + requestId;
    const poll = setInterval(async () => {
      try {
        const check = await fetch('/api/requests/' + encodeURIComponent(requestId));
        const state = await check.json();
        if (state.status === 'APPROVED' || state.status === 'REJECTED') {
          clearInterval(poll);
          if (state.status === 'APPROVED' && !localStorage.getItem(requestKey)) {
            const latest = Number(localStorage.getItem('demoBalance') || 0);
            if (latest >= requestedAmount) {
              balance = latest - requestedAmount;
              updateAllBalances();
              addTx('withdraw', requestedAmount, 'Admin-approved withdrawal');
            } else {
              showToast('Withdrawal approved, but this browser balance is insufficient. Contact admin.');
            }
            localStorage.setItem(requestKey, '1');
          }
          if (summary) summary.textContent = `Request ${requestId}: ${state.status} ••••${sessionBankAccount.account.slice(-4)}`;
          showToast(state.status === 'APPROVED' ? 'Withdrawal approved by admin.' : 'Withdrawal rejected by admin.');
          loadRequestHistory();
        }
      } catch (pollError) { /* retry on next poll */ }
    }, 3000);
  } catch (err) {
    showToast('Could not send request: ' + err.message);
  }
}

function checkDailyBonus() {
  // Automatic promotional credit disabled: wallet funds must not appear without an approved request.
  return;
}

// ========================
// TOAST
// ========================
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}
