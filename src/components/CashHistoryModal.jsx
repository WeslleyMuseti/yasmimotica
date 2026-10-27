import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, Calendar, Clock, User, Building, DollarSign, 
  ArrowDownRight, ArrowUpRight, Lock, Unlock, ShoppingCart, 
  Printer, Search, Filter, RefreshCw, X, Download, ShieldCheck,
  AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, FileCode,
  Edit2, Save, Trash2, FileText
} from 'lucide-react';
import { PrintableCashVoucher } from './CashManagementModal';
import PrintableCashClosingReport from './PrintableCashClosingReport';
import { buildCashHistoryXml, downloadXmlFile } from '../xmlUtils';
import * as XLSX from 'xlsx';

const formatCurrency = (val) => {
  const n = typeof val === 'number' ? val : parseCurrency(val);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const cleanBoletoDisplay = (val) => {
  if (!val) return '';
  return String(val)
    .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
};

const parseCurrency = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
      str = parts.join('');
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const parseItemDate = (item) => {
  if (!item) return null;
  const raw = item.dataHora || item.timestamp || item.DATA || item['DATA  DA VENDA'] || item['DATA DA VENDA'] || item.DATA_HORA || item.dataHoraAbertura || item.dataHoraFechamento || item.data;
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split(' ')[0].split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d);
        if (trimmed.includes(':')) {
          const timeParts = trimmed.split(' ')[1]?.split(':') || [];
          if (timeParts.length >= 2) {
            dateObj.setHours(parseInt(timeParts[0], 10) || 0, parseInt(timeParts[1], 10) || 0, parseInt(timeParts[2], 10) || 0);
          }
        }
        return isNaN(dateObj.getTime()) ? null : dateObj;
      }
    }
    if (trimmed.includes('-') && !trimmed.includes('T')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d, 12, 0, 0);
        return isNaN(dateObj.getTime()) ? null : dateObj;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof raw === 'number') {
    if (raw > 1000000000000) return new Date(raw);
    if (raw > 20000 && raw < 80000) {
      return new Date((raw - (25567 + 2)) * 86400 * 1000);
    }
  }
  return null;
};

const formatDate = (dateVal) => {
  if (!dateVal) return '---';
  try {
    const d = dateVal instanceof Date ? dateVal : parseItemDate({ dataHora: dateVal });
    if (!d || isNaN(d.getTime())) return String(dateVal);
    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hasTime = typeof dateVal === 'string' ? dateVal.includes(':') : true;
    if (hasTime) {
      return dateStr + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return dateStr;
  } catch (e) {
    return String(dateVal);
  }
};

const toDateTimeLocalValue = (dateVal) => {
  if (!dateVal) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const d = dateVal instanceof Date ? dateVal : parseItemDate({ dataHora: dateVal });
  if (!d || isNaN(d.getTime())) {
    const fallback = new Date(dateVal);
    if (!isNaN(fallback.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}T${pad(fallback.getHours())}:${pad(fallback.getMinutes())}`;
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── MODAL DE EDIÇÃO DE MOVIMENTAÇÃO DE CAIXA / HISTÓRICO ─────────
export const EditCashMovementModal = ({
  isOpen,
  onClose,
  movement,
  onSave,
  onDelete
}) => {
  if (!isOpen || !movement) return null;

  const [tipo, setTipo] = useState(() => (movement.tipo || 'MOVIMENTO').toUpperCase());
  const [dataHora, setDataHora] = useState(() => toDateTimeLocalValue(movement.dataHora || movement.DATA));
  const [valor, setValor] = useState(() => formatCurrency(movement.valor || 0));
  const [unidade, setUnidade] = useState(() => movement.unidade || movement.loja || 'Cajati');
  const [operador, setOperador] = useState(() => movement.operador || 'Caixa');
  const [formaPagamento, setFormaPagamento] = useState(() => movement.formaPagamento || 'DINHEIRO');
  const [motivo, setMotivo] = useState(() => movement.motivo || '');
  const [despesaCategoria, setDespesaCategoria] = useState(() => movement.despesaCategoria || '');
  const [detalhes, setDetalhes] = useState(() => movement.detalhes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (movement) {
      setTipo((movement.tipo || 'MOVIMENTO').toUpperCase());
      setDataHora(toDateTimeLocalValue(movement.dataHora || movement.DATA));
      setValor(formatCurrency(movement.valor || 0));
      setUnidade(movement.unidade || movement.loja || 'Cajati');
      setOperador(movement.operador || 'Caixa');
      setFormaPagamento(movement.formaPagamento || 'DINHEIRO');
      setMotivo(movement.motivo || '');
      setDespesaCategoria(movement.despesaCategoria || '');
      setDetalhes(movement.detalhes || '');
    }
  }, [movement]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        tipo,
        dataHora,
        valor,
        unidade,
        operador,
        formaPagamento,
        motivo,
        despesaCategoria,
        detalhes
      });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar edição de movimentação:', err);
      alert('Erro ao salvar alterações: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm(`Tem certeza que deseja excluir este lançamento de ${tipo} de R$ ${valor}? Esta ação não pode ser desfeita.`)) {
      setIsSaving(true);
      try {
        await onDelete(movement);
        onClose();
      } catch (err) {
        console.error('Erro ao excluir movimentação:', err);
        alert('Erro ao excluir registro: ' + (err.message || 'Tente novamente'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b1120] border border-blue-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto erp-scroll text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Edit2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Editar Lançamento de Caixa
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Atualize data, horário, valor, motivo ou loja no histórico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Data e Horário */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-400" /> Data e Horário da Movimentação
            </label>
            <input
              type="datetime-local"
              required
              value={dataHora}
              onChange={e => setDataHora(e.target.value)}
              className="w-full bg-black/40 border border-blue-500/40 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-400 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                Tipo de Lançamento
              </label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
              >
                <option value="ABERTURA">🔓 Abertura de Caixa</option>
                <option value="SANGRIA">💸 Sangria de Caixa</option>
                <option value="SUPRIMENTO">📥 Suprimento de Troco</option>
                <option value="FECHAMENTO">🔒 Fechamento Z</option>
                <option value="RECEBIMENTO">🎟️ Recebimento de Parcela</option>
                <option value="VENDA">🛒 Venda PDV / OS</option>
                <option value="SAÍDA">🧾 Despesa / Saída</option>
              </select>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <DollarSign size={14} /> Valor (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">R$</span>
                <input
                  type="text"
                  required
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-black/40 border border-emerald-500/40 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono font-black focus:outline-none focus:border-emerald-400 shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Unidade / Loja */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building size={14} className="text-purple-400" /> Loja / Unidade
              </label>
              <select
                value={unidade}
                onChange={e => setUnidade(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-purple-500"
              >
                <option value="Cajati">Cajati</option>
                <option value="Registro">Registro</option>
                <option value="Jacupiranga">Jacupiranga</option>
                <option value="Venda Externa">Venda Externa</option>
                <option value="Central">Central</option>
              </select>
            </div>

            {/* Operador */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <User size={14} className="text-slate-400" /> Operador / Vendedor
              </label>
              <input
                type="text"
                value={operador}
                onChange={e => setOperador(e.target.value)}
                placeholder="Nome do operador"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300">
              Forma de Pagamento
            </label>
            <input
              type="text"
              value={formaPagamento}
              onChange={e => setFormaPagamento(e.target.value)}
              placeholder="DINHEIRO, PIX, CARTÃO..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Motivo / Descrição */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300">
              Motivo / Descrição Principal
            </label>
            <input
              type="text"
              required
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Recolhimento de Sangria, Suprimento de Troco..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Categoria de Despesa se for SANGRIA ou SAÍDA */}
          {(tipo === 'SANGRIA' || tipo === 'SAÍDA' || tipo === 'SAIDA') && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-400">
                Categoria da Despesa (Contas a Pagar)
              </label>
              <input
                type="text"
                value={despesaCategoria}
                onChange={e => setDespesaCategoria(e.target.value)}
                placeholder="Ex: Motoboy, Limpeza, Café..."
                className="w-full bg-black/40 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          )}

          {/* Detalhes / Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">
              Observações / Detalhes Adicionais
            </label>
            <textarea
              rows={2}
              value={detalhes}
              onChange={e => setDetalhes(e.target.value)}
              placeholder="Informações adicionais sobre este lançamento..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 resize-none"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Excluir este lançamento do histórico"
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Save size={15} />
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

export const CashHistoryContent = ({ 
  cashMovements = [], 
  salesData = [],
  receberData = [],
  defaultUnit = 'Todas',
  currentUser = null,
  onPrint = null,
  onUpdateRow = null,
  onDeleteRow = null
}) => {
  const userCity = currentUser?.role === 'vendedor' ? (currentUser.city || currentUser.assignedStore || 'Cajati') : null;
  const isAdmin = ['admin', 'administrador', 'administrativo'].includes(String(currentUser?.role || '').toLowerCase()) || 
                  currentUser?.username === 'wmusete' || 
                  currentUser?.role === 'gerente';

  const [selectedUnit, setSelectedUnit] = useState(() => userCity || defaultUnit);

  useEffect(() => {
    if (userCity) {
      setSelectedUnit(userCity);
    }
  }, [userCity]);

  const [selectedType, setSelectedType] = useState('TODOS');
  const [selectedPeriod, setSelectedPeriod] = useState('TODOS');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [localPrintData, setLocalPrintData] = useState(null);
  const [pdfReportData, setPdfReportData] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Unificar os movimentos registrados em FLUXO_CAIXA + Vendas do Sistema
  const allMovements = useMemo(() => {
    const cleanId = (id) => String(id || '').replace(/^#|^os[-_ ]?/i, '').trim().toLowerCase();
    const normStr = (v) => String(v || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // Índice rápido de vendas/OS em salesData para enriquecer e vincular o FLUXO_CAIXA
    const salesById = new Map();
    const salesByOs = new Map();
    const salesByClientDate = new Map();

    if (Array.isArray(salesData)) {
      salesData.forEach(s => {
        if (!s || typeof s !== 'object') return;
        const sId = cleanId(s.id || s._id || s['ID'] || s.saleId || s.sale_id);
        const sOs = cleanId(s['OS DA VENDA'] || s['Nº DA OS'] || s['OS'] || s['Num OS']);
        const sCli = normStr(s['CLIENTE'] || s['NOME DO CLIENTE'] || s['Cliente']);
        const sDateRaw = String(s['DATA  DA VENDA'] || s['DATA DA VENDA'] || s['DATA'] || s.data || '').slice(0, 10);
        if (sId) salesById.set(sId, s);
        if (sOs) salesByOs.set(sOs, s);
        if (sCli && sDateRaw) salesByClientDate.set(`${sCli}|${sDateRaw}`, s);
      });
    }

    let list = Array.isArray(cashMovements)
      ? cashMovements
          .filter(m => {
            if (!m || typeof m !== 'object') return false;
            const textPool = normStr(`${m.motivo || ''} ${m.detalhes || ''} ${m.cliente || ''}`);
            // Ignora registros fantasmas de teste da Stephanie Museti e Ingrid Pereira sem OS
            if (textPool.includes('stephanie') && (textPool.includes('museti') || textPool.includes('musete'))) return false;
            if (textPool.includes('ingrid pereira') && !m.osNumero && !textPool.includes('os #')) return false;
            return true;
          })
          .map((m, idx) => {
            const tipo = String(m.tipo || m.TIPO || '').toUpperCase();
            let enriched = {
              ...m,
              id: m.id || `fc_${idx}_${m.dataHora || ''}_${m.valor || ''}`,
              _source: 'FLUXO_CAIXA',
              rawItem: m
            };

            if (tipo === 'VENDA') {
              const mSaleId = cleanId(m.saleId || m.id);
              const mOs = cleanId(m.osNumero || m['OS DA VENDA'] || m['OS']);
              const mDateStr = String(m.data || m.DATA || m.dataHora || '').slice(0, 10);
              const mClientFromMotivo = normStr(
                m.cliente || m.CLIENTE ||
                String(m.motivo || '').replace(/^venda\s+os\s*#[a-z0-9-]+\s*-\s*/i, '').replace(/^venda\s+pdv\s*-\s*/i, '').replace(/\s*\(.*\)$/, '')
              );

              const matchedSale =
                (mSaleId && salesById.get(mSaleId)) ||
                (mOs && salesByOs.get(mOs)) ||
                (mClientFromMotivo && mDateStr && salesByClientDate.get(`${mClientFromMotivo}|${mDateStr}`)) ||
                null;

              if (matchedSale) {
                const realOs = matchedSale['OS DA VENDA'] || matchedSale['Nº DA OS'] || matchedSale['OS'] || m.osNumero || '';
                const totalOS = parseCurrency(matchedSale['VALOR TOTAL'] ?? matchedSale['VALOR_TOTAL'] ?? matchedSale['VALOR DA VENDA'] ?? matchedSale['VALOR'] ?? m.valor);
                const entradaOS = parseCurrency(matchedSale['VALOR ENTRADA'] ?? matchedSale['ENTRADA'] ?? m.valor);
                const restanteOS = parseCurrency(matchedSale['RESTANTE'] ?? matchedSale['VALOR RESTANTE'] ?? 0);
                const cliName = matchedSale['CLIENTE'] || matchedSale['NOME DO CLIENTE'] || m.cliente || '';
                const formaEnt = matchedSale['FORMA_ENTRADA'] || matchedSale['formaPagamentoEntrada'] || m.formaEntradaOS || '';
                const formaRest = matchedSale['FORMA_RESTANTE'] || matchedSale['formaPagamentoRestante'] || m.formaRestanteOS || '';

                enriched = {
                  ...enriched,
                  osNumero: realOs || enriched.osNumero,
                  saleId: matchedSale.id || enriched.saleId,
                  cliente: cliName || enriched.cliente,
                  valorTotalOS: totalOS,
                  valorEntradaOS: entradaOS,
                  valorRestanteBoleto: restanteOS,
                  formaEntradaOS: formaEnt,
                  formaRestanteOS: formaRest
                };
              }
            }
            return enriched;
          })
      : [];
    
    // Identificar vendas e recebimentos já presentes no fluxo de caixa para evitar duplicar
    const existingSalesIds = new Set();
    const existingClientDateKeys = new Set();

    list.forEach(m => {
      const tipo = (m.tipo || '').toUpperCase();
      if (tipo === 'VENDA' || tipo === 'RECEBIMENTO') {
        if (m.id) {
          existingSalesIds.add(String(m.id).trim().toLowerCase());
          existingSalesIds.add(cleanId(m.id));
        }
        if (m.saleId) {
          existingSalesIds.add(String(m.saleId).trim().toLowerCase());
          existingSalesIds.add(cleanId(m.saleId));
        }
        if (m.osNumero) {
          existingSalesIds.add(String(m.osNumero).trim().toLowerCase());
          existingSalesIds.add(cleanId(m.osNumero));
        }
        if (m['OS']) {
          existingSalesIds.add(String(m['OS']).trim().toLowerCase());
          existingSalesIds.add(cleanId(m['OS']));
        }
        if (m['OS DA VENDA']) {
          existingSalesIds.add(String(m['OS DA VENDA']).trim().toLowerCase());
          existingSalesIds.add(cleanId(m['OS DA VENDA']));
        }
        if (tipo === 'VENDA') {
          const cli = normStr(
            m.cliente || m.CLIENTE ||
            String(m.motivo || '').replace(/^venda\s+os\s*#[a-z0-9-]+\s*-\s*/i, '').replace(/^venda\s+pdv\s*-\s*/i, '').replace(/\s*\(.*\)$/, '')
          );
          const dtStr = String(m.data || m.DATA || m.dataHora || '').slice(0, 10);
          if (cli && dtStr) {
            existingClientDateKeys.add(`${cli}|${dtStr}`);
          }
        }
      }
    });

    // Integrar vendas/OS de salesData se existirem e ainda não estiverem em FLUXO_CAIXA
    if (Array.isArray(salesData) && salesData.length > 0) {
      salesData.forEach((s, idx) => {
        if (!s || typeof s !== 'object') return;

        // Ignorar OS secundária de Multi-OS (faturamento unificado na principal)
        if (s.MULTI_OS_PRINCIPAL === false || s.isSecondaryOS === true || s.FATURAMENTO_UNIFICADO === 'SECUNDARIA') {
          return;
        }

        // Ignorar se for quitação de parcela ou recebimento de boleto/mensalidade (já registrado em FLUXO_CAIXA como RECEBIMENTO)
        const prod = String(s['PRODUTO'] || s['SERVIÇO'] || s['Produto'] || '').toLowerCase();
        const sTipo = String(s.tipo || s.TIPO || '').toUpperCase();
        if (prod.includes('recebimento') || prod.includes('mensalidade') || prod.includes('carnê') || prod.includes('carne') || prod.includes('boleto') || sTipo === 'RECEBIMENTO') {
          return;
        }

        const cliente = s['CLIENTE'] || s['NOME DO CLIENTE'] || s['Cliente'] || 'Consumidor Final';
        const normCli = normStr(cliente);
        const osRaw = String(s['OS DA VENDA'] || s['Nº DA OS'] || s['OS'] || s['Num OS'] || '').trim();
        const osNum = osRaw.toLowerCase();
        const cleanOsNum = cleanId(osNum);

        // Ignorar registros fantasmas de teste da Stephanie Museti e Ingrid Pereira sem OS
        if (normCli.includes('stephanie') && (normCli.includes('museti') || normCli.includes('musete'))) return;
        if (normCli.includes('ingrid pereira') && !osRaw) return;

        const rawId = String(s.id || s._id || s['ID'] || s.saleId || s.sale_id || '').trim().toLowerCase();
        const cleanRawId = cleanId(rawId);
        const sId = rawId || (osNum ? `os_${osNum}` : `venda_${idx}`);
        const cleanSId = cleanId(sId);
        const rawDate = s['DATA  DA VENDA'] || s['DATA DA VENDA'] || s['DATA'] || s['timestamp'] || s['data'] || s['Data'];
        const dtKey = `${normCli}|${String(rawDate || '').slice(0, 10)}`;

        const isDuplicate = (rawId && existingSalesIds.has(rawId)) ||
                            (cleanRawId && existingSalesIds.has(cleanRawId)) ||
                            (osNum && existingSalesIds.has(osNum)) ||
                            (cleanOsNum && existingSalesIds.has(cleanOsNum)) ||
                            existingSalesIds.has(sId) ||
                            (cleanSId && existingSalesIds.has(cleanSId)) ||
                            (normCli && String(rawDate || '').length >= 8 && existingClientDateKeys.has(dtKey));

        if (!isDuplicate) {
          const valorTotalOS = parseCurrency(s['VALOR TOTAL'] || s['VALOR DA VENDA'] || s['VALOR'] || s['VALOR_TOTAL'] || s['Valor'] || 0);
          const valorEntrada = parseCurrency(s['VALOR ENTRADA'] ?? s['ENTRADA'] ?? s['Sinal'] ?? 0);
          const valorRestante = parseCurrency(s['RESTANTE'] ?? s['VALOR RESTANTE'] ?? s['Restante'] ?? 0);

          if (valorTotalOS > 0 || valorEntrada > 0) {
            const loja = s['CIDADE'] || s['Loja'] || s['UNIDADE'] || s['loja'] || s['Cidade'] || 'Cajati';
            const vendedor = s['VENDEDOR'] || s['OPERADOR'] || s['Vendedor'] || 'Vendedor';
            const formaRaw = s['FORMAS_PAGAMENTO'] || s['FORMA_PAGTO'] || s['FORMA DE PAGAMENTO'] || s['MEIO_PAGAMENTO'] || s['FORMA'] || s['PAGAMENTO'] || s['Forma de Pagamento'] || 'Dinheiro';
            const forma = cleanBoletoDisplay(formaRaw);
            const formaEntradaExplicit = s['FORMA_ENTRADA'] || s['formaPagamentoEntrada'] || '';
            const formaRestanteExplicit = s['FORMA_RESTANTE'] || s['formaPagamentoRestante'] || '';
            const osDisplay = osRaw || (idx + 1);
            const produto = s['PRODUTO'] || s['SERVIÇO'] || s['Produto'] || 'Venda Balcão';

            // 🛡️ Se a venda/OS possui saldo parcelado no Boleto ou Restante a Prazo, o valor que entrou no caixa no ato é APENAS a Entrada!
            const hasBoleto = /boleto|carnê|carne|crediario|crediário/i.test(formaRaw) || valorRestante > 0;
            let valorCaixaImediato = valorTotalOS;
            let saldoBoleto = valorRestante;

            if (hasBoleto) {
              if (valorRestante > 0) {
                valorCaixaImediato = valorEntrada > 0 ? valorEntrada : Math.max(0, Number((valorTotalOS - valorRestante).toFixed(2)));
              } else if (valorEntrada > 0 && valorEntrada < valorTotalOS) {
                valorCaixaImediato = valorEntrada;
                saldoBoleto = Number((valorTotalOS - valorEntrada).toFixed(2));
              } else {
                // 100% Boleto sem entrada no ato
                valorCaixaImediato = 0;
                saldoBoleto = valorTotalOS;
              }
            }

            if (rawId) {
              existingSalesIds.add(rawId);
              if (cleanRawId) existingSalesIds.add(cleanRawId);
            }
            if (osNum) {
              existingSalesIds.add(osNum);
              if (cleanOsNum) existingSalesIds.add(cleanOsNum);
            }
            existingSalesIds.add(sId);
            if (cleanSId) existingSalesIds.add(cleanSId);
            if (normCli && String(rawDate || '').length >= 8) {
              existingClientDateKeys.add(dtKey);
            }

            // Se foi 100% a prazo sem entrada em caixa no ato, usa formaRestanteExplicit ou BOLETO (A PRAZO)
            // Se houve entrada no ato e FORMA_ENTRADA foi especificada, usa FORMA_ENTRADA para não contaminar a gaveta com método do Restante!
            const formaEfetivaCaixa = (hasBoleto && valorCaixaImediato === 0)
              ? (formaRestanteExplicit ? `${formaRestanteExplicit.toUpperCase()} (A PRAZO)` : 'BOLETO (A PRAZO)')
              : (formaEntradaExplicit || forma);

            const labelRestanteHist = formaRestanteExplicit && !/boleto|carnê|carne/i.test(formaRestanteExplicit)
              ? `Restante (${formaRestanteExplicit})`
              : 'Parcelado Boleto';

            const detalhesTexto = hasBoleto
              ? `OS #${osDisplay} • Cliente: ${cliente} • Total OS: R$ ${formatCurrency(valorTotalOS)} (Entrada: R$ ${formatCurrency(valorCaixaImediato)}${formaEntradaExplicit ? ` [${formaEntradaExplicit}]` : ''} | ${labelRestanteHist}: R$ ${formatCurrency(saldoBoleto)})`
              : `OS #${osDisplay} • Cliente: ${cliente} • Total OS: R$ ${formatCurrency(valorTotalOS)} (${forma})`;

            list.push({
              id: sId,
              saleId: rawId || sId,
              osNumero: osRaw || String(osDisplay),
              cliente,
              tipo: 'VENDA',
              unidade: loja,
              operador: vendedor,
              valor: valorCaixaImediato,
              valorTotalOS: valorTotalOS,
              valorEntradaOS: valorCaixaImediato,
              valorRestanteBoleto: saldoBoleto,
              formaEntradaOS: formaEntradaExplicit,
              formaRestanteOS: formaRestanteExplicit || (hasBoleto ? 'Boleto' : ''),
              formaPagamento: formaEfetivaCaixa,
              motivo: osRaw ? `Venda OS #${osRaw} - ${cliente}` : `Venda OS #${osDisplay} - ${produto}`,
              detalhes: detalhesTexto,
              dataHora: rawDate,
              DATA: rawDate,
              _source: 'Registro_Vendas',
              rawItem: s
            });
          }
        }
      });
    }

    // Ordenar do mais recente para o mais antigo
    return list.sort((a, b) => {
      const dateA = parseItemDate(a);
      const dateB = parseItemDate(b);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA;
    });
  }, [cashMovements, salesData]);

  // ─── SALVAR EDIÇÃO DE MOVIMENTO / DATA / VALOR ────────────────────
  const handleSaveMovementEdit = async (updatedFields) => {
    if (!editingMovement || !onUpdateRow) return;
    const targetSource = editingMovement._source || (editingMovement.rawItem && editingMovement.rawItem['PRODUTO'] ? 'Registro_Vendas' : 'FLUXO_CAIXA');
    const targetRaw = editingMovement.rawItem || editingMovement;

    const dt = updatedFields.dataHora ? new Date(updatedFields.dataHora) : new Date();
    const dateFormattedPtBR = dt.toLocaleDateString('pt-BR');
    const isoFormatted = dt.toISOString();

    if (targetSource === 'FLUXO_CAIXA') {
      const updatedMov = {
        ...targetRaw,
        dataHora: isoFormatted,
        data: dateFormattedPtBR,
        DATA: dateFormattedPtBR,
        tipo: updatedFields.tipo,
        valor: parseCurrency(updatedFields.valor),
        unidade: updatedFields.unidade,
        operador: updatedFields.operador,
        formaPagamento: updatedFields.formaPagamento,
        motivo: updatedFields.motivo,
        despesaCategoria: updatedFields.despesaCategoria || '',
        detalhes: updatedFields.detalhes || ''
      };
      await onUpdateRow('FLUXO_CAIXA', targetRaw, updatedMov);

      // 🛡️ Sincronizar com Registro_Vendas se este movimento de caixa estiver vinculado a uma venda/OS
      if ((targetRaw.saleId || targetRaw.osNumero) && Array.isArray(salesData)) {
        const matchingSale = salesData.find(s => 
          (targetRaw.saleId && (s.id === targetRaw.saleId || s.saleId === targetRaw.saleId)) ||
          (targetRaw.osNumero && (s['OS DA VENDA'] === targetRaw.osNumero || s['OS'] === targetRaw.osNumero))
        );
        if (matchingSale) {
          const updatedSale = {
            ...matchingSale,
            'DATA  DA VENDA': dateFormattedPtBR,
            'DATA DA VENDA': dateFormattedPtBR,
            'DATA': dateFormattedPtBR,
            'DATA_VENDA': dateFormattedPtBR,
            'Data da Venda': dateFormattedPtBR,
            dataHora: isoFormatted
          };
          await onUpdateRow('Registro_Vendas', matchingSale, updatedSale);
        }
      }

      // 🛡️ Sincronizar com CONTAS_RECEBER se este movimento for uma quitação de parcela
      if ((targetRaw.installmentId || targetRaw.parcelaId || String(targetRaw.tipo || '').toUpperCase() === 'RECEBIMENTO') && Array.isArray(receberData)) {
        const cleanOsTarget = targetRaw.osNumero ? String(targetRaw.osNumero).replace(/^#/, '').toLowerCase() : '';
        const matchingInstallment = receberData.find(inv => {
          if (!inv) return false;
          if (targetRaw.installmentId && inv.id === targetRaw.installmentId) return true;
          if (cleanOsTarget && String(inv.VENDA_OS || inv.OS || '').toLowerCase().includes(cleanOsTarget)) {
            const mDet = String(targetRaw.detalhes || targetRaw.motivo || '').toLowerCase();
            const doc = String(inv.DOCUMENTO || '').toLowerCase();
            if (doc && mDet.includes(doc)) return true;
          }
          return false;
        });

        if (matchingInstallment) {
          const updatedInv = {
            ...matchingInstallment,
            DATA_PAGAMENTO: dateFormattedPtBR,
            DATA_RECEBIMENTO: dateFormattedPtBR,
            data_pagamento: isoFormatted.split('T')[0],
            data_recebimento: isoFormatted.split('T')[0],
            dataPagamento: isoFormatted.split('T')[0]
          };
          await onUpdateRow('CONTAS_RECEBER', matchingInstallment, updatedInv);
        }
      }
    } else {
      // Registro_Vendas
      const updatedSale = {
        ...targetRaw,
        'DATA  DA VENDA': dateFormattedPtBR,
        'DATA DA VENDA': dateFormattedPtBR,
        'DATA': dateFormattedPtBR,
        'DATA_VENDA': dateFormattedPtBR,
        'Data da Venda': dateFormattedPtBR,
        dataHora: isoFormatted,
        'CIDADE': updatedFields.unidade,
        'UNIDADE': updatedFields.unidade,
        'Loja': updatedFields.unidade,
        'VENDEDOR': updatedFields.operador,
        'OPERADOR': updatedFields.operador,
        'VALOR TOTAL': parseCurrency(updatedFields.valor),
        'VALOR DA VENDA': parseCurrency(updatedFields.valor),
        'FORMA DE PAGAMENTO': updatedFields.formaPagamento
      };
      await onUpdateRow('Registro_Vendas', targetRaw, updatedSale);

      // 🛡️ Sincronizar com FLUXO_CAIXA se houver movimentos de caixa vinculados a esta venda
      if (Array.isArray(cashMovements)) {
        const matchingMovements = cashMovements.filter(m => 
          (targetRaw.id && m.saleId === targetRaw.id) ||
          (targetRaw['OS DA VENDA'] && m.osNumero === targetRaw['OS DA VENDA'])
        );
        for (const m of matchingMovements) {
          const updatedM = {
            ...m,
            dataHora: isoFormatted,
            data: dateFormattedPtBR,
            DATA: dateFormattedPtBR
          };
          await onUpdateRow('FLUXO_CAIXA', m, updatedM);
        }
      }
    }

    setEditingMovement(null);
  };

  const handleDeleteMovement = async (movToDelete) => {
    if (!movToDelete || !onDeleteRow) return;
    const targetSource = movToDelete._source || 'FLUXO_CAIXA';
    const targetRaw = movToDelete.rawItem || movToDelete;

    if (targetSource === 'FLUXO_CAIXA') {
      await onDeleteRow('FLUXO_CAIXA', targetRaw);
      // Se houver venda diretamente atrelada, verificar e sincronizar
      if (movToDelete.saleId && Array.isArray(salesData)) {
        const matchingSale = salesData.find(s => s.id === movToDelete.saleId || s.saleId === movToDelete.saleId);
        if (matchingSale) {
          await onDeleteRow('Registro_Vendas', matchingSale);
        }
      }
    } else {
      await onDeleteRow('Registro_Vendas', targetRaw);
      // Limpar também de FLUXO_CAIXA para o saldo bater com perfeição
      if (Array.isArray(cashMovements)) {
        const matchingMovements = cashMovements.filter(m => 
          (targetRaw.id && m.saleId === targetRaw.id) ||
          (targetRaw['OS DA VENDA'] && m.osNumero === targetRaw['OS DA VENDA'])
        );
        for (const m of matchingMovements) {
          await onDeleteRow('FLUXO_CAIXA', m);
        }
      }
    }

    const movId = movToDelete.id || `mov_${movToDelete._source}_${movToDelete.dataHora}_${movToDelete.valor}`;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(movId);
      return next;
    });

    setEditingMovement(null);
  };

  const handleToggleSelect = (movId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(movId)) next.delete(movId);
      else next.add(movId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredMovements.map((m, idx) => m.id || `mov_${idx}`);
    if (selectedIds.size === allFilteredIds.length && allFilteredIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size || !onDeleteRow) return;
    const count = selectedIds.size;
    const confirmed = window.confirm(
      `⚠️ ATENÇÃO ADMINISTRADOR:\n\nTem certeza que deseja EXCLUIR ${count} movimentação(ões) selecionada(s) do histórico financeiro?\n\nEsta operação removerá os lançamentos selecionados e o saldo do caixa será recalculado com precisão imediatamente.`
    );
    if (!confirmed) return;

    setIsDeletingBulk(true);
    try {
      const toDeleteList = filteredMovements.filter((mov, idx) => {
        const movId = mov.id || `mov_${idx}`;
        return selectedIds.has(movId);
      });

      for (const mov of toDeleteList) {
        await handleDeleteMovement(mov);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Erro ao excluir movimentações em lote:', err);
      alert('Erro ao excluir alguns dos registros selecionados.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Filtragem dos registros
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('pt-BR');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return allMovements.filter(item => {
      // 1. Filtro por Loja
      if (selectedUnit && selectedUnit !== 'Todas') {
        const itemUnit = String(item.unidade || item.CIDADE || item.LOJA || item.Cidade || '').trim().toLowerCase();
        const selUnit = String(selectedUnit).trim().toLowerCase();
        if (itemUnit && !itemUnit.includes(selUnit) && !selUnit.includes(itemUnit)) {
          return false;
        }
      }

      // 2. Filtro por Tipo de Ação
      if (selectedType !== 'TODOS') {
        const itemTipo = String(item.tipo || item.TIPO || '').toUpperCase();
        if (itemTipo !== selectedType) {
          return false;
        }
      }

      // 3. Filtro por Período
      if (selectedPeriod !== 'TODOS') {
        const itemDate = parseItemDate(item);
        if (!itemDate) {
          // Se não conseguir parsear a data mas tiver string de hoje
          const rawStr = String(item.dataHora || item.DATA || item.data || '');
          if (selectedPeriod === 'HOJE' && !rawStr.includes(todayStr)) return false;
          if (selectedPeriod === 'ONTEM' && !rawStr.includes(yesterdayStr)) return false;
          if (selectedPeriod === 'PERSONALIZADO') {
            if (customStartDate) {
              const [sy, sm, sd] = customStartDate.split('-');
              const brDate = `${sd}/${sm}/${sy}`;
              if (!rawStr.includes(customStartDate) && !rawStr.includes(brDate)) return false;
            }
          }
        } else {
          const itemDateStr = itemDate.toLocaleDateString('pt-BR');
          if (selectedPeriod === 'HOJE') {
            if (itemDateStr !== todayStr) return false;
          } else if (selectedPeriod === 'ONTEM') {
            if (itemDateStr !== yesterdayStr) return false;
          } else if (selectedPeriod === '7DIAS') {
            if (itemDate < sevenDaysAgo) return false;
          } else if (selectedPeriod === 'MES') {
            if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) return false;
          } else if (selectedPeriod === 'PERSONALIZADO') {
            if (customStartDate && customEndDate) {
              const [sy, sm, sd] = customStartDate.split('-').map(Number);
              const [ey, em, ed] = customEndDate.split('-').map(Number);
              let startD = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
              let endD = new Date(ey, em - 1, ed, 23, 59, 59, 999);
              if (startD > endD) {
                const temp = startD;
                startD = endD;
                endD = temp;
              }
              if (itemDate < startD || itemDate > endD) return false;
            } else if (customStartDate) {
              const [sy, sm, sd] = customStartDate.split('-').map(Number);
              const startD = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
              const endD = new Date(sy, sm - 1, sd, 23, 59, 59, 999);
              if (itemDate < startD || itemDate > endD) return false;
            } else if (customEndDate) {
              const [ey, em, ed] = customEndDate.split('-').map(Number);
              const endD = new Date(ey, em - 1, ed, 23, 59, 59, 999);
              if (itemDate > endD) return false;
            }
          }
        }
      }

      // 4. Busca Textual (Operador, Motivo, Categoria, Detalhes, Valor)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const searchPool = [
          item.operador, item.VENDEDOR, item.OPERADOR,
          item.motivo, item.MOTIVO,
          item.despesaCategoria, item.CATEGORIA,
          item.detalhes, item.DETALHES, item.OBSERVAÇÕES,
          item.unidade, item.CIDADE,
          item.tipo, item.formaPagamento,
          String(item.valor || '')
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchPool.includes(q)) return false;
      }

      return true;
    });
  }, [allMovements, selectedUnit, selectedType, selectedPeriod, customStartDate, customEndDate, searchTerm]);

  // Cálculos de Resumo Financeiro
  const metrics = useMemo(() => {
    let totalAberturas = 0;
    let totalSangrias = 0;
    let totalSuprimentos = 0;
    let totalRecebimentosDinheiro = 0;
    let totalSaidas = 0;
    let totalVendasDinheiro = 0;
    let totalPix = 0;
    let totalDebito = 0;
    let totalCredito = 0;
    let totalVendasGeral = 0;
    let totalFaturadoBoletoOS = 0;
    let vendasBoletoQtd = 0;
    let totalFechamentos = 0;
    const countedOsForBoleto = new Set();

    filteredMovements.forEach((item, idx) => {
      const v = parseCurrency(item.valor);
      const tipo = (item.tipo || item.TIPO || '').toUpperCase();
      const forma = String(item.formaPagamento || item['FORMA DE PAGAMENTO'] || '').toUpperCase();

      if (tipo === 'ABERTURA') {
        totalAberturas += v;
      } else if (tipo === 'SANGRIA') {
        totalSangrias += v;
      } else if (tipo === 'SUPRIMENTO') {
        totalSuprimentos += v;
      } else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'PAGAMENTO') {
        totalSaidas += v;
      } else if (tipo === 'RECEBIMENTO') {
        if (forma.includes('PIX')) {
          totalPix += v;
        } else if (forma.includes('DEBITO') || forma.includes('DÉBITO')) {
          totalDebito += v;
        } else if (forma.includes('CREDITO') || forma.includes('CRÉDITO') || forma.includes('CARTAO') || forma.includes('CARTÃO')) {
          totalCredito += v;
        } else {
          totalRecebimentosDinheiro += v;
        }
      } else if (tipo === 'VENDA') {
        totalVendasGeral += v;
        if (v > 0) {
          if (forma.includes('PIX')) {
            totalPix += v;
          } else if (forma.includes('DEBITO') || forma.includes('DÉBITO')) {
            totalDebito += v;
          } else if (forma.includes('CREDITO') || forma.includes('CRÉDITO') || forma.includes('CARTAO') || forma.includes('CARTÃO')) {
            totalCredito += v;
          } else if (
            forma.includes('DINHEIRO') ||
            (!forma.includes('BOLETO') && !forma.includes('CARNE') && !forma.includes('CARNÊ') && !forma.includes('PRAZO') && !forma.includes('COMBINAR'))
          ) {
            totalVendasDinheiro += v;
          }
        }

        const restBoleto = parseCurrency(item.valorRestanteBoleto || 0);
        const isPureBoletoMov = restBoleto === 0 && v > 0 && (forma.includes('BOLETO') || forma.includes('CARNE') || forma.includes('CARNÊ'));
        const boletoValToCount = restBoleto > 0 ? restBoleto : (isPureBoletoMov ? v : 0);

        if (boletoValToCount > 0) {
          const osKey = String(item.osNumero || item.saleId || item.id || `b_${idx}`).toLowerCase();
          if (!countedOsForBoleto.has(osKey)) {
            countedOsForBoleto.add(osKey);
            totalFaturadoBoletoOS += boletoValToCount;
            vendasBoletoQtd++;
          }
        }
      } else if (tipo === 'FECHAMENTO') {
        totalFechamentos++;
      }
    });

    const totalRecebidosCaixa = totalVendasDinheiro + totalRecebimentosDinheiro + totalPix + totalDebito + totalCredito;
    const saldoEstimadoGaveta = Math.max(0, (totalAberturas + totalSuprimentos + totalVendasDinheiro + totalRecebimentosDinheiro) - totalSangrias - totalSaidas);

    return {
      count: filteredMovements.length,
      fundoInicial: totalAberturas,
      totalAberturas,
      totalSangrias,
      totalSuprimentos,
      totalRecebimentosDinheiro,
      totalSaidas,
      totalVendasDinheiro,
      totalPix,
      totalDebito,
      totalCredito,
      totalRecebidosCaixa,
      totalVendasGeral,
      totalFaturadoBoletoOS,
      vendasBoletoQtd,
      saldoEstimadoGaveta,
      totalFechamentos
    };
  }, [filteredMovements]);

  // Disparo de Impressão de Comprovante (2ª Via)
  const handleReprint = (mov) => {
    setPdfReportData(null);
    const payload = {
      type: mov.tipo || 'SANGRIA',
      data: mov,
      unit: mov.unidade || selectedUnit || 'Cajati',
      operator: mov.operador || currentUser?.username || 'Caixa'
    };

    if (onPrint) {
      onPrint(payload);
    } else {
      setLocalPrintData(payload);
      setTimeout(() => {
        window.print();
      }, 250);
    }
  };

  // Exportar histórico diretamente em formato nativo Excel (.xlsx) que abre no Excel Online, Google Planilhas e Celular
  const handleExportExcel = () => {
    if (filteredMovements.length === 0) {
      alert('Nenhum registro para exportar com os filtros atuais.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const rows = filteredMovements.map((mov, index) => {
      const parsedD = parseItemDate(mov);
      const dataHoraFormatted = parsedD ? parsedD.toLocaleString('pt-BR') : (mov.dataHora || mov.DATA || '---');
      const tipo = (mov.tipo || mov.TIPO || 'MOVIMENTO').toUpperCase();
      const valNum = typeof mov.valor === 'number' ? mov.valor : parseCurrency(mov.valor);

      return {
        'Nº': index + 1,
        'Data e Hora': dataHoraFormatted,
        'Loja / Unidade': mov.unidade || mov.CIDADE || mov.LOJA || selectedUnit || 'Todas',
        'Operador Responsável': mov.operador || mov.VENDEDOR || mov.OPERADOR || 'Caixa',
        'Operação': tipo,
        'Forma de Pagamento': cleanBoletoDisplay(mov.formaPagamento || mov['FORMA DE PAGAMENTO'] || '---'),
        'Valor (R$)': valNum,
        'Motivo / Justificativa': mov.motivo || mov.MOTIVO || '',
        'Categoria Despesa': mov.despesaCategoria || mov.CATEGORIA || '',
        'Cliente / OS': mov.cliente || mov.CLIENTE || mov.osNumero || mov['OS DA VENDA'] || '',
        'Observações': mov.detalhes || mov.DETALHES || mov.OBSERVAÇÕES || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 30 },
      { wch: 20 },
      { wch: 25 },
      { wch: 35 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Caixa');
    XLSX.writeFile(wb, `Historico_Caixa_${selectedUnit || 'Todas'}_${todayStr}.xlsx`);
  };

  // Gerar e Imprimir Relatório Oficial de Fechamento de Caixa com Movimentações em PDF A4
  const handlePrintPdfReport = () => {
    if (filteredMovements.length === 0) {
      alert('Nenhuma movimentação para emitir o relatório no período selecionado.');
      return;
    }

    let periodoLabel = 'Histórico Completo';
    if (selectedPeriod === 'HOJE') {
      periodoLabel = `Hoje (${new Date().toLocaleDateString('pt-BR')})`;
    } else if (selectedPeriod === 'ONTEM') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      periodoLabel = `Ontem (${y.toLocaleDateString('pt-BR')})`;
    } else if (selectedPeriod === '7DIAS') {
      periodoLabel = 'Últimos 7 Dias';
    } else if (selectedPeriod === 'MES') {
      periodoLabel = 'Mês Atual';
    } else if (selectedPeriod === 'PERSONALIZADO') {
      if (customStartDate && customEndDate) {
        const [sy, sm, sd] = customStartDate.split('-');
        const [ey, em, ed] = customEndDate.split('-');
        periodoLabel = `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;
      } else if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split('-');
        periodoLabel = `${sd}/${sm}/${sy}`;
      }
    }

    const unit = selectedUnit || 'Todas as Lojas';

    const closingData = {
      unidade: unit,
      operador: currentUser?.username || 'Gerência / Supervisão',
      dataAbertura: periodoLabel,
      dataFechamento: new Date().toLocaleString('pt-BR'),
      fundoInicial: metrics.fundoInicial,
      vendasDinheiro: metrics.totalVendasDinheiro,
      totalRecebimentosDinheiro: metrics.totalRecebimentosDinheiro,
      vendasPix: metrics.totalPix,
      vendasDebito: metrics.totalDebito,
      vendasCredito: metrics.totalCredito,
      totalRecebidosCaixa: metrics.totalRecebidosCaixa,
      vendasBoletoTotal: metrics.totalFaturadoBoletoOS,
      vendasBoletoQtd: metrics.vendasBoletoQtd,
      totalEntradasEspecie: metrics.totalVendasDinheiro + metrics.totalRecebimentosDinheiro + metrics.totalSuprimentos,
      totalSangrias: metrics.totalSangrias,
      totalSaidas: metrics.totalSaidas,
      totalSuprimentos: metrics.totalSuprimentos,
      dinheiroEsperado: metrics.saldoEstimadoGaveta,
      dinheiroContado: metrics.saldoEstimadoGaveta,
      diferenca: 0,
      observacoes: `Relatório oficial de movimentações e fechamento gerado em ${new Date().toLocaleString('pt-BR')} para a unidade ${unit}.`
    };

    const reportTitle = `RELATÓRIO DE CAIXA & MOVIMENTAÇÕES • ${unit.toUpperCase()}`;
    setLocalPrintData(null);

    if (onPrint) {
      setPdfReportData(null);
      onPrint({
        type: 'PDF_REPORT',
        closingData,
        movements: filteredMovements,
        storeName: unit,
        periodLabel: periodoLabel,
        title: reportTitle,
        reportTitle
      });
    } else {
      setPdfReportData({
        closingData,
        movements: filteredMovements,
        storeName: unit,
        periodLabel: periodoLabel,
        title: reportTitle,
        reportTitle
      });

      setTimeout(() => {
        window.print();
      }, 250);
    }
  };

  // Exportar histórico para XML estruturado (integração entre sistemas)
  const handleExportXML = () => {
    if (filteredMovements.length === 0) {
      alert('Nenhum registro para exportar com os filtros atuais.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    let periodoLabel = 'Histórico Completo';
    if (selectedPeriod === 'HOJE') {
      periodoLabel = 'Hoje';
    } else if (selectedPeriod === 'ONTEM') {
      periodoLabel = 'Ontem';
    } else if (selectedPeriod === '7DIAS') {
      periodoLabel = 'Últimos 7 Dias';
    } else if (selectedPeriod === 'MES') {
      periodoLabel = 'Mês Atual';
    } else if (selectedPeriod === 'PERSONALIZADO') {
      if (customStartDate && customEndDate) {
        const [sy, sm, sd] = customStartDate.split('-');
        const [ey, em, ed] = customEndDate.split('-');
        periodoLabel = `Personalizado (${sd}/${sm}/${sy} a ${ed}/${em}/${ey})`;
      } else if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split('-');
        periodoLabel = `Personalizado (${sd}/${sm}/${sy})`;
      } else {
        periodoLabel = 'Personalizado';
      }
    }

    const xmlContent = buildCashHistoryXml(filteredMovements, {
      loja: selectedUnit || 'Todas',
      operador: currentUser?.username || 'Todos',
      periodo: periodoLabel
    });

    downloadXmlFile(xmlContent, `Historico_Caixa_Vendas_${selectedUnit || 'Todas'}_${todayStr}.xml`);
  };

  return (
    <div className="space-y-6">
      
      {/* ─── CARDS DE MÉTRICAS & RESUMO DO FLUXO COM ESPAÇAMENTO REFINADO ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Total Sangrias */}
        <div className="bg-slate-900/90 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl p-4 relative overflow-hidden transition-all shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">Sangrias</span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <ArrowDownRight size={16} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-black text-rose-300 font-mono tracking-tight">
              - R$ {formatCurrency(metrics.totalSangrias)}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Retiradas e Despesas</p>
          </div>
          <div className="w-full bg-rose-500/10 h-1 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full w-full" />
          </div>
        </div>

        {/* Total Suprimentos */}
        <div className="bg-slate-900/90 border border-sky-500/30 hover:border-sky-500/50 rounded-2xl p-4 relative overflow-hidden transition-all shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-400">Suprimentos</span>
            <div className="w-7 h-7 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-black text-sky-300 font-mono tracking-tight">
              + R$ {formatCurrency(metrics.totalSuprimentos)}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Reforço de troco injetado</p>
          </div>
          <div className="w-full bg-sky-500/10 h-1 rounded-full overflow-hidden">
            <div className="bg-sky-500 h-full w-full" />
          </div>
        </div>

        {/* Fundos de Abertura */}
        <div className="bg-slate-900/90 border border-teal-500/30 hover:border-teal-500/50 rounded-2xl p-4 relative overflow-hidden transition-all shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-teal-400">Fundos Abertura</span>
            <div className="w-7 h-7 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <Unlock size={16} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-black text-teal-300 font-mono tracking-tight">
              R$ {formatCurrency(metrics.totalAberturas)}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Fundo inicial de troco</p>
          </div>
          <div className="w-full bg-teal-500/10 h-1 rounded-full overflow-hidden">
            <div className="bg-teal-500 h-full w-full" />
          </div>
        </div>

        {/* Vendas no PDV */}
        <div className="bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl p-4 relative overflow-hidden transition-all shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Vendas (Espécie)</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
              + R$ {formatCurrency(metrics.totalVendasDinheiro)}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Dinheiro vivo • Total OSs (Geral): <strong className="text-emerald-300">R$ {formatCurrency(metrics.totalVendasGeral)}</strong>
            </p>
            {metrics.totalRecebimentosDinheiro > 0 && (
              <p className="text-[9px] text-teal-400 font-semibold mt-0.5">
                + R$ {formatCurrency(metrics.totalRecebimentosDinheiro)} em Boletos pagos (Espécie)
              </p>
            )}
          </div>
          <div className="w-full bg-emerald-500/10 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-full" />
          </div>
        </div>

        {/* Total Movimentações */}
        <div className="bg-slate-900/90 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl p-4 relative overflow-hidden transition-all shadow-md col-span-2 sm:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-400">Movimentações</span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <History size={16} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-lg sm:text-2xl font-black text-purple-300 font-mono tracking-tight">
              {metrics.count} <span className="text-xs font-bold text-slate-400">registros</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Auditadas nos filtros</p>
          </div>
          <div className="w-full bg-purple-500/10 h-1 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full w-full" />
          </div>
        </div>

      </div>

      {/* ─── BARRA DE FILTROS & PESQUISA ESTRUTURADA ───────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        
        {/* Linha 1: Controles de Seleção e Ações */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            
            {/* Filtro Loja / Unidade */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-1">
                <Building size={12} className="text-emerald-400" />
                <span>Loja / Unidade</span>
              </label>
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 px-3.5 py-2 rounded-xl flex items-center justify-between min-h-[42px] transition-all">
                {userCity ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-white font-bold">{selectedUnit}</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-black uppercase">Fixa</span>
                  </div>
                ) : (
                  <select
                    value={selectedUnit}
                    onChange={e => setSelectedUnit(e.target.value)}
                    className="w-full bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
                  >
                    <option value="Todas" className="bg-slate-900 text-white">Todas as Lojas</option>
                    <option value="Cajati" className="bg-slate-900 text-white">Cajati</option>
                    <option value="Registro" className="bg-slate-900 text-white">Registro</option>
                    <option value="Jacupiranga" className="bg-slate-900 text-white">Jacupiranga</option>
                    <option value="Venda Externa" className="bg-slate-900 text-white">Venda Externa</option>
                  </select>
                )}
              </div>
            </div>

            {/* Filtro Tipo de Ação */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-1">
                <Filter size={12} className="text-sky-400" />
                <span>Função / Operação</span>
              </label>
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 px-3.5 py-2 rounded-xl flex items-center min-h-[42px] transition-all">
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none cursor-pointer uppercase"
                >
                  <option value="TODOS" className="bg-slate-900 text-white">Todas as Ações</option>
                  <option value="ABERTURA" className="bg-slate-900 text-white">🔓 Abertura (Fundo Troco)</option>
                  <option value="SANGRIA" className="bg-slate-900 text-white">💸 Sangria (Cofre/Despesa)</option>
                  <option value="SUPRIMENTO" className="bg-slate-900 text-white">📥 Suprimento de Troco</option>
                  <option value="VENDA" className="bg-slate-900 text-white">🛒 Vendas no PDV</option>
                  <option value="RECEBIMENTO" className="bg-slate-900 text-white">💰 Recebimento (Boleto)</option>
                  <option value="SAÍDA" className="bg-slate-900 text-white">📤 Saída / Pagamento ERP</option>
                  <option value="FECHAMENTO" className="bg-slate-900 text-white">🔒 Fechamento (Relatório Z)</option>
                </select>
              </div>
            </div>

            {/* Filtro de Período */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-1">
                <Calendar size={12} className="text-amber-400" />
                <span>Período de Data</span>
              </label>
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 px-3.5 py-2 rounded-xl flex items-center min-h-[42px] transition-all">
                <select
                  value={selectedPeriod}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedPeriod(val);
                    if (val === 'PERSONALIZADO' && !customStartDate) {
                      const todayIso = new Date().toISOString().slice(0, 10);
                      setCustomStartDate(todayIso);
                      setCustomEndDate(todayIso);
                    }
                  }}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-slate-900 text-white">Todo o Histórico</option>
                  <option value="HOJE" className="bg-slate-900 text-white">Hoje</option>
                  <option value="ONTEM" className="bg-slate-900 text-white">Ontem</option>
                  <option value="7DIAS" className="bg-slate-900 text-white">Últimos 7 Dias</option>
                  <option value="MES" className="bg-slate-900 text-white">Mês Atual</option>
                  <option value="PERSONALIZADO" className="bg-slate-900 text-white">📅 Data / Período Personalizado...</option>
                </select>
              </div>
            </div>

          </div>

          {/* Botões de Ação Lateral */}
          <div className="flex flex-wrap items-center gap-2 self-end lg:self-center mt-2 lg:mt-0 pt-3 lg:pt-0">
            <button
              type="button"
              onClick={handlePrintPdfReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/25 transition-all whitespace-nowrap min-h-[42px] active:scale-95"
              title="Gerar e salvar Relatório Oficial de Fechamento de Caixa com Movimentações em PDF (A4)"
            >
              <FileText size={16} />
              <span>Relatório em PDF (A4)</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/25 transition-all whitespace-nowrap min-h-[42px] active:scale-95"
              title="Baixar planilha no formato oficial Excel (.xlsx) compatível com Excel Online, Google Planilhas e Celular"
            >
              <FileSpreadsheet size={16} />
              <span>Baixar Planilha (Excel .xlsx)</span>
            </button>
          </div>

        </div>

        {/* Bloco de Seleção de Datas Personalizadas */}
        {selectedPeriod === 'PERSONALIZADO' && (
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-inner">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Calendar size={13} /> De:
                </span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold outline-none transition-all cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                  Até:
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* Atalhos Rápidos */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const todayIso = new Date().toISOString().slice(0, 10);
                  setCustomStartDate(todayIso);
                  setCustomEndDate(todayIso);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 border border-white/10 transition-all"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  const yIso = y.toISOString().slice(0, 10);
                  setCustomStartDate(yIso);
                  setCustomEndDate(yIso);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 border border-white/10 transition-all"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                  const todayIso = now.toISOString().slice(0, 10);
                  setCustomStartDate(firstDay);
                  setCustomEndDate(todayIso);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 border border-white/10 transition-all"
              >
                Mês Atual
              </button>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-bold text-rose-300 border border-rose-500/30 transition-all"
                >
                  Limpar Datas
                </button>
              )}
            </div>
          </div>
        )}

        {/* Linha 2: Barra de Busca com espaçamento generoso */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por operador (ex: Carla, Gerente), motivo, categoria da despesa, observações ou valor..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

      </div>

      {/* ─── BARRA DE AÇÕES EM MASSA PARA ADMINISTRADORES ─────────── */}
      {isAdmin && onDeleteRow && selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/90 border border-rose-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>{selectedIds.size} {selectedIds.size === 1 ? 'movimentação selecionada' : 'movimentações selecionadas'}</span>
                <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-black uppercase tracking-wider">Apenas Administrador</span>
              </div>
              <p className="text-xs text-rose-300/70">
                Selecione as movimentações que deseja apagar para deixar o caixa 100% acurado e preciso.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={isDeletingBulk}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
            >
              Desmarcar Todas
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={15} />
              <span>{isDeletingBulk ? 'Excluindo...' : `Excluir Selecionadas (${selectedIds.size})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── TABELA DE HISTÓRICO COM ESPAÇAMENTO REFINADO ────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                {isAdmin && onDeleteRow && (
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredMovements.length > 0 && selectedIds.size === filteredMovements.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500/40 cursor-pointer accent-rose-600"
                      title={selectedIds.size === filteredMovements.length ? "Desmarcar todos" : "Selecionar todos para exclusão"}
                    />
                  </th>
                )}
                <th className="px-5 py-4">Data & Horário</th>
                <th className="px-5 py-4">Loja / Unidade</th>
                <th className="px-5 py-4">Operador</th>
                <th className="px-5 py-4">Função / Ação</th>
                <th className="px-5 py-4 text-right">Valor</th>
                <th className="px-5 py-4">Motivo / Detalhes / Auditoria</th>
                <th className="px-5 py-4 text-center">Ações / Comprovante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin && onDeleteRow ? 8 : 7} className="px-6 py-16 text-center text-slate-500">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-3 text-slate-500 border border-slate-700/50">
                      <History size={32} />
                    </div>
                    <p className="text-base font-bold text-slate-300">Nenhuma movimentação encontrada</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Não foram encontrados registros para o filtro selecionado. Tente alterar o período, loja ou tipo de ação.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPeriod('TODOS');
                        setSelectedType('TODOS');
                        setSearchTerm('');
                        if (!userCity) setSelectedUnit('Todas');
                      }}
                      className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
                    >
                      <RefreshCw size={13} />
                      <span>Limpar Filtros</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov, idx) => {
                  const movId = mov.id || `mov_${idx}`;
                  const isSelected = selectedIds.has(movId);
                  const tipo = (mov.tipo || mov.TIPO || 'MOVIMENTO').toUpperCase();
                  const valorNum = parseCurrency(mov.valor);
                  
                  // Cores e Badges por tipo
                  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  let icon = <History size={13} />;
                  let valorClass = 'text-white font-black';

                  if (tipo === 'ABERTURA') {
                    badgeColor = 'bg-teal-500/15 text-teal-300 border-teal-500/30';
                    icon = <Unlock size={13} className="text-teal-400" />;
                    valorClass = 'text-teal-400 font-black';
                  } else if (tipo === 'SANGRIA') {
                    badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                    icon = <ArrowDownRight size={13} className="text-rose-400" />;
                    valorClass = 'text-rose-400 font-black';
                  } else if (tipo === 'SUPRIMENTO') {
                    badgeColor = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
                    icon = <ArrowUpRight size={13} className="text-sky-400" />;
                    valorClass = 'text-sky-400 font-black';
                  } else if (tipo === 'VENDA') {
                    badgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                    icon = <ShoppingCart size={13} className="text-emerald-400" />;
                    valorClass = 'text-emerald-400 font-black';
                  } else if (tipo === 'RECEBIMENTO') {
                    badgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                    icon = <DollarSign size={13} className="text-emerald-400" />;
                    valorClass = 'text-emerald-400 font-black';
                  } else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'PAGAMENTO') {
                    badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                    icon = <ArrowDownRight size={13} className="text-rose-400" />;
                    valorClass = 'text-rose-400 font-black';
                  } else if (tipo === 'FECHAMENTO') {
                    badgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    icon = <Lock size={13} className="text-amber-400" />;
                    valorClass = 'text-amber-400 font-black';
                  }

                  // Badge da Loja
                  const unidade = mov.unidade || mov.CIDADE || mov.LOJA || 'Central';
                  let unitBadge = 'bg-slate-800 text-slate-300';
                  if (unidade === 'Cajati') unitBadge = 'bg-blue-500/15 text-blue-300 border border-blue-500/30';
                  else if (unidade === 'Registro') unitBadge = 'bg-purple-500/15 text-purple-300 border border-purple-500/30';
                  else if (unidade === 'Jacupiranga') unitBadge = 'bg-teal-500/15 text-teal-300 border border-teal-500/30';
                  else if (unidade === 'Venda Externa') unitBadge = 'bg-amber-500/15 text-amber-300 border border-amber-500/30';

                  return (
                    <tr 
                      key={movId} 
                      className={`transition-colors ${isSelected ? 'bg-rose-500/15 border-l-4 border-l-rose-500' : 'hover:bg-slate-800/40'}`}
                    >
                      {/* Checkbox de Seleção em Massa (Apenas Administrador) */}
                      {isAdmin && onDeleteRow && (
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(movId)}
                            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500/40 cursor-pointer accent-rose-600"
                            title={isSelected ? "Desmarcar este lançamento" : "Marcar para exclusão"}
                          />
                        </td>
                      )}
                      
                      {/* Data & Horário */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-300 font-medium">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <Clock size={12} />
                          </div>
                          <span>{formatDate(mov.dataHora || mov.DATA)}</span>
                        </div>
                      </td>

                      {/* Loja / Unidade */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${unitBadge}`}>
                          <Building size={12} />
                          {unidade}
                        </span>
                      </td>

                      {/* Operador / Quem Fez */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-white font-bold">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-black text-[10px] border border-slate-700">
                            {(mov.operador || mov.VENDEDOR || mov.OPERADOR || 'C')[0].toUpperCase()}
                          </div>
                          <span>{mov.operador || mov.VENDEDOR || mov.OPERADOR || 'Caixa'}</span>
                        </div>
                      </td>

                      {/* Função / Tipo */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border uppercase tracking-tight ${badgeColor}`}>
                          {icon}
                          {tipo}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="px-5 py-4 whitespace-nowrap text-right font-mono text-sm">
                        <span className={valorClass}>
                          {tipo === 'SANGRIA' ? `- R$ ${formatCurrency(valorNum)}` : `R$ ${formatCurrency(valorNum)}`}
                        </span>
                        {tipo === 'VENDA' && mov.formaPagamento && (
                          <div className="text-[9px] font-sans font-black uppercase tracking-wider text-slate-400 mt-0.5">
                            {cleanBoletoDisplay(mov.formaPagamento)}
                          </div>
                        )}
                      </td>

                      {/* Motivo & Detalhes */}
                      <td className="px-5 py-4 max-w-[360px]">
                        <div className="space-y-1">
                          <div className="font-bold text-white text-xs leading-snug flex flex-wrap items-center gap-1.5">
                            {mov.osNumero && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-black">
                                OS #{String(mov.osNumero).replace(/^#|^os[-_ ]?/i, '')}
                              </span>
                            )}
                            <span>{cleanBoletoDisplay(mov.motivo || mov.DESPESA || (tipo === 'VENDA' ? `Venda (${mov.formaPagamento || 'PDV'})` : 'Movimentação'))}</span>
                          </div>
                          {mov.despesaCategoria && (
                            <div className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded font-semibold">
                              <span>📂 {mov.despesaCategoria}</span>
                            </div>
                          )}
                          {mov.detalhes && (
                            <div className="text-[11px] text-slate-400 leading-normal">
                              💬 {cleanBoletoDisplay(mov.detalhes)}
                            </div>
                          )}
                          {tipo === 'VENDA' && parseCurrency(mov.valorRestanteBoleto) > 0 && (
                            <div className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-2.5 py-1.5 font-sans">
                              📄 <strong>Valor Total da OS: R$ {formatCurrency(mov.valorTotalOS || (valorNum + parseCurrency(mov.valorRestanteBoleto)))}</strong> • Entrada no Caixa{mov.formaEntradaOS ? ` (${mov.formaEntradaOS})` : ''}: <strong>R$ {formatCurrency(valorNum)}</strong> • Saldo Parcelado no Boleto{mov.formaRestanteOS && !String(mov.formaRestanteOS).toLowerCase().includes('boleto') ? ` / Restante (${mov.formaRestanteOS})` : ''}: <strong>R$ {formatCurrency(mov.valorRestanteBoleto)}</strong> (Contas a Receber)
                            </div>
                          )}
                          {tipo === 'FECHAMENTO' && (
                            <div className="text-[11px] text-amber-300/90 font-mono bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-1 space-y-1">
                              <div>
                                Gaveta: R$ {formatCurrency(mov.dinheiroEsperado)} | Contado: R$ {formatCurrency(mov.valor || mov.dinheiroContado)} | Dif: R$ {formatCurrency(mov.diferenca)} ({mov.status || 'Conferido'})
                              </div>
                              {(parseCurrency(mov.vendasBoletoTotal || mov.vendasBoleto) > 0) && (
                                <div className="text-[10px] text-indigo-300 font-sans">
                                  📄 Faturado a Prazo (Boleto): <strong>R$ {formatCurrency(mov.vendasBoletoTotal || mov.vendasBoleto)}</strong> ({mov.vendasBoletoQtd || 1} vendas) • Recebível futuro em Contas a Receber
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Ação: Editar, Reemitir / Imprimir 2ª Via & Excluir */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {onUpdateRow && (
                            <button
                              type="button"
                              onClick={() => setEditingMovement(mov)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white rounded-xl text-xs font-bold border border-blue-500/30 shadow-sm transition-all active:scale-95"
                              title="Editar lançamento de caixa / data / valor"
                            >
                              <Edit2 size={13} className="text-blue-400" />
                              <span>Editar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleReprint(mov)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-xl text-xs font-bold border border-slate-700 shadow-sm transition-all active:scale-95"
                            title="Imprimir 2ª via do comprovante oficial"
                          >
                            <Printer size={13} className="text-emerald-400" />
                            <span>2ª Via</span>
                          </button>
                          {isAdmin && onDeleteRow && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`⚠️ Atenção Administrador:\n\nTem certeza que deseja EXCLUIR este lançamento de ${tipo} no valor de R$ ${formatCurrency(valorNum)} do caixa?\n\nEsta operação atualizará o saldo do caixa imediatamente.`)) {
                                  handleDeleteMovement(mov);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 shadow-sm transition-all active:scale-95"
                              title="Excluir este lançamento de caixa (Apenas Administrador)"
                            >
                              <Trash2 size={13} className="text-rose-400" />
                              <span>Excluir</span>
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Componente Invisível de Impressão local para 2ª via */}
      {localPrintData && (
        <PrintableCashVoucher
          type={localPrintData.type}
          data={localPrintData.data}
          unit={localPrintData.unit}
          operator={localPrintData.operator}
        />
      )}

      {/* Componente Invisível de Impressão de Relatório Oficial de Fechamento de Caixa em PDF A4 */}
      {pdfReportData && (
        <PrintableCashClosingReport
          closingData={pdfReportData.closingData}
          movements={pdfReportData.movements}
          storeName={pdfReportData.storeName}
          periodLabel={pdfReportData.periodLabel}
          reportTitle={pdfReportData.title}
        />
      )}

      {/* Modal de Edição de Movimentação de Caixa */}
      <EditCashMovementModal
        isOpen={Boolean(editingMovement)}
        onClose={() => setEditingMovement(null)}
        movement={editingMovement}
        onSave={handleSaveMovementEdit}
        onDelete={onDeleteRow ? handleDeleteMovement : null}
      />

    </div>
  );
};

// ─── MODAL COMPLETO DE HISTÓRICO DE CAIXA (PARA O PDV) ─────────────
const CashHistoryModal = ({
  isOpen,
  onClose,
  cashMovements = [],
  salesData = [],
  receberData = [],
  selectedCity = 'Todas',
  currentUser = null,
  onTriggerPrint = null,
  onUpdateRow = null,
  onDeleteRow = null
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-7xl w-full p-5 sm:p-8 shadow-2xl space-y-6 max-h-[94vh] flex flex-col my-auto">
        
        {/* Cabeçalho do Modal com espaçamento organizado */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                Histórico & Auditoria de Caixa
              </h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Aberturas, Sangrias, Suprimentos, Vendas e Fechamentos com Edição e Reimpressão de Comprovante
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
            title="Fechar Janela"
          >
            <X size={22} />
          </button>
        </div>

        {/* Conteúdo com Scroll Suave e Espaçamento Perfeito */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-6">
          <CashHistoryContent
            cashMovements={cashMovements}
            salesData={salesData}
            receberData={receberData}
            defaultUnit={selectedCity}
            currentUser={currentUser}
            onPrint={onTriggerPrint}
            onUpdateRow={onUpdateRow}
            onDeleteRow={onDeleteRow}
          />
        </div>

        {/* Rodapé Elegante */}
        <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Todos os registros possuem carimbo de auditoria, data, horário, loja e operador.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default CashHistoryModal;

