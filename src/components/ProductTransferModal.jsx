import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight, X, Search, CheckCircle2, AlertTriangle,
  Package, Glasses, Eye, Truck, ArrowRight, Printer,
  Building2, Hash, FileText, UserCheck, ShieldCheck, Gift
} from 'lucide-react';

const STORES = ['Cajati', 'Registro', 'Jacupiranga', 'Central', 'Venda Externa'];

export default function ProductTransferModal({
  isOpen,
  onClose,
  data,
  currentUser,
  onTransferComplete
}) {
  const [productType, setProductType] = useState('armacoes'); // 'armacoes' | 'lentes' | 'acessorios' | 'brindes'
  const [searchQuery, setSearchQuery] = useState('');
  const [originStore, setOriginStore] = useState('Central');
  const [destStore, setDestStore] = useState('Cajati');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [transferQty, setTransferQty] = useState(1);
  const [reason, setReason] = useState('Reposição de Vitrine');
  const [notes, setNotes] = useState('');
  const [completedTransfer, setCompletedTransfer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lista de produtos filtrada pela loja de origem selecionada
  const availableProducts = useMemo(() => {
    const sheetKey = productType === 'armacoes' ? 'CAD_ARMACOES' : productType === 'brindes' ? 'CAD_BRINDES' : productType === 'acessorios' ? 'CAD_ACESSORIOS' : 'CAD_LENTES';
    const list = data?.[sheetKey] || [];
    
    return list.filter(item => {
      const itemStore = (item.UNIDADE || item.CIDADE || item.LOJA || 'Central').trim().toLowerCase();
      const origin = originStore.trim().toLowerCase();
      const matchesStore = itemStore === origin || (origin === 'central' && !item.UNIDADE);
      
      if (!matchesStore) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const marca = (item.MARCA || item.marca || '').toLowerCase();
      const modelo = (item.MODELO || item.modelo || '').toLowerCase();
      const nome = (item.NOME || item.nome || '').toLowerCase();
      const categoria = (item.CATEGORIA || item.categoria || '').toLowerCase();
      const sku = (item.REFERENCIA_SKU || item.sku || item.CODIGO || item.codigo || '').toLowerCase();
      const material = (item.MATERIAL || '').toLowerCase();
      const cor = (item.COR || '').toLowerCase();
      const tratamento = (item.TRATAMENTO || '').toLowerCase();

      return marca.includes(q) || modelo.includes(q) || nome.includes(q) || categoria.includes(q) || sku.includes(q) || material.includes(q) || cor.includes(q) || tratamento.includes(q);
    });
  }, [data, productType, originStore, searchQuery]);

  // Estoque atual do produto selecionado na origem
  const originStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return parseInt(selectedProduct.ESTOQUE || selectedProduct.estoque || 0, 10) || 0;
  }, [selectedProduct]);

  // Procura se o produto já existe na loja de destino
  const existingDestProduct = useMemo(() => {
    if (!selectedProduct) return null;
    const sheetKey = productType === 'armacoes' ? 'CAD_ARMACOES' : productType === 'brindes' ? 'CAD_BRINDES' : productType === 'acessorios' ? 'CAD_ACESSORIOS' : 'CAD_LENTES';
    const list = data?.[sheetKey] || [];
    
    return list.find(item => {
      const itemStore = (item.UNIDADE || item.CIDADE || item.LOJA || '').trim().toLowerCase();
      if (itemStore !== destStore.trim().toLowerCase()) return false;

      if (productType === 'armacoes' || productType === 'brindes' || productType === 'acessorios') {
        const sku1 = (selectedProduct.REFERENCIA_SKU || selectedProduct.sku || selectedProduct.CODIGO || '').trim().toLowerCase();
        const sku2 = (item.REFERENCIA_SKU || item.sku || item.CODIGO || '').trim().toLowerCase();
        if (sku1 && sku2 && sku1 === sku2) return true;

        const m1 = (selectedProduct.NOME || selectedProduct.MARCA || '').trim().toLowerCase();
        const m2 = (item.NOME || item.MARCA || '').trim().toLowerCase();
        const mod1 = (selectedProduct.MODELO || '').trim().toLowerCase();
        const mod2 = (item.MODELO || '').trim().toLowerCase();
        const cor1 = (selectedProduct.COR || '').trim().toLowerCase();
        const cor2 = (item.COR || '').trim().toLowerCase();
        return m1 === m2 && mod1 === mod2 && (!cor1 || cor1 === cor2);
      } else {
        const m1 = (selectedProduct.MARCA || '').trim().toLowerCase();
        const m2 = (item.MARCA || '').trim().toLowerCase();
        const mod1 = (selectedProduct.MODELO || '').trim().toLowerCase();
        const mod2 = (item.MODELO || '').trim().toLowerCase();
        const trat1 = (selectedProduct.TRATAMENTO || '').trim().toLowerCase();
        const trat2 = (item.TRATAMENTO || '').trim().toLowerCase();
        return m1 === m2 && mod1 === mod2 && trat1 === trat2;
      }
    });
  }, [data, productType, selectedProduct, destStore]);

  const destCurrentStock = useMemo(() => {
    if (!existingDestProduct) return 0;
    return parseInt(existingDestProduct.ESTOQUE || existingDestProduct.estoque || 0, 10) || 0;
  }, [existingDestProduct]);

  const handleSelectProduct = (item) => {
    setSelectedProduct(item);
    const stock = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
    setTransferQty(stock > 0 ? 1 : 0);
  };

  const handleOriginChange = (newOrigin) => {
    setOriginStore(newOrigin);
    if (newOrigin === destStore) {
      const other = STORES.find(s => s !== newOrigin) || 'Cajati';
      setDestStore(other);
    }
    setSelectedProduct(null);
    setTransferQty(1);
  };

  const handleDestChange = (newDest) => {
    setDestStore(newDest);
  };

  const handleSubmitTransfer = () => {
    if (!selectedProduct) return;
    if (transferQty <= 0) {
      alert('A quantidade a transferir deve ser de pelo menos 1 unidade.');
      return;
    }
    if (transferQty > originStock) {
      alert(`Quantidade selecionada (${transferQty}) excede o estoque disponível na origem (${originStock}).`);
      return;
    }
    if (originStore === destStore) {
      alert('A loja de origem e destino não podem ser iguais.');
      return;
    }

    setIsSubmitting(true);

    const operatorName = currentUser?.name || currentUser?.username || 'Administrador';
    const transferId = `TRF-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();
    const dateFormatted = new Date().toLocaleDateString('pt-BR');
    const timeFormatted = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const productName = productType === 'armacoes'
      ? `${selectedProduct.MARCA || ''} ${selectedProduct.MODELO || ''} ${selectedProduct.REFERENCIA_SKU ? `(SKU: ${selectedProduct.REFERENCIA_SKU})` : ''}`.trim()
      : productType === 'brindes'
      ? `${selectedProduct.NOME || selectedProduct.MODELO || 'Brinde'} ${selectedProduct.CATEGORIA ? `[${selectedProduct.CATEGORIA}]` : ''} ${selectedProduct.COR ? `(${selectedProduct.COR})` : ''}`.trim()
      : productType === 'acessorios'
      ? `${selectedProduct.NOME || selectedProduct.MODELO || 'Acessório'} ${selectedProduct.CATEGORIA ? `[${selectedProduct.CATEGORIA}]` : ''} ${selectedProduct.REFERENCIA_SKU ? `(SKU: ${selectedProduct.REFERENCIA_SKU})` : ''}`.trim()
      : `${selectedProduct.MARCA || ''} ${selectedProduct.MODELO || ''} ${selectedProduct.TRATAMENTO ? `(${selectedProduct.TRATAMENTO})` : ''}`.trim();

    const transferPayload = {
      id: transferId,
      productType,
      sheetKey: productType === 'armacoes' ? 'CAD_ARMACOES' : productType === 'brindes' ? 'CAD_BRINDES' : productType === 'acessorios' ? 'CAD_ACESSORIOS' : 'CAD_LENTES',
      productName,
      originItem: selectedProduct,
      existingDestItem: existingDestProduct,
      originStore,
      destStore,
      quantity: transferQty,
      originStockBefore: originStock,
      originStockAfter: originStock - transferQty,
      destStockBefore: destCurrentStock,
      destStockAfter: destCurrentStock + transferQty,
      reason,
      notes,
      operator: operatorName,
      date: dateFormatted,
      time: timeFormatted,
      timestamp: nowIso
    };

    onTransferComplete(transferPayload);

    setCompletedTransfer(transferPayload);
    setIsSubmitting(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetAndClose = () => {
    setCompletedTransfer(null);
    setSelectedProduct(null);
    setSearchQuery('');
    setTransferQty(1);
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg lg:max-w-4xl bg-slate-900/95 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col print:border-none print:shadow-none print:bg-white print:text-black"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-white/10 bg-slate-800/50 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                Transferência de Mercadorias entre Lojas
              </h2>
              <p className="text-xs text-slate-400 font-semibold">
                Movimentação oficial de estoque e registro de auditoria
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* TELA DE COMPROVANTE (PÓS SUCESSO) */}
        {completedTransfer ? (
          <div className="p-4 sm:p-8 space-y-6 overflow-y-auto erp-scroll flex-1">
            <div className="text-center space-y-2 print:hidden">
              <div className="inline-flex p-3 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-2xl font-black text-white">Transferência Realizada com Sucesso!</h3>
              <p className="text-sm text-slate-400">
                Os saldos de estoque foram atualizados e o romaneio de envio foi gerado.
              </p>
            </div>

            {/* VOUCHER / GUIA IMPRIMÍVEL */}
            <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-6 space-y-6 print:border-slate-300 print:bg-white print:text-black print:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 print:border-slate-300 pb-4 gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 print:text-indigo-700">Comprovante de Movimentação</span>
                  <h4 className="text-xl font-black text-white print:text-black">GUIA DE TRANSFERÊNCIA DE ESTOQUE</h4>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-bold text-sm border border-indigo-500/30 print:bg-slate-100 print:text-black">
                    {completedTransfer.id}
                  </span>
                  <p className="text-xs text-slate-400 print:text-slate-600 mt-1 font-semibold">
                    {completedTransfer.date} às {completedTransfer.time}
                  </p>
                </div>
              </div>

              {/* FLUXO ORIGEM -> DESTINO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-slate-900/60 print:bg-slate-50 p-4 rounded-xl border border-white/5 print:border-slate-200">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 print:text-rose-700">Loja de Origem (Débito)</p>
                  <p className="text-lg font-black text-white print:text-black">{completedTransfer.originStore}</p>
                  <p className="text-xs text-slate-400 print:text-slate-600">Saldo restante: <strong className="text-slate-200 print:text-black">{completedTransfer.originStockAfter} un</strong></p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2 text-indigo-400 print:text-indigo-700 font-black text-sm">
                    <Truck size={20} />
                    <span>{completedTransfer.quantity} unidade(s)</span>
                  </div>
                  <ArrowRight size={18} className="text-slate-500 hidden sm:block mt-1" />
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 print:text-emerald-700">Loja de Destino (Crédito)</p>
                  <p className="text-lg font-black text-white print:text-black">{completedTransfer.destStore}</p>
                  <p className="text-xs text-slate-400 print:text-slate-600">Novo saldo: <strong className="text-slate-200 print:text-black">{completedTransfer.destStockAfter} un</strong></p>
                </div>
              </div>

              {/* DETALHES DO PRODUTO */}
              <div className="space-y-3">
                <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 print:text-slate-600">Item Transferido</h5>
                <div className="p-4 rounded-xl bg-white/5 print:bg-slate-100 border border-white/10 print:border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 print:text-indigo-700 uppercase">
                      {completedTransfer.productType === 'armacoes' ? 'Armação' : completedTransfer.productType === 'brindes' ? 'Brinde' : completedTransfer.productType === 'acessorios' ? 'Acessório' : 'Lente'}
                    </span>
                    <p className="text-base font-black text-white print:text-black">{completedTransfer.productName}</p>
                    {completedTransfer.reason && (
                      <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                        Motivo: <strong className="text-slate-300 print:text-black">{completedTransfer.reason}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-300 print:text-black">{completedTransfer.quantity}</span>
                    <p className="text-[10px] uppercase font-bold text-slate-400">UNIDADE(S)</p>
                  </div>
                </div>
              </div>

              {completedTransfer.notes && (
                <div className="text-xs text-slate-300 print:text-black bg-white/5 print:bg-slate-50 p-3 rounded-xl border border-white/5 print:border-slate-200">
                  <strong className="text-slate-400 uppercase font-black tracking-widest">Observações: </strong>
                  {completedTransfer.notes}
                </div>
              )}

              {/* ASSINATURAS PARA IMPRESSÃO */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-dashed border-white/20 print:border-slate-400">
                <div className="text-center space-y-2">
                  <div className="border-b border-white/30 print:border-black h-8"></div>
                  <p className="text-xs font-bold text-slate-300 print:text-black">Responsável Origem ({completedTransfer.originStore})</p>
                  <p className="text-[10px] text-slate-500 font-mono">Operador: {completedTransfer.operator}</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="border-b border-white/30 print:border-black h-8"></div>
                  <p className="text-xs font-bold text-slate-300 print:text-black">Recebido por ({completedTransfer.destStore})</p>
                  <p className="text-[10px] text-slate-500 font-mono">Assinatura / Carimbo</p>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10 print:hidden">
              <button
                onClick={handlePrint}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2 border border-white/10 transition-all text-sm"
              >
                <Printer size={16} /> Imprimir Comprovante
              </button>
              <button
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white font-black shadow-lg shadow-indigo-500/25 transition-all text-sm"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO DE SELEÇÃO E TRANSFERÊNCIA */
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto erp-scroll flex-1">
            {/* ETAPA 1: TIPO DE PRODUTO & LOJAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* TIPO */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tipo de Produto</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setProductType('armacoes'); setSelectedProduct(null); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
                      productType === 'armacoes'
                        ? 'bg-fuchsia-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Glasses size={15} /> Armações
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProductType('lentes'); setSelectedProduct(null); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
                      productType === 'lentes'
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye size={15} /> Lentes
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProductType('acessorios'); setSelectedProduct(null); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
                      productType === 'acessorios'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Package size={15} /> Acessórios
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProductType('brindes'); setSelectedProduct(null); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
                      productType === 'brindes'
                        ? 'bg-pink-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Gift size={15} /> Brindes
                  </button>
                </div>
              </div>

              {/* LOJA ORIGEM */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1">
                  <Building2 size={13} /> Loja de Origem (Sai de)
                </label>
                <select
                  value={originStore}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-rose-500/50"
                >
                  {STORES.map(s => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>

              {/* LOJA DESTINO */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                  <Building2 size={13} /> Loja de Destino (Entra em)
                </label>
                <select
                  value={destStore}
                  onChange={(e) => handleDestChange(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-emerald-500/50"
                >
                  {STORES.filter(s => s !== originStore).map(s => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ETAPA 2: BUSCA E SELEÇÃO DE PRODUTO NA ORIGEM */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Package size={14} className="text-indigo-400" />
                  Selecione o Produto em Estoque na unidade <span className="text-rose-300">"{originStore}"</span>
                </label>
                <span className="text-xs text-slate-500 font-semibold">{availableProducts.length} itens encontrados</span>
              </div>

              {/* BARRA DE PESQUISA */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por Marca, Modelo, Código SKU, Tratamento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* LISTA DE PRODUTOS DISPONÍVEIS */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {availableProducts.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs font-semibold bg-white/5 rounded-xl border border-dashed border-white/10">
                    Nenhum produto com saldo encontrado em "{originStore}". Altere a loja de origem ou cadastre o item.
                  </div>
                ) : (
                  availableProducts.map((item, idx) => {
                    const stock = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
                    const isSelected = selectedProduct && (
                      (selectedProduct.id && selectedProduct.id === item.id) ||
                      (selectedProduct.REFERENCIA_SKU && selectedProduct.REFERENCIA_SKU === item.REFERENCIA_SKU) ||
                      (selectedProduct.MARCA === item.MARCA && selectedProduct.MODELO === item.MODELO && selectedProduct.COR === item.COR)
                    );

                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => handleSelectProduct(item)}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                            : 'bg-black/30 border-white/5 hover:bg-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.IMAGEM ? (
                            <img src={item.IMAGEM} alt="Produto" className="w-9 h-9 object-cover rounded-lg border border-white/10 shrink-0" />
                          ) : (
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              productType === 'armacoes' ? 'bg-fuchsia-500/20 text-fuchsia-400' : productType === 'brindes' ? 'bg-pink-500/20 text-pink-400' : 'bg-sky-500/20 text-sky-400'
                            }`}>
                              {productType === 'armacoes' ? <Glasses size={18} /> : productType === 'brindes' ? <Gift size={18} /> : <Eye size={18} />}
                            </div>
                          )}
                          <div className="truncate">
                            <p className="text-sm font-black text-white truncate">
                              {productType === 'brindes' ? (item.NOME || item.MODELO || 'Brinde') : `${item.MARCA || 'Sem Marca'} ${item.MODELO || ''}`}
                            </p>
                            <p className="text-[11px] text-slate-400 font-semibold truncate">
                              {productType === 'armacoes'
                                ? `SKU: ${item.REFERENCIA_SKU || 'N/A'} · Cor: ${item.COR || 'Padrão'} · Mat: ${item.MATERIAL || 'N/A'}`
                                : productType === 'brindes'
                                ? `Cat: ${item.CATEGORIA || 'Geral'} · SKU: ${item.REFERENCIA_SKU || 'N/A'} · Cor: ${item.COR || 'Padrão'}`
                                : `Tratamento: ${item.TRATAMENTO || 'N/A'} · Mat: ${item.MATERIAL || 'N/A'}`
                              }
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            stock > 5 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            stock > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {stock} un
                          </span>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                            isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-white/20'
                          }`}>
                            {isSelected && <CheckCircle2 size={14} />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ETAPA 3: QUANTIDADE, MOTIVO E PREVIEW */}
            {selectedProduct && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-950/60 border border-indigo-500/30 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                    Parâmetros da Transferência
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    Origem: <strong className="text-rose-400">{originStore}</strong> ➔ Destino: <strong className="text-emerald-400">{destStore}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* QUANTIDADE */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Quantidade a Transferir *
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-lg flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={originStock}
                        value={transferQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setTransferQty(Math.min(originStock, Math.max(1, val)));
                        }}
                        className="w-full text-center bg-black/40 border border-white/10 rounded-xl py-2 font-black text-lg text-white focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => setTransferQty(Math.min(originStock, transferQty + 1))}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-lg flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center font-bold">
                      Máximo disponível: {originStock} un
                    </p>
                  </div>

                  {/* MOTIVO */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Motivo da Transferência
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option className="bg-slate-900" value="Reposição de Vitrine">Reposição de Vitrine / Mostruário</option>
                      <option className="bg-slate-900" value="Atendimento de Pedido de Cliente">Atendimento de Pedido de Cliente</option>
                      <option className="bg-slate-900" value="Equilíbrio de Estoque">Equilíbrio / Remanejamento de Estoque</option>
                      <option className="bg-slate-900" value="Empréstimo Temporário">Empréstimo Temporário</option>
                      <option className="bg-slate-900" value="Envio de Lote Matriz">Envio de Lote Matriz / Central</option>
                      <option className="bg-slate-900" value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                {/* NOTAS */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Notas / Observações Adicionais (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Solicitado pela vendedora Carla para entrega na sexta-feira"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* SIMULAÇÃO DE IMPACTO DE SALDOS */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Origem: {originStore}</span>
                      <p className="font-bold text-slate-300">Saldo Atual: {originStock} un</p>
                    </div>
                    <span className="text-sm font-black text-rose-300">➔ {originStock - transferQty} un</span>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Destino: {destStore}</span>
                      <p className="font-bold text-slate-300">Saldo Atual: {destCurrentStock} un</p>
                    </div>
                    <span className="text-sm font-black text-emerald-300">➔ {destCurrentStock + transferQty} un</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* BOTÕES DO FORMULÁRIO */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedProduct || originStock <= 0 || transferQty <= 0 || isSubmitting}
                onClick={handleSubmitTransfer}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                  !selectedProduct || originStock <= 0 || transferQty <= 0 || isSubmitting
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 shadow-indigo-500/25'
                }`}
              >
                <ArrowLeftRight size={16} />
                {isSubmitting ? 'Transferindo...' : 'Executar Transferência de Estoque'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
