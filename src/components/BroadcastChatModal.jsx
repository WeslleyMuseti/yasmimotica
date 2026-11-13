import React, { useState, useEffect, useRef } from 'react';
import { 
  Megaphone, 
  Send, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  RotateCcw, 
  ShieldCheck, 
  Bell, 
  Radio, 
  Flame, 
  PartyPopper,
  Volume2
} from 'lucide-react';

/**
 * 🔊 Toca um sinal sonoro suave e elegante utilizando a Web Audio API nativa do navegador
 * 100% offline, sem arquivos externos, funciona em todos os navegadores modernos.
 */
export const playBroadcastChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Acorde harmônico ascendente: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz)
    playTone(659.25, now, 0.22);
    playTone(830.61, now + 0.12, 0.28);
    playTone(987.77, now + 0.24, 0.45);
  } catch (e) {
    // Silencia caso haja bloqueio de autoplay
  }
};

/**
 * 🏷️ Configuração de Estilos e Badges para cada Tipo de Transmissão
 */
export const BROADCAST_TYPES = {
  comunicado: {
    label: 'Comunicado Geral',
    icon: Megaphone,
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    borderGlow: 'border-indigo-500/60 shadow-[0_0_60px_rgba(99,102,241,0.35)]',
    cardHeader: 'from-indigo-600/30 via-sky-600/20 to-transparent',
    btnBg: 'bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500'
  },
  importante: {
    label: 'Importante / Atenção',
    icon: AlertTriangle,
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderGlow: 'border-amber-500/60 shadow-[0_0_60px_rgba(245,158,11,0.35)]',
    cardHeader: 'from-amber-600/30 via-orange-600/20 to-transparent',
    btnBg: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
  },
  urgente: {
    label: 'Urgente / Prioridade Máxima',
    icon: Flame,
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    borderGlow: 'border-rose-500/70 shadow-[0_0_70px_rgba(244,63,94,0.45)]',
    cardHeader: 'from-rose-600/30 via-red-600/20 to-transparent',
    btnBg: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500'
  },
  comemoracao: {
    label: 'Meta Batida / Comemoração',
    icon: PartyPopper,
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderGlow: 'border-emerald-500/60 shadow-[0_0_60px_rgba(16,185,129,0.35)]',
    cardHeader: 'from-emerald-600/30 via-teal-600/20 to-transparent',
    btnBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
  }
};

/**
 * 🚨 MODAL CENTRAL: Aparece EXATAMENTE NO MEIO DA TELA de todos os usuários logados
 */
export const CentralBroadcastAlert = ({ broadcast, onDismiss }) => {
  const btnRef = useRef(null);

  useEffect(() => {
    if (broadcast) {
      playBroadcastChime();
      btnRef.current?.focus();
    }
  }, [broadcast?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  if (!broadcast) return null;

  const typeConfig = BROADCAST_TYPES[broadcast.tipo] || BROADCAST_TYPES.comunicado;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div 
        className={`relative w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 border ${typeConfig.borderGlow} rounded-3xl p-6 sm:p-8 text-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        {/* Efeito Luminoso de Fundo */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Transmissão ao Vivo
              </span>
              <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${typeConfig.badgeBg}`}>
                <TypeIcon size={13} />
                {typeConfig.label}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
              <div className="flex items-center gap-1 font-bold text-sky-400">
                <ShieldCheck size={14} className="text-sky-400" />
                <span>{broadcast.autor || 'Carla (Diretoria)'}</span>
              </div>
              <span>•</span>
              <span>{broadcast.dataHora || 'Agora'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo da Mensagem no Centro */}
        <div className="py-6 sm:py-8 text-center space-y-4 relative z-10">
          <div className="inline-flex p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 text-white shadow-inner mx-auto mb-2">
            <TypeIcon size={36} className="text-pink-400 sm:w-11 sm:h-11" />
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-2 sm:px-4 py-1 custom-scrollbar">
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed tracking-tight whitespace-pre-wrap break-words drop-shadow-md">
              {broadcast.texto}
            </p>
          </div>
        </div>

        {/* Rodapé com Botão Grande de Confirmação */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <p className="text-[11px] text-slate-400 text-center sm:text-left">
            Mensagem oficial transmitida para todos os terminais logados.
          </p>

          <button
            ref={btnRef}
            type="button"
            onClick={onDismiss}
            className={`w-full sm:w-auto px-8 py-3.5 ${typeConfig.btnBg} text-white font-black text-sm rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer`}
          >
            <CheckCircle2 size={18} />
            <span>OK, Entendido!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 👑 PAINEL DA DIRETORIA (ADMIN): Onde somente o Administrador / Carla digita e transmite
 */
export const AdminBroadcastModal = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  onSendBroadcast, 
  broadcastHistory = [],
  onDeleteBroadcast,
  onRebroadcast
}) => {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('comunicado'); // 'comunicado', 'importante', 'urgente', 'comemoracao'
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  const EMOJIS = ['📢', '⚠️', '🚨', '🎉', '👏', '🎯', '👓', '💰', '⏰', '✅', '❤️', '🔥'];

  const handleInsertEmoji = (emoji) => {
    setTexto(prev => prev + emoji);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!texto.trim() || isSending) return;

    setIsSending(true);
    try {
      const now = new Date();
      const payload = {
        id: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        texto: texto.trim(),
        tipo: tipo,
        autor: currentUser?.name || currentUser?.username || 'Carla (Diretoria)',
        autorUsername: currentUser?.username || 'admin',
        autorRole: currentUser?.role || 'admin',
        timestamp: Date.now(),
        dataHora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dataCompleta: now.toLocaleDateString('pt-BR'),
        ativo: true
      };

      await onSendBroadcast(payload);
      playBroadcastChime();
      setTexto('');
      setSuccessToast('🚀 Comunicado transmitido no meio da tela de todos os computadores!');
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err) {
      console.error('Erro ao transmitir comunicado:', err);
      alert('Erro ao enviar comunicado: ' + (err.message || err));
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Central de Transmissão ao Vivo</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-mono">
                  Somente Diretoria
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Aparece instantaneamente no meio da tela de todos os usuários logados.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notificação de Sucesso */}
        {successToast && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {/* Seletor de Categoria / Estilo */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              Estilo da Notificação
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(BROADCAST_TYPES).map(([k, cfg]) => {
                const Icon = cfg.icon;
                const isSelected = tipo === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTipo(k)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left ${
                      isSelected 
                        ? `${cfg.badgeBg} border-white/40 shadow-md scale-[1.02]` 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{cfg.label.split('/')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo de Texto da Mensagem */}
          <form onSubmit={handleSend} className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-300">
                  Mensagem que aparecerá no meio da tela
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {texto.length} caracteres
                </span>
              </div>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Ex: Atenção equipe, reunião rápida às 16h! / Parabéns equipe pela meta batida! 🎉"
                rows={4}
                className="w-full px-4 py-3 bg-slate-950/80 border border-white/15 focus:border-purple-500 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none transition-all resize-none font-medium leading-relaxed"
                autoFocus
              />
            </div>

            {/* Inserção Rápida de Emojis */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-bold mr-1">Emojis rápidos:</span>
              {EMOJIS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleInsertEmoji(em)}
                  className="px-2 py-1 bg-white/5 hover:bg-white/15 rounded-lg text-sm border border-white/10 transition-all active:scale-90"
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Botão de Envio */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTexto('')}
                disabled={!texto}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              >
                Limpar
              </button>
              <button
                type="submit"
                disabled={!texto.trim() || isSending}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                <Send size={15} />
                <span>{isSending ? 'Transmitindo...' : 'Transmitir para Todo Mundo'}</span>
              </button>
            </div>
          </form>

          {/* Histórico de Comunicados Anteriores */}
          <div className="pt-4 border-t border-white/10 space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio size={14} className="text-purple-400" />
              <span>Transmissões Anteriores ({broadcastHistory.length})</span>
            </h4>

            {broadcastHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center italic">
                Nenhum comunicado transmitido ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {broadcastHistory.map(item => {
                  const cfg = BROADCAST_TYPES[item.tipo] || BROADCAST_TYPES.comunicado;
                  const Icon = cfg.icon;
                  return (
                    <div 
                      key={item.id} 
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.badgeBg} flex items-center gap-1`}>
                            <Icon size={11} />
                            {cfg.label.split('/')[0]}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.dataHora} • {item.dataCompleta}
                          </span>
                        </div>
                        <p className="text-slate-200 font-medium whitespace-pre-wrap">
                          {item.texto}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        {onRebroadcast && (
                          <button
                            type="button"
                            onClick={() => onRebroadcast(item)}
                            className="p-1.5 bg-white/5 hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 rounded-lg transition-all"
                            title="Re-transmitir agora no meio da tela"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        {onDeleteBroadcast && (
                          <button
                            type="button"
                            onClick={() => onDeleteBroadcast(item.id)}
                            className="p-1.5 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                            title="Excluir comunicado"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 📜 MURAL DE AVISOS: Modal Leitor para todos os usuários consultarem comunicados anteriores
 */
export const BroadcastHistoryModal = ({ 
  isOpen, 
  onClose, 
  broadcastHistory = [],
  onOpenAdminBroadcast,
  canBroadcast
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-7 max-w-xl w-full shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Mural de Comunicados da Diretoria
              </h3>
              <p className="text-xs text-slate-400">
                Histórico de mensagens transmitidas para a equipe
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {broadcastHistory.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Megaphone size={36} className="mx-auto text-slate-600" />
              <p className="text-sm font-bold text-slate-400">
                Nenhum comunicado recente
              </p>
              <p className="text-xs text-slate-500">
                Assim que a Carla ou administrador transmitir um comunicado, ele aparecerá aqui e no meio da tela.
              </p>
            </div>
          ) : (
            broadcastHistory.map((item, idx) => {
              const cfg = BROADCAST_TYPES[item.tipo] || BROADCAST_TYPES.comunicado;
              const Icon = cfg.icon;
              return (
                <div 
                  key={item.id || idx}
                  className={`p-4 rounded-2xl bg-white/[0.03] border ${cfg.badgeBg.includes('rose') ? 'border-rose-500/30' : 'border-white/10'} space-y-2 text-xs`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.badgeBg} flex items-center gap-1`}>
                      <Icon size={12} />
                      {cfg.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {item.dataHora || 'Horário'} • {item.dataCompleta || ''}
                    </span>
                  </div>

                  <p className="text-sm text-white font-medium whitespace-pre-wrap leading-relaxed">
                    {item.texto}
                  </p>

                  <div className="pt-1 flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
                    <ShieldCheck size={13} className="text-sky-400" />
                    <span>Transmitido por: {item.autor || 'Carla (Diretoria)'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
          {canBroadcast ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminBroadcast();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <Megaphone size={14} />
              <span>Nova Transmissão</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
