import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, Calendar, Clock, User, Building, DollarSign, 
  ArrowDownRight, ArrowUpRight, Lock, Unlock, ShoppingCart, 
  Printer, Search, Filter, RefreshCw, X, Download, ShieldCheck,
  AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { PrintableCashVoucher } from './CashManagementModal';

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
  const raw = item.dataHora || item.timestamp || item.DATA || item['DATA  DA VENDA'] || item['DATA DA VENDA'] || item.data;
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
    if (typeof dateVal === 'string' && dateVal.includes('/') && !dateVal.includes('T')) {
      return dateVal;
    }
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(dateVal);
  }
};

export const CashHistoryContent = ({ 
  cashMovements = [], 
  salesData = [],
  defaultUnit = 'Todas',
  currentUser = null,
  onPrint = null
}) => {
  const userCity = currentUser?.role === 'vendedor' ? (currentUser.city || currentUser.assignedStore || 'Cajati') : null;
  const [selectedUnit, setSelectedUnit] = useState(() => userCity || defaultUnit);

  useEffect(() => {
    if (userCity) {
      setSelectedUnit(userCity);
    }
  }, [userCity]);

  const [selectedType, setSelectedType] = useState('TODOS');
  const [selectedPeriod, setSelectedPeriod] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [localPrintData, setLocalPrintData] = useState(null);

  // Unificar os movimentos registrados em FLUXO_CAIXA + Vendas do Sistema
  const allMovements = useMemo(() => {
    let list = Array.isArray(cashMovements) ? [...cashMovements] : [];
    
    // Identificar vendas e recebimentos já presentes no fluxo de caixa para evitar duplicar
    const cleanId = (id) => String(id || '').replace(/^#|^os[-_ ]?/i, '').trim().toLowerCase();
    const existingSalesIds = new Set();
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
      }
    });

    // Integrar vendas de salesData se existirem
    if (Array.isArray(salesData) && salesData.length > 0) {
      salesData.forEach((s, idx) => {
        // Ignora se for quitação de parcela ou recebimento de boleto/mensalidade (já registrado em FLUXO_CAIXA como RECEBIMENTO)
        const prod = String(s['PRODUTO'] || s['SERVIÇO'] || s['Produto'] || '').toLowerCase();
        const sTipo = String(s.tipo || s.TIPO || '').toUpperCase();
        if (prod.includes('recebimento') || prod.includes('mensalidade') || prod.includes('carnê') || prod.includes('carne') || prod.includes('boleto') || sTipo === 'RECEBIMENTO') {
          return;
        }

        const rawId = String(s.id || s._id || s['ID'] || s.saleId || s.sale_id || '').trim().toLowerCase();
        const cleanRawId = cleanId(rawId);
        const osNum = String(s['OS DA VENDA'] || s['Nº DA OS'] || s['OS'] || s['Num OS'] || '').trim().toLowerCase();
        const cleanOsNum = cleanId(osNum);
        const sId = rawId || (osNum ? `os_${osNum}` : `venda_${idx}`);
        const cleanSId = cleanId(sId);

        const isDuplicate = (rawId && existingSalesIds.has(rawId)) ||
                            (cleanRawId && existingSalesIds.has(cleanRawId)) ||
                            (osNum && existingSalesIds.has(osNum)) ||
                            (cleanOsNum && existingSalesIds.has(cleanOsNum)) ||
                            existingSalesIds.has(sId) ||
                            (cleanSId && existingSalesIds.has(cleanSId));

        if (!isDuplicate) {
          const valor = s['VALOR TOTAL'] || s['VALOR DA VENDA'] || s['VALOR'] || s['VALOR_TOTAL'] || s['Valor'] || 0;
          const parsedVal = parseCurrency(valor);
          if (parsedVal > 0) {
            const rawDate = s['DATA  DA VENDA'] || s['DATA DA VENDA'] || s['DATA'] || s['timestamp'] || s['data'] || s['Data'];
            const loja = s['CIDADE'] || s['Loja'] || s['UNIDADE'] || s['loja'] || s['Cidade'] || 'Cajati';
            const vendedor = s['VENDEDOR'] || s['OPERADOR'] || s['Vendedor'] || 'Vendedor';
            const forma = s['FORMA DE PAGAMENTO'] || s['FORMA'] || s['PAGAMENTO'] || s['Forma de Pagamento'] || 'Dinheiro';
            const osDisplay = s['OS DA VENDA'] || s['Nº DA OS'] || s['OS'] || s['Num OS'] || (idx + 1);
            const produto = s['PRODUTO'] || s['SERVIÇO'] || s['Produto'] || 'Venda Balcão';
            const cliente = s['CLIENTE'] || s['NOME DO CLIENTE'] || s['Cliente'] || 'Consumidor Final';

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

            list.push({
              id: sId,
              saleId: rawId || sId,
              osNumero: osNum,
              tipo: 'VENDA',
              unidade: loja,
              operador: vendedor,
              valor: parsedVal,
              formaPagamento: forma,
              motivo: `Venda OS #${osDisplay} - ${produto}`,
              detalhes: `Cliente: ${cliente} | Pagamento: ${forma}`,
              dataHora: rawDate,
              DATA: rawDate
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
  }, [allMovements, selectedUnit, selectedType, selectedPeriod, searchTerm]);

  // Cálculos de Resumo Financeiro
  const metrics = useMemo(() => {
    let totalAberturas = 0;
    let totalSangrias = 0;
    let totalSuprimentos = 0;
    let totalRecebimentosDinheiro = 0;
    let totalSaidas = 0;
    let totalVendasDinheiro = 0;
    let totalVendasGeral = 0;
    let totalFechamentos = 0;

    filteredMovements.forEach(item => {
      const v = parseCurrency(item.valor);
      const tipo = (item.tipo || item.TIPO || '').toUpperCase();
      const forma = String(item.formaPagamento || '').toUpperCase();

      if (tipo === 'ABERTURA') {
        totalAberturas += v;
      } else if (tipo === 'SANGRIA') {
        totalSangrias += v;
      } else if (tipo === 'SUPRIMENTO') {
        totalSuprimentos += v;
      } else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'PAGAMENTO') {
        totalSaidas += v;
      } else if (tipo === 'RECEBIMENTO') {
        if (forma.includes('DINHEIRO') || !forma) {
          totalRecebimentosDinheiro += v;
        }
      } else if (tipo === 'VENDA') {
        totalVendasGeral += v;
        if (forma.includes('DINHEIRO') || !forma) {
          totalVendasDinheiro += v;
        }
      } else if (tipo === 'FECHAMENTO') {
        totalFechamentos++;
      }
    });

    const saldoEstimadoGaveta = Math.max(0, (totalAberturas + totalSuprimentos + totalVendasDinheiro + totalRecebimentosDinheiro) - totalSangrias - totalSaidas);

    return {
      count: filteredMovements.length,
      totalAberturas,
      totalSangrias,
      totalSuprimentos,
      totalRecebimentosDinheiro,
      totalSaidas,
      totalVendasDinheiro,
      totalVendasGeral,
      saldoEstimadoGaveta,
      totalFechamentos
    };
  }, [filteredMovements]);

  // Disparo de Impressão de Comprovante (2ª Via)
  const handleReprint = (mov) => {
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

  // Exportar histórico para CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      alert('Nenhum registro para exportar com os filtros atuais.');
      return;
    }

    const headers = ['Data/Hora', 'Loja', 'Operador', 'Tipo/Funcao', 'Valor (R$)', 'Forma Pagamento', 'Motivo', 'Categoria', 'Detalhes'];
    const rows = filteredMovements.map(m => [
      `"${formatDate(m.dataHora || m.DATA)}"`,
      `"${m.unidade || m.CIDADE || ''}"`,
      `"${m.operador || m.VENDEDOR || ''}"`,
      `"${m.tipo || ''}"`,
      `"${formatCurrency(m.valor)}"`,
      `"${m.formaPagamento || ''}"`,
      `"${(m.motivo || '').replace(/"/g, '""')}"`,
      `"${(m.despesaCategoria || '').replace(/"/g, '""')}"`,
      `"${(m.detalhes || m.OBSERVAÇÕES || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Historico_Caixa_${selectedUnit}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Entradas em dinheiro vivo</p>
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
                  onChange={e => setSelectedPeriod(e.target.value)}
                  className="w-full bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
                >
                  <option value="TODOS" className="bg-slate-900 text-white">Todo o Histórico</option>
                  <option value="HOJE" className="bg-slate-900 text-white">Hoje</option>
                  <option value="ONTEM" className="bg-slate-900 text-white">Ontem</option>
                  <option value="7DIAS" className="bg-slate-900 text-white">Últimos 7 Dias</option>
                  <option value="MES" className="bg-slate-900 text-white">Mês Atual</option>
                </select>
              </div>
            </div>

          </div>

          {/* Botões de Ação Lateral */}
          <div className="flex items-center gap-2 self-end lg:self-center mt-2 lg:mt-0 pt-3 lg:pt-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white rounded-xl text-xs font-bold border border-emerald-500/40 shadow-sm transition-all whitespace-nowrap min-h-[42px]"
              title="Exportar registros para planilha Excel / CSV"
            >
              <Download size={15} className="text-emerald-400" />
              <span>Exportar Excel (CSV)</span>
            </button>
          </div>

        </div>

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

      {/* ─── TABELA DE HISTÓRICO COM ESPAÇAMENTO REFINADO ────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">Data & Horário</th>
                <th className="px-5 py-4">Loja / Unidade</th>
                <th className="px-5 py-4">Operador</th>
                <th className="px-5 py-4">Função / Ação</th>
                <th className="px-5 py-4 text-right">Valor</th>
                <th className="px-5 py-4">Motivo / Detalhes / Auditoria</th>
                <th className="px-5 py-4 text-center">Comprovante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
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
                    <tr key={mov.id || `mov_${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      
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
                      </td>

                      {/* Motivo & Detalhes */}
                      <td className="px-5 py-4 max-w-[340px]">
                        <div className="space-y-1">
                          <div className="font-bold text-white text-xs leading-snug">
                            {cleanBoletoDisplay(mov.motivo || mov.DESPESA || (tipo === 'VENDA' ? `Venda (${mov.formaPagamento || 'PDV'})` : 'Movimentação'))}
                          </div>
                          {mov.despesaCategoria && (
                            <div className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded font-semibold">
                              <span>📂 {mov.despesaCategoria}</span>
                            </div>
                          )}
                          {mov.detalhes && (
                            <div className="text-[11px] text-slate-400 leading-normal">
                              💬 {mov.detalhes}
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

                      {/* Ação: Reemitir / Imprimir 2ª Via */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleReprint(mov)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-xl text-xs font-bold border border-slate-700 shadow-sm transition-all active:scale-95"
                          title="Imprimir 2ª via do comprovante oficial"
                        >
                          <Printer size={13} className="text-emerald-400" />
                          <span>2ª Via</span>
                        </button>
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

    </div>
  );
};

// ─── MODAL COMPLETO DE HISTÓRICO DE CAIXA (PARA O PDV) ─────────────
const CashHistoryModal = ({
  isOpen,
  onClose,
  cashMovements = [],
  salesData = [],
  selectedCity = 'Todas',
  currentUser = null,
  onTriggerPrint = null
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
                Aberturas, Sangrias, Suprimentos, Vendas e Fechamentos com Reimpressão de Comprovante
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
            defaultUnit={selectedCity}
            currentUser={currentUser}
            onPrint={onTriggerPrint}
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

