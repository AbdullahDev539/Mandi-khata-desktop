const fs = require('fs');
let c = fs.readFileSync('G:/MandiSoftware/src/App.jsx', 'utf8');

// === 1. GlobalHistoryView - Add virtual scroll ===
const ghvStart = c.indexOf('function GlobalHistoryView');
const ghvEnd = c.indexOf('\n\nfunction RecycleBinView', ghvStart);
let ghv = c.substring(ghvStart, ghvEnd);

// Add useRef and useVirtualizer imports (already imported at top)
// Add scrollRef and virtualizer inside GlobalHistoryView
ghv = ghv.replace(
  "const [selectedIds, setSelectedIds] = useState([]);",
  "const [selectedIds, setSelectedIds] = useState([]);\n  const historyScrollRef = useRef(null);\n  const ROW_HEIGHT = 48;\n  const historyVirtualizer = useVirtualizer({ count: filtered.length, getScrollElement: () => historyScrollRef.current, estimateSize: () => ROW_HEIGHT, overscan: 5 });"
);

// Replace the virtual-scroll-container div with virtualized version
const oldHistoryGrid = /<div className="virtual-scroll-container">.*?<\/div><\/section>\s*<\/div>;\s*}/s;
const newHistoryGrid = `<div className="virtual-scroll-container history-scroll" ref={historyScrollRef} onScroll={(e) => { const el = e.currentTarget; el.classList.toggle('has-hscroll', el.scrollWidth > el.clientWidth); el.classList.toggle('has-vscroll', el.scrollHeight > el.clientHeight); }}><div className="history-table-header"><div className="history-header-cell"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select visible transactions" /></div><div className="history-header-cell">Date & time<small>taareekh</small></div><div className="history-header-cell">Customer<small>grahak</small></div><div className="history-header-cell">Phone<small>number</small></div><div className="history-header-cell">Udhar<small>Debit</small></div><div className="history-header-cell">Wasooli<small>Credit</small></div><div className="history-header-cell">Balance<small>baqaya</small></div><div className="history-header-cell">Kul Total<small>raakam</small></div><div className="history-header-cell">Notes<small>tafseelat</small></div></div><div style={{ height: \`\${historyVirtualizer.getTotalSize()}px\`, width: '100%', position: 'relative' }}>{historyVirtualizer.getVirtualItems().map((virtualRow) => { const transaction = filtered[virtualRow.index]; return <div key={transaction.id} className={\`history-row \${selectedIds.includes(transaction.id) ? 'row-selected' : ''}\`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: \`\${virtualRow.size}px\`, transform: \`translateY(\${virtualRow.start}px)\` }}><div className="history-cell"><input type="checkbox" checked={selectedIds.includes(transaction.id)} onChange={() => toggle(transaction.id)} aria-label={\`Select transaction \${transaction.id}\`} /></div><div className="history-cell"><strong>{dateLabel(transaction.date)}</strong><small>{timeLabel(transaction.date)}</small></div><div className="history-cell"><strong>{transaction.customer_name}</strong></div><div className="history-cell"><small>{transaction.customer_phone || '\\u2014'}</small></div><div className="history-cell debit-text">{transaction.type === 'DEBIT' ? money(transaction.amount) : '\\u2014'}</div><div className="history-cell credit-text">{transaction.type === 'CREDIT' ? money(transaction.amount) : '\\u2014'}</div><div className={\`history-cell balance-cell \${balanceState(transaction.running_balance)}\`}><strong>{money(Math.abs(transaction.running_balance))}</strong><small>{balanceLabel(transaction.running_balance)}</small></div><div className="history-cell amount-cell">{money(Number(transaction.amount))}</div><div className="history-cell notes-cell">{transaction.description || '\\u2014'}</div></div>; })}</div>{!filtered.length && <div className="history-cell" style={{gridColumn: '1 / -1', textAlign: 'center', padding: 40}}>No transactions match your filters.</div>}<div className="ledger-scroll-indicator-x" aria-hidden="true"></div><div className="ledger-scroll-indicator-y" aria-hidden="true"></div></div></section></div>;}`;

ghv = ghv.replace(oldHistoryGrid, newHistoryGrid);
c = c.substring(0, ghvStart) + ghv + c.substring(ghvEnd);

fs.writeFileSync('G:/MandiSoftware/src/App.jsx', c, 'utf8');
console.log('GlobalHistoryView updated with virtual scroll');
