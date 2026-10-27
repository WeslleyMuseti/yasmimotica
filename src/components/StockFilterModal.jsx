import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, X, Download, Eye, Trophy, Sparkles, AlertTriangle,
  Wallet, Store, Tag, Package, Check, CheckCircle2, Search,
  ArrowUpDown, TrendingUp, Layers, RefreshCw, ChevronDown, FileCode,
  Building2, BarChart3, ChevronRight, Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import StockPieChart from './StockPieChart';
import {
  parseCurrency,
  formatCurrency,
  filterAndSortStock,
  extractStockFacets,
  sanitizeFormula,
  aggregateSalesByBrandAndStore,
  exportBrandSalesReportToExcel
} from '../stockFilters';
import { buildStockXml, downloadXmlFile } from '../xmlUtils';

const PRESETS = [
  {
    id: 'todos',
    label: 'Estoque Completo',
    shortLabel: 'Completo',
    icon: Package,
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    selectedBg: 'bg-slate-700/60 border-slate-400 text-white',
    desc: 'Visão integral sem restrições ou ordenações especiais.'
  },
  {
    id: 'mais_vendidos',
    label: '🏆 Mais Vendidos',
    shortLabel: 'Mais Vendidos',
    icon: Trophy,
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    selectedBg: 'bg-amber-500/20 border-amber-400 text-amber-200',
    desc: 'Cruzamento com histórico de vendas do ERP. Maior saída e giro de vitrine.'
  },
  {
    id: 'mais_lucrativos',
    label: '💎 Mais Lucrativos',
    shortLabel: 'Mais Lucrativos',
    icon: Sparkles,
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    selectedBg: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
    desc: 'Produtos com maiores margens de contribuição e lucro unitário (Venda - Custo).'
  },
  {
    id: 'critico',
    label: '⚠️ Estoque Crítico',
    shortLabel: 'Estoque Crítico',
    icon: AlertTriangle,
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    selectedBg: 'bg-rose-500/20 border-rose-400 text-rose-200',
    desc: 'Ponto de pedido urgente: saldo ≤ 2 unidades ou esgotado (0 un) para reposição.'
  },
  {
    id: 'imobilizado',
    label: '💰 Maior Capital Imobilizado',
    shortLabel: 'Maior Imobilizado',
    icon: Wallet,
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    selectedBg: 'bg-indigo-500/20 border-indigo-400 text-indigo-200',
    desc: 'Produtos com maior valor de custo total parado no inventário (Estoque × Custo).'
  },
  {
    id: 'loja',
    label: '🏪 Por Loja / Unidade',
    shortLabel: 'Por Loja',
    icon: Store,
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    selectedBg: 'bg-sky-500/20 border-sky-400 text-sky-200',
    desc: 'Filtrar isoladamente por filial: Cajati, Registro, Jacupiranga ou Central.'
  },
  {
    id: 'marca_material',
    label: '🏷️ Por Marca / Material',
    shortLabel: 'Marca / Material',
    icon: Tag,
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    selectedBg: 'bg-purple-500/20 border-purple-400 text-purple-200',
    desc: 'Segmentação refinada por fabricante/grife e matéria-prima dos produtos.'
  }
];

export default function StockFilterModal({
  isOpen,
  onClose,
  type = 'armacoes', // 'armacoes' | 'lentes'
  items = [],
  salesData = [],
  activeFilter = null,
  onApplyFilter,
  currentUser = null,
  initialModalTab = 'stock'
}) {
  const [activeModalTab, setActiveModalTab] = useState(initialModalTab || 'stock'); // 'stock' | 'brand_sales'
  const [selectedPreset, setSelectedPreset] = useState(activeFilter?.preset || 'todos');
  const [selectedStore, setSelectedStore] = useState(activeFilter?.store || 'todas');
  const [selectedBrand, setSelectedBrand] = useState(activeFilter?.brand || 'todas');
  const [selectedMaterial, setSelectedMaterial] = useState(activeFilter?.material || 'todas');
  const [searchQuery, setSearchQuery] = useState(activeFilter?.searchQuery || '');
  const [chartMetric, setChartMetric] = useState('saude'); // 'saude' | 'loja' | 'marca'
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState('');

  // Estados dedicados para o Módulo de Vendas por Grife & Loja
  const [brandSalesStore, setBrandSalesStore] = useState('todas');
  const [brandSalesPeriod, setBrandSalesPeriod] = useState('all'); // 'all' | 'today' | '30days' | '90days' | 'month' | 'year'
  const [brandSalesSearch, setBrandSalesSearch] = useState('');
  const [expandedBrand, setExpandedBrand] = useState(null);

  // Sincronizar quando activeFilter mudar externamente
  useEffect(() => {
    if (isOpen) {
      if (initialModalTab) {
        setActiveModalTab(initialModalTab);
      }
      if (activeFilter) {
        setSelectedPreset(activeFilter.preset || 'todos');
        setSelectedStore(activeFilter.store || 'todas');
        setSelectedBrand(activeFilter.brand || 'todas');
        setSelectedMaterial(activeFilter.material || 'todas');
        setSearchQuery(activeFilter.searchQuery || '');
        if (activeFilter.preset === 'loja') setChartMetric('loja');
        else if (activeFilter.preset === 'marca_material') setChartMetric('marca');
        else if (activeFilter.preset === 'critico') setChartMetric('saude');
      } else {
        setSelectedPreset('todos');
        setSelectedStore('todas');
        setSelectedBrand('todas');
        setSelectedMaterial('todas');
        setSearchQuery('');
        setChartMetric('saude');
      }
      setDownloadSuccess(false);
      setDownloadSuccessMsg('');
    }
  }, [isOpen, activeFilter, initialModalTab]);

  const handleSelectPreset = (presetId) => {
    setSelectedPreset(presetId);
    if (presetId === 'loja') {
      setChartMetric('loja');
    } else if (presetId === 'marca_material') {
      setChartMetric('marca');
    } else if (presetId === 'critico') {
      setChartMetric('saude');
    }
  };

  // Agregação de Vendas por Grife e Loja
  const brandAggregation = useMemo(() => {
    return aggregateSalesByBrandAndStore(items, salesData, {
      selectedStore: brandSalesStore,
      period: brandSalesPeriod,
      searchQuery: brandSalesSearch,
      type
    });
  }, [items, salesData, brandSalesStore, brandSalesPeriod, brandSalesSearch, type]);

  // Download do Relatório de Vendas por Grife em Excel (.xlsx)
  const handleDownloadBrandExcel = () => {
    try {
      if (!brandAggregation || brandAggregation.brandList.length === 0) {
        alert('Nenhuma venda de grife identificada para os filtros selecionados.');
        return;
      }
      const fname = exportBrandSalesReportToExcel(brandAggregation, {
        selectedStore: brandSalesStore,
        period: brandSalesPeriod,
        type
      }, XLSX);
      setDownloadSuccessMsg(`Relatório de Vendas por Grife baixado com sucesso: ${fname}`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Erro ao exportar vendas por grife:', err);
      alert('Erro ao exportar planilha de grifes: ' + (err.message || 'Erro desconhecido'));
    }
  };

  // Extrair lojas, marcas e materiais presentes na coleção
  const facets = useMemo(() => {
    return extractStockFacets(items);
  }, [items]);

  // Lista processada, enriquecida, filtrada e ordenada
  const filteredItems = useMemo(() => {
    return filterAndSortStock(items, salesData, {
      preset: selectedPreset,
      store: selectedStore,
      brand: selectedBrand,
      material: selectedMaterial,
      searchQuery
    });
  }, [items, salesData, selectedPreset, selectedStore, selectedBrand, selectedMaterial, searchQuery]);

  // Métricas agregadas do subconjunto filtrado
  const kpis = useMemo(() => {
    let totalItems = filteredItems.length;
    let totalUnits = 0;
    let totalCusto = 0;
    let totalVendaProjetada = 0;
    let totalLucroProjetado = 0;
    let criticosCount = 0;
    let esgotadosCount = 0;
    let totalVendasIdentificadas = 0;

    filteredItems.forEach(item => {
      const q = item._qtdEstoque || 0;
      totalUnits += q;
      totalCusto += (item._valorImobilizado || 0);
      totalVendaProjetada += q * (item._precoVenda || 0);
      totalLucroProjetado += q * (item._lucroUnitario || 0);
      totalVendasIdentificadas += (item._salesCount || 0);

      if (item._statusEstoque === 'esgotado') esgotadosCount++;
      else if (item._statusEstoque === 'critico') criticosCount++;
    });

    const margemMedia = totalCusto > 0
      ? ((totalVendaProjetada - totalCusto) / totalCusto) * 100
      : 0;

    return {
      totalItems,
      totalUnits,
      totalCusto,
      totalVendaProjetada,
      totalLucroProjetado,
      margemMedia,
      criticosCount,
      esgotadosCount,
      totalVendasIdentificadas
    };
  }, [filteredItems]);

  // Download da Planilha Excel (.xlsx) com o dataset filtrado
  const handleDownloadExcel = () => {
    try {
      if (filteredItems.length === 0) {
        alert('Nenhum item filtrado para exportar.');
        return;
      }
      const isArmacao = type === 'armacoes';
      const isBrinde = type === 'brindes';
      const isAcessorio = type === 'acessorios';
      const todayStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const presetName = selectedPreset.toUpperCase().replace(/\s+/g, '_');
      const filename = `Estoque_${isArmacao ? 'Armacoes' : isBrinde ? 'Brindes' : isAcessorio ? 'Acessorios' : 'Lentes'}_${presetName}_${todayStr}.xlsx`;

      const formatted = filteredItems.map((item, idx) => {
        const base = {
          'Nº': idx + 1,
          'Unidade / Loja': sanitizeFormula(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central'),
          'Marca / Categoria': sanitizeFormula(item.MARCA || item.marca || item.CATEGORIA || item.categoria || ''),
          'Modelo / Descrição': sanitizeFormula(item.NOME || item.nome || item.MODELO || item.modelo || ''),
          'SKU / Referência': sanitizeFormula(item.REFERENCIA_SKU || item.referencia_sku || item.SKU || item.REFERÊNCIA || item.CODIGO || ''),
          'Material': sanitizeFormula(item.MATERIAL || item.material || ''),
          'Estoque Físico': item._qtdEstoque ?? 0,
          'Status': item._statusEstoque === 'esgotado' ? 'Esgotado' : item._statusEstoque === 'critico' ? 'Crítico' : 'Normal',
          'Preço Custo (R$)': Number((item._precoCusto || 0).toFixed(2)),
          'Preço Venda (R$)': Number((item._precoVenda || 0).toFixed(2)),
          'Lucro Unitário (R$)': Number((item._lucroUnitario || 0).toFixed(2)),
          'Margem Unitária (%)': Number((item._margemPercent || 0).toFixed(1)),
          'Valor Imobilizado (R$)': Number((item._valorImobilizado || 0).toFixed(2)),
          'Vendas Registradas (Qtd)': item._salesCount || 0
        };

        if (isArmacao) {
          base['Cor'] = sanitizeFormula(item.COR || item.cor || '');
          base['Tamanho'] = sanitizeFormula(item.TAMANHO || item.tamanho || '');
        } else if (isBrinde || isAcessorio) {
          base['Categoria'] = sanitizeFormula(item.CATEGORIA || item.categoria || '');
          base['Cor'] = sanitizeFormula(item.COR || item.cor || '');
        } else {
          base['Índice Refração'] = sanitizeFormula(item.INDICE_REFRACAO || item.indice_refracao || '');
          base['Tratamento'] = sanitizeFormula(item.TRATAMENTO || item.tratamento || '');
          base['Esférico Mín'] = sanitizeFormula(item.ESFERICO_MIN || item.esferico_min || '');
          base['Esférico Máx'] = sanitizeFormula(item.ESFERICO_MAX || item.esferico_max || '');
          base['Cilíndrico Mín'] = sanitizeFormula(item.CILINDRICO_MIN || item.cilindrico_min || '');
          base['Cilíndrico Máx'] = sanitizeFormula(item.CILINDRICO_MAX || item.cilindrico_max || '');
        }

        base['Observações'] = sanitizeFormula(item.OBSERVACOES || item.observacoes || '');
        return base;
      });

      const ws = XLSX.utils.json_to_sheet(formatted);
      // Auto-ajuste proporcional da largura das colunas
      const colWidths = Object.keys(formatted[0] || {}).map(key => {
        const maxLen = Math.max(
          key.length,
          ...formatted.map(row => String(row[key] ?? '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
      });
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isArmacao ? 'Armações' : isBrinde ? 'Brindes' : 'Lentes');
      XLSX.writeFile(wb, filename);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Erro ao baixar planilha do estoque:', err);
      alert('Erro ao gerar arquivo Excel do estoque.');
    }
  };

  // Download do Estoque em formato XML estruturado
  const handleDownloadXML = () => {
    try {
      if (filteredItems.length === 0) {
        alert('Nenhum item filtrado para exportar.');
        return;
      }
      const isArmacao = type === 'armacoes';
      const isBrinde = type === 'brindes';
      const isAcessorio = type === 'acessorios';
      const todayStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const presetName = selectedPreset.toUpperCase().replace(/\s+/g, '_');
      const tipoNome = isArmacao ? 'Armacoes' : isBrinde ? 'Brindes' : isAcessorio ? 'Acessorios' : 'Lentes';
      const filename = `Estoque_${tipoNome}_${presetName}_${todayStr}.xml`;

      const xmlContent = buildStockXml(filteredItems, {
        tipo: tipoNome,
        filtro: selectedPreset,
        unidade: selectedStore !== 'todas' ? selectedStore : 'Todas'
      });

      downloadXmlFile(xmlContent, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Erro ao baixar XML do estoque:', err);
      alert('Erro ao gerar arquivo XML do estoque.');
    }
  };

  // Aplica o filtro diretamente na tela do ERP
  const handleApplyFilter = () => {
    const pObj = PRESETS.find(p => p.id === selectedPreset);
    let label = pObj ? pObj.label : 'Filtro Personalizado';

    const details = [];
    if (selectedStore && selectedStore !== 'todas') details.push(`Loja: ${selectedStore}`);
    if (selectedBrand && selectedBrand !== 'todas') details.push(`Marca: ${selectedBrand}`);
    if (selectedMaterial && selectedMaterial !== 'todas') details.push(`Material: ${selectedMaterial}`);
    if (searchQuery && searchQuery.trim()) details.push(`Busca: "${searchQuery}"`);

    if (details.length > 0) {
      label += ` (${details.join(' • ')})`;
    }

    onApplyFilter({
      preset: selectedPreset,
      store: selectedStore,
      brand: selectedBrand,
      material: selectedMaterial,
      searchQuery,
      label,
      count: filteredItems.length
    }, filteredItems);

    onClose();
  };

  // Resetar todos os filtros
  const handleResetFilters = () => {
    setSelectedPreset('todos');
    setSelectedStore('todas');
    setSelectedBrand('todas');
    setSelectedMaterial('todas');
    setSearchQuery('');
    setChartMetric('saude');
  };

  const isFiltered = selectedPreset !== 'todos' || selectedStore !== 'todas' || selectedBrand !== 'todas' || selectedMaterial !== 'todas' || searchQuery.trim() !== '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg lg:max-w-5xl bg-slate-900/95 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
              <Filter size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                  Filtros &amp; Relatórios de Estoque
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider shrink-0">
                  {type === 'armacoes' ? 'Armações' : type === 'brindes' ? 'Brindes' : type === 'acessorios' ? 'Acessórios' : 'Lentes'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                Análise inteligente, distribuição gráfica e exportação (.xlsx) com cruzamento de vendas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* SELETOR DE MODO: ESTOQUE & FILTROS vs. VENDAS POR GRIFE & LOJA */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2.5 border-b border-white/10 bg-slate-950/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModalTab('stock')}
            className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black transition-all ${
              activeModalTab === 'stock'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Package size={14} />
            <span>Estoque &amp; Inteligência</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('brand_sales')}
            className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black transition-all ${
              activeModalTab === 'brand_sales'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25 ring-2 ring-purple-400/30'
                : 'bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:text-white hover:bg-purple-500/20'
            }`}
          >
            <Trophy size={14} className={activeModalTab === 'brand_sales' ? 'text-amber-300' : 'text-purple-400'} />
            <span>{type === 'armacoes' ? '📊 Vendas por Grife & Loja' : type === 'lentes' ? '📊 Vendas por Fabricante & Loja' : '📊 Vendas por Marca & Loja'}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-black uppercase tracking-wider">Novo</span>
          </button>
        </div>

        {/* ÁREA DE ROLAGEM COM FILTROS E GRÁFICOS */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 pr-2 sm:pr-4 erp-scroll">
          {activeModalTab === 'brand_sales' ? (
            /* ==============================================================
               VISÃO DEDICADA: VENDAS POR GRIFE & LOJA (ANALÍTICO COMPLETO)
               ============================================================== */
            <div className="space-y-5">
              {/* FILTROS DE SEGMENTAÇÃO: FILIAL/LOJA, PERÍODO, BUSCA POR GRIFE */}
              <div className="p-4 bg-slate-950/70 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Filter size={14} className="text-purple-400" />
                    Filtros de Vendas por Grife &amp; Loja
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBrandSalesStore('todas');
                      setBrandSalesPeriod('all');
                      setBrandSalesSearch('');
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Limpar Filtros
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Filial / Loja */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Filial / Loja
                    </label>
                    <select
                      value={brandSalesStore}
                      onChange={(e) => setBrandSalesStore(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="todas">Todas as Lojas</option>
                      {brandAggregation.availableStores.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Período */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Período de Venda
                    </label>
                    <select
                      value={brandSalesPeriod}
                      onChange={(e) => setBrandSalesPeriod(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="all">Todo o Histórico</option>
                      <option value="today">Vendas de Hoje</option>
                      <option value="month">Este Mês</option>
                      <option value="30days">Últimos 30 Dias</option>
                      <option value="90days">Últimos 90 Dias</option>
                      <option value="year">Este Ano</option>
                    </select>
                  </div>

                  {/* Busca por Grife */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Buscar Grife / Marca
                    </label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={brandSalesSearch}
                        onChange={(e) => setBrandSalesSearch(e.target.value)}
                        placeholder="Ex: Ray-Ban, Vogue, Oakley..."
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                      {brandSalesSearch && (
                        <button
                          type="button"
                          onClick={() => setBrandSalesSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARDS DE KPIS CONSOLIDADOS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                    Grifes Vendidas
                  </span>
                  <p className="text-2xl font-black text-white">
                    {brandAggregation.totalBrandsCount}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold">
                    marcas com saída
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                    Peças Vendidas
                  </span>
                  <p className="text-2xl font-black text-sky-300">
                    {brandAggregation.grandTotalQuantity} <span className="text-xs font-bold text-slate-400">un</span>
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {type === 'armacoes' ? 'armações no período' : 'itens no período'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Faturamento Total
                  </span>
                  <p className="text-lg sm:text-xl font-black text-emerald-300 truncate">
                    {formatCurrency(brandAggregation.grandTotalRevenue)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold">
                    total bruto gerado
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Ticket Médio
                  </span>
                  <p className="text-lg sm:text-xl font-black text-amber-300 truncate">
                    {formatCurrency(brandAggregation.averageTicket)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold">
                    média por peça
                  </span>
                </div>
              </div>

              {/* TOP GRIFES LEADERBOARD & VISUALIZAÇÃO */}
              {brandAggregation.brandList.length > 0 && (
                <div className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Trophy size={14} className="text-amber-400" />
                      Top Grifes Mais Vendidas (% do Faturamento)
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      Loja: {brandSalesStore === 'todas' ? 'Todas as Filiais' : brandSalesStore}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {brandAggregation.brandList.slice(0, 5).map((b, idx) => {
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                      return (
                        <div key={b.brand} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-amber-400">{medal}</span>
                              <span className="font-black text-white">{b.brand}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                ({b.totalQuantity} un vendidas)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-emerald-400">{formatCurrency(b.totalRevenue)}</span>
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black">
                                {b.sharePercent.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(5, b.sharePercent))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TABELA ANALÍTICA DE VENDAS POR GRIFE & LOJA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Eye size={14} className="text-purple-400" />
                    Ranking Completo de Grifes ({brandAggregation.brandList.length} marcas)
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Clique em &quot;Modelos&quot; para abrir os itens vendidos
                  </span>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                  {brandAggregation.brandList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-bold">
                      Nenhuma venda registrada para esta combinação de loja, período ou busca.
                    </div>
                  ) : (
                    <div className="overflow-x-auto erp-scroll">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900/90 border-b border-white/10 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-3 w-12 text-center">#</th>
                            <th className="py-3 px-3">Grife / Marca</th>
                            <th className="py-3 px-3">Vendas por Filial / Loja</th>
                            <th className="py-3 px-3 text-center">Modelos</th>
                            <th className="py-3 px-3 text-right">Qtd Vendida</th>
                            <th className="py-3 px-3 text-right">Faturamento</th>
                            <th className="py-3 px-3 text-right">Ticket Médio</th>
                            <th className="py-3 px-3 text-center">Part. %</th>
                            <th className="py-3 px-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {brandAggregation.brandList.map((b, idx) => {
                            const isExpanded = expandedBrand === b.brand;
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                            return (
                              <React.Fragment key={b.brand}>
                                <tr className="hover:bg-white/[0.03] transition-colors">
                                  <td className="py-3 px-3 text-center font-black text-slate-400">
                                    {medal}
                                  </td>
                                  <td className="py-3 px-3 font-black text-white">
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                                      <span>{b.brand}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {Object.entries(b.stores).map(([st, data]) => {
                                        if (data.quantity <= 0) return null;
                                        return (
                                          <span
                                            key={st}
                                            className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300"
                                          >
                                            <strong className="text-sky-300">{st}:</strong> {data.quantity} un ({formatCurrency(data.revenue)})
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-slate-300">
                                    {b.distinctModelsCount} mod.
                                  </td>
                                  <td className="py-3 px-3 text-right font-black text-white">
                                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">
                                      {b.totalQuantity} un
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right font-black text-emerald-400">
                                    {formatCurrency(b.totalRevenue)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-bold text-slate-300">
                                    {formatCurrency(b.averageTicket)}
                                  </td>
                                  <td className="py-3 px-3 text-center font-black text-purple-300">
                                    {b.sharePercent.toFixed(1)}%
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedBrand(isExpanded ? null : b.brand)}
                                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                                    >
                                      <Eye size={12} />
                                      <span>{isExpanded ? 'Recolher' : 'Modelos'}</span>
                                    </button>
                                  </td>
                                </tr>

                                {/* ACORDION DE MODELOS DA GRIFE */}
                                {isExpanded && (
                                  <tr className="bg-slate-950/80">
                                    <td colSpan={9} className="p-4 border-t border-b border-purple-500/20">
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-black uppercase text-purple-300 flex items-center gap-1.5">
                                            <Tag size={13} />
                                            Modelos e Peças Vendidas da Grife &quot;{b.brand}&quot;
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-bold">
                                            {b.models.length} modelos identificados nas vendas
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                          {b.models.map((m, mIdx) => (
                                            <div
                                              key={mIdx}
                                              className="p-3 rounded-xl bg-slate-900 border border-white/5 flex flex-col justify-between space-y-1.5"
                                            >
                                              <div>
                                                <p className="font-black text-white text-xs line-clamp-1">
                                                  {m.model}
                                                </p>
                                                {m.sku && (
                                                  <p className="text-[10px] text-slate-400 font-mono">
                                                    SKU: {m.sku}
                                                  </p>
                                                )}
                                              </div>
                                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                                                <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 text-[10px] font-bold">
                                                  {m.store}
                                                </span>
                                                <div className="text-right">
                                                  <span className="font-black text-white">{m.quantity} un</span>
                                                  <span className="text-slate-400 font-bold ml-1.5">({formatCurrency(m.revenue)})</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ==============================================================
               VISÃO PADRÃO: ESTOQUE & FILTROS INTELIGENTES (PRESETS)
               ============================================================== */
            <>
          {/* PRESETS INTELIGENTES RÁPIDOS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                Presets de Inteligência de Estoque
              </span>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={12} />
                  Limpar Seleção
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {PRESETS.map((preset) => {
                const IconComponent = preset.icon;
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all relative ${
                      isSelected
                        ? `${preset.selectedBg} shadow-lg ring-2 ring-white/20`
                        : 'glass-card border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'}`}>
                        <IconComponent size={16} />
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                    <span className="font-black text-xs leading-snug text-white">
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 line-clamp-2">
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SELETOR RÁPIDO DINÂMICO PARA O PRESET POR LOJA / UNIDADE */}
            {selectedPreset === 'loja' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex flex-wrap items-center gap-2"
              >
                <span className="text-[11px] font-black text-sky-300 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                  <Store size={14} /> Selecionar Filial:
                </span>
                {['todas', ...Array.from(new Set(['Cajati', 'Registro', 'Jacupiranga', 'Central', ...facets.stores]))].map((st) => {
                  const isSel = selectedStore.toLowerCase() === st.toLowerCase();
                  const label = st === 'todas' ? 'Todas as Lojas' : st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStore(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSel
                          ? 'bg-sky-500 text-white shadow-md font-black scale-105 ring-2 ring-sky-300/40'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* SELETOR RÁPIDO DINÂMICO PARA O PRESET POR MARCA / MATERIAL */}
            {selectedPreset === 'marca_material' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                    <Tag size={14} /> Principais Marcas:
                  </span>
                  {['todas', ...facets.brands.slice(0, 6)].map((b) => {
                    const isSel = selectedBrand.toLowerCase() === b.toLowerCase();
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBrand(b)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                          isSel
                            ? 'bg-purple-500 text-white shadow-md font-black scale-105 ring-2 ring-purple-300/40'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        {b === 'todas' ? 'Todas as Marcas' : b}
                      </button>
                    );
                  })}
                </div>
                {facets.materials.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                    <span className="text-[11px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                      <Layers size={14} /> Materiais:
                    </span>
                    {['todas', ...facets.materials.slice(0, 5)].map((m) => {
                      const isSel = selectedMaterial.toLowerCase() === m.toLowerCase();
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMaterial(m)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                            isSel
                              ? 'bg-emerald-500 text-white shadow-md font-black scale-105 ring-2 ring-emerald-300/40'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                          }`}
                        >
                          {m === 'todas' ? 'Todos os Materiais' : m}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* REFINAMENTOS SECUNDÁRIOS: LOJA, MARCA, MATERIAL, BUSCA */}
          <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl space-y-3">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Layers size={14} className="text-sky-400" />
              Refinar Critérios &amp; Localização
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Filtro por Loja */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Filial / Loja
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="todas">Todas as Lojas</option>
                  {facets.stores.map((s, idx) => (
                    <option key={idx} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Marca */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Marca / Fabricante
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="todas">Todas as Marcas</option>
                  {facets.brands.map((b, idx) => (
                    <option key={idx} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Material */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Material
                </label>
                <select
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="todas">Todos os Materiais</option>
                  {facets.materials.map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Busca Textual */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Busca Textual
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Modelo, SKU, cor..."
                    className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO VISUAL: GRÁFICO DE PIZZA / DONUT + KPIS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Gráfico Donut de Distribuição Interativo */}
            <div className="lg:col-span-7 bg-slate-950/80 border border-white/10 rounded-2xl p-4 space-y-2">
              <StockPieChart
                items={filteredItems}
                compact={false}
                title="Distribuição &amp; Indicadores Gráficos"
                metric={chartMetric}
                onMetricChange={setChartMetric}
                onSliceClick={(entry, activeMetric) => {
                  if (!entry || !entry.name) return;
                  const name = String(entry.name).trim();
                  if (activeMetric === 'saude') {
                    const lower = name.toLowerCase();
                    if (lower.includes('crítico') || lower.includes('critico') || lower.includes('esgotado')) {
                      setSelectedPreset('critico');
                    } else {
                      setSelectedPreset('todos');
                    }
                  } else if (activeMetric === 'loja') {
                    setSelectedStore(name);
                  } else if (activeMetric === 'marca') {
                    if (name !== 'Outras Marcas') {
                      setSelectedBrand(name);
                    }
                  }
                }}
              />
            </div>

            {/* Painel de Métricas Rápidas (Cards) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Modelos Filtrados
                </span>
                <p className="text-2xl font-black text-white">
                  {kpis.totalItems}
                </p>
                <span className="text-[10px] text-slate-400 font-bold">
                  de {items.length} cadastrados
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                  Volume Físico
                </span>
                <p className="text-2xl font-black text-sky-300">
                  {kpis.totalUnits} <span className="text-xs font-bold text-slate-400">un</span>
                </p>
                <span className="text-[10px] text-slate-400 font-bold">
                  saldo em estoque
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Custo Imobilizado
                </span>
                <p className="text-lg font-black text-amber-300 truncate">
                  {formatCurrency(kpis.totalCusto)}
                </p>
                <span className="text-[10px] text-slate-400 font-bold">
                  investimento em estoque
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Potencial Venda
                </span>
                <p className="text-lg font-black text-emerald-300 truncate">
                  {formatCurrency(kpis.totalVendaProjetada)}
                </p>
                <span className="text-[10px] text-emerald-400/80 font-bold">
                  margem média: {kpis.margemMedia.toFixed(0)}%
                </span>
              </div>

              {selectedPreset === 'mais_vendidos' && (
                <div className="col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-bold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Trophy size={14} className="shrink-0" />
                    Vendas Identificadas no Período:
                  </span>
                  <span className="text-white font-black text-sm">
                    {kpis.totalVendasIdentificadas} un vendidas
                  </span>
                </div>
              )}

              {kpis.criticosCount > 0 && (
                <div className="col-span-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs font-bold text-rose-300">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 animate-pulse" />
                    Atenção: Itens em Ponto Crítico / Zerados:
                  </span>
                  <span className="text-white font-black text-sm">
                    {kpis.criticosCount + kpis.esgotadosCount} itens
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PRÉVIA DOS ITENS FILTRADOS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Eye size={14} className="text-sky-400" />
                Prévia dos Primeiros Itens ({Math.min(filteredItems.length, 5)} de {filteredItems.length})
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                Ordem: {PRESETS.find(p => p.id === selectedPreset)?.label}
              </span>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-bold">
                  Nenhum produto atende a esta combinação de filtros.
                </div>
              ) : (
                <div className="divide-y divide-white/5 text-xs">
                  {filteredItems.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="p-3 hover:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-slate-500 font-mono font-bold text-center">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white">
                              {item.MARCA || item.marca || 'Sem Marca'} - {item.MODELO || item.modelo || 'Sem Modelo'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold">
                              {item.UNIDADE || item.CIDADE || item.LOJA || 'Central'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {item.REFERENCIA_SKU && <span>SKU: <strong className="text-slate-200">{item.REFERENCIA_SKU}</strong></span>}
                            {item.MATERIAL && <span>• Material: {item.MATERIAL}</span>}
                            {item._salesCount > 0 && (
                              <span className="text-amber-300 font-bold">• 🏆 {item._salesCount} vendas</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-emerald-400 font-black text-xs block">
                            {formatCurrency(item._precoVenda)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Custo: {formatCurrency(item._precoCusto)}
                          </span>
                        </div>

                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                          item._statusEstoque === 'esgotado'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : item._statusEstoque === 'critico'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {item._qtdEstoque} un
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </>
        )}
        </div>

        {/* FEEDBACK DE DOWNLOAD COM SUCESSO */}
        <AnimatePresence>
          {downloadSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-6 py-2.5 bg-emerald-500/20 border-t border-emerald-500/30 flex items-center justify-between text-xs font-bold text-emerald-300 shrink-0"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{downloadSuccessMsg || `Planilha Excel (.xlsx) exportada com sucesso contendo ${filteredItems.length} registros!`}</span>
              </div>
              <button
                type="button"
                onClick={() => setDownloadSuccess(false)}
                className="text-emerald-400 hover:text-white font-black"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RODAPÉ DO MODAL COM AS AÇÕES REQUISITADAS */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/10 bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            {activeModalTab === 'brand_sales' ? (
              <span>
                <strong className="text-white">{brandAggregation.brandList.length}</strong> grifes •{' '}
                <strong className="text-white">{brandAggregation.grandTotalQuantity}</strong> peças vendidas • Total{' '}
                <strong className="text-emerald-400">{formatCurrency(brandAggregation.grandTotalRevenue)}</strong>
              </span>
            ) : (
              <>
                <span>{filteredItems.length} de {items.length} itens selecionados</span>
                {isFiltered && (
                  <span className="text-sky-400 font-bold">• Filtro personalizado ativo</span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            {activeModalTab === 'brand_sales' ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('stock')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-black rounded-xl transition-all text-xs"
                >
                  Voltar ao Estoque
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBrandExcel}
                  disabled={brandAggregation.brandList.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 text-white font-black rounded-xl shadow-lg shadow-purple-500/25 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Baixar Relatório Completo de Vendas por Grife e Loja em Excel (.xlsx)"
                >
                  <Download size={16} />
                  <span>Baixar Relatório de Grifes (.xlsx)</span>
                </button>
              </>
            ) : (
              <>
                {/* AÇÃO 1: BAIXAR ESTOQUE EM XML */}
                <button
                  type="button"
                  onClick={handleDownloadXML}
                  disabled={filteredItems.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-amber-300 hover:text-white font-black rounded-xl shadow-lg transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Exportar registros filtrados de estoque para arquivo XML estruturado"
                >
                  <FileCode size={16} className="text-amber-400" />
                  <span>Baixar XML</span>
                </button>

                {/* AÇÃO 2: BAIXAR PLANILHA EXCEL */}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={filteredItems.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-500/40 text-emerald-300 hover:text-white font-black rounded-xl shadow-lg transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Exportar registros filtrados para arquivo Excel (.xlsx)"
                >
                  <Download size={16} className="text-emerald-400" />
                  <span>Baixar Planilha (.xlsx)</span>
                </button>

                {/* AÇÃO 3: APLICAR FILTRO NA TABELA DO ERP */}
                <button
                  type="button"
                  onClick={handleApplyFilter}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-95 text-white font-black rounded-xl shadow-lg shadow-sky-500/25 transition-all text-xs"
                  title="Exibir apenas esses itens na tabela principal do ERP"
                >
                  <Eye size={16} />
                  <span>Aplicar Filtro na Tabela ({filteredItems.length})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
