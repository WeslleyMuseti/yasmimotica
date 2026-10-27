export const parseCurrency = (val) => {
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

export const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const getStockHealthStatus = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num) || num <= 0) return 'esgotado';
  if (num <= 2) return 'critico';
  return 'normal';
};

/**
 * Sanitiza valores de texto para prevenir Formula / CSV Injection (CWE-1236)
 * Se o valor começar com '=', '+', '-', '@', '\t', '\r', prefixa com apóstrofo
 */
export const sanitizeFormula = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  const str = String(val);
  const trimmed = str.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + str;
  }
  return str;
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Filtra e ordena produtos de estoque (armações ou lentes) conforme presets e filtros inteligentes.
 * Suporta cruzamento automático com histórico de vendas (Registro_Vendas / BD MARKETING).
 * Define propriedades internas como NÃO-ENUMERÁVEIS para não poluir tabelas, formulários ou banco de dados.
 */
export function filterAndSortStock(items = [], salesData = [], filterConfig = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) return [];
  const {
    preset = 'todos',
    store = '',
    brand = '',
    material = '',
    searchQuery = ''
  } = filterConfig || {};

  // 1. Processar dados de vendas pré-indexando em HashMaps O(1) para alta performance instantânea
  const salesBySku = new Map();
  const salesByModelo = new Map();
  const salesByMarcaModelo = new Map();
  const salesByToken = new Map();

  if (Array.isArray(salesData) && salesData.length > 0) {
    for (let i = 0; i < salesData.length; i++) {
      const sale = salesData[i];
      if (!sale) continue;

      const qtd = parseInt(sale.QUANTIDADE || sale.quantidade || sale.QTD || sale.qtd || 1, 10) || 1;
      const valor = parseCurrency(sale.VALOR || sale['VALOR TOTAL'] || sale['VALOR DA VENDA'] || 0);

      const directSku = String(
        sale.SKU || sale.sku || sale.REFERENCIA_SKU || sale.referencia_sku || sale.REFERENCIA || sale.referencia || ''
      ).trim().toLowerCase();

      const directModelo = String(sale.MODELO || sale.modelo || '').trim().toLowerCase();
      const directMarca = String(sale.MARCA || sale.marca || '').trim().toLowerCase();

      if (directSku && directSku.length >= 2) {
        const cur = salesBySku.get(directSku) || { count: 0, revenue: 0 };
        cur.count += qtd;
        cur.revenue += valor;
        salesBySku.set(directSku, cur);
      }

      if (directModelo && directModelo.length >= 2) {
        const cur = salesByModelo.get(directModelo) || { count: 0, revenue: 0 };
        cur.count += qtd;
        cur.revenue += valor;
        salesByModelo.set(directModelo, cur);
      }

      if (directMarca && directModelo) {
        const comboKey = `${directMarca}|||${directModelo}`;
        const cur = salesByMarcaModelo.get(comboKey) || { count: 0, revenue: 0 };
        cur.count += qtd;
        cur.revenue += valor;
        salesByMarcaModelo.set(comboKey, cur);
      }

      // Indexar tokens da descrição da venda (ex: 'rb3025', 'aviador', etc)
      const text = [
        sale.PRODUTO, sale.Produto, sale.produto,
        sale.ARMAÇÃO, sale.armacao, sale['ARMAÇÃO'],
        sale.LENTE, sale.lente,
        sale.DESCRICAO, sale.descricao
      ].filter(Boolean).join(' ').toLowerCase();

      if (text) {
        const words = text.match(/[a-z0-9_]+/g) || [];
        const wordSet = new Set(words);
        for (const w of wordSet) {
          if (w.length >= 2) {
            const cur = salesByToken.get(w) || { count: 0, revenue: 0 };
            cur.count += qtd;
            cur.revenue += valor;
            salesByToken.set(w, cur);
          }
        }
      }
    }
  }

  // 2. Enriquecer itens com métricas financeiras e vendas cruzadas em O(N) com buscas O(1)
  let list = items.map(item => {
    const sku = String(item.REFERENCIA_SKU || item.referencia_sku || item.SKU || item.sku || '').trim().toLowerCase();
    const modelo = String(item.MODELO || item.modelo || '').trim().toLowerCase();
    const marca = String(item.MARCA || item.marca || '').trim().toLowerCase();

    let salesCount = 0;
    let salesRevenue = 0;

    // Busca O(1) imediata por SKU exato ou token de SKU no texto da venda
    if (sku && salesBySku.has(sku)) {
      const match = salesBySku.get(sku);
      salesCount += match.count;
      salesRevenue += match.revenue;
    } else if (sku && salesByToken.has(sku)) {
      const match = salesByToken.get(sku);
      salesCount += match.count;
      salesRevenue += match.revenue;
    }
    // Busca O(1) por Marca + Modelo
    else if (marca && modelo && salesByMarcaModelo.has(`${marca}|||${modelo}`)) {
      const match = salesByMarcaModelo.get(`${marca}|||${modelo}`);
      salesCount += match.count;
      salesRevenue += match.revenue;
    }
    // Busca O(1) por Modelo
    else if (modelo && salesByModelo.has(modelo)) {
      const match = salesByModelo.get(modelo);
      salesCount += match.count;
      salesRevenue += match.revenue;
    } else if (modelo && salesByToken.has(modelo)) {
      const match = salesByToken.get(modelo);
      salesCount += match.count;
      salesRevenue += match.revenue;
    }

    const qtdEstoque = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
    const precoVenda = parseCurrency(item.PRECO_VENDA || item.preco_venda || item.VALOR_VENDA || item.valor_venda || item['Preço de Venda'] || item.VALOR || 0);
    const precoCusto = parseCurrency(item.PRECO_COMPRA || item.preco_compra || item.PRECO_CUSTO || item.preco_custo || item.CUSTO || item.custo || item['Preço de Custo'] || item['VALOR_COMPRA'] || 0);
    const lucroUnitario = precoVenda - precoCusto;
    const margemPercent = precoCusto > 0 ? ((precoVenda - precoCusto) / precoCusto) * 100 : (precoVenda > 0 ? 100 : 0);
    const valorImobilizado = qtdEstoque * precoCusto;
    const statusEstoque = getStockHealthStatus(qtdEstoque);

    const nonEnumerableProps = {
      _salesCount: { value: salesCount, writable: true, configurable: true, enumerable: false },
      _salesRevenue: { value: salesRevenue, writable: true, configurable: true, enumerable: false },
      _qtdEstoque: { value: qtdEstoque, writable: true, configurable: true, enumerable: false },
      _precoVenda: { value: precoVenda, writable: true, configurable: true, enumerable: false },
      _precoCusto: { value: precoCusto, writable: true, configurable: true, enumerable: false },
      _lucroUnitario: { value: lucroUnitario, writable: true, configurable: true, enumerable: false },
      _margemPercent: { value: margemPercent, writable: true, configurable: true, enumerable: false },
      _valorImobilizado: { value: valorImobilizado, writable: true, configurable: true, enumerable: false },
      _statusEstoque: { value: statusEstoque, writable: true, configurable: true, enumerable: false }
    };

    try {
      Object.defineProperties(item, nonEnumerableProps);
      return item;
    } catch {
      const copy = { ...item };
      Object.defineProperties(copy, nonEnumerableProps);
      return copy;
    }
  });

  // 3. Filtro por Loja / Unidade
  if (store && store !== 'todas') {
    const sLower = store.toLowerCase().trim();
    list = list.filter(item => {
      const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').toLowerCase().trim();
      return u === sLower || (sLower === 'central' && !u);
    });
  }

  // 4. Filtro por Marca
  if (brand && brand !== 'todas') {
    const bLower = brand.toLowerCase().trim();
    list = list.filter(item => {
      const m = String(item.MARCA || item.marca || '').toLowerCase().trim();
      return m === bLower;
    });
  }

  // 5. Filtro por Material
  if (material && material !== 'todas') {
    const mLower = material.toLowerCase().trim();
    list = list.filter(item => {
      const mat = String(item.MATERIAL || item.material || '').toLowerCase().trim();
      return mat === mLower;
    });
  }

  // 6. Filtro por Busca de Texto Livre
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(item => {
      const fields = [
        item.MARCA, item.marca,
        item.MODELO, item.modelo,
        item.REFERENCIA_SKU, item.referencia_sku, item.SKU,
        item.MATERIAL, item.material,
        item.COR, item.cor,
        item.TRATAMENTO, item.tratamento
      ].filter(Boolean).map(v => String(v).toLowerCase());
      return fields.some(f => f.includes(q));
    });
  }

  // 7. Presets Inteligentes
  switch (preset) {
    case 'mais_vendidos':
      // Ordena decrescente por quantidade vendida, depois por faturamento de venda
      list.sort((a, b) => (b._salesCount - a._salesCount) || (b._salesRevenue - a._salesRevenue));
      break;

    case 'mais_lucrativos':
      // Ordena decrescente pelo maior lucro unitário (Venda - Custo), depois margem %
      list.sort((a, b) => (b._lucroUnitario - a._lucroUnitario) || (b._margemPercent - a._margemPercent));
      break;

    case 'critico':
      // Filtra somente itens em situação de ponto de pedido crítico (<= 2 unidades)
      list = list.filter(item => item._qtdEstoque <= 2);
      // Esgotados (0 e negativos) primeiro, depois 1 e 2 unidades
      list.sort((a, b) => (a._qtdEstoque - b._qtdEstoque) || (b._salesCount - a._salesCount));
      break;

    case 'imobilizado':
      // Ordena decrescente pelo maior capital parado em estoque (Estoque * Preço de Custo)
      list.sort((a, b) => b._valorImobilizado - a._valorImobilizado);
      break;

    case 'loja':
      // Agrupa/ordena ordenadamente por Unidade/Loja, depois Marca e Modelo
      list.sort((a, b) => {
        const uA = String(a.UNIDADE || a.CIDADE || a.LOJA || a.unidade || 'Central').trim().toLowerCase();
        const uB = String(b.UNIDADE || b.CIDADE || b.LOJA || b.unidade || 'Central').trim().toLowerCase();
        const compU = uA.localeCompare(uB, 'pt-BR');
        if (compU !== 0) return compU;
        const mA = String(a.MARCA || a.marca || '').trim().toLowerCase();
        const mB = String(b.MARCA || b.marca || '').trim().toLowerCase();
        const compM = mA.localeCompare(mB, 'pt-BR');
        if (compM !== 0) return compM;
        const modA = String(a.MODELO || a.modelo || '').trim().toLowerCase();
        const modB = String(b.MODELO || b.modelo || '').trim().toLowerCase();
        return modA.localeCompare(modB, 'pt-BR');
      });
      break;

    case 'marca_material':
      // Agrupa/ordena alfabeticamente por Marca, depois Material, depois Modelo
      list.sort((a, b) => {
        const mA = String(a.MARCA || a.marca || '').trim().toLowerCase();
        const mB = String(b.MARCA || b.marca || '').trim().toLowerCase();
        const compM = mA.localeCompare(mB, 'pt-BR');
        if (compM !== 0) return compM;
        const matA = String(a.MATERIAL || a.material || '').trim().toLowerCase();
        const matB = String(b.MATERIAL || b.material || '').trim().toLowerCase();
        const compMat = matA.localeCompare(matB, 'pt-BR');
        if (compMat !== 0) return compMat;
        const modA = String(a.MODELO || a.modelo || '').trim().toLowerCase();
        const modB = String(b.MODELO || b.modelo || '').trim().toLowerCase();
        return modA.localeCompare(modB, 'pt-BR');
      });
      break;

    case 'todos':
    default:
      // Mantém a lista completa
      break;
  }

  return list;
}

export function extractStockFacets(items = []) {
  const stores = new Set();
  const brands = new Set();
  const materials = new Set();

  (items || []).forEach(item => {
    const s = (item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim();
    if (s) stores.add(s);

    const b = (item.MARCA || item.marca || item.CATEGORIA || item.categoria || '').trim();
    if (b) brands.add(b);

    const m = (item.MATERIAL || item.material || '').trim();
    if (m) materials.add(m);
  });

  return {
    stores: Array.from(stores).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    brands: Array.from(brands).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    materials: Array.from(materials).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  };
}

/**
 * Converte qualquer representação de data de venda (BR, ISO, timestamp) em Date válida
 */
export function parseSaleDate(sale) {
  if (!sale) return null;
  const raw = sale['DATA  DA VENDA'] || sale['DATA DA VENDA'] || sale['DATA_VENDA'] || sale['Data da Venda'] || sale['data_venda'] || sale['DATA'] || sale['data'] || sale['timestamp'] || sale['dataHora'] || sale['DATA_HORA'];
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw)) return raw;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d) ? null : d;
  }
  const s = String(raw).trim();
  // Formato brasileiro DD/MM/YYYY
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  // Formato ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  const parsed = new Date(s);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Valida se uma data de venda cai dentro do período selecionado
 */
export function isSaleInPeriod(dateObj, period = 'all') {
  if (!period || period === 'all') return true;
  if (!dateObj) return true;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') {
    return dateObj >= todayStart;
  }
  if (period === '30days') {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return dateObj >= d30;
  }
  if (period === '90days') {
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return dateObj >= d90;
  }
  if (period === 'month') {
    return dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth();
  }
  if (period === 'year') {
    return dateObj.getFullYear() === now.getFullYear();
  }
  return true;
}

/**
 * Consolida e agrupa todas as vendas por Grife / Marca e por Loja / Filial
 * Suporta Armações, Lentes e demais categorias.
 */
export function aggregateSalesByBrandAndStore(items = [], salesData = [], options = {}) {
  const {
    selectedStore = 'todas',
    period = 'all',
    searchQuery = '',
    type = 'armacoes'
  } = options || {};

  // 1. Construir catálogo de referência para detecção inteligente de grifes e modelos
  const knownBrands = new Map(); // lowercase -> original case
  const skuToProduct = new Map();
  const modelToBrand = new Map();

  (items || []).forEach(it => {
    if (!it) return;
    const b = String(it.MARCA || it.marca || it.CATEGORIA || it.categoria || '').trim();
    if (b) {
      knownBrands.set(b.toLowerCase(), b);
    }
    const sku = String(it.REFERENCIA_SKU || it.referencia_sku || it.SKU || it.sku || it.CODIGO || '').trim().toLowerCase();
    if (sku) {
      skuToProduct.set(sku, it);
    }
    const m = String(it.MODELO || it.modelo || it.NOME || it.nome || '').trim().toLowerCase();
    if (m && b) {
      modelToBrand.set(m, b);
    }
  });

  // Marcas conhecidas ordenadas por tamanho decrescente para priorizar nomes compostos
  const sortedKnownBrands = Array.from(knownBrands.entries()).sort((a, b) => b[0].length - a[0].length);

  // 2. Varrer transações de vendas
  const brandMap = new Map();
  let grandTotalQuantity = 0;
  let grandTotalRevenue = 0;
  const allStoresSet = new Set(['Cajati', 'Registro', 'Jacupiranga', 'Central']);

  if (Array.isArray(salesData)) {
    for (let i = 0; i < salesData.length; i++) {
      const sale = salesData[i];
      if (!sale) continue;

      // Filtro de data / período
      const saleDate = parseSaleDate(sale);
      if (!isSaleInPeriod(saleDate, period)) continue;

      // Loja / Filial
      const rawStore = String(sale.CIDADE || sale.LOJA || sale.UNIDADE || sale.cidade || sale.loja || 'Central').trim();
      const storeName = rawStore || 'Central';
      allStoresSet.add(storeName);

      if (selectedStore && selectedStore !== 'todas') {
        if (storeName.toLowerCase() !== selectedStore.toLowerCase()) {
          continue;
        }
      }

      // Identificar a Grife / Marca
      let identifiedBrand = '';
      let identifiedModel = '';
      let identifiedSku = '';

      // Tentativa A: SKU direto na venda
      const rawSku = String(sale.SKU || sale.sku || sale.REFERENCIA_SKU || sale.referencia_sku || sale.REFERENCIA || '').trim().toLowerCase();
      if (rawSku && skuToProduct.has(rawSku)) {
        const prod = skuToProduct.get(rawSku);
        identifiedBrand = prod.MARCA || prod.marca || '';
        identifiedModel = prod.MODELO || prod.modelo || prod.NOME || prod.nome || '';
        identifiedSku = rawSku;
      }

      // Tentativa B: Campo MARCA explícito
      if (!identifiedBrand && (sale.MARCA || sale.marca)) {
        const m = String(sale.MARCA || sale.marca).trim();
        identifiedBrand = knownBrands.get(m.toLowerCase()) || m;
      }

      // Tentativa C: Campo ARMAÇÃO
      const armacaoText = String(sale.ARMAÇÃO || sale.armacao || sale['ARMAÇÃO'] || sale['Modelo de Armação'] || '').trim();
      if (!identifiedBrand && armacaoText) {
        for (const [bLower, origBrand] of sortedKnownBrands) {
          if (armacaoText.toLowerCase().includes(bLower)) {
            identifiedBrand = origBrand;
            break;
          }
        }
        if (!identifiedModel) identifiedModel = armacaoText;
      }

      // Tentativa D: Campo LENTE (se for categoria lentes)
      const lenteText = String(sale.LENTE || sale.lente || sale['Marca de Lente'] || '').trim();
      if (!identifiedBrand && lenteText && type === 'lentes') {
        for (const [bLower, origBrand] of sortedKnownBrands) {
          if (lenteText.toLowerCase().includes(bLower)) {
            identifiedBrand = origBrand;
            break;
          }
        }
        if (!identifiedModel) identifiedModel = lenteText;
      }

      // Tentativa E: Campo PRODUTO / DESCRICAO
      const prodText = String(sale.PRODUTO || sale.Produto || sale.produto || sale.DESCRICAO || '').trim();
      if (!identifiedBrand && prodText) {
        for (const [bLower, origBrand] of sortedKnownBrands) {
          if (prodText.toLowerCase().includes(bLower)) {
            identifiedBrand = origBrand;
            break;
          }
        }
        if (!identifiedModel) identifiedModel = prodText;
      }

      // Tratamento para armações sem grife explícita
      if (!identifiedBrand) {
        if (type === 'armacoes' && (armacaoText || /armação|óculos|solar|receituário|grau/i.test(prodText))) {
          identifiedBrand = 'Outras Grifes / Diversas';
          if (!identifiedModel) identifiedModel = armacaoText || prodText || 'Armação Não Especificada';
        } else if (type === 'lentes' && (lenteText || /lente|antirreflexo|multifocal|visão simples/i.test(prodText))) {
          identifiedBrand = 'Outros Fabricantes / Diversos';
          if (!identifiedModel) identifiedModel = lenteText || prodText || 'Lente Não Especificada';
        } else if (knownBrands.size > 0 && prodText) {
          continue;
        } else {
          continue;
        }
      }

      const qtd = parseInt(sale.QUANTIDADE || sale.quantidade || sale.QTD || sale.qtd || 1, 10) || 1;
      const valor = parseCurrency(sale.VALOR || sale['VALOR TOTAL'] || sale['VALOR DA VENDA'] || 0);

      grandTotalQuantity += qtd;
      grandTotalRevenue += valor;

      const brandKey = identifiedBrand.trim();
      let record = brandMap.get(brandKey);
      if (!record) {
        record = {
          brand: brandKey,
          totalQuantity: 0,
          totalRevenue: 0,
          stores: {},
          modelsMap: new Map(),
          salesList: []
        };
        brandMap.set(brandKey, record);
      }

      record.totalQuantity += qtd;
      record.totalRevenue += valor;

      if (!record.stores[storeName]) {
        record.stores[storeName] = { quantity: 0, revenue: 0 };
      }
      record.stores[storeName].quantity += qtd;
      record.stores[storeName].revenue += valor;

      const modelLabel = identifiedModel || (identifiedSku ? `SKU: ${identifiedSku}` : 'Modelo Geral');
      const modelKey = `${storeName}|||${modelLabel}`;
      let mRec = record.modelsMap.get(modelKey);
      if (!mRec) {
        mRec = {
          model: modelLabel,
          sku: identifiedSku,
          store: storeName,
          quantity: 0,
          revenue: 0
        };
        record.modelsMap.set(modelKey, mRec);
      }
      mRec.quantity += qtd;
      mRec.revenue += valor;

      record.salesList.push({
        os: sale['Nº DA OS'] || sale.OS || sale.id || '',
        data: saleDate ? saleDate.toLocaleDateString('pt-BR') : (sale['DATA'] || ''),
        cliente: sale.CLIENTE || sale.NOME || 'Cliente',
        vendedor: sale.VENDEDOR || '',
        loja: storeName,
        modelo: modelLabel,
        sku: identifiedSku,
        quantidade: qtd,
        valor: valor
      });
    }
  }

  // 3. Formatar lista agregada com percentuais e ordenação
  let brandList = Array.from(brandMap.values()).map(rec => {
    const avgTicket = rec.totalQuantity > 0 ? rec.totalRevenue / rec.totalQuantity : 0;
    const sharePercent = grandTotalRevenue > 0 ? (rec.totalRevenue / grandTotalRevenue) * 100 : 0;
    const models = Array.from(rec.modelsMap.values()).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

    return {
      brand: rec.brand,
      totalQuantity: rec.totalQuantity,
      totalRevenue: rec.totalRevenue,
      averageTicket: avgTicket,
      sharePercent: sharePercent,
      distinctModelsCount: models.length,
      stores: rec.stores,
      models: models,
      salesList: rec.salesList
    };
  });

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    brandList = brandList.filter(b => b.brand.toLowerCase().includes(q));
  }

  brandList.sort((a, b) => b.totalQuantity - a.totalQuantity || b.totalRevenue - a.totalRevenue);

  const availableStores = Array.from(allStoresSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return {
    brandList,
    grandTotalQuantity,
    grandTotalRevenue,
    averageTicket: grandTotalQuantity > 0 ? grandTotalRevenue / grandTotalQuantity : 0,
    totalBrandsCount: brandList.length,
    availableStores
  };
}

/**
 * Exporta o relatório analítico consolidado de Vendas por Grife e Loja para arquivo Excel (.xlsx) nativo
 */
export function exportBrandSalesReportToExcel(brandAggregation, options = {}, XLSXInstance = null) {
  const xlsx = XLSXInstance || (typeof XLSX !== 'undefined' ? XLSX : null);
  if (!xlsx) {
    throw new Error('Biblioteca XLSX não disponível.');
  }

  const { brandList = [], grandTotalQuantity = 0, grandTotalRevenue = 0, availableStores = [] } = brandAggregation || {};
  const { selectedStore = 'todas', period = 'all', type = 'armacoes' } = options || {};

  const wb = xlsx.utils.book_new();

  // 1. Aba Resumo por Grife / Marca
  const summaryRows = brandList.map((b, idx) => {
    const row = {
      'Ranking': idx + 1,
      'Grife / Marca': sanitizeFormula(b.brand),
      'Qtd Vendida (Peças)': b.totalQuantity,
      'Faturamento Total (R$)': Number(b.totalRevenue.toFixed(2)),
      'Ticket Médio (R$)': Number(b.averageTicket.toFixed(2)),
      'Participação (%)': Number(b.sharePercent.toFixed(1)),
      'Modelos Distintos': b.distinctModelsCount
    };

    // Detalhar colunas por loja
    availableStores.forEach(st => {
      const stData = b.stores[st] || { quantity: 0, revenue: 0 };
      row[`${st} (Qtd)`] = stData.quantity;
      row[`${st} (R$)`] = Number(stData.revenue.toFixed(2));
    });

    return row;
  });

  // Linha de Total Geral no Resumo
  if (summaryRows.length > 0) {
    const totalRow = {
      'Ranking': 'TOTAL',
      'Grife / Marca': 'TODAS AS GRIFES CONSOLIDADAS',
      'Qtd Vendida (Peças)': grandTotalQuantity,
      'Faturamento Total (R$)': Number(grandTotalRevenue.toFixed(2)),
      'Ticket Médio (R$)': grandTotalQuantity > 0 ? Number((grandTotalRevenue / grandTotalQuantity).toFixed(2)) : 0,
      'Participação (%)': 100.0,
      'Modelos Distintos': summaryRows.reduce((acc, r) => acc + (r['Modelos Distintos'] || 0), 0)
    };
    availableStores.forEach(st => {
      totalRow[`${st} (Qtd)`] = summaryRows.reduce((acc, r) => acc + (r[`${st} (Qtd)`] || 0), 0);
      totalRow[`${st} (R$)`] = Number(summaryRows.reduce((acc, r) => acc + (r[`${st} (R$)`] || 0), 0).toFixed(2));
    });
    summaryRows.push(totalRow);
  }

  const wsSummary = xlsx.utils.json_to_sheet(summaryRows);
  xlsx.utils.book_append_sheet(wb, wsSummary, 'Vendas por Grife');

  // 2. Aba Detalhamento por Modelo e Loja
  const detailRows = [];
  brandList.forEach(b => {
    b.models.forEach(m => {
      detailRows.push({
        'Grife / Marca': sanitizeFormula(b.brand),
        'Modelo / Descrição': sanitizeFormula(m.model),
        'SKU': sanitizeFormula(m.sku || ''),
        'Loja / Filial': sanitizeFormula(m.store),
        'Qtd Vendida': m.quantity,
        'Faturamento (R$)': Number(m.revenue.toFixed(2)),
        'Preço Médio (R$)': m.quantity > 0 ? Number((m.revenue / m.quantity).toFixed(2)) : 0
      });
    });
  });

  if (detailRows.length > 0) {
    const wsDetail = xlsx.utils.json_to_sheet(detailRows);
    xlsx.utils.book_append_sheet(wb, wsDetail, 'Modelos por Loja');
  }

  // 3. Aba Histórico de Vendas Individualizadas
  const txRows = [];
  brandList.forEach(b => {
    b.salesList.forEach(tx => {
      txRows.push({
        'Nº OS / Venda': sanitizeFormula(tx.os),
        'Data': sanitizeFormula(tx.data),
        'Loja / Filial': sanitizeFormula(tx.loja),
        'Grife / Marca': sanitizeFormula(b.brand),
        'Modelo': sanitizeFormula(tx.modelo),
        'SKU': sanitizeFormula(tx.sku || ''),
        'Cliente': sanitizeFormula(tx.cliente),
        'Vendedor': sanitizeFormula(tx.vendedor),
        'Qtd': tx.quantidade,
        'Valor (R$)': Number(tx.valor.toFixed(2))
      });
    });
  });

  if (txRows.length > 0) {
    const wsTx = xlsx.utils.json_to_sheet(txRows);
    xlsx.utils.book_append_sheet(wb, wsTx, 'Histórico de Transações');
  }

  const todayStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const storeLabel = selectedStore.toUpperCase().replace(/\s+/g, '_');
  const catLabel = type === 'armacoes' ? 'Armacoes' : type === 'lentes' ? 'Lentes' : 'Produtos';
  const filename = `Relatorio_Vendas_Por_Grife_${catLabel}_${storeLabel}_${todayStr}.xlsx`;

  xlsx.writeFile(wb, filename);
  return filename;
}
