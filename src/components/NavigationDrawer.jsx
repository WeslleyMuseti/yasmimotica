import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ShoppingCart, 
  Users, 
  ClipboardList, 
  Package, 
  UserCog, 
  LogOut, 
  ShieldCheck, 
  MapPin, 
  KeyRound,
  Eye,
  ChevronRight,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NavigationDrawer = ({
  isOpen,
  onClose,
  currentView,
  onNavigate,
  currentUser,
  onLogout,
  isConfigured,
  onOpenChangePassword,
  onOpenAdminBroadcast,
  onOpenBroadcastHistory,
  unreadBroadcastCount = 0
}) => {
  // Fecha com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trava a rolagem do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isAdmin = ['admin', 'administrativo'].includes(currentUser?.role);
  const isMaster = currentUser?.username === 'wmusete';

  const menuSections = [
    {
      title: 'Vendas & Atendimento',
      items: [
        {
          id: 'pos',
          label: 'Caixa (PDV)',
          description: 'Frente de caixa, leitor de código de barras e vendas',
          icon: ShoppingCart,
          color: 'emerald',
          gradient: 'from-emerald-500 to-teal-500',
          textColor: 'text-emerald-400',
          bgActive: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-lg shadow-emerald-500/25',
          visible: true
        },
        {
          id: 'clients',
          label: 'Clientes',
          description: 'Cadastro, prescrições, documentos e referências',
          icon: Users,
          color: 'fuchsia',
          gradient: 'from-fuchsia-500 to-purple-600',
          textColor: 'text-fuchsia-400',
          bgActive: 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-black shadow-lg shadow-fuchsia-500/25',
          visible: true
        },
        {
          id: 'os-management',
          label: 'Gestão de OS',
          description: 'Ordens de serviço, laboratório e prazos',
          icon: ClipboardList,
          color: 'pink',
          gradient: 'from-pink-500 to-rose-600',
          textColor: 'text-pink-400',
          bgActive: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black shadow-lg shadow-pink-500/25',
          visible: true
        }
      ]
    },
    {
      title: 'Gestão & Relatórios',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard Geral',
          description: 'Indicadores, ranking de vendedores e faturamento',
          icon: Eye,
          color: 'sky',
          gradient: 'from-sky-500 to-blue-600',
          textColor: 'text-sky-400',
          bgActive: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black shadow-lg shadow-sky-500/25',
          visible: isAdmin
        },
        {
          id: 'erp',
          label: 'ERP Ótica & Estoque',
          description: 'Armações, lentes, transferências e financeiro',
          icon: Package,
          color: 'indigo',
          gradient: 'from-indigo-500 to-violet-600',
          textColor: 'text-indigo-400',
          bgActive: 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black shadow-lg shadow-indigo-500/25',
          visible: isAdmin
        }
      ]
    },
    {
      title: 'Comunicação ao Vivo',
      items: [
        {
          id: 'broadcast-action',
          label: isAdmin ? 'Transmitir Comunicado' : 'Mural de Avisos',
          description: isAdmin ? 'Aparece no meio da tela de todos os terminais' : 'Ver comunicados enviados pela Diretoria',
          icon: Megaphone,
          color: 'purple',
          gradient: 'from-purple-500 to-pink-600',
          textColor: 'text-purple-400',
          bgActive: 'bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black shadow-lg shadow-purple-500/25',
          visible: true,
          badge: unreadBroadcastCount > 0 ? unreadBroadcastCount : null,
          onClick: () => {
            if (isAdmin && onOpenAdminBroadcast) {
              onOpenAdminBroadcast();
            } else if (onOpenBroadcastHistory) {
              onOpenBroadcastHistory();
            }
          }
        }
      ]
    },
    {
      title: 'Configurações do Sistema',
      items: [
        {
          id: 'admin',
          label: 'Usuários & Permissões',
          description: 'Gerenciar contas, senhas e níveis de acesso',
          icon: UserCog,
          color: 'amber',
          gradient: 'from-amber-500 to-orange-600',
          textColor: 'text-amber-400',
          bgActive: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black shadow-lg shadow-amber-500/25',
          visible: isAdmin
        }
      ]
    }
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex">
          {/* Backdrop Escurecido com Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
          />

          {/* Gaveta Lateral (Drawer) */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-[85vw] max-w-[340px] sm:max-w-[380px] bg-slate-950/95 border-r border-white/10 shadow-2xl flex flex-col h-full z-10 backdrop-blur-2xl"
          >
            {/* Cabeçalho do Menu Lateral */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-900/90 to-slate-950/90">
              <div className="flex items-center gap-3">
                <div className="h-10 px-2.5 bg-white rounded-xl flex items-center justify-center shadow-md shadow-black/40 border border-white/40 ring-1 ring-white/10">
                  <img src="/logo-yasmin.png" alt="Yasmin Ótica" className="h-6 w-auto object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white uppercase flex items-center gap-1.5">
                    Yasmin <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Ótica</span>
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    Sistema de Gestão &amp; PDV
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all active:scale-95"
                title="Fechar Menu (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Card do Operador Logado */}
            <div className="p-4 mx-4 mt-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm shadow-md ${
                  isMaster 
                    ? 'bg-gradient-to-tr from-fuchsia-600 to-pink-500 text-white shadow-fuchsia-500/20' 
                    : isAdmin 
                    ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-sky-500/20'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-emerald-500/20'
                }`}>
                  {String(currentUser?.username || 'U').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-white truncate">
                      {currentUser?.username || 'Operador'}
                    </span>
                    {isMaster ? (
                      <span className="text-[9px] bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0">
                        Master
                      </span>
                    ) : isAdmin ? (
                      <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded-full font-bold uppercase shrink-0">
                        Admin
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-bold uppercase shrink-0">
                        Vendedor
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} className="text-slate-500" />
                      {currentUser?.city || 'Todas as Lojas'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      Ao Vivo
                    </span>
                  </div>
                </div>
              </div>

              {/* Botão de Alteração Rápida de Senha do Usuário */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenChangePassword) onOpenChangePassword();
                }}
                className="mt-3.5 w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                <KeyRound size={13} className="text-sky-400" />
                <span>Alterar Minha Senha</span>
              </button>
            </div>

            {/* Lista de Módulos Rolável */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 erp-scroll">
              {menuSections.map((section, sIdx) => {
                const visibleItems = section.items.filter(item => item.visible);
                if (visibleItems.length === 0) return null;

                return (
                  <div key={sIdx} className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3">
                      {section.title}
                    </p>

                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.onClick) {
                                item.onClick();
                              } else {
                                onNavigate(item.id);
                              }
                              onClose();
                            }}
                            className={`w-full group flex items-center justify-between p-3 rounded-2xl transition-all text-left ${
                              isActive
                                ? item.bgActive
                                : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                isActive 
                                  ? (item.id === 'pos' ? 'bg-slate-950 text-emerald-400' : 'bg-white/20 text-white')
                                  : `bg-white/5 ${item.textColor} border border-white/5`
                              }`}>
                                <Icon size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-black truncate ${isActive ? '' : 'text-white'}`}>
                                  {item.label}
                                </p>
                                <p className={`text-[10px] truncate mt-0.5 ${
                                  isActive 
                                    ? (item.id === 'pos' ? 'text-slate-800 font-bold' : 'text-white/80 font-medium')
                                    : 'text-slate-400'
                                }`}>
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.badge && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow">
                                  {item.badge}
                                </span>
                              )}
                              <ChevronRight size={14} className={`transition-transform ${
                                isActive ? 'translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5'
                              }`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé do Menu com Botão Sair */}
            <div className="p-4 border-t border-white/10 bg-slate-950/90 space-y-3">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 hover:border-rose-500 transition-all font-black text-xs group active:scale-95 shadow-sm"
              >
                <LogOut size={16} className="transition-transform group-hover:-translate-x-0.5" />
                <span>Encerrar Sessão (Sair)</span>
              </button>

              <div className="flex items-center justify-between text-[10px] text-slate-500 px-2 font-medium">
                <span>Versão 1.6.0 Pro</span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-400" />
                  Firebase Protegido
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default NavigationDrawer;
