import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import {
  DollarSign, CheckCircle, Users, ShoppingBag,
  MapPin, AlertCircle, Package, CreditCard,
  Table2, BarChart2, PlusCircle, AlertTriangle,
  FileSpreadsheet, Sparkles, Activity, Eye, TrendingUp,
  Phone, Award, Layers, Trophy, Gift
} from 'lucide-react';
import FileUploader from './FileUploader';
import { Upload as UploadIcon } from 'lucide-react';
import DataTable from './DataTable';
import VendorRanking from './VendorRanking';

const COLORS = ['#38bdf8', '#818cf8', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6', '#ec4899', '#64748b'];

const cleanVal = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/R\$\s?/,'').replace(/\./g,'').replace(',','.').trim()) || 0;
};

const fmtMoeda = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isValid = (v) => {
  if (v === null || v === undefined || v === '') return false;
  const s = String(v).trim();
  if (s === '') return false;
  if (['#N/A','#VALUE!','#REF!','#NAME?','#NULL!','#NUM!','#DIV/0!'].includes(s)) return false;
  if (s.toLowerCase().startsWith('sem registro')) return false;
  return true;
};

// ─── 1. MARKETING HISTÓRICO ──────────────────────────────────────────────────
const HistoricalMarketingView = ({ rows }) => {
  const stats = useMemo(() => {
    let faturamento = 0, custo = 0, lucro = 0;
    const cidadeMap = {};
    const formaPagMap = {};
    const lentesMap = {};

    rows.forEach(r => {
      const vVenda = cleanVal(r['VALOR DA VENDA'] || r['VALOR'] || 0);
      const vCompra = cleanVal(r['VALOR DA COMPRA'] || 0);
      const vLucro = cleanVal(r['LUCRO'] || (vVenda - vCompra) || 0);

      faturamento += vVenda;
      custo += vCompra;
      lucro += vLucro;

      const cid = String(r['CIDADE'] || r['Cidade'] || 'Central').trim();
      if (isValid(cid)) cidadeMap[cid] = (cidadeMap[cid] || 0) + (vVenda > 0 ? vVenda : 1);

      const pag = String(r['FORMA DE PAGAMENTO'] || r['FORMA PAGAMENTO'] || '').trim();
      if (isValid(pag)) formaPagMap[pag] = (formaPagMap[pag] || 0) + 1;

      const lente = String(r['LENTE'] || '').trim();
      if (isValid(lente)) lentesMap[lente] = (lentesMap[lente] || 0) + 1;
    });

    return {
      totalRegistros: rows.length,
      faturamento,
      custo,
      lucro,
      margem: faturamento > 0 ? ((lucro / faturamento) * 100) : 0,
      cidades: Object.entries(cidadeMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
      formasPag: Object.entries(formaPagMap).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
      topLentes: Object.entries(lentesMap).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total de Registros</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.totalRegistros.toLocaleString()} OS</div>
          <div className="text-[11px] text-slate-500 mt-1">Histórico da Planilha Marketing</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{fmtMoeda(stats.faturamento)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Soma total de vendas</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Custo de Produtos</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-400">{fmtMoeda(stats.custo)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Valor pago a fornecedores</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Lucro Bruto</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-400">{fmtMoeda(stats.lucro)}</div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1">{stats.margem.toFixed(1)}% de margem</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-sky-400" />
            Vendas por Loja / Cidade
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            {stats.cidades.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart data={stats.cidades}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} formatter={v => [fmtMoeda(v), 'Volume']} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {stats.cidades.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-emerald-400" />
            Formas de Pagamento Mais Utilizadas
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            {stats.formasPag.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart layout="vertical" data={stats.formasPag}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} formatter={v => [v, 'Qtd. Vendas']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                    {stats.formasPag.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 2. BD MARKETING & BD MARKETING ANTIGO ───────────────────────────────────
const HistoricalBDMarketingView = ({ rows, title = 'BD Marketing' }) => {
  const stats = useMemo(() => {
    let withPhone = 0, withInstagram = 0, totalValor = 0;
    const clientesSet = new Set();
    const cidadeMap = {};
    const medicoMap = {};
    const mesMap = {};

    rows.forEach(r => {
      const nome = String(r['NOME'] || '').trim().toUpperCase();
      if (isValid(nome)) clientesSet.add(nome);

      const tel = r['TELEFONE CLIENTE'] || r['TELEFONE'] || '';
      if (isValid(tel) && String(tel).length >= 8) withPhone++;

      const insta = r['INSTAGRAM'] || r['MARCOU NO INSTAGRAM'] || '';
      if (isValid(insta)) withInstagram++;

      const val = cleanVal(r['VALOR'] || r['VALOR TOTAL'] || 0);
      totalValor += val;

      const cid = String(r['CIDADE'] || 'Central').trim();
      if (isValid(cid)) cidadeMap[cid] = (cidadeMap[cid] || 0) + 1;

      const med = String(r['OFTALMOLOGISTA /OPTOMETRISTA'] || '').trim();
      if (isValid(med) && med.length > 2) medicoMap[med] = (medicoMap[med] || 0) + 1;

      const mes = String(r['MÊS'] || r['ANO'] || '').trim();
      if (isValid(mes)) mesMap[mes] = (mesMap[mes] || 0) + 1;
    });

    return {
      totalAtendimentos: rows.length,
      totalClientes: clientesSet.size,
      withPhone,
      withInstagram,
      totalValor,
      cidades: Object.entries(cidadeMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
      medicos: Object.entries(medicoMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Atendimentos</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.totalAtendimentos.toLocaleString()} OS</div>
          <div className="text-[11px] text-slate-500 mt-1">Base histórica consolidada</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Clientes Únicos</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-indigo-400">{stats.totalClientes.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pessoas atendidas</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Com WhatsApp</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Phone size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{stats.withPhone.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1">
            {stats.totalAtendimentos > 0 ? ((stats.withPhone / stats.totalAtendimentos) * 100).toFixed(0) : 0}% de contato
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Instagram</span>
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-pink-400">{stats.withInstagram.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Engajamento em redes</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Volume Total</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-400">{stats.totalValor > 0 ? fmtMoeda(stats.totalValor) : stats.totalAtendimentos.toLocaleString() + ' reg'}</div>
          <div className="text-[11px] text-slate-500 mt-1">Registros na base</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-indigo-400" />
            Atendimentos por Unidade / Cidade
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            {stats.cidades.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart data={stats.cidades}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {stats.cidades.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            Principais Oftalmologistas / Optometristas
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            {stats.medicos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart layout="vertical" data={stats.medicos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={130} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} formatter={v => [v, 'Receitas']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                    {stats.medicos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem médicos identificados</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 3. PARCELAS HISTÓRICO ───────────────────────────────────────────────────
const HistoricalParcelasView = ({ rows }) => {
  const stats = useMemo(() => {
    let totalGeral = 0, totalPago = 0, totalAberto = 0;
    let qtdPago = 0, qtdAberto = 0;
    const lojaMap = {};

    rows.forEach(r => {
      const val = cleanVal(r['VALOR PARCELA'] || r['VALOR TOTAL'] || r['Valor Parcela'] || 0);
      const status = String(r['STATUS'] || r['MOVIMENTAÇÃO'] || r['Moviment.'] || '').trim().toLowerCase();
      
      totalGeral += val;

      if (status.includes('pago') || (status !== '—' && status !== 'pendente' && status !== '')) {
        totalPago += val;
        qtdPago++;
      } else {
        totalAberto += val;
        qtdAberto++;
      }

      const loja = String(r['LOJA'] || r['Loja'] || 'Central').trim();
      if (isValid(loja)) lojaMap[loja] = (lojaMap[loja] || 0) + val;
    });

    return {
      totalRegistros: rows.length,
      totalGeral,
      totalPago,
      totalAberto,
      qtdPago,
      qtdAberto,
      lojas: Object.entries(lojaMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total em Carteira</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{fmtMoeda(stats.totalGeral)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{stats.totalRegistros.toLocaleString()} parcelas geradas</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Parcelas Pagas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{fmtMoeda(stats.totalPago)}</div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1">{stats.qtdPago.toLocaleString()} títulos liquidados</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Em Aberto</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-400">{fmtMoeda(stats.totalAberto)}</div>
          <div className="text-[11px] text-rose-400 font-bold mt-1">{stats.qtdAberto.toLocaleString()} títulos a receber</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Recuperação</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-400">
            {stats.totalGeral > 0 ? ((stats.totalPago / stats.totalGeral) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Taxa de recebimento geral</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-amber-400" />
          Carteira de Parcelas por Loja
        </h3>
        <div className="h-[250px] min-w-0 min-h-[250px] w-full">
          {stats.lojas.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={stats.lojas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} formatter={v => [fmtMoeda(v), 'Total em Parcelas']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={44}>
                  {stats.lojas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
        </div>
      </div>
    </div>
  );
};

// ─── 4. ORÇAMENTOS HISTÓRICO ─────────────────────────────────────────────────
const HistoricalOrcamentosView = ({ rows }) => {
  const stats = useMemo(() => {
    let totalVal = 0, convertidos = 0;
    const lojaMap = {};

    rows.forEach(r => {
      const val = cleanVal(r['VALOR DO ORÇAMENTO'] || 0);
      totalVal += val;
      const res = String(r['RESULTADO DA MENSAGEM'] || '').toUpperCase();
      if (res.includes('VENDA')) convertidos++;
      const loja = String(r['LOJA'] || 'Central').trim();
      lojaMap[loja] = (lojaMap[loja] || 0) + val;
    });

    return {
      totalOrcamentos: rows.length,
      totalVal,
      convertidos,
      taxaConversao: rows.length ? ((convertidos / rows.length) * 100) : 0,
      lojas: Object.entries(lojaMap).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Orçamentos</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.totalOrcamentos.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Cotações geradas</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Volume Total</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-400">{fmtMoeda(stats.totalVal)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Valor orçado</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Convertidos</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{stats.convertidos.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1">Fechados em venda</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Conversão</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-violet-400">{stats.taxaConversao.toFixed(1)}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Taxa de sucesso</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <ShoppingBag size={18} className="text-violet-400" />
          Volume de Orçamentos por Loja
        </h3>
        <div className="h-[250px] min-w-0 min-h-[250px] w-full">
          {stats.lojas.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={stats.lojas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} formatter={v => [fmtMoeda(v), 'Orçamentos']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {stats.lojas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
        </div>
      </div>
    </div>
  );
};

// ─── 5. DIOPTRIA HISTÓRICO ───────────────────────────────────────────────────
const HistoricalDioptriaView = ({ rows }) => {
  const stats = useMemo(() => {
    const lojaMap = {};
    const lentesMap = {};

    rows.forEach(r => {
      const loja = String(r['QUAL LOJA'] || r['CIDADE'] || 'Central').trim();
      if (isValid(loja)) lojaMap[loja] = (lojaMap[loja] || 0) + 1;

      const lente = String(r['LENTE'] || '').trim();
      if (isValid(lente)) lentesMap[lente] = (lentesMap[lente] || 0) + 1;
    });

    return {
      totalDioptrias: rows.length,
      lojas: Object.entries(lojaMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
      lentes: Object.entries(lentesMap).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Total de Registros de Dioptria / Graus</span>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.totalDioptrias.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Histórico completo de dioptrias</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-teal-400" />
            Lançamentos de Dioptria por Loja
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            {stats.lojas.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart data={stats.lojas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {stats.lojas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Package size={18} className="text-sky-400" />
            Tipos de Lentes Mais Usadas
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            {stats.lentes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <BarChart layout="vertical" data={stats.lentes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                    {stats.lentes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 6. ESTOQUE HISTÓRICO (ESTOQUE & ENTRADA SAÍDAS) ─────────────────────────
const HistoricalEstoqueView = ({ rows }) => {
  const stats = useMemo(() => {
    let totalEntradas = 0, totalSaidas = 0, totalSaldo = 0;
    const tiposMap = {};

    rows.forEach(r => {
      const ent = cleanVal(r['ENTRADAS (PAR)'] || r['ENTRADAS'] || r['QTD (PAR)'] || 0);
      const sai = cleanVal(r['SAÍDAS (PAR)'] || r['SAÍDAS'] || 0);
      const est = cleanVal(r['EM ESTOQUE'] || (ent - sai) || 0);

      totalEntradas += ent;
      totalSaidas += sai;
      totalSaldo += est;

      const tipo = String(r['LENTE'] || r['TIPO PRODUTO'] || r['LAB'] || 'Geral').trim();
      if (isValid(tipo)) tiposMap[tipo] = (tiposMap[tipo] || 0) + (est > 0 ? est : 1);
    });

    return {
      totalItens: rows.length,
      totalEntradas,
      totalSaidas,
      totalSaldo,
      tipos: Object.entries(tiposMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Total de Lentes Catalogadas</span>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.totalItens.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Modelos e dioptrias</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Saldo Total em Estoque</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{stats.totalSaldo.toLocaleString()} pares</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Disponível em estoque</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Total de Entradas</span>
          <div className="text-2xl font-extrabold text-sky-400 mt-1">{stats.totalEntradas.toLocaleString()} pares</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Total de Saídas</span>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">{stats.totalSaidas.toLocaleString()} pares</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Package size={18} className="text-teal-400" />
          Estoque por Tipo de Lente
        </h3>
        <div className="h-[250px] min-w-0 min-h-[250px] w-full">
          {stats.tipos.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={stats.tipos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {stats.tipos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Sem dados</div>}
        </div>
      </div>
    </div>
  );
};

// ─── 7. INFLUENCERS HISTÓRICO ─────────────────────────────────────────────────
const HistoricalInfluencerView = ({ rows }) => {
  const stats = useMemo(() => {
    let faturamento = 0, custo = 0;
    const inflMap = {};

    rows.forEach(r => {
      const vVenda = cleanVal(r['VALOR DE VENDA'] || r['VALOR'] || 0);
      const vCusto = cleanVal(r['CUSTO PRODUTO'] || 0);

      faturamento += vVenda;
      custo += vCusto;

      const infl = String(r['INLFUENCER'] || r['INFLUENCER'] || 'Parcerias').trim();
      if (isValid(infl)) inflMap[infl] = (inflMap[infl] || 0) + (vVenda > 0 ? vVenda : 1);
    });

    return {
      totalAcoes: rows.length,
      faturamento,
      custo,
      lucro: faturamento - custo,
      influencers: Object.entries(inflMap).map(([name, value]) => ({ name, value })),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Total de Ações / Vendas</span>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.totalAcoes.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Faturamento Gerado</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{fmtMoeda(stats.faturamento)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Custo do Produto</span>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">{fmtMoeda(stats.custo)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Retorno Líquido</span>
          <div className="text-2xl font-extrabold text-sky-400 mt-1">{fmtMoeda(stats.lucro)}</div>
        </div>
      </div>
    </div>
  );
};

// ─── 8. ANALISADOR GENÉRICO INTELIGENTE PARA QUALQUER OUTRA ABA ───────────────
const GenericHistoricalView = ({ rows, tabName }) => {
  const stats = useMemo(() => {
    let totalSoma = 0;
    let hasValues = false;
    const catMap = {};

    rows.forEach(r => {
      // Procura qualquer coluna de valor ou número
      Object.keys(r).forEach(k => {
        const keyLower = k.toLowerCase();
        if (keyLower.includes('valor') || keyLower.includes('total') || keyLower.includes('preco') || keyLower.includes('saldo')) {
          const v = cleanVal(r[k]);
          if (v > 0) {
            totalSoma += v;
            hasValues = true;
          }
        }
      });

      // Procura primeira coluna categórica ou cidade
      const catKey = Object.keys(r).find(k => {
        const kl = k.toLowerCase();
        return kl.includes('cidade') || kl.includes('loja') || kl.includes('unidade') || kl.includes('tipo') || kl.includes('status') || kl.includes('categoria');
      });

      if (catKey && isValid(r[catKey])) {
        const c = String(r[catKey]).trim();
        catMap[c] = (catMap[c] || 0) + 1;
      }
    });

    return {
      totalLinhas: rows.length,
      totalSoma,
      hasValues,
      categorias: Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(([name, value]) => ({ name, value }))
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <span className="text-xs font-bold uppercase text-slate-400">Total de Linhas / Registros</span>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.totalLinhas.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Aba {tabName}</div>
        </div>
        {stats.hasValues && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
            <span className="text-xs font-bold uppercase text-slate-400">Volume Total Somado</span>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">{fmtMoeda(stats.totalSoma)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Soma de valores detectados</div>
          </div>
        )}
      </div>

      {stats.categorias.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <BarChart2 size={18} className="text-sky-400" />
            Distribuição dos Dados ({tabName})
          </h3>
          <div className="h-[250px] min-w-0 min-h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
              <BarChart data={stats.categorias}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {stats.categorias.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────
const Dashboard = ({ data, isSynced, onRowUpdate, onAddClick, onDataLoaded, onOpenOSManagement, onOpenPOS }) => {
  const [activeModule, setActiveModule] = useState('resumo'); // 'resumo', 'vendas', 'clientes', 'estoque', 'financeiro', 'excel'
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [excelSubTab, setExcelSubTab] = useState('MARKETING');

  const sheets = useMemo(() => {
    if (!data) return {};
    if (Array.isArray(data)) return { 'Planilha': data };
    return data;
  }, [data]);

  // Filtragem por cidade
  const filterByCity = (rows) => {
    if (!rows || !Array.isArray(rows)) return [];
    if (selectedCity === 'ALL') return rows;
    return rows.filter(r => {
      const cid = String(r['CIDADE'] || r['Cidade'] || r['Unidade'] || r['UNIDADE'] || r['Loja'] || r['QUAL LOJA'] || r['Responsável Cidade'] || '').trim().toLowerCase();
      const target = selectedCity.toLowerCase();
      return cid.includes(target) || target.includes(cid);
    });
  };

  // Dados filtrados das coleções em tempo real
  const vendasRows = useMemo(() => filterByCity(sheets['Registro_Vendas'] || sheets['BD MARKETING'] || []), [sheets, selectedCity]);
  const clientesRows = useMemo(() => filterByCity(sheets['CLIENTES_CADASTRADOS'] || []), [sheets, selectedCity]);
  const armacoesRows = useMemo(() => filterByCity(sheets['CAD_ARMACOES'] || []), [sheets, selectedCity]);
  const lentesRows = useMemo(() => filterByCity(sheets['CAD_LENTES'] || []), [sheets, selectedCity]);
  const brindesRows = useMemo(() => filterByCity(sheets['CAD_BRINDES'] || []), [sheets, selectedCity]);
  const receberRows = useMemo(() => filterByCity(sheets['CONTAS_RECEBER'] || []), [sheets, selectedCity]);
  const pagarRows = useMemo(() => filterByCity(sheets['CONTAS_PAGAR'] || []), [sheets, selectedCity]);

  // KPIs Globais Consolidados (Nuvem + Vendas)
  const globalStats = useMemo(() => {
    let faturamento = 0;
    vendasRows.forEach(r => {
      faturamento += cleanVal(r['VALOR TOTAL'] || r['VALOR DO ORÇAMENTO'] || r['VALOR DA VENDA'] || r['VALOR'] || 0);
    });

    let aReceber = 0;
    receberRows.forEach(r => {
      const status = String(r['STATUS'] || r['status'] || 'Pendente').toLowerCase();
      if (!status.includes('pago') && !status.includes('recebido')) {
        aReceber += cleanVal(r['VALOR'] || r['valor'] || 0);
      }
    });

    let totalPecasEstoque = 0;
    [...armacoesRows, ...lentesRows, ...brindesRows].forEach(r => {
      totalPecasEstoque += parseInt(r['ESTOQUE'] || r['estoque'] || 1, 10) || 0;
    });

    let estoqueBaixo = 0;
    [...armacoesRows, ...lentesRows, ...brindesRows].forEach(r => {
      const q = parseInt(r['ESTOQUE'] || r['estoque'] || 0, 10);
      if (q <= 2) estoqueBaixo++;
    });

    return {
      faturamento,
      totalVendas: vendasRows.length,
      totalClientes: clientesRows.length,
      aReceber,
      totalPecasEstoque,
      estoqueBaixo
    };
  }, [vendasRows, clientesRows, receberRows, armacoesRows, lentesRows, brindesRows]);

  // Vendas por Cidade para gráfico
  const chartVendasCidade = useMemo(() => {
    const map = {};
    (sheets['Registro_Vendas'] || sheets['BD MARKETING'] || []).forEach(r => {
      const cid = String(r['CIDADE'] || r['Cidade'] || r['Unidade'] || r['UNIDADE'] || 'Central').trim();
      const val = cleanVal(r['VALOR TOTAL'] || r['VALOR'] || 0);
      map[cid] = (map[cid] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sheets]);

  // Top Produtos
  const chartTopProdutos = useMemo(() => {
    const map = {};
    vendasRows.forEach(r => {
      const prod = String(r['PRODUTO'] || r['Produto'] || r['ARMAÇÃO'] || r['LENTE'] || '').trim();
      if (prod && isValid(prod)) map[prod] = (map[prod] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  }, [vendasRows]);

  // Todas as abas do Excel disponíveis (com filtro de segurança para não exibir usuários ou senhas)
  const excelTabs = useMemo(() => {
    const knownKeys = new Set([
      'Registro_Vendas', 'CLIENTES_CADASTRADOS', 'CAD_ARMACOES', 'CAD_LENTES', 
      'CONTAS_RECEBER', 'CONTAS_PAGAR', 'USUARIOS', 'usuarios', 'users', 'Users', 
      'DELETED_ITEMS', 'Planilha', 'senhas', 'passwords', 'credenciais'
    ]);
    return Object.keys(sheets).filter(k => {
      const lower = k.toLowerCase().trim();
      if (knownKeys.has(k) || lower.includes('usuario') || lower.includes('user') || lower.includes('senha') || lower.includes('pass')) return false;
      return sheets[k] && sheets[k].length > 0;
    });
  }, [sheets]);

  // Dados da sub-aba selecionada do Excel (com filtro de cidade)
  const currentExcelRows = useMemo(() => {
    return filterByCity(sheets[excelSubTab] || []);
  }, [sheets, excelSubTab, selectedCity]);

  return (
    <div className="space-y-6 pb-20 font-sans text-slate-100">
      
      {/* ─── BARRA SUPERIOR: CONTROLE E FILTROS CLAROS ─── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <BarChart2 className="text-sky-400" size={26} />
            Painel Gerencial
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Visão consolidada da operação, clientes, estoque e histórico completo.</p>
        </div>

        {/* Filtro por Loja */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-stretch md:self-auto justify-between md:justify-start">
          <span className="text-xs font-semibold text-slate-400 px-2 flex items-center gap-1">
            <MapPin size={14} className="text-sky-400" /> Loja:
          </span>
          {[
            { id: 'ALL', label: 'Todas' },
            { id: 'Cajati', label: 'Cajati' },
            { id: 'Registro', label: 'Registro' },
            { id: 'Jacupiranga', label: 'Jacupiranga' },
            { id: 'Venda Externa', label: 'Venda Externa' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCity(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedCity === c.id
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CARDS DE ESTATÍSTICAS PRINCIPAIS (ALTA LEGIBILIDADE) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Faturamento */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{fmtMoeda(globalStats.faturamento)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total de vendas emitidas</div>
        </div>

        {/* Card 2: Vendas / OS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ordens de Serviço</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{globalStats.totalVendas.toLocaleString()} OS</div>
          <div className="text-[11px] text-slate-500 mt-1">Vendas e atendimentos</div>
        </div>

        {/* Card 3: Clientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Clientes Cadastrados</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{globalStats.totalClientes.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Base de clientes ativa</div>
        </div>

        {/* Card 4: A Receber */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pendente a Receber</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-400">{fmtMoeda(globalStats.aReceber)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Saldos devedores / boletos</div>
        </div>

        {/* Card 5: Estoque */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Itens em Estoque</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{globalStats.totalPecasEstoque.toLocaleString()} un</div>
          <div className="text-[11px] text-rose-400 mt-1">{globalStats.estoqueBaixo} modelos com estoque baixo</div>
        </div>

      </div>

      {/* ─── NAVEGAÇÃO DE ABAS PRINCIPAIS (SIMPLES E INTUITIVA) ─── */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'resumo', label: '📊 Resumo Geral', count: null },
            { id: 'ranking', label: '🏆 Ranking de Vendedores', count: 'TOP 10', isHighlight: true },
            { id: 'pos_caixa', label: '🛒 Caixa (PDV)', count: null, isAction: true },
            { id: 'os_gestao', label: '📋 Gestão de OS (Semáforo)', count: null, isAction: true },
            { id: 'vendas', label: '🛒 Vendas & OS (Nuvem)', count: vendasRows.length },
            { id: 'clientes', label: '👥 Clientes (Nuvem)', count: clientesRows.length },
            { id: 'estoque', label: '👓 Estoque (Armações, Lentes & Brindes)', count: armacoesRows.length + lentesRows.length + brindesRows.length },
            { id: 'financeiro', label: '💰 Financeiro', count: receberRows.length + pagarRows.length },
            ...(excelTabs.length > 0 ? [{ id: 'excel', label: '📁 Gráficos da Planilha Histórica', count: excelTabs.length }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'pos_caixa' && onOpenPOS) {
                  onOpenPOS();
                } else if (tab.id === 'os_gestao' && onOpenOSManagement) {
                  onOpenOSManagement();
                } else {
                  setActiveModule(tab.id);
                }
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                tab.id === 'ranking'
                  ? activeModule === 'ranking'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                  : tab.id === 'pos_caixa'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                    : tab.id === 'os_gestao'
                      ? 'bg-pink-500/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20'
                      : activeModule === tab.id
                        ? 'bg-slate-800 text-sky-400 border border-sky-500/30 shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                  tab.id === 'ranking'
                    ? activeModule === 'ranking' ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-300'
                    : activeModule === tab.id ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CONTEÚDO DA ABA SELECIONADA ─── */}

      {/* 1. ABA RESUMO & GRÁFICOS */}
      {activeModule === 'resumo' && (
        <div className="space-y-6">
          {/* Banner Chamada para o Ranking de Vendedores */}
          <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-950/40 border border-amber-500/30 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30 shrink-0">
                <Trophy size={26} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  Ranking de Vendedores e Pódio dos Campeões
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">TOP 10</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Acompanhe os líderes de faturamento, quantidade de vendas e metas comerciais por loja.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModule('ranking')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trophy size={14} /> Ver Ranking Completo
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Gráfico 1: Vendas por Unidade */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-sky-400" />
                Faturamento por Loja (Unidade)
              </h3>
              <div className="h-[250px] min-w-0 min-h-[250px] w-full">
                {chartVendasCidade.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                    <BarChart data={chartVendasCidade}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }}
                        formatter={v => [fmtMoeda(v), 'Faturamento']}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {chartVendasCidade.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Nenhum dado por loja</div>
                )}
              </div>
            </div>

            {/* Gráfico 2: Top Produtos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-400" />
                Produtos / Armações Mais Vendidas
              </h3>
              <div className="h-[250px] min-w-0 min-h-[250px] w-full">
                {chartTopProdutos.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                    <BarChart layout="vertical" data={chartTopProdutos}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={140} stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px' }}
                        formatter={v => [v, 'Qtd. Vendida']}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                        {chartTopProdutos.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">Nenhum produto registrado</div>
                )}
              </div>
            </div>

          </div>

          {/* Tabela Resumida das Últimas Vendas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Table2 size={18} className="text-indigo-400" />
                Últimas Ordens de Serviço / Vendas (Nuvem)
              </h3>
              <button onClick={() => setActiveModule('vendas')} className="text-xs text-sky-400 hover:underline font-bold">
                Ver Todas as Vendas &rarr;
              </button>
            </div>
            <DataTable sheetName="Registro_Vendas" rows={vendasRows.slice(0, 10)} onRowUpdate={onRowUpdate} allowEdit={false} />
          </div>
        </div>
      )}

      {/* 2. ABA RANKING DE VENDEDORES (TOP 10 + PÓDIO) */}
      {activeModule === 'ranking' && (
        <VendorRanking data={sheets} selectedCity={selectedCity} />
      )}

      {/* 3. ABA VENDAS & OS */}
      {activeModule === 'vendas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Todas as Ordens de Serviço e Vendas</h3>
              <p className="text-xs text-slate-400">{vendasRows.length} registros encontrados para esta seleção.</p>
            </div>
            {onAddClick && (
              <button
                onClick={() => onAddClick('Registro_Vendas', {})}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <PlusCircle size={15} /> Nova Venda
              </button>
            )}
          </div>
          <DataTable sheetName="Registro_Vendas" rows={vendasRows} onRowUpdate={onRowUpdate} />
        </div>
      )}

      {/* 3. ABA CLIENTES */}
      {activeModule === 'clientes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Cadastro Completo de Clientes</h3>
              <p className="text-xs text-slate-400">{clientesRows.length} clientes na base.</p>
            </div>
            {onAddClick && (
              <button
                onClick={() => onAddClick('CLIENTES_CADASTRADOS', {})}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <PlusCircle size={15} /> Novo Cliente
              </button>
            )}
          </div>
          <DataTable sheetName="CLIENTES_CADASTRADOS" rows={clientesRows} onRowUpdate={onRowUpdate} />
        </div>
      )}

      {/* 4. ABA ESTOQUE */}
      {activeModule === 'estoque' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="text-sky-400" size={20} />
              Estoque de Armações ({armacoesRows.length} modelos)
            </h3>
            <DataTable sheetName="CAD_ARMACOES" rows={armacoesRows} onRowUpdate={onRowUpdate} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="text-teal-400" size={20} />
              Estoque de Lentes ({lentesRows.length} tipos)
            </h3>
            <DataTable sheetName="CAD_LENTES" rows={lentesRows} onRowUpdate={onRowUpdate} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Gift className="text-pink-400" size={20} />
              Estoque de Brindes &amp; Cortesias ({brindesRows.length} modelos)
            </h3>
            <DataTable sheetName="CAD_BRINDES" rows={brindesRows} onRowUpdate={onRowUpdate} />
          </div>
        </div>
      )}

      {/* 5. ABA FINANCEIRO */}
      {activeModule === 'financeiro' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="text-amber-400" size={20} />
              Contas a Receber ({receberRows.length} lançamentos)
            </h3>
            <DataTable sheetName="CONTAS_RECEBER" rows={receberRows} onRowUpdate={onRowUpdate} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="text-rose-400" size={20} />
              Contas a Pagar ({pagarRows.length} lançamentos)
            </h3>
            <DataTable sheetName="CONTAS_PAGAR" rows={pagarRows} onRowUpdate={onRowUpdate} />
          </div>
        </div>
      )}

      {/* 6. ABA PLANILHA HISTÓRICA DO EXCEL (COM INDICADORES E GRÁFICOS EM TODAS AS ABAS) */}
      {activeModule === 'excel' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="text-indigo-400" size={22} />
                Histórico & Indicadores da Planilha Original
              </h3>
              <p className="text-xs text-slate-400">Selecione qualquer uma das abas abaixo para ver seus indicadores, estatísticas e gráficos reais correspondentes:</p>
            </div>

            {/* Sub-abas do Excel */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              {excelTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setExcelSubTab(tab)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    excelSubTab === tab
                      ? 'bg-sky-500 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{tab}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${excelSubTab === tab ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {(sheets[tab] || []).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Renderizador de Indicadores e Gráficos por Tipo de Aba Histórica */}
          {excelSubTab === 'MARKETING' && (
            <HistoricalMarketingView rows={currentExcelRows} />
          )}

          {(excelSubTab === 'BD MARKETING' || excelSubTab === 'BD MARKETING ANTIGO') && (
            <HistoricalBDMarketingView rows={currentExcelRows} title={excelSubTab} />
          )}

          {(excelSubTab === 'Controle_Parcelas' || excelSubTab === 'RELATÓRIO PARCELAS') && (
            <HistoricalParcelasView rows={currentExcelRows} />
          )}

          {excelSubTab === 'ORÇAMENTOS' && (
            <HistoricalOrcamentosView rows={currentExcelRows} />
          )}

          {excelSubTab === 'Cópia de DADOS DIOPTRIA' && (
            <HistoricalDioptriaView rows={currentExcelRows} />
          )}

          {(excelSubTab === 'ESTOQUE' || excelSubTab === 'ESTOQUE ENTRADA SAÍDAS') && (
            <HistoricalEstoqueView rows={currentExcelRows} />
          )}

          {excelSubTab === 'AnáliseInfluencer' && (
            <HistoricalInfluencerView rows={currentExcelRows} />
          )}

          {/* Analisador dinâmico de indicadores para qualquer outra aba do Excel */}
          {!['MARKETING', 'BD MARKETING', 'BD MARKETING ANTIGO', 'Controle_Parcelas', 'RELATÓRIO PARCELAS', 'ORÇAMENTOS', 'Cópia de DADOS DIOPTRIA', 'ESTOQUE', 'ESTOQUE ENTRADA SAÍDAS', 'AnáliseInfluencer'].includes(excelSubTab) && (
            <GenericHistoricalView rows={currentExcelRows} tabName={excelSubTab} />
          )}

          {/* Tabela de Dados Detalhados */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Table2 size={16} className="text-slate-400" />
                Registros Detalhados de {excelSubTab} ({currentExcelRows.length} linhas)
              </h4>
            </div>
            <DataTable sheetName={excelSubTab} rows={currentExcelRows} onRowUpdate={onRowUpdate} />
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
