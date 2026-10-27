/**
 * 📦 xmlUtils.js
 * Utilitários para Geração, Exportação e Importação de XML
 * Sistema Yasmin Ótica
 *
 * Substitui arquivos CSV por XML estruturado e padronizado para:
 * - Histórico de Vendas e Ordens de Serviço (OS)
 * - Histórico e Movimentações de Fluxo de Caixa
 * - Estoque de Armações, Lentes, Acessórios e Brindes
 * - Suporte a importação de arquivos XML fiscais (NFe/NFCe) e tabelas XML
 */

/**
 * Converte qualquer texto de cabeçalho ou chave de objeto em uma tag XML válida
 * Ex: "SKU / Referência" -> "sku_referencia"
 * Ex: "Preço de Venda (R$)" -> "preco_venda"
 */
export const sanitizeXmlTag = (key) => {
  if (!key) return 'campo';
  return String(key)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9_]/g, '_')   // substitui símbolos por _
    .replace(/_+/g, '_')              // remove múltiplos underscores
    .replace(/^_|_$/g, '')            // remove underscore no início/fim
    .toLowerCase() || 'campo';
};

/**
 * Escapa caracteres especiais para manter o XML válido (RFC 3470 / W3C)
 */
export const escapeXmlText = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Converte array de objetos JavaScript em um documento XML válido e formatado
 */
export const jsonToXml = (items = [], rootTag = 'dados', itemTag = 'registro', metadata = {}) => {
  const metaAttrs = Object.entries(metadata)
    .map(([k, v]) => `${sanitizeXmlTag(k)}="${escapeXmlText(v)}"`)
    .join(' ');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<${rootTag}${metaAttrs ? ' ' + metaAttrs : ''}>\n`;

  items.forEach((item, index) => {
    xml += `  <${itemTag} index="${index + 1}">\n`;
    if (typeof item === 'object' && item !== null) {
      Object.entries(item).forEach(([k, v]) => {
        const tag = sanitizeXmlTag(k);
        const text = escapeXmlText(v);
        xml += `    <${tag}>${text}</${tag}>\n`;
      });
    } else {
      xml += `    <valor>${escapeXmlText(item)}</valor>\n`;
    }
    xml += `  </${itemTag}>\n`;
  });

  xml += `</${rootTag}>\n`;
  return xml;
};

/**
 * Dispara o download de um arquivo XML no navegador com charset UTF-8
 */
export const downloadXmlFile = (xmlContent, filename = 'exportacao.xml') => {
  try {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Erro ao disparar download do XML:', err);
    return false;
  }
};

/**
 * Construtor de XML específico para Histórico de Vendas e Ordens de Serviço (OS)
 */
export const buildSalesHistoryXml = (salesRows = [], options = {}) => {
  const {
    loja = 'Todas',
    vendedor = 'Todos',
    periodo = 'Geral'
  } = options;

  const metadata = {
    sistema: 'Yasmin Ótica ERP & PDV',
    tipo: 'Histórico de Vendas e Ordens de Serviço',
    gerado_em: new Date().toISOString(),
    loja: loja,
    vendedor: vendedor,
    periodo: periodo,
    total_vendas: salesRows.length
  };

  const formattedRows = salesRows.map((sale, idx) => {
    return {
      numero: idx + 1,
      id_venda: sale.id || '',
      os_numero: sale['OS DA VENDA'] || sale['OS'] || sale['VENDA_OS'] || sale.osNumero || '—',
      cliente_nome: sale['CLIENTE'] || sale['Nome Completo'] || sale.cliente || '',
      cliente_cpf: sale['CPF'] || sale['CPF / CNPJ'] || '',
      data_venda: sale['DATA  DA VENDA'] || sale['DATA DA VENDA'] || sale['DATA_VENDA'] || sale['Data da Venda'] || sale['data_venda'] || sale.dataVenda || sale['DATA'] || sale['Data'] || sale.dataHora || '',
      vendedor: sale['VENDEDOR'] || sale.vendedor || '',
      loja_unidade: sale['UNIDADE'] || sale['CIDADE'] || sale.unidade || 'Central',
      valor_total: sale['TOTAL VENDA'] || sale['VALOR TOTAL'] || sale.valorTotal || '0,00',
      valor_entrada: sale['VALOR ENTRADA'] || sale.valorEntrada || '0,00',
      saldo_restante: sale['RESTANTE'] || sale.restante || '0,00',
      forma_pagamento: sale['FORMA DE PAGAMENTO'] || sale.formaPagamento || '',
      status_os: sale['STATUS_OS'] || sale['SITUAÇÃO'] || sale.status || 'Concluída',
      armacao: sale['ARMAÇÃO'] || sale.armacao || '',
      lente: sale['LENTE'] || sale['PRODUTO'] || sale.lente || '',
      laboratorio: sale['LABORATÓRIO'] || sale.laboratorio || '',
      observacoes: sale['OBSERVAÇÕES'] || sale.observacoes || ''
    };
  });

  return jsonToXml(formattedRows, 'historico_vendas_otica', 'venda', metadata);
};

/**
 * Construtor de XML específico para Movimentações e Histórico de Caixa
 */
export const buildCashHistoryXml = (movements = [], options = {}) => {
  const {
    loja = 'Todas',
    operador = 'Todos',
    periodo = 'Geral'
  } = options;

  const metadata = {
    sistema: 'Yasmin Ótica ERP & PDV',
    tipo: 'Histórico e Movimentações de Caixa',
    gerado_em: new Date().toISOString(),
    loja: loja,
    operador: operador,
    periodo: periodo,
    total_movimentacoes: movements.length
  };

  const formattedRows = movements.map((mov, idx) => {
    return {
      numero: idx + 1,
      id_movimento: mov.id || '',
      data_hora: mov.dataHora || mov.DATA || '',
      unidade: mov.unidade || mov.CIDADE || 'Central',
      operador: mov.operador || mov.VENDEDOR || '',
      tipo_operacao: mov.tipo || '',
      valor: mov.valor || 0,
      forma_pagamento: mov.formaPagamento || '',
      motivo: mov.motivo || '',
      categoria: mov.despesaCategoria || mov.categoria || '',
      detalhes: mov.detalhes || mov.OBSERVAÇÕES || '',
      os_vinculada: mov.osNumero || mov['OS DA VENDA'] || '',
      faturado_boleto_total: mov.vendasBoletoTotal || mov.vendasBoleto || '',
      faturado_boleto_qtd: mov.vendasBoletoQtd || ''
    };
  });

  return jsonToXml(formattedRows, 'historico_caixa_otica', 'movimento', metadata);
};

/**
 * Construtor de XML específico para Estoque (Armações, Lentes, Acessórios e Brindes)
 */
export const buildStockXml = (stockItems = [], options = {}) => {
  const {
    tipo = 'Geral',
    unidade = 'Todas',
    filtro = 'Completo'
  } = options;

  const metadata = {
    sistema: 'Yasmin Ótica ERP & PDV',
    tipo: `Estoque de ${tipo}`,
    gerado_em: new Date().toISOString(),
    unidade: unidade,
    filtro_aplicado: filtro,
    total_produtos: stockItems.length
  };

  const formattedRows = stockItems.map((item, idx) => {
    return {
      numero: idx + 1,
      id_produto: item.id || '',
      unidade: item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central',
      marca: item.MARCA || item.marca || '',
      modelo: item.MODELO || item.modelo || item.NOME || item.nome || '',
      categoria: item.CATEGORIA || item.categoria || tipo,
      sku_referencia: item.REFERENCIA_SKU || item.referencia_sku || item.SKU || item.CODIGO || '',
      cor: item.COR || item.cor || '',
      tamanho: item.TAMANHO || item.tamanho || '',
      material: item.MATERIAL || item.material || '',
      quantidade_estoque: item.ESTOQUE || item.estoque || item._qtdEstoque || 0,
      status_estoque: item._statusEstoque || ((parseInt(item.ESTOQUE || item.estoque || 0, 10) <= 2) ? 'Crítico' : 'Normal'),
      preco_custo: item.PRECO_COMPRA || item.preco_compra || item._precoCusto || '0,00',
      preco_venda: item.PRECO_VENDA || item.preco_venda || item._precoVenda || '0,00',
      lucro_unitario: item._lucroUnitario || '',
      margem_percentual: item._margemPercent || '',
      valor_imobilizado: item._valorImobilizado || '',
      indice_refracao: item.INDICE_REFRACAO || item.indice_refracao || '',
      tratamento: item.TRATAMENTO || item.tratamento || '',
      esferico_min: item.ESFERICO_MIN || item.esferico_min || '',
      esferico_max: item.ESFERICO_MAX || item.esferico_max || '',
      cilindrico_min: item.CILINDRICO_MIN || item.cilindrico_min || '',
      cilindrico_max: item.CILINDRICO_MAX || item.cilindrico_max || '',
      observacoes: item.OBSERVACOES || item.observacoes || '',
      data_cadastro: item.DATA_CADASTRO || item.data_cadastro || ''
    };
  });

  return jsonToXml(formattedRows, 'estoque_otica', 'produto', metadata);
};

/**
 * Construtor de XML específico para Levantamento Financeiro Geral (Contas a Receber, Contas a Pagar e Fluxo de Caixa)
 */
export const buildFinancialSummaryXml = (receberRows = [], pagarRows = [], fluxoRows = [], options = {}) => {
  const {
    unidade = 'Todas',
    periodo = 'Geral'
  } = options;

  let totalReceberPendente = 0;
  let totalReceberPago = 0;
  (receberRows || []).forEach(r => {
    const v = typeof r.VALOR === 'number' ? r.VALOR : parseFloat(String(r.VALOR || r.valor || 0).replace(/\./g, '').replace(',', '.')) || 0;
    const st = String(r.STATUS || r.status || '').toLowerCase();
    if (st.includes('pago') || st.includes('recebido')) {
      totalReceberPago += v;
    } else {
      totalReceberPendente += v;
    }
  });

  let totalPagarPendente = 0;
  let totalPagarPago = 0;
  (pagarRows || []).forEach(p => {
    const v = typeof p.VALOR === 'number' ? p.VALOR : parseFloat(String(p.VALOR || p.valor || 0).replace(/\./g, '').replace(',', '.')) || 0;
    const st = String(p.STATUS || p.status || '').toLowerCase();
    if (st.includes('pago') || st.includes('liquidado')) {
      totalPagarPago += v;
    } else {
      totalPagarPendente += v;
    }
  });

  const metadata = {
    sistema: 'Yasmin Ótica ERP & PDV',
    tipo: 'Levantamento Financeiro Consolidado',
    gerado_em: new Date().toISOString(),
    unidade: unidade,
    periodo: periodo,
    total_duplicatas_receber: (receberRows || []).length,
    total_contas_pagar: (pagarRows || []).length,
    total_movimentacoes_caixa: (fluxoRows || []).length,
    total_receber_pendente: totalReceberPendente.toFixed(2),
    total_receber_pago: totalReceberPago.toFixed(2),
    total_pagar_pendente: totalPagarPendente.toFixed(2),
    total_pagar_pago: totalPagarPago.toFixed(2)
  };

  const formattedReceber = (receberRows || []).map((r, idx) => ({
    numero: idx + 1,
    id_duplicata: r.id || '',
    cliente_nome: r.CLIENTE || r.cliente || r['Nome Completo'] || '',
    cliente_cpf: r.CPF || r.cpf || r['CPF / CNPJ'] || '',
    os_numero: r.OS || r['OS DA VENDA'] || r.osNumero || '',
    documento: r.DOCUMENTO || r.documento || '',
    valor: r.VALOR || r.valor || '0,00',
    data_vencimento: r.VENCIMENTO || r.vencimento || r['DATA VENCIMENTO'] || '',
    status_cobranca: r.STATUS || r.status || 'Pendente',
    data_recebimento: r.DATA_RECEBIMENTO || r.dataRecebimento || '',
    loja_unidade: r.UNIDADE || r.CIDADE || r.unidade || 'Central'
  }));

  const formattedPagar = (pagarRows || []).map((p, idx) => ({
    numero: idx + 1,
    id_conta: p.id || '',
    descricao_fornecedor: p.DESCRICAO || p.FORNECEDOR || p.descricao || p.fornecedor || '',
    categoria: p.CATEGORIA || p.categoria || 'Geral',
    valor: p.VALOR || p.valor || '0,00',
    data_vencimento: p.VENCIMENTO || p.vencimento || '',
    status: p.STATUS || p.status || 'Pendente',
    data_pagamento: p.DATA_PAGAMENTO || p.dataPagamento || '',
    loja_unidade: p.UNIDADE || p.CIDADE || p.unidade || 'Central'
  }));

  const formattedFluxo = (fluxoRows || []).map((m, idx) => ({
    numero: idx + 1,
    id_movimento: m.id || '',
    data_hora: m.dataHora || m.DATA || '',
    tipo: m.tipo || '',
    valor: m.valor || '0,00',
    forma_pagamento: m.formaPagamento || '',
    motivo: m.motivo || '',
    operador: m.operador || m.VENDEDOR || '',
    loja_unidade: m.unidade || m.CIDADE || 'Central'
  }));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<levantamento_financeiro_otica`;
  Object.entries(metadata).forEach(([k, v]) => {
    xml += ` ${k}="${String(v).replace(/"/g, '&quot;')}"`;
  });
  xml += `>\n`;

  // Seção Contas a Receber
  xml += `  <contas_a_receber total="${formattedReceber.length}">\n`;
  formattedReceber.forEach(item => {
    xml += `    <duplicata index="${item.numero}">\n`;
    Object.entries(item).forEach(([k, v]) => {
      if (k !== 'numero') {
        const textVal = String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `      <${k}>${textVal}</${k}>\n`;
      }
    });
    xml += `    </duplicata>\n`;
  });
  xml += `  </contas_a_receber>\n`;

  // Seção Contas a Pagar
  xml += `  <contas_a_pagar total="${formattedPagar.length}">\n`;
  formattedPagar.forEach(item => {
    xml += `    <conta index="${item.numero}">\n`;
    Object.entries(item).forEach(([k, v]) => {
      if (k !== 'numero') {
        const textVal = String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `      <${k}>${textVal}</${k}>\n`;
      }
    });
    xml += `    </conta>\n`;
  });
  xml += `  </contas_a_pagar>\n`;

  // Seção Fluxo de Caixa
  xml += `  <fluxo_de_caixa total="${formattedFluxo.length}">\n`;
  formattedFluxo.forEach(item => {
    xml += `    <movimentacao index="${item.numero}">\n`;
    Object.entries(item).forEach(([k, v]) => {
      if (k !== 'numero') {
        const textVal = String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `      <${k}>${textVal}</${k}>\n`;
      }
    });
    xml += `    </movimentacao>\n`;
  });
  xml += `  </fluxo_de_caixa>\n`;

  xml += `</levantamento_financeiro_otica>`;
  return xml;
};

/**
 * Parser de XML para converter arquivos XML (NFe, estoques, cadastros) em objetos JavaScript
 * para que o sistema consiga importar sem precisar de CSV ou Excel!
 */
export const parseXmlToObjects = (xmlText) => {
  if (!xmlText || typeof xmlText !== 'string') return [];
  
  try {
    if (typeof DOMParser === 'undefined') {
      // Fallback para Node.js / ambientes de teste sem DOMParser nativo
      const records = [];
      const detMatches = xmlText.match(/<det[\s\S]*?<\/det>/gi);
      if (detMatches && detMatches.length > 0) {
        detMatches.forEach((detStr, idx) => {
          const getTag = (tag) => {
            const m = detStr.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            return m ? m[1].trim() : '';
          };
          records.push({
            'Nº': idx + 1,
            'Código': getTag('cProd'),
            'Nome / Descrição': getTag('xProd'),
            'NCM': getTag('NCM'),
            'CFOP': getTag('CFOP'),
            'Unidade': getTag('uCom') || 'UN',
            'Quantidade': parseFloat(getTag('qCom') || '0'),
            'Preço Custo (R$)': getTag('vUnCom') || '0,00',
            'Valor Total': getTag('vProd') || '0,00'
          });
        });
        return records;
      }

      const itemRegex = /<(produto|venda|movimento|registro|item)[^>]*>([\s\S]*?)<\/\1>/gi;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
        const innerContent = itemMatch[2];
        const row = {};
        const fieldRegex = /<([a-zA-Z0-9_]+)[^>]*>([\s\S]*?)<\/\1>/gi;
        let m;
        while ((m = fieldRegex.exec(innerContent)) !== null) {
          row[m[1]] = m[2].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        }
        if (Object.keys(row).length > 0) records.push(row);
      }
      return records;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.warn('Erro ao interpretar XML:', parserError.textContent);
      return [];
    }

    // Procura por nós filhos repetidos comuns
    // Se for NFe fiscal: procura por <det> -> <prod>
    const nfeItems = xmlDoc.querySelectorAll('det');
    if (nfeItems && nfeItems.length > 0) {
      const records = [];
      nfeItems.forEach((det, idx) => {
        const prod = det.querySelector('prod');
        if (prod) {
          records.push({
            'Nº': idx + 1,
            'Código': prod.querySelector('cProd')?.textContent || '',
            'Nome / Descrição': prod.querySelector('xProd')?.textContent || '',
            'NCM': prod.querySelector('NCM')?.textContent || '',
            'CFOP': prod.querySelector('CFOP')?.textContent || '',
            'Unidade': prod.querySelector('uCom')?.textContent || 'UN',
            'Quantidade': parseFloat(prod.querySelector('qCom')?.textContent || '0'),
            'Preço Custo (R$)': prod.querySelector('vUnCom')?.textContent || '0,00',
            'Valor Total': prod.querySelector('vProd')?.textContent || '0,00'
          });
        }
      });
      return records;
    }

    // Se for XML padrão do sistema ou de outro ERP: procura elementos filhos de 2º nível
    const root = xmlDoc.documentElement;
    if (!root) return [];

    const children = Array.from(root.children);
    if (children.length === 0) return [];

    const records = [];
    children.forEach((childNode) => {
      // Se tiver sub-nós (elemento repetido como <registro>, <venda>, <produto>, <movimento>)
      if (childNode.children && childNode.children.length > 0) {
        const row = {};
        Array.from(childNode.children).forEach(sub => {
          row[sub.tagName] = sub.textContent.trim();
        });
        records.push(row);
      }
    });

    return records;
  } catch (err) {
    console.error('Falha geral no parser de XML:', err);
    return [];
  }
};
