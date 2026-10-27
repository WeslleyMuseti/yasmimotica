import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ShieldAlert, Store, Tag, PieChart as PieIcon } from 'lucide-react';

const HEALTH_COLORS = {
  'Normal (> 2 un)': '#10b981',
  'Crítico (1 a 2 un)': '#f59e0b',
  'Esgotado (0 un)': '#ef4444'
};

const PALETTE = [
  '#0ea5e9', '#6366f1', '#ec4899', '#10b981', '#f59e0b',
  '#8b5cf6', '#14b8a6', '#f43f5e', '#3b82f6', '#84cc16'
];

const CustomTooltip = ({ active, payload, total }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-slate-950/95 border border-white/20 p-3 rounded-xl shadow-2xl text-xs backdrop-blur-md z-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: data.color }} />
          <span className="font-black text-white">{data.name}</span>
        </div>
        <p className="text-slate-200 font-bold">{data.value} modelos ({pct}%)</p>
        {data.units !== undefined && (
          <p className="text-slate-400 text-[11px] mt-0.5">{data.units} peças/unidades físicas</p>
        )}
      </div>
    );
  }
  return null;
};

function StockPieChart({
  items = [],
  compact = false,
  title = "Distribuição do Estoque",
  metric: controlledMetric,
  onMetricChange = null,
  onSliceClick = null
}) {
  const [internalMetric, setInternalMetric] = useState('saude'); // 'saude' | 'loja' | 'marca'
  const metric = controlledMetric !== undefined ? controlledMetric : internalMetric;

  const handleMetricChange = (newMetric) => {
    if (onMetricChange) onMetricChange(newMetric);
    setInternalMetric(newMetric);
  };

  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];

    if (metric === 'saude') {
      let normal = 0, normalUnits = 0;
      let critico = 0, criticoUnits = 0;
      let esgotado = 0, esgotadoUnits = 0;

      items.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const q = parseInt(item.ESTOQUE || item.estoque || item._qtdEstoque || 0, 10) || 0;
        if (q <= 0) {
          esgotado++;
          esgotadoUnits += q;
        } else if (q <= 2) {
          critico++;
          criticoUnits += q;
        } else {
          normal++;
          normalUnits += q;
        }
      });

      const slices = [
        { name: 'Normal (> 2 un)', value: normal, units: normalUnits, color: HEALTH_COLORS['Normal (> 2 un)'] },
        { name: 'Crítico (1 a 2 un)', value: critico, units: criticoUnits, color: HEALTH_COLORS['Crítico (1 a 2 un)'] },
        { name: 'Esgotado (0 un)', value: esgotado, units: esgotadoUnits, color: HEALTH_COLORS['Esgotado (0 un)'] }
      ];
      return slices.filter(s => s.value > 0);
    } else if (metric === 'loja') {
      const storeMap = {};
      const storeUnits = {};
      const standardStores = ['Central', 'Cajati', 'Registro', 'Jacupiranga', 'Venda Externa'];
      items.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const rawStore = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim() || 'Central';
        const matched = standardStores.find(s => s.toLowerCase() === rawStore.toLowerCase());
        const store = matched || rawStore;
        const q = parseInt(item.ESTOQUE || item.estoque || item._qtdEstoque || 0, 10) || 0;
        storeMap[store] = (storeMap[store] || 0) + 1;
        storeUnits[store] = (storeUnits[store] || 0) + q;
      });

      return Object.entries(storeMap).map(([storeName, count], idx) => ({
        name: storeName,
        value: count,
        units: storeUnits[storeName] || 0,
        color: PALETTE[idx % PALETTE.length]
      }));
    } else {
      // 'marca' (ou categoria se for brinde)
      const brandMap = {};
      const brandUnits = {};
      items.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const brand = String(item.MARCA || item.marca || item.CATEGORIA || item.categoria || 'Sem Marca/Categoria').trim() || 'Sem Marca/Categoria';
        const q = parseInt(item.ESTOQUE || item.estoque || item._qtdEstoque || 0, 10) || 0;
        brandMap[brand] = (brandMap[brand] || 0) + 1;
        brandUnits[brand] = (brandUnits[brand] || 0) + q;
      });

      const sorted = Object.entries(brandMap).sort((a, b) => b[1] - a[1]);
      const top5 = sorted.slice(0, 5);
      const remainder = sorted.slice(5);

      const slices = top5.map(([brandName, count], idx) => ({
        name: brandName,
        value: count,
        units: brandUnits[brandName] || 0,
        color: PALETTE[idx % PALETTE.length]
      }));

      if (remainder.length > 0) {
        const remVal = remainder.reduce((acc, [, val]) => acc + val, 0);
        const remUnits = remainder.reduce((acc, [k]) => acc + (brandUnits[k] || 0), 0);
        slices.push({
          name: 'Outras Marcas',
          value: remVal,
          units: remUnits,
          color: '#64748b'
        });
      }
      return slices;
    }
  }, [items, metric]);

  const totalItems = items.length;
  const totalPhysicalUnits = useMemo(() => {
    return items.reduce((acc, item) => {
      const q = parseInt(item.ESTOQUE || item.estoque || item._qtdEstoque || 0, 10) || 0;
      return acc + q;
    }, 0);
  }, [items]);

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 rounded-2xl bg-white/[0.02] border border-white/5 h-[240px]">
        <PieIcon size={32} className="opacity-30 mb-2" />
        <p className="text-xs font-bold">Nenhum item em estoque para exibir no gráfico</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? 'space-y-3' : 'space-y-4'}`}>
      {/* Controles de Perspectiva do Gráfico */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <PieIcon size={14} className="text-emerald-400" />
            {title}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-black">
            {totalItems} modelos ({totalPhysicalUnits} un.)
          </span>
        </div>

        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => handleMetricChange('saude')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
              metric === 'saude'
                ? 'bg-emerald-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Distribuição por Saúde do Estoque (Normal, Crítico, Esgotado)"
          >
            <ShieldAlert size={12} />
            <span>Saúde</span>
          </button>
          <button
            type="button"
            onClick={() => handleMetricChange('loja')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
              metric === 'loja'
                ? 'bg-sky-500 text-white font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Distribuição por Loja / Filial"
          >
            <Store size={12} />
            <span>Por Loja</span>
          </button>
          <button
            type="button"
            onClick={() => handleMetricChange('marca')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
              metric === 'marca'
                ? 'bg-fuchsia-500 text-white font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Distribuição por Marca"
          >
            <Tag size={12} />
            <span>Marcas</span>
          </button>
        </div>
      </div>

      {/* Container do Gráfico Donut + Legenda */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-black/20 p-4 rounded-2xl border border-white/5">
        {/* Gráfico Donut */}
        <div className={`sm:col-span-6 relative ${compact ? 'h-[175px] min-h-[175px]' : 'h-[210px] min-h-[210px]'} min-w-0 w-full flex items-center justify-center`}>
          <ResponsiveContainer width="100%" height={compact ? 165 : 210} minWidth={0} minHeight={compact ? 165 : 210}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={compact ? 40 : 55}
                outerRadius={compact ? 65 : 85}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                isAnimationActive={true}
                onClick={(entry) => onSliceClick && onSliceClick(entry, metric)}
                cursor={onSliceClick ? 'pointer' : 'default'}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#0b1120" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip total={totalItems} />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Rótulo Central do Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-xl font-black text-white leading-none tracking-tight">
              {totalItems}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Itens
            </span>
          </div>
        </div>

        {/* Legenda Customizada com Percentuais */}
        <div className="sm:col-span-6 space-y-2 max-h-[200px] overflow-y-auto pr-1">
          {chartData.map((item, idx) => {
            const pct = totalItems > 0 ? ((item.value / totalItems) * 100).toFixed(1) : '0.0';
            return (
              <div
                key={idx}
                onClick={() => onSliceClick && onSliceClick(item, metric)}
                className={`flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-all border border-white/5 text-xs font-semibold ${
                  onSliceClick ? 'cursor-pointer hover:border-white/20 active:scale-[0.98]' : ''
                }`}
                title={onSliceClick ? `Clique para filtrar por "${item.name}"` : undefined}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-200 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white font-black">{item.value}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px] font-bold">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default React.memo(StockPieChart);
