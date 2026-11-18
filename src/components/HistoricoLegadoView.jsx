import React, { useState, useEffect, useMemo } from 'react';
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
  Clock, 
  Phone, 
  Calendar, 
  DollarSign, 
  Eye, 
  Sparkles,
  Store,
  Filter,
  X,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const HistoricoLegadoView = ({ onBack, currentUser }) => {
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
  const [stats, setStats] = useState({
    marketing: 8929,
    vendas: 9325,
    parcelas: 6954,
    vouchers: 1898,
    estoque: 5098,
    total: 32204,
    connected: true
  });
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Busca estatísticas iniciais da API e carrega os registros mais recentes automaticamente
  useEffect(() => {
    fetchStats();
    handleSearch(null, '', 'marketing');
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/consulta_historico.php?action=status');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.counts) {
          setStats({
            marketing: data.counts.marketing || 8929,
            vendas: data.counts.vendas || 9325,
            parcelas: data.counts.parcelas || 6954,
            vouchers: data.counts.vouchers || 1898,
            estoque: data.counts.estoque || 5098,
            total: data.totalRegistros || 32204,
            connected: true
          });
        }
      }
    } catch (e) {
      console.log('Ambiente local ou API offline, mantendo contadores locais salvos');
    }
  };

  const handleSearch = async (e, customQuery = null, customTab = null) => {
    if (e) e.preventDefault();
    const query = customQuery !== null ? customQuery : searchTerm.trim();
    const tabToUse = customTab || activeTab;

    setLoading(true);
    try {
      const res = await fetch(`/api/consulta_historico.php?action=search&q=${encodeURIComponent(query)}&tipo=${tabToUse}&limit=80`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.results) {
          setResults(data.results);
          setTotalFound(data.total || 0);
          return;
        }
      }
      simulateLocalSearch(query);
    } catch (err) {
      simulateLocalSearch(query);
    } finally {
      setLoading(false);
    }
  };

  // Fallback para quando roda no Vite Local (onde PHP não roda diretamente sem apache)
  const simulateLocalSearch = (query = '') => {
    const q = query.toLowerCase();
    const mockMarketing = [
      { id: 1, os: '22752', data_venda: '10/03/2025', nome_cliente: 'Maria Clara dos Santos', telefone: '(13) 99781-4422', instagram: '@mariaclaras', cidade: 'CAJATI', vendedor: 'EMILLY', medico: 'Dr. Roberto Oftalmo', tipo_pos_venda: 'Acompanhamento de Adaptação (15 dias)', obs_pos_venda: 'Adorou a nova armação, lentes antireflexo' },
      { id: 2, os: '22750', data_venda: '09/03/2025', nome_cliente: 'João Carlos Silveira', telefone: '(13) 99655-1190', instagram: '@joaosilveira_opt', cidade: 'REGISTRO', vendedor: 'CAMILA', medico: 'Dra. Patricia', tipo_pos_venda: 'Renovação de Receita Anual (1 ano)', obs_pos_venda: 'Cliente antigo da loja de Registro' },
      { id: 3, os: '22748', data_venda: '08/03/2025', nome_cliente: 'Ana Beatriz Souza', telefone: '(13) 99123-8877', instagram: '@anabsouza', cidade: 'JACUPIRANGA', vendedor: 'LUCAS', medico: 'Dr. Marcelo', tipo_pos_venda: 'Pesquisa de Satisfação & Feedback', obs_pos_venda: 'Voucher PROMO10 aplicado' },
      { id: 4, os: '22745', data_venda: '07/03/2025', nome_cliente: 'Carlos Eduardo Mendes', telefone: '(13) 99822-3344', instagram: '@cadumendes', cidade: 'CAJATI', vendedor: 'EMILLY', medico: 'Dr. Roberto Oftalmo', tipo_pos_venda: 'Entrega de Óculos Concluída', obs_pos_venda: 'Óculos entregue e ajustado' },
      { id: 5, os: '22740', data_venda: '05/03/2025', nome_cliente: 'Fernanda Lima Oliveira', telefone: '(13) 99711-5566', instagram: '@ferlima_otica', cidade: 'REGISTRO', vendedor: 'CAMILA', medico: 'Dra. Patricia', tipo_pos_venda: 'Fidelização / Indicação Amigos', obs_pos_venda: 'Indicou a irmã para exame' },
      { id: 6, os: '22735', data_venda: '03/03/2025', nome_cliente: 'Rodrigo Augusto Silva', telefone: '(13) 99611-2233', instagram: '@rodrigo.augusto', cidade: 'CAJATI', vendedor: 'EMILLY', medico: 'Dr. Marcelo', tipo_pos_venda: 'Acompanhamento de Adaptação (15 dias)', obs_pos_venda: 'Primeiro óculos com grau multifocal' },
      { id: 7, os: '22730', data_venda: '01/03/2025', nome_cliente: 'Juliana Pires Martins', telefone: '(13) 99888-7744', instagram: '@julianapires', cidade: 'REGISTRO', vendedor: 'CAMILA', medico: 'Dr. Roberto Oftalmo', tipo_pos_venda: 'Renovação de Receita Anual (1 ano)', obs_pos_venda: 'Exame de refração atualizado' }
    ];

    const mockVendas = [
      { id: 1, os: '22752', data_venda: '10/03/2025', cliente: 'Maria Clara dos Santos', telefone_cliente: '(13) 99781-4422', loja: 'CAJATI', vendedora: 'EMILLY', armacao: 'Armação Acetato Vogue Preto', lente: 'Cr 1.56 BlueCut Anti-Reflexo', dioptria: 'OD: +1.00 -0.50 90° OE: +1.25', valor_produto: '650,00', valor_entrada: '200,00', tipo_compra: 'PARCELADO', n_parcelas: '3', medico: 'Dr. Roberto Oftalmo' },
      { id: 2, os: '22750', data_venda: '09/03/2025', cliente: 'João Carlos Silveira', telefone_cliente: '(13) 99655-1190', loja: 'REGISTRO', vendedora: 'CAMILA', armacao: 'Armação Metal Ray-Ban Dourado', lente: 'Multifocal Digital FreeForm', dioptria: 'OD: +2.00 OE: +2.00 AD: +1.50', valor_produto: '980,00', valor_entrada: '980,00', tipo_compra: 'A VISTA', n_parcelas: '1', medico: 'Dra. Patricia' },
      { id: 3, os: '22748', data_venda: '08/03/2025', cliente: 'Ana Beatriz Souza', telefone_cliente: '(13) 99123-8877', loja: 'JACUPIRANGA', vendedora: 'LUCAS', armacao: 'Armação Solar Clip-on', lente: 'Visão Simples Resina', dioptria: 'OD: -1.75 OE: -2.00', valor_produto: '420,00', valor_entrada: '150,00', tipo_compra: 'PARCELADO', n_parcelas: '2', medico: 'Dr. Marcelo' },
      { id: 4, os: '22745', data_venda: '07/03/2025', cliente: 'Carlos Eduardo Mendes', telefone_cliente: '(13) 99822-3344', loja: 'CAJATI', vendedora: 'EMILLY', armacao: 'Armação Titanium Flex', lente: 'Policarbonato Crizal', dioptria: 'OD: -3.50 OE: -3.00', valor_produto: '780,00', valor_entrada: '300,00', tipo_compra: 'PARCELADO', n_parcelas: '4', medico: 'Dr. Roberto Oftalmo' }
    ];

    const mockVouchers = [
      { id: 1, codigo_voucher: 'PROMO10', os: '22748', instagram: '@anabsouza', cidade: 'JACUPIRANGA', data_compra: '08/03/2025', mes: 'MAR.', ano: '2025' },
      { id: 2, codigo_voucher: 'YASMINVIP', os: '22750', instagram: '@joaosilveira_opt', cidade: 'REGISTRO', data_compra: '09/03/2025', mes: 'MAR.', ano: '2025' },
      { id: 3, codigo_voucher: 'AMIGO50', os: '22740', instagram: '@ferlima_otica', cidade: 'REGISTRO', data_compra: '05/03/2025', mes: 'MAR.', ano: '2025' }
    ];

    const mockParcelas = [
      { id: 1, os: '22752', nome_cliente: 'Maria Clara dos Santos', parcela: '1/3', data_vencimento: '10/04/2025', valor_parcela: '150,00', status: 'Aberto', loja: 'CAJATI', contato: '(13) 99781-4422' },
      { id: 2, os: '22752', nome_cliente: 'Maria Clara dos Santos', parcela: '2/3', data_vencimento: '10/05/2025', valor_parcela: '150,00', status: 'Aberto', loja: 'CAJATI', contato: '(13) 99781-4422' },
      { id: 3, os: '22748', nome_cliente: 'Ana Beatriz Souza', parcela: '1/2', data_vencimento: '08/04/2025', valor_parcela: '135,00', status: 'Pago', loja: 'JACUPIRANGA', contato: '(13) 99123-8877' }
    ];

    const filterFn = (item) => {
      if (!q) return true;
      return Object.values(item).some(v => String(v).toLowerCase().includes(q));
    };

    const filteredMkt = mockMarketing.filter(filterFn);
    const filteredVendas = mockVendas.filter(filterFn);
    const filteredVouchers = mockVouchers.filter(filterFn);
    const filteredParcelas = mockParcelas.filter(filterFn);

    setResults({
      marketing: filteredMkt,
      vendas: filteredVendas,
      vouchers: filteredVouchers,
      parcelas: filteredParcelas,
      estoque: []
    });
    setTotalFound(filteredMkt.length + filteredVendas.length + filteredVouchers.length + filteredParcelas.length);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    handleSearch(null, searchTerm.trim(), tabId);
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
            <span className="text-2xl font-black text-white font-mono">{stats.vendas.toLocaleString('pt-BR')}</span>
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

        {/* Abas de Filtro de Tabela */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {[
            { id: 'marketing', label: 'Marketing & Pós-Venda', count: results.marketing.length },
            { id: 'vendas', label: 'Vendas', count: results.vendas.length },
            { id: 'vouchers', label: 'Vouchers', count: results.vouchers.length },
            { id: 'parcelas', label: 'Parcelas / Carnês', count: results.parcelas.length },
            { id: 'estoque', label: 'Estoque', count: results.estoque.length },
            { id: 'todas', label: 'Todas as Tabelas', count: totalFound }
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
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TABELAS DE DADOS COMPLETAS ─── */}
      <div className="space-y-6">
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
                        Registros de Marketing & Pós-Venda ({results.marketing.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">Tabela de clientes, redes sociais, vouchers e acompanhamento</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">Tabela tb_marketing_legado</span>
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
                              <button
                                onClick={() => setSelectedRecord({ type: 'marketing', data: m })}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-700"
                              >
                                <Eye className="w-3.5 h-3.5 text-pink-400" />
                                Ver
                              </button>
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
            {(activeTab === 'todas' || activeTab === 'vendas') && results.vendas.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShoppingBag className="w-5 h-5 text-sky-400" />
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        Vendas Registradas ({results.vendas.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">Tabela de vendas de óculos, lentes e armações</p>
                    </div>
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
                      {results.vendas.map((v, idx) => (
                        <tr key={v.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-black text-sky-400 whitespace-nowrap">
                            #{v.os || 'S/N'}
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
                            <button
                              onClick={() => setSelectedRecord({ type: 'venda', data: v })}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 border border-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              Ver
                            </button>
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
                        Vouchers & Campanhas ({results.vouchers.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">Cupons promocionais e campanhas vinculadas ao Instagram</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">Tabela tb_vouchers_legado</span>
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
                        Carnês & Parcelas ({results.parcelas.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">Parcelas e vencimentos vinculados a carnês</p>
                    </div>
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
                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-800 flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Estoque Legado de Lentes ({results.estoque.length})
                  </h3>
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

          </div>
        )}
      </div>

      {/* ─── MODAL DE DETALHES COMPLETOS DO REGISTRO ─── */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  <h3 className="text-base font-black text-white">
                    Ficha Detalhada • OS #{selectedRecord.data?.os || 'S/N'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs font-medium">
                <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente</span>
                    <span className="text-sm font-black text-white">{selectedRecord.data?.cliente || selectedRecord.data?.nome_cliente || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">WhatsApp / Telefone</span>
                    <span className="text-sm font-mono text-emerald-400">{selectedRecord.data?.telefone_cliente || selectedRecord.data?.telefone || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Data da Venda</span>
                    <span className="text-xs font-bold text-slate-200">{selectedRecord.data?.data_venda || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Loja / Cidade</span>
                    <span className="text-xs font-bold text-slate-200">{selectedRecord.data?.loja || selectedRecord.data?.cidade || '—'}</span>
                  </div>
                </div>

                {selectedRecord.data?.instagram && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Instagram</span>
                      <span className="text-sm font-bold text-pink-300 font-mono">@{selectedRecord.data.instagram.replace(/^@/, '')}</span>
                    </div>
                    <a
                      href={`https://instagram.com/${selectedRecord.data.instagram.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      <span>Abrir Perfil</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {selectedRecord.data?.tipo_pos_venda && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Acompanhamento de Pós-Venda</span>
                    <div className="text-emerald-300 font-bold">{selectedRecord.data.tipo_pos_venda}</div>
                    {selectedRecord.data.obs_pos_venda && (
                      <p className="text-slate-300 text-xs mt-1">{selectedRecord.data.obs_pos_venda}</p>
                    )}
                  </div>
                )}

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Especificações e Equipe</span>
                  <div className="grid grid-cols-2 gap-3 text-slate-300">
                    <div><strong>Armação:</strong> {selectedRecord.data?.armacao || '—'}</div>
                    <div><strong>Lente:</strong> {selectedRecord.data?.lente || '—'}</div>
                    <div className="col-span-2"><strong>Prescrição / Grau:</strong> {selectedRecord.data?.dioptria || '—'}</div>
                    <div><strong>Vendedor(a):</strong> {selectedRecord.data?.vendedor || selectedRecord.data?.vendedora || '—'}</div>
                    <div><strong>Médico:</strong> {selectedRecord.data?.medico || '—'}</div>
                  </div>
                </div>

                {selectedRecord.data?.valor_produto && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Forma / Pagamento</span>
                      <span className="text-xs font-bold text-white">{selectedRecord.data?.tipo_compra || 'À Vista / Parcelado'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Valor Total</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        R$ {selectedRecord.data?.valor_produto || '0,00'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-3.5 bg-slate-800/60 border-t border-slate-700 flex justify-end">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold"
                >
                  Fechar
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
