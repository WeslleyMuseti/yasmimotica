import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  runTransaction, 
  increment, 
  updateDoc, 
  getDoc,
  writeBatch
} from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./firebase.js";

// Nome das coleções sincronizadas
const COLLECTIONS = [
  'CLIENTES_CADASTRADOS',
  'Registro_Vendas',
  'CAD_LENTES',
  'CAD_ARMACOES',
  'CAD_BRINDES',
  'CONTAS_PAGAR',
  'CONTAS_RECEBER',
  'USUARIOS',
  'DELETED_ITEMS',
  'FLUXO_CAIXA',
  'TRANSFERENCIAS_ESTOQUE',
  'VOUCHERS'
];

/**
 * Escuta todas as coleções do Firestore em tempo real
 */
export const subscribeToCollections = (onDataUpdate) => {
  if (!db) return () => {};

  const unsubscribes = [];
  const state = {};

  COLLECTIONS.forEach(colName => {
    state[colName] = [];
    const colRef = collection(db, colName);
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const docs = [];
      snapshot.forEach(docSnap => {
        docs.push({ id: docSnap.id, ...docSnap.data() });
      });
      state[colName] = docs;
      onDataUpdate({ ...state }, colName);
    }, (error) => {
      console.warn(`Aviso ao escutar coleção ${colName}:`, error);
    });
    
    unsubscribes.push(unsubscribe);
  });

  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
};

// ══════════════════════════════════════════════════════════════════
// 0. GERENCIADOR DE FILA OFFLINE & CONTINGÊNCIA (OFFLINE-FIRST)
// ══════════════════════════════════════════════════════════════════
export const OFFLINE_QUEUE_KEY = 'YASMIN_OFFLINE_SYNC_QUEUE';
export const OFFLINE_BACKUP_KEY = 'YASMIN_OFFLINE_DATA_BACKUP';
export const DEAD_LETTER_QUEUE_KEY = 'YASMIN_DEAD_LETTER_QUEUE';

// Limpeza preventiva de emergência no carregamento:
// Se houver backup com mais de 1.5MB no localStorage, remove-o para liberar espaço para o Firestore
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const raw = localStorage.getItem(OFFLINE_BACKUP_KEY);
    if (raw && raw.length > 1500000) {
      localStorage.removeItem(OFFLINE_BACKUP_KEY);
      console.info('[Storage] Chave de backup pesada removida para desocupar cota do Firestore.');
    }
  } catch {}
}

export const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const enqueueOfflineOp = (type, collectionName, id, data) => {
  try {
    const queue = getOfflineQueue();
    const op = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      type, // 'save', 'delete', 'decrement_stock'
      collectionName,
      docId: String(id),
      data
    };
    queue.push(op);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    notifySyncStatus(queue.length);
    return op;
  } catch (e) {
    console.warn('Erro ao enfileirar operação offline:', e);
  }
};

export const clearOfflineQueue = () => {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    notifySyncStatus(0);
  } catch {}
};

export const notifySyncStatus = (pendingCount) => {
  if (typeof window !== 'undefined') {
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    window.dispatchEvent(new CustomEvent('yasmin-sync-status', {
      detail: { pendingCount, isOnline }
    }));
  }
};

/**
 * Utilitário universal de timeout para promessas Firestore
 */
export const withTimeout = (promise, ms = 3500, errorMsg = 'Timeout de operação') => {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.resolve(promise);
  }
  let timer;
  // Previne UnhandledPromiseRejection caso a promessa original falhe após o timeout
  if (typeof promise.catch === 'function') {
    promise.catch(() => {});
  }
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

// Mutex de concorrência para garantir que apenas uma rotina de sincronização execute por vez
export let isSyncingQueue = false;
export const getIsSyncingQueue = () => isSyncingQueue;

export const processOfflineQueue = async (options = {}) => {
  if (!db || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;

  const executeDrain = async () => {
    isSyncingQueue = true;
    try {
      const rawQueue = getOfflineQueue();
      const queue = rawQueue.filter(item => Boolean(item && item.id));
      if (queue.length === 0) {
        if (rawQueue.length > 0) {
          clearOfflineQueue();
        }
        notifySyncStatus(0);
        return 0;
      }

      const timeoutMs = options?.timeoutMs || 3500;
      const remaining = [];
      let processed = 0;

      for (const op of queue) {
        try {
          if (typeof options?.executor === 'function') {
            await withTimeout(
              options.executor(op),
              timeoutMs,
              `Timeout ao processar ${op.collectionName}/${op.docId}`
            );
            processed++;
          } else if (op.type === 'save') {
            const docRef = doc(db, op.collectionName, op.docId);
            await withTimeout(
              setDoc(docRef, op.data, { merge: true }),
              timeoutMs,
              `Timeout ao salvar ${op.collectionName}/${op.docId}`
            );
            processed++;
          } else if (op.type === 'delete') {
            const docRef = doc(db, op.collectionName, op.docId);
            await withTimeout(
              deleteDoc(docRef),
              timeoutMs,
              `Timeout ao excluir ${op.collectionName}/${op.docId}`
            );
            processed++;
          } else if (op.type === 'decrement_stock') {
            const docRef = doc(db, op.collectionName, op.docId);
            await withTimeout(
              updateDoc(docRef, {
                ESTOQUE: increment(-op.data.quantity),
                updatedAt: new Date().toISOString()
              }),
              timeoutMs,
              `Timeout ao atualizar estoque ${op.collectionName}/${op.docId}`
            );
            processed++;
          } else if (op.type === 'increment_stock') {
            const docRef = doc(db, op.collectionName, op.docId);
            await withTimeout(
              updateDoc(docRef, {
                ESTOQUE: increment(op.data.quantity),
                updatedAt: new Date().toISOString()
              }),
              timeoutMs,
              `Timeout ao incrementar estoque ${op.collectionName}/${op.docId}`
            );
            processed++;
          } else {
            console.warn(`[Sync Offline] Tipo de operação não reconhecido descartado com segurança:`, op.type);
          }
        } catch (err) {
          console.warn(`[Sync Offline] Falha ao sincronizar item pendente ${op.collectionName}/${op.docId}:`, err?.message || err);
          const retryCount = (op.retryCount || 0) + 1;
          if (retryCount >= 3) {
            console.error(`[Sync Offline] Limite de 3 tentativas atingido para ${op.collectionName}/${op.docId}. Movendo para ${DEAD_LETTER_QUEUE_KEY}.`);
            try {
              const dlRaw = localStorage.getItem(DEAD_LETTER_QUEUE_KEY);
              const dlList = dlRaw ? JSON.parse(dlRaw) : [];
              dlList.push({
                ...op,
                retryCount,
                failedAt: new Date().toISOString(),
                error: err?.message || String(err)
              });
              localStorage.setItem(DEAD_LETTER_QUEUE_KEY, JSON.stringify(dlList));
            } catch (dlErr) {
              console.warn('Erro ao salvar item na fila morta:', dlErr);
            }
          } else {
            remaining.push({
              ...op,
              retryCount
            });
          }
        }
      }

      // Preserva quaisquer operações adicionadas concorrentemente à fila enquanto a sincronização ocorria
      const currentQueue = getOfflineQueue();
      const processedIds = new Set(queue.map(q => q.id).filter(Boolean));
      const concurrentlyAdded = currentQueue.filter(item => item?.id && !processedIds.has(item.id));
      const finalQueue = [...remaining.filter(item => Boolean(item && item.id)), ...concurrentlyAdded];

      try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(finalQueue));
      } catch (storageErr) {
        console.warn('Erro ao atualizar fila offline no localStorage, liberando snapshot para garantir espaço:', storageErr);
        try {
          localStorage.removeItem(OFFLINE_BACKUP_KEY);
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(finalQueue));
        } catch (retryErr) {
          console.error('Falha crítica ao persistir fila offline após limpeza de snapshot:', retryErr);
        }
      }
      notifySyncStatus(finalQueue.length);

      if (processed > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yasmin-sync-finished', {
          detail: { processedCount: processed, remainingCount: finalQueue.length }
        }));
      }

      return processed;
    } finally {
      isSyncingQueue = false;
    }
  };

  // 🛡️ Web Locks API Mutex Multi-Aba: Garante que apenas 1 aba processe a fila por vez no navegador
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    try {
      return await navigator.locks.request('yasmin_offline_sync_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) return 0;
        return await executeDrain();
      });
    } catch (lockErr) {
      console.warn('[Sync Offline] Falha ao solicitar Web Lock, usando fallback local:', lockErr);
      if (isSyncingQueue) return 0;
      return await executeDrain();
    }
  }

  // Fallback para ambientes sem Web Locks (Node.js, navegadores legados)
  if (isSyncingQueue) return 0;
  return await executeDrain();
};

export const saveOfflineSnapshot = (dataObj) => {
  if (!dataObj || typeof dataObj !== 'object') return;
  try {
    // Cria um snapshot compacto limitando os últimos 100 registros por tabela
    // e impedindo saturação da cota de 5MB do localStorage
    const compactSnapshot = {};
    const MAX_ITEMS_PER_TABLE = 100;

    Object.keys(dataObj).forEach(col => {
      if (Array.isArray(dataObj[col])) {
        compactSnapshot[col] = dataObj[col].slice(-MAX_ITEMS_PER_TABLE);
      }
    });

    const serialized = JSON.stringify(compactSnapshot);
    if (serialized.length < 1500000) {
      localStorage.setItem(OFFLINE_BACKUP_KEY, serialized);
    } else {
      localStorage.removeItem(OFFLINE_BACKUP_KEY);
    }
  } catch (e) {
    try {
      localStorage.removeItem(OFFLINE_BACKUP_KEY);
    } catch {}
    console.warn('Aviso: Armazenamento local saturado. Snapshot pesado removido para liberar espaço do Firestore.');
  }
};

export const loadOfflineSnapshot = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

// Auto-processa quando o navegador detecta retorno de conexão
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOfflineQueue();
  });
}

/**
 * Salva ou atualiza um documento no Firestore (com suporte offline automático e timeout seguro)
 */
export const saveDocument = async (collectionName, dataObj, customId = null) => {
  if (!dataObj) return;
  const id = String(customId || dataObj.id || dataObj['_id'] || (Date.now().toString() + Math.random().toString(36).substring(2, 9)));
  
  const cleanData = { ...dataObj };
  delete cleanData._id;
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) cleanData[key] = null;
  });

  if (db && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    try {
      const docRef = doc(db, collectionName, id);
      await withTimeout(setDoc(docRef, cleanData, { merge: true }), 3000, 'Timeout de escrita Firestore');
    } catch (err) {
      console.warn(`[Modo Offline] Documento ${collectionName}/${id} salvo no cache local e enfileirado:`, err);
      enqueueOfflineOp('save', collectionName, id, cleanData);
    }
  } else {
    enqueueOfflineOp('save', collectionName, id, cleanData);
  }
  return id;
};

/**
 * Salva múltiplos documentos em lote no Firestore usando writeBatch
 * Caso offline ou com falha, enfileira os itens na fila offline.
 * @param {Array<{collectionName: string, dataObj: object, customId?: string}>} items
 */
export const saveBatch = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const preparedItems = items.map(item => {
    const { collectionName, dataObj, customId } = item;
    const id = String(customId || dataObj?.id || dataObj?.['_id'] || (Date.now().toString() + Math.random().toString(36).substring(2, 9)));
    const cleanData = { ...dataObj };
    delete cleanData._id;
    Object.keys(cleanData).forEach(key => {
      if (cleanData[key] === undefined) cleanData[key] = null;
    });
    return { collectionName, id, cleanData };
  });

  if (db && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    try {
      const BATCH_SIZE = 450;
      for (let i = 0; i < preparedItems.length; i += BATCH_SIZE) {
        const chunk = preparedItems.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ collectionName, id, cleanData }) => {
          const docRef = doc(db, collectionName, id);
          batch.set(docRef, cleanData, { merge: true });
        });
        await withTimeout(batch.commit(), 5000, 'Timeout ao executar batch no Firestore');
      }
      return preparedItems.map(p => p.id);
    } catch (err) {
      console.warn(`[Batch Firestore] Falha ao gravar em lote, enfileirando offline:`, err);
      preparedItems.forEach(({ collectionName, id, cleanData }) => {
        enqueueOfflineOp('save', collectionName, id, cleanData);
      });
      return preparedItems.map(p => p.id);
    }
  } else {
    preparedItems.forEach(({ collectionName, id, cleanData }) => {
      enqueueOfflineOp('save', collectionName, id, cleanData);
    });
    return preparedItems.map(p => p.id);
  }
};

/**
 * Exclui um documento do Firestore (com suporte offline automático e timeout seguro)
 */
export const deleteDocument = async (collectionName, id) => {
  if (!id) return;
  const docId = String(id);
  if (db && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    try {
      const docRef = doc(db, collectionName, docId);
      await withTimeout(deleteDoc(docRef), 3000, 'Timeout de exclusão Firestore');
    } catch (err) {
      console.warn(`[Modo Offline] Exclusão de ${collectionName}/${docId} registrada na fila offline:`, err);
      enqueueOfflineOp('delete', collectionName, docId, null);
    }
  } else {
    enqueueOfflineOp('delete', collectionName, docId, null);
  }
};

/**
 * Busca documento específico de um usuário pelo login de forma segura (sem vazar a coleção inteira)
 */
export const fetchUserDocument = async (username) => {
  if (!db || !username) return null;
  try {
    const cleanUser = String(username).toLowerCase().trim();
    const docRef = doc(db, 'USUARIOS', cleanUser);
    
    // Proteção com timeout de 3.5 segundos para garantir que o login não trave caso a rede esteja lenta
    const docSnap = await withTimeout(getDoc(docRef), 3500, 'Timeout ao buscar usuário').catch(() => null);
    
    if (docSnap && typeof docSnap.exists === 'function' && docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.warn('Aviso ao buscar usuário para autenticação:', err);
    return null;
  }
};

/**
 * Salva e sincroniza a senha criptografada de um usuário diretamente no Firestore (banco de dados em nuvem)
 * e no armazenamento local (localStorage/cache).
 */
export const syncUserPasswordToFirestore = async (username, newHashedPassword, additionalUserData = {}) => {
  if (!username || !newHashedPassword) {
    throw new Error('Nome de usuário e hash de senha são obrigatórios.');
  }

  const cleanUser = String(username).toLowerCase().trim();
  const nowIso = new Date().toISOString();
  const effectiveCity = additionalUserData.city || additionalUserData.assignedStore || '';

  const userDoc = {
    ...additionalUserData,
    id: cleanUser,
    username: cleanUser,
    password: newHashedPassword,
    role: additionalUserData.role || 'vendedor',
    city: effectiveCity,
    assignedStore: effectiveCity,
    authorized: additionalUserData.authorized !== false,
    updatedAt: nowIso
  };

  let savedInCloud = false;

  // 1. Salva diretamente no Firestore (coleção USUARIOS com ID = cleanUser) com timeout e fallback offline
  if (db) {
    try {
      const docRef = doc(db, 'USUARIOS', cleanUser);
      await withTimeout(setDoc(docRef, userDoc, { merge: true }), 3500, 'Timeout ao sincronizar credenciais');
      savedInCloud = true;
      console.log(`[Firestore] ✅ Senha do usuário "${cleanUser}" gravada com sucesso no Firestore!`);
    } catch (err) {
      console.warn(`[Firestore Offline] Erro ao gravar diretamente no Firestore, adicionando à fila offline:`, err);
      enqueueOfflineOp('save', 'USUARIOS', cleanUser, userDoc);
    }
  } else {
    enqueueOfflineOp('save', 'USUARIOS', cleanUser, userDoc);
  }

  // 2. Se existia documento com outro ID para o mesmo usuário no Firestore, limpa a duplicata antiga
  if (additionalUserData.id && String(additionalUserData.id).toLowerCase().trim() !== cleanUser) {
    const oldId = String(additionalUserData.id);
    if (db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'USUARIOS', oldId)), 3500, 'Timeout ao sincronizar credenciais');
      } catch (e) {
        console.warn(`[Firestore Offline] Erro/timeout ao deletar credencial antiga "${oldId}", enfileirando offline:`, e);
        enqueueOfflineOp('delete', 'USUARIOS', oldId);
      }
    } else {
      enqueueOfflineOp('delete', 'USUARIOS', oldId);
    }
  }

  // 3. Atualiza cache local no localStorage
  try {
    const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
    let found = false;
    const updatedLocal = localUsers.map(u => {
      if (u.username && String(u.username).toLowerCase().trim() === cleanUser) {
        found = true;
        return { ...u, ...userDoc };
      }
      return u;
    });
    if (!found) {
      updatedLocal.push(userDoc);
    }
    localStorage.setItem('users', JSON.stringify(updatedLocal));
  } catch (e) {
    console.warn('Aviso ao sincronizar localStorage:', e);
  }

  return { success: true, savedInCloud, userDoc };
};

/**
 * Compara profundamente duas listas de usuários para evitar re-renderizações e I/O desnecessários no localStorage.
 */
export const areUserListsEqual = (prevUsers, nextUsers) => {
  if (prevUsers === nextUsers) return true;
  if (!Array.isArray(prevUsers) || !Array.isArray(nextUsers)) return false;
  if (prevUsers.length !== nextUsers.length) return false;

  const sortFn = (a, b) => String(a?.username || '').localeCompare(String(b?.username || ''));
  const listA = [...prevUsers].sort(sortFn);
  const listB = [...nextUsers].sort(sortFn);

  const normalizeRole = (r) => {
    const s = String(r || 'vendedor').toLowerCase().trim();
    return (s === 'admin' || s === 'administrativo') ? 'administrativo' : s;
  };

  for (let i = 0; i < listA.length; i++) {
    const a = listA[i] || {};
    const b = listB[i] || {};

    const uA = String(a.username || '').toLowerCase().trim();
    const uB = String(b.username || '').toLowerCase().trim();
    if (uA !== uB) return false;
    if (String(a.password || '') !== String(b.password || '')) return false;
    if (normalizeRole(a.role) !== normalizeRole(b.role)) return false;
    const cityA = String(a.city || a.assignedStore || '').trim();
    const cityB = String(b.city || b.assignedStore || '').trim();
    if (cityA !== cityB) return false;
    if (Boolean(a.authorized) !== Boolean(b.authorized)) return false;
    if (String(a.updatedAt || '') !== String(b.updatedAt || '')) return false;
  }
  return true;
};

/**
 * Reconcilia usuários remotos com o estado local e a fila offline, garantindo:
 * 1. Não ressurreição de usuários deletados no Firestore.
 * 2. Preservação permanente da conta master 'wmusete'.
 * 3. Incorporação de operações pendentes na fila offline (type === 'save' e 'delete').
 * 4. Preservação de alterações locais com updatedAt mais recente.
 * 5. Não apagamento de hash de senhas existentes caso documento remoto venha sem senha.
 * 6. Sincronização unificada de city e assignedStore.
 */
export const reconcileUsers = (remoteUsers = [], prevUsers = [], offlineQueue = []) => {
  const userMap = new Map();

  const normalizeRole = (r) => {
    const s = String(r || 'vendedor').toLowerCase().trim();
    return (s === 'admin' || s === 'administrativo') ? 'administrativo' : s;
  };

  // 1. Popula com os usuários remotos oficiais
  (remoteUsers || []).forEach(r => {
    if (!r || !r.username) return;
    const key = String(r.username).toLowerCase().trim();
    const existingLocal = (prevUsers || []).find(u => u?.username && String(u.username).toLowerCase().trim() === key);
    if (existingLocal) {
      const remoteTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      const localTime = existingLocal.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;
      let mergedUser;
      if (localTime > remoteTime) {
        mergedUser = { ...r, ...existingLocal, id: key, username: key };
      } else {
        mergedUser = { ...existingLocal, ...r, id: key, username: key };
      }
      // Proteção de integridade: nunca perde o hash de senha se o snapshot remoto veio sem ele
      if (!mergedUser.password && existingLocal.password) {
        mergedUser.password = existingLocal.password;
      }
      // Proteção de integridade: unifica city e assignedStore
      const city = mergedUser.city || mergedUser.assignedStore || existingLocal.city || existingLocal.assignedStore || '';
      mergedUser.city = city;
      mergedUser.assignedStore = city;
      mergedUser.role = normalizeRole(mergedUser.role);
      userMap.set(key, mergedUser);
    } else {
      const city = r.city || r.assignedStore || '';
      userMap.set(key, { ...r, id: key, username: key, city, assignedStore: city, role: normalizeRole(r.role) });
    }
  });

  // 2. Garante a conta master permanente 'wmusete' (se ausente nos remotos)
  const masterKey = 'wmusete';
  if (!userMap.has(masterKey)) {
    const localMaster = (prevUsers || []).find(u => u?.username && String(u.username).toLowerCase().trim() === masterKey);
    if (localMaster) {
      userMap.set(masterKey, { ...localMaster, id: masterKey, username: masterKey, role: 'administrativo' });
    } else {
      userMap.set(masterKey, {
        id: masterKey,
        username: masterKey,
        role: 'administrativo',
        authorized: true,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // 3. Mescla operações pendentes da fila offline
  (offlineQueue || []).forEach(op => {
    if (!op) return;
    const col = op.collectionName || op.collection;
    if (col !== 'USUARIOS') return;
    if (op.type === 'save' && op.data) {
      const username = op.data.username || op.docId || op.id;
      if (username) {
        const key = String(username).toLowerCase().trim();
        const existing = userMap.get(key);
        const city = op.data.city || op.data.assignedStore || existing?.city || '';
        userMap.set(key, { ...(existing || {}), ...op.data, id: key, username: key, city, assignedStore: city, role: normalizeRole(op.data.role || existing?.role) });
      }
    } else if (op.type === 'delete') {
      const targetId = op.docId || op.id;
      if (targetId) {
        const key = String(targetId).toLowerCase().trim();
        if (key !== masterKey) {
          userMap.delete(key);
        }
      }
    }
  });

  return Array.from(userMap.values());
};

// ══════════════════════════════════════════════════════════════════
// 1. TRANSAÇÕES ATÔMICAS DE ESTOQUE (CONCORRÊNCIA MULTILOJA)
// ══════════════════════════════════════════════════════════════════

/**
 * Baixa atômica de estoque no Firestore utilizando runTransaction
 * Evita concorrência e venda duplicada do mesmo produto por duas lojas/abas.
 */
export const decrementStockAtomically = async (collectionName, docId, quantity = 1) => {
  if (!db || !docId) {
    return { success: false, reason: 'db_or_id_missing' };
  }

  const id = String(docId);
  const docRef = doc(db, collectionName, id);
  const qtyToSubtract = Math.max(1, parseInt(quantity, 10) || 1);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn(`[Modo Offline] Navegador offline detectado, enfileirando decremento direto de ${collectionName}/${id}`);
    enqueueOfflineOp('decrement_stock', collectionName, id, { quantity: qtyToSubtract });
    return { success: true, offlineQueue: true };
  }

  try {
    const txPromise = runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw new Error(`Doc ${id} não existe no Firestore`);
      }

      const data = docSnap.data();
      const currentStock = parseInt(
        data.ESTOQUE !== undefined ? data.ESTOQUE : (data['EM ESTOQUE'] !== undefined ? data['EM ESTOQUE'] : (data.estoque || 0)),
        10
      ) || 0;

      if (currentStock < qtyToSubtract) {
        const err = new Error(`Estoque insuficiente: atual (${currentStock}) menor que o solicitado (${qtyToSubtract})`);
        err.code = 'INSUFFICIENT_STOCK';
        err.currentStock = currentStock;
        throw err;
      }

      const newStock = Math.max(0, currentStock - qtyToSubtract);

      const updateData = {
        ESTOQUE: newStock,
        updatedAt: new Date().toISOString()
      };

      if (data['EM ESTOQUE'] !== undefined) {
        updateData['EM ESTOQUE'] = newStock;
      }
      if (data['estoque'] !== undefined) {
        updateData['estoque'] = newStock;
      }

      transaction.update(docRef, updateData);
      return { success: true, previousStock: currentStock, newStock };
    });

    const transactionResult = await withTimeout(txPromise, 2500, 'Timeout de transação atômica Firestore');
    return transactionResult;
  } catch (err) {
    if (err.code === 'INSUFFICIENT_STOCK') {
      console.warn(`Estoque insuficiente para ${collectionName}/${id}:`, err.message);
      return { success: false, reason: 'insufficient_stock', currentStock: err.currentStock, error: err };
    }

    console.warn(`Transação atômica falhou para ${collectionName}/${id}, aplicando fallback com increment():`, err);
    try {
      await withTimeout(
        updateDoc(docRef, {
          ESTOQUE: increment(-qtyToSubtract),
          updatedAt: new Date().toISOString()
        }),
        2500,
        'Timeout no fallback de decremento de estoque Firestore'
      );
      return { success: true, fallback: true };
    } catch (fallbackErr) {
      console.warn(`[Modo Offline] Fallback no Firestore falhou para ${collectionName}/${id}, registrando decremento na fila offline:`, fallbackErr);
      enqueueOfflineOp('decrement_stock', collectionName, id, { quantity: qtyToSubtract });
      return { success: true, offlineQueue: true };
    }
  }
};

/**
 * Incremento atômico de estoque no Firestore
 */
export const incrementStockAtomically = async (collectionName, docId, quantity = 1) => {
  if (!db || !docId) return { success: false };
  const id = String(docId);
  const docRef = doc(db, collectionName, id);
  const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);

  try {
    const res = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw new Error(`Doc ${id} não existe`);
      }
      const data = docSnap.data();
      const currentStock = parseInt(data.ESTOQUE ?? data['EM ESTOQUE'] ?? data.estoque ?? 0, 10);
      const newStock = currentStock + qtyToAdd;

      const updateData = {
        ESTOQUE: newStock,
        updatedAt: new Date().toISOString()
      };
      if (data['EM ESTOQUE'] !== undefined) updateData['EM ESTOQUE'] = newStock;
      if (data['estoque'] !== undefined) updateData['estoque'] = newStock;

      transaction.update(docRef, updateData);
      return { success: true, previousStock: currentStock, newStock };
    });
    return res;
  } catch (err) {
    try {
      await withTimeout(
        updateDoc(docRef, {
          ESTOQUE: increment(qtyToAdd),
          updatedAt: new Date().toISOString()
        }),
        2500,
        'Timeout no fallback de incremento de estoque Firestore'
      );
      return { success: true, fallback: true };
    } catch (e) {
      return { success: false, error: e };
    }
  }
};

/**
 * Transferência atômica entre dois itens de estoque (Origem -> Destino)
 */
export const transferStockAtomically = async (collectionName, originDocId, destDocId, quantity = 1) => {
  if (!db || !originDocId) return { success: false };
  const originRef = doc(db, collectionName, String(originDocId));
  const destRef = destDocId ? doc(db, collectionName, String(destDocId)) : null;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  try {
    const txPromise = runTransaction(db, async (transaction) => {
      const originSnap = await transaction.get(originRef);
      if (!originSnap.exists()) throw new Error('Origem não encontrada');

      const originData = originSnap.data();
      const origStock = parseInt(originData.ESTOQUE ?? originData['EM ESTOQUE'] ?? originData.estoque ?? 0, 10);
      if (origStock < qty) {
        const err = new Error(`Estoque insuficiente na origem: ${origStock} < ${qty}`);
        err.code = 'INSUFFICIENT_STOCK';
        throw err;
      }
      const newOrigStock = origStock - qty;

      transaction.update(originRef, {
        ESTOQUE: newOrigStock,
        ...(originData['EM ESTOQUE'] !== undefined ? { 'EM ESTOQUE': newOrigStock } : {}),
        ...(originData.estoque !== undefined ? { estoque: newOrigStock } : {}),
        updatedAt: new Date().toISOString()
      });

      if (destRef) {
        const destSnap = await transaction.get(destRef);
        if (destSnap.exists()) {
          const destData = destSnap.data();
          const destStock = parseInt(destData.ESTOQUE ?? destData['EM ESTOQUE'] ?? destData.estoque ?? 0, 10);
          const newDestStock = destStock + qty;

          transaction.update(destRef, {
            ESTOQUE: newDestStock,
            ...(destData['EM ESTOQUE'] !== undefined ? { 'EM ESTOQUE': newDestStock } : {}),
            ...(destData.estoque !== undefined ? { estoque: newDestStock } : {}),
            updatedAt: new Date().toISOString()
          });
        }
      }
    });
    await withTimeout(txPromise, 3500, 'Timeout de transferência de estoque Firestore');
    return { success: true };
  } catch (err) {
    console.error('Erro na transferência atômica:', err);
    return { success: false, error: err };
  }
};

// ══════════════════════════════════════════════════════════════════
// 2. CRIPTOGRAFIA & AUTENTICAÇÃO SEGURA (PBKDF2 / SHA-256 + AUTH)
// ══════════════════════════════════════════════════════════════════

/**
 * Gera hash criptográfico seguro (PBKDF2 / SHA-256 com salt) para a senha
 */
export const hashPassword = async (plainPassword, salt = null) => {
  if (!plainPassword) return '';
  const effectiveSalt = salt || Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(plainPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(effectiveSalt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    const hashHex = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return `pbkdf2:${effectiveSalt}:${hashHex}`;
  } catch (err) {
    // Fallback padrão SHA-256 se PBKDF2 falhar em ambiente limitado
    const enc = new TextEncoder();
    const data = enc.encode(effectiveSalt + plainPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${effectiveSalt}:${hashHex}`;
  }
};

/**
 * Verifica se uma senha fornecida corresponde ao hash ou senha armazenada
 */
export const verifyPassword = async (plainPassword, storedPasswordOrHash) => {
  if (!plainPassword || !storedPasswordOrHash) return false;

  const plainStr = String(plainPassword).trim();
  const storedStr = String(storedPasswordOrHash).trim();

  // Se já está no formato seguro PBKDF2
  if (storedStr.startsWith('pbkdf2:')) {
    const parts = storedStr.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const computed = await hashPassword(plainStr, salt);
      return computed === storedStr;
    }
  }

  // Se está no formato SHA-256
  if (storedStr.startsWith('sha256:')) {
    const parts = storedStr.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      const enc = new TextEncoder();
      const data = enc.encode(salt + plainStr);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex === expectedHash;
    }
  }

  // Compatibilidade com senhas legadas em texto puro (migração transparente)
  return plainStr === storedStr;
};

/**
 * Verifica se a senha já possui formato hash seguro
 */
export const isPasswordHashed = (password) => {
  return typeof password === 'string' && (password.startsWith('pbkdf2:') || password.startsWith('sha256:'));
};

/**
 * Autenticação com Firebase Auth (quando usuário usar email) ou fallback criptográfico
 */
export const loginWithFirebaseAuth = async (email, password) => {
  if (!auth) return { success: false, reason: 'auth_not_configured' };
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (err) {
    return { success: false, error: err };
  }
};

export const registerWithFirebaseAuth = async (email, password) => {
  if (!auth) return { success: false, reason: 'auth_not_configured' };
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (err) {
    return { success: false, error: err };
  }
};

// ══════════════════════════════════════════════════════════════════
// 3. VÍNCULO FINANCEIRO ESTRITO POR ID E CPF ÚNICO (ANTI-HOMÔNIMOS)
// ══════════════════════════════════════════════════════════════════

/**
 * Extrai o ID de cliente de um objeto (seja ele um cadastro de cliente ou um registro com chave estrangeira)
 */
export const extractClientId = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  // 1. Chave estrangeira explícita apontando para o cliente
  const fk = obj.CLIENTE_ID ?? obj.cliente_id ?? obj.CLIENT_ID ?? obj.clientId ?? obj.client_id;
  if (fk !== undefined && fk !== null && String(fk).trim() !== '') {
    return String(fk).trim();
  }
  // 2. Se for um objeto de cadastro de cliente (possui 'Nome Completo', ou não é transação/movimentação)
  const isTransaction = (
    obj.VALOR !== undefined ||
    obj['VALOR TOTAL'] !== undefined ||
    obj.VALOR_TOTAL !== undefined ||
    obj.VALOR_PARCELA !== undefined ||
    obj.DOCUMENTO !== undefined ||
    obj.FORMA_PAGTO !== undefined ||
    obj.formaPagamento !== undefined ||
    obj.TIPO_TRANSACAO !== undefined ||
    obj.DATA_VENCIMENTO !== undefined ||
    obj['DATA VENCIMENTO'] !== undefined ||
    obj.tipo === 'VENDA' ||
    obj.tipo === 'ABERTURA' ||
    obj.tipo === 'SANGRIA' ||
    obj.tipo === 'SUPRIMENTO' ||
    obj.tipo === 'FECHAMENTO'
  );
  if (!isTransaction) {
    const rawId = obj.id ?? obj._id;
    if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
      return String(rawId).trim();
    }
  }
  return null;
};

/**
 * Extrai o CPF/CNPJ limpo (apenas dígitos)
 */
export const extractCpf = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  const rawCpf = obj['CPF / CNPJ'] ?? obj['CPF'] ?? obj['CLIENTE_CPF'] ?? obj['cliente_cpf'] ?? obj['cpf'] ?? obj['Responsável CPF'] ?? '';
  return String(rawCpf || '').replace(/\D/g, '');
};

/**
 * Extrai o Nome do cliente
 */
export const extractClientName = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  const rawName = obj['Nome Completo'] ?? obj['NOME'] ?? obj['CLIENTE'] ?? obj['NOME CLIENTE'] ?? obj['NOME DO CLIENTE'] ?? obj['Cliente'] ?? obj['cliente'] ?? '';
  return String(rawName || '').trim().toLowerCase();
};

/**
 * Utilitário de comparação estrita entre cliente e registros financeiros / OS / Boletos
 * Impede que homônimos com o mesmo nome tenham parcelas misturadas.
 */
export const isSameClient = (clientA, clientB) => {
  if (!clientA || !clientB) return false;
  if (typeof clientA !== 'object' || typeof clientB !== 'object') return false;

  const idA = extractClientId(clientA);
  const idB = extractClientId(clientB);

  // 1. Se AMBOS possuem ID de cliente identificado:
  if (idA && idB) {
    return idA.toLowerCase() === idB.toLowerCase();
  }

  // 2. Se ao menos um não possui ID de cliente, compara por CPF/CNPJ único (mínimo 7 dígitos)
  const cpfA = extractCpf(clientA);
  const cpfB = extractCpf(clientB);
  if (cpfA.length >= 7 && cpfB.length >= 7) {
    return cpfA === cpfB;
  }

  // 3. Fallback: Casamento por Nome apenas se nenhum dos dois possuir CPF/ID cadastrado
  const nameA = extractClientName(clientA);
  const nameB = extractClientName(clientB);
  if (nameA && nameB && nameA === nameB) {
    return true;
  }

  return false;
};

/**
 * Identifica se um registro refere-se à cliente Stephanie Museti (ou variações de teste)
 */
export const isStephanieMuseti = (item) => {
  if (!item || typeof item !== 'object') return false;
  const name = String(
    item['Nome Completo'] ?? item['NOME'] ?? item['CLIENTE'] ?? item['NOME CLIENTE'] ?? 
    item['NOME DO CLIENTE'] ?? item['Nome'] ?? item['Cliente'] ?? item.cliente ?? item.nome ??
    item['CLIENTE_NOME'] ?? item['TITULAR'] ?? item['SACADO'] ?? item['PAGADOR'] ?? ''
  ).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const isSteph = name.includes('stephanie') || name.includes('stefanie') || name.includes('stephany') || name.includes('stefany');
  const isMuseti = name.includes('museti') || name.includes('musete') || name.includes('musseti') || name.includes('mussette');

  if (isSteph && isMuseti) return true;

  // Verifica também em DOCUMENTO ou DESCRICAO para parcelas ou OSs avulsas
  const docOrDesc = String(item['DOCUMENTO'] ?? item['DESCRICAO'] ?? item['HISTORICO'] ?? item['OBSERVACOES'] ?? '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const docSteph = (docOrDesc.includes('stephanie') || docOrDesc.includes('stefanie') || docOrDesc.includes('stephany') || docOrDesc.includes('stefany')) &&
                   (docOrDesc.includes('museti') || docOrDesc.includes('musete') || docOrDesc.includes('musseti') || docOrDesc.includes('mussette'));
  return docSteph;
};

/**
 * Rotina de higienização segura e atômica da cliente Stephanie Museti:
 * 1. Remove quaisquer OS de teste em Registro_Vendas e BD MARKETING
 * 2. Remove duplicatas de parcelas pendentes em CONTAS_RECEBER
 * 3. Zera 'Valor Devido' para '0,00' e define status 'Em dia' em CLIENTES_CADASTRADOS
 */
export const sanitizeStephanieMusetiData = (currentData, getItemKeyFn = null) => {
  if (!currentData || typeof currentData !== 'object') {
    return { nextData: currentData, modified: false, deletedKeys: [], deletedItems: [] };
  }

  let modified = false;
  const nextData = { ...currentData };
  const deletedKeys = [];
  const deletedItems = [];

  // 1. Limpar OS de teste em Registro_Vendas e BD MARKETING
  ['Registro_Vendas', 'BD MARKETING'].forEach(sheet => {
    if (Array.isArray(nextData[sheet])) {
      const remaining = [];
      nextData[sheet].forEach(row => {
        if (isStephanieMuseti(row)) {
          modified = true;
          const rowId = row.id || row._id;
          if (rowId) deletedItems.push({ sheet, id: rowId, row });
          if (getItemKeyFn) {
            const k = getItemKeyFn(row);
            if (k) deletedKeys.push(k);
          } else if (rowId) {
            deletedKeys.push(`id:${rowId}`);
          }
        } else {
          remaining.push(row);
        }
      });
      if (remaining.length !== nextData[sheet].length) {
        nextData[sheet] = remaining;
      }
    }
  });

  // 2. Limpar duplicatas de parcelas pendentes em CONTAS_RECEBER
  if (Array.isArray(nextData['CONTAS_RECEBER'])) {
    const remaining = [];
    nextData['CONTAS_RECEBER'].forEach(row => {
      if (isStephanieMuseti(row)) {
        modified = true;
        const rowId = row.id || row._id;
        if (rowId) deletedItems.push({ sheet: 'CONTAS_RECEBER', id: rowId, row });
        if (getItemKeyFn) {
          const k = getItemKeyFn(row);
          if (k) deletedKeys.push(k);
        } else if (rowId) {
          deletedKeys.push(`id:${rowId}`);
        }
      } else {
        remaining.push(row);
      }
    });
    if (remaining.length !== nextData['CONTAS_RECEBER'].length) {
      nextData['CONTAS_RECEBER'] = remaining;
    }
  }

  // 3. Zerar 'Valor Devido' para '0,00' e definir status 'Em dia' em CLIENTES_CADASTRADOS
  if (Array.isArray(nextData['CLIENTES_CADASTRADOS'])) {
    let clientsChanged = false;
    const updatedClients = nextData['CLIENTES_CADASTRADOS'].map(client => {
      if (isStephanieMuseti(client)) {
        const currentDevido = String(client['Valor Devido'] || client['VALOR_DEVIDO'] || '0,00').trim();
        const currentStatus = String(client['Status de Pagamento'] || client['STATUS_PAGAMENTO'] || 'Em dia').trim();
        if (currentDevido !== '0,00' || currentStatus !== 'Em dia') {
          clientsChanged = true;
          modified = true;
        }
        return {
          ...client,
          'Valor Devido': '0,00',
          'VALOR_DEVIDO': '0,00',
          'valorDevido': '0,00',
          'SALDO_DEVEDOR': '0,00',
          'Saldo Devedor': '0,00',
          'Status de Pagamento': 'Em dia',
          'STATUS_PAGAMENTO': 'Em dia',
          'statusPagamento': 'Em dia',
          'Status Financeiro': 'Em dia',
          'STATUS_FINANCEIRO': 'Em dia',
          'STATUS': 'Em dia'
        };
      }
      return client;
    });
    if (clientsChanged) {
      nextData['CLIENTES_CADASTRADOS'] = updatedClients;
    }
  }

  return { nextData, modified, deletedKeys, deletedItems };
};
