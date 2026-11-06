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
      motivo: 'Abertura de Caixa (Fundo de Troco)',
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
      motivo: 'Suprimento / Reforço de Troco'
    });
  }
  if (totalSangrias > 0) {
    synth.push({
      tipo: 'SANGRIA',
      docNo: 'SG-01',
      valor: totalSangrias,
      motivo: 'Sangria de Caixa / Recolhimento'
    });
  }
  if (totalSaidas > 0) {
    synth.push({
      tipo: 'SAÍDA',
      docNo: 'SD-01',
      valor: totalSaidas,
      motivo: 'Pagamentos e Despesas do Caixa'
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

    // Se não houver sangria lançada mas totalSangrias > 0 no fechamento
    const hasSangria = effectiveMovements.some(m => String(m?.tipo || m?.TIPO || '').toUpperCase().trim() === 'SANGRIA');
    if (!hasSangria && parseMovementNum(closingData.totalSangrias) > 0) {
      effectiveMovements.push({
        tipo: 'SANGRIA',
        docNo: `SG-${String(effectiveMovements.length + 1).padStart(2, '0')}`,
        valor: parseMovementNum(closingData.totalSangrias),
        motivo: 'Sangria de Caixa / Recolhimento'
      });
    }

    // Se não houver suprimento lançado mas totalSuprimentos > 0 no fechamento
    const hasSuprimento = effectiveMovements.some(m => String(m?.tipo || m?.TIPO || '').toUpperCase().trim() === 'SUPRIMENTO');
    if (!hasSuprimento && parseMovementNum(closingData.totalSuprimentos) > 0) {
      effectiveMovements.push({
        tipo: 'SUPRIMENTO',
        docNo: `SP-${String(effectiveMovements.length + 1).padStart(2, '0')}`,
        valor: parseMovementNum(closingData.totalSuprimentos),
        motivo: 'Suprimento / Reforço de Troco'
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
        cliente: 'Recebimento de Parcelas'
      });
    }
  }

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

    const rawValor = parseMovementNum(m.valor ?? m.VALOR ?? m['VALOR TOTAL'] ?? m['VALOR DA VENDA'] ?? 0);
    const restBoleto = parseMovementNum(m.valorRestanteBoleto ?? m.RESTANTE ?? m['RESTANTE'] ?? 0);
    const totalOS = parseMovementNum(m.valorTotalOS ?? m['VALOR TOTAL'] ?? m['VALOR_TOTAL'] ?? m['VALOR DA VENDA'] ?? 0);
    const entradaSinal = parseMovementNum(m.valorEntrada ?? m['VALOR ENTRADA'] ?? m.ENTRADA ?? m['ENTRADA'] ?? 0);

    const forma = String(m.formaPagamento || m.forma || m.FORMA_PAGTO || m['FORMA DE PAGAMENTO'] || '').trim();
    const isPureBoleto = isVenda && rawValor === 0 && (restBoleto > 0 || /boleto|carn[eê]/i.test(forma));
    const displayValor = isPureBoleto ? (restBoleto || totalOS) : rawValor;

    // Doc Nº
    const osRaw = m.osNumero || m.os || m['OS DA VENDA'] || m['Nº DA OS'] || m.OS || '';
    let docNo = '';
    if (m.docNo) {
      docNo = m.docNo;
    } else if (osRaw) {
      docNo = `OS-${String(osRaw).replace(/^#|^os[-_ ]?/i, '').trim()}`;
    } else if (isSaida) {
      docNo = `SG-${String(idx + 1).padStart(2, '0')}`;
    } else if (isSuprimento) {
      docNo = `SP-${String(idx + 1).padStart(2, '0')}`;
    } else if (isRecebimento) {
      docNo = `RC-${String(idx + 1).padStart(2, '0')}`;
    } else if (isAbertura) {
      docNo = 'AB-01';
    } else if (m.id) {
      const idClean = String(m.id).replace(/\D/g, '');
      docNo = idClean ? `DOC-${idClean.slice(-4)}` : `DOC-${idx + 1}`;
    } else {
      docNo = `DOC-${idx + 1}`;
    }

    // Histórico
    const cliente = m.cliente || m.CLIENTE || m.NOME || '';
    const motivo = m.motivo || m.MOTIVO || m.descricao || m.detalhes || '';
    let historico = '';

    if (isVenda) {
      historico = `Venda ${cliente ? `- ${cliente}` : ''}${forma ? ` (${forma})` : ''}`.trim();
    } else if (isRecebimento) {
      historico = `Recebimento Parcela ${cliente ? `- ${cliente}` : ''}${forma ? ` (${forma})` : ''}`.trim();
    } else if (tipo === 'SANGRIA') {
      historico = `Sangria: ${motivo || 'Retirada de Caixa'}`;
    } else if (isSuprimento) {
      historico = `Suprimento: ${motivo || 'Entrada de Troco Adicional'}`;
    } else if (isAbertura) {
      historico = `Fundo de Troco / Abertura de Caixa`;
    } else {
      historico = `${motivo || cliente || 'Movimentação Diversa'}${forma ? ` (${forma})` : ''}`;
    }

    // Valores: VENDAS, ENTRADAS, SAÍDAS
    let venda = '';
    let entrada = '';
    let saida = '';

    if (isVenda) {
      const saleTotal = totalOS > 0 ? totalOS : (isPureBoleto ? (restBoleto || displayValor) : (entradaSinal > 0 && restBoleto > 0 ? (entradaSinal + restBoleto) : displayValor));
      const vNum = saleTotal > 0 ? saleTotal : displayValor;
      venda = vNum;
      totalVendasCalculadas += vNum;

      const receivedNow = entradaSinal > 0 ? entradaSinal : (isPureBoleto ? 0 : rawValor);
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
      // Fundo inicial é SALDO ANTERIOR (não soma nas entradas do dia para evitar duplicidade contábil)
    } else {
      entrada = displayValor;
      totalEntradasCalculadas += displayValor;
    }

    return {
      docNo,
      historico,
      venda: venda ? formatMovementMoney(venda) : '',
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

  // Extração de suprimentos, sangrias e entradas em espécie a partir dos movimentos
  let suprimentosCalculados = 0;
  let sangriasCalculadas = 0;
  let dinheiroEntradasCalculadas = 0;

  effectiveMovements.forEach(m => {
    if (!m) return;
    const tipo = String(m.tipo || m.TIPO || '').toUpperCase().trim();
    const fp = String(m.formaPagamento || m.forma || '').toUpperCase();
    const val = parseMovementNum(m.valor ?? 0);
    const entradaSinal = parseMovementNum(m.valorEntrada ?? m.ENTRADA ?? 0);
    const isDinheiro = fp.includes('DINHEIRO') || !fp;

    if (tipo === 'SUPRIMENTO') {
      suprimentosCalculados += val;
      dinheiroEntradasCalculadas += val;
    } else if (tipo === 'SANGRIA') {
      sangriasCalculadas += val;
    } else if (tipo === 'VENDA' && isDinheiro) {
      const vRec = entradaSinal > 0 ? entradaSinal : val;
      dinheiroEntradasCalculadas += vRec;
    } else if (tipo === 'RECEBIMENTO' && isDinheiro) {
      dinheiroEntradasCalculadas += val;
    }
  });

  const suprimentosEfetivos = suprimentosCalculados > 0 ? suprimentosCalculados : totalSuprimentos;
  const sangriasEfetivas = sangriasCalculadas > 0 ? sangriasCalculadas : totalSangrias;
  const totalSaidasFinal = totalSaidasCalculadas > 0 ? totalSaidasCalculadas : (sangriasEfetivas + totalSaidas);

  const fallbackTotalVendas = parseMovementNum(
    closingData.totalVendas ?? closingData.totalFaturadoGeral ??
    (vendasDinheiro + vendasPix + vendasDebito + vendasCredito + vendasBoleto)
  );
  const totalVendasFinal = totalVendasCalculadas > 0 ? totalVendasCalculadas : fallbackTotalVendas;

  const fallbackTotalEntradas = vendasDinheiro + totalRecebimentosDinheiro + vendasPix + vendasDebito + vendasCredito + suprimentosEfetivos;
  const totalEntradasFinal = totalEntradasCalculadas > 0 ? totalEntradasCalculadas : fallbackTotalEntradas;

  const totalDinheiroDetalhes = (dinheiroEntradasCalculadas > 0 && vendasDinheiro === 0)
    ? dinheiroEntradasCalculadas
    : (vendasDinheiro + totalRecebimentosDinheiro + suprimentosEfetivos);

  const totalChequesPixDetalhes = vendasPix;
  const totalDebitoDetalhes = vendasDebito;
  const totalCreditoDetalhes = vendasCredito;
  const totalBoletoDetalhes = vendasBoleto;
  const totalGeralDetalhes = totalDinheiroDetalhes + totalChequesPixDetalhes + totalDebitoDetalhes + totalCreditoDetalhes + totalBoletoDetalhes;

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
