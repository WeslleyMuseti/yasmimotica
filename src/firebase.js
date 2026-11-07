import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED,
  getFirestore 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBTWtMcNnRT1ljm1hH3G7x1-FVQi3MrjAs",
  authDomain: "projeto-carla-431bc.firebaseapp.com",
  projectId: "projeto-carla-431bc",
  storageBucket: "projeto-carla-431bc.firebasestorage.app",
  messagingSenderId: "445458889894",
  appId: "1:445458889894:web:fc8ab3dc83bdf4202b0867",
  measurementId: "G-V4CC3CSSDK"
};

let app = null;
let db = null;
let auth = null;
let isConfigured = false;

// Remove apenas se o snapshot exceder o limite seguro (> 1.5MB) para evitar QuotaExceededError
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const raw = localStorage.getItem('YASMIN_OFFLINE_DATA_BACKUP');
    if (raw && raw.length > 1500000) {
      localStorage.removeItem('YASMIN_OFFLINE_DATA_BACKUP');
    }
  } catch (e) {}
}

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "") {
  app = initializeApp(firebaseConfig);
  
  // 🛡️ PERSISTÊNCIA EM INDEXEDDB VIA persistentMultipleTabManager:
  // Usa IndexedDB com suporte nativo a múltiplas abas abertas simultaneamente,
  // compartilhando cache local com segurança e sem FAILED_PRECONDITION em abas secundárias.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    });
  } catch (err) {
    console.warn("Aviso ao ativar cache persistente multi-aba do Firestore, tentando aba única:", err);
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED
        })
      });
    } catch (singleErr) {
      console.warn("Aviso ao ativar cache persistente de aba única, usando fallback padrão:", singleErr);
      try {
        db = getFirestore(app);
      } catch (fallbackErr) {
        console.warn("Aviso no fallback do Firestore:", fallbackErr);
      }
    }
  }

  try {
    auth = getAuth(app);
  } catch (err) {
    console.warn("Aviso ao inicializar Firebase Auth:", err);
  }
  isConfigured = true;
}

export { app, db, auth, isConfigured };
