import { normalizeOSNumber, isMatchingOS } from './osDeletionUtils.js';

/**
 * Normaliza qualquer formato de data (YYYY-MM-DD, DD/MM/YYYY, Date, Timestamp) e horário
 * gerando um pacote temporal consistente com todas as variantes necessárias pelo sistema.
 */
export const buildNormalizedDateTime = (dateInput, timeInput = null) => {
  if (!dateInput) {
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const [y, m, d] = isoDate.split('-');
    const brDate = `${d}/${m}/${y}`;
    const timeStr = timeInput || now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const [h, min] = timeStr.split(':').map(Number);
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d), h || 12, min || 0, 0);
    return {
      isoDate,
      brDate,
      timeStr,
      isoDateTime: dateObj.toISOString(),
      brDateTime: `${brDate} às ${timeStr}`,
      timestamp: dateObj.getTime(),
      dateObj
    };
  }

  let y, m, d;
  let dateObj = null;

  if (dateInput instanceof Date) {
    if (!isNaN(dateInput.getTime())) {
      y = String(dateInput.getFullYear());
      m = String(dateInput.getMonth() + 1).padStart(2, '0');
      d = String(dateInput.getDate()).padStart(2, '0');
    }
  } else if (typeof dateInput === 'number' && dateInput > 30000 && dateInput < 60000) {
    // Serial do Excel
    const dt = new Date((dateInput - 25569) * 86400 * 1000);
    if (!isNaN(dt.getTime())) {
      y = String(dt.getFullYear());
      m = String(dt.getMonth() + 1).padStart(2, '0');
      d = String(dt.getDate()).padStart(2, '0');
    }
  } else {
    const str = String(dateInput).trim();
    const datePart = str.split(/[T\s]/)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      [y, m, d] = datePart.split('-');
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
      const parts = datePart.split('/');
      d = parts[0].padStart(2, '0');
      m = parts[1].padStart(2, '0');
      y = parts[2];
    } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(datePart)) {
      const parts = datePart.split('-');
      d = parts[0].padStart(2, '0');
      m = parts[1].padStart(2, '0');
      y = parts[2];
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        y = String(parsed.getFullYear());
        m = String(parsed.getMonth() + 1).padStart(2, '0');
        d = String(parsed.getDate()).padStart(2, '0');
      }
    }
  }

  if (!y || !m || !d) {
    const fallbackNow = new Date();
    y = String(fallbackNow.getFullYear());
    m = String(fallbackNow.getMonth() + 1).padStart(2, '0');
    d = String(fallbackNow.getDate()).padStart(2, '0');
  }

  const isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const brDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;

  let timeStr = '12:00';
  if (timeInput && typeof timeInput === 'string' && /^\d{1,2}:\d{2}/.test(timeInput.trim())) {
    timeStr = timeInput.trim().slice(0, 5);
  } else if (typeof dateInput === 'string' && dateInput.includes(':')) {
    const match = dateInput.match(/(\d{1,2}:\d{2})/);
    if (match) timeStr = match[1];
  }

  const [h, min] = timeStr.split(':').map(Number);
  dateObj = new Date(Number(y), Number(m) - 1, Number(d), h || 12, min || 0, 0);

  return {
    isoDate,
    brDate,
    timeStr,
    isoDateTime: dateObj.toISOString(),
    brDateTime: `${brDate} às ${timeStr}`,
    timestamp: dateObj.getTime(),
    dateObj
  };
};

/**
 * Sincroniza a data de pagamento / venda de uma OS em todas as entidades do sistema:
 * 1. Registro da Venda (Registro_Vendas / BD MARKETING)
 * 2. Lançamentos de entrada no Fluxo de Caixa (FLUXO_CAIXA)
 * 3. Parcelas vinculadas em Contas a Receber (CONTAS_RECEBER)
 */
export const syncOSPaymentDate = async ({
  osNumber,
  saleRow = null,
  newDate,
  newTime = null,
  data = {},
  onUpdateRow
}) => {
  if (!onUpdateRow) return;

  const normalized = buildNormalizedDateTime(newDate, newTime || saleRow?.hora || saleRow?.HORA);
  const cleanOS = normalizeOSNumber(osNumber || saleRow?.['OS DA VENDA'] || saleRow?.['OS'] || saleRow?.VENDA_OS);
  const targetSaleId = saleRow?.id || saleRow?._id || null;

  // 1. Sincronizar Venda em Registro_Vendas ou BD MARKETING
  const salesCollections = ['Registro_Vendas', 'BD MARKETING'];
  for (const sheet of salesCollections) {
    const list = Array.isArray(data[sheet]) ? data[sheet] : [];
    for (const r of list) {
      if (!r) continue;
      const isTarget = (saleRow && (r === saleRow || (r.id && r.id === targetSaleId))) ||
                       (cleanOS && isMatchingOS(r, cleanOS, targetSaleId));

      if (isTarget) {
        const updatedSale = {
          ...r,
          'DATA  DA VENDA': normalized.brDate,
          'DATA DA VENDA': normalized.brDate,
          'DATA_VENDA': normalized.brDate,
          'Data da Venda': normalized.brDate,
          'data_venda': normalized.brDate,
          'DATA': normalized.brDate,
          dataVenda: normalized.isoDate,
          data: normalized.brDate,
          dataHora: normalized.isoDateTime,
          DATA_HORA: normalized.brDateTime,
          timestamp: normalized.timestamp,
          hora: normalized.timeStr,
          HORA: normalized.timeStr
        };
        try {
          await onUpdateRow(sheet, r, updatedSale);
        } catch (err) {
          console.warn(`Aviso ao atualizar data em ${sheet}:`, err);
        }
      }
    }
  }

  // 2. Sincronizar lançamentos de entrada no FLUXO_CAIXA
  const fluxoList = Array.isArray(data['FLUXO_CAIXA']) ? data['FLUXO_CAIXA'] : [];
  for (const m of fluxoList) {
    if (!m) continue;
    const isTarget = isMatchingOS(m, cleanOS, targetSaleId) &&
                     ['venda', 'entrada', 'sinal'].includes(String(m.tipo || '').toLowerCase());

    if (isTarget) {
      const updatedMov = {
        ...m,
        data: normalized.brDate,
        DATA: normalized.brDate,
        dataHora: normalized.isoDateTime,
        DATA_HORA: normalized.brDateTime,
        timestamp: normalized.timestamp,
        hora: normalized.timeStr,
        HORA: normalized.timeStr
      };
      try {
        await onUpdateRow('FLUXO_CAIXA', m, updatedMov);
      } catch (err) {
        console.warn('Aviso ao sincronizar data no FLUXO_CAIXA:', err);
      }
    }
  }

  return normalized;
};

/**
 * Sincroniza a data de pagamento / quitação de uma parcela entre CONTAS_RECEBER e FLUXO_CAIXA
 */
export const syncInstallmentPaymentDate = async ({
  installmentRow,
  newPaymentDate,
  newPaymentTime = null,
  data = {},
  onUpdateRow,
  onAddRow,
  currentUser = null
}) => {
  if (!installmentRow || !onUpdateRow) return;

  const normalized = buildNormalizedDateTime(newPaymentDate, newPaymentTime);
  const cleanOS = normalizeOSNumber(installmentRow.VENDA_OS || installmentRow.OS || installmentRow.venda_os);
  const doc = installmentRow.DOCUMENTO || installmentRow.documento || '';
  const desc = installmentRow.DESCRICAO || installmentRow.descricao || '';
  const osNum = cleanOS || normalizeOSNumber(doc) || normalizeOSNumber(desc);

  // 1. Atualizar parcela em CONTAS_RECEBER
  const updatedInstallment = {
    ...installmentRow,
    STATUS: 'Recebido',
    status: 'Recebido',
    DATA_PAGAMENTO: normalized.brDate,
    DATA_RECEBIMENTO: normalized.brDate,
    data_pagamento: normalized.isoDate,
    data_recebimento: normalized.isoDate,
    dataPagamento: normalized.isoDate,
    dataRecebimento: normalized.isoDate,
    PAGAMENTO_DATA: normalized.brDate,
    RECEBIMENTO_DATA: normalized.brDate
  };

  try {
    await onUpdateRow('CONTAS_RECEBER', installmentRow, updatedInstallment);
  } catch (err) {
    console.warn('Aviso ao atualizar DATA_PAGAMENTO em CONTAS_RECEBER:', err);
  }

  // 2. Sincronizar ou lançar no FLUXO_CAIXA
  const fluxoList = Array.isArray(data['FLUXO_CAIXA']) ? data['FLUXO_CAIXA'] : [];
  let existingMov = null;

  if (installmentRow.id) {
    existingMov = fluxoList.find(m => m && (m.installmentId === installmentRow.id || m.parcelaId === installmentRow.id));
  }

  if (!existingMov && osNum) {
    existingMov = fluxoList.find(m => {
      if (!m || String(m.tipo || '').toUpperCase() !== 'RECEBIMENTO') return false;
      const mDet = String(m.detalhes || m.motivo || '').toLowerCase();
      const docLower = doc.toLowerCase();
      const descLower = desc.toLowerCase();
      return isMatchingOS(m, osNum) && (docLower && mDet.includes(docLower) || (descLower && mDet.includes(descLower)));
    });
  }

  if (existingMov) {
    // Atualiza movimento existente para a nova data
    const updatedMov = {
      ...existingMov,
      data: normalized.brDate,
      DATA: normalized.brDate,
      dataHora: normalized.isoDateTime,
      DATA_HORA: normalized.brDateTime,
      timestamp: normalized.timestamp,
      hora: normalized.timeStr,
      HORA: normalized.timeStr
    };
    try {
      await onUpdateRow('FLUXO_CAIXA', existingMov, updatedMov);
    } catch (err) {
      console.warn('Aviso ao atualizar data no FLUXO_CAIXA para parcela:', err);
    }
  } else if (onAddRow) {
    // Lança novo recebimento com a data correta
    const valorNum = typeof installmentRow.VALOR === 'number'
      ? installmentRow.VALOR
      : parseFloat(String(installmentRow.VALOR || installmentRow.valor || 0).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    const clienteNome = installmentRow.CLIENTE || installmentRow.cliente || 'Cliente';
    const clientId = installmentRow.CLIENTE_ID || installmentRow.cliente_id || '';
    const clientCpf = installmentRow.CLIENTE_CPF || installmentRow.CPF || installmentRow.cpf || '';
    const unidade = installmentRow.CIDADE || installmentRow.UNIDADE || installmentRow.cidade || 'Cajati';

    const newMov = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      installmentId: installmentRow.id || '',
      osNumero: osNum,
      tipo: 'RECEBIMENTO',
      dataHora: normalized.isoDateTime,
      DATA_HORA: normalized.brDateTime,
      timestamp: normalized.timestamp,
      data: normalized.brDate,
      DATA: normalized.brDate,
      hora: normalized.timeStr,
      HORA: normalized.timeStr,
      unidade,
      operador: currentUser?.username || 'Financeiro',
      valor: valorNum,
      formaPagamento: installmentRow.MEIO_PAGAMENTO || installmentRow.FORMA_PAGAMENTO || 'DINHEIRO',
      motivo: `Recebimento Parcela - ${clienteNome}`,
      detalhes: osNum ? `OS #${osNum} - ${doc || desc || 'Quitação Parcela'}` : (doc || desc || 'Quitação Parcela'),
      CLIENTE_ID: clientId,
      CLIENTE_CPF: clientCpf,
      CPF: clientCpf
    };

    try {
      await onAddRow('FLUXO_CAIXA', newMov);
    } catch (err) {
      console.warn('Aviso ao lançar recebimento retroativo no FLUXO_CAIXA:', err);
    }
  }

  return normalized;
};
