import { isSameClient } from './firebaseSync.js';

/**
 * Normaliza qualquer formato de identificador de OS (ex: "#1050", "OS-1050", "os 1050", 1050)
 * para uma string limpa de comparação.
 */
export const normalizeOSNumber = (raw) => {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str || str === '—' || str === '-' || str === 'N/A') return '';
  return str.replace(/^#/, '').replace(/^os-?/i, '').replace(/^#/, '').trim().toLowerCase();
};

const parseCurrency = (val) => {
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

/**
 * Verifica se qualquer entidade (parcela de Contas a Receber, movimento de Fluxo de Caixa, etc.)
 * pertence a uma determinada OS ou ID de venda.
 */
export const isMatchingOS = (item, targetOS, targetSaleId = null) => {
  if (!item) return false;
  const cleanTarget = normalizeOSNumber(targetOS);
  if (!cleanTarget && !targetSaleId) return false;

  // 1. Checagem direta por saleId / vendaId
  if (targetSaleId) {
    const sId = String(item.saleId || item.vendaId || item.SALE_ID || item.VENDA_ID || '').trim();
    if (sId && sId === String(targetSaleId).trim()) return true;
  }

  if (!cleanTarget) return false;

  // 2. Checagem direta por campos dedicados de OS
  const directOSFields = [
    item.osNumero,
    item.OS_NUMERO,
    item.VENDA_OS,
    item.venda_os,
    item.OS,
    item.os,
    item['OS DA VENDA'],
    item['OS DA  VENDA'],
    item['Nº DA OS'],
    item['OS_VENDA']
  ];
  for (const f of directOSFields) {
    if (f && normalizeOSNumber(f) === cleanTarget) return true;
  }

  // 3. Checagem textual em documento, descrição, motivo ou detalhes
  const textCorpus = [
    item.DOCUMENTO,
    item.documento,
    item.DESCRICAO,
    item.descricao,
    item.MOTIVO,
    item.motivo,
    item.DETALHES,
    item.detalhes,
    item.OBSERVACOES,
    item.observacoes
  ].filter(Boolean).map(v => String(v).toLowerCase()).join(' ');

  if (!textCorpus) return false;

  // Regex estrita com fronteira de palavra para evitar que OS "10" case com "1050"
  const escapedTarget = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const osRegex = new RegExp(`(?:os|ordem de servi[çc]o|#|venda)\\s*#?\\s*${escapedTarget}\\b`, 'i');
  if (osRegex.test(textCorpus)) return true;

  // Caso seja avulso ou menção literal ao número isolado se houver marcador de OS
  if (textCorpus.includes(`os #${cleanTarget}`) || textCorpus.includes(`os ${cleanTarget}`) || textCorpus.includes(`os-${cleanTarget}`)) {
    return true;
  }

  return false;
};

/**
 * Localiza todas as entidades relacionadas à OS em todas as coleções do sistema:
 * - Vendas em Registro_Vendas / BD MARKETING
 * - Parcelas em CONTAS_RECEBER (pendentes e pagas)
 * - Movimentações em FLUXO_CAIXA
 * - Itens de estoque a devolver (CAD_ARMACOES, CAD_LENTES, CAD_BRINDES)
 * - Cadastro do cliente a recalcular (CLIENTES_CADASTRADOS)
 */
export const findOSRelatedEntities = ({
  osNumber,
  saleRow = null,
  data = {},
  clientsData = []
}) => {
  const cleanTarget = normalizeOSNumber(osNumber || saleRow?.['OS DA VENDA'] || saleRow?.['OS'] || saleRow?.VENDA_OS);
  const targetSaleId = saleRow?.id || saleRow?._id || null;

  // 1. Localizar linha principal de Vendas
  const salesCollections = ['Registro_Vendas', 'BD MARKETING'];
  const matchedSales = [];

  for (const sheet of salesCollections) {
    const list = Array.isArray(data[sheet]) ? data[sheet] : [];
    list.forEach(row => {
      if (!row || typeof row !== 'object') return;
      if (saleRow && (row === saleRow || (row.id && row.id === targetSaleId))) {
        matchedSales.push({ sheet, row });
      } else if (cleanTarget && isMatchingOS(row, cleanTarget, targetSaleId)) {
        matchedSales.push({ sheet, row });
      }
    });
  }

  // Obter o registro representativo da venda
  const primarySale = saleRow || (matchedSales.length > 0 ? matchedSales[0].row : null);
  const effectiveSaleId = targetSaleId || primarySale?.id || primarySale?._id || null;

  // 2. Localizar todas as parcelas em CONTAS_RECEBER
  const contasReceberList = Array.isArray(data['CONTAS_RECEBER']) ? data['CONTAS_RECEBER'] : [];
  const matchedInvoices = contasReceberList.filter(inv => isMatchingOS(inv, cleanTarget, effectiveSaleId));

  const pendingInvoices = matchedInvoices.filter(inv => {
    const st = String(inv.STATUS || inv.status || 'Pendente').trim().toLowerCase();
    return !['recebido', 'pago', 'liquidado'].includes(st);
  });
  const paidInvoices = matchedInvoices.filter(inv => {
    const st = String(inv.STATUS || inv.status || 'Pendente').trim().toLowerCase();
    return ['recebido', 'pago', 'liquidado'].includes(st);
  });

  const totalInvoicesValue = matchedInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR || inv.valor || 0), 0);
  const pendingInvoicesValue = pendingInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR || inv.valor || 0), 0);
  const paidInvoicesValue = paidInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR || inv.valor || 0), 0);

  // 3. Localizar todas as movimentações no FLUXO_CAIXA (entradas de caixa, recebimentos de parcelas, etc.)
  const fluxoCaixaList = Array.isArray(data['FLUXO_CAIXA']) ? data['FLUXO_CAIXA'] : [];
  const matchedCashMovements = fluxoCaixaList.filter(mov => isMatchingOS(mov, cleanTarget, effectiveSaleId));
  const totalCashMovementsValue = matchedCashMovements.reduce((sum, m) => sum + parseCurrency(m.valor || m.VALOR || 0), 0);

  // 4. Localizar itens para devolução ao estoque
  const stockItemsToRestore = [];
  const saleStore = primarySale?.UNIDADE || primarySale?.CIDADE || primarySale?.LOJA || primarySale?.unidade || '';

  // (a) Armação
  const armacoesList = Array.isArray(data['CAD_ARMACOES']) ? data['CAD_ARMACOES'] : [];
  const armacaoRaw = String(primarySale?.['ARMAÇÃO'] || primarySale?.['ARMACAO'] || primarySale?.MODELO || primarySale?.PRODUTO || '').trim();
  if (armacaoRaw && armacaoRaw !== '—' && armacaoRaw !== 'não informada' && armacaoRaw.toLowerCase() !== 'armação própria') {
    const lowerArm = armacaoRaw.toLowerCase();
    const matchedArmacao = armacoesList.find(a => {
      if (!a) return false;
      const storeA = String(a.UNIDADE || a.CIDADE || a.LOJA || '').trim().toLowerCase();
      if (saleStore && storeA && storeA !== saleStore.toLowerCase()) return false;
      const nomeA = String(a.MODELO || a.MARCA || a.REFERENCIA_SKU || a.NOME || '').trim().toLowerCase();
      return nomeA && (nomeA === lowerArm || lowerArm.includes(nomeA) || (a.REFERENCIA_SKU && lowerArm.includes(String(a.REFERENCIA_SKU).toLowerCase())));
    }) || armacoesList.find(a => {
      const nomeA = String(a.MODELO || a.MARCA || a.REFERENCIA_SKU || a.NOME || '').trim().toLowerCase();
      return nomeA && (nomeA === lowerArm || lowerArm.includes(nomeA));
    });

    if (matchedArmacao) {
      stockItemsToRestore.push({
        sheet: 'CAD_ARMACOES',
        item: matchedArmacao,
        qty: 1,
        name: armacaoRaw
      });
    }
  }

  // (b) Lente
  const lentesList = Array.isArray(data['CAD_LENTES']) ? data['CAD_LENTES'] : [];
  const lenteRaw = String(primarySale?.['LENTE'] || primarySale?.['TIPO DE LENTE'] || primarySale?.TRATAMENTO || '').trim();
  if (lenteRaw && lenteRaw !== '—' && lenteRaw !== 'não informada') {
    const lowerLente = lenteRaw.toLowerCase();
    const matchedLente = lentesList.find(l => {
      if (!l) return false;
      const storeL = String(l.UNIDADE || l.CIDADE || l.LOJA || '').trim().toLowerCase();
      if (saleStore && storeL && storeL !== saleStore.toLowerCase()) return false;
      const descL = `${l.MARCA || ''} ${l.MODELO || ''} ${l.TRATAMENTO || ''}`.trim().toLowerCase();
      return descL && (descL === lowerLente || lowerLente.includes(descL));
    });
    if (matchedLente) {
      stockItemsToRestore.push({
        sheet: 'CAD_LENTES',
        item: matchedLente,
        qty: 1,
        name: lenteRaw
      });
    }
  }

  // (c) Brindes
  const brindesList = Array.isArray(data['CAD_BRINDES']) ? data['CAD_BRINDES'] : [];
  const brindeRaw = String(primarySale?.['BRINDE'] || primarySale?.['BRINDES'] || primarySale?.brinde || '').trim();
  if (brindeRaw && brindeRaw !== '—' && brindeRaw !== 'Nenhum' && brindeRaw !== 'Não') {
    const lowerBrinde = brindeRaw.toLowerCase();
    const matchedBrinde = brindesList.find(b => {
      if (!b) return false;
      const nomeB = String(b.NOME || b.MODELO || b.REFERENCIA_SKU || '').trim().toLowerCase();
      return nomeB && (nomeB === lowerBrinde || lowerBrinde.includes(nomeB));
    });
    if (matchedBrinde) {
      stockItemsToRestore.push({
        sheet: 'CAD_BRINDES',
        item: matchedBrinde,
        qty: 1,
        name: brindeRaw
      });
    }
  }

  // 5. Localizar Cliente e calcular novo saldo devedor real
  const allClients = Array.isArray(clientsData) && clientsData.length > 0 
    ? clientsData 
    : (Array.isArray(data['CLIENTES_CADASTRADOS']) ? data['CLIENTES_CADASTRADOS'] : []);

  let matchedClient = null;
  if (primarySale) {
    matchedClient = allClients.find(c => isSameClient(c, primarySale)) || null;
  }
  if (!matchedClient && matchedInvoices.length > 0) {
    matchedClient = allClients.find(c => isSameClient(c, matchedInvoices[0])) || null;
  }

  // Calcular novo saldo devedor real com base em parcelas restantes que NÃO são dessa OS
  let newClientDebt = 0;
  if (matchedClient) {
    const otherInvoices = contasReceberList.filter(inv => {
      if (isMatchingOS(inv, cleanTarget, effectiveSaleId)) return false;
      if (!isSameClient(matchedClient, inv)) return false;
      const st = String(inv.STATUS || inv.status || 'Pendente').trim().toLowerCase();
      return !['recebido', 'pago', 'liquidado', 'cancelado', 'cancelada', 'reparcelado'].includes(st);
    });
    newClientDebt = otherInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR || inv.valor || 0), 0);
  }

  return {
    osNumber: cleanTarget,
    primarySale,
    matchedSales,
    matchedInvoices,
    pendingInvoices,
    paidInvoices,
    totalInvoicesValue,
    pendingInvoicesValue,
    paidInvoicesValue,
    matchedCashMovements,
    totalCashMovementsValue,
    stockItemsToRestore,
    matchedClient,
    newClientDebt
  };
};

/**
 * Executa a Exclusão da OS com opção flexível para a dívida:
 * @param {boolean} deleteDebt - Se true (padrão): Apaga todas as parcelas em CONTAS_RECEBER e zera a dívida desta OS no cliente.
 *                               Se false: Exclui a OS da produção, mas mantém as parcelas em CONTAS_RECEBER e o saldo devedor do cliente ativo para cobrança.
 */
export const executeOSCascadeDeletion = async ({
  osNumber,
  saleRow = null,
  data = {},
  clientsData = [],
  onDeleteRow,
  onUpdateRow,
  deleteDebt = true
}) => {
  if (!onDeleteRow) {
    throw new Error('Função onDeleteRow é obrigatória para exclusão em cascata.');
  }

  const entities = findOSRelatedEntities({
    osNumber,
    saleRow,
    data,
    clientsData
  });

  const logs = [];

  // 1. Tratamento de parcelas em CONTAS_RECEBER (Apagar Dívida vs Manter Dívida)
  if (deleteDebt) {
    for (const inv of entities.matchedInvoices) {
      try {
        await onDeleteRow('CONTAS_RECEBER', inv);
      } catch (err) {
        console.warn('Aviso ao excluir parcela de CONTAS_RECEBER:', err);
      }
    }
    logs.push(`${entities.matchedInvoices.length} parcela(s) / dívida(s) no Contas a Receber eliminada(s).`);
  } else {
    logs.push(`${entities.matchedInvoices.length} parcela(s) no Contas a Receber MANTIDAS ativas para cobrança.`);
  }

  // 2. Deletar movimentações de FLUXO_CAIXA (se deleteDebt for true, remove entradas da OS para limpeza total)
  if (deleteDebt) {
    for (const mov of entities.matchedCashMovements) {
      try {
        await onDeleteRow('FLUXO_CAIXA', mov);
      } catch (err) {
        console.warn('Aviso ao excluir movimentação de FLUXO_CAIXA:', err);
      }
    }
    logs.push(`${entities.matchedCashMovements.length} movimentação(ões) no Histórico de Caixa eliminada(s).`);
  }

  // 3. Devolver produtos ao Estoque
  if (onUpdateRow && entities.stockItemsToRestore.length > 0) {
    for (const stockEntry of entities.stockItemsToRestore) {
      try {
        const currStock = parseInt(stockEntry.item.ESTOQUE || stockEntry.item.estoque || stockEntry.item.QTD || '0', 10);
        const newStock = Math.max(0, currStock + (stockEntry.qty || 1));
        await onUpdateRow(stockEntry.sheet, stockEntry.item, {
          ...stockEntry.item,
          ESTOQUE: String(newStock)
        });
      } catch (err) {
        console.warn(`Aviso ao devolver estoque em ${stockEntry.sheet}:`, err);
      }
    }
    logs.push(`${entities.stockItemsToRestore.length} item(ns) devolvido(s) ao estoque.`);
  }

  // 4. Atualizar o cadastro do cliente em CLIENTES_CADASTRADOS (apenas se deleteDebt for true)
  if (deleteDebt && onUpdateRow && entities.matchedClient) {
    try {
      const updatedClient = {
        ...entities.matchedClient,
        'Valor Devido': entities.newClientDebt > 0 ? entities.newClientDebt.toFixed(2).replace('.', ',') : '0,00',
        'Status de Pagamento': entities.newClientDebt === 0 ? 'Em dia' : entities.matchedClient['Status de Pagamento']
      };
      await onUpdateRow('CLIENTES_CADASTRADOS', entities.matchedClient, updatedClient);
      logs.push(`Saldo devedor do cliente recalculado para R$ ${entities.newClientDebt.toFixed(2).replace('.', ',')}.`);
    } catch (err) {
      console.warn('Aviso ao atualizar saldo do cliente:', err);
    }
  } else if (!deleteDebt && entities.matchedClient) {
    logs.push('Saldo devedor do cliente preservado inalterado.');
  }

  // 5. Deletar o registro de venda em Registro_Vendas / BD MARKETING
  for (const saleEntry of entities.matchedSales) {
    try {
      await onDeleteRow(saleEntry.sheet, saleEntry.row);
    } catch (err) {
      console.warn(`Aviso ao excluir venda em ${saleEntry.sheet}:`, err);
    }
  }
  logs.push(`Registro de venda da OS #${entities.osNumber} excluído.`);

  return {
    success: true,
    osNumber: entities.osNumber,
    entities,
    logs
  };
};
