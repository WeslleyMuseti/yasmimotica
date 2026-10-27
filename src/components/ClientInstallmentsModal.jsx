import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Table2, Calendar, Filter, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import DataTable from './DataTable';
import {
  filterInstallmentsByDateRange,
  normalizeInstallmentDateIso,
  parseCurrencyValue
} from './ReparcelamentoOSModal';

const formatBRL = (val) =>
  Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ClientInstallmentsModal = ({
  isOpen,
  onClose,
  clientName,
  rows = [],
  onRowUpdate,
  onDeleteRow,
  onOpenReparcelamento,
  currentUser
}) => {
  const [periodMode, setPeriodMode] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateField, setDateField] = useState('VENCIMENTO');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredRows = useMemo(() => {
    return filterInstallmentsByDateRange(
      rows,
      {
        startDate,
        endDate,
        periodMode,
        dateField,
        statusFilter
      },
      todayIso
    );
  }, [rows, startDate, endDate, periodMode, dateField, statusFilter, todayIso]);

  const modalStats = useMemo(() => {
    let pendente = 0;
    let vencido = 0;
    let pago = 0;
    let countVencidas = 0;

    filteredRows.forEach(r => {
      const st = String(r.STATUS || r.status || 'Pendente').trim().toLowerCase();
      const val = parseCurrencyValue(r.VALOR || r.valor || r['VALOR PARCELA']);
      const dueIso = normalizeInstallmentDateIso(
        r.DATA_VENCIMENTO || r['DATA VENCIMENTO'] || r.VENCIMENTO || r.data_vencimento || ''
      );
      if (['recebido', 'pago', 'liquidado'].includes(st)) {
        pago += val;
      } else if (!['cancelado', 'cancelada', 'reparcelado', 'substituido'].includes(st)) {
        pendente += val;
        if ((dueIso && dueIso <= todayIso) || ['atrasado', 'inadimplente', 'vencido'].includes(st)) {
          vencido += val;
          countVencidas++;
        }
      }
    });

    return {
      totalCount: filteredRows.length,
      pendente,
      vencido,
      pago,
      countVencidas
    };
  }, [filteredRows, todayIso]);

  if (!isOpen) return null;

  const hasActiveFilter =
    periodMode !== 'ALL' || Boolean(startDate) || Boolean(endDate) || statusFilter !== 'ALL';

  const handleClearFilters = () => {
    setPeriodMode('ALL');
    setStartDate('');
    setEndDate('');
    setDateField('VENCIMENTO');
    setStatusFilter('ALL');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          className="relative glass-card bg-slate-900/95 border border-sky-500/30 shadow-[0_25px_70px_-15px_rgba(14,165,233,0.28)] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Ambient Decorative Glows */}
          <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl" />

          {/* Header */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-white/10 bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-indigo-950/50">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500/25 to-indigo-500/25 flex items-center justify-center border border-sky-500/40 shadow-lg shadow-sky-500/10">
                <Table2 size={22} className="text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-black uppercase tracking-widest">
                    Financeiro ERP • Boleto
                  </span>
                  {modalStats.countVencidas > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase flex items-center gap-1">
                      <AlertTriangle size={11} /> {modalStats.countVencidas} Vencida(s)
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mt-0.5">
                  Mensalidades &amp; Boletos — <span className="text-sky-400">{clientName}</span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {onOpenReparcelamento && (
                <button
                  type="button"
                  onClick={() => {
                    const firstPending = rows.find(r => {
                      const st = String(r.STATUS || r.status || 'Pendente').trim().toLowerCase();
                      return !['recebido', 'pago', 'liquidado', 'cancelado', 'cancelada', 'reparcelado', 'substituido'].includes(st);
                    }) || rows[0] || { CLIENTE: clientName };
                    onOpenReparcelamento(firstPending);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
                  title="Abrir Módulo de Reparcelamento de OS para este cliente"
                >
                  <RefreshCw size={14} />
                  <span>Reparcelar OS / Saldo</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/10 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Barra Elegante de Filtro de Datas da Parcela + KPIs */}
          <div className="relative z-10 px-5 py-3.5 border-b border-white/10 bg-slate-950/60 space-y-3">
            {/* Resumo Rápido */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Parcelas Exibidas</span>
                  <span className="text-sm font-black text-white">{modalStats.totalCount} de {rows.length}</span>
                </div>
                <Calendar size={16} className="text-sky-400 opacity-80" />
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-300/80 block">Saldo em Aberto</span>
                  <span className="text-sm font-black text-amber-300">{formatBRL(modalStats.pendente)}</span>
                </div>
                <Clock size={16} className="text-amber-400 opacity-80" />
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-rose-300/80 block">Vencido / Hoje</span>
                  <span className="text-sm font-black text-rose-300">{formatBRL(modalStats.vencido)}</span>
                </div>
                <AlertTriangle size={16} className="text-rose-400 opacity-80" />
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">Total Recebido</span>
                  <span className="text-sm font-black text-emerald-300">{formatBRL(modalStats.pago)}</span>
                </div>
                <CheckCircle2 size={16} className="text-emerald-400 opacity-80" />
              </div>
            </div>

            {/* Controles de Filtro por Data da Parcela */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1 mr-1">
                  <Filter size={12} /> Período da Parcela:
                </span>
                {[
                  { id: 'ALL', label: 'Todas' },
                  { id: 'OVERDUE', label: '⚠️ Vencidas' },
                  { id: 'TODAY', label: 'Hoje' },
                  { id: 'NEXT_7_DAYS', label: 'Próx. 7 Dias' },
                  { id: 'THIS_MONTH', label: 'Mês Atual' },
                  { id: 'CUSTOM', label: '📅 Datas Personalizadas' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPeriodMode(p.id);
                      if (p.id !== 'CUSTOM') {
                        setStartDate('');
                        setEndDate('');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all border cursor-pointer ${
                      periodMode === p.id
                        ? 'bg-sky-500/25 text-white border-sky-400 shadow-sm shadow-sky-500/20'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">De:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      if (e.target.value) setPeriodMode('CUSTOM');
                    }}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Até:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      if (e.target.value) setPeriodMode('CUSTOM');
                    }}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <select
                  value={dateField}
                  onChange={e => setDateField(e.target.value)}
                  className="bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-sky-500"
                  title="Campo de data utilizado na filtragem"
                >
                  <option value="VENCIMENTO">Data de Vencimento</option>
                  <option value="PAGAMENTO">Data de Pagamento</option>
                  <option value="CADASTRO">Data de Cadastro</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-sky-500"
                  title="Filtrar por status da parcela"
                >
                  <option value="ALL">Status: Todos</option>
                  <option value="PENDING">Apenas Pendentes</option>
                  <option value="OVERDUE">Apenas Vencidas</option>
                  <option value="PAID">Apenas Pagas</option>
                </select>

                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-black transition-all cursor-pointer"
                  >
                    Limpar ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content - DataTable */}
          <div className="relative z-10 flex-1 overflow-auto p-4 sm:p-5 custom-scrollbar">
            <DataTable
              sheetName="CONTAS_RECEBER"
              rows={filteredRows}
              onRowUpdate={onRowUpdate}
              onDeleteRow={onDeleteRow}
              onReparcelarOS={onOpenReparcelamento}
              currentUser={currentUser}
              allowEdit={true}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClientInstallmentsModal;
