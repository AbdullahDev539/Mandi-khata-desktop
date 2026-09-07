import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  addCustomer: (customer) => ipcRenderer.invoke('add-customer', customer),
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  updateCustomer: (customer) => ipcRenderer.invoke('update-customer', customer),
  deleteCustomer: (customerId) => ipcRenderer.invoke('delete-customer', customerId),
  getCustomerTransactions: (customerId) => ipcRenderer.invoke('get-customer-transactions', customerId),
  addTransaction: (transaction) => ipcRenderer.invoke('add-transaction', transaction),
  updateTransaction: (transaction) => ipcRenderer.invoke('update-transaction', transaction),
  deleteTransaction: (transactionId) => ipcRenderer.invoke('delete-transaction', transactionId),
  getAllTransactions: () => ipcRenderer.invoke('get-all-transactions'),
  deleteTransactionsBulk: (filters) => ipcRenderer.invoke('delete-transactions-bulk', filters),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  verifyPin: (pin) => ipcRenderer.invoke('verify-pin', pin),
  getDailySummary: () => ipcRenderer.invoke('get-daily-summary'),
  getSummary: (period) => ipcRenderer.invoke('get-summary', period),
  getCustomerTotals: () => ipcRenderer.invoke('get-customer-totals'),
  getTodayTransactions: () => ipcRenderer.invoke('get-today-transactions'),
  printWindow: () => ipcRenderer.invoke('print-window'),
  getDeletedItems: () => ipcRenderer.invoke('get-deleted-items'),
  getDeletedCount: () => ipcRenderer.invoke('get-deleted-count'),
  restoreItem: (data) => ipcRenderer.invoke('restore-item', data),
  permanentDelete: (data) => ipcRenderer.invoke('permanent-delete', data),
  emptyRecycleBin: () => ipcRenderer.invoke('empty-recycle-bin')
});