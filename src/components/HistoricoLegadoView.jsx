import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Database, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  FileText, 
  Tag, 
  Layers, 
  Users, 
  ChevronRight, 
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Clock, 
  Phone, 
  Calendar, 
  DollarSign, 
  Eye, 
  Sparkles,
  Store,
  Filter,
  X,
  ExternalLink,
  Pencil,
  Save,
  Check,
  Loader2,
  HelpCircle,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const HistoricoLegadoView = ({ onBack, currentUser, salesData = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('marketing'); // 'marketing', 'vendas', 'vouchers', 'parcelas', 'estoque', 'todas'
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    marketing: [],
    vendas: [],
    vouchers: [],
    parcelas: [],
    estoque: []
  });
  const [totalFound, setTotalFound] = useState(0);

  // 🛡️ Integração das vendas em tempo real do Firebase (Registro_Vendas / Nuvem)
  const liveSalesFormatted = useMemo(() => {
    if (!Array.isArray(salesData) || salesData.length === 0) return [];
    return salesData
      .filter(s => {
        if (!s || typeof s !== 'object') return false;
        const prod = String(s['PRODUTO'] || s['SERVIÇO'] || s['Produto'] || '').toLowerCase();
        const tipo = String(s.tipo || s.TIPO || '').toUpperCase();
        if (
          tipo === 'RECEBIMENTO' ||
          s.isInstallmentReceipt === true ||
          s.isInstallment === true ||
          /recebimento\s+de\s+mensalidade|quitação\s+de\s+parcela|mensalidade\s+de\s+carnê/i.test(prod)
        ) {
          return false;
        }
        return true;
      })
      .map(s => {
        const os = s['OS DA VENDA'] || s.OS || s.numeroOS || s.os || s.VENDA_OS || s['Nº DA OS'] || '';
        const dt = s['DATA DA VENDA'] || s['DATA  DA VENDA'] || s.DATA || s.data_venda || s.dataVenda || s.data || (s.dataHora ? s.dataHora.slice(0, 10) : '');
        const client = s.CLIENTE || s.cliente || s.NOME || s['Nome Completo'] || s['NOME CLIENTE'] || 'Consumidor';
        const tel = s['TELEFONE CLIENTE'] || s.WhatsApp || s.TELEFONE || s.telefone || '';
        const loja = s.UNIDADE || s.CIDADE || s.LOJA || s.loja || s.unidade || (String(os).startsWith('CAJ') ? 'Cajati' : String(os).startsWith('REG') ? 'Registro' : String(os).startsWith('JAC') ? 'Jacupiranga' : 'Cajati');
        const vend = s.VENDEDOR || s.vendedor || s.OPERADOR || s.operador || 'Vendedora';
        const arm = s['ARMAÇÃO'] || s.armacao || '';
        const len = s.LENTE || s.lente || s.PRODUTO || '';
        const diop = s.DIOPTRIA || s.dioptria || '';
        const tot = s['VALOR TOTAL'] || s.valorTotal || s.VALOR || s['VALOR DA VENDA'] || '0,00';
        const ent = s['VALOR ENTRADA'] || s.valorEntrada || s.ENTRADA || s.SINAL || '0,00';
        return {
          id: s.id || `live_${os}`,
          os: String(os).replace(/^#/, ''),
          data_venda: dt,
          cliente: client,
          telefone_cliente: tel,
          loja: String(loja).toUpperCase(),
          vendedora: vend,
          armacao: arm,
          lente: len,
          dioptria: diop,
          valor_produto: typeof tot === 'number' ? tot.toFixed(2).replace('.', ',') : String(tot),
          valor_venda: typeof tot === 'number' ? tot.toFixed(2).replace('.', ',') : String(tot),
          valor_entrada: typeof ent === 'number' ? ent.toFixed(2).replace('.', ',') : String(ent),
          _isLive: true,
          raw: s
        };
      });
  }, [salesData]);

  // Lista unificada de vendas exibidas (Vendas da Nuvem com prioridade + Vendas do arquivo legado)
  const displayVendas = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    const liveFiltered = liveSalesFormatted.filter(item => {
      if (!q) return true;
      return Object.values(item).some(v => String(v || '').toLowerCase().includes(q));
    });

    const apiList = Array.isArray(results.vendas) ? results.vendas : [];
    const seenOS = new Set(liveFiltered.map(l => String(l.os || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
    const filteredApi = apiList.filter(item => {
      const k = String(item.os || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return !k || !seenOS.has(k);
    });

    return [...liveFiltered, ...filteredApi];
  }, [liveSalesFormatted, results.vendas, searchTerm]);

  // Paginação inteligente de 50 em 50 registros
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage] = useState(50);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const tableSectionRef = useRef(null);

  const [stats, setStats] = useState({
    marketing: 8929,
    vendas: 9325,
    parcelas: 6954,
    vouchers: 1898,
    estoque: 5098,
    total: 32204,
    connected: true
  });

  const [tabCounts, setTabCounts] = useState({
    marketing: 8929,
    vendas: 9325,
    parcelas: 6954,
    vouchers: 1898,
    estoque: 5098,
    todas: 32204
  });
  
  // Modais de Detalhes e Edição
  const [selectedRecord, setSelectedRecord] = useState(null); // { type, data }
  const [editingRecord, setEditingRecord] = useState(null);   // { type, data }
  const [editSaving, setEditSaving] = useState(false);
  const [editStatus, setEditStatus] = useState(null);         // { type: 'success' | 'error', message: '' }
  const [showRawColumns, setShowRawColumns] = useState(false);

  const currentTabTotal = useMemo(() => {
    if (activeTab === 'todas') return totalFound || tabCounts.todas || stats.total;
    return tabCounts[activeTab] ?? stats[activeTab] ?? totalFound;
  }, [activeTab, tabCounts, stats, totalFound]);

  // Busca estatísticas iniciais da API e carrega os registros mais recentes automaticamente
  useEffect(() => {
    fetchStats();
    handleSearch(null, '', 'marketing', 1);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/consulta_historico.php?action=status');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.counts) {
          const loadedStats = {
            marketing: data.counts.marketing || 8929,
            vendas: data.counts.vendas || 9325,
            parcelas: data.counts.parcelas || 6954,
            vouchers: data.counts.vouchers || 1898,
            estoque: data.counts.estoque || 5098,
            total: data.totalRegistros || 32204,
            connected: true
          };
          setStats(loadedStats);
          setTabCounts(prev => ({
            ...prev,
            ...data.counts,
            todas: data.totalRegistros || 32204
          }));
        }
      }
    } catch (e) {
      console.log('Ambiente local ou API offline, mantendo contadores locais salvos');
    }
  };

  const handleSearch = async (e, customQuery = null, customTab = null, pageToUse = 1) => {
    if (e) e.preventDefault();
    const query = customQuery !== null ? customQuery : searchTerm.trim();
    const tabToUse = customTab || activeTab;

    setLoading(true);
    try {
      const res = await fetch(`/api/consulta_historico.php?action=search&q=${encodeURIComponent(query)}&tipo=${tabToUse}&page=${pageToUse}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.results) {
          setResults(data.results);
          setTotalFound(data.total || 0);
          setCurrentPage(data.page || pageToUse);
          setTotalPages(data.totalPages || 1);
          if (data.counts) {
            setTabCounts(prev => ({ ...prev, ...data.counts }));
          }
          return;
        }
      }
      await simulateLocalSearch(query, tabToUse, pageToUse);
    } catch (err) {
      await simulateLocalSearch(query, tabToUse, pageToUse);
    } finally {
      setLoading(false);
    }
  };

  // Fallback robusto para quando roda offline ou no Vite Local
  const simulateLocalSearch = async (query = '', tabToUse = activeTab, pageToUse = 1) => {
    try {
      const cacheRes = await fetch('/data/legado_cache.json');
      if (cacheRes.ok) {
        const db = await cacheRes.json();
        const normQ = (query || '').trim().toLowerCase();
        const digits = normQ.replace(/\D/g, '');

        const filterItem = (item) => {
          if (!normQ) return true;
          for (const [k, v] of Object.entries(item)) {
            if (!v) continue;
            const str = String(v).toLowerCase();
            if (str.includes(normQ)) return true;
            if (digits.length >= 3) {
              const itemDigits = str.replace(/\D/g, '');
              if (itemDigits && itemDigits.includes(digits)) return true;
            }
          }
          return false;
        };

        const tables = ['marketing', 'vendas', 'vouchers', 'parcelas', 'estoque'];
        const filtered = {};
        const counts = {};

        for (const t of tables) {
          if (tabToUse === 'todas' || tabToUse === t) {
            const list = db[t] || [];
            filtered[t] = normQ ? list.filter(filterItem) : list;
            counts[t] = filtered[t].length;
          } else {
            filtered[t] = [];
            counts[t] = (db[t] || []).length;
          }
        }

        const activeTotal = tabToUse === 'todas'
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[tabToUse] || 0);

        const computedTotalPages = Math.max(1, Math.ceil(activeTotal / 50));
        const offset = (pageToUse - 1) * 50;

        const resObj = {};
        for (const t of tables) {
          if (tabToUse === 'todas' || tabToUse === t) {
            resObj[t] = filtered[t].slice(offset, offset + 50);
          } else {
            resObj[t] = [];
          }
        }

        setResults(resObj);
        setTotalFound(activeTotal);
        setCurrentPage(pageToUse);
        setTotalPages(computedTotalPages);
        setTabCounts(prev => ({ ...prev, ...counts, todas: Object.values(counts).reduce((a, b) => a + b, 0) }));
        return;
      }
    } catch (e) {
      console.error('Fallback local cache error:', e);
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    handleSearch(null, searchTerm.trim(), tabId, 1);
  };

  const goToPage = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages || pageNumber === currentPage) return;
    setCurrentPage(pageNumber);
    handleSearch(null, searchTerm.trim(), activeTab, pageNumber);
    if (tableSectionRef.current) {
      tableSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [];
    if (current <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', total);
    } else if (current >= total - 3) {
      pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
    } else {
      pages.push(1, '...', current - 1, current, current + 1, '...', total);
    }
    return pages;
  };

  // ─── SALVAMENTO DE EDIÇÃO NO BANCO MYSQL HOSTINGER ──────────────────────────
  const handleSaveEdit = async () => {
    if (!editingRecord || !editingRecord.data) return;
    setEditSaving(true);
    setEditStatus(null);

    const payload = {
      action: 'edit_row',
      table: editingRecord.type,
      id: editingRecord.data.id,
      ...editingRecord.data
    };

    try {
      const res = await fetch('/api/salvar_pos_venda.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json && json.success) {
        setEditStatus({ type: 'success', message: 'Alterações gravadas com sucesso no MySQL!' });

        // Atualiza a tabela em tempo real sem precisar recarregar
        setResults(prev => {
          const list = prev[editingRecord.type] || [];
          const updatedList = list.map(item => {
            if (item.id === editingRecord.data.id || (item.os && item.os === editingRecord.data.os)) {
              return { ...item, ...editingRecord.data };
            }
            return item;
          });
          return { ...prev, [editingRecord.type]: updatedList };
        });

        setTimeout(() => {
          setEditingRecord(null);
          setEditStatus(null);
        }, 700);
      } else {
        setEditStatus({ type: 'error', message: json?.error || 'Erro ao salvar alterações no MySQL.' });
      }
    } catch (err) {
      // Em modo dev local, atualiza localmente para permitir testes
      setResults(prev => {
        const list = prev[editingRecord.type] || [];
        const updatedList = list.map(item => {
          if (item.id === editingRecord.data.id || (item.os && item.os === editingRecord.data.os)) {
            return { ...item, ...editingRecord.data };
          }
          return item;
        });
        return { ...prev, [editingRecord.type]: updatedList };
      });
      setEditStatus({ type: 'success', message: 'Atualizado com sucesso localmente!' });
      setTimeout(() => {
        setEditingRecord(null);
        setEditStatus(null);
      }, 700);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ─── TOPO & CABEÇALHO (DASHBOARD MARKETING) ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition-all rounded-xl text-slate-300 hover:text-white shrink-0"
              title="Voltar"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Dashboard Marketing</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Gestão e análise de marketing, vouchers, redes sociais, pós-venda e histórico de vendas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchStats();
              handleSearch(null, searchTerm.trim(), activeTab);
            }}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-pink-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Tabela</span>
          </button>
        </div>
      </div>

      {/* ─── CARDS DE INDICADORES (KPIS) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div 
          onClick={() => handleTabChange('marketing')}
          className={`cursor-pointer rounded-2xl p-4 flex flex-col justify-between transition-all border ${
            activeTab === 'marketing' 
              ? 'bg-pink-500/10 border-pink-500/40 shadow-lg shadow-pink-500/10' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Marketing & Pós-Venda</span>
            <Users className="w-4 h-4 text-pink-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{stats.marketing.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] text-pink-400/80 block">contatos com redes</span>
          </div>
        </div>

        <div 
          onClick={() => handleTabChange('vendas')}
          className={`cursor-pointer rounded-2xl p-4 flex flex-col justify-between transition-all border ${
            activeTab === 'vendas' 
              ? 'bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/10' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Vendas</span>
            <ShoppingBag className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{(stats.vendas + liveSalesFormatted.length).toLocaleString('pt-BR')}</span>
            <span className="text-[10px] text-slate-500 block">vendas registradas</span>
          </div>
        </div>

        <div 
          onClick={() => handleTabChange('vouchers')}
          className={`cursor-pointer rounded-2xl p-4 flex flex-col justify-between transition-all border ${
            activeTab === 'vouchers' 
              ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Vouchers</span>
            <Tag className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{stats.vouchers.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] text-amber-400/80 block">cupons e campanhas</span>
          </div>
        </div>

        <div 
          onClick={() => handleTabChange('parcelas')}
          className={`cursor-pointer rounded-2xl p-4 flex flex-col justify-between transition-all border ${
            activeTab === 'parcelas' 
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Carnês & Parcelas</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{stats.parcelas.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] text-slate-500 block">parcelas de clientes</span>
          </div>
        </div>

        <div 
          onClick={() => handleTabChange('estoque')}
          className={`cursor-pointer rounded-2xl p-4 flex flex-col justify-between transition-all border ${
            activeTab === 'estoque' 
              ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Estoque Legado</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{stats.estoque.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] text-slate-500 block">lentes e dioptrias</span>
          </div>
        </div>
      </div>

      {/* ─── BARRA DE BUSCA E ABAS DE NAVEGAÇÃO ─── */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por Nome do Cliente, Instagram (@), Telefone, Nº da OS, Vendedor ou Médico..."
              className="w-full pl-12 pr-10 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-medium transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  handleSearch(null, '', activeTab);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-pink-600/25 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar na Tabela
          </button>
        </form>

        {/* Abas de Filtro de Tabela com Contadores Reais Consolidados */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {[
            { id: 'marketing', label: 'Marketing & Pós-Venda', count: tabCounts.marketing ?? stats.marketing },
            { id: 'vendas', label: 'Vendas', count: tabCounts.vendas ?? stats.vendas },
            { id: 'vouchers', label: 'Vouchers', count: tabCounts.vouchers ?? stats.vouchers },
            { id: 'parcelas', label: 'Parcelas / Carnês', count: tabCounts.parcelas ?? stats.parcelas },
            { id: 'estoque', label: 'Estoque', count: tabCounts.estoque ?? stats.estoque },
            { id: 'todas', label: 'Todas as Tabelas', count: tabCounts.todas ?? stats.total }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/25'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700/50'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {tab.count.toLocaleString('pt-BR')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TABELAS DE DADOS COMPLETAS COM BOTÃO DE EDITAR ─── */}
      <div ref={tableSectionRef} className="space-y-6">
        {loading ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl">
            <RefreshCw className="w-8 h-8 text-pink-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-200 font-bold">Carregando informações do Dashboard Marketing...</p>
            <p className="text-xs text-slate-500 mt-1">Sincronizando registros e colunas detalhadas.</p>
          </div>
        ) : totalFound === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-black text-white">Nenhum registro encontrado</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Tente buscar pelo primeiro nome do cliente, usuário do Instagram (@), número da OS ou cidade.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* ─── 1. TABELA PRINCIPAL DE MARKETING & PÓS-VENDA ─── */}
            {(activeTab === 'todas' || activeTab === 'marketing') && results.marketing.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-pink-400" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Registros de Marketing & Pós-Venda ({(tabCounts.marketing ?? stats.marketing).toLocaleString('pt-BR')})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Tabela de clientes, redes sociais, vouchers e acompanhamento • Página {currentPage} de {totalPages} (50 por página)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs font-mono font-bold">
                      {Math.min((currentPage - 1) * perPage + 1, tabCounts.marketing ?? stats.marketing)} - {Math.min(currentPage * perPage, tabCounts.marketing ?? stats.marketing)} de {(tabCounts.marketing ?? stats.marketing).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Tabela tb_marketing_legado</span>
                  </div>
                </div>

                <div className="overflow-x-auto erp-scroll">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">OS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Data</th>
                        <th className="py-3 px-3.5">Cliente</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">WhatsApp / Contato</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Instagram</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Loja</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Vendedor</th>
                        <th className="py-3 px-3.5">Médico</th>
                        <th className="py-3 px-3.5">Ação Pós-Venda</th>
                        <th className="py-3 px-3.5">Observações</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {results.marketing.map((m, idx) => {
                        const rawPhone = String(m.telefone || '').replace(/\D/g, '');
                        const phoneUrl = rawPhone ? `https://wa.me/55${rawPhone}?text=${encodeURIComponent(`Olá, ${m.nome_cliente || 'Cliente'}! Agradecemos pela preferência na Ótica Yasmin!`)}` : null;
                        const instaHandle = m.instagram ? m.instagram.replace(/^@/, '') : '';
                        const instaUrl = instaHandle ? `https://instagram.com/${encodeURIComponent(instaHandle)}` : null;

                        return (
                          <tr key={m.id || idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3.5 font-mono font-black text-indigo-400 whitespace-nowrap">
                              #{m.os || 'S/N'}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                              {m.data_venda || '-'}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-white whitespace-nowrap">
                              {m.nome_cliente || 'Consumidor'}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {m.telefone ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-emerald-400">{m.telefone}</span>
                                  {phoneUrl && (
                                    <a
                                      href={phoneUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Abrir WhatsApp"
                                      className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              ) : <span className="text-slate-600">-</span>}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {instaHandle ? (
                                <a
                                  href={instaUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-300 hover:bg-pink-500/20 transition-colors font-mono text-[11px]"
                                >
                                  <span>@{instaHandle}</span>
                                </a>
                              ) : <span className="text-slate-600">-</span>}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                                {m.cidade || 'CAJATI'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-300">
                              {m.vendedor || '-'}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                              {m.medico || '-'}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {m.tipo_pos_venda ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold">
                                  {m.tipo_pos_venda}
                                </span>
                              ) : <span className="text-slate-600">-</span>}
                            </td>
                            <td className="py-3 px-3.5 max-w-xs truncate text-slate-400" title={m.obs_pos_venda || ''}>
                              {m.obs_pos_venda || '-'}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedRecord({ type: 'marketing', data: m })}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-700 shadow-sm"
                                  title="Ver informações completas do banco"
                                >
                                  <Eye className="w-3.5 h-3.5 text-pink-400" />
                                  Ver
                                </button>
                                <button
                                  onClick={() => {
                                    setEditStatus(null);
                                    setEditingRecord({ type: 'marketing', data: { ...m } });
                                  }}
                                  className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-indigo-500/30 shadow-sm"
                                  title="Editar informações no MySQL"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                  Editar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── 2. TABELA DE VENDAS ─── */}
            {(activeTab === 'todas' || activeTab === 'vendas') && displayVendas.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShoppingBag className="w-5 h-5 text-sky-400" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Vendas Registradas ({displayVendas.length.toLocaleString('pt-BR')})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Tabela de vendas integradas (Nuvem em tempo real + Arquivo Histórico)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-mono font-bold">
                      {displayVendas.length.toLocaleString('pt-BR')} registros
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Vendas Integradas</span>
                  </div>
                </div>

                <div className="overflow-x-auto erp-scroll">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">OS</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Data</th>
                        <th className="py-3 px-3.5">Cliente</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Contato</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Loja</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Vendedora</th>
                        <th className="py-3 px-3.5">Armação & Lente</th>
                        <th className="py-3 px-3.5">Grau / Dioptria</th>
                        <th className="py-3 px-3.5 text-right whitespace-nowrap">Valor Total</th>
                        <th className="py-3 px-3.5 text-right whitespace-nowrap">Entrada</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {displayVendas.map((v, idx) => (
                        <tr key={v.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-black text-sky-400 whitespace-nowrap">
                            #{v.os || 'S/N'}
                            {v._isLive && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Nuvem
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                            {v.data_venda || '-'}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-white whitespace-nowrap">
                            {v.cliente || 'Consumidor'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-400 whitespace-nowrap">
                            {v.telefone_cliente || v.telefone || '-'}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                              {v.loja || 'CAJATI'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-300">
                            {v.vendedora || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-200">
                            {[v.armacao, v.lente].filter(Boolean).join(' + ') || 'Óculos'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px]">
                            {v.dioptria || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-right font-black font-mono text-emerald-400 whitespace-nowrap">
                            R$ {v.valor_produto || v.valor_venda || '0,00'}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-300 whitespace-nowrap">
                            R$ {v.valor_entrada || '0,00'}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedRecord({ type: 'venda', data: v })}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-700 shadow-sm"
                                title="Ver informações completas do banco"
                              >
                                <Eye className="w-3.5 h-3.5 text-sky-400" />
                                Ver
                              </button>
                              <button
                                onClick={() => {
                                  setEditStatus(null);
                                  setEditingRecord({ type: 'vendas', data: { ...v } });
                                }}
                                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-indigo-500/30 shadow-sm"
                                title="Editar informações no MySQL"
                              >
                                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── 3. TABELA DE VOUCHERS & CAMPANHAS ─── */}
            {(activeTab === 'todas' || activeTab === 'vouchers') && results.vouchers.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Tag className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Vouchers & Campanhas ({(tabCounts.vouchers ?? stats.vouchers).toLocaleString('pt-BR')})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Cupons promocionais e campanhas vinculadas ao Instagram • Página {currentPage} de {totalPages} (50 por página)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
                      {Math.min((currentPage - 1) * perPage + 1, tabCounts.vouchers ?? stats.vouchers)} - {Math.min(currentPage * perPage, tabCounts.vouchers ?? stats.vouchers)} de {(tabCounts.vouchers ?? stats.vouchers).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Tabela tb_vouchers_legado</span>
                  </div>
                </div>

                <div className="overflow-x-auto erp-scroll">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3 px-3.5">Código Voucher</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">OS Vinculada</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Instagram</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Cidade</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Data Compra</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Mês / Ano</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {results.vouchers.map((v, idx) => (
                        <tr key={v.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-black text-amber-300">
                            🎟️ {v.codigo_voucher || 'S/ COD'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                            {v.os ? `#${v.os}` : '-'}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {v.instagram ? (
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-300 font-mono text-[11px]">
                                @{v.instagram.replace(/^@/, '')}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                              {v.cidade || 'CAJATI'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                            {v.data_compra || v.data || '-'}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-300 font-mono">
                            {v.mes ? `${v.mes}/${v.ano}` : (v.ano || '-')}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedRecord({ type: 'vouchers', data: v })}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-700 shadow-sm"
                                title="Ver informações completas"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                Ver
                              </button>
                              <button
                                onClick={() => {
                                  setEditStatus(null);
                                  setEditingRecord({ type: 'vouchers', data: { ...v } });
                                }}
                                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-indigo-500/30 shadow-sm"
                                title="Editar voucher no MySQL"
                              >
                                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── 4. TABELA DE PARCELAS & CARNÊS ─── */}
            {(activeTab === 'todas' || activeTab === 'parcelas') && results.parcelas.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Carnês & Parcelas ({(tabCounts.parcelas ?? stats.parcelas).toLocaleString('pt-BR')})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Parcelas e vencimentos vinculados a carnês • Página {currentPage} de {totalPages} (50 por página)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
                      {Math.min((currentPage - 1) * perPage + 1, tabCounts.parcelas ?? stats.parcelas)} - {Math.min(currentPage * perPage, tabCounts.parcelas ?? stats.parcelas)} de {(tabCounts.parcelas ?? stats.parcelas).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Tabela tb_parcelas_legado</span>
                  </div>
                </div>

                <div className="overflow-x-auto erp-scroll">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">OS</th>
                        <th className="py-3 px-3.5">Cliente</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Parcela</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Vencimento</th>
                        <th className="py-3 px-3.5 text-right whitespace-nowrap">Valor</th>
                        <th className="py-3 px-3.5 text-center whitespace-nowrap">Status</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Loja</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Contato</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {results.parcelas.map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-black text-emerald-400 whitespace-nowrap">
                            #{p.os || 'S/N'}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-white whitespace-nowrap">
                            {p.nome_cliente || 'Cliente'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                            {p.parcela || '1x'}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-slate-400">
                            {p.data_vencimento || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-right font-black font-mono text-emerald-400 whitespace-nowrap">
                            R$ {p.valor_parcela || '0,00'}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              String(p.status || '').toLowerCase().includes('pago')
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                            }`}>
                              {p.status || 'Aberto'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                              {p.loja || 'CAJATI'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-400 whitespace-nowrap">
                            {p.contato || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedRecord({ type: 'parcelas', data: p })}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-700 shadow-sm"
                                title="Ver detalhes completos"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                Ver
                              </button>
                              <button
                                onClick={() => {
                                  setEditStatus(null);
                                  setEditingRecord({ type: 'parcelas', data: { ...p } });
                                }}
                                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-indigo-500/30 shadow-sm"
                                title="Editar parcela no MySQL"
                              >
                                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── 5. TABELA DE ESTOQUE LEGADO ─── */}
            {(activeTab === 'todas' || activeTab === 'estoque') && results.estoque.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Estoque Legado de Lentes ({(tabCounts.estoque ?? stats.estoque).toLocaleString('pt-BR')})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Lentes oftálmicas e dioptrias em estoque • Página {currentPage} de {totalPages} (50 por página)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono font-bold">
                      {Math.min((currentPage - 1) * perPage + 1, tabCounts.estoque ?? stats.estoque)} - {Math.min(currentPage * perPage, tabCounts.estoque ?? stats.estoque)} de {(tabCounts.estoque ?? stats.estoque).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Tabela tb_estoque_legado</span>
                  </div>
                </div>

                <div className="overflow-x-auto erp-scroll">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-3 px-3.5">Lente</th>
                        <th className="py-3 px-3.5">Dioptria / Grau</th>
                        <th className="py-3 px-3.5 text-right">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {results.estoque.map((e, idx) => (
                        <tr key={e.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-white">
                            {e.lente || 'Lente Oftálmica'}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-slate-300">
                            {e.dioptria || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-indigo-400">
                            {e.quantidade || '1'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── BARRA DE PAGINAÇÃO DE 50 EM 50 REGISTROS ─── */}
            {totalPages > 1 && (
              <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 font-mono text-[11px]">
                    <Database className="w-3.5 h-3.5 text-pink-400" />
                    <span>
                      Mostrando <strong className="text-white">{Math.min((currentPage - 1) * perPage + 1, currentTabTotal)}</strong> a <strong className="text-white">{Math.min(currentPage * perPage, currentTabTotal)}</strong> de <strong className="text-white">{currentTabTotal.toLocaleString('pt-BR')}</strong> registros
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 font-bold text-[10px]">
                    50 por página
                  </span>
                  <span className="text-slate-400 text-[11px] font-medium">
                    Página <strong className="text-white">{currentPage}</strong> de <strong className="text-white">{totalPages}</strong>
                  </span>
                </div>

                {/* Controles de Navegação */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => goToPage(1)}
                    disabled={currentPage <= 1 || loading}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none border border-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                    title="Primeira página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Primeira</span>
                  </button>

                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none border border-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>

                  {/* Números das Páginas Inteligentes */}
                  {getPageNumbers(currentPage, totalPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 text-slate-500 text-xs font-bold select-none">...</span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        onClick={() => goToPage(p)}
                        disabled={loading}
                        className={`min-w-[34px] h-[34px] rounded-xl text-xs font-bold transition-all flex items-center justify-center font-mono ${
                          currentPage === p
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none border border-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                    title="Próxima página"
                  >
                    <span>Próxima</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage >= totalPages || loading}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none border border-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                    title="Última página"
                  >
                    <span className="hidden sm:inline">Última</span>
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Salto Direto de Página */}
                  {totalPages > 3 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const p = parseInt(jumpPageInput, 10);
                        if (!isNaN(p) && p >= 1 && p <= totalPages) {
                          goToPage(p);
                          setJumpPageInput('');
                        }
                      }}
                      className="flex items-center gap-1 ml-2"
                    >
                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Ir:</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        placeholder={String(currentPage)}
                        value={jumpPageInput}
                        onChange={(e) => setJumpPageInput(e.target.value)}
                        className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-center text-white focus:outline-none focus:border-pink-500"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold"
                      >
                        OK
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ─── MODAL DE DETALHES COMPLETOS DO BANCO DE DADOS ─── */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header do Modal */}
              <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      Ficha Completa do Registro • OS #{selectedRecord.data?.os || 'S/N'}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        ID #{selectedRecord.data?.id || '—'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Origem: Tabela <code className="text-pink-300 font-bold">{selectedRecord.type === 'venda' ? 'tb_vendas_legado' : `tb_${selectedRecord.type}_legado`}</code> no MySQL Hostinger
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const rec = { ...selectedRecord };
                      setSelectedRecord(null);
                      setEditStatus(null);
                      setEditingRecord(rec);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Registro</span>
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700/60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Corpo com Informações Completas */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs font-medium erp-scroll">
                
                {/* 1. Identificação Principal */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 block border-b border-slate-800 pb-1.5">
                    1. Identificação & Dados do Cliente
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Nome do Cliente</span>
                      <span className="text-sm font-black text-white">{selectedRecord.data?.cliente || selectedRecord.data?.nome_cliente || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Número da OS</span>
                      <span className="text-sm font-mono font-black text-indigo-400">#{selectedRecord.data?.os || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Data da Venda / Compra</span>
                      <span className="text-xs font-bold text-slate-200">{selectedRecord.data?.data_venda || selectedRecord.data?.data_compra || selectedRecord.data?.data || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">CPF</span>
                      <span className="text-xs font-mono text-slate-200">{selectedRecord.data?.cpf || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">RG</span>
                      <span className="text-xs font-mono text-slate-200">{selectedRecord.data?.rg || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Data de Nascimento / Idade</span>
                      <span className="text-xs text-slate-200">
                        {selectedRecord.data?.data_nascimento || '—'} {selectedRecord.data?.idade ? `(${selectedRecord.data?.idade} anos)` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Contato & Redes Sociais */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-pink-400 block border-b border-slate-800 pb-1.5">
                    2. Contatos & Redes Sociais
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-center">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Telefone / WhatsApp</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          {selectedRecord.data?.telefone_cliente || selectedRecord.data?.telefone || selectedRecord.data?.contato || '—'}
                        </span>
                        {(selectedRecord.data?.telefone_cliente || selectedRecord.data?.telefone) && (
                          <a
                            href={`https://wa.me/55${String(selectedRecord.data?.telefone_cliente || selectedRecord.data?.telefone).replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            title="Conversar no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Instagram</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-mono font-bold text-pink-300">
                          {selectedRecord.data?.instagram ? `@${selectedRecord.data.instagram.replace(/^@/, '')}` : '—'}
                        </span>
                        {selectedRecord.data?.instagram && (
                          <a
                            href={`https://instagram.com/${selectedRecord.data.instagram.replace(/^@/, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 text-[10px] font-bold flex items-center gap-1"
                          >
                            <span>Perfil</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Responsável Legal & Contato</span>
                      <span className="text-xs text-slate-200">
                        {selectedRecord.data?.responsavel && selectedRecord.data.responsavel !== 'S/RESPONSAVEL' ? `${selectedRecord.data.responsavel} (${selectedRecord.data.telefone_responsavel || ''})` : 'O próprio titular'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Loja, Atendimento & Prescrição Óptica */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 block border-b border-slate-800 pb-1.5">
                    3. Loja, Equipe & Prescrição Óptica
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Loja / Unidade</span>
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded bg-slate-800 inline-block mt-0.5">
                        {selectedRecord.data?.loja || selectedRecord.data?.cidade || 'CAJATI'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Vendedor(a) / Operador</span>
                      <span className="text-xs font-bold text-white">{selectedRecord.data?.vendedor || selectedRecord.data?.vendedora || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Médico / Optometrista</span>
                      <span className="text-xs text-slate-200">{selectedRecord.data?.medico || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Período / Mês e Ano</span>
                      <span className="text-xs font-mono text-slate-200">
                        {selectedRecord.data?.mes ? `${selectedRecord.data?.mes}/${selectedRecord.data?.ano || ''}` : (selectedRecord.data?.ano || '—')}
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Armação</span>
                      <span className="text-xs text-slate-100">{selectedRecord.data?.armacao || '—'}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Lente Oftálmica</span>
                      <span className="text-xs text-slate-100">{selectedRecord.data?.lente || '—'}</span>
                    </div>
                    <div className="md:col-span-4 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Prescrição Completa / Grau / Dioptria</span>
                      <span className="text-xs font-mono text-sky-300 font-bold">{selectedRecord.data?.dioptria || 'Não especificado'}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Financeiro, Valores & Condições Comerciais */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block border-b border-slate-800 pb-1.5">
                    4. Valores Financeiros & Pagamento
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Valor da Venda / Total</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        R$ {selectedRecord.data?.valor_produto || selectedRecord.data?.valor_venda || selectedRecord.data?.valor_parcela || '0,00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Entrada / Sinal</span>
                      <span className="text-sm font-bold text-slate-200 font-mono">
                        R$ {selectedRecord.data?.valor_entrada || '0,00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Nº de Parcelas</span>
                      <span className="text-xs font-bold text-white">{selectedRecord.data?.n_parcelas || selectedRecord.data?.parcela || '1x'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Tipo de Compra</span>
                      <span className="text-xs font-bold text-white">{selectedRecord.data?.tipo_compra || (selectedRecord.data?.status || 'À VISTA')}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Acompanhamento de Pós-Venda, Vouchers e Observações */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block border-b border-slate-800 pb-1.5">
                    5. Pós-Venda, Vouchers & Observações
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Ação de Pós-Venda</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {selectedRecord.data?.tipo_pos_venda || 'Sem ação cadastrada'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Código do Voucher</span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {selectedRecord.data?.codigo_voucher ? `🎟️ ${selectedRecord.data.codigo_voucher}` : 'Nenhum'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Observações Registradas</span>
                      <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        {selectedRecord.data?.obs_pos_venda || selectedRecord.data?.observacoes || 'Nenhuma observação informada.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 6. Visualizador Completo de TODOS os Campos Brutos do Banco de Dados */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRawColumns(!showRawColumns)}
                    className="w-full px-4 py-3 bg-slate-950 hover:bg-slate-900/90 text-left text-xs font-bold text-slate-400 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-violet-400" />
                      Visualizar Todos os Campos Brutos do Banco de Dados ({Object.keys(selectedRecord.data || {}).length} colunas)
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      {showRawColumns ? 'Ocultar ▲' : 'Expandir ▼'}
                    </span>
                  </button>

                  {showRawColumns && (
                    <div className="p-4 bg-slate-950/90 border-t border-slate-800 overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3 text-slate-400">Coluna (MySQL)</th>
                            <th className="py-2 px-3 text-slate-400">Valor Armazenado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {Object.entries(selectedRecord.data || {}).map(([key, val]) => (
                            <tr key={key} className="hover:bg-slate-900/50">
                              <td className="py-1.5 px-3 font-bold text-pink-400">{key}</td>
                              <td className="py-1.5 px-3 text-slate-200 break-all">{val !== null && val !== undefined && val !== '' ? String(val) : <em className="text-slate-600">null / vazio</em>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Rodapé do Modal */}
              <div className="px-6 py-4 bg-slate-800/60 border-t border-slate-700 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  Registro sincronizado com segurança na Hostinger.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const rec = { ...selectedRecord };
                      setSelectedRecord(null);
                      setEditStatus(null);
                      setEditingRecord(rec);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Informações</span>
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL DE EDIÇÃO COMPLETA DE REGISTRO NO MYSQL ─── */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-indigo-500/30 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header de Edição */}
              <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Editar Informações • OS #{editingRecord.data?.os || 'S/N'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Alterações serão salvas diretamente na tabela <code className="text-indigo-300 font-bold">{editingRecord.type}</code> do banco MySQL
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulário de Edição */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs font-medium erp-scroll">
                
                {editStatus && (
                  <div className={`p-3 rounded-xl border flex items-center gap-2 ${
                    editStatus.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}>
                    {editStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
                    <span>{editStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Número da OS</label>
                    <input
                      type="text"
                      value={editingRecord.data.os || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, os: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-indigo-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Data da Venda</label>
                    <input
                      type="text"
                      value={editingRecord.data.data_venda || editingRecord.data.data || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, data_venda: e.target.value, data: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      placeholder="DD/MM/AAAA"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nome do Cliente</label>
                    <input
                      type="text"
                      value={editingRecord.data.nome_cliente || editingRecord.data.cliente || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, nome_cliente: e.target.value, cliente: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={editingRecord.data.telefone || editingRecord.data.telefone_cliente || editingRecord.data.contato || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, telefone: e.target.value, telefone_cliente: e.target.value, contato: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono focus:outline-none focus:border-indigo-500"
                      placeholder="(13) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Instagram (@)</label>
                    <input
                      type="text"
                      value={editingRecord.data.instagram || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, instagram: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-pink-300 font-mono focus:outline-none focus:border-pink-500"
                      placeholder="@perfil"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Loja / Cidade</label>
                    <input
                      type="text"
                      value={editingRecord.data.loja || editingRecord.data.cidade || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, loja: e.target.value, cidade: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      placeholder="CAJATI, REGISTRO..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Vendedor(a)</label>
                    <input
                      type="text"
                      value={editingRecord.data.vendedor || editingRecord.data.vendedora || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, vendedor: e.target.value, vendedora: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Médico / Optometrista</label>
                    <input
                      type="text"
                      value={editingRecord.data.medico || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, medico: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ação de Pós-Venda</label>
                    <select
                      value={editingRecord.data.tipo_pos_venda || 'Acompanhamento de Adaptação (15 dias)'}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, tipo_pos_venda: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Acompanhamento de Adaptação (15 dias)">Acompanhamento de Adaptação (15 dias)</option>
                      <option value="Renovação de Receita Anual (1 ano)">Renovação de Receita Anual (1 ano)</option>
                      <option value="Pesquisa de Satisfação & Feedback">Pesquisa de Satisfação & Feedback</option>
                      <option value="Entrega de Óculos Concluída">Entrega de Óculos Concluída</option>
                      <option value="Fidelização / Indicação Amigos">Fidelização / Indicação Amigos</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  {/* Campos adicionais para Vendas */}
                  {editingRecord.type === 'vendas' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Armação</label>
                        <input
                          type="text"
                          value={editingRecord.data.armacao || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, armacao: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lente</label>
                        <input
                          type="text"
                          value={editingRecord.data.lente || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, lente: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Dioptria / Grau</label>
                        <input
                          type="text"
                          value={editingRecord.data.dioptria || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, dioptria: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Valor do Produto / Venda</label>
                        <input
                          type="text"
                          value={editingRecord.data.valor_produto || editingRecord.data.valor_venda || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, valor_produto: e.target.value, valor_venda: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Valor da Entrada</label>
                        <input
                          type="text"
                          value={editingRecord.data.valor_entrada || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, valor_entrada: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">CPF</label>
                        <input
                          type="text"
                          value={editingRecord.data.cpf || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, cpf: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">RG</label>
                        <input
                          type="text"
                          value={editingRecord.data.rg || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, rg: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Campos adicionais para Vouchers */}
                  {editingRecord.type === 'vouchers' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Código do Voucher</label>
                      <input
                        type="text"
                        value={editingRecord.data.codigo_voucher || ''}
                        onChange={(e) => setEditingRecord({
                          ...editingRecord,
                          data: { ...editingRecord.data, codigo_voucher: e.target.value.toUpperCase() }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  {/* Campos adicionais para Parcelas */}
                  {editingRecord.type === 'parcelas' && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Parcela</label>
                        <input
                          type="text"
                          value={editingRecord.data.parcela || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, parcela: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                          placeholder="Ex: 1/3"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Data de Vencimento</label>
                        <input
                          type="text"
                          value={editingRecord.data.data_vencimento || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, data_vencimento: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          placeholder="DD/MM/AAAA"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Valor da Parcela</label>
                        <input
                          type="text"
                          value={editingRecord.data.valor_parcela || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, valor_parcela: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status</label>
                        <select
                          value={editingRecord.data.status || 'Aberto'}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            data: { ...editingRecord.data, status: e.target.value }
                          })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Aberto">Aberto</option>
                          <option value="Pago">Pago</option>
                          <option value="Em Atraso">Em Atraso</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={editingRecord.data.obs_pos_venda || editingRecord.data.observacoes || ''}
                      onChange={(e) => setEditingRecord({
                        ...editingRecord,
                        data: { ...editingRecord.data, obs_pos_venda: e.target.value, observacoes: e.target.value }
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Observações do atendimento..."
                    />
                  </div>
                </div>

              </div>

              {/* Rodapé de Edição */}
              <div className="px-6 py-4 bg-slate-800/60 border-t border-slate-700 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={editSaving}
                  onClick={handleSaveEdit}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Salvando no MySQL...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-white" />
                      <span>Salvar Alterações no Banco</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HistoricoLegadoView;
