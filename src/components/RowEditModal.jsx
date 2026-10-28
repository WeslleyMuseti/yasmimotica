import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Save, FileEdit, PlusCircle, Package, DollarSign, Tag, 
  Layers, Calendar, Building2, User, Eye, Glasses, CheckCircle2,
  AlertTriangle, Upload, Trash2, Shield, Info, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CANONICAL_ALIASES } from './DataTable';

const RowEditModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  rowData, 
  allCols = [], 
  COLUMN_LABELS = {}, 
  sheetName = '', 
  mode = 'edit' 
}) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (rowData) {
      const initialData = {};
      Object.keys(rowData).forEach(key => {
        let val = rowData[key];
        if (val instanceof Date) {
          val = val.toLocaleDateString('pt-BR');
        } else if (typeof val === 'number' && val > 30000 && val < 60000) {
          const d = new Date((val - 25569) * 86400 * 1000);
          val = d.toLocaleDateString('pt-BR');
        }
        initialData[key] = val !== undefined && val !== null ? String(val) : '';
      });

      // Sincroniza valores entre aliases do mesmo grupo para não deixar campos canônicos vazios
      CANONICAL_ALIASES.forEach(group => {
        let foundVal = null;
        for (const k of group.keys) {
          const v = initialData[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            foundVal = v;
            break;
          }
        }
        if (foundVal !== null) {
          group.keys.forEach(k => {
            if (initialData[k] !== undefined && (!initialData[k] || String(initialData[k]).trim() === '')) {
              initialData[k] = foundVal;
            }
          });
        }
      });

      setFormData(initialData);
    }
  }, [rowData]);

  const handleChange = (col, value) => {
    setFormData(prev => {
      const updated = { ...prev, [col]: value };
      const colTrimmed = String(col || '').trim().toLowerCase();
      const group = CANONICAL_ALIASES.find(g =>
        g.keys.some(k => k.toLowerCase() === colTrimmed)
      );
      if (group) {
        group.keys.forEach(aliasKey => {
          if (prev[aliasKey] !== undefined || rowData?.[aliasKey] !== undefined) {
            updated[aliasKey] = value;
          }
        });
      }
      return updated;
    });
  };

  const handleSave = () => {
    const cleanData = {};
    Object.keys(formData).forEach(k => {
      if (!k.startsWith('_')) {
        cleanData[k] = formData[k];
      }
    });
    onSave(cleanData);
  };

  // Identificar o contexto do formulário para exibir ícone e título temático
  const entityType = useMemo(() => {
    // 1. Prioridade estrita pelo nome da tabela/planilha
    if (sheetName) {
      if (sheetName === 'CONTAS_RECEBER') {
        return { label: 'Conta a Receber (Mensalidade / Boleto)', icon: <DollarSign className="text-emerald-400" size={24} />, color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30' };
      }
      if (sheetName === 'CONTAS_PAGAR') {
        return { label: 'Conta a Pagar (Despesa)', icon: <DollarSign className="text-rose-400" size={24} />, color: 'from-rose-500/20 to-red-500/20', border: 'border-rose-500/30' };
      }
      if (sheetName === 'CLIENTES_CADASTRADOS') {
        return { label: 'Cadastro de Cliente', icon: <User className="text-indigo-400" size={24} />, color: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-500/30' };
      }
      if (sheetName === 'CAD_ARMACOES') {
        return { label: 'Armação em Estoque', icon: <Glasses className="text-fuchsia-400" size={24} />, color: 'from-fuchsia-500/20 to-pink-500/20', border: 'border-fuchsia-500/30' };
      }
      if (sheetName === 'CAD_LENTES') {
        return { label: 'Lente Oftálmica', icon: <Eye className="text-sky-400" size={24} />, color: 'from-sky-500/20 to-blue-500/20', border: 'border-sky-500/30' };
      }
      if (sheetName === 'Registro_Vendas' || sheetName === 'BD MARKETING') {
        return { label: 'Registro de Venda / OS', icon: <FileText className="text-amber-400" size={24} />, color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' };
      }
      if (sheetName === 'VOUCHERS') {
        return { label: 'Voucher / Cupom Promocional', icon: <Tag className="text-violet-400" size={24} />, color: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/30' };
      }
      if (sheetName === 'TRANSFERENCIAS_ESTOQUE') {
        return { label: 'Transferência de Estoque', icon: <Package className="text-emerald-400" size={24} />, color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30' };
      }
    }

    // 2. Heurística inteligente baseada nas colunas do registro
    const colsStr = allCols.join(' ').toLowerCase();
    if (colsStr.includes('tamanho') || colsStr.includes('armacao') || colsStr.includes('armação') || colsStr.includes('sku')) {
      return { label: 'Armação em Estoque', icon: <Glasses className="text-fuchsia-400" size={24} />, color: 'from-fuchsia-500/20 to-pink-500/20', border: 'border-fuchsia-500/30' };
    }
    if (colsStr.includes('indice') || colsStr.includes('esferico') || colsStr.includes('lente')) {
      return { label: 'Lente Oftálmica', icon: <Eye className="text-sky-400" size={24} />, color: 'from-sky-500/20 to-blue-500/20', border: 'border-sky-500/30' };
    }
    if (colsStr.includes('fornecedor') || colsStr.includes('despesa') || colsStr.includes('pagar')) {
      return { label: 'Conta a Pagar (Despesa)', icon: <DollarSign className="text-rose-400" size={24} />, color: 'from-rose-500/20 to-red-500/20', border: 'border-rose-500/30' };
    }
    // Verificações financeiras antes de CPF genérico (evita confundir Contas a Receber com Cadastro de Cliente)
    if (colsStr.includes('receber') || colsStr.includes('venda_os') || colsStr.includes('documento') || colsStr.includes('meio_pagamento') || (colsStr.includes('vencimento') && colsStr.includes('valor'))) {
      return { label: 'Conta a Receber (Receita / Boleto)', icon: <DollarSign className="text-emerald-400" size={24} />, color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30' };
    }
    if (colsStr.includes('whatsapp') || colsStr.includes('nascimento') || (colsStr.includes('cpf') && !colsStr.includes('vencimento'))) {
      return { label: 'Cadastro de Cliente', icon: <User className="text-indigo-400" size={24} />, color: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-500/30' };
    }
    return { label: 'Registro do ERP', icon: <Package className="text-sky-400" size={24} />, color: 'from-sky-500/20 to-indigo-500/20', border: 'border-sky-500/30' };
  }, [allCols, sheetName]);

  // Desduplicação Inteligente de Colunas (Elimina campos duplicados como STATUS e status, CLIENTE e NOME CLIENTE)
  const deduplicatedCols = useMemo(() => {
    const seenGroups = new Set();
    const result = [];

    allCols.forEach(col => {
      if (!col || col.startsWith('_')) return;
      const colTrimmed = String(col).trim();
      const group = CANONICAL_ALIASES.find(g =>
        g.keys.some(k => k.toLowerCase() === colTrimmed.toLowerCase())
      );

      if (group) {
        if (!seenGroups.has(group.id)) {
          seenGroups.add(group.id);
          result.push(col);
        }
      } else {
        const lower = colTrimmed.toLowerCase();
        if (!seenGroups.has(lower)) {
          seenGroups.add(lower);
          result.push(col);
        }
      }
    });

    return result;
  }, [allCols]);

  // Agrupamento Inteligente de Campos Desduplicados
  const groupedFields = useMemo(() => {
    const mainCols = [];
    const financeCols = [];
    const techCols = [];
    const dateLocCols = [];
    const notesCols = [];
    const otherCols = [];

    const classified = new Set();

    deduplicatedCols.forEach(col => {
      if (!col || col.startsWith('_')) return;
      const k = col.toLowerCase().trim();

      // 1. Financeiro / Preços / Estoque / Status
      if (k.includes('preco') || k.includes('preço') || k.includes('valor') || k.includes('custo') || k.includes('estoque') || k.includes('status') || k.includes('devido')) {
        financeCols.push(col);
        classified.add(col);
      }
      // 2. Identificação Principal
      else if (k.includes('marca') || k.includes('modelo') || k.includes('descricao') || k.includes('descrição') || k.includes('nome') || k.includes('cliente') || k.includes('fornecedor') || k.includes('sku') || k.includes('referencia') || k.includes('referência') || k === 'os' || k.includes('nº da os') || k.includes('venda_os')) {
        mainCols.push(col);
        classified.add(col);
      }
      // 3. Especificações Técnicas / Atributos
      else if (k.includes('cor') || k.includes('tamanho') || k.includes('material') || k.includes('tratamento') || k.includes('indice') || k.includes('índice') || k.includes('esferico') || k.includes('esférico') || k.includes('cilindrico') || k.includes('cilíndrico') || k.includes('adicao') || k.includes('adição') || k.includes('imagem') || k.includes('foto')) {
        techCols.push(col);
        classified.add(col);
      }
      // 4. Datas / Localização
      else if (k.includes('data') || k.includes('vencimento') || k.includes('pagamento') || k.includes('recebimento') || k.includes('cidade') || k.includes('loja') || k.includes('unidade') || k.includes('cep') || k.includes('rua') || k.includes('bairro') || k.includes('estado')) {
        dateLocCols.push(col);
        classified.add(col);
      }
      // 5. Observações
      else if (k.includes('obs') || k.includes('observacoes') || k.includes('observações') || k.includes('detalhes') || k.includes('motivo')) {
        notesCols.push(col);
        classified.add(col);
      }
      // 6. Demais
      else {
        otherCols.push(col);
        classified.add(col);
      }
    });

    return { mainCols, financeCols, techCols, dateLocCols, notesCols, otherCols };
  }, [deduplicatedCols]);

  const getFieldLabel = (col) => {
    if (COLUMN_LABELS[col]) return COLUMN_LABELS[col];
    const colTrimmed = String(col || '').trim().toLowerCase();
    const group = CANONICAL_ALIASES.find(g =>
      g.keys.some(k => k.toLowerCase() === colTrimmed)
    );
    if (group && group.label) return group.label;
    return col.replace(/_/g, ' ');
  };

  const renderFieldInput = (col) => {
    const k = col.toLowerCase().trim();
    const label = COLUMN_LABELS[col] || col;
    const value = formData[col] || '';

    // Imagem / Foto / Comprovante
    if (k.includes('imagem') || k.includes('foto') || k.includes('comprovante')) {
      const isPdf = typeof value === 'string' && value.startsWith('data:application/pdf');
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 cursor-pointer transition-all">
              <Upload size={14} className="text-sky-400" />
              <span>{value ? 'Trocar Arquivo / Comprovante' : 'Selecionar Comprovante (Foto/PDF)'}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 4 * 1024 * 1024) {
                    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                    alert(`O arquivo selecionado possui ${sizeMB}MB. O limite máximo permitido é de 4MB para manter o sistema leve e rápido.`);
                    return;
                  }
                  if (file.type === 'application/pdf') {
                    const reader = new FileReader();
                    reader.onload = () => handleChange(col, reader.result);
                    reader.readAsDataURL(file);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      let { width, height } = img;
                      const maxDim = 1200;
                      if (width > height) {
                        if (width > maxDim) { height *= maxDim / width; width = maxDim; }
                      } else {
                        if (height > maxDim) { width *= maxDim / height; height = maxDim; }
                      }
                      canvas.width = width; canvas.height = height;
                      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                      handleChange(col, canvas.toDataURL('image/webp', 0.8));
                    };
                    img.src = event.target.result;
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => handleChange(col, '')}
                className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-all"
                title="Remover anexo"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {value && (
            isPdf ? (
              <div className="p-3 bg-slate-950 border border-white/10 rounded-xl flex items-center gap-2 text-xs text-sky-400">
                <FileText size={18} />
                <span>Documento PDF Anexado</span>
              </div>
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-black/40 border border-white/20 overflow-hidden shadow-inner flex items-center justify-center p-1">
                <img src={value} alt="Preview" className="w-full h-full object-contain rounded-xl" />
              </div>
            )
          )}
        </div>
      );
    }

    // Status de Pagamento / Registro
    if (k.includes('status')) {
      const currentStatus = String(value || 'Pendente').trim();
      const options = ['Em dia', 'Pago', 'Recebido', 'Pendente', 'Atrasado', 'Inadimplente'];

      return (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {options.map(opt => {
              const isSelected = currentStatus.toLowerCase() === opt.toLowerCase();
              let btnStyle = 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700';
              if (isSelected) {
                if (['em dia', 'pago', 'recebido'].includes(opt.toLowerCase())) {
                  btnStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm';
                } else if (['pendente'].includes(opt.toLowerCase())) {
                  btnStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm';
                } else {
                  btnStyle = 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm';
                }
              }

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleChange(col, opt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all ${btnStyle}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(col, e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
            placeholder="Outro status personalizado..."
          />

          {sheetName === 'CONTAS_RECEBER' && ['pago', 'recebido', 'em dia'].includes(currentStatus.toLowerCase()) && (
            <div className="mt-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                  Contabilizar no Fluxo de Caixa?
                </span>
                <span className="text-[9px] text-slate-500 font-medium block">
                  {formData.CONTAR_NO_CAIXA === 'Não'
                    ? '⚠️ Apenas baixa no título (não gera movimentação no caixa).'
                    : '✅ O valor será lançado como entrada no Fluxo de Caixa.'}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    handleChange('CONTAR_NO_CAIXA', 'Sim');
                    handleChange('contarNoCaixa', true);
                  }}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                    formData.CONTAR_NO_CAIXA !== 'Não'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleChange('CONTAR_NO_CAIXA', 'Não');
                    handleChange('contarNoCaixa', false);
                  }}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                    formData.CONTAR_NO_CAIXA === 'Não'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Não
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Unidade / Cidade / Loja
    if (k === 'unidade' || k === 'cidade' || k === 'loja') {
      return (
        <select
          value={value || 'Central'}
          onChange={(e) => handleChange(col, e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
        >
          <option value="Central" className="bg-slate-900 text-white">Central (Todas as Lojas)</option>
          <option value="Cajati" className="bg-slate-900 text-white">Cajati (CAJ)</option>
          <option value="Registro" className="bg-slate-900 text-white">Registro (REG)</option>
          <option value="Jacupiranga" className="bg-slate-900 text-white">Jacupiranga (JAC)</option>
          <option value="Venda Externa" className="bg-slate-900 text-white">Venda Externa (EXT)</option>
        </select>
      );
    }

    // Material (Ótica)
    if (k === 'material') {
      return (
        <div className="space-y-1">
          <input
            type="text"
            list="material-options"
            value={value}
            onChange={(e) => handleChange(col, e.target.value)}
            placeholder="Ex: Acetato, Metal, Resina, Policarbonato..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
          />
          <datalist id="material-options">
            <option value="Acetato" />
            <option value="Metal" />
            <option value="Titânio" />
            <option value="Resina" />
            <option value="Policarbonato" />
            <option value="Trivex" />
            <option value="Cristal" />
          </datalist>
        </div>
      );
    }

    // Tratamento de Lente
    if (k.includes('tratamento')) {
      return (
        <div className="space-y-1">
          <input
            type="text"
            list="tratamento-options"
            value={value}
            onChange={(e) => handleChange(col, e.target.value)}
            placeholder="Ex: Anti-reflexo, Blue UV, Fotossensível..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
          />
          <datalist id="tratamento-options">
            <option value="Anti-reflexo" />
            <option value="Blue UV (Filtro Azul)" />
            <option value="Fotossensível (Transitions)" />
            <option value="Anti-risco" />
            <option value="Hidrorrepelente" />
          </datalist>
        </div>
      );
    }

    // Preços / Valores
    if (k.includes('preco') || k.includes('preço') || k.includes('valor') || k.includes('custo') || k.includes('devido')) {
      return (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-400">R$</span>
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(col, e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
            placeholder="0,00"
          />
        </div>
      );
    }

    // Estoque
    if (k === 'estoque' || k.includes('qtd')) {
      const num = parseInt(value, 10) || 0;
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleChange(col, Math.max(0, num - 1))}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center border border-slate-700 transition-all"
          >
            -
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(col, e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center text-xs text-white font-mono font-bold focus:outline-none focus:border-sky-500"
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => handleChange(col, num + 1)}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center border border-slate-700 transition-all"
          >
            +
          </button>
        </div>
      );
    }

    // Observações / Texto longo
    if (k.includes('obs') || k.includes('observacoes') || k.includes('observações') || k.includes('detalhes')) {
      return (
        <textarea
          rows={2}
          value={value}
          onChange={(e) => handleChange(col, e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all resize-none"
          placeholder="Digite observações importantes sobre este registro..."
        />
      );
    }

    // Input Padrão
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(col, e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
        placeholder="Não informado..."
      />
    );
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && rowData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto"
          >
            {/* Header com estilo elegante */}
            <div className="p-5 sm:p-7 border-b border-slate-800 bg-slate-950/70 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${entityType.color} flex items-center justify-center border ${entityType.border} shadow-lg shadow-black/40 shrink-0`}>
                  {entityType.icon}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    {mode === 'add' ? 'Novo Registro no Catálogo' : `Editar ${entityType.label}`}
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    {mode === 'add' ? 'Preencha os campos abaixo para cadastrar no ERP.' : 'Altere os dados desejados com atualização automática em tempo real.'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Formulário com Seções Visuais */}
            <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6 bg-slate-900/60 custom-scrollbar">
              
              {/* 1. SEÇÃO: IDENTIFICAÇÃO & DADOS PRINCIPAIS */}
              {groupedFields.mainCols.length > 0 && (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <Tag size={15} className="text-sky-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      1. Identificação & Informações Principais
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedFields.mainCols.map(col => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 pl-1">
                          {getFieldLabel(col)}
                        </label>
                        {renderFieldInput(col)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. SEÇÃO: PREÇOS, VALORES & ESTOQUE */}
              {groupedFields.financeCols.length > 0 && (
                <div className="bg-slate-950/70 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-2.5">
                    <DollarSign size={15} className="text-emerald-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      2. Preços, Valores Financeiros & Estoque
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedFields.financeCols.map(col => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 pl-1">
                          {getFieldLabel(col)}
                        </label>
                        {renderFieldInput(col)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. SEÇÃO: ESPECIFICAÇÕES TÉCNICAS */}
              {groupedFields.techCols.length > 0 && (
                <div className="bg-slate-950/70 border border-purple-500/20 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-purple-500/10 pb-2.5">
                    <Layers size={15} className="text-purple-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-300">
                      3. Especificações Técnicas & Detalhes do Produto
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedFields.techCols.map(col => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 pl-1">
                          {getFieldLabel(col)}
                        </label>
                        {renderFieldInput(col)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. SEÇÃO: DATAS & LOCALIZAÇÃO */}
              {groupedFields.dateLocCols.length > 0 && (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <Calendar size={15} className="text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      4. Datas, Loja & Localização
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedFields.dateLocCols.map(col => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 pl-1">
                          {getFieldLabel(col)}
                        </label>
                        {renderFieldInput(col)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. SEÇÃO: OBSERVAÇÕES & DEMAIS CAMPOS */}
              {(groupedFields.notesCols.length > 0 || groupedFields.otherCols.length > 0) && (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                    <FileText size={15} className="text-indigo-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      5. Observações & Informações Complementares
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...groupedFields.notesCols, ...groupedFields.otherCols].map(col => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 pl-1">
                          {getFieldLabel(col)}
                        </label>
                        {renderFieldInput(col)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer com Ações Claras */}
            <div className="p-5 sm:p-7 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Info size={14} className="text-sky-400" />
                <span>As alterações são sincronizadas e salvas automaticamente.</span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 transition-all shadow-lg shadow-sky-500/25 active:scale-95"
                >
                  <Save size={15} />
                  <span>{mode === 'add' ? 'Cadastrar Registro' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return null;
};

export default RowEditModal;

