import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const timeLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
const today = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};
const transactionDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const localDateKey = (value) => {
  const date = transactionDate(value);
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
};
const balanceState = (value) => Number(value || 0) > 0 ? 'debit' : Number(value || 0) < 0 ? 'credit' : 'zero';
const balanceLabel = (value) => balanceState(value) === 'debit' ? 'Udhar / Payable' : balanceState(value) === 'credit' ? 'Wasooli / Jama' : 'Zero / Settled';
const photoUrl = (photo) => {
  if (!photo) return null;
  if (photo.startsWith('data:')) return photo;
  return `photo://${photo}`;
};

function BalanceBadge({ value, compact = false }) {
  const state = balanceState(value);
  return <span className={`balance-badge ${state} ${compact ? 'compact' : ''}`}>
    <b>{money(Math.abs(Number(value || 0)))}</b>
    <small>{balanceLabel(value)}</small>
  </span>;
}

function PasswordInput({ value, onChange, placeholder, maxLength, autoFocus = false, required = false }) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input"><input autoFocus={autoFocus} required={required} type={visible ? 'text' : 'password'} inputMode="numeric" maxLength={maxLength} value={value} onChange={onChange} placeholder={placeholder} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide PIN' : 'Show PIN'} title={visible ? 'Hide PIN' : 'Show PIN'}>{visible ? '🙈' : '👁'}</button></span>;
}

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState(customer || { name: '', phone: '', photo: '' });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => set('photo', String(reader.result));
    reader.readAsDataURL(file);
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <form className="modal-card" onSubmit={(event) => { event.preventDefault(); if (form.name.trim()) onSave(form); }}>
      <div className="modal-heading"><div><span className="eyebrow">Account profile</span><h2>{customer ? 'Edit Customer' : 'Add Customer'}</h2></div><button type="button" onClick={onClose} className="icon-button" aria-label="Close">×</button></div>
      <div className="form-stack">
        <label>Customer name *<input autoFocus required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Al-Madina Traders" /></label>
        <label>Phone number<input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="03xx-xxxxxxx" /></label>
        <div className="photo-field"><span className="label-text">Customer photo</span><div className="photo-picker">{form.photo ? <img src={photoUrl(form.photo)} alt={`${form.name || 'Customer'} profile`} /> : <span className="photo-placeholder">👤</span>}<label className="button-secondary photo-button">Choose photo<input type="file" accept="image/*" onChange={choosePhoto} /></label>{form.photo && <button type="button" className="button-secondary" onClick={() => set('photo', '')}>Remove</button>}</div></div>
      </div>
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary">Save Customer <kbd>Enter</kbd></button></div>
    </form>
  </div>;
}

function TransactionModal({ customers, selectedId, transaction, onClose, onSave }) {
  const [form, setForm] = useState(transaction ? {
    id: transaction.id, customer_id: transaction.customer_id, type: transaction.type,
    amount: transaction.amount, description: transaction.description || ''
  } : { customer_id: selectedId || '', type: 'DEBIT', amount: '', description: '' });
  const amountRef = useRef(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => { amountRef.current?.focus(); }, []);
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <form className="modal-card" onSubmit={(event) => {
      event.preventDefault();
      if (Number(form.amount) > 0 && form.customer_id) onSave({ ...form, customer_id: Number(form.customer_id), amount: Number(form.amount) });
    }}>
      <div className="modal-heading"><div><span className="eyebrow">Ledger entry</span><h2>{transaction ? 'Edit Transaction' : 'Record Transaction'}</h2></div><button type="button" onClick={onClose} className="icon-button" aria-label="Close">×</button></div>
      <div className="form-stack">
        <label>Customer<select required value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}><option value="">Select customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div><span className="label-text">Transaction type / qism</span><div className="type-grid">
          <button type="button" className={form.type === 'DEBIT' ? 'type-button active-debit' : 'type-button'} onClick={() => set('type', 'DEBIT')}><strong>Udhar Dala</strong><small>Debit · diya</small></button>
          <button type="button" className={form.type === 'CREDIT' ? 'type-button active-credit' : 'type-button'} onClick={() => set('type', 'CREDIT')}><strong>Wasooli Aayi</strong><small>Credit · wasooli</small></button>
        </div></div>
        <label>Amount / raqam<input ref={amountRef} required type="number" min="0.01" max="99999999" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" /></label>
        <label>Note / description<input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. 10 crates potato" /></label>
      </div>
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary">{transaction ? 'Update Transaction' : 'Save Transaction'} <kbd>Enter</kbd></button></div>
    </form>
  </div>;
}

function A4LedgerPrint({ customer, transactions, active, profile }) {
  if (!customer || !active) return null;
  const totalDebit = transactions.reduce((sum, t) => sum + (t.type === 'DEBIT' ? Number(t.amount) : 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.type === 'CREDIT' ? Number(t.amount) : 0), 0);
  return <section className="print-only a4-page">
    <header className="print-header"><h1>{profile.shop_name || 'Mandi Khata'}</h1><p>{profile.phone || ''}</p><p>Customer Ledger Statement · grahak khata</p></header>
    <div className="print-meta"><div><strong>Customer:</strong> {customer.name}<br /><strong>Phone:</strong> {customer.phone || '—'}</div><div><strong>Report Date:</strong> {new Date().toLocaleDateString('en-IN')}</div></div>
    <table><thead><tr><th>Date</th><th>Description</th><th>Udhar (Debit)</th><th>Wasooli (Credit)</th><th>Running Balance</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td>{dateLabel(t.date)}</td><td>{t.description || '—'}</td><td>{t.type === 'DEBIT' ? money(t.amount) : ''}</td><td>{t.type === 'CREDIT' ? money(t.amount) : ''}</td><td>{money(t.running_balance)}</td></tr>)}</tbody></table>
    <div className="print-footer"><p>Opening Balance: {money(0)}</p><p>Total Udhar: {money(totalDebit)}</p><p>Total Wasooli: {money(totalCredit)}</p><p><strong>Final Net Payable Amount: {money(customer.balance)} ({balanceLabel(customer.balance)})</strong></p><div className="signatures"></div></div>
  </section>;
}

function A4CustomersPrint({ rows, active, profile, periodLabel }) {
  if (!rows.length || !active) return null;
  const totalBalance = rows.reduce((sum, row) => sum + Number(row.net_balance || 0), 0);
  const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
  const totalAll = totalDebit + totalCredit;
  return <section className="print-only a4-page customer-report">
    <header className="print-header"><h1>{profile.shop_name || 'Mandi Khata'}</h1><p>Customer Accounts Report · grahak fehrist</p></header>
    <div className="print-meta"><strong>Total Customers: {rows.length}</strong><span>Period: {periodLabel}</span><span>Kul Udhar: {money(totalDebit)}</span><span>Kul Wasooli: {money(totalCredit)}</span><span>Kul Total: {money(totalAll)}</span><span>Report Date: {new Date().toLocaleDateString('en-IN')}</span></div>
    <table><thead><tr><th>#</th><th>Customer Name</th><th>Phone</th><th className="text-right">Udhar</th><th className="text-right">Wasooli</th><th className="text-right">Rehta Baqi</th><th className="text-right">Kul Total</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.name}</td><td>{row.phone || '—'}</td><td className="text-right">{money(row.debit)}</td><td className="text-right">{money(row.credit)}</td><td className="text-right">{money(Math.abs(Number(row.net_balance || 0)))}<small>{balanceLabel(row.net_balance)}</small></td><td className="text-right">{money(Number(row.debit || 0) + Number(row.credit || 0))}</td></tr>)}</tbody><tfoot><tr><th colSpan="3" className="text-right">Totals</th><th className="text-right">{money(totalDebit)}</th><th className="text-right">{money(totalCredit)}</th><th className="text-right">{money(Math.abs(totalBalance))}</th><th className="text-right">{money(totalAll)}</th></tr></tfoot></table>
  </section>;
}

/* ---------- Virtualized print customer list (500+ cards performance) ---------- */
function VirtualPrintCustomerList({ customers, selectedIds, onToggle }) {
  const scrollRef = useRef(null);
  const ROW_HEIGHT = 58;
  const virtualizer = useVirtualizer({ count: customers.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_HEIGHT, overscan: 12 });
  return <div className="print-customer-list" ref={scrollRef}>
    <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const customer = customers[virtualRow.index];
        return <label key={customer.id} className="print-customer-row" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
          <input className="print-checkbox" type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => onToggle(customer.id)} />
          <span className="print-customer-info"><strong>{customer.name}</strong><small>{customer.phone || 'No phone'}</small></span>
          <BalanceBadge value={customer.balance} compact />
        </label>;
      })}
    </div>
  </div>;
}

function CustomerPrintReport({ customers, transactions, onClose, onPrint }) {
  const [mode, setMode] = useState('today');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const todayKey = localDateKey(new Date());
  const visibleCustomers = useMemo(() => customers.filter((customer) => {
    const matchesSearch = !search || [customer.name, customer.phone].some((value) => (value || '').toLowerCase().includes(search.toLowerCase()));
    const customerTransactions = transactions.filter((transaction) => transaction.customer_id === customer.id);
    const inRange = (transaction) => {
      const date = localDateKey(transaction.date);
      return (!startDate || date >= startDate) && (!endDate || date <= endDate);
    };
    const matchesMode = mode === 'pending' ? Number(customer.balance || 0) > 0 : mode === 'today' ? customerTransactions.some((transaction) => localDateKey(transaction.date) === todayKey) : mode === 'all' ? true : (!startDate || !endDate || customerTransactions.some(inRange));
    return matchesSearch && matchesMode;
  }), [customers, transactions, mode, search, startDate, endDate, todayKey]);
  useEffect(() => setSelectedIds(visibleCustomers.map((customer) => customer.id)), [visibleCustomers]);
  const allVisibleSelected = visibleCustomers.length > 0 && visibleCustomers.every((customer) => selectedIds.includes(customer.id));
  const toggle = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const buildRows = () => {
    const periodStart = mode === 'today' ? today() : mode === 'range' && startDate ? new Date(`${startDate}T00:00:00`) : null;
    const periodEnd = mode === 'today' ? new Date() : mode === 'range' && endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    return customers.filter((customer) => selectedIds.includes(customer.id)).map((customer) => {
      const customerTransactions = transactions.filter((transaction) => transaction.customer_id === customer.id);
      const opening = periodStart ? customerTransactions.filter((transaction) => transactionDate(transaction.date) < periodStart).reduce((sum, transaction) => sum + (transaction.type === 'DEBIT' ? Number(transaction.amount) : -Number(transaction.amount)), 0) : 0;
      const periodTransactions = periodStart && periodEnd ? customerTransactions.filter((transaction) => { const date = transactionDate(transaction.date); return date && date >= periodStart && date <= periodEnd; }) : customerTransactions;
      const debit = periodTransactions.reduce((sum, transaction) => sum + (transaction.type === 'DEBIT' ? Number(transaction.amount) : 0), 0);
      const credit = periodTransactions.reduce((sum, transaction) => sum + (transaction.type === 'CREDIT' ? Number(transaction.amount) : 0), 0);
      return { id: customer.id, name: customer.name, phone: customer.phone, opening, debit, credit, net_balance: periodStart ? opening + debit - credit : Number(customer.balance || 0) };
    });
  };
  const submit = () => {
    const rows = buildRows();
    if (rows.length) onPrint(rows, mode === 'today' ? "Today's active customers" : mode === 'pending' ? 'Pending balances' : mode === 'range' ? `${startDate} to ${endDate}` : 'All customers');
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card customer-print-modal"><div className="modal-heading"><div><span className="eyebrow">Print report</span><h2>Choose customers to print</h2><span className="muted">{selectedIds.length} selected · {visibleCustomers.length} visible</span></div><button type="button" onClick={onClose} className="icon-button" aria-label="Close">×</button></div><div className="print-options"><label>Report filter<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="today">Today's Active Only</option><option value="pending">Pending Balances Only</option><option value="range">Custom Date Range</option><option value="all">All Customers</option></select></label>{mode === 'range' && <><label>From<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>To<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></>}<label className="print-search">Search customer<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" /></label></div><label className="select-visible"><input className="print-checkbox" type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : visibleCustomers.map((customer) => customer.id))} /><span>Select All Visible</span></label>{visibleCustomers.length ? <VirtualPrintCustomerList customers={visibleCustomers} selectedIds={selectedIds} onToggle={toggle} /> : <p className="empty">No customers match this report filter.</p>}<div className="modal-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={!selectedIds.length || (mode === 'range' && (!startDate || !endDate))} onClick={submit}>Print Selected ({selectedIds.length})</button></div></div></div>;
}

function RoznamchaReport({ transactions, summary, onClose, onPrint }) {
  const totalDebit = Number(summary.total_debit || 0);
  const totalCredit = Number(summary.total_credit || 0);
  return <div className="modal-backdrop report-backdrop" role="dialog" aria-modal="true">
    <div className="modal-card report-modal">
      <div className="modal-heading no-print"><div><span className="eyebrow">Daily report · {new Date().toLocaleDateString('en-IN')}</span><h2>Today's Roznamcha</h2></div><button type="button" onClick={onClose} className="icon-button" aria-label="Close">×</button></div>
      <div className="report-preview">
        <div className="report-title"><h3>Kashmir Commission Shop #44</h3><p>Today's Roznamcha · aaj ka roznamcha</p><strong>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong></div>
        <div className="report-summary"><div className="debit"><span>Total Udhar</span><b>{money(totalDebit)}</b></div><div className="credit"><span>Total Wasooli</span><b>{money(totalCredit)}</b></div><div className={balanceState(totalDebit - totalCredit)}><span>Net Today</span><b>{money(Math.abs(totalDebit - totalCredit))}</b><small>{balanceLabel(totalDebit - totalCredit)}</small></div></div>
        <div className="table-wrap report-table"><table><thead><tr><th>Time</th><th>Customer</th><th>Details</th><th>Type</th><th className="text-right">Amount</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td>{timeLabel(t.date)}</td><td><strong>{t.customer_name}</strong></td><td>{t.description || '—'}</td><td><span className={`type-pill ${t.type === 'DEBIT' ? 'debit' : 'credit'}`}>{t.type === 'DEBIT' ? 'Udhar' : 'Wasooli'}</span></td><td className={`text-right ${t.type === 'DEBIT' ? 'debit-text' : 'credit-text'}`}>{money(t.amount)}</td></tr>)}{!transactions.length && <tr><td colSpan="5" className="empty">No transactions recorded today.</td></tr>}</tbody></table></div>
      </div>
      <div className="modal-actions no-print"><button className="button-secondary" onClick={onClose}>Close</button><button className="button-primary" onClick={onPrint}>Print A4 Report <kbd>Ctrl + P</kbd></button></div>
    </div>
  </div>;
}

function ConfirmModal({ title, message, onClose, onConfirm, bulk = false, buttonLabel = 'Delete' }) {
  const [confirmation, setConfirmation] = useState('');
  const ready = !bulk || confirmation === 'DELETE';
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal-card confirm-card">
      <div className="modal-heading"><div><span className="eyebrow">Please confirm</span><h2>{title}</h2></div><button type="button" onClick={onClose} className="icon-button" aria-label="Close">×</button></div>
      <p className="confirm-message">{message}</p>
      {bulk && <label className="confirm-input">Type <strong>DELETE</strong> to continue<input autoFocus value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="DELETE" /></label>}
      <div className="modal-actions"><button className="button-secondary" onClick={onClose}>Cancel</button><button className="button-danger" disabled={!ready} onClick={onConfirm}>{buttonLabel}</button></div>
    </div>
  </div>;
}

function Sidebar({ view, setView, collapsed, setCollapsed }) {
  const items = [
    ['dashboard', '⌂', 'Dashboard'],
    ['settings', '⚙', 'Shop Profile / Settings'],
    ['customer-details', '♙', 'Customer Details'],
    ['global-history', '▤', 'Global Transaction History'],
    ['recycle-bin', '🗑', 'Recycle Bin']
  ];
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="sidebar-brand"><div className="brand-mark">MK</div>{!collapsed && <strong>Mandi Khata</strong>}<button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '›' : '‹'}</button></div>
    <nav className="sidebar-nav" aria-label="Main navigation">{items.map(([key, icon, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)} title={collapsed ? label : undefined}><span>{icon}</span>{!collapsed && <b>{label}</b>}</button>)}</nav>
    {!collapsed && <div className="sidebar-foot">Offline ledger<br /><small>Your data stays on this device</small><div>Developed by Abdullah<br/><small>Support: 03267417348</small></div></div>}
  </aside>;
}

function SettingsView({ profile, onSave, error, masterUnlocked, success }) {
  const [form, setForm] = useState({ ...profile, old_pin: '', new_pin: '' });
  useEffect(() => setForm(profile), [profile]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const hasChanges = form.shop_number !== (profile.shop_number || '') || form.phone !== (profile.phone || '') || form.city !== (profile.city || '') || (form.old_pin && form.new_pin);
  return <div className="page-content standalone-page">
    {error && <div className="alert mb-4">{error}</div>}
    {success && <div className="alert-success mb-4">{success}</div>}
    <section className="panel settings-panel"><div className="panel-heading"><div><span className="eyebrow">Configuration</span><h2>Shop Profile / Settings</h2><span className="muted">These details appear on printed reports.</span></div></div>
      <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <label>Shop name<input required value={form.shop_name || ''} disabled placeholder="Your shop name" /></label>
        <label>Shop / commission agent no<input value={form.shop_number || ''} onChange={(e) => set('shop_number', e.target.value)} placeholder="e.g. Shop # 42" /></label>
        <label>Contact phone number<input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="03xx-xxxxxxx" /></label>
        <label>Mandi address / city<input value={form.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Sabzi Mandi Lahore" /></label>
        <div className="pin-section"><span className="label-text">{masterUnlocked ? 'Reset PIN' : 'Change PIN'}</span><div className={masterUnlocked ? 'pin-grid single' : 'pin-grid'}>{!masterUnlocked && <label>Old PIN<PasswordInput maxLength="4" value={form.old_pin || ''} onChange={(e) => set('old_pin', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" placeholder_NO /></label>}<label>New 4-digit PIN<PasswordInput maxLength="4" value={form.new_pin || ''} onChange={(e) => set('new_pin', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" /></label></div></div>
        <div className="modal-actions"><button className="button-primary" type="submit" disabled={!hasChanges}>Save Settings</button></div>
      </form>
    </section>
  </div>;
}

function LoginScreen({ hasPin, onLogin, onSetup, error }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    if (!(hasPin ? /^\d{4,6}$/.test(pin) : /^\d{4}$/.test(pin))) {
      setMessage(hasPin ? 'Enter your 4-digit PIN.' : 'PIN must be exactly 4 digits.');
      return;
    }
    if (!hasPin && pin !== confirmPin) {
      setMessage('PINs do not match.');
      return;
    }
    try {
      if (hasPin) await onLogin(pin);
      else await onSetup(pin);
    } catch (e) {
      setMessage(e.message);
    }
  };
  return <main className="login-screen"><div className="login-card"><div className="brand-mark">MK</div><span className="eyebrow">Secure offline ledger</span><h1>{hasPin ? 'Welcome back' : 'Set your PIN'}</h1><p>{hasPin ? 'Enter your PIN to open Mandi Khata.' : 'Create a 4-digit PIN to protect your ledger.'}</p><form onSubmit={submit}><label>{hasPin ? 'PIN' : 'New 4-digit PIN'}<PasswordInput autoFocus required maxLength={hasPin ? 6 : 4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, hasPin ? 6 : 4))} placeholder="••••" /></label>{!hasPin && <label>Confirm PIN<PasswordInput required maxLength="4" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" /></label>}{(message || error) && <p className="login-error">{message || error}</p>}<button className="button-primary" type="submit">{hasPin ? 'Unlock Dashboard' : 'Save PIN & Continue'}</button></form></div></main>;
}

function PhotoPreview({ photo, name, onClose }) {
  return <div className="modal-backdrop photo-preview-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
    <div className="photo-preview-card" onClick={(event) => event.stopPropagation()}><button type="button" className="icon-button photo-preview-close" onClick={onClose} aria-label="Close photo">×</button><img src={photoUrl(photo)} alt={`${name} full profile`} /><strong>{name}</strong></div>
  </div>;
}

/* ---------- Virtualized customer list (dashboard) ---------- */
function VirtualCustomerList({ customers, selectedId, onSelect }) {
  return <div className="customer-list customer-list-scroll">
    {customers.map((c) => <button key={c.id} onClick={() => onSelect(c.id)} className={selectedId === c.id ? 'customer-row selected' : 'customer-row'}>
      {c.photo ? <img className="customer-avatar" src={photoUrl(c.photo)} alt="" loading="lazy" /> : <div className="customer-avatar">{c.name.slice(0, 1).toUpperCase()}</div>}
      <div className="customer-info"><strong>{c.name}</strong><small>{c.phone || 'No phone number'}</small></div>
      <BalanceBadge value={c.balance} compact />
    </button>)}
  </div>;
}

/* ---------- Virtualized customer details grid ---------- */
function VirtualCustomerDetailsGrid({ customers, selectedId, onSelect, onEdit, onDelete, onPhotoClick, totals }) {
  return <div className="customer-details-grid-wrap">
    {customers.map((customer) => <div key={customer.id} className={`customer-detail-card ${selectedId === customer.id ? 'selected' : ''}`}>
      <button className="customer-detail-card-body" onClick={() => onSelect(customer.id)}>
        {customer.photo ? <img className="customer-detail-photo" src={photoUrl(customer.photo)} alt={`${customer.name} profile`} loading="lazy" onClick={(event) => { event.stopPropagation(); onPhotoClick(customer); }} /> : <div className="customer-detail-photo customer-detail-placeholder">{customer.name.slice(0, 1).toUpperCase()}</div>}
        <span className="customer-detail-info"><strong>{customer.name}</strong><small>{customer.phone || 'No phone number saved'}</small><BalanceBadge value={customer.balance} compact />{totals[customer.id] && <small className="customer-total">Kul Total: {money(totals[customer.id].total)}</small>}</span>
      </button>
      <div className="customer-detail-actions">
        <button className="icon-edit" title="Edit customer" onClick={() => onEdit(customer)}>✎</button>
        <button className="icon-delete" title="Delete customer" onClick={() => onDelete(customer)}>✕</button>
      </div>
    </div>)}
  </div>;
}

function CustomerDetailsView({ customers, selectedId, onSelect, onAdd, onEdit, onDelete, onPhotoClick, totals }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => customers.filter((c) => [c.name, c.phone].some((v) => (v || '').toLowerCase().includes(search.toLowerCase()))), [customers, search]);
  return <div className="page-content standalone-page">
    <section className="panel customer-details-panel">
      <div className="panel-heading"><div><span className="eyebrow">Customer directory</span><h2>Customer Details</h2><span className="muted">{filtered.length} of {customers.length} customers</span></div><button className="button-primary small" onClick={onAdd}>＋ Add Customer</button></div>
      <div className="search-wrap"><span>⌕</span><input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name or phone..." /></div>
      {filtered.length ? <VirtualCustomerDetailsGrid customers={filtered} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} onPhotoClick={onPhotoClick} totals={totals} /> : <p className="empty">{search ? 'No customers match your search.' : 'No customers yet. Add your first customer profile.'}</p>}
    </section>
  </div>;
}

/* ---------- Ledger table ---------- */
function VirtualLedgerTable({ transactions, onEdit, onDelete }) {
  return <div className="virtual-ledger-scroll">
    <div className="ledger-header-row">
      <div className="lcell lcell-date">Date</div>
      <div className="lcell lcell-desc">Description</div>
      <div className="lcell lcell-debit">Udhar<small>Debit</small></div>
      <div className="lcell lcell-credit">Wasooli<small>Credit</small></div>
      <div className="lcell lcell-balance">Balance</div>
      <div className="lcell lcell-actions"></div>
    </div>
    {transactions.map((t, i) => <div key={t.id} className={`virtual-ledger-row ${i % 2 === 0 ? 'row-striped' : ''}`}>
      <div className="ledger-cell"><strong>{dateLabel(t.date)}</strong><small>{timeLabel(t.date)}</small></div>
      <div className="ledger-cell desc-cell">{t.description || '—'}</div>
      <div className="ledger-cell text-right debit-text">{t.type === 'DEBIT' ? money(t.amount) : '—'}</div>
      <div className="ledger-cell text-right credit-text">{t.type === 'CREDIT' ? money(t.amount) : '—'}</div>
      <div className={`ledger-cell text-right balance-cell ${balanceState(t.running_balance)}`}>{money(Math.abs(t.running_balance))}<small>{balanceLabel(t.running_balance)}</small></div>
      <div className="ledger-cell row-actions"><button onClick={() => onEdit(t)} aria-label="Edit transaction">✎</button><button onClick={() => onDelete(t)} aria-label="Delete transaction">⌫</button></div>
    </div>)}
  </div>;
}

function GlobalHistoryView({ transactions, customers, onDelete, onBulkDelete }) {
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const currentMonthEndStr = `${currentMonthEnd.getFullYear()}-${String(currentMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(currentMonthEnd.getDate()).padStart(2, '0')}`;
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState(currentMonthStart);
  const [endDate, setEndDate] = useState(currentMonthEndStr);
  const [selectedIds, setSelectedIds] = useState([]);
  const transactionsWithBalance = useMemo(() => {
    const ordered = [...transactions].sort((a, b) => {
      const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
      return dateDifference || a.id - b.id;
    });
    const running = new Map();
    return ordered.map((transaction) => {
      const previous = running.get(transaction.customer_id) || 0;
      const balance = previous + (transaction.type === 'DEBIT' ? Number(transaction.amount) : -Number(transaction.amount));
      running.set(transaction.customer_id, balance);
      return { ...transaction, running_balance: balance };
    });
  }, [transactions]);
  const filtered = useMemo(() => transactionsWithBalance.filter((transaction) => {
    const haystack = [transaction.customer_name, transaction.customer_phone, transaction.shop_number, transaction.description].map((v) => (v || '').toLowerCase()).join(' ');
    const key = transactionDate(transaction.date);
    const date = key ? `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, '0')}-${String(key.getDate()).padStart(2, '0')}` : '';
    return (!search || haystack.includes(search.toLowerCase())) &&
      (!customerId || String(transaction.customer_id) === customerId) &&
      (!type || transaction.type === type) &&
      (!startDate || date >= startDate) && (!endDate || date <= endDate);
  }), [transactionsWithBalance, search, customerId, type, startDate, endDate]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((transaction) => selectedIds.includes(transaction.id));
  const toggle = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleAll = () => setSelectedIds(allVisibleSelected ? [] : filtered.map((transaction) => transaction.id));
  return <div className="page-content standalone-page">
    <section className="panel global-history-panel"><div className="panel-heading ledger-heading"><div><span className="eyebrow">All accounts</span><h2>Global Transaction History</h2><span className="muted">{filtered.length} of {transactions.length} transactions</span></div>
      <div className="bulk-actions"><button className="button-danger" disabled={!selectedIds.length} onClick={() => onBulkDelete({ ids: selectedIds, label: `${selectedIds.length} selected transaction(s)` })}>Delete Selected</button><button className="button-danger outline" onClick={() => onBulkDelete({ all: true, label: 'all transactions' })}>Delete All</button></div>
    </div>
      <div className="global-filters"><div className="search-wrap"><span>⌕</span><input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone, notes..." /></div><label>Customer<select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">All customers</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="DEBIT">Udhar / Debit</option><option value="CREDIT">☑ / Credit</option></select></label><label>From<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>To<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
      <div className="bulk-date-row"><span>Select a date range above, then use:</span><button className="button-danger outline" disabled={!startDate || !endDate} onClick={() => onBulkDelete({ startDate, endDate, label: `transactions from ${startDate} to ${endDate}` })}>Delete Date Range</button><button className="button-secondary" onClick={() => { setSearch(''); setCustomerId(''); setType(''); setStartDate(currentMonthStart); setEndDate(currentMonthEndStr); setSelectedIds([]); }}>Clear Filters</button></div>
            <div className="virtual-scroll-container history-scroll" onScroll={(e) => { const el = e.currentTarget; el.classList.toggle('has-hscroll', el.scrollWidth > el.clientWidth); el.classList.toggle('has-vscroll', el.scrollHeight > el.clientHeight); }}>
        <div className="history-table-header">
          <div className="history-header-cell"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select visible transactions" /></div>
          <div className="history-header-cell">Date & time<small>taareekh</small></div>
          <div className="history-header-cell">Customer<small>grahak</small></div>
          <div className="history-header-cell">Phone<small>number</small></div>
          <div className="history-header-cell">Udhar<small>Debit</small></div>
          <div className="history-header-cell">Wasooli<small>Credit</small></div>
          <div className="history-header-cell">Balance<small>baqaya</small></div>
          <div className="history-header-cell">Notes<small>tafseelat</small></div>
          <div className="history-header-cell"></div>
        </div>
        {filtered.map((transaction, i) => <div key={transaction.id} className={`history-row ${i % 2 === 0 ? 'row-striped' : ''} ${selectedIds.includes(transaction.id) ? 'row-selected' : ''}`}>
              <div className="history-cell"><input type="checkbox" checked={selectedIds.includes(transaction.id)} onChange={() => toggle(transaction.id)} aria-label={`Select transaction ${transaction.id}`} /></div>
              <div className="history-cell"><strong>{dateLabel(transaction.date)}</strong><small>{timeLabel(transaction.date)}</small></div>
              <div className="history-cell"><strong>{transaction.customer_name}</strong></div>
              <div className="history-cell"><small>{transaction.customer_phone || '—'}</small></div>
              <div className="history-cell debit-text">{transaction.type === 'DEBIT' ? money(transaction.amount) : '—'}</div>
              <div className="history-cell credit-text">{transaction.type === 'CREDIT' ? money(transaction.amount) : '—'}</div>
              <div className={`history-cell balance-cell ${balanceState(transaction.running_balance)}`}><strong>{money(Math.abs(transaction.running_balance))}</strong><small>{balanceLabel(transaction.running_balance)}</small></div>
              <div className="history-cell notes-cell">{transaction.description || '—'}</div>
              <div className="history-cell row-actions"><button onClick={() => onDelete(transaction)} title="Delete">✕</button></div>
            </div>)}
        {!filtered.length && <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#94a3b8'}}>No transactions match your filters.</div>}
      </div>
    </section>
  </div>;
}

function RecycleBinView({ items, onRestore, onPermanentDelete, onEmptyBin }) {
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const currentMonthEndStr = `${currentMonthEnd.getFullYear()}-${String(currentMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(currentMonthEnd.getDate()).padStart(2, '0')}`;
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dateStart, setDateStart] = useState(currentMonthStart);
  const [dateEnd, setDateEnd] = useState(currentMonthEndStr);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const filtered = useMemo(() => items.filter((item) => {
    const matchesTab = tab === 'all' ? true : tab === 'customers' ? item.type === 'customer' : item.type === 'transaction';
    const haystack = [item.name, item.customer_name, item.phone, item.customer_phone, item.description, item.shop_number].map((v) => (v || '').toLowerCase()).join(' ');
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const deletedDate = item.deletedAt ? localDateKey(item.deletedAt) : '';
    const matchesDate = (!dateStart || deletedDate >= dateStart) && (!dateEnd || deletedDate <= dateEnd);
    return matchesTab && matchesSearch && matchesDate;
  }), [items, tab, search, dateStart, dateEnd]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selectedIds.includes(`${item.type}-${item.id}`));
  const toggle = (key) => setSelectedIds((ids) => ids.includes(key) ? ids.filter((k) => k !== key) : [...ids, key]);
  const toggleAll = () => setSelectedIds(allVisibleSelected ? [] : filtered.map((item) => `${item.type}-${item.id}`));
  const handleBulkRestore = async () => { setLoading(true); for (const key of selectedIds) { const [type, id] = key.split('-'); await onRestore({ type, id: Number(id) }); } setSelectedIds([]); setLoading(false); };
  const handleBulkPermanentDelete = async () => { setLoading(true); for (const key of selectedIds) { const [type, id] = key.split('-'); await onPermanentDelete({ type, id: Number(id) }); } setSelectedIds([]); setLoading(false); };
  return <div className="page-content standalone-page">
    <section className="panel global-history-panel">
      <div className="panel-heading ledger-heading"><div><span className="eyebrow">Recover or remove</span><h2>Recycle Bin</h2><span className="muted">{items.length} deleted item{items.length !== 1 ? 's' : ''}</span></div>
        <div className="bulk-actions">
          <button className="button-primary small" disabled={!selectedIds.length || loading} onClick={handleBulkRestore}>↻ Restore ({selectedIds.length})</button>
          <button className="button-danger small" disabled={!selectedIds.length || loading} onClick={handleBulkPermanentDelete}>Delete Permanently</button>
          <button className="button-danger outline" disabled={!items.length || loading} onClick={onEmptyBin}>Empty Bin</button>
        </div>
      </div>
      <div className="global-filters">
        <div className="search-wrap"><span>⌕</span><input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deleted items..." /></div>
        <label>Type<select value={tab} onChange={(e) => { setTab(e.target.value); setSelectedIds([]); }}><option value="all">All</option><option value="customers">Customers</option><option value="transactions">Tx</option></select></label>
        <label>From<input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} /></label>
        <label>To<input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} /></label>
      </div>
      <div className="virtual-scroll-container recycle-scroll" onScroll={(e) => { const el = e.currentTarget; el.classList.toggle('has-hscroll', el.scrollWidth > el.clientWidth); el.classList.toggle('has-vscroll', el.scrollHeight > el.clientHeight); }}>
        <div className="history-table-header">
          <div className="history-header-cell"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all" /></div>
          <div className="history-header-cell">Type<small>qism</small></div>
          <div className="history-header-cell">Deleted on<small>taareekh</small></div>
          <div className="history-header-cell">Customer<small>grahak</small></div>
          <div className="history-header-cell">Phone<small>number</small></div>
          <div className="history-header-cell">Udhar<small>Debit</small></div>
          <div className="history-header-cell">Wasooli<small>Credit</small></div>
          <div className="history-header-cell">Balance<small>baqaya</small></div>
          <div className="history-header-cell">Notes<small>tafseelat</small></div>
          <div className="history-header-cell">Actions<small>amal</small></div>
        </div>
        {filtered.map((item, i) => {
            const key = `${item.type}-${item.id}`;
            return <div key={key} className={`history-row ${i % 2 === 0 ? 'row-striped' : ''} ${selectedIds.includes(key) ? 'row-selected' : ''}`}>
              <div className="history-cell"><input type="checkbox" checked={selectedIds.includes(key)} onChange={() => toggle(key)} aria-label="Select item" /></div>
              <div className="history-cell"><span className={`recycle-type-pill ${item.type}`}>{item.type === 'customer' ? 'Customer' : 'Tx'}</span></div>
              <div className="history-cell"><strong>{item.deletedAt ? dateLabel(item.deletedAt) : '—'}</strong><small>{item.deletedAt ? timeLabel(item.deletedAt) : ''}</small></div>
              <div className="history-cell"><strong>{item.type === 'customer' ? item.name : item.customer_name}</strong></div>
              <div className="history-cell"><small>{item.type === 'customer' ? (item.phone || '—') : (item.customer_phone || '—')}</small></div>
              <div className="history-cell debit-text">{item.type === 'transaction' && item.txType === 'DEBIT' ? money(item.amount) : '—'}</div>
              <div className="history-cell credit-text">{item.type === 'transaction' && item.txType === 'CREDIT' ? money(item.amount) : '—'}</div>
              <div className={`history-cell balance-cell ${item.type === 'transaction' ? balanceState(item.running_balance) : 'zero'}`}>{item.type === 'transaction' ? <><strong>{money(Math.abs(item.running_balance))}</strong><small>{balanceLabel(item.running_balance)}</small></> : '—'}</div>
              <div className="history-cell notes-cell">{item.type === 'customer' ? (item.shop_number || '—') : (item.description || '—')}</div>
              <div className="history-cell row-actions"><button onClick={() => onRestore({ type: item.type, id: item.id })} title="Restore">↻</button><button onClick={() => onPermanentDelete({ type: item.type, id: item.id })} title="Delete permanently">✕</button></div>
            </div>;
          })}
        {!filtered.length && <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#94a3b8'}}>{items.length ? 'No deleted items match your filters.' : 'Recycle bin is empty.'}</div>}
      </div>
    </section>
  </div>;
}

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({});
  const [allTransactions, setAllTransactions] = useState([]);
  const [globalHistoryLoaded, setGlobalHistoryLoaded] = useState(false);
  const [profile, setProfile] = useState({ shop_name: 'Kashmir Commission Shop #44', shop_number: '', phone: '', city: '', pin_code: '' });
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [masterUnlocked, setMasterUnlocked] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [roznamcha, setRoznamcha] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [printMode, setPrintMode] = useState('ledger');
  const [customerPrintRows, setCustomerPrintRows] = useState([]);
  const [customerPrintPeriod, setCustomerPrintPeriod] = useState('');
  const [view, setView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [summaryFilter, setSummaryFilter] = useState('today');
  const [filteredSummary, setFilteredSummary] = useState({ debit: 0, credit: 0, net: 0, total: 0 });
  const [customerTotals, setCustomerTotals] = useState({});
  const searchRef = useRef(null);
  const selected = customers.find((c) => c.id === selectedId) || null;
  const filtered = useMemo(() => customers.filter((c) => [c.name, c.phone].some((v) => (v || '').toLowerCase().includes(search.toLowerCase()))), [customers, search]);
  const visibleTransactions = useMemo(() => {
    if (dateFilter === 'all') return transactions;
    const start = today();
    if (dateFilter === '7days') start.setDate(start.getDate() - 6);
    if (dateFilter === 'month') start.setDate(1);
    return transactions.filter((t) => {
      const date = transactionDate(t.date);
      if (!date) return false;
      date.setHours(0, 0, 0, 0);
      return date >= start;
    });
  }, [transactions, dateFilter]);

  const refresh = useCallback(async () => {
    const [list, daily, totals] = await Promise.all([window.api.getCustomers(), window.api.getDailySummary(), window.api.getCustomerTotals()]);
    setCustomers(list);
    setSummary(daily || {});
    setCustomerTotals(totals || {});
    setSelectedId((current) => current && list.some((c) => c.id === current) ? current : (list[0]?.id || null));
  }, []);
  const refreshGlobal = useCallback(async () => {
    setAllTransactions(await window.api.getAllTransactions());
    setGlobalHistoryLoaded(true);
  }, []);
  const loadTransactions = useCallback(async (id) => setTransactions(id ? await window.api.getCustomerTransactions(id) : []), []);
  const loadRecycleBin = useCallback(async () => {
    try {
      const items = await window.api.getDeletedItems();
      setRecycleBinItems(items);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    if (!window.api) {
      setError('App services are unavailable. Please launch Mandi Khata through Electron, not the Vite preview.');
      setAuthReady(true);
      return undefined;
    }
    window.api.getSettings().then((settings) => {
      setProfile(settings);
      setAuthenticated(false);
      setAuthReady(true);
    }).catch((e) => { setError(e.message); setAuthReady(true); });
    return undefined;
  }, []);
  useEffect(() => {
    if (!authenticated) return undefined;
    Promise.all([refresh(), loadRecycleBin()]).catch((e) => setError(e.message));
    return undefined;
  }, [authenticated, refresh, loadRecycleBin]);
  useEffect(() => { loadTransactions(selectedId).catch((e) => setError(e.message)); }, [selectedId, loadTransactions]);
  useEffect(() => {
    if (!authenticated) return undefined;
    window.api.getSummary(summaryFilter).then(setFilteredSummary).catch((e) => setError(e.message));
    return undefined;
  }, [summaryFilter, authenticated, customers]);
  useEffect(() => {
    if (view === 'global-history' && !globalHistoryLoaded) {
      refreshGlobal().catch((e) => setError(e.message));
    }
  }, [view, globalHistoryLoaded, refreshGlobal]);
  useEffect(() => {
    const onShortcut = (event) => {
      const key = event.key.toLowerCase();
      if (key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); searchRef.current?.focus(); }
      if (key === 'f2') { event.preventDefault(); setModal('customer'); }
      if (key === 'f3' || ((event.ctrlKey || event.metaKey) && key === 't')) { event.preventDefault(); setModal('transaction'); }
      if ((event.ctrlKey || event.metaKey) && key === 'p' || key === 'f4') { event.preventDefault(); if (selected) print('ledger'); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [selected]);

  const saveCustomer = async (data) => {
    try { const result = data.id ? await window.api.updateCustomer(data) : await window.api.addCustomer(data); setModal(null); await Promise.all([refresh(), refreshGlobal(), loadRecycleBin()]); setSelectedId(result.id); setView('customer-details'); }
    catch (e) { setError(e.message); }
  };
  const deleteCustomer = (customer) => {
    setConfirmAction({
      title: 'Delete customer?',
      message: `Are you sure you want to delete "${customer.name}"? This customer and all their transactions will be moved to Recycle Bin.`,
      bulk: false,
      buttonLabel: 'Delete',
      execute: async () => {
        await window.api.deleteCustomer(customer.id);
        setSelectedId((current) => current === customer.id ? null : current);
        await Promise.all([refresh(), refreshGlobal(), loadRecycleBin()]);
      }
    });
  };
  const saveTransaction = async (data) => {
    try {
      if (data.id) await window.api.updateTransaction(data);
      else await window.api.addTransaction(data);
      setModal(null); setEditingTransaction(null); await Promise.all([refresh(), refreshGlobal(), loadTransactions(selectedId)]);
    } catch (e) { setError(e.message); }
  };
  const deleteTransaction = (transaction) => {
    setConfirmAction({
      title: 'Delete transaction?',
      message: `Delete this ${transaction.type === 'DEBIT' ? 'Udhar' : 'Wasooli'} entry of ${money(transaction.amount)}? This transaction will be moved to Recycle Bin.`,
      bulk: false,
      buttonLabel: 'Delete',
      execute: async () => {
        await window.api.deleteTransaction(transaction.id);
        await Promise.all([refresh(), refreshGlobal(), loadTransactions(selectedId)]);
      }
    });
  };
  const deleteTransactionFromLedger = (transaction) => {
    setConfirmAction({
      title: 'Delete transaction?',
      message: `Delete this ${transaction.type === 'DEBIT' ? 'Udhar' : 'Wasooli'} entry of ${money(transaction.amount)}? This transaction will be moved to Recycle Bin.`,
      bulk: false,
      buttonLabel: 'Delete',
      execute: async () => {
        await window.api.deleteTransaction(transaction.id);
        await Promise.all([refresh(), refreshGlobal(), loadTransactions(selectedId), loadRecycleBin()]);
      }
    });
  };
  const requestBulkDelete = ({ ids, all, startDate, endDate, label }) => {
    setConfirmAction({
      title: 'Bulk delete',
      message: `${label} will be moved to Recycle Bin. Affected customer balances will be recalculated.`,
      bulk: true,
      buttonLabel: 'Delete',
      execute: async () => {
        await window.api.deleteTransactionsBulk({ ids, all, startDate, endDate });
        await Promise.all([refresh(), refreshGlobal(), loadTransactions(selectedId)]);
      }
    });
  };
  const saveProfile = async (data) => {
    try {
      const payload = { shop_name: data.shop_name, shop_number: data.shop_number, phone: data.phone, city: data.city };
      if (data.old_pin && data.new_pin) { payload.old_pin = data.old_pin; payload.new_pin = data.new_pin; }
      setProfile(await window.api.updateSettings(payload)); setMasterUnlocked(false); setError('');
      setSuccess('Settings saved successfully!');
      setTimeout(() => { setSuccess(''); setView('dashboard'); }, 1500);
    } catch (e) { setError(e.message); }
  };
  const verifyPin = async (pin) => {
    const result = await window.api.verifyPin(pin);
    setError('');
    setMasterUnlocked(Boolean(result.master));
    setAuthenticated(true);
  };
  const setupPin = async (pin) => {
    const settings = await window.api.updateSettings({ new_pin: pin });
    setProfile(settings);
    setError('');
    setMasterUnlocked(false);
    setAuthenticated(true);
  };
  const print = (mode) => {
    setPrintMode(mode);
    requestAnimationFrame(() => requestAnimationFrame(() => window.api.printWindow()));
  };
  const [recycleBinItems, setRecycleBinItems] = useState([]);
  const restoreRecycleItem = async ({ type, id }) => {
    try { await window.api.restoreItem({ type, id }); await Promise.all([refresh(), refreshGlobal(), loadRecycleBin()]); } catch (e) { setError(e.message); }
  };
  const permanentDeleteRecycleItem = ({ type, id }) => {
    setConfirmAction({
      title: 'Permanent delete?',
      message: 'This item will be permanently deleted and cannot be recovered. Are you sure?',
      bulk: false,
      buttonLabel: 'Delete permanently',
      execute: async () => {
        await window.api.permanentDelete({ type, id });
        await Promise.all([refresh(), refreshGlobal(), loadRecycleBin()]);
      }
    });
  };
  const emptyRecycleBin = () => {
    setConfirmAction({
      title: 'Empty recycle bin?',
      message: 'All deleted items will be permanently removed. This cannot be undone.',
      bulk: true,
      buttonLabel: 'Delete permanently',
      execute: async () => {
        await window.api.emptyRecycleBin();
        await Promise.all([refresh(), refreshGlobal(), loadRecycleBin()]);
      }
    });
  };
  const printAllCustomers = async () => {
    try {
      const [latestCustomers, latestTransactions] = await Promise.all([window.api.getCustomers(), window.api.getAllTransactions()]);
      const rows = latestCustomers.map((customer) => {
        const customerTransactions = latestTransactions.filter((transaction) => transaction.customer_id === customer.id);
        const debit = customerTransactions.reduce((sum, transaction) => sum + (transaction.type === 'DEBIT' ? Number(transaction.amount) : 0), 0);
        const credit = customerTransactions.reduce((sum, transaction) => sum + (transaction.type === 'CREDIT' ? Number(transaction.amount) : 0), 0);
        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          shop_number: customer.shop_number,
          debit,
          credit,
          net_balance: Number(customer.balance || 0)
        };
      });
      setCustomerPrintRows(rows);
      setCustomerPrintPeriod('All customers');
      print('customers');
    } catch (e) {
      setError(e.message);
    }
  };
  const printCustomerReport = (rows, periodLabel) => {
    setCustomerPrintRows(rows);
    setCustomerPrintPeriod(periodLabel);
    print('customers');
  };
  const openRoznamcha = async () => {
    try { setRoznamcha(await window.api.getTodayTransactions()); setModal('roznamcha'); }
    catch (e) { setError(e.message); }
  };
  const filterPills = [['all', 'All'], ['today', 'Today'], ['7days', 'Last 7 Days'], ['month', 'This Month']];

  if (!authReady) return <main className="login-screen"><div className="login-card"><div className="brand-mark">MK</div><p>Loading secure ledger...</p></div></main>;
  if (!authenticated) return <LoginScreen hasPin={Boolean(profile.pin_code)} onLogin={verifyPin} onSetup={setupPin} error={error} />;

  return <div className="app-shell">
    <div className="no-print">
      <Sidebar view={view} setView={setView} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="app-main">
      <header className="topbar"><div className="topbar-inner"><div className="brand"><div className="brand-mark">MK</div><div className="brand-text"><h1>{profile.shop_name || 'Mandi Khata'}</h1><p>{profile.city || 'Offline Ledger'} <span>·</span> {profile.phone || 'Local data'}</p></div></div><div className="header-actions"><button className="button-light" onClick={openRoznamcha}>▣ Today's Roznamcha</button><button className="button-light" onClick={printAllCustomers}>Print Customers Report</button><button className="button-primary header-transaction" onClick={() => setModal('transaction')}>＋ Quick Transaction <kbd>F3</kbd></button></div></div></header>
      {view === 'dashboard' && <main className="page-content">
        {error && <div className="alert mb-4">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
        <div className="summary-filter">{[['today', 'Today'], ['weekly', 'This Week'], ['monthly', 'This Month'], ['all', 'All Time']].map(([key, label]) => <button key={key} className={summaryFilter === key ? 'active' : ''} onClick={() => setSummaryFilter(key)}>{label}</button>)}</div>
        <div className="summary-grid">
        <div className="summary-card debit"><div className="summary-icon">↗</div><span>{summaryFilter === 'today' ? "Today's Udhar" : summaryFilter === 'weekly' ? "This Week's Udhar" : summaryFilter === 'monthly' ? "This Month's Udhar" : "Total Udhar"} <small>{summaryFilter === 'today' ? 'aaj ka udhar' : summaryFilter === 'weekly' ? 'is hafte ka udhar' : summaryFilter === 'monthly' ? 'is mahine ka udhar' : 'kul udhar'} · Debit</small></span><strong>{money(filteredSummary.debit)}</strong></div>
        <div className="summary-card credit"><div className="summary-icon">↙</div><span>{summaryFilter === 'today' ? "Today's Wasooli" : summaryFilter === 'weekly' ? "This Week's Wasooli" : summaryFilter === 'monthly' ? "This Month's Wasooli" : "Total Wasooli"} <small>{summaryFilter === 'today' ? 'aaj ki wasooli' : summaryFilter === 'weekly' ? 'is hafte ki wasooli' : summaryFilter === 'monthly' ? 'is mahine ki wasooli' : 'kul wasooli'} · Credit</small></span><strong>{money(filteredSummary.credit)}</strong></div>
        <div className={`summary-card ${balanceState(filteredSummary.net)}`}><div className="summary-icon">＝</div><span>{summaryFilter === 'today' ? "Net Payable Today" : summaryFilter === 'weekly' ? "Net Balance This Week" : summaryFilter === 'monthly' ? "Net Balance This Month" : "Net Balance (All Time)"} <small>{summaryFilter === 'today' ? 'aaj ka baqaya' : summaryFilter === 'weekly' ? 'is hafte ka baqaya' : summaryFilter === 'monthly' ? 'is mahine ka baqaya' : 'kul baqaya'} · Balance</small></span><strong>{money(Math.abs(Number(filteredSummary.net || 0)))}</strong><em>{balanceLabel(filteredSummary.net)}</em></div>
        <div className="summary-card total"><div className="summary-icon">Σ</div><span>{summaryFilter === 'today' ? "Today's Total" : summaryFilter === 'weekly' ? "This Week's Total" : summaryFilter === 'monthly' ? "This Month's Total" : "All Time Total"} <small>{summaryFilter === 'today' ? 'aaj ka kul' : summaryFilter === 'weekly' ? 'is hafte ka kul' : summaryFilter === 'monthly' ? 'is mahine ka kul' : 'kul total'} · Total Activity</small></span><strong>{money(filteredSummary.total)}</strong></div>
        </div>
        <div className="dashboard-grid">
          <aside className="panel customer-panel"><div className="panel-heading"><div><span className="eyebrow">Accounts</span><h2>Customers</h2><span className="muted">{customers.length} accounts</span></div><button className="button-primary small" onClick={() => setModal('customer')}>＋ Add <kbd>F2</kbd></button></div><div className="search-wrap"><span>⌕</span><input ref={searchRef} className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone..." /><kbd>/</kbd></div>{filtered.length ? <VirtualCustomerList customers={filtered} selectedId={selectedId} onSelect={setSelectedId} /> : <p className="empty">No customers found.<br /><small>Try a different search or add an account.</small></p>}</aside>
          <section className="panel ledger-panel">{selected ? <><div className="panel-heading ledger-heading"><div><span className="eyebrow">Account ledger</span><h2>{selected.name}</h2><span className="muted">{selected.phone || 'No phone number'}</span></div><div className="ledger-actions"><button className="button-secondary" onClick={() => setModal('edit')}>Edit</button><button className="button-primary" onClick={() => setModal('transaction')}>＋ Entry</button><button className="button-secondary" onClick={() => print('ledger')}>Print <kbd>F4</kbd></button></div></div>          <div className="ledger-total"><div><span>Current balance</span><small>khata baqaya · Net outstanding</small></div><BalanceBadge value={selected.balance} /></div><div className="filter-bar"><span>Date range</span><div className="date-pills">{filterPills.map(([key, label]) => <button key={key} className={dateFilter === key ? 'active' : ''} onClick={() => setDateFilter(key)}>{label}</button>)}</div></div>{visibleTransactions.length ? <VirtualLedgerTable transactions={visibleTransactions} onEdit={(t) => { setEditingTransaction(t); setModal('transaction'); }} onDelete={deleteTransactionFromLedger} /> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th className="text-right">Udhar<br /><small>Debit</small></th><th className="text-right">Wasooli<br /><small>Credit</small></th><th className="text-right">Balance</th><th aria-label="Actions"></th></tr></thead><tbody><tr><td colSpan="6" className="empty">{transactions.length ? 'No entries in this date range.' : 'No transactions yet. Add the first entry.'}</td></tr></tbody></table></div>}</> : <div className="empty large"><div className="empty-icon">◎</div><h2>Select a customer</h2><p>Choose an account to view its ledger.</p></div>}</section>
        </div>
      </main>}
      {view === 'settings' && <SettingsView profile={profile} onSave={saveProfile} error={error} masterUnlocked={masterUnlocked} success={success} />}
      {view === 'customer-details' && <CustomerDetailsView customers={customers} selectedId={selectedId} onSelect={setSelectedId} onAdd={() => setModal('customer')} onEdit={(customer) => { setSelectedId(customer.id); setModal('edit'); }} onDelete={deleteCustomer} onPhotoClick={setPreviewPhoto} totals={customerTotals} />}
      {view === 'global-history' && <GlobalHistoryView transactions={allTransactions} customers={customers} onDelete={deleteTransaction} onBulkDelete={requestBulkDelete} />}
      {view === 'recycle-bin' && <RecycleBinView items={recycleBinItems} onRestore={restoreRecycleItem} onPermanentDelete={permanentDeleteRecycleItem} onEmptyBin={emptyRecycleBin} />}
      </div>
    </div>
    <A4LedgerPrint customer={selected} transactions={transactions} profile={profile} active={printMode === 'ledger'} />
    <A4CustomersPrint rows={customerPrintRows} profile={profile} periodLabel={customerPrintPeriod} active={printMode === 'customers'} />
    {printMode === 'roznamcha' && <section className="print-only a4-page"><header className="print-header"><h1>Kashmir Commission Shop #44</h1><p>Today's Roznamcha · aaj ka roznamcha</p></header><div className="print-meta"><strong>Date: {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong><span>Total Entries: {roznamcha.length}</span></div><div className="report-summary print-summary"><div><span>Total Udhar</span><b>{money(summary.total_debit)}</b></div><div><span>Total Wasooli</span><b>{money(summary.total_credit)}</b></div><div><span>Net Today</span><b>{money(Math.abs(summary.net_balance))}</b></div></div><table><thead><tr><th>Time</th><th>Customer</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead><tbody>{roznamcha.map((t) => <tr key={t.id}><td>{timeLabel(t.date)}</td><td>{t.customer_name}</td><td>{t.description || '—'}</td><td>{t.type === 'DEBIT' ? 'Udhar / Debit' : 'Wasooli / Credit'}</td><td>{money(t.amount)}</td></tr>)}</tbody></table></section>}
    {modal === 'customer' && <CustomerModal onClose={() => setModal(null)} onSave={saveCustomer} />}
    {modal === 'edit' && <CustomerModal customer={selected} onClose={() => setModal(null)} onSave={saveCustomer} />}
    {previewPhoto && <PhotoPreview photo={previewPhoto.photo} name={previewPhoto.name} onClose={() => setPreviewPhoto(null)} />}
    {modal === 'transaction' && <TransactionModal customers={customers} selectedId={selectedId} transaction={editingTransaction} onClose={() => { setModal(null); setEditingTransaction(null); }} onSave={saveTransaction} />}
    {modal === 'roznamcha' && <RoznamchaReport transactions={roznamcha} summary={summary} onClose={() => setModal(null)} onPrint={() => print('roznamcha')} />}
    {confirmAction && <ConfirmModal title={confirmAction.title} message={confirmAction.message} bulk={confirmAction.bulk} buttonLabel={confirmAction.buttonLabel} onClose={() => setConfirmAction(null)} onConfirm={async () => { try { await confirmAction.execute(); setConfirmAction(null); } catch (e) { setError(e.message); setConfirmAction(null); } }} />}
  </div>;
}
