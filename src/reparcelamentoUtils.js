import { isSameClient } from './firebaseSync.js';

export const parseCurrencyValue = (val) => {
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

export const formatMoneyBr = (val) => {
  const num = parseCurrencyValue(val);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrencyBr = (val) => {
  const num = parseCurrencyValue(val);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Normaliza qualquer formato de data (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, Date, Serial Excel) para ISO YYYY-MM-DD
 */
export const normalizeInstallmentDateIso = (raw) => {
  if (raw === null || raw === undefined || raw === '') return '';
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === 'number' && raw > 30000 && raw < 60000) {
    const dt = new Date((raw - 25569) * 86400 * 1000);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().split('T')[0];
    }
  }
  const str = String(raw).trim();
  if (!str || str === '—' || str === '-') return '';

  const datePart = str.split(/[T\s]/)[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
    const [d, m, y] = datePart.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(datePart)) {
    const [d, m, y] = datePart.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
};

/**
 * Formata qualquer data para o padrão brasileiro DD/MM/AAAA
 */
export const formatInstallmentDateBr = (raw) => {
  const iso = normalizeInstallmentDateIso(raw);
  if (!iso) return String(raw || '—');
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Extrai o número da OS de uma linha financeira ou de venda
 */
export const extractOSFromRow = (row) => {
  if (!row || typeof row !== 'object') return '';
  const direct =
    row.VENDA_OS ||
    row.venda_os ||
    row.OS ||
    row.os ||
    row['OS DA VENDA'] ||
    row['Nº DA OS'] ||
    row.NUMERO_OS ||
    row.osNumero ||
    '';
  if (direct && String(direct).trim() !== '' && String(direct).trim() !== '—') {
    return String(direct).trim().replace(/^#/, '');
  }
  const doc = String(row.DOCUMENTO || row.documento || '');
  const desc = String(row.DESCRICAO || row.descricao || '');
  const obs = String(row.OBSERVACOES || row.observacoes || '');
  const combined = `${doc} ${desc} ${obs}`;
  const match = combined.match(/OS\s*#?\s*([A-Z]{2,4}-\d+|\d+)/i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return '';
};

/**
 * Extrai o nome do cliente de um registro financeiro, cruzando com clientsData e salesData quando necessário
 */
export const resolveInstallmentClientName = (item, clientsData = [], salesData = []) => {
  if (!item || typeof item !== 'object') return 'Cliente não identificado';
  const direct = (
    item.CLIENTE ||
    item.cliente ||
    item['NOME DO CLIENTE'] ||
    item['NOME CLIENTE'] ||
    item.NOME ||
    item.nome ||
    item['Nome Completo'] ||
    ''
  ).toString().trim();

  if (direct && direct !== '—' && direct !== '-') {
    return direct;
  }

  if (Array.isArray(clientsData) && clientsData.length > 0) {
    const matchedClient = clientsData.find(c => isSameClient(c, item));
    if (matchedClient) {
      const cName = (matchedClient['Nome Completo'] || matchedClient.NOME || matchedClient.CLIENTE || '').toString().trim();
      if (cName) return cName;
    }
  }

  const osNum = extractOSFromRow(item);
  if (osNum && Array.isArray(salesData) && salesData.length > 0) {
    const cleanTarget = osNum.toLowerCase().replace(/^os-?/i, '');
    const matchedSale = salesData.find(s => {
      const sOs = extractOSFromRow(s).toLowerCase().replace(/^os-?/i, '');
      return sOs && sOs === cleanTarget;
    });
    if (matchedSale) {
      const sName = (
        matchedSale['NOME CLIENTE'] ||
        matchedSale['NOME DO CLIENTE'] ||
        matchedSale.CLIENTE ||
        matchedSale.NOME ||
        matchedSale['Nome Completo'] ||
        ''
      ).toString().trim();
      if (sName) return sName;
    }
  }

  return 'Cliente não identificado';
};

/**
 * Filtra parcelas (CONTAS_RECEBER ou CONTAS_PAGAR) por datas personalizadas, períodos rápidos, status e busca por cliente/OS
 */
export const filterInstallmentsByDateRange = (rows = [], filterConfig = {}, referenceTodayIso = null) => {
  if (!Array.isArray(rows)) return [];
  const {
    period = '',
    periodMode = 'ALL',
    startDate = '',
    endDate = '',
    dateField = 'VENCIMENTO', // 'VENCIMENTO' | 'PAGAMENTO' | 'CADASTRO'
    statusFilter = 'ALL',     // 'ALL'/'TODOS' | 'PENDING'/'PENDENTE' | 'OVERDUE'/'VENCIDO' | 'PAID'/'RECEBIDO'/'PAGO'
    osQuery = '',
    searchQuery = '',
    clientsData = [],
    salesData = []
  } = filterConfig || {};

  const effectivePeriod = (period || periodMode || 'ALL').toUpperCase();
  const effectiveStatus = (statusFilter || 'ALL').toUpperCase();
  const todayIso = referenceTodayIso || new Date().toISOString().split('T')[0];

  const getRowTargetDateIso = (row) => {
    if (!row) return '';
    if (dateField === 'PAGAMENTO') {
      const rawPag =
        row.DATA_RECEBIMENTO ||
        row['DATA RECEBIMENTO'] ||
        row.data_recebimento ||
        row.DATA_PAGAMENTO ||
        row['DATA PAGAMENTO'] ||
        row.data_pagamento ||
        row.RECEBIMENTO ||
        row.PAGAMENTO ||
        '';
      return normalizeInstallmentDateIso(rawPag);
    }
    if (dateField === 'CADASTRO') {
      const rawCad =
        row.DATA_CADASTRO ||
        row.data_cadastro ||
        row.DATA_REPARCELAMENTO ||
        row['DATA DO CADASTRAMENTO'] ||
        row['DATA DA VENDA'] ||
        row['DATA  DA VENDA'] ||
        row.DATA ||
        '';
      return normalizeInstallmentDateIso(rawCad);
    }
    const rawVenc =
      row.DATA_VENCIMENTO ||
      row['DATA VENCIMENTO'] ||
      row.data_vencimento ||
      row.VENCIMENTO ||
      row.vencimento ||
      row['Data de Vencimento'] ||
      '';
    return normalizeInstallmentDateIso(rawVenc);
  };

  let minIso = '';
  let maxIso = '';

  const cleanStart = normalizeInstallmentDateIso(startDate);
  const cleanEnd = normalizeInstallmentDateIso(endDate);
  const isPresetPeriod = [
    'HOJE', 'TODAY',
    'PROXIMOS_7_DIAS', 'NEXT_7_DAYS', 'SEMANA',
    'MES_ATUAL', 'THIS_MONTH', 'MES',
    'PROXIMO_MES', 'NEXT_MONTH',
    'VENCIDAS', 'OVERDUE'
  ].includes(effectivePeriod);

  if (effectivePeriod === 'HOJE' || effectivePeriod === 'TODAY') {
    minIso = todayIso;
    maxIso = todayIso;
  } else if (effectivePeriod === 'PROXIMOS_7_DIAS' || effectivePeriod === 'NEXT_7_DAYS' || effectivePeriod === 'SEMANA') {
    minIso = todayIso;
    const [y, m, d] = todayIso.split('-').map(Number);
    const next7 = new Date(y, m - 1, d + 7);
    maxIso = normalizeInstallmentDateIso(next7);
  } else if (effectivePeriod === 'MES_ATUAL' || effectivePeriod === 'THIS_MONTH' || effectivePeriod === 'MES') {
    const [y, m] = todayIso.split('-');
    minIso = `${y}-${m}-01`;
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    maxIso = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  } else if (effectivePeriod === 'PROXIMO_MES' || effectivePeriod === 'NEXT_MONTH') {
    const [y, m] = todayIso.split('-').map(Number);
    const nextMonthDate = new Date(y, m, 1);
    const ny = nextMonthDate.getFullYear();
    const nm = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(ny, nextMonthDate.getMonth() + 1, 0).getDate();
    minIso = `${ny}-${nm}-01`;
    maxIso = `${ny}-${nm}-${String(lastDay).padStart(2, '0')}`;
  } else if (!isPresetPeriod && (effectivePeriod === 'PERSONALIZADO' || effectivePeriod === 'CUSTOM' || cleanStart || cleanEnd)) {
    if (cleanStart && cleanEnd) {
      if (cleanStart <= cleanEnd) {
        minIso = cleanStart;
        maxIso = cleanEnd;
      } else {
        minIso = cleanEnd;
        maxIso = cleanStart;
      }
    } else if (cleanStart) {
      minIso = cleanStart;
    } else if (cleanEnd) {
      maxIso = cleanEnd;
    }
  }

  const q = String(searchQuery || '').trim().toLowerCase();
  const qOs = String(osQuery || '').replace(/^#/, '').trim().toLowerCase();

  return rows.filter(row => {
    if (!row || typeof row !== 'object') return false;

    const stRaw = String(row.STATUS || row.status || 'Pendente').trim().toLowerCase();
    const isPaid = ['recebido', 'pago', 'liquidado'].includes(stRaw);
    const isCanceled = ['cancelado', 'cancelada', 'reparcelado', 'substituido'].includes(stRaw);

    const rowVencIso = normalizeInstallmentDateIso(
      row.DATA_VENCIMENTO || row['DATA VENCIMENTO'] || row.data_vencimento || row.VENCIMENTO || row.vencimento || ''
    );
    const isOverdue =
      !isPaid &&
      !isCanceled &&
      ((rowVencIso && rowVencIso <= todayIso) ||
        stRaw === 'atrasado' ||
        stRaw === 'inadimplente' ||
        stRaw === 'vencido');

    // 1. Filtro de Status
    if (effectiveStatus === 'RECEBIDO' || effectiveStatus === 'PAGO' || effectiveStatus === 'PAID') {
      if (!isPaid) return false;
    } else if (effectiveStatus === 'PENDENTE' || effectiveStatus === 'PENDING') {
      if (isPaid || isCanceled) return false;
    } else if (effectiveStatus === 'VENCIDO' || effectiveStatus === 'VENCIDAS' || effectiveStatus === 'OVERDUE') {
      if (!isOverdue) return false;
    }

    // Se o período rápido for VENCIDAS / OVERDUE, exige estar vencida/não paga
    if (effectivePeriod === 'VENCIDAS' || effectivePeriod === 'OVERDUE') {
      if (!isOverdue) return false;
    }

    // 2. Filtro por intervalo de datas
    if (minIso || maxIso) {
      const targetIso = getRowTargetDateIso(row);
      if (!targetIso) return false;
      if (minIso && targetIso < minIso) return false;
      if (maxIso && targetIso > maxIso) return false;
    }

    // 3. Filtro por OS específica
    if (qOs) {
      const rowOs = extractOSFromRow(row).toLowerCase();
      if (!rowOs.includes(qOs)) return false;
    }

    // 4. Filtro por texto (Cliente direto ou resolvido via cadastro/OS, OS, CPF, Descrição, Fornecedor)
    if (q) {
      const rawClientStr = String(row.CLIENTE || row.cliente || row.NOME || row['NOME DO CLIENTE'] || '').toLowerCase();
      const resolvedClientStr =
        (Array.isArray(clientsData) && clientsData.length > 0) || (Array.isArray(salesData) && salesData.length > 0)
          ? resolveInstallmentClientName(row, clientsData, salesData).toLowerCase()
          : '';
      const osStr = extractOSFromRow(row).toLowerCase();
      const descStr = String(row.DESCRICAO || row.descricao || row.DOCUMENTO || row.documento || '').toLowerCase();
      const cpfStr = String(row.CLIENTE_CPF || row.CPF || row.cpf || '').toLowerCase();
      const fornStr = String(row.FORNECEDOR || row.fornecedor || '').toLowerCase();
      if (
        !rawClientStr.includes(q) &&
        !resolvedClientStr.includes(q) &&
        !osStr.includes(q) &&
        !descStr.includes(q) &&
        !cpfStr.includes(q) &&
        !fornStr.includes(q)
      ) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Constrói os alertas de parcelas/contas vencidas garantindo referência explícita ao nome do cliente
 */
export const buildOverdueInstallmentAlerts = (
  receberData = [],
  pagarData = [],
  clientsData = [],
  salesData = [],
  referenceTodayIso = null
) => {
  const todayStr = referenceTodayIso || new Date().toISOString().split('T')[0];
  const list = [];

  const calcDaysDiff = (isoDate) => {
    if (!isoDate) return 0;
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const [vy, vm, vd] = isoDate.split('-').map(Number);
    const tDate = new Date(ty, tm - 1, td);
    const vDate = new Date(vy, vm - 1, vd);
    return Math.max(0, Math.round((tDate.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24)));
  };

  if (Array.isArray(receberData)) {
    receberData.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const st = String(item.STATUS || item.status || 'Pendente').trim();
      const stLower = st.toLowerCase();
      if (['recebido', 'pago', 'liquidado', 'cancelado', 'cancelada', 'reparcelado'].includes(stLower)) return;

      const rawDt =
        item.DATA_VENCIMENTO ||
        item['DATA VENCIMENTO'] ||
        item.data_vencimento ||
        item.VENCIMENTO ||
        item.vencimento ||
        '';
      const isoDt = normalizeInstallmentDateIso(rawDt);
      const isMarkedOverdue = stLower === 'atrasado' || stLower === 'inadimplente' || stLower === 'vencido';

      if ((isoDt && isoDt <= todayStr) || (!isoDt && isMarkedOverdue)) {
        const clienteNome = resolveInstallmentClientName(item, clientsData, salesData);
        const osNumero = extractOSFromRow(item);
        const rawDesc = item.DESCRICAO || item.descricao || item.DOCUMENTO || item.documento || 'Parcela / Boleto';
        const valor = parseCurrencyValue(item.VALOR || item.valor || item['VALOR PARCELA']);
        const diasAtraso = isoDt ? calcDaysDiff(isoDt) : 0;
        const isDueToday = isoDt === todayStr;

        const matchParc =
          String(rawDesc).match(/(?:parcela|boleto)\s*(\d+\s*\/\s*\d+)/i) ||
          String(item.DOCUMENTO || '').match(/(\d+\s*\/\s*\d+)/);
        const parcelaCurta = item.PARCELA || (matchParc ? matchParc[1].replace(/\s+/g, '') : '');

        const descricaoComCliente = osNumero
          ? `${clienteNome} — OS #${osNumero}${parcelaCurta ? ` (Parcela ${parcelaCurta})` : ''} · ${rawDesc}`
          : `${clienteNome} — ${rawDesc}`;

        list.push({
          type: 'Receber',
          cliente: clienteNome,
          clienteNome,
          clientId: item.CLIENTE_ID || item.cliente_id || '',
          clientCpf: item.CLIENTE_CPF || item.CPF || item.cpf || '',
          osNumero,
          parcela: parcelaCurta,
          descricaoOriginal: rawDesc,
          descricao: descricaoComCliente,
          valor,
          vencimento: isoDt || String(rawDt),
          vencimentoBr: isoDt ? formatInstallmentDateBr(isoDt) : String(rawDt || '—'),
          diasAtraso,
          isDueToday,
          rawItem: item
        });
      }
    });
  }

  if (Array.isArray(pagarData)) {
    pagarData.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const st = String(item.STATUS || item.status || 'Pendente').trim();
      const stLower = st.toLowerCase();
      if (['pago', 'liquidado', 'recebido', 'cancelado', 'cancelada'].includes(stLower)) return;

      const rawDt =
        item.DATA_VENCIMENTO ||
        item['DATA VENCIMENTO'] ||
        item.data_vencimento ||
        item.VENCIMENTO ||
        item.vencimento ||
        '';
      const isoDt = normalizeInstallmentDateIso(rawDt);
      const isMarkedOverdue = stLower === 'atrasado' || stLower === 'vencido';

      if ((isoDt && isoDt <= todayStr) || (!isoDt && isMarkedOverdue)) {
        const fornecedor = (item.FORNECEDOR || item.fornecedor || item.FAVORECIDO || '').toString().trim();
        const rawDesc = item.DESCRICAO || item.descricao || 'Despesa';
        const valor = parseCurrencyValue(item.VALOR || item.valor);
        const diasAtraso = isoDt ? calcDaysDiff(isoDt) : 0;
        const isDueToday = isoDt === todayStr;

        list.push({
          type: 'Pagar',
          cliente: fornecedor || rawDesc,
          clienteNome: fornecedor || rawDesc,
          osNumero: '',
          parcela: '',
          descricaoOriginal: rawDesc,
          descricao: fornecedor ? `${fornecedor} — ${rawDesc}` : rawDesc,
          valor,
          vencimento: isoDt || String(rawDt),
          vencimentoBr: isoDt ? formatInstallmentDateBr(isoDt) : String(rawDt || '—'),
          diasAtraso,
          isDueToday,
          rawItem: item
        });
      }
    });
  }

  return list.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'Receber' ? -1 : 1;
    return String(a.vencimento || '').localeCompare(String(b.vencimento || ''));
  });
};

/**
 * Gera o cronograma de novas parcelas com distribuição exata de centavos
 */
export const generateInstallmentSchedule = ({
  totalAmount = 0,
  count = 1,
  firstDueDateIso = '',
  intervalType = '30_DIAS' // '30_DIAS' | 'MESMO_DIA_MES' | 'MONTHLY' | '15_DIAS' | 'DAYS_15' | '7_DIAS' | 'WEEKLY'
}) => {
  const numParcelas = Math.max(1, Math.min(36, parseInt(count, 10) || 1));
  const cleanTotal = Math.max(0, Math.round(parseCurrencyValue(totalAmount) * 100) / 100);

  let baseIso = normalizeInstallmentDateIso(firstDueDateIso);
  if (!baseIso) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    baseIso = normalizeInstallmentDateIso(d);
  }

  const [baseY, baseM, baseD] = baseIso.split('-').map(Number);
  const baseValueCents = Math.floor((cleanTotal * 100) / numParcelas);
  const remainderCents = Math.round(cleanTotal * 100) - baseValueCents * numParcelas;

  const schedule = [];
  for (let i = 0; i < numParcelas; i++) {
    const cents = i === numParcelas - 1 ? baseValueCents + remainderCents : baseValueCents;
    const valNum = cents / 100;

    let dueIso = baseIso;
    if (i > 0) {
      if (intervalType === 'MESMO_DIA_MES' || intervalType === 'MONTHLY') {
        const targetMonthIndex = baseM - 1 + i;
        const targetYear = baseY + Math.floor(targetMonthIndex / 12);
        const targetMonth = (targetMonthIndex % 12) + 1;
        const maxDayInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const clampedDay = Math.min(baseD, maxDayInMonth);
        dueIso = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
      } else {
        const stepDays =
          intervalType === '15_DIAS' || intervalType === 'DAYS_15'
            ? 15
            : intervalType === '7_DIAS' || intervalType === 'WEEKLY'
            ? 7
            : 30;
        const dt = new Date(baseY, baseM - 1, baseD + stepDays * i);
        dueIso = normalizeInstallmentDateIso(dt);
      }
    }

    schedule.push({
      numero: i + 1,
      totalParcelas: numParcelas,
      parcelaLabel: `${i + 1}/${numParcelas}`,
      valor: formatMoneyBr(valNum),
      valorNum: valNum,
      vencimento: dueIso,
      vencimentoBr: formatInstallmentDateBr(dueIso)
    });
  }

  return schedule;
};

/**
 * Constrói o pacote completo de dados para efetivar o Reparcelamento referente à OS no ERP
 */
export const buildReparcelamentoOSPayload = ({
  osNumber = '',
  osNumero = '',
  clientName = '',
  clientId = '',
  clientCpf = '',
  unit = '',
  unidade = 'Central',
  selectedPendingRows = null,
  selectedOldRows = null,
  entradaValor = 0,
  entradaMeioPagamento = 'Dinheiro',
  descontoValor = 0,
  acrescimoValor = 0,
  meioPagamento = 'Boleto',
  meioPagamentoParcelas = '',
  schedule = [],
  dataAcordoIso = '',
  referenceTodayIso = '',
  observacoes = '',
  observacaoRenegociacao = '',
  operador = 'ERP'
}) => {
  const effectiveOS = osNumber || osNumero || '';
  const cleanOS = String(effectiveOS).trim().replace(/^#/, '').toUpperCase() || 'AVULSO';
  const cleanClient = String(clientName || 'Cliente').trim();
  const rawMeio = meioPagamentoParcelas || meioPagamento || 'Boleto';
  const cleanMeio = /carn[eê]|boleto/i.test(String(rawMeio)) ? 'Boleto' : String(rawMeio);
  const effectiveUnit = unit || unidade || 'Central';
  const effectiveObs = observacoes || observacaoRenegociacao || '';
  const effectiveOldRows = Array.isArray(selectedPendingRows)
    ? selectedPendingRows
    : Array.isArray(selectedOldRows)
    ? selectedOldRows
    : [];

  const todayIso =
    normalizeInstallmentDateIso(dataAcordoIso || referenceTodayIso) || new Date().toISOString().split('T')[0];
  const todayBr = formatInstallmentDateBr(todayIso);

  const saldoOriginal = effectiveOldRows.reduce(
    (acc, r) => acc + parseCurrencyValue(r.VALOR || r.valor || r['VALOR PARCELA'] || 0),
    0
  );
  const entNum = Math.max(0, parseCurrencyValue(entradaValor));
  const descNum = Math.max(0, parseCurrencyValue(descontoValor));
  const acrescNum = Math.max(0, parseCurrencyValue(acrescimoValor));

  const novoSaldoParcelado = Math.max(0, Math.round((saldoOriginal - descNum + acrescNum - entNum) * 100) / 100);

  const validCustomSchedule = Array.isArray(schedule)
    ? schedule.filter(s => parseCurrencyValue(s?.valorNum !== undefined ? s.valorNum : s?.valor) > 0)
    : [];

  const effectiveSchedule =
    novoSaldoParcelado <= 0 && effectiveOldRows.length > 0
      ? []
      : validCustomSchedule.length > 0
      ? validCustomSchedule
      : novoSaldoParcelado > 0
      ? generateInstallmentSchedule({ totalAmount: novoSaldoParcelado, count: 1, firstDueDateIso: todayIso })
      : [];

  const totalScheduleSum = effectiveSchedule.reduce(
    (acc, s) => acc + parseCurrencyValue(s.valorNum !== undefined ? s.valorNum : s.valor),
    0
  );

  let entradaReceberRow = null;
  let entradaFluxoRow = null;

  if (entNum > 0) {
    entradaReceberRow = {
      id: `rec_ent_rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      CLIENTE_ID: clientId,
      CLIENTE_CPF: clientCpf,
      CPF: clientCpf,
      CLIENTE: cleanClient,
      'NOME CLIENTE': cleanClient,
      NOME: cleanClient,
      DESCRICAO: `Entrada de Reparcelamento OS #${cleanOS} (${cleanClient})`,
      DOCUMENTO: `ENTRADA REPARCELAMENTO - OS ${cleanOS}`,
      VENDA_OS: cleanOS,
      OS: cleanOS,
      PARCELA: 'ENTRADA',
      VALOR: formatMoneyBr(entNum),
      DATA_VENCIMENTO: todayIso,
      'DATA VENCIMENTO': todayIso,
      VENCIMENTO: todayIso,
      DATA_RECEBIMENTO: todayBr,
      STATUS: 'Recebido',
      MEIO_PAGAMENTO: entradaMeioPagamento || 'Dinheiro',
      CIDADE: effectiveUnit,
      LOJA: effectiveUnit,
      UNIDADE: effectiveUnit,
      REPARCELADO: true,
      ORIGEM_REPARCELAMENTO: cleanOS,
      DATA_REPARCELAMENTO: todayIso,
      OBSERVACOES: `Amortização / Entrada paga no ato do reparcelamento da OS #${cleanOS}. ${effectiveObs}`.trim(),
      DATA_CADASTRO: todayBr
    };

    entradaFluxoRow = {
      id: `mov_rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      tipo: 'RECEBIMENTO',
      dataHora: `${todayIso}T12:00:00.000Z`,
      data: todayBr,
      unidade: effectiveUnit,
      operador: operador || 'ERP',
      valor: entNum,
      formaPagamento: String(entradaMeioPagamento || 'DINHEIRO').toUpperCase(),
      motivo: `Entrada Reparcelamento OS #${cleanOS} - ${cleanClient}`,
      detalhes: `Entrada de reparcelamento ref. OS #${cleanOS} (${effectiveOldRows.length} parcela(s) renegociada(s))`,
      osNumero: cleanOS,
      CLIENTE_ID: clientId,
      CLIENTE_CPF: clientCpf,
      CPF: clientCpf
    };
  }

  const qtdParcelas = effectiveSchedule.length;
  const newInstallmentRows =
    effectiveSchedule.length > 0
      ? effectiveSchedule.map((item, idx) => {
          const num = item.numero || idx + 1;
          const tot = item.totalParcelas || qtdParcelas;
          const valFormatted = formatMoneyBr(item.valorNum !== undefined ? item.valorNum : item.valor);
          const vencIso = normalizeInstallmentDateIso(item.vencimento) || todayIso;
          return {
            id: `rec_rep_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            CLIENTE_ID: clientId,
            CLIENTE_CPF: clientCpf,
            CPF: clientCpf,
            CLIENTE: cleanClient,
            'NOME CLIENTE': cleanClient,
            NOME: cleanClient,
            DESCRICAO: `OS #${cleanOS} - Parcela ${num}/${tot} (Reparcelamento)`,
            DOCUMENTO: `BOLETO ${num}/${tot} - OS ${cleanOS} (REPARCELAMENTO)`,
            VENDA_OS: cleanOS,
            OS: cleanOS,
            PARCELA: `${num}/${tot}`,
            VALOR: valFormatted,
            'VALOR PARCELA': valFormatted,
            DATA_VENCIMENTO: vencIso,
            'DATA VENCIMENTO': vencIso,
            VENCIMENTO: vencIso,
            DATA_RECEBIMENTO: '',
            STATUS: 'Pendente',
            MEIO_PAGAMENTO: cleanMeio,
            FORMA_PAGAMENTO: cleanMeio,
            CIDADE: effectiveUnit,
            LOJA: effectiveUnit,
            UNIDADE: effectiveUnit,
            REPARCELADO: true,
            ORIGEM_REPARCELAMENTO: cleanOS,
            DATA_REPARCELAMENTO: todayIso,
            OBSERVACOES: effectiveObs
              ? `Reparcelamento OS #${cleanOS} em ${todayBr}: ${effectiveObs}`
              : `Reparcelamento referente à OS #${cleanOS} realizado em ${todayBr} (${tot}x de R$ ${valFormatted})`,
            DATA_CADASTRO: todayBr
          };
        })
      : [];

  return {
    osNumber: cleanOS,
    osNumero: cleanOS,
    clientName: cleanClient,
    clientId,
    clientCpf,
    unit: effectiveUnit,
    originalSelectedTotal: Math.round(saldoOriginal * 100) / 100,
    entradaValor: entNum,
    entradaMeioPagamento: entradaMeioPagamento || 'Dinheiro',
    descontoValor: descNum,
    acrescimoValor: acrescNum,
    totalNovoParcelado: Math.round(totalScheduleSum * 100) / 100,
    rowsToDelete: effectiveOldRows,
    entradaReceberRow,
    entradaFluxoRow,
    newInstallmentRows,
    updatedParcelasJson: JSON.stringify(
      effectiveSchedule.map((p, idx) => ({
        numero: idx + 1,
        vencimento: normalizeInstallmentDateIso(p.vencimento) || todayIso,
        valor: Math.round(parseCurrencyValue(p.valorNum !== undefined ? p.valorNum : p.valor) * 100) / 100,
        status: 'Pendente'
      }))
    ),
    summary: {
      saldoOriginal,
      entradaValor: entNum,
      descontoValor: descNum,
      acrescimoValor: acrescNum,
      novoSaldoParcelado,
      totalScheduleSum: Math.round(totalScheduleSum * 100) / 100,
      qtdParcelas: newInstallmentRows.length,
      proximoVencimento: newInstallmentRows[0]?.DATA_VENCIMENTO || ''
    }
  };
};

/**
 * Utilitários para o Termo Oficial de Acordo e Reparcelamento de Dívida
 */
export const parseAgreementCurrency = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let str = String(val).replace(/R\$\s?/gi, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].replace(/^-/, '').length >= 1) {
      str = parts.join('');
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatAgreementMoney = (val) => {
  const num = parseAgreementCurrency(val);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatAgreementDateBr = (dateVal) => {
  if (!dateVal) return 'Não definida';
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal.toLocaleDateString('pt-BR');
  }
  const str = String(dateVal).trim();
  if (str.includes('/')) return str.split(/\s+/)[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    const day = parts[2].substring(0, 2);
    return `${day}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

export const formatAgreementLongDate = (dateVal, city = 'Cajati') => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  let d = new Date();
  if (dateVal) {
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      d = dateVal;
    } else {
      const s = String(dateVal).trim();
      if (s.includes('-')) {
        const p = s.split('-');
        if (p.length === 3) {
          d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2].substring(0, 2), 10));
        }
      } else if (s.includes('/')) {
        const p = s.split('/');
        if (p.length === 3) {
          d = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
        }
      }
    }
  }
  if (isNaN(d.getTime())) d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  const safeCity = city || 'Cajati';
  return `${safeCity}/SP, ${day} de ${monthName} de ${year}`;
};

/**
 * Conversor numérico de valores em Reais para extenso em Português do Brasil
 */
export const numeroPorExtenso = (valor) => {
  const n = parseCurrencyValue(valor);
  if (n <= 0) return 'zero reais';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const converterGrupo = (num) => {
    if (num === 0) return '';
    if (num === 100) return 'cem';
    let r = [];
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (c > 0) r.push(centenas[c]);

    if (d === 1) {
      r.push(especiais[u]);
    } else {
      if (d > 1) r.push(dezenas[d]);
      if (u > 0) r.push(unidades[u]);
    }
    return r.join(' e ');
  };

  const parteInteira = Math.floor(n);
  const centavos = Math.round((n - parteInteira) * 100);

  let textoReais = '';
  if (parteInteira > 0) {
    const milhares = Math.floor(parteInteira / 1000);
    const resto = parteInteira % 1000;

    let partes = [];
    if (milhares > 0) {
      if (milhares === 1) {
        partes.push('mil');
      } else {
        partes.push(converterGrupo(milhares) + ' mil');
      }
    }
    if (resto > 0) {
      partes.push(converterGrupo(resto));
    }
    textoReais = partes.join(' e ') + (parteInteira === 1 ? ' real' : ' reais');
  }

  let textoCentavos = '';
  if (centavos > 0) {
    textoCentavos = converterGrupo(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }

  if (textoReais && textoCentavos) {
    return `${textoReais} e ${textoCentavos}`;
  }
  return textoReais || textoCentavos || 'zero reais';
};

/**
 * Construtor padronizado de payload para o Recibo Oficial de Reparcelamento (Folha A4)
 */
export const buildReparcelamentoReceiptPayload = ({
  osNumero = 'AVULSO',
  clienteNome = 'Cliente',
  clienteCpf = '',
  clienteTelefone = '',
  clienteEndereco = '',
  unidade = 'Cajati',
  operador = 'Yasmin Ótica',
  tipoPagamento = 'Parcela do Acordo',
  numeroParcela = null,
  totalParcelas = null,
  vencimentoOriginal = '',
  dataPagamento = '',
  valorPago = 0,
  meioPagamento = 'Dinheiro',
  totalAcordo = null,
  totalJaPago = null,
  saldoRestante = null,
  parcelasRestantes = null,
  observacoes = '',
  acordoId = ''
}) => {
  const osClean = String(osNumero || 'AVULSO').replace(/^#/, '');
  return {
    reciboNumero: `REC-${osClean}-${Date.now().toString().slice(-5)}`,
    dataPagamento: dataPagamento || new Date().toLocaleDateString('pt-BR'),
    horaPagamento: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    unidade,
    operador,
    clienteNome,
    clienteCpf,
    clienteTelefone,
    clienteEndereco,
    osNumero: osClean,
    acordoId: acordoId || `REP-${osClean}-${Date.now().toString().slice(-6)}`,
    tipoPagamento,
    numeroParcela,
    totalParcelas,
    vencimentoOriginal: formatAgreementDateBr(vencimentoOriginal),
    valorPago: parseCurrencyValue(valorPago),
    meioPagamento,
    totalAcordo: totalAcordo !== null && totalAcordo !== undefined ? parseCurrencyValue(totalAcordo) : null,
    totalJaPago: totalJaPago !== null && totalJaPago !== undefined ? parseCurrencyValue(totalJaPago) : null,
    saldoRestante: saldoRestante !== null && saldoRestante !== undefined ? parseCurrencyValue(saldoRestante) : null,
    parcelasRestantes,
    observacoes
  };
};

/**
 * 🛡️ Resolvedor Inteligente e Blindado da Unidade da Loja da OS
 * Prioriza o prefixo oficial da OS (REG-, JAC-, EXT-, CAJ-), seguido pelos dados da venda e loja selecionada,
 * impedindo que a cidade residencial do cliente ou fallbacks indevidos forcem Cajati.
 */
export const resolveOSUnit = (osData = {}, clientData = {}) => {
  // 1. Prefixo explícito no número da OS (REG-, JAC-, EXT-, CAJ-)
  const osNum = String(osData?.numeroOS || osData?.OS || osData?.['OS DA VENDA'] || osData?.VENDA_OS || '').toUpperCase().trim();
  if (osNum.startsWith('REG-') || osNum.startsWith('REG')) return 'Registro';
  if (osNum.startsWith('JAC-') || osNum.startsWith('JAC')) return 'Jacupiranga';
  if (osNum.startsWith('EXT-') || osNum.startsWith('EXT')) return 'Venda Externa';
  if (osNum.startsWith('CAJ-') || osNum.startsWith('CAJ')) return 'Cajati';

  // 2. Unidade explicitamente gravada na OS / Venda
  const directUnit = osData?.unidade || osData?.selectedCity || osData?.CIDADE || osData?.LOJA || osData?.Cidade;
  if (directUnit && String(directUnit).trim()) {
    const uClean = String(directUnit).trim();
    if (/registro/i.test(uClean)) return 'Registro';
    if (/jacupiranga/i.test(uClean)) return 'Jacupiranga';
    if (/extern/i.test(uClean)) return 'Venda Externa';
    if (/cajati/i.test(uClean)) return 'Cajati';
    return uClean;
  }

  // 3. Unidade da venda vinculada
  const clientSaleUnit = clientData?.['UNIDADE'] || clientData?.['LOJA'] || clientData?.['selectedCity'];
  if (clientSaleUnit && String(clientSaleUnit).trim()) {
    const uClean = String(clientSaleUnit).trim();
    if (/registro/i.test(uClean)) return 'Registro';
    if (/jacupiranga/i.test(uClean)) return 'Jacupiranga';
    if (/extern/i.test(uClean)) return 'Venda Externa';
    if (/cajati/i.test(uClean)) return 'Cajati';
    return uClean;
  }

  // 4. Fallback na cidade do cadastro ou padrão Cajati
  const fallbackCity = clientData?.['Cidade'] || clientData?.['CIDADE'] || 'Cajati';
  if (/registro/i.test(fallbackCity)) return 'Registro';
  if (/jacupiranga/i.test(fallbackCity)) return 'Jacupiranga';
  if (/extern/i.test(fallbackCity)) return 'Venda Externa';
  return 'Cajati';
};


