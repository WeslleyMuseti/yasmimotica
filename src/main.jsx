import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 🛡️ Error Boundary Global de Raiz: Garante que a aplicação NUNCA fique em tela cinza/em branco
class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('💥 [GlobalErrorBoundary] Erro crítico capturado na raiz da aplicação:', error, errorInfo);
  }

  handleHardReset = () => {
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) reg.unregister();
        });
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then(keys => {
          for (const key of keys) caches.delete(key);
        });
      }
    } catch (e) {
      console.warn('Aviso ao limpar caches:', e);
    }
    const cleanUrl = window.location.origin + window.location.pathname + '?v=' + Date.now();
    window.location.replace(cleanUrl);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
          {/* Header de Emergência */}
          <header className="border-b border-white/10 bg-slate-900/90 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 px-2 bg-white rounded-xl flex items-center justify-center shadow-md">
                <img src="/logo-yasmin.png" alt="Yasmin Ótica" className="h-5 w-auto object-contain" />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-tight text-white">
                  Yasmin <span className="text-sky-400">Ótica</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Módulo de Auto-Recuperação do Sistema
                </p>
              </div>
            </div>
            <button
              onClick={this.handleHardReset}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              Reiniciar Sistema
            </button>
          </header>

          {/* Conteúdo Central */}
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900/95 border border-amber-500/40 p-6 sm:p-8 rounded-3xl shadow-2xl text-center space-y-5 backdrop-blur-xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10 text-2xl font-bold">
                ⚠️
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-black uppercase tracking-wider text-white">
                  O Sistema Detectou uma Instabilidade
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Os seus dados estão completamente seguros. Clique abaixo para atualizar os arquivos em cache e restaurar a interface imediatamente.
                </p>
                {this.state.error?.message && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-white/5 text-[11px] font-mono text-rose-300 break-words text-left max-h-24 overflow-y-auto">
                    {this.state.error.message}
                  </div>
                )}
              </div>
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={this.handleHardReset}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-sky-500/25 cursor-pointer"
                >
                  Recarregar e Limpar Cache Local
                </button>
                <button
                  type="button"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
                >
                  Tentar Continuar Sem Recarregar
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

// Registro do Service Worker para suporte total a Modo Offline / Contingência
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Em desenvolvimento (localhost), desregistra qualquer Service Worker e limpa caches para garantir HMR e código atualizado
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Monitora atualizações de versão do cache
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 Nova versão do Sistema Yasmin Ótica disponível em cache.');
              }
            };
          }
        };
      }).catch((err) => {
        console.warn('Aviso: Registro do Service Worker falhou:', err);
      });
    });
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
