import { parseItemDate } from './cashShiftUtils.js';

/**
 * Utilitários de parsing, formatação e agregação para a Ficha Contábil de Movimento do Caixa
 */
export const parseMovementNum = (val) => {
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

export const formatMovementMoney = (val, showEmptyZero = false) => {
  const num = parseMovementNum(val);
  if (num === 0 && !showEmptyZero) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatMovementMoneyWithPrefix = (val) => {
  const num = parseMovementNum(val);
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Reconstrói linhas sintéticas e auditáveis de movimentação caso a lista de movimentos
 * venha vazia ou quando se reimprime um fechamento a partir do histórico consolidado.
 */
export const buildSynthesizedMovementRows = (closingData = {}) => {
  const fundoInicial = parseMovementNum(closingData.fundoInicial);
  let vendasDinheiro = parseMovementNum(closingData.vendasDinheiro);
  const totalRecebimentosDinheiro = parseMovementNum(closingData.totalRecebimentosDinheiro);
  const vendasPix = parseMovementNum(closingData.vendasPix);
  const vendasDebito = parseMovementNum(closingData.vendasDebito);
  const vendasCredito = parseMovementNum(closingData.vendasCredito);
  const vendasBoleto = parseMovementNum(closingData.vendasBoletoTotal ?? closingData.vendasBoleto);
  const totalSuprimentos = parseMovementNum(closingData.totalSuprimentos);
  const totalSangrias = parseMovementNum(closingData.totalSangrias);
  const totalSaidas = parseMovementNum(closingData.totalSaidas);
  const totalVendasGeral = parseMovementNum(closingData.totalVendas ?? closingData.totalFaturadoGeral);

  // Fallback seguro: se não houve segregação por método mas houve faturamento geral
  if (vendasDinheiro === 0 && vendasPix === 0 && vendasDebito === 0 && vendasCredito === 0 && vendasBoleto === 0 && totalVendasGeral > 0) {
    vendasDinheiro = totalVendasGeral;
  }

  const synth = [];

  if (fundoInicial > 0) {
    synth.push({
      tipo: 'ABERTURA',
      docNo: 'AB-01',
      valor: fundoInicial,
      formaPagamento: 'DINHEIRO',
      motivo: 'Fundo de Troco / Abertura de Caixa',
      cliente: 'Fundo de Troco Inicial'
    });
  }
  if (vendasDinheiro > 0) {
    synth.push({
      tipo: 'VENDA',
      docNo: 'VD-01',
      valor: vendasDinheiro,
      valorTotalOS: vendasDinheiro,
      formaPagamento: 'Dinheiro',
      motivo: 'Vendas do Turno (Dinheiro)',
      cliente: 'Consumidor Final (Dinheiro)'
    });
  }
  if (vendasPix > 0) {
    synth.push({
      tipo: 'VENDA',
      docNo: 'PX-01',
      valor: vendasPix,
      valorTotalOS: vendasPix,
      formaPagamento: 'PIX',
      motivo: 'Vendas do Turno (PIX)',
      cliente: 'Consumidor Final (PIX)'
    });
  }
  if (vendasDebito > 0) {
    synth.push({
      tipo: 'VENDA',
      docNo: 'DB-01',
      valor: vendasDebito,
      valorTotalOS: vendasDebito,
      formaPagamento: 'Cartão de Débito',
      motivo: 'Vendas do Turno (Débito)',
      cliente: 'Consumidor Final (Débito)'
    });
  }
  if (vendasCredito > 0) {
    synth.push({
      tipo: 'VENDA',
      docNo: 'CR-01',
      valor: vendasCredito,
      valorTotalOS: vendasCredito,
      formaPagamento: 'Cartão de Crédito',
      motivo: 'Vendas do Turno (Crédito)',
      cliente: 'Consumidor Final (Crédito)'
    });
  }
  if (vendasBoleto > 0) {
    synth.push({
      tipo: 'VENDA',
      docNo: 'BL-01',
      valor: 0,
      valorTotalOS: vendasBoleto,
      valorRestanteBoleto: vendasBoleto,
      formaPagamento: 'Boleto/Carnê',
      motivo: 'Vendas a Prazo (Boleto/Carnê)',
      cliente: 'Consumidor Final (Boleto)'
    });
  }
  const dateSuffix = closingData.dataAbertura || closingData.dataHoraAbertura ? ` - ${closingData.dataAbertura || closingData.dataHoraAbertura}` : '';
  if (fundoInicial > 0) {
    synth.push({
      tipo: 'ABERTURA',
      docNo: 'AB-01',
      valor: fundoInicial,
      motivo: `Fundo de Troco / Abertura de Caixa${dateSuffix}`,
      dataHora: closingData.dataAbertura || closingData.dataHoraAbertura,
      DATA: closingData.dataAbertura || closingData.dataHoraAbertura
    });
  }
  if (totalRecebimentosDinheiro > 0) {
    synth.push({
      tipo: 'RECEBIMENTO',
      docNo: 'RC-01',
      valor: totalRecebimentosDinheiro,
      formaPagamento: 'Dinheiro',
      motivo: 'Recebimento de Parcelas / Carnês',
      cliente: 'Recebimento de Parcelas'
    });
  }
  if (totalSuprimentos > 0) {
    synth.push({
      tipo: 'SUPRIMENTO',
      docNo: 'SP-01',
      valor: totalSuprimentos,
      motivo: `Suprimento / Reforço de Troco${dateSuffix}`,
      dataHora: closingData.dataAbertura || closingData.dataHoraAbertura,
      DATA: closingData.dataAbertura || closingData.dataHoraAbertura
    });
  }
  if (totalSangrias > 0) {
    synth.push({
      tipo: 'SANGRIA',
      docNo: 'SG-01',
      valor: totalSangrias,
      motivo: `Sangria de Caixa / Recolhimento${dateSuffix}`,
      dataHora: closingData.dataAbertura || closingData.dataHoraAbertura,
      DATA: closingData.dataAbertura || closingData.dataHoraAbertura
    });
  }
  if (totalSaidas > 0) {
    synth.push({
      tipo: 'SAÍDA',
      docNo: 'SD-01',
      valor: totalSaidas,
      motivo: `Pagamentos e Despesas do Caixa${dateSuffix}`,
      dataHora: closingData.dataAbertura || closingData.dataHoraAbertura,
      DATA: closingData.dataAbertura || closingData.dataHoraAbertura
    });
  }

  return synth;
};

/**
 * Prepara as linhas da tabela contábil com as 5 colunas oficiais:
 * DOC. Nº | HISTÓRICO | VENDAS | ENTRADAS | SAÍDAS
 */
export const prepareCashMovementRows = (closingData = {}, movements = [], totalRows = 24) => {
  const validMovements = (Array.isArray(movements) ? movements : []).filter(m => {
    if (!m) return false;
    const tipo = String(m.tipo || m.TIPO || '').toUpperCase().trim();
    return tipo !== 'FECHAMENTO';
  });

  let effectiveMovements = [];

  if (validMovements.length === 0) {
    effectiveMovements = buildSynthesizedMovementRows(closingData);
  } else {
    effectiveMovements = [...validMovements];

    // Se a lista de movimentações fornecida não contiver nenhuma venda, mas houver vendas registradas no fechamento,
    // sintetiza as vendas para que a folha física reflita todas as ações reais
    const hasSales = effectiveMovements.some(m => {
      const t = String(m?.tipo || m?.TIPO || '').toUpperCase().trim();
      return t === 'VENDA' || t.startsWith('VENDA');
    });

    if (!hasSales) {
      const synthSales = buildSynthesizedMovementRows(closingData).filter(s => s.tipo === 'VENDA');
      if (synthSales.length > 0) {
        effectiveMovements.push(...synthSales);
      }
    }

    // Se não houver abertura lançada mas houver fundoInicial no fechamento ou closingData
    const hasAbertura = effectiveMovements.some(m => String(m?.tipo || m?.TIPO || '').toUpperCase().trim() === 'ABERTURA');
    const closingDateStr = closingData.dataAbertura || closingData.dataHoraAbertura || closingData.dataFechamento || '';
    let fallbackFundo = parseMovementNum(closingData.fundoInicial);
    let fallbackDate = closingDateStr;
    let fallbackOp = closingData.operador || 'Operador de Caixa';

    if (!hasAbertura && fallbackFundo === 0) {
      // Procurar em movements por algum fechamento com fundoInicial
      const closingWithFundo = (Array.isArray(movements) ? movements : []).find(m => {
        const t = String(m?.tipo || m?.TIPO || '').toUpperCase().trim();
        return (t === 'FECHAMENTO' || t === 'ABERTURA') && parseMovementNum(m?.fundoInicial || m?.valor) > 0;
      });
      if (closingWithFundo) {
        fallbackFundo = parseMovementNum(closingWithFundo.fundoInicial || closingWithFundo.valor);
        fallbackDate = closingWithFundo.dataAbertura || closingWithFundo.dataHoraAbertura || closingWithFundo.data || closingWithFundo.dataHora || fallbackDate;
        fallbackOp = closingWithFundo.operador || fallbackOp;
      }
    }

    if (!hasAbertura && fallbackFundo > 0) {
      effectiveMovements.unshift({
        tipo: 'ABERTURA',
        docNo: 'AB-01',
        valor: fallbackFundo,
        formaPagamento: 'DINHEIRO',
        motivo: 'Fundo de Troco / Abertura de Caixa',
        cliente: 'Fundo de Troco Inicial',
        dataHora: fallbackDate,
        DATA: fallbackDate,
        operador: fallbackOp
      });
    }

    // Se não houver sangria lançada mas totalSangrias > 0 no fechamento
    const hasSangria = effectiveMovements.some(m => String(m?.tipo || m?.TIPO || '').toUpperCase().trim() === 'SANGRIA');
    if (!hasSangria && parseMovementNum(closingData.totalSangrias) > 0) {
      effectiveMovements.push({
        tipo: 'SANGRIA',
        docNo: `SG-${String(effectiveMovements.length + 1).padStart(2, '0')}`,
        valor: parseMovementNum(closingData.totalSangrias),
        motivo: 'Sangria de Caixa / Recolhimento',
        dataHora: closingDateStr,
        DATA: closingDateStr
      });
    }

    // Se não houver suprimento lançado mas totalSuprimentos > 0 no fechamento
    const hasSuprimento = effectiveMovements.some(m => String(m?.tipo || m?.TIPO || '').toUpperCase().trim() === 'SUPRIMENTO');
    if (!hasSuprimento && parseMovementNum(closingData.totalSuprimentos) > 0) {
      effectiveMovements.push({
        tipo: 'SUPRIMENTO',
        docNo: `SP-${String(effectiveMovements.length + 1).padStart(2, '0')}`,
        valor: parseMovementNum(closingData.totalSuprimentos),
        motivo: 'Suprimento / Reforço de Troco',
        dataHora: closingDateStr,
        DATA: closingDateStr
      });
    }

    // Se não houver saída lançada mas totalSaidas > 0 no fechamento
    const hasSaida = effectiveMovements.some(m => {
      const t = String(m?.tipo || m?.TIPO || '').toUpperCase().trim();
      return t === 'SAÍDA' || t === 'SAIDA' || t === 'DESPESA' || t === 'PAGAMENTO';
    });
    if (!hasSaida && parseMovementNum(closingData.totalSaidas) > 0) {
      effectiveMovements.push({
        tipo: 'SAÍDA',
        docNo: `SD-${String(effectiveMovements.length + 1).padStart(2, '0')}`,
        valor: parseMovementNum(closingData.totalSaidas),
        motivo: 'Saída / Despesa: Pagamento de Caixa',
        dataHora: closingDateStr,
        DATA: closingDateStr
      });
    }

    // Se não houver recebimento lançado mas totalRecebimentosDinheiro > 0 no fechamento
    const hasRecebimento = effectiveMovements.some(m => String(m?.tipo || m?.TIPO || '').toUpperCase().trim() === 'RECEBIMENTO');
    if (!hasRecebimento && parseMovementNum(closingData.totalRecebimentosDinheiro) > 0) {
      effectiveMovements.push({
        tipo: 'RECEBIMENTO',
        docNo: `RC-${String(effectiveMovements.length + 1).padStart(2, '0')}`,
        valor: parseMovementNum(closingData.totalRecebimentosDinheiro),
        formaPagamento: 'Dinheiro',
        motivo: 'Recebimento de Parcelas / Carnês',
        cliente: 'Recebimento de Parcelas',
        dataHora: closingDateStr,
        DATA: closingDateStr
      });
    }
  }

  // 🕒 Ordenação cronológica estrita por data e horário, com ABERTURA prioritária no topo
  effectiveMovements.sort((a, b) => {
    const ta = String(a?.tipo || a?.TIPO || '').toUpperCase().trim();
    const tb = String(b?.tipo || b?.TIPO || '').toUpperCase().trim();
    if (ta === 'ABERTURA' && tb !== 'ABERTURA') return -1;
    if (tb === 'ABERTURA' && ta !== 'ABERTURA') return 1;
    const da = parseItemDate(a)?.getTime() || (typeof a.timestamp === 'number' ? a.timestamp : 0);
    const db = parseItemDate(b)?.getTime() || (typeof b.timestamp === 'number' ? b.timestamp : 0);
    return da - db;
  });

  // 🛡️ Deduplica aberturas repetidas para exibir apenas o Fundo de Troco Inicial (AB-01) no topo da folha
  // evitando que múltiplos turnos ou histórico consolidado gerem dezenas de linhas de abertura que ocultem as vendas
  let seenAbertura = false;
  effectiveMovements = effectiveMovements.filter(m => {
    const tipo = String(m?.tipo || m?.TIPO || '').toUpperCase().trim();
    if (tipo === 'ABERTURA') {
      if (seenAbertura) return false;
      seenAbertura = true;
      return true;
    }
    return true;
  });

  let totalVendasCalculadas = 0;
  let totalEntradasCalculadas = 0;
  let totalSaidasCalculadas = 0;

  const parsedRows = effectiveMovements.map((m, idx) => {
    const tipo = String(m.tipo || m.TIPO || 'MOVIMENTO').toUpperCase().trim();
    const isSaida = tipo === 'SANGRIA' || tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'DESPESA' || tipo === 'PAGAMENTO';
    const isAbertura = tipo === 'ABERTURA';
    const isSuprimento = tipo === 'SUPRIMENTO';
    const isRecebimento = tipo === 'RECEBIMENTO';
    const isVenda = tipo === 'VENDA' || tipo.startsWith('VENDA');

    const rawValor = parseMovementNum(m.valor ?? m.VALOR ?? 0);
    const restBoleto = parseMovementNum(m.valorRestanteBoleto ?? m.RESTANTE ?? m['RESTANTE'] ?? 0);

    // 🌟 1. Extração robusta do VALOR TOTAL DA VENDA (não a entrada!)
    let totalOS = parseMovementNum(
      m.valorTotalOS ?? m['VALOR TOTAL'] ?? m['VALOR_TOTAL'] ?? m['VALOR DA VENDA'] ??
      m.valorTotal ?? m.totalVenda ?? m.totalOS ?? m.total ?? m['TOTAL'] ??
      (m.matchedSale && (m.matchedSale['VALOR TOTAL'] || m.matchedSale['VALOR DA VENDA'] || m.matchedSale.valorTotal || m.matchedSale.VALOR)) ??
      (m.rawSale && (m.rawSale['VALOR TOTAL'] || m.rawSale['VALOR DA VENDA'] || m.rawSale.valorTotal || m.rawSale.VALOR)) ??
      0
    );

    // 2. Extração via Regex em detalhes/motivo/descricao caso venha apenas texto formatado
    const textToScan = `${m.detalhes || ''} ${m.motivo || ''} ${m.descricao || ''}`;
    let extractedRestante = 0;
    if (textToScan) {
      if (totalOS === 0) {
        const matchTotal = textToScan.match(/Total(?:\s*da\s*OS)?\s*:\s*R\$\s*([\d\.,]+)/i) ||
                           textToScan.match(/Valor\s*Total\s*:\s*R\$\s*([\d\.,]+)/i) ||
                           textToScan.match(/Total\s*:\s*R\$\s*([\d\.,]+)/i);
        if (matchTotal) {
          totalOS = parseMovementNum(matchTotal[1]);
        }
      }
      const matchRestante = textToScan.match(/(?:Restante|Parcelado(?:\s*Boleto|\s*Carn[eê])?)\s*:\s*R\$\s*([\d\.,]+)/i);
      if (matchRestante) {
        extractedRestante = parseMovementNum(matchRestante[1]);
      }
    }

    const effectiveRestBoleto = restBoleto > 0 ? restBoleto : extractedRestante;

    // 3. Se temos entrada e restante desta venda específica, o valor total é entrada + restante
    if (totalOS === 0 && effectiveRestBoleto > 0 && rawValor > 0) {
      totalOS = rawValor + effectiveRestBoleto;
    }

    // 🛡️ NUNCA herdar closingData.totalVendas / closingData.vendasBoletoTotal em uma linha individual de VENDA!
    // Vendas com valor R$ 0,00 (cortesia, garantia ou retorno de receita, ex: Rosana Davies CAJ-018) devem permanecer R$ 0,00
    // e jamais absorver o faturamento acumulado do turno/histórico inteiro.

    const entradaSinal = parseMovementNum(
      m.valorEntrada ?? m.valorEntradaOS ?? m['VALOR ENTRADA'] ?? m.ENTRADA ?? m['ENTRADA'] ??
      (m.matchedSale && (m.matchedSale['VALOR ENTRADA'] ?? m.matchedSale['ENTRADA'] ?? m.matchedSale['SINAL'])) ??
      0
    );

    const forma = String(m.formaPagamento || m.forma || m.FORMA_PAGTO || m['FORMA DE PAGAMENTO'] || '').trim();
    const hasBoletoDebt = effectiveRestBoleto > 0 || /boleto|carn[eê]|carne|crediario|crediário|a prazo/i.test(forma);
    const isPureBoleto = isVenda && hasBoletoDebt && (entradaSinal === 0 || entradaSinal === null || entradaSinal === undefined) && (
      effectiveRestBoleto >= totalOS || rawValor === 0 || effectiveRestBoleto === rawValor || (totalOS > 0 && effectiveRestBoleto === 0)
    );
    const saleTotalValue = totalOS > 0 ? totalOS : (effectiveRestBoleto > 0 ? (entradaSinal + effectiveRestBoleto) : rawValor);
    const displayValor = saleTotalValue > 0 ? saleTotalValue : rawValor;

    // Doc Nº
    const osRaw = m.osNumero || m.os || m['OS DA VENDA'] || m['Nº DA OS'] || m.OS || (() => {
      if (m.detalhes) {
        const matchOS = String(m.detalhes).match(/OS\s*#?([A-Z0-9\-_]+)/i);
        if (matchOS) return matchOS[1];
      }
      if (m.motivo) {
        const matchOS = String(m.motivo).match(/OS\s*#?([A-Z0-9\-_]+)/i);
        if (matchOS) return matchOS[1];
      }
      return '';
    })();
    let docNo = '';
    if (m.docNo) {
      docNo = m.docNo;
    } else if (isAbertura) {
      docNo = 'AB-01';
    } else if (osRaw && isVenda) {
      docNo = `OS-${String(osRaw).replace(/^#|^os[-_ ]?/i, '').trim()}`;
    } else if (tipo === 'SANGRIA') {
      docNo = `SG-${String(idx + 1).padStart(2, '0')}`;
    } else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'DESPESA' || tipo === 'PAGAMENTO') {
      docNo = `SD-${String(idx + 1).padStart(2, '0')}`;
    } else if (isSuprimento) {
      docNo = `SP-${String(idx + 1).padStart(2, '0')}`;
    } else if (isRecebimento) {
      docNo = `RC-${String(idx + 1).padStart(2, '0')}`;
    } else if (m.id) {
      const idClean = String(m.id).replace(/\D/g, '');
      docNo = idClean ? `DOC-${idClean.slice(-4)}` : `DOC-${idx + 1}`;
    } else {
      docNo = `DOC-${idx + 1}`;
    }

    // Histórico
    let cliente = m.cliente || m.CLIENTE || m.NOME || m.nomePessoa || '';
    const responsavel = m.responsavelNome || m.responsavel || m['Responsável Nome'] || '';
    if (responsavel && !cliente.toLowerCase().includes(responsavel.toLowerCase())) {
      cliente = cliente ? `${responsavel} (${cliente})` : responsavel;
    }
    const motivo = m.motivo || m.MOTIVO || m.descricao || m.detalhes || '';

    // 🕒 Extração da data e horário para exibição ao lado de sangrias, suprimentos e aberturas
    const mDate = parseItemDate(m);
    const rawDateStr = m.dataHora || m.DATA_HORA || m.dataHoraAbertura || m.data || m.DATA || closingData.dataAbertura || closingData.dataHoraAbertura || '';
    let formattedDate = '';
    if (mDate) {
      const dStr = mDate.toLocaleDateString('pt-BR');
      const tStr = (m.hora || m.HORA || (String(rawDateStr).includes(':') ? mDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')).trim();
      formattedDate = tStr && tStr !== '00:00' ? `${dStr} às ${tStr}` : dStr;
    } else if (rawDateStr) {
      formattedDate = String(rawDateStr).trim();
    }
    const dateSuffix = formattedDate ? ` - ${formattedDate}` : '';

    let historico = '';

    if (isVenda) {
      historico = `Venda ${cliente ? `- ${cliente}` : ''}${forma ? ` (${forma})` : ''}`.trim();
    } else if (isRecebimento) {
      let displayRec = cliente;
      if (!displayRec && motivo) {
        displayRec = String(motivo).replace(/^Recebimento\s*(?:Boleto|Carn[eê]|Parcela)?\s*[-–:]?\s*/i, '').trim();
      }
      historico = `Recebimento Parcela ${displayRec ? `- ${displayRec}` : ''}${forma ? ` (${forma})` : ''}`.trim();
    } else if (tipo === 'SANGRIA') {
      historico = `${motivo ? (String(motivo).startsWith('Sangria') ? motivo : `Sangria: ${motivo}`) : 'Sangria de Caixa / Recolhimento'}${dateSuffix}`;
    } else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'DESPESA' || tipo === 'PAGAMENTO') {
      historico = `${motivo ? (String(motivo).startsWith('Saída') ? motivo : `Saída / Despesa: ${motivo}`) : 'Saída / Despesa de Caixa'}${dateSuffix}`;
    } else if (isSuprimento) {
      historico = `${motivo ? (String(motivo).startsWith('Suprimento') ? motivo : `Suprimento: ${motivo}`) : 'Suprimento / Reforço de Troco'}${dateSuffix}`;
    } else if (isAbertura) {
      historico = `${motivo || 'Fundo de Troco / Abertura de Caixa'}${dateSuffix}`;
    } else {
      historico = `${motivo || cliente || 'Movimentação Diversa'}${forma ? ` (${forma})` : ''}`;
    }

    // Valores: VENDAS, ENTRADAS, SAÍDAS
    let venda = '';
    let entrada = '';
    let saida = '';

    if (isVenda) {
      // 🌟 COLUNA VENDAS: Exibe SEMPRE o VALOR TOTAL DA VENDA (contrato/faturado integral; se cortesia/garantia R$ 0,00, mantém 0)
      const saleTotal = totalOS > 0
        ? totalOS
        : (effectiveRestBoleto > 0 ? (entradaSinal + effectiveRestBoleto) : (displayValor > 0 ? displayValor : rawValor));
      const vNum = saleTotal > 0 ? saleTotal : 0;
      venda = vNum;
      totalVendasCalculadas += vNum;

      // 🌟 COLUNA ENTRADAS: Exibe APENAS o valor recebido imediatamente no caixa (sinal/entrada ou à vista)
      let receivedNow = 0;
      if (hasBoletoDebt) {
        if (entradaSinal > 0) {
          receivedNow = entradaSinal;
        } else if (effectiveRestBoleto > 0 && totalOS > effectiveRestBoleto) {
          receivedNow = Number((totalOS - effectiveRestBoleto).toFixed(2));
        } else {
          // Venda 100% no Boleto a prazo com entrada zero (ex: Valdeci, Sidinei)
          receivedNow = 0;
        }
      } else {
        // Venda sem boleto (Cartão, Débito, PIX, Dinheiro integral)
        receivedNow = (entradaSinal > 0 && effectiveRestBoleto > 0)
          ? entradaSinal
          : (rawValor > 0 ? rawValor : totalOS);
      }

      if (receivedNow > 0) {
        entrada = receivedNow;
        totalEntradasCalculadas += receivedNow;
      }
    } else if (isSaida) {
      saida = displayValor;
      totalSaidasCalculadas += displayValor;
    } else if (isRecebimento || isSuprimento) {
      entrada = displayValor;
      totalEntradasCalculadas += displayValor;
    } else if (isAbertura) {
      // 🌟 Fundo inicial consta como ENTRADA na linha de Abertura de Caixa
      const fundoVal = displayValor > 0 ? displayValor : parseMovementNum(closingData.fundoInicial);
      entrada = fundoVal;
    } else {
      entrada = displayValor;
      totalEntradasCalculadas += displayValor;
    }

    return {
      docNo,
      historico,
      venda: isVenda ? formatMovementMoney(venda, true) : (venda ? formatMovementMoney(venda) : ''),
      entrada: entrada ? formatMovementMoney(entrada) : '',
      saida: saida ? formatMovementMoney(saida) : ''
    };
  });

  const emptyRowsNeeded = Math.max(0, totalRows - parsedRows.length);
  const blankRows = Array.from({ length: emptyRowsNeeded }, () => ({
    docNo: '',
    historico: '',
    venda: '',
    entrada: '',
    saida: ''
  }));

  const allDisplayRows = [...parsedRows, ...blankRows];

  // Totais Finais
  const fundoInicial = parseMovementNum(closingData.fundoInicial);
  const vendasDinheiro = parseMovementNum(closingData.vendasDinheiro);
  const totalRecebimentosDinheiro = parseMovementNum(closingData.totalRecebimentosDinheiro);
  const vendasPix = parseMovementNum(closingData.vendasPix);
  const vendasDebito = parseMovementNum(closingData.vendasDebito);
  const vendasCredito = parseMovementNum(closingData.vendasCredito);
  const vendasBoleto = parseMovementNum(closingData.vendasBoletoTotal ?? closingData.vendasBoleto);
  const totalSuprimentos = parseMovementNum(closingData.totalSuprimentos);
  const totalSangrias = parseMovementNum(closingData.totalSangrias);
  const totalSaidas = parseMovementNum(closingData.totalSaidas);

  // Extração minuciosa e auditável dos métodos de pagamento a partir dos movimentos
  let suprimentosCalculados = 0;
  let sangriasCalculadas = 0;
  let dinheiroEntradasCalculadas = 0;
  let pixCalculados = 0;
  let debitoCalculados = 0;
  let creditoCalculados = 0;
  let boletoCalculados = 0;

  effectiveMovements.forEach(m => {
    if (!m) return;
    const tipo = String(m.tipo || m.TIPO || '').toUpperCase().trim();
    const fp = String(
      m.formaPagamento || m.forma || m.FORMA_PAGTO || m['FORMA DE PAGAMENTO'] ||
      m.formaEntradaOS || (m.matchedSale && (m.matchedSale['FORMA DE PAGAMENTO'] || m.matchedSale['FORMA_PAGTO'])) ||
      (m.rawSale && (m.rawSale['FORMA DE PAGAMENTO'] || m.rawSale['FORMA_PAGTO'])) || ''
    ).toUpperCase();

    const val = parseMovementNum(m.valor ?? m.VALOR ?? 0);
    const entradaSinal = parseMovementNum(
      m.valorEntrada ?? m.ENTRADA ?? m.valorEntradaOS ?? m['VALOR ENTRADA'] ??
      (m.matchedSale && (m.matchedSale['VALOR ENTRADA'] ?? m.matchedSale['ENTRADA'])) ?? 0
    );
    const restBoleto = parseMovementNum(
      m.valorRestanteBoleto ?? m.RESTANTE ?? m['RESTANTE'] ??
      (m.matchedSale && (m.matchedSale['RESTANTE'] ?? m.matchedSale['VALOR RESTANTE'])) ?? 0
    );
    const totalOSVal = parseMovementNum(
      m.valorTotalOS ?? m['VALOR TOTAL'] ?? m['VALOR DA VENDA'] ?? m.valorTotal ??
      (m.matchedSale && (m.matchedSale['VALOR TOTAL'] ?? m.matchedSale['VALOR DA VENDA'])) ?? val
    );

    if (tipo === 'SUPRIMENTO') {
      suprimentosCalculados += val;
      dinheiroEntradasCalculadas += val;
    } else if (tipo === 'SANGRIA') {
      sangriasCalculadas += val;
    } else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'DESPESA' || tipo === 'PAGAMENTO') {
      // Saídas contabilizadas em totalSaidasCalculadas
    } else if (tipo === 'ABERTURA') {
      // Fundo inicial
    } else if (tipo === 'RECEBIMENTO') {
      if (fp.includes('PIX') || fp.includes('TRANSFERENCIA') || fp.includes('TRANSFERÊNCIA')) {
        pixCalculados += val;
      } else if (fp.includes('DEBITO') || fp.includes('DÉBITO')) {
        debitoCalculados += val;
      } else if (fp.includes('CREDITO') || fp.includes('CRÉDITO') || fp.includes('CARTAO') || fp.includes('CARTÃO')) {
        creditoCalculados += val;
      } else {
        dinheiroEntradasCalculadas += val;
      }
    } else if (tipo === 'VENDA' || tipo.startsWith('VENDA')) {
      const hasBoleto = restBoleto > 0 || /boleto|carn[eê]|carne|crediario|crediário|a prazo/i.test(fp);
      let vRec = 0;
      if (hasBoleto) {
        if (entradaSinal > 0) {
          vRec = entradaSinal;
        } else if (restBoleto > 0 && totalOSVal > restBoleto) {
          vRec = Number((totalOSVal - restBoleto).toFixed(2));
        } else {
          vRec = 0;
        }
      } else {
        vRec = entradaSinal > 0 && restBoleto > 0 ? entradaSinal : (val > 0 ? val : totalOSVal);
      }

      // Identificar a forma de pagamento da entrada imediata
      const fpEntrada = String(
        m.formaEntradaOS || m.formaEntrada ||
        (m.matchedSale && (m.matchedSale['FORMA ENTRADA'] || m.matchedSale['FORMA_ENTRADA'])) ||
        fp
      ).toUpperCase();

      if (vRec > 0) {
        if (fpEntrada.includes('PIX') || fpEntrada.includes('TRANSFERENCIA') || fpEntrada.includes('TRANSFERÊNCIA')) {
          pixCalculados += vRec;
        } else if (fpEntrada.includes('DEBITO') || fpEntrada.includes('DÉBITO')) {
          debitoCalculados += vRec;
        } else if (fpEntrada.includes('CREDITO') || fpEntrada.includes('CRÉDITO') || fpEntrada.includes('CARTAO') || fpEntrada.includes('CARTÃO')) {
          creditoCalculados += vRec;
        } else {
          dinheiroEntradasCalculadas += vRec;
        }
      }

      // Adicionar o restante no Boleto / Carnê (a prazo)
      if (restBoleto > 0) {
        boletoCalculados += restBoleto;
      } else if (hasBoleto && totalOSVal > vRec) {
        boletoCalculados += Number((totalOSVal - vRec).toFixed(2));
      }
    }
  });

  const suprimentosEfetivos = suprimentosCalculados > 0 ? suprimentosCalculados : totalSuprimentos;
  const sangriasEfetivas = sangriasCalculadas > 0 ? sangriasCalculadas : totalSangrias;
  const totalSaidasFinal = totalSaidasCalculadas > 0 ? totalSaidasCalculadas : (sangriasEfetivas + totalSaidas);

  const totalChequesPixDetalhes = Math.max(pixCalculados, vendasPix);
  const totalDebitoDetalhes = Math.max(debitoCalculados, vendasDebito);
  const totalCreditoDetalhes = Math.max(creditoCalculados, vendasCredito);
  const totalBoletoDetalhes = Math.max(boletoCalculados, vendasBoleto);
  const totalDinheiroDetalhes = Math.max(
    dinheiroEntradasCalculadas,
    (vendasDinheiro + totalRecebimentosDinheiro + suprimentosEfetivos)
  );

  const totalGeralDetalhes = totalDinheiroDetalhes + totalChequesPixDetalhes + totalDebitoDetalhes + totalCreditoDetalhes + totalBoletoDetalhes;

  const fallbackTotalVendas = parseMovementNum(
    closingData.totalVendas ?? closingData.totalFaturadoGeral ??
    (vendasDinheiro + vendasPix + vendasDebito + vendasCredito + vendasBoleto)
  );
  const totalVendasFinal = Math.max(totalVendasCalculadas, fallbackTotalVendas, totalGeralDetalhes);

  const fallbackTotalEntradas = totalDinheiroDetalhes + totalChequesPixDetalhes + totalDebitoDetalhes + totalCreditoDetalhes;
  const totalEntradasFinal = totalEntradasCalculadas > 0 ? totalEntradasCalculadas : fallbackTotalEntradas;

  const saldoAnterior = fundoInicial;
  const totalEntradasGaveta = dinheiroEntradasCalculadas > 0
    ? dinheiroEntradasCalculadas
    : (vendasDinheiro + totalRecebimentosDinheiro + suprimentosEfetivos);

  const saldoAtualCalculado = saldoAnterior + totalEntradasGaveta - totalSaidasFinal;
  const saldoAtual = closingData.dinheiroContado !== undefined && parseMovementNum(closingData.dinheiroContado) > 0
    ? parseMovementNum(closingData.dinheiroContado)
    : saldoAtualCalculado;

  const demaisConferencia = totalChequesPixDetalhes + totalDebitoDetalhes + totalCreditoDetalhes + totalBoletoDetalhes;

  return {
    rows: allDisplayRows,
    totalVendasFinal,
    totalEntradasFinal,
    totalSaidasFinal,
    saldoAnterior,
    saldoAtual,
    demaisConferencia,
    totalDinheiroDetalhes,
    totalChequesPixDetalhes,
    totalDebitoDetalhes,
    totalCreditoDetalhes,
    totalBoletoDetalhes,
    totalGeralDetalhes
  };
};
