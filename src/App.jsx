import React, { useState, useEffect, useRef, useMemo } from 'react';
import Login from './components/Login';
import AdminUsers from './components/AdminUsers';
import DataSync from './components/DataSync';
import Dashboard from './components/Dashboard';
import GlobalSearch from './components/GlobalSearch';
import RowDetailsModal from './components/RowDetailsModal';
import RowEditModal from './components/RowEditModal';
import { COLUMN_LABELS } from './components/DataTable';
import ClientRegistration from './components/ClientRegistration';
import ErpOptica from './components/ErpOptica';
import OSManagement from './components/OSManagement';
import POSRegister from './components/POSRegister';
import LoadingScreen from './components/LoadingScreen';
import { Eye, Upload, Download, RefreshCw, Users, AlertTriangle, Package, UserCog, ClipboardList, LogOut, ShoppingCart, Menu, Wifi, WifiOff, KeyRound, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import FirebaseSetupScreen from './components/FirebaseSetupScreen';
import NavigationDrawer from './components/NavigationDrawer';
import ChangePasswordModal from './components/ChangePasswordModal';
import { isConfigured, db } from './firebase';
import { 
  subscribeToCollections, 
  saveDocument, 
  deleteDocument, 
  hashPassword, 
  isPasswordHashed,
  getOfflineQueue,
  processOfflineQueue,
  saveOfflineSnapshot,
  loadOfflineSnapshot,
  syncUserPasswordToFirestore,
  OFFLINE_QUEUE_KEY,
  saveBatch,
  areUserListsEqual,
  reconcileUsers,
  sanitizeStephanieMusetiData,
  isStephanieMuseti
} from './firebaseSync';

const parseSafeCurrency = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

// Hash seguro PBKDF2 padrão para primeiro acesso da conta master
const DEFAULT_MASTER_HASH = "pbkdf2:b3bb279090a24beecaa987cfde1224a1:b473c3a43b120e5f624792b560dff6edc6b56d1865a8fb3d9a0433d7ab13804a";

function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlinePendingCount, setOfflinePendingCount] = useState(() => getOfflineQueue().length);
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const [data, setData] = useState(() => {
    let initial = {
      'CLIENTES_CADASTRADOS': [],
      'Registro_Vendas': [],
      'CAD_LENTES': [],
      'CAD_ARMACOES': [],
      'CAD_BRINDES': [],
      'CONTAS_PAGAR': [],
      'CONTAS_RECEBER': [],
      'FLUXO_CAIXA': JSON.parse(localStorage.getItem('YASMIN_FLUXO_CAIXA') || '[]')
    };
    try {
      const backup = loadOfflineSnapshot();
      if (backup && typeof backup === 'object') {
        initial = {
          'CLIENTES_CADASTRADOS': backup['CLIENTES_CADASTRADOS'] || [],
          'Registro_Vendas': backup['Registro_Vendas'] || [],
          'CAD_LENTES': backup['CAD_LENTES'] || [],
          'CAD_ARMACOES': backup['CAD_ARMACOES'] || [],
          'CAD_BRINDES': backup['CAD_BRINDES'] || [],
          'CONTAS_PAGAR': backup['CONTAS_PAGAR'] || [],
          'CONTAS_RECEBER': backup['CONTAS_RECEBER'] || [],
          'FLUXO_CAIXA': backup['FLUXO_CAIXA'] || JSON.parse(localStorage.getItem('YASMIN_FLUXO_CAIXA') || '[]')
        };
      }
    } catch {}
    const { nextData } = sanitizeStephanieMusetiData(initial);
    return nextData;
  });
  const [view, setView] = useState('login'); // login, loading, dashboard, syncing, clients, erp, admin
  const [currentUser, setCurrentUser] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [users, setUsers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('users'));
      if (Array.isArray(saved) && saved.length > 0) {
        if (!saved.some(u => u.username === 'wmusete')) {
          return [{ username: 'wmusete', password: DEFAULT_MASTER_HASH, role: 'administrativo', authorized: true }, ...saved];
        }
        return saved;
      }
    } catch (e) {}
    return [{ username: 'wmusete', password: DEFAULT_MASTER_HASH, role: 'administrativo', authorized: true }];
  });

  // 🛡️ Monitoramento de Conectividade em Tempo Real & Auto-Sincronização Offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleSyncStatus = (e) => {
      if (e?.detail) {
        setOfflinePendingCount(e.detail.pendingCount || 0);
      }
    };
    const handleSyncFinished = () => {
      setShowSyncSuccessToast(true);
      setTimeout(() => setShowSyncSuccessToast(false), 5000);
    };
    const handleStorageChange = (e) => {
      if (!e || e.key === OFFLINE_QUEUE_KEY || e.key === null) {
        const count = getOfflineQueue().length;
        setOfflinePendingCount(count);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('yasmin-sync-status', handleSyncStatus);
    window.addEventListener('yasmin-sync-finished', handleSyncFinished);
    window.addEventListener('storage', handleStorageChange);

    // Limpeza de emergência preventiva para desocupar a cota de 5MB do localStorage
    try {
      const backupRaw = localStorage.getItem('YASMIN_OFFLINE_DATA_BACKUP');
      if (backupRaw && backupRaw.length > 1500000) {
        localStorage.removeItem('YASMIN_OFFLINE_DATA_BACKUP');
      }
    } catch {}

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      processOfflineQueue();
    }

    // Auto-tentativa periódica a cada 60s se houver itens pendentes na fila de contingência
    const autoSyncInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && getOfflineQueue().length > 0) {
        processOfflineQueue();
      }
    }, 60000);

    return () => {
      clearInterval(autoSyncInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('yasmin-sync-status', handleSyncStatus);
      window.removeEventListener('yasmin-sync-finished', handleSyncFinished);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Salva backup local seguro no localStorage para garantia de contingência total (com debounce)
  useEffect(() => {
    if (!data || !Object.keys(data).some(k => Array.isArray(data[k]) && data[k].length > 0)) return;
    const timer = setTimeout(() => {
      saveOfflineSnapshot(data);
    }, 2500);
    return () => clearTimeout(timer);
  }, [data]);

  // Migração transparente de senhas legadas em texto plano para Hash Criptográfico PBKDF2
  useEffect(() => {
    let isMounted = true;
    const upgradePasswords = async () => {
      let needsUpdate = false;
      const updatedList = await Promise.all(users.map(async (u) => {
        if (!isPasswordHashed(u.password)) {
          needsUpdate = true;
          const hashed = await hashPassword(u.password);
          return { ...u, password: hashed };
        }
        return u;
      }));
      if (needsUpdate && isMounted) {
        setUsers(updatedList);
      }
    };
    upgradePasswords();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('users', JSON.stringify(users));
    } catch (e) {}
  }, [users]);

  useEffect(() => {
    if (data['FLUXO_CAIXA'] && data['FLUXO_CAIXA'].length > 0) {
      localStorage.setItem('YASMIN_FLUXO_CAIXA', JSON.stringify(data['FLUXO_CAIXA']));
    }
  }, [data['FLUXO_CAIXA']]);

  // Sanitização e Remoção de Duplicidades em CONTAS_RECEBER (Lançamentos de Saldo Único que duplicam Parcelas de Boleto)
  useEffect(() => {
    const receberList = data?.['CONTAS_RECEBER'];
    if (!receberList || !Array.isArray(receberList) || receberList.length === 0) return;

    let hasChange = false;
    const toDeleteIds = [];

    // Agrupa por cliente para identificar duplicidades
    const byClient = {};
    receberList.forEach(r => {
      const client = String(r['CLIENTE'] || r['NOME CLIENTE'] || r['NOME'] || '').trim().toUpperCase();
      if (!client) return;
      if (!byClient[client]) byClient[client] = [];
      byClient[client].push(r);
    });

    const resultList = [];

    const normalizeReceberRow = (row) => {
      if (!row) return row;
      const copy = { ...row };
      if (/boleto|carnê|carne/i.test(copy.MEIO_PAGAMENTO || copy.meio_pagamento || '')) {
        copy.MEIO_PAGAMENTO = 'Boleto';
        if (copy.meio_pagamento) copy.meio_pagamento = 'Boleto';
      }
      if (copy.DOCUMENTO && /carnê|carne/i.test(copy.DOCUMENTO)) {
        copy.DOCUMENTO = copy.DOCUMENTO
          .replace(/(?<!\p{L})BOLETO\s*(?:DA\s*LOJA\s*)?(?:\/|\s+)?\s*CARN[EÊ]s?(?!\p{L})/gui, 'BOLETO')
          .replace(/(?<!\p{L})CARN[EÊ]s?\s*(?:\/|\s+)?\s*BOLETO(?!\p{L})/gui, 'BOLETO')
          .replace(/(?<!\p{L})CARN[EÊ]s?(?!\p{L})/gui, 'BOLETO');
      }
      return copy;
    };

    Object.entries(byClient).forEach(([client, rows]) => {
      // Identifica se há parcelas de boleto (ex: BOLETO 1/12, etc.)
      const installmentRows = rows.filter(r => {
        const doc = String(r.DOCUMENTO || r.documento || '').toUpperCase();
        const desc = String(r.DESCRICAO || r.descricao || '').toUpperCase();
        return doc.includes('BOLETO') || doc.includes('CARNÊ') || doc.includes('PARCELA') || /\d+\/\d+/.test(doc) || /\d+\/\d+/.test(desc);
      });

      if (installmentRows.length > 1) {
        // Calcula soma das parcelas
        const installmentsSum = installmentRows.reduce((acc, r) => acc + parseSafeCurrency(r.VALOR || r.valor || 0), 0);

        rows.forEach(r => {
          const isInst = installmentRows.includes(r);
          const rVal = parseSafeCurrency(r.VALOR || r.valor || 0);
          const isDuplicateLumpSum = !isInst && 
            Math.abs(rVal - installmentsSum) < 2.0 && 
            (String(r.DOCUMENTO || '').toUpperCase().includes('SALDO') || String(r.DESCRICAO || '').toUpperCase().includes('VENDA OS') || String(r.MEIO_PAGAMENTO || '').toUpperCase().includes('BOLETO'));

          if (isDuplicateLumpSum) {
            hasChange = true;
            if (r.id) toDeleteIds.push(r.id);
          } else {
            // Normaliza as parcelas para que a tabela exiba perfeitamente
            if (isInst) {
              const enriched = normalizeReceberRow(r);
              if (!enriched.MEIO_PAGAMENTO && !enriched.meio_pagamento) {
                enriched.MEIO_PAGAMENTO = 'Boleto';
                enriched.meio_pagamento = 'Boleto';
              }
              if (!enriched.DATA_VENCIMENTO && enriched['DATA VENCIMENTO']) {
                enriched.DATA_VENCIMENTO = enriched['DATA VENCIMENTO'];
              }
              if (!enriched['DATA VENCIMENTO'] && enriched.DATA_VENCIMENTO) {
                enriched['DATA VENCIMENTO'] = enriched.DATA_VENCIMENTO;
              }
              if (!enriched.DESCRICAO && enriched.DOCUMENTO) {
                enriched.DESCRICAO = enriched.DOCUMENTO;
                enriched.descricao = enriched.DOCUMENTO;
              }
              resultList.push(enriched);
            } else {
              resultList.push(normalizeReceberRow(r));
            }
          }
        });
      } else {
        rows.forEach(r => resultList.push(normalizeReceberRow(r)));
      }
    });

    if (hasChange) {
      setData(prev => ({
        ...prev,
        'CONTAS_RECEBER': resultList
      }));

      if (isConfigured && toDeleteIds.length > 0) {
        toDeleteIds.forEach(id => {
          deleteDocument('CONTAS_RECEBER', id).catch(() => {});
        });
      }
    }
  }, [data['CONTAS_RECEBER'], isConfigured]);

  const [selectedRow, setSelectedRow] = useState(null);
  const [editingRowData, setEditingRowData] = useState(null);
  const [addingRowData, setAddingRowData] = useState(null); // { sheetName, row }
  const [clientInitialTab, setClientInitialTab] = useState('todos');
  const fileInputRef = useRef(null);

  // Utilitário: verifica se uma linha possui dados reais e significativos
  const isMeaningfulRow = (row) => {
    if (!row || typeof row !== 'object') return false;
    return Object.entries(row).some(([k, v]) => {
      if (v === null || v === undefined || v === '') return false;
      const s = String(v).trim();
      return s !== '' && s !== '—' && s !== '-' && s !== '#N/A' && s !== 'Sem Registro na Base Antiga';
    });
  };

  // Utilitário: parseia uma aba detectando a linha de cabeçalho real
  const parseSheet = (ws) => {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!raw || raw.length === 0) return [];

    let headerIdx = 0;
    let maxNonEmpty = 0;
    for (let i = 0; i < Math.min(raw.length, 15); i++) {
      const count = raw[i].filter(c => c !== '' && c !== null && c !== undefined && String(c).trim() !== '').length;
      if (count > maxNonEmpty) {
        maxNonEmpty = count;
        headerIdx = i;
      }
    }

    const headers = raw[headerIdx].map((h, i) => (h !== '' && h !== null && h !== undefined ? String(h).trim() : `COL_${i}`));
    const dataRows = raw.slice(headerIdx + 1);

    return dataRows
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
        return obj;
      })
      .filter(isMeaningfulRow);
  };

  // Utilitário para gerar chave única do item (para garantir exclusão permanente e não recarregar)
  const getItemKey = (row) => {
    if (!row || typeof row !== 'object') return '';
    if (row.id) return `id:${row.id}`;
    if (row._id) return `id:${row._id}`;
    if (row.DOCUMENTO) return `doc:${row.DOCUMENTO}_${row.VALOR || ''}_${row.DATA_VENCIMENTO || row['DATA VENCIMENTO'] || ''}`;
    const name = String(row['Nome Completo'] || row['NOME'] || row['NOME DO CLIENTE'] || row['CLIENTE'] || '').trim().toLowerCase();
    const cpf = String(row['CPF / CNPJ'] || row['CPF'] || '').replace(/\D/g, '');
    const os = String(row['OS'] || row['OS DA VENDA'] || row['OS da COMPRA'] || row['VENDA_OS'] || '').trim();
    const tel = String(row['WhatsApp'] || row['TELEFONE'] || row['TELEFONE CLIENTE'] || '').replace(/\D/g, '');
    const sku = String(row['REFERENCIA_SKU'] || row['referencia_sku'] || '').trim();

    if (cpf && cpf.length >= 7) return `cpf:${cpf}`;
    if (os) return `os:${os}`;
    if (sku) return `sku:${sku}`;
    if (name && tel) return `name_tel:${name}_${tel}`;
    if (name) return `name:${name}`;
    try {
      return JSON.stringify(row);
    } catch {
      return '';
    }
  };

  const getDeletedKeys = () => {
    try {
      return JSON.parse(localStorage.getItem('YASMIN_DELETED_KEYS') || '[]');
    } catch {
      return [];
    }
  };

  const addDeletedKey = (key) => {
    if (!key) return;
    const current = getDeletedKeys();
    if (!current.includes(key)) {
      const updated = [...current, key];
      localStorage.setItem('YASMIN_DELETED_KEYS', JSON.stringify(updated));
    }
  };

  // 🛡️ Watchdog de segurança máxima: garante que a tela de splash inicial NUNCA fique presa por mais de 2.0s
  useEffect(() => {
    const watchdogTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000);
    return () => clearTimeout(watchdogTimer);
  }, []);

  // Carrega automaticamente a planilha base com os dados históricos somente após autenticação bem-sucedida
  useEffect(() => {
    if (!currentUser) {
      setIsInitialLoading(false);
      return;
    }

    let isMounted = true;
    const autoLoad = async () => {
      const controller = new AbortController();
      const abortTimeout = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(encodeURI('/YASMIN ÓTICA.Sheets.xlsx?v=' + Date.now()), { signal: controller.signal });
        clearTimeout(abortTimeout);
        if (!res.ok) {
          if (isMounted) setIsInitialLoading(false);
          return;
        }
        const arrayBuffer = await res.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const sheets = {};
        const deletedKeys = getDeletedKeys();
        const financialCleared = localStorage.getItem('YASMIN_FINANCIAL_AND_OS_CLEARED') === 'true';
        wb.SheetNames.forEach(name => {
          // Se o financeiro e OS foram zerados para produção, não recarrega vendas e contas antigas da planilha base
          if (financialCleared && ['Registro_Vendas', 'BD MARKETING', 'Controle_Parcelas', 'RELATÓRIO PARCELAS', 'CONTAS_PAGAR', 'CONTAS_RECEBER', 'FLUXO_CAIXA'].includes(name)) {
            return;
          }
          const rows = parseSheet(wb.Sheets[name]);
          const cleanRows = rows.filter(r => !deletedKeys.includes(getItemKey(r)));
          if (cleanRows.length > 0) sheets[name] = cleanRows;
        });
        if (isMounted) {
          setData(prev => {
            const merged = { ...sheets, ...prev };
            const { nextData, modified, deletedKeys: sDelKeys } = sanitizeStephanieMusetiData(merged, getItemKey);
            if (modified && sDelKeys && sDelKeys.length > 0) {
              sDelKeys.forEach(k => addDeletedKey(k));
            }
            return nextData;
          });
        }
      } catch (err) {
        clearTimeout(abortTimeout);
        console.warn('Aviso: Planilha base não carregada ou timeout atingido, usando apenas banco na nuvem.', err);
      } finally {
        setTimeout(() => {
          if (isMounted) setIsInitialLoading(false);
        }, 500);
      }
    };
    autoLoad();
    return () => { isMounted = false; };
  }, [currentUser?.username]);

  // Carrega automaticamente do Firebase ao iniciar e escuta atualizações ao vivo somente após login
  useEffect(() => {
    if (!isConfigured || !currentUser) return;

    const unsubscribe = subscribeToCollections((newData, changedCol) => {
      // Coleta chaves deletadas do Firestore se houver
      if (newData['DELETED_ITEMS'] && newData['DELETED_ITEMS'].length > 0) {
        newData['DELETED_ITEMS'].forEach(d => {
          if (d.key) addDeletedKey(d.key);
        });
      }

      const deletedKeys = getDeletedKeys();
      const financialCleared = localStorage.getItem('YASMIN_FINANCIAL_AND_OS_CLEARED') === 'true';

      // Quando o firebase retorna dados, atualizamos o state central sincronizado
      setData(prev => {
        const merged = { ...prev };
        const keysToUpdate = changedCol ? [changedCol] : Object.keys(newData);
        keysToUpdate.forEach(key => {
          if (key === 'DELETED_ITEMS' || key === 'USUARIOS') return;
          // Coleções sincronizadas do Firebase sobrescrevem o estado local
          const list = (newData[key] || []).filter(r => !deletedKeys.includes(getItemKey(r)));
          merged[key] = list;
        });

        if (financialCleared) {
          if (!merged['Registro_Vendas']) merged['Registro_Vendas'] = [];
          if (!merged['CONTAS_RECEBER']) merged['CONTAS_RECEBER'] = [];
          if (!merged['CONTAS_PAGAR']) merged['CONTAS_PAGAR'] = [];
          if (!merged['FLUXO_CAIXA']) merged['FLUXO_CAIXA'] = [];
          merged['BD MARKETING'] = [];
        }

        // 🛡️ Higienização atômica e automática para Stephanie Museti
        const { nextData, modified, deletedKeys: sDelKeys, deletedItems } = sanitizeStephanieMusetiData(merged, getItemKey);
        if (modified) {
          if (sDelKeys && sDelKeys.length > 0) {
            sDelKeys.forEach(k => addDeletedKey(k));
          }
          if (isConfigured) {
            if (deletedItems && deletedItems.length > 0) {
              deletedItems.forEach(({ sheet, id }) => {
                if (id) deleteDocument(sheet, id).catch(() => {});
              });
            }
            if (Array.isArray(nextData['CLIENTES_CADASTRADOS'])) {
              const stephanieClient = nextData['CLIENTES_CADASTRADOS'].find(c => isStephanieMuseti(c));
              if (stephanieClient && stephanieClient.id) {
                saveDocument('CLIENTES_CADASTRADOS', stephanieClient).catch(err => {
                  console.warn('Aviso ao sincronizar cliente higienizada com Firestore:', err);
                });
              }
            }
          }
        }

        return nextData;
      });
      
      // Update users somente quando a coleção USUARIOS sofreu atualização (previne churn e consumo elevado a cada venda/movimento)
      if (!changedCol || changedCol === 'USUARIOS') {
        const remoteUsers = newData['USUARIOS'];
        if (Array.isArray(remoteUsers)) {
          setUsers(prevUsers => {
            const reconciled = reconcileUsers(remoteUsers, prevUsers, getOfflineQueue());
            if (areUserListsEqual(prevUsers, reconciled)) {
              return prevUsers;
            }
            try {
              localStorage.setItem('users', JSON.stringify(reconciled));
            } catch (storageErr) {
              console.warn('Aviso ao atualizar users no localStorage:', storageErr);
            }
            return reconciled;
          });
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.username]);

  const handleUpdateUserPassword = async (username, newHash) => {
    const cleanUser = String(username).toLowerCase().trim();
    const existing = (users || []).find(u => u.username?.toLowerCase().trim() === cleanUser);
    const targetUser = existing || {
      username: cleanUser,
      role: currentUser?.role || 'vendedor',
      city: currentUser?.city || currentUser?.assignedStore || '',
      authorized: true
    };
    const effectiveCity = targetUser.city || targetUser.assignedStore || currentUser?.city || currentUser?.assignedStore || '';

    // 1. Grava e sincroniza diretamente no Firestore (Banco de Dados em Nuvem) com timeout e fallback offline
    let syncResult = null;
    try {
      syncResult = await syncUserPasswordToFirestore(cleanUser, newHash, {
        ...targetUser,
        city: effectiveCity,
        assignedStore: effectiveCity
      });
    } catch (e) {
      console.warn('Aviso ao sincronizar senha com Firestore:', e);
      syncResult = { success: true, savedInCloud: false };
    }

    const nowIso = syncResult?.userDoc?.updatedAt || new Date().toISOString();

    // 2. Atualiza estado e cache local com o mesmo timestamp exato
    setUsers(prev => {
      const updated = prev.map(u => {
        if (u.username?.toLowerCase().trim() === cleanUser) {
          return { ...u, username: cleanUser, password: newHash, city: effectiveCity, assignedStore: effectiveCity, updatedAt: nowIso };
        }
        return u;
      });
      if (!updated.some(u => u.username?.toLowerCase().trim() === cleanUser)) {
        updated.push({ ...targetUser, username: cleanUser, password: newHash, city: effectiveCity, assignedStore: effectiveCity, updatedAt: nowIso });
      }
      try {
        localStorage.setItem('users', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (currentUser && currentUser.username?.toLowerCase().trim() === cleanUser) {
      setCurrentUser(prev => ({ ...prev, password: newHash, city: effectiveCity, assignedStore: effectiveCity }));
    }

    return syncResult;
  };

  const handleDataLoaded = (loadedData) => {
    // Legacy support para importar arquivo se precisar (opcional)
    setView('syncing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSyncComplete = (syncedData) => {
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setData({
      'CLIENTES_CADASTRADOS': [],
      'Registro_Vendas': [],
      'CAD_LENTES': [],
      'CAD_ARMACOES': [],
      'CAD_BRINDES': [],
      'CONTAS_PAGAR': [],
      'CONTAS_RECEBER': [],
      'FLUXO_CAIXA': []
    });
    setIsDrawerOpen(false);
    setView('login');
  };

  const handleRowUpdate = async (sheetName, oldRow, newRow) => {
    const rowId = oldRow?.id || newRow?.id || oldRow?.['id'] || newRow?.['id'];
    const mergedNewRow = {
      ...newRow,
      id: rowId || `row_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };
    const oldKey = getItemKey(oldRow);

    setData(prev => {
      if (!prev || !prev[sheetName]) return prev;
      return {
        ...prev,
        [sheetName]: prev[sheetName].map(r => {
          const isMatch = r === oldRow ||
            (rowId && (r?.id === rowId || r?.['_id'] === rowId)) ||
            (oldKey && getItemKey(r) === oldKey);
          return isMatch ? mergedNewRow : r;
        })
      };
    });

    if (isConfigured) {
      try {
        await saveDocument(sheetName, mergedNewRow, rowId);
      } catch (err) {
        console.error("Erro ao salvar no banco de dados (Firebase):", err);
      }
    }
  };

  const handleAddRow = async (sheetName, newRow) => {
    const rowWithId = {
      ...newRow,
      id: newRow.id || `row_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };

    // 1. Atualização Imediata em Memória Local (Zero Delay / Reativo)
    setData(prev => ({
      ...prev,
      [sheetName]: [...(prev[sheetName] || []), rowWithId]
    }));

    // 2. Persistência na Nuvem (Firebase)
    if (isConfigured) {
      try {
        await saveDocument(sheetName, rowWithId, rowWithId.id);
      } catch (err) {
        console.warn("Aviso ao salvar no Firestore (mantido localmente):", err);
      }
    }
  };

  const handleAddBatch = async (sheetName, newRows = []) => {
    if (!Array.isArray(newRows) || newRows.length === 0) return;
    const rowsWithId = newRows.map((r, idx) => ({
      ...r,
      id: r.id || `row_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`
    }));

    // 1. Atualização Imediata em Memória Local (Zero Delay / Reativo)
    setData(prev => ({
      ...prev,
      [sheetName]: [...(prev[sheetName] || []), ...rowsWithId]
    }));

    // 2. Persistência em Lote na Nuvem (Firebase)
    if (isConfigured) {
      try {
        await saveBatch(rowsWithId.map(r => ({
          collectionName: sheetName,
          dataObj: r,
          customId: r.id
        })));
      } catch (err) {
        console.warn("Aviso ao salvar lote no Firestore (mantido localmente):", err);
      }
    }
  };

  const handleDeleteRow = async (sheetName, rowToDelete) => {
    if (!rowToDelete) return;
    const delKey = getItemKey(rowToDelete);
    addDeletedKey(delKey);

    // 1. Atualiza imediatamente o estado local em memória
    setData(prev => {
      if (!prev || !prev[sheetName]) return prev;
      return {
        ...prev,
        [sheetName]: prev[sheetName].filter(r => {
          if (r === rowToDelete) return false;
          if (rowToDelete.id && r.id && r.id === rowToDelete.id) return false;
          const rKey = getItemKey(r);
          return rKey !== delKey;
        })
      };
    });

    // 2. Se o Firebase estiver configurado, remove o documento e registra exclusão permanente
    if (isConfigured) {
      if (rowToDelete.id) {
        try {
          await deleteDocument(sheetName, rowToDelete.id);
        } catch (err) {
          console.warn("Erro ao deletar no Firestore:", err);
        }
      }
      try {
        await saveDocument('DELETED_ITEMS', {
          key: delKey,
          sheetName,
          rowSummary: rowToDelete['Nome Completo'] || rowToDelete['NOME'] || rowToDelete['OS'] || '',
          deletedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Erro ao registrar exclusão no Firestore:", err);
      }
    }
  };

  const handleDownload = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    Object.keys(data).forEach(sheetName => {
      const ws = XLSX.utils.json_to_sheet(data[sheetName]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    XLSX.writeFile(wb, "YASMIN_OTICA_ATUALIZADO.xlsx");
  };

  const handleClearFinancialAndOSHistory = async () => {
    const confirmation = window.prompt(
      "⚠️ ZERAR TODO O FINANCEIRO E BASE DE OS:\n\n" +
      "Isso irá apagar permanentemente:\n" +
      "• Todas as Ordens de Serviço (OS) e Vendas registradas\n" +
      "• Todas as Contas a Receber (boletos, mensalidades)\n" +
      "• Todas as Contas a Pagar\n" +
      "• Todo o Fluxo de Caixa (fechamentos, sangrias, suprimentos)\n" +
      "• Zerará o saldo devedor dos clientes mantendo cadastros e receitas\n\n" +
      "Digite 'RESET' em letras maiúsculas para confirmar:"
    );

    if (confirmation !== "RESET") {
      alert("Ação cancelada pelo usuário.");
      return;
    }

    try {
      setIsInitialLoading(true);

      // 1. Limpar coleções no Firestore
      if (isConfigured && db) {
        const { collection, getDocs, deleteDoc, doc, updateDoc } = await import("firebase/firestore");
        const cols = ["Registro_Vendas", "CONTAS_RECEBER", "CONTAS_PAGAR", "FLUXO_CAIXA"];
        for (const c of cols) {
          const snap = await getDocs(collection(db, c));
          for (const d of snap.docs) {
            await deleteDoc(doc(db, c, d.id));
          }
        }

        // Resetar débitos de clientes
        const clientSnap = await getDocs(collection(db, "CLIENTES_CADASTRADOS"));
        for (const d of clientSnap.docs) {
          const cData = d.data();
          if (cData["Valor Devido"] !== "0,00" || cData["Status de Pagamento"] !== "Em dia") {
            await updateDoc(doc(db, "CLIENTES_CADASTRADOS", d.id), {
              "Valor Devido": "0,00",
              "Status de Pagamento": "Em dia"
            });
          }
        }
      }

      // 2. Atualizar estado local em memória
      setData(prev => {
        const updatedClients = (prev['CLIENTES_CADASTRADOS'] || []).map(c => ({
          ...c,
          'Valor Devido': '0,00',
          'Status de Pagamento': 'Em dia'
        }));

        return {
          ...prev,
          'Registro_Vendas': [],
          'BD MARKETING': [],
          'CONTAS_RECEBER': [],
          'CONTAS_PAGAR': [],
          'FLUXO_CAIXA': [],
          'CLIENTES_CADASTRADOS': updatedClients
        };
      });

      // 3. Limpar chaves locais
      localStorage.setItem('YASMIN_FINANCIAL_AND_OS_CLEARED', 'true');
      localStorage.removeItem('yasmin_cash_registers');
      localStorage.removeItem('yasmin_cash_history');
      localStorage.removeItem('YASMIN_FLUXO_CAIXA');

      alert("✅ Histórico financeiro e base de OS zerados com sucesso! O sistema está pronto e limpo para produção.");
    } catch (err) {
      console.error("Erro ao resetar histórico financeiro:", err);
      alert("Ocorreu um erro ao resetar: " + err.message);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const sanitizedDashboardData = useMemo(() => {
    if (!data) return data;
    const clean = {};
    const sensitive = ['USUARIOS', 'usuarios', 'users', 'Users', 'DELETED_ITEMS', 'senhas', 'passwords', 'credenciais'];
    Object.keys(data).forEach(key => {
      const kLower = key.toLowerCase().trim();
      if (!sensitive.includes(key) && !kLower.includes('usuario') && !kLower.includes('user') && !kLower.includes('senha') && !kLower.includes('pass')) {
        clean[key] = data[key];
      }
    });
    return clean;
  }, [data]);

  useEffect(() => {
    if (view === 'loading' && data) {
      if (currentUser?.role === 'vendedor') {
        setView('pos');
      } else {
        setView('dashboard');
      }
    }
  }, [view, data, currentUser]);

  // ─── TELA DE CARREGAMENTO INICIAL / SPLASH SCREEN ─────────────
  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  // ─── SETUP FIREBASE ────────────────────────────────────────────
  if (!isConfigured) {
    return <FirebaseSetupScreen />;
  }

  // ─── LOGIN ───────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <Login 
        users={users}
        onLogin={(user) => {
          setCurrentUser(user);
          setView(user.role === 'vendedor' ? 'pos' : 'dashboard');
        }}
        onRegister={async (newUser) => {
          const cleanUser = String(newUser.username || '').toLowerCase().trim();
          const userDoc = {
            ...newUser,
            id: cleanUser,
            username: cleanUser,
            updatedAt: newUser.updatedAt || new Date().toISOString()
          };
          setUsers(prev => {
            const next = [...(prev || []).filter(u => u.username?.toLowerCase().trim() !== cleanUser), userDoc];
            try {
              localStorage.setItem('users', JSON.stringify(next));
            } catch (err) {
              console.warn('Erro ao salvar usuário no localStorage:', err);
            }
            return next;
          });
          if (isConfigured) {
            try {
              await saveDocument('USUARIOS', userDoc, cleanUser);
            } catch (err) {
              console.warn('Erro ao persistir novo cadastro no Firestore:', err);
            }
          }
        }}
        onUpgradeUserPassword={handleUpdateUserPassword}
        onUpdateUsers={setUsers}
      />
    );
  }

  // ─── LOADING ───────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-sky-500/20 blur-[60px] rounded-full animate-pulse" />
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="relative z-10 w-20 h-20 border-4 border-sky-500/20 border-t-sky-500 rounded-full flex items-center justify-center">
            <Eye size={28} className="text-sky-400" />
          </motion.div>
        </div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Carregando dados da Yasmin Ótica...</p>
      </div>
    );
  }

  // ─── SYNCING ───────────────────────────────────────────────────
  if (view === 'syncing') {
    return (
      <div className="container min-h-screen pt-20">
        <DataSync rawData={data} onSyncComplete={handleSyncComplete} />
      </div>
    );
  }

  // ─── ADMIN (PROTEGIDO POR RBAC) ──────────────────────────────
  if (view === 'admin') {
    if (!['admin', 'administrativo'].includes(currentUser?.role)) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950">
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-8 rounded-2xl max-w-md shadow-2xl backdrop-blur-xl">
            <AlertTriangle size={40} className="mx-auto mb-4 text-rose-400 animate-pulse" />
            <h2 className="text-base font-black uppercase tracking-wider mb-2 text-white">Acesso Negado (403)</h2>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Você não possui privilégios de administrador para visualizar o gerenciador de usuários e configurações.
            </p>
            <button 
              onClick={() => setView(currentUser?.role === 'vendedor' ? 'pos' : 'dashboard')} 
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-500/25"
            >
              Voltar à Área Autorizada
            </button>
          </div>
        </div>
      );
    }
    return (
      <AdminUsers 
        users={users} 
        setUsers={setUsers} 
        onBack={() => setView('dashboard')}
        data={data}
        onDataLoaded={handleDataLoaded}
        onDownloadExcel={handleDownload}
        onClearFinancialAndOS={handleClearFinancialAndOSHistory}
      />
    );
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Navbar estática no topo com design moderno SaaS e suporte completo a mobile e tablet */}
      <nav className="relative z-40 border-b border-white/10 bg-slate-950/95 shadow-2xl">
        <div className="max-w-[1550px] mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3">
          
          {/* Lado Esquerdo: Botão Hamburguer + Logo + Título + Badge de Loja + Status Conexão */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Botão Hamburguer do Menu Lateral */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all shadow-sm active:scale-95 group shrink-0"
              title="Abrir Menu Lateral (ESC fecha)"
            >
              <Menu size={18} className="text-sky-400 group-hover:rotate-12 transition-transform sm:w-5 sm:h-5" />
              <span className="text-xs font-black uppercase tracking-wider hidden md:inline">Menu</span>
            </button>

            {/* Logo */}
            <div 
              onClick={() => setIsDrawerOpen(true)}
              className="h-8 sm:h-10 md:h-11 px-1.5 sm:px-2.5 md:px-3 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-black/40 border border-white/40 ring-1 ring-white/10 transition-transform hover:scale-105 cursor-pointer shrink-0"
              title="Clique para abrir o Menu"
            >
              <img src="/logo-yasmin.png" alt="Yasmin Ótica" className="h-4 sm:h-6 md:h-7 w-auto object-contain" />
            </div>

            {/* Título do Aplicativo (visível em todos os tamanhos) */}
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-base font-black tracking-tight text-white uppercase truncate">
                  Yasmin <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Ótica</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  v1.6
                </span>
              </div>
              {/* Status Conectado ou Offline */}
              {isOnline ? (
                <span className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-amber-400 uppercase tracking-widest mt-0.5 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-500/30">
                  <WifiOff size={10} className="text-amber-400 animate-pulse" /> Offline
                </span>
              )}
            </div>

            {/* Store Badge (Unidade / Filial) */}
            <div 
              className="flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-white/[0.04] border border-white/10 text-emerald-400 text-[9px] sm:text-xs font-bold uppercase tracking-wider shrink-0"
              title={`Loja: ${currentUser?.city || 'Todas as Lojas'}`}
            >
              <Building size={11} className="text-emerald-400 shrink-0" />
              <span className="truncate max-w-[60px] sm:max-w-[80px] md:max-w-none">{currentUser?.city || 'Todas as Lojas'}</span>
            </div>
          </div>

          {/* Centro: Indicador Visual do Módulo Ativo */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/[0.04] border border-white/5 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Módulo:</span>
            {view === 'pos' && (
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <ShoppingCart size={13} /> Caixa (PDV)
              </span>
            )}
            {view === 'clients' && (
              <span className="text-xs font-black text-fuchsia-400 flex items-center gap-1.5">
                <Users size={13} /> Clientes &amp; Receitas
              </span>
            )}
            {view === 'dashboard' && (
              <span className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                <Eye size={13} /> Dashboard Geral
              </span>
            )}
            {view === 'erp' && (
              <span className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                <Package size={13} /> ERP Ótica &amp; Estoque
              </span>
            )}
            {view === 'os-management' && (
              <span className="text-xs font-black text-pink-400 flex items-center gap-1.5">
                <ClipboardList size={13} /> Gestão de OS
              </span>
            )}
            {view === 'admin' && (
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <UserCog size={13} /> Administração
              </span>
            )}
          </div>

          {/* Lado Direito: Ações Rápidas + Avatar do Usuário + Sair */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-2.5 shrink-0">
            {/* Quick Action: Caixa (PDV) */}
            {view !== 'pos' && (
              <button
                onClick={() => setView('pos')}
                className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-black bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all shadow-sm active:scale-95"
                title="Acessar Caixa (PDV)"
              >
                <ShoppingCart size={14} />
                <span className="hidden lg:inline">Caixa</span>
              </button>
            )}

            {/* Quick Action: Clientes */}
            {view === 'pos' && (
              <button
                onClick={() => {
                  setClientInitialTab('todos');
                  setView('clients');
                }}
                className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-black bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-400 border border-fuchsia-500/30 transition-all shadow-sm active:scale-95"
                title="Acessar Clientes"
              >
                <Users size={14} />
                <span className="hidden lg:inline">Clientes</span>
              </button>
            )}

            {/* Quick Action: Gestão de OS */}
            {view !== 'os-management' && (
              <button
                onClick={() => setView('os-management')}
                className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-black bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/30 transition-all shadow-sm active:scale-95"
                title="Acessar Gestão de Ordens de Serviço"
              >
                <ClipboardList size={14} />
                <span className="hidden lg:inline">Gestão de OS</span>
              </button>
            )}

            {/* Chip do Usuário Logado (abre o menu lateral) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all text-left group shrink-0"
              title="Abrir Menu e Perfil"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-black text-[10px] sm:text-[11px] shadow-sm">
                {String(currentUser?.username || 'U').substring(0, 1).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left pr-1">
                <p className="text-xs font-black text-white leading-tight truncate max-w-[85px] md:max-w-[100px]">
                  {currentUser?.username || 'Usuário'}
                </p>
                <p className="text-[9px] text-slate-400 uppercase font-bold leading-none">
                  {currentUser?.role === 'vendedor' ? 'Vendedor' : 'Admin'}
                </p>
              </div>
            </button>

            {/* Botão Rápido Alterar Minha Senha */}
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="p-1.5 sm:p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-sky-400 border border-white/10 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
              title="Alterar Minha Senha de Acesso"
            >
              <KeyRound size={15} className="sm:w-4 sm:h-4" />
            </button>

            {/* Botão Sair */}
            <button
              onClick={handleLogout}
              className="p-1.5 sm:p-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 hover:border-rose-500 rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
              title="Sair do Sistema"
            >
              <LogOut size={15} className="sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* 📶 BANNER VISUAL DE CONTINGÊNCIA OFFLINE & SINCRONIZAÇÃO EM TEMPO REAL */}
      {!isOnline ? (
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-semibold z-40 animate-in fade-in slide-in-from-top-2 border-b border-amber-500/30">
          <div className="max-w-[1550px] mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-black/25 rounded-lg text-amber-200 flex items-center justify-center shrink-0">
                <WifiOff size={16} />
              </span>
              <div>
                <span className="font-black uppercase tracking-wider text-[10px] bg-black/40 px-2 py-0.5 rounded-full mr-2 text-amber-200 border border-amber-400/20">
                  MODO CONTINGÊNCIA ATIVO
                </span>
                <span className="text-amber-50">
                  Sem internet. O sistema continua operando normalmente (Vendas, Caixa, OS e Clientes)! Todos os dados estão protegidos neste computador.
                </span>
              </div>
            </div>
            {offlinePendingCount > 0 && (
              <span className="font-mono font-bold bg-white text-amber-950 px-2.5 py-1 rounded-full text-[11px] shrink-0 shadow-sm flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                {offlinePendingCount} alteraç{offlinePendingCount > 1 ? 'ões pendentes' : 'ão pendente'} de envio
              </span>
            )}
          </div>
        </div>
      ) : offlinePendingCount > 0 ? (
        <div className="bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-semibold z-40 animate-in fade-in slide-in-from-top-2 border-b border-sky-500/30">
          <div className="max-w-[1550px] mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-black/25 rounded-lg text-sky-200 flex items-center justify-center shrink-0">
                <RefreshCw size={16} className="animate-spin" />
              </span>
              <div>
                <span className="font-black uppercase tracking-wider text-[10px] bg-black/40 px-2 py-0.5 rounded-full mr-2 text-sky-200 border border-sky-400/20">
                  SINCRONIZANDO EM TEMPO REAL
                </span>
                <span className="text-sky-50">
                  Conexão restabelecida! Enviando alterações acumuladas da contingência para o Firestore em nuvem...
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => processOfflineQueue()}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Sincronizar agora"
              >
                <RefreshCw size={12} />
                Sincronizar Agora
              </button>
              <span className="font-mono font-bold bg-white text-sky-950 px-2.5 py-1 rounded-full text-[11px] shrink-0 shadow-sm flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-sky-600 animate-ping" />
                {offlinePendingCount} alteraç{offlinePendingCount > 1 ? 'ões pendentes' : 'ão pendente'}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ⚡ TOAST FLUTUANTE DE SINCRONIZAÇÃO BEM-SUCEDIDA */}
      {showSyncSuccessToast && (
        <div className="fixed bottom-6 right-6 z-[99999] bg-slate-900 border border-emerald-500/50 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-4 backdrop-blur-xl">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Wifi size={18} />
          </div>
          <div>
            <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>Conexão Restabelecida!</span>
            </h4>
            <p className="text-[11px] text-slate-300">
              Todas as operações offline foram sincronizadas com a nuvem com sucesso.
            </p>
          </div>
        </div>
      )}

      {/* Menu Hamburguer Lateral (Navigation Drawer) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentView={view}
        onNavigate={(newView) => {
          if (newView === 'clients') {
            setClientInitialTab('todos');
          }
          setView(newView);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        isConfigured={isConfigured}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {/* Modal Universal de Alteração de Senha */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        currentUser={currentUser}
        onPasswordChanged={handleUpdateUserPassword}
      />


      {/* Conteúdo do Dashboard */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {view === 'pos' ? (
          <POSRegister
            data={data}
            setData={setData}
            clientsData={data?.['CLIENTES_CADASTRADOS'] || []}
            salesData={data?.['Registro_Vendas'] || data?.['BD MARKETING'] || []}
            armacoesData={data?.['CAD_ARMACOES'] || []}
            lentesData={data?.['CAD_LENTES'] || []}
            receberData={data?.['CONTAS_RECEBER'] || []}
            currentUser={currentUser}
            onAddSale={(newSale) => handleAddRow(data?.['Registro_Vendas'] ? 'Registro_Vendas' : 'BD MARKETING', newSale)}
            onAddClient={(newClient) => handleAddRow('CLIENTES_CADASTRADOS', newClient)}
            onUpdateRow={handleRowUpdate}
            onAddRow={handleAddRow}
            onAddBatch={handleAddBatch}
            onNavigateToNewClient={() => {
              setClientInitialTab('novo');
              setView('clients');
            }}
            onNavigateToERP={() => setView('erp')}
            onBack={() => setView(currentUser?.role === 'vendedor' ? 'clients' : 'dashboard')}
          />
        ) : view === 'clients' ? (

          <ClientRegistration 
            currentUser={currentUser}
            initialTab={clientInitialTab}
            clientsData={data?.['CLIENTES_CADASTRADOS'] || []}
            salesData={data?.['Registro_Vendas'] || data?.['BD MARKETING'] || []}
            lentesData={data?.['CAD_LENTES'] || []}
            armacoesData={data?.['CAD_ARMACOES'] || []}
            receberData={data?.['CONTAS_RECEBER'] || []}
            onAddClient={(newClient) => handleAddRow('CLIENTES_CADASTRADOS', newClient)}
            onUpdateClient={(updatedClient) => handleRowUpdate('CLIENTES_CADASTRADOS', updatedClient.oldRow, updatedClient.newRow)}
            onDeleteClient={(clientToDelete) => handleDeleteRow('CLIENTES_CADASTRADOS', clientToDelete)}
            onAddSale={(newSale) => handleAddRow(data?.['Registro_Vendas'] ? 'Registro_Vendas' : 'BD MARKETING', newSale)}
            onUpdateSale={(oldSale, updatedSale) => handleRowUpdate(data?.['Registro_Vendas'] ? 'Registro_Vendas' : 'BD MARKETING', oldSale, updatedSale)}
            onDeleteSale={(saleToDelete) => handleDeleteRow(data?.['Registro_Vendas'] ? 'Registro_Vendas' : 'BD MARKETING', saleToDelete)}
            onAddRow={handleAddRow}
            onAddBatch={handleAddBatch}
            onUpdateRow={handleRowUpdate}
            onDeleteRow={handleDeleteRow}
            onBack={() => setView(currentUser?.role === 'vendedor' ? 'pos' : 'dashboard')} 
          />
        ) : view === 'erp' ? (
          <ErpOptica
            data={data}
            currentUser={currentUser}
            clientsData={data?.['CLIENTES_CADASTRADOS'] || []}
            onAddRow={handleAddRow}
            onAddBatch={handleAddBatch}
            onUpdateRow={handleRowUpdate}
            onDeleteRow={handleDeleteRow}
            onClearFinancialAndOS={handleClearFinancialAndOSHistory}
            onBack={() => setView('dashboard')}
          />
        ) : view === 'os-management' ? (
          <OSManagement
            data={data}
            salesData={data?.['Registro_Vendas'] || data?.['BD MARKETING'] || []}
            clientsData={data?.['CLIENTES_CADASTRADOS'] || []}
            currentUser={currentUser}
            onAddRow={handleAddRow}
            onAddBatch={handleAddBatch}
            onUpdateRow={handleRowUpdate}
            onDeleteRow={handleDeleteRow}
            onClearFinancialAndOS={handleClearFinancialAndOSHistory}
            onBack={() => setView(currentUser?.role === 'vendedor' ? 'pos' : 'dashboard')}
          />
        ) : (
          <Dashboard 
            onDataLoaded={handleDataLoaded}
            data={sanitizedDashboardData} 
            isSynced={true} 
            onRowUpdate={handleRowUpdate} 
            onAddClick={(sheetName, emptyRow) => setAddingRowData({ sheetName, row: emptyRow })}
            onOpenOSManagement={() => setView('os-management')}
            onOpenPOS={() => setView('pos')}
          />
        )}
      </div>

      {/* Modal de Detalhes da Busca Global */}
      <RowDetailsModal
        isOpen={!!selectedRow && !editingRowData}
        data={selectedRow}
        onClose={() => setSelectedRow(null)}
        onEditClick={() => {
          setEditingRowData(selectedRow);
          setSelectedRow(null); // Revertendo para fechar o modal de detalhes
        }}
      />

      {/* Modal de Edição Global */}
      <RowEditModal
        isOpen={!!editingRowData}
        onClose={() => setEditingRowData(null)}
        onSave={(updatedRow) => {
          handleRowUpdate(editingRowData.sheetName, editingRowData.row, updatedRow);
          setEditingRowData(null); // Fecha o modal após salvar
        }}
        rowData={editingRowData?.row}
        allCols={editingRowData ? Object.keys(editingRowData.row) : []}
        COLUMN_LABELS={COLUMN_LABELS}
        sheetName={editingRowData?.sheetName}
      />

      {/* Modal de Adição Global */}
      <RowEditModal
        isOpen={!!addingRowData}
        mode="add"
        onClose={() => setAddingRowData(null)}
        onSave={(newRow) => {
          handleAddRow(addingRowData.sheetName, newRow);
          setAddingRowData(null);
        }}
        rowData={addingRowData?.row}
        allCols={addingRowData ? Object.keys(addingRowData.row) : []}
        COLUMN_LABELS={COLUMN_LABELS}
        sheetName={addingRowData?.sheetName}
      />
    </div>
  );
}

export default App;
