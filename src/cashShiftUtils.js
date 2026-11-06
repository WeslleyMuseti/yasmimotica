import { resolveOSUnit } from './reparcelamentoUtils.js';

export const parseCurrency = (val) => {
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

export const formatCurrency = (val) => {
  const n = typeof val === 'number' ? val : parseCurrency(val);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * 🛡️ Parser universal e tolerante a datas em múltiplos formatos (ISO, pt-BR DD/MM/YYYY, Timestamp, etc.)
 */
export const parseItemDate = (item) => {
  if (!item) return null;
  const raw = item.dataHora || item.timestamp || item.DATA_HORA || item.dataHoraAbertura || item.dataHoraFechamento ||
    item['DATA  DA VENDA'] || item['DATA DA VENDA'] || item['DATA_VENDA'] || item['Data da Venda'] || item['data_venda'] || 
    item.dataVenda || item.DATA || item.data || item.createdAt || item.created_at;
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
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
  return null;
};

/**
 * 🛡️ Helper soberano para unificar e desduplicar movimentações do turno (FLUXO_CAIXA + Vendas / OS)
 * Garante que vendas como CAJ25, mesmo parceladas ou sem entrada, apareçam no extrato e relatórios contábeis.
 */
export const buildCombinedShiftMovements = (movList = [], salesList = [], unitName = 'Central', defaultOp = 'Caixa') => {
  const cleanKey = (v) => String(v || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const salesByOs = new Map();
  const salesById = new Map();

  (salesList || []).forEach(s => {
    if (!s || typeof s !== 'object') return;
    const osK = cleanKey(s['OS DA VENDA'] || s['OS da VENDA'] || s['Nº DA OS'] || s['Num OS'] || s.OS || s.os || s.osNumero || s.numeroOS);
    const idK = cleanKey(s.id || s._id || s.saleId || s.sale_id);
    if (osK) salesByOs.set(osK, s);
    if (idK) salesById.set(idK, s);
  });

  const seenSaleKeys = new Set();

  const mappedMovs = (movList || []).map(m => {
    const osRaw = m.osNumero || m['OS DA VENDA'] || m.OS || m['Nº DA OS'] || '';
    const osK = cleanKey(osRaw);
    const idK = cleanKey(m.saleId || m.id);
    if (osK) seenSaleKeys.add(osK);
    if (idK) seenSaleKeys.add(idK);

    const matchedSale = (osK && salesByOs.get(osK)) || (idK && salesById.get(idK)) || null;
    const resolvedUnit = resolveOSUnit({ numeroOS: osRaw, ...m });
    const clienteNome = m.cliente || (matchedSale && (matchedSale.CLIENTE || matchedSale.NOME || matchedSale['NOME CLIENTE'] || matchedSale.Cliente)) || m.motivo || m.descricao || m.favorecido;

    return {
      ...m,
      unidade: m.unidade || m.CIDADE || m.LOJA || resolvedUnit || unitName,
      tipo: m.tipo || 'MOVIMENTO',
      valor: m.valor,
      forma: m.formaPagamento || m.forma,
      formaPagamento: m.formaPagamento || m.forma,
      dataHora: m.dataHora || m.timestamp || m.DATA_HORA || m.DATA || m.data,
      cliente: clienteNome,
      vendedor: m.vendedor || m.operador || (matchedSale && (matchedSale.VENDEDOR || matchedSale.OPERADOR)) || defaultOp,
      osNumero: osRaw || (matchedSale && (matchedSale['OS DA VENDA'] || matchedSale['Nº DA OS'] || matchedSale.OS || matchedSale.osNumero)) || ''
    };
  });

  (salesList || []).forEach(s => {
    if (!s || typeof s !== 'object') return;
    if (s.MULTI_OS_PRINCIPAL === false || s.isSecondaryOS === true || s.FATURAMENTO_UNIFICADO === 'SECUNDARIA') return;
    const osRaw = s['OS DA VENDA'] || s['OS da VENDA'] || s['Nº DA OS'] || s['Num OS'] || s.OS || s.os || s.osNumero || s.numeroOS || '';
    const idRaw = s.id || s._id || s.saleId || '';
    const osK = cleanKey(osRaw);
    const idK = cleanKey(idRaw);

    if ((osK && seenSaleKeys.has(osK)) || (idK && seenSaleKeys.has(idK))) {
      return;
    }
    if (osK) seenSaleKeys.add(osK);
    if (idK) seenSaleKeys.add(idK);

    const totalVal = parseCurrency(s['VALOR TOTAL'] || s['VALOR DA VENDA'] || s.valorTotal || s.VALOR || 0);
    const entradaVal = parseCurrency(s['VALOR ENTRADA'] ?? s['ENTRADA'] ?? s['SINAL'] ?? s['valorEntrada'] ?? s['sinal'] ?? 0);
    const restanteVal = parseCurrency(s['RESTANTE'] ?? s['VALOR RESTANTE'] ?? s['restante'] ?? 0);
    const fp = String(s['FORMA_PAGTO'] || s['FORMAS_PAGAMENTO'] || s.formaPagamento || s['MEIO_PAGAMENTO'] || 'Dinheiro');
    const hasBoleto = /boleto|carn[eê]|crediario/i.test(fp) || restanteVal > 0;
    const valorCaixa = hasBoleto ? (entradaVal > 0 ? entradaVal : (restanteVal > 0 ? Math.max(0, totalVal - restanteVal) : 0)) : totalVal;
    const saldoBoleto = hasBoleto ? (restanteVal > 0 ? restanteVal : Math.max(0, totalVal - valorCaixa)) : 0;
    const resolvedUnit = resolveOSUnit({ numeroOS: osRaw, ...s });

    mappedMovs.push({
      ...s,
      unidade: s.UNIDADE || s.CIDADE || s.LOJA || s.unidade || s.cidade || resolvedUnit || unitName,
      tipo: 'VENDA',
      valor: valorCaixa,
      valorTotalOS: totalVal,
      valorEntradaOS: entradaVal,
      valorRestanteBoleto: saldoBoleto,
      forma: fp,
      formaPagamento: fp,
      dataHora: s.dataHora || s.timestamp || s.DATA_HORA || s['DATA  DA VENDA'] || s['DATA DA VENDA'] || s['DATA_VENDA'] || s.dataVenda || s.DATA || s.data || new Date().toISOString(),
      cliente: s.CLIENTE || s.NOME || s['NOME CLIENTE'] || s.Cliente || 'Consumidor Final',
      vendedor: s.VENDEDOR || s.OPERADOR || s.Vendedor || defaultOp,
      osNumero: osRaw || idRaw
    });
  });

  return mappedMovs;
};
