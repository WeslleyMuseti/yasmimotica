import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Glasses, DollarSign, CreditCard, PlusCircle, ArrowLeft,
  CheckCircle, AlertTriangle, Package, Calendar, Tag, Layers,
  TrendingUp, TrendingDown, Clock, Search, Download, Trash2, Edit2,
  History, Wallet, ArrowLeftRight, Truck, Ticket, Percent, Gift,
  Sparkles, CheckCircle2, AlertCircle, Copy, Check, Plus, X,
  Filter, PieChart as PieChartIcon, ChevronDown, Building2, MapPin, Store
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DataTable from './DataTable';
import ClientInstallmentsModal from './ClientInstallmentsModal';
import { CashHistoryContent } from './CashHistoryModal';
import ProductTransferModal from './ProductTransferModal';
import { PrintableLabelModal } from './PrintableLabel';
import StockFilterModal from './StockFilterModal';
import StockPieChart from './StockPieChart';
import { filterAndSortStock } from '../stockFilters';
import { isSameClient, transferStockAtomically, decrementStockAtomically } from '../firebaseSync';

const parseCurrency = (val) => {
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

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const compressImage = (file, callback) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400; // Resolução leve e boa o suficiente
      const MAX_HEIGHT = 400;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      // Salvar como WebP com qualidade 70%
      const dataUrl = canvas.toDataURL('image/webp', 0.7);
      callback(dataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

const getSavedCustomList = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`Erro ao carregar lista de ${key}:`, err);
  }
  return fallback;
};

const saveCustomList = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    console.warn(`Erro ao salvar lista em ${key}:`, err);
  }
};

const ErpOptica = ({
  data,
  clientsData = [],
  currentUser = null,
  onAddRow,
  onAddBatch,
  onUpdateRow,
  onDeleteRow,
  onClearFinancialAndOS,
  onBack,
  initialTab = 'lentes'
}) => {
  const defaultFormCity = currentUser?.city || currentUser?.assignedStore || 'Central';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isAdding, setIsAdding] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [clientInstallmentsInfo, setClientInstallmentsInfo] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [filterCriticalStock, setFilterCriticalStock] = useState(false);
  const [isStockFilterModalOpen, setIsStockFilterModalOpen] = useState(false);
  const [appliedStockFilters, setAppliedStockFilters] = useState({ armacoes: null, lentes: null, brindes: null });
  const appliedStockFilter = (activeTab === 'armacoes' || activeTab === 'lentes' || activeTab === 'brindes') ? (appliedStockFilters[activeTab] || null) : null;
  const [showStockChartHeader, setShowStockChartHeader] = useState(true);
  const [selectedStockCity, setSelectedStockCity] = useState('ALL');
  const [labelModalItem, setLabelModalItem] = useState(null);

  const salesData = useMemo(() => {
    const s1 = data?.['Registro_Vendas'] || [];
    const s2 = data?.['BD MARKETING'] || [];
    if (s1.length > 0 && s2.length > 0) return [...s1, ...s2];
    return s1.length > 0 ? s1 : s2;
  }, [data]);

  // Materiais e Tratamentos Personalizados Salvos (com persistência no navegador)
  const [customLenteMateriais, setCustomLenteMateriais] = useState(() =>
    getSavedCustomList('yasmin_custom_lentes_materiais', [])
  );
  const [customLenteTratamentos, setCustomLenteTratamentos] = useState(() =>
    getSavedCustomList('yasmin_custom_lentes_tratamentos', [])
  );
  const [customArmacaoMateriais, setCustomArmacaoMateriais] = useState(() =>
    getSavedCustomList('yasmin_custom_armacoes_materiais', [])
  );

  // Itens Ocultados/Removidos pelo Usuário (com persistência no navegador)
  const [hiddenLenteMateriais, setHiddenLenteMateriais] = useState(() =>
    getSavedCustomList('yasmin_hidden_lentes_materiais', [])
  );
  const [hiddenLenteTratamentos, setHiddenLenteTratamentos] = useState(() =>
    getSavedCustomList('yasmin_hidden_lentes_tratamentos', [])
  );
  const [hiddenArmacaoMateriais, setHiddenArmacaoMateriais] = useState(() =>
    getSavedCustomList('yasmin_hidden_armacoes_materiais', [])
  );

  // Estados de controle para adição inline rápida
  const [isAddingLenteMaterial, setIsAddingLenteMaterial] = useState(false);
  const [newLenteMaterialInput, setNewLenteMaterialInput] = useState('');

  const [isAddingLenteTratamento, setIsAddingLenteTratamento] = useState(false);
  const [newLenteTratamentoInput, setNewLenteTratamentoInput] = useState('');

  const [isAddingArmacaoMaterial, setIsAddingArmacaoMaterial] = useState(false);
  const [newArmacaoMaterialInput, setNewArmacaoMaterialInput] = useState('');

  const [lentesForm, setLentesForm] = useState({
    UNIDADE: defaultFormCity || 'Central', MARCA: '', MODELO: '', MATERIAL: 'Resina', INDICE_REFRACAO: '1.56',
    TRATAMENTO: 'Anti-reflexo Premium',
    ESFERICO: '', CILINDRICO: '', DIAMETRO: '', EIXO: '', ADICAO: '',
    ESFERICO_MIN: '-6.00', ESFERICO_MAX: '+6.00',
    CILINDRICO_MIN: '-4.00', CILINDRICO_MAX: '0.00',
    PRECO_COMPRA: '', PRECO_VENDA: '', ESTOQUE: '10'
  });

  const [armacoesForm, setArmacoesForm] = useState({
    UNIDADE: defaultFormCity || 'Central', MARCA: '', MODELO: '', REFERENCIA_SKU: '', COR: 'Preto',
    MATERIAL: 'Acetato', TAMANHO: '55-18-140',
    PRECO_COMPRA: '', PRECO_VENDA: '', ESTOQUE: '5', IMAGEM: '', OBSERVACOES: ''
  });

  const [brindesForm, setBrindesForm] = useState({
    UNIDADE: defaultFormCity || 'Central', NOME: '', CATEGORIA: 'Estojo Rígido', REFERENCIA_SKU: '', COR: 'Sortido',
    PRECO_COMPRA: '', PRECO_VENDA: '0,00', ESTOQUE: '20', IMAGEM: '', OBSERVACOES: ''
  });

  const [pagarForm, setPagarForm] = useState({
    DESCRICAO: '', CATEGORIA: 'Fornecedores', VALOR: '',
    DATA_VENCIMENTO: new Date().toISOString().split('T')[0],
    DATA_PAGAMENTO: '', STATUS: 'Pendente', FORNECEDOR: '', OBSERVACOES: ''
  });

  const [receberForm, setReceberForm] = useState({
    DESCRICAO: '', CLIENTE: '', VENDA_OS: '', VALOR: '',
    DATA_VENCIMENTO: new Date().toISOString().split('T')[0],
    DATA_RECEBIMENTO: '', STATUS: 'Pendente', MEIO_PAGAMENTO: 'Cartão de Crédito', OBSERVACOES: ''
  });

  const [voucherForm, setVoucherForm] = useState({
    CODIGO: '',
    NOME: '',
    TIPO_DESCONTO: 'VALOR', // 'VALOR' ou 'PORCENTAGEM'
    VALOR_DESCONTO: '',
    QUANTIDADE_TOTAL: '10',
    UNIDADE: 'Todas',
    VALIDADE: '',
    STATUS: 'Ativo',
    OBSERVACOES: ''
  });

  const [voucherUsageModalItem, setVoucherUsageModalItem] = useState(null);
  const handleViewVoucherUsage = (voucherRow) => {
    setVoucherUsageModalItem(voucherRow);
  };

  // Dados das abas (seguro contra nulos - estoque de todas as lojas visível para vendedores e administradores)
  const lentesData = useMemo(() => data?.['CAD_LENTES'] || [], [data]);
  const armacoesData = useMemo(() => data?.['CAD_ARMACOES'] || [], [data]);
  const brindesData = useMemo(() => data?.['CAD_BRINDES'] || [], [data]);
  const pagarData = useMemo(() => data?.['CONTAS_PAGAR'] || [], [data]);
  const receberData = useMemo(() => data?.['CONTAS_RECEBER'] || [], [data]);
  const transferenciasData = useMemo(() => data?.['TRANSFERENCIAS_ESTOQUE'] || [], [data]);
  const vouchersData = useMemo(() => data?.['VOUCHERS'] || [], [data]);

  // Estatísticas Rápidas
  const vouchersStats = useMemo(() => {
    let ativos = 0;
    let esgotados = 0;
    let totalUsos = 0;
    vouchersData.forEach(item => {
      const st = (item.STATUS || item.status || 'Ativo').trim();
      const total = parseInt(item.QUANTIDADE_TOTAL || item.quantidade_total || 0, 10);
      const usada = parseInt(item.QUANTIDADE_USADA || item.quantidade_usada || 0, 10);
      totalUsos += usada;
      if (st === 'Ativo' && (total === 0 || usada < total)) {
        ativos++;
      } else {
        esgotados++;
      }
    });
    return { total: vouchersData.length, ativos, esgotados, totalUsos };
  }, [vouchersData]);

  // Estatísticas Rápidas (isoladas por cidade selecionada se aplicável)
  const lentesStats = useMemo(() => {
    let totalPares = 0;
    let valorEstoque = 0;
    let criticos = 0;
    const list = (selectedStockCity && selectedStockCity !== 'ALL')
      ? lentesData.filter(item => {
          const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim().toLowerCase();
          return u === selectedStockCity.toLowerCase() || u.includes(selectedStockCity.toLowerCase());
        })
      : lentesData;
    list.forEach(item => {
      const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
      const preco = parseCurrency(item.PRECO_COMPRA || item.preco_compra || 0);
      totalPares += qtd;
      valorEstoque += qtd * preco;
      if (qtd <= 2) criticos++;
    });
    return { total: list.length, totalPares, valorEstoque, criticos };
  }, [lentesData, selectedStockCity]);

  const armacoesStats = useMemo(() => {
    let totalPecs = 0;
    let valorEstoque = 0;
    let criticos = 0;
    const list = (selectedStockCity && selectedStockCity !== 'ALL')
      ? armacoesData.filter(item => {
          const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim().toLowerCase();
          return u === selectedStockCity.toLowerCase() || u.includes(selectedStockCity.toLowerCase());
        })
      : armacoesData;
    list.forEach(item => {
      const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
      const preco = parseCurrency(item.PRECO_COMPRA || item.preco_compra || 0);
      totalPecs += qtd;
      valorEstoque += qtd * preco;
      if (qtd <= 2) criticos++;
    });
    return { total: list.length, totalPecs, valorEstoque, criticos };
  }, [armacoesData, selectedStockCity]);

  const brindesStats = useMemo(() => {
    let totalPecs = 0;
    let valorEstoque = 0;
    let criticos = 0;
    const list = (selectedStockCity && selectedStockCity !== 'ALL')
      ? brindesData.filter(item => {
          const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim().toLowerCase();
          return u === selectedStockCity.toLowerCase() || u.includes(selectedStockCity.toLowerCase());
        })
      : brindesData;
    list.forEach(item => {
      const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
      const preco = parseCurrency(item.PRECO_COMPRA || item.preco_compra || 0);
      totalPecs += qtd;
      valorEstoque += qtd * preco;
      if (qtd <= 5) criticos++;
    });
    return { total: list.length, totalPecs, valorEstoque, criticos };
  }, [brindesData, selectedStockCity]);

  // Distribuição completa do estoque por cidade/filial para a aba ativa
  const stockDistributionByCity = useMemo(() => {
    let source = [];
    if (activeTab === 'lentes') source = lentesData;
    else if (activeTab === 'armacoes') source = armacoesData;
    else if (activeTab === 'brindes') source = brindesData;
    else return null;

    const stores = ['Central', 'Cajati', 'Registro', 'Jacupiranga', 'Venda Externa'];
    const map = {};
    stores.forEach(s => {
      map[s] = { items: 0, units: 0 };
    });

    let totalItems = 0;
    let totalUnits = 0;

    source.forEach(item => {
      const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim();
      const matchedStore = stores.find(s => s.toLowerCase() === u.toLowerCase()) || (u || 'Central');
      if (!map[matchedStore]) {
        map[matchedStore] = { items: 0, units: 0 };
      }
      const q = parseInt(item.ESTOQUE || item.estoque || 0, 10) || 0;
      map[matchedStore].items++;
      map[matchedStore].units += q;
      totalItems++;
      totalUnits += q;
    });

    return {
      stores: map,
      totalItems,
      totalUnits
    };
  }, [activeTab, lentesData, armacoesData, brindesData]);

  const pagarStats = useMemo(() => {
    let pendente = 0;
    let pago = 0;
    pagarData.forEach(item => {
      const val = parseCurrency(item.VALOR || item.valor);
      const st = (item.STATUS || item.status || 'Pendente').trim();
      if (st === 'Pago') pago += val;
      else pendente += val;
    });
    return { pendente, pago, total: pagarData.length };
  }, [pagarData]);

  const receberStats = useMemo(() => {
    let pendente = 0;
    let recebido = 0;
    receberData.forEach(item => {
      const val = parseCurrency(item.VALOR || item.valor);
      const st = (item.STATUS || item.status || 'Pendente').trim();
      if (st === 'Recebido' || st === 'Pago') recebido += val;
      else pendente += val;
    });
    return { pendente, recebido, total: receberData.length };
  }, [receberData]);

  const transferStats = useMemo(() => {
    let totalItems = 0;
    transferenciasData.forEach(item => {
      totalItems += parseInt(item.QUANTIDADE || item.quantidade || 0, 10) || 0;
    });
    return { totalMoves: transferenciasData.length, totalItems };
  }, [transferenciasData]);

  const handleTransferComplete = async (payload) => {
    const sheetKey = payload.sheetKey;

    // 0. Transferência atômica no banco de dados Firestore
    if (payload.originItem?.id) {
      try {
        await transferStockAtomically(
          sheetKey,
          payload.originItem.id,
          payload.existingDestItem?.id,
          payload.quantity
        );
      } catch (stockErr) {
        console.warn('Aviso na transferência atômica de estoque no Firestore:', stockErr);
      }
    }

    // 1. Atualiza estoque na loja de origem (débito)
    if (onUpdateRow && payload.originItem) {
      onUpdateRow(sheetKey, payload.originItem, {
        ...payload.originItem,
        ESTOQUE: String(payload.originStockAfter)
      });
    }

    // 2. Atualiza ou cria estoque na loja de destino (crédito)
    if (payload.existingDestItem && onUpdateRow) {
      onUpdateRow(sheetKey, payload.existingDestItem, {
        ...payload.existingDestItem,
        ESTOQUE: String(payload.destStockAfter)
      });
    } else if (onAddRow) {
      const newItem = {
        ...payload.originItem,
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        UNIDADE: payload.destStore,
        CIDADE: payload.destStore,
        LOJA: payload.destStore,
        ESTOQUE: String(payload.quantity),
        DATA_CADASTRO: payload.date
      };
      onAddRow(sheetKey, newItem);
    }

    // 3. Registra auditoria na tabela TRANSFERENCIAS_ESTOQUE
    if (onAddRow) {
      const auditRecord = {
        ID: payload.id,
        id: payload.id,
        DATA: payload.date,
        HORA: payload.time,
        DATA_HORA: payload.timestamp,
        TIPO: payload.productType === 'armacoes' ? 'Armação' : payload.productType === 'brindes' ? 'Brinde' : 'Lente',
        PRODUTO: payload.productName,
        ORIGEM: payload.originStore,
        DESTINO: payload.destStore,
        QUANTIDADE: payload.quantity,
        SALDO_ORIGEM_RESTANTE: payload.originStockAfter,
        SALDO_DESTINO_FINAL: payload.destStockAfter,
        MOTIVO: payload.reason,
        OBSERVACOES: payload.notes || '',
        OPERADOR: payload.operator,
        STATUS: 'Concluído'
      };
      onAddRow('TRANSFERENCIAS_ESTOQUE', auditRecord);
    }

    setSuccessMsg(`Transferência de ${payload.quantity}x "${payload.productName}" de ${payload.originStore} para ${payload.destStore} realizada com sucesso!`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // ─── OPÇÕES DINÂMICAS DE MATERIAIS E TRATAMENTOS (PADRÕES + BANCO + SALVOS PELO USUÁRIO) ───
  const lenteMaterialOptions = useMemo(() => {
    const base = [
      { value: 'Resina', label: 'Resina (CR-39)' },
      { value: 'Policarbonato', label: 'Policarbonato (Poli)' },
      { value: 'Trivex', label: 'Trivex' },
      { value: 'Alto Índice 1.67', label: 'Alto Índice 1.67' },
      { value: 'Alto Índice 1.74', label: 'Alto Índice 1.74' },
      { value: 'Cristal', label: 'Cristal / Mineral' }
    ];
    const baseVals = new Set(base.map(b => b.value.toLowerCase()));

    const fromDb = (data?.['CAD_LENTES'] || [])
      .map(i => (i.MATERIAL || i.material || '').trim())
      .filter(Boolean);

    const merged = [...new Set([...customLenteMateriais, ...fromDb])];
    const extras = merged
      .filter(m => !baseVals.has(m.toLowerCase()))
      .map(m => ({ value: m, label: m, isCustom: true }));

    return [...base, ...extras].filter(item =>
      !hiddenLenteMateriais.some(h => h.toLowerCase() === item.value.toLowerCase())
    );
  }, [data, customLenteMateriais, hiddenLenteMateriais]);

  const lenteTratamentoOptions = useMemo(() => {
    const base = [
      { value: 'Anti-reflexo Premium', label: 'Anti-reflexo Premium' },
      { value: 'Filtro Luz Azul (Blue Cut)', label: 'Filtro Luz Azul (Blue Cut)' },
      { value: 'Fotossensível (Transitions)', label: 'Fotossensível (Transitions)' },
      { value: 'Anti-risco', label: 'Anti-risco' },
      { value: 'Incolor Comum', label: 'Incolor Comum' }
    ];
    const baseVals = new Set(base.map(b => b.value.toLowerCase()));

    const fromDb = (data?.['CAD_LENTES'] || [])
      .map(i => (i.TRATAMENTO || i.tratamento || '').trim())
      .filter(Boolean);

    const merged = [...new Set([...customLenteTratamentos, ...fromDb])];
    const extras = merged
      .filter(t => !baseVals.has(t.toLowerCase()))
      .map(t => ({ value: t, label: t, isCustom: true }));

    return [...base, ...extras].filter(item =>
      !hiddenLenteTratamentos.some(h => h.toLowerCase() === item.value.toLowerCase())
    );
  }, [data, customLenteTratamentos, hiddenLenteTratamentos]);

  const armacaoMaterialOptions = useMemo(() => {
    const base = [
      { value: 'Acetato', label: 'Acetato Premium' },
      { value: 'Metal', label: 'Metal / Aço Inox' },
      { value: 'Titânio', label: 'Titânio Ultra-leve' },
      { value: 'TR90', label: 'TR90 / Grilamid' },
      { value: 'Madeira', label: 'Madeira / Bambu' },
      { value: 'Misto', label: 'Misto (Acetato + Metal)' }
    ];
    const baseVals = new Set(base.map(b => b.value.toLowerCase()));

    const fromDb = (data?.['CAD_ARMACOES'] || [])
      .map(i => (i.MATERIAL || i.material || '').trim())
      .filter(Boolean);

    const merged = [...new Set([...customArmacaoMateriais, ...fromDb])];
    const extras = merged
      .filter(m => !baseVals.has(m.toLowerCase()))
      .map(m => ({ value: m, label: m, isCustom: true }));

    return [...base, ...extras].filter(item =>
      !hiddenArmacaoMateriais.some(h => h.toLowerCase() === item.value.toLowerCase())
    );
  }, [data, customArmacaoMateriais, hiddenArmacaoMateriais]);

  // Ações de Adicionar/Remover para persistência imediata
  const handleAddLenteMaterial = (val) => {
    const clean = (val || newLenteMaterialInput).trim();
    if (!clean) return;
    const updatedHidden = hiddenLenteMateriais.filter(h => h.toLowerCase() !== clean.toLowerCase());
    setHiddenLenteMateriais(updatedHidden);
    saveCustomList('yasmin_hidden_lentes_materiais', updatedHidden);

    if (!customLenteMateriais.some(m => m.toLowerCase() === clean.toLowerCase())) {
      const updated = [...customLenteMateriais, clean];
      setCustomLenteMateriais(updated);
      saveCustomList('yasmin_custom_lentes_materiais', updated);
    }
    setLentesForm(prev => ({ ...prev, MATERIAL: clean }));
    setNewLenteMaterialInput('');
    setIsAddingLenteMaterial(false);
  };

  const handleRemoveLenteMaterial = (val) => {
    if (!val) return;
    const clean = val.trim();
    const updatedCustom = customLenteMateriais.filter(m => m.toLowerCase() !== clean.toLowerCase());
    setCustomLenteMateriais(updatedCustom);
    saveCustomList('yasmin_custom_lentes_materiais', updatedCustom);

    if (!hiddenLenteMateriais.some(h => h.toLowerCase() === clean.toLowerCase())) {
      const updatedHidden = [...hiddenLenteMateriais, clean];
      setHiddenLenteMateriais(updatedHidden);
      saveCustomList('yasmin_hidden_lentes_materiais', updatedHidden);
    }

    const remaining = lenteMaterialOptions.filter(m => m.value.toLowerCase() !== clean.toLowerCase());
    const nextVal = remaining.length > 0 ? remaining[0].value : 'Resina';
    setLentesForm(prev => ({ ...prev, MATERIAL: nextVal }));
  };

  const handleRestoreBaseLenteMateriais = () => {
    setHiddenLenteMateriais([]);
    saveCustomList('yasmin_hidden_lentes_materiais', []);
  };

  const handleAddLenteTratamento = (val) => {
    const clean = (val || newLenteTratamentoInput).trim();
    if (!clean) return;
    const updatedHidden = hiddenLenteTratamentos.filter(h => h.toLowerCase() !== clean.toLowerCase());
    setHiddenLenteTratamentos(updatedHidden);
    saveCustomList('yasmin_hidden_lentes_tratamentos', updatedHidden);

    if (!customLenteTratamentos.some(t => t.toLowerCase() === clean.toLowerCase())) {
      const updated = [...customLenteTratamentos, clean];
      setCustomLenteTratamentos(updated);
      saveCustomList('yasmin_custom_lentes_tratamentos', updated);
    }
    setLentesForm(prev => ({ ...prev, TRATAMENTO: clean }));
    setNewLenteTratamentoInput('');
    setIsAddingLenteTratamento(false);
  };

  const handleRemoveLenteTratamento = (val) => {
    if (!val) return;
    const clean = val.trim();
    const updatedCustom = customLenteTratamentos.filter(t => t.toLowerCase() !== clean.toLowerCase());
    setCustomLenteTratamentos(updatedCustom);
    saveCustomList('yasmin_custom_lentes_tratamentos', updatedCustom);

    if (!hiddenLenteTratamentos.some(h => h.toLowerCase() === clean.toLowerCase())) {
      const updatedHidden = [...hiddenLenteTratamentos, clean];
      setHiddenLenteTratamentos(updatedHidden);
      saveCustomList('yasmin_hidden_lentes_tratamentos', updatedHidden);
    }

    const remaining = lenteTratamentoOptions.filter(t => t.value.toLowerCase() !== clean.toLowerCase());
    const nextVal = remaining.length > 0 ? remaining[0].value : 'Anti-reflexo Premium';
    setLentesForm(prev => ({ ...prev, TRATAMENTO: nextVal }));
  };

  const handleRestoreBaseLenteTratamentos = () => {
    setHiddenLenteTratamentos([]);
    saveCustomList('yasmin_hidden_lentes_tratamentos', []);
  };

  const handleAddArmacaoMaterial = (val) => {
    const clean = (val || newArmacaoMaterialInput).trim();
    if (!clean) return;
    const updatedHidden = hiddenArmacaoMateriais.filter(h => h.toLowerCase() !== clean.toLowerCase());
    setHiddenArmacaoMateriais(updatedHidden);
    saveCustomList('yasmin_hidden_armacoes_materiais', updatedHidden);

    if (!customArmacaoMateriais.some(m => m.toLowerCase() === clean.toLowerCase())) {
      const updated = [...customArmacaoMateriais, clean];
      setCustomArmacaoMateriais(updated);
      saveCustomList('yasmin_custom_armacoes_materiais', updated);
    }
    setArmacoesForm(prev => ({ ...prev, MATERIAL: clean }));
    setNewArmacaoMaterialInput('');
    setIsAddingArmacaoMaterial(false);
  };

  const handleRemoveArmacaoMaterial = (val) => {
    if (!val) return;
    const clean = val.trim();
    const updatedCustom = customArmacaoMateriais.filter(m => m.toLowerCase() !== clean.toLowerCase());
    setCustomArmacaoMateriais(updatedCustom);
    saveCustomList('yasmin_custom_armacoes_materiais', updatedCustom);

    if (!hiddenArmacaoMateriais.some(h => h.toLowerCase() === clean.toLowerCase())) {
      const updatedHidden = [...hiddenArmacaoMateriais, clean];
      setHiddenArmacaoMateriais(updatedHidden);
      saveCustomList('yasmin_hidden_armacoes_materiais', updatedHidden);
    }

    const remaining = armacaoMaterialOptions.filter(m => m.value.toLowerCase() !== clean.toLowerCase());
    const nextVal = remaining.length > 0 ? remaining[0].value : 'Acetato';
    setArmacoesForm(prev => ({ ...prev, MATERIAL: nextVal }));
  };

  const handleRestoreBaseArmacaoMateriais = () => {
    setHiddenArmacaoMateriais([]);
    saveCustomList('yasmin_hidden_armacoes_materiais', []);
  };

  const handleCreateRecord = (e) => {
    e.preventDefault();
    if (activeTab === 'lentes') {
      onAddRow('CAD_LENTES', {
        ...lentesForm,
        PRECO_COMPRA: parseCurrency(lentesForm.PRECO_COMPRA).toFixed(2).replace('.', ','),
        PRECO_VENDA: parseCurrency(lentesForm.PRECO_VENDA).toFixed(2).replace('.', ','),
        ESTOQUE: parseInt(lentesForm.ESTOQUE, 10) || 0,
        DATA_CADASTRO: new Date().toLocaleDateString('pt-BR')
      });
      setLentesForm({
        UNIDADE: defaultFormCity || 'Central', MARCA: '', MODELO: '', MATERIAL: 'Resina', INDICE_REFRACAO: '1.56',
        TRATAMENTO: 'Anti-reflexo Premium',
        ESFERICO: '', CILINDRICO: '', DIAMETRO: '', EIXO: '', ADICAO: '',
        ESFERICO_MIN: '-6.00', ESFERICO_MAX: '+6.00',
        CILINDRICO_MIN: '-4.00', CILINDRICO_MAX: '0.00',
        PRECO_COMPRA: '', PRECO_VENDA: '', ESTOQUE: '10'
      });
      setSuccessMsg('Lente cadastrada com sucesso no estoque!');
    } else if (activeTab === 'armacoes') {
      onAddRow('CAD_ARMACOES', {
        ...armacoesForm,
        PRECO_COMPRA: parseCurrency(armacoesForm.PRECO_COMPRA).toFixed(2).replace('.', ','),
        PRECO_VENDA: parseCurrency(armacoesForm.PRECO_VENDA).toFixed(2).replace('.', ','),
        ESTOQUE: parseInt(armacoesForm.ESTOQUE, 10) || 0,
        DATA_CADASTRO: new Date().toLocaleDateString('pt-BR')
      });
      setArmacoesForm({
        UNIDADE: defaultFormCity || 'Central', MARCA: '', MODELO: '', REFERENCIA_SKU: '', COR: 'Preto',
        MATERIAL: 'Acetato', TAMANHO: '55-18-140',
        PRECO_COMPRA: '', PRECO_VENDA: '', ESTOQUE: '5', IMAGEM: '', OBSERVACOES: ''
      });
      setSuccessMsg('Armação cadastrada com sucesso no estoque!');
    } else if (activeTab === 'brindes') {
      const sku = (brindesForm.REFERENCIA_SKU || '').trim() || `BRD-${Date.now().toString().slice(-6)}`;
      onAddRow('CAD_BRINDES', {
        ...brindesForm,
        REFERENCIA_SKU: sku,
        CODIGO: sku,
        SKU: sku,
        PRECO_COMPRA: parseCurrency(brindesForm.PRECO_COMPRA).toFixed(2).replace('.', ','),
        PRECO_VENDA: parseCurrency(brindesForm.PRECO_VENDA || 0).toFixed(2).replace('.', ','),
        ESTOQUE: parseInt(brindesForm.ESTOQUE, 10) || 0,
        DATA_CADASTRO: new Date().toLocaleDateString('pt-BR')
      });
      setBrindesForm({
        UNIDADE: defaultFormCity || 'Central', NOME: '', CATEGORIA: 'Estojo Rígido', REFERENCIA_SKU: '', COR: 'Sortido',
        PRECO_COMPRA: '', PRECO_VENDA: '0,00', ESTOQUE: '20', IMAGEM: '', OBSERVACOES: ''
      });
      setSuccessMsg('Brinde / Cortesia cadastrado com sucesso no estoque!');
    } else if (activeTab === 'pagar') {
      const valPagar = parseCurrency(pagarForm.VALOR);
      const pagarStatus = (pagarForm.STATUS || 'Pendente').trim().toLowerCase();
      onAddRow('CONTAS_PAGAR', {
        ...pagarForm,
        VALOR: valPagar.toFixed(2).replace('.', ','),
        DATA_CADASTRO: new Date().toLocaleDateString('pt-BR')
      });
      if (['pago', 'liquidado', 'recebido'].includes(pagarStatus) && onAddRow) {
        onAddRow('FLUXO_CAIXA', {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          tipo: 'SAÍDA',
          dataHora: new Date().toISOString(),
          data: new Date().toLocaleDateString('pt-BR'),
          unidade: defaultFormCity || 'Cajati',
          operador: currentUser?.username || 'ERP',
          valor: valPagar,
          formaPagamento: 'DINHEIRO',
          motivo: `Pagamento Despesa - ${pagarForm.FORNECEDOR || 'Fornecedor'}`,
          detalhes: pagarForm.DESCRICAO || 'Pagamento de Despesa'
        });
      }
      setPagarForm({
        DESCRICAO: '', CATEGORIA: 'Fornecedores', VALOR: '',
        DATA_VENCIMENTO: new Date().toISOString().split('T')[0],
        DATA_PAGAMENTO: '', STATUS: 'Pendente', FORNECEDOR: '', OBSERVACOES: ''
      });
      setSuccessMsg('Conta a pagar registrada no financeiro!');
    } else if (activeTab === 'receber') {
      const valorNum = parseCurrency(receberForm.VALOR);
      const receivingName = (receberForm.CLIENTE || '').trim();

      // Procura cliente estritamente por ID/CPF ou nome
      const matchedClient = (clientsData && clientsData.length > 0 && receivingName) 
        ? clientsData.find(c => isSameClient(c, {
            'Nome Completo': receivingName,
            'NOME': receivingName,
            'CLIENTE': receivingName,
            'CPF / CNPJ': receberForm.CLIENTE_CPF || receberForm.CPF || '',
            id: receberForm.CLIENTE_ID || ''
          }))
        : null;

      const clientId = matchedClient?.id || matchedClient?.['_id'] || receberForm.CLIENTE_ID || '';
      const clientCpf = matchedClient?.['CPF / CNPJ'] || matchedClient?.['CPF'] || receberForm.CLIENTE_CPF || receberForm.CPF || '';

      onAddRow('CONTAS_RECEBER', {
        ...receberForm,
        CLIENTE_ID: clientId,
        CLIENTE_CPF: clientCpf,
        CPF: clientCpf,
        CLIENTE: receivingName,
        NOME: receivingName,
        VALOR: valorNum.toFixed(2).replace('.', ','),
        DATA_CADASTRO: new Date().toLocaleDateString('pt-BR')
      });

      const statusConta = (receberForm.STATUS || 'Pendente').trim();
      const statusContaNorm = statusConta.toLowerCase();

      // Se cadastrada já como Recebido/Pago, registrar no FLUXO_CAIXA
      if (['recebido', 'pago', 'liquidado'].includes(statusContaNorm) && onAddRow) {
        onAddRow('FLUXO_CAIXA', {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          tipo: 'RECEBIMENTO',
          dataHora: new Date().toISOString(),
          data: new Date().toLocaleDateString('pt-BR'),
          unidade: defaultFormCity || 'Cajati',
          operador: currentUser?.username || 'ERP',
          valor: valorNum,
          formaPagamento: receberForm.MEIO_PAGAMENTO || 'DINHEIRO',
          motivo: `Recebimento ERP - ${receivingName || 'Cliente'}`,
          detalhes: receberForm.DESCRICAO || 'Recebimento de Conta',
          CLIENTE_ID: clientId,
          CLIENTE_CPF: clientCpf,
          CPF: clientCpf
        });
      }

      // Sincronização Automática com a tabela de Clientes (CLIENTES_CADASTRADOS)
      if (matchedClient && onUpdateRow) {
        if (statusConta === 'Pendente' || statusConta === 'Inadimplente' || statusConta === 'Atrasado') {
          const currentDebt = parseCurrency(matchedClient['Valor Devido'] || 0);
          const newDebt = currentDebt + valorNum;
          onUpdateRow('CLIENTES_CADASTRADOS', matchedClient, {
            ...matchedClient,
            'Valor Devido': newDebt.toFixed(2).replace('.', ','),
            'Status de Pagamento': 'Inadimplente',
            'Data de Vencimento': receberForm.DATA_VENCIMENTO || matchedClient['Data de Vencimento'] || ''
          });
        }
      }

      setReceberForm({
        DESCRICAO: '', CLIENTE: '', VENDA_OS: '', VALOR: '',
        DATA_VENCIMENTO: new Date().toISOString().split('T')[0],
        DATA_RECEBIMENTO: '', STATUS: 'Pendente', MEIO_PAGAMENTO: 'Cartão de Crédito', OBSERVACOES: ''
      });
      setSuccessMsg('Conta a receber registrada e sincronizada com o saldo do cliente!');
    } else if (activeTab === 'vouchers') {
      const cleanCode = (voucherForm.CODIGO || voucherForm.NOME || '').trim().toUpperCase().replace(/\s+/g, '_');
      const valDesc = parseCurrency(voucherForm.VALOR_DESCONTO);
      const newVoucher = {
        id: `voucher_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        CODIGO: cleanCode,
        NOME: voucherForm.NOME.trim() || cleanCode,
        TIPO_DESCONTO: voucherForm.TIPO_DESCONTO, // 'VALOR' ou 'PORCENTAGEM'
        VALOR_DESCONTO: voucherForm.TIPO_DESCONTO === 'PORCENTAGEM' ? String(valDesc) : valDesc.toFixed(2).replace('.', ','),
        QUANTIDADE_TOTAL: String(parseInt(voucherForm.QUANTIDADE_TOTAL, 10) || 1),
        QUANTIDADE_USADA: '0',
        UNIDADE: voucherForm.UNIDADE || 'Todas',
        VALIDADE: voucherForm.VALIDADE || '',
        STATUS: voucherForm.STATUS || 'Ativo',
        OBSERVACOES: voucherForm.OBSERVACOES || '',
        DATA_CRIACAO: new Date().toISOString().split('T')[0]
      };
      onAddRow('VOUCHERS', newVoucher);
      setVoucherForm({
        CODIGO: '',
        NOME: '',
        TIPO_DESCONTO: 'VALOR',
        VALOR_DESCONTO: '',
        QUANTIDADE_TOTAL: '10',
        UNIDADE: 'Todas',
        VALIDADE: '',
        STATUS: 'Ativo',
        OBSERVACOES: ''
      });
      setSuccessMsg(`Voucher "${cleanCode}" criado com sucesso! Disponível para uso no PDV.`);
    }

    setIsAdding(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleToggleVoucherStatus = (voucher) => {
    if (!onUpdateRow) return;
    const currentStatus = (voucher.STATUS || voucher.status || 'Ativo').trim();
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';
    const updated = {
      ...voucher,
      STATUS: newStatus
    };
    onUpdateRow('VOUCHERS', voucher, updated);
    setSuccessMsg(`Voucher "${voucher.CODIGO || voucher.NOME}" agora está ${newStatus}!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleViewInstallments = (row) => {
    const clientId = row.CLIENTE_ID || row.cliente_id;
    const clientCpf = row.CLIENTE_CPF || row.cliente_cpf || row.CPF || row.cpf;
    const clientName = row.CLIENTE || row.cliente || row.NOME || row.Nome || row['NOME DO CLIENTE'];
    setClientInstallmentsInfo({
      clientId,
      clientCpf,
      clientName: clientName || 'Cliente Desconhecido'
    });
  };

  const handleRowUpdateWithSync = (sheetName, oldRow, newRow) => {
    onUpdateRow(sheetName, oldRow, newRow);

    // Se editarmos/baixarmos uma Conta a Receber no ERP, sincroniza o saldo com a tabela de Clientes por ID/CPF único!
    if (sheetName === 'CONTAS_RECEBER') {
      const oldStatus = (oldRow.STATUS || oldRow.status || '').trim();
      const newStatus = (newRow.STATUS || newRow.status || '').trim();
      const oldStatusNorm = oldStatus.toLowerCase();
      const newStatusNorm = newStatus.toLowerCase();
      const valorRow = parseCurrency(newRow.VALOR || newRow.valor || oldRow.VALOR || oldRow.valor);
      const isPaidNow = (!['recebido', 'pago', 'liquidado'].includes(oldStatusNorm)) &&
                        (['recebido', 'pago', 'liquidado'].includes(newStatusNorm));

      // 🛡️ Fix 5: Ao marcar como Recebido/Pago, registrar entrada no FLUXO_CAIXA
      if (isPaidNow && onAddRow) {
        const todayStr = new Date().toLocaleDateString('pt-BR');
        const rowClientId = newRow.CLIENTE_ID || newRow.cliente_id || oldRow.CLIENTE_ID || oldRow.cliente_id || '';
        const rowCpf = newRow.CLIENTE_CPF || newRow.CPF || newRow.cpf || oldRow.CLIENTE_CPF || oldRow.CPF || oldRow.cpf || '';
        const clienteNome = (newRow.CLIENTE || newRow.cliente || oldRow.CLIENTE || oldRow.cliente || 'Cliente').trim();
        const doc = newRow.DOCUMENTO || newRow.documento || oldRow.DOCUMENTO || oldRow.documento || '';
        const desc = newRow.DESCRICAO || newRow.descricao || oldRow.DESCRICAO || oldRow.descricao || 'Recebimento de Conta';
        const osNum = newRow.VENDA_OS || newRow.OS || oldRow.VENDA_OS || oldRow.OS || '';
        const unidade = newRow.CIDADE || newRow.cidade || oldRow.CIDADE || oldRow.cidade || defaultFormCity || 'Cajati';

        onAddRow('FLUXO_CAIXA', {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          tipo: 'RECEBIMENTO',
          dataHora: new Date().toISOString(),
          data: todayStr,
          unidade: unidade,
          operador: currentUser?.username || 'ERP',
          valor: valorRow,
          formaPagamento: newRow.MEIO_PAGAMENTO || newRow.FORMA_PAGAMENTO || 'DINHEIRO',
          motivo: `Recebimento ERP - ${clienteNome}`,
          detalhes: osNum ? `OS #${osNum} - ${doc || desc}` : (doc || desc),
          CLIENTE_ID: rowClientId,
          CLIENTE_CPF: rowCpf,
          CPF: rowCpf
        });
      }

      if (clientsData && clientsData.length > 0) {
        const rowClientId = newRow.CLIENTE_ID || newRow.cliente_id || oldRow.CLIENTE_ID || oldRow.cliente_id;
        const rowCpf = newRow.CLIENTE_CPF || newRow.CPF || newRow.cpf || oldRow.CLIENTE_CPF || oldRow.CPF || oldRow.cpf || '';
        const clienteNome = (newRow.CLIENTE || newRow.cliente || oldRow.CLIENTE || oldRow.cliente || '').trim();

        const matchedClient = clientsData.find(c => isSameClient(c, {
          id: rowClientId,
          CLIENTE_ID: rowClientId,
          'CPF / CNPJ': rowCpf,
          CPF: rowCpf,
          'Nome Completo': clienteNome,
          NOME: clienteNome,
          CLIENTE: clienteNome
        }));

        if (matchedClient) {
          // Se baixou/recebeu a conta agora (antes era pendente/atrasado e agora virou Recebido/Pago)
          if (isPaidNow) {
            const currentDebt = parseCurrency(matchedClient['Valor Devido'] || 0);
            const newDebt = Math.max(0, currentDebt - valorRow);
            onUpdateRow('CLIENTES_CADASTRADOS', matchedClient, {
              ...matchedClient,
              'Valor Devido': newDebt > 0 ? newDebt.toFixed(2).replace('.', ',') : '0,00',
              'Status de Pagamento': newDebt > 0 ? 'Inadimplente' : 'Em dia'
            });
          }
          // Se reabriu a conta (antes era Recebido/Pago e agora virou Pendente/Atrasado)
          else if (['recebido', 'pago', 'liquidado'].includes(oldStatusNorm) && ['pendente', 'atrasado', 'inadimplente'].includes(newStatusNorm)) {
            const currentDebt = parseCurrency(matchedClient['Valor Devido'] || 0);
            const newDebt = currentDebt + valorRow;
            onUpdateRow('CLIENTES_CADASTRADOS', matchedClient, {
              ...matchedClient,
              'Valor Devido': newDebt.toFixed(2).replace('.', ','),
              'Status de Pagamento': 'Inadimplente'
            });
          }
        }
      }
    } else if (sheetName === 'CONTAS_PAGAR') {
      const oldStatus = (oldRow.STATUS || oldRow.status || '').trim();
      const newStatus = (newRow.STATUS || newRow.status || '').trim();
      const oldStatusNorm = oldStatus.toLowerCase();
      const newStatusNorm = newStatus.toLowerCase();
      const valorRow = parseCurrency(newRow.VALOR || newRow.valor || oldRow.VALOR || oldRow.valor);
      const isPaidNow = (!['pago', 'liquidado', 'recebido'].includes(oldStatusNorm)) &&
                        (['pago', 'liquidado', 'recebido'].includes(newStatusNorm));

      // 🛡️ Fix 5: Ao marcar Conta a Pagar como Pago, registrar saída no FLUXO_CAIXA
      if (isPaidNow && onAddRow) {
        const todayStr = new Date().toLocaleDateString('pt-BR');
        const favorecido = newRow.FORNECEDOR || newRow.fornecedor || newRow.BENEFICIARIO || newRow.beneficiario || oldRow.FORNECEDOR || oldRow.fornecedor || 'Fornecedor';
        const doc = newRow.DOCUMENTO || newRow.documento || oldRow.DOCUMENTO || oldRow.documento || '';
        const desc = newRow.DESCRICAO || newRow.descricao || oldRow.DESCRICAO || oldRow.descricao || 'Pagamento de Despesa';
        const unidade = newRow.CIDADE || newRow.cidade || oldRow.CIDADE || oldRow.cidade || defaultFormCity || 'Cajati';

        onAddRow('FLUXO_CAIXA', {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          tipo: 'SAÍDA',
          dataHora: new Date().toISOString(),
          data: todayStr,
          unidade: unidade,
          operador: currentUser?.username || 'ERP',
          valor: valorRow,
          formaPagamento: newRow.MEIO_PAGAMENTO || newRow.FORMA_PAGAMENTO || 'DINHEIRO',
          motivo: `Pagamento Despesa - ${favorecido}`,
          detalhes: doc ? `${doc} - ${desc}` : desc
        });
      }
    }
  };

  const getSheetName = () => {
    switch (activeTab) {
      case 'lentes': return 'CAD_LENTES';
      case 'armacoes': return 'CAD_ARMACOES';
      case 'brindes': return 'CAD_BRINDES';
      case 'pagar': return 'CONTAS_PAGAR';
      case 'receber': return 'CONTAS_RECEBER';
      case 'transferencias': return 'TRANSFERENCIAS_ESTOQUE';
      case 'vouchers': return 'VOUCHERS';
      default: return 'CAD_LENTES';
    }
  };

  const currentTabRows = useMemo(() => {
    let rows = [];
    switch (activeTab) {
      case 'lentes': rows = lentesData; break;
      case 'armacoes': rows = armacoesData; break;
      case 'brindes': rows = brindesData; break;
      case 'pagar': rows = pagarData; break;
      case 'receber': rows = receberData; break;
      case 'transferencias': rows = transferenciasData; break;
      case 'vouchers': rows = vouchersData; break;
      default: rows = []; break;
    }
    if (activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') {
      if (selectedStockCity && selectedStockCity !== 'ALL') {
        rows = rows.filter(item => {
          const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central').trim().toLowerCase();
          return u === selectedStockCity.toLowerCase() || u.includes(selectedStockCity.toLowerCase());
        });
      }
      if (appliedStockFilter) {
        return filterAndSortStock(rows, salesData, appliedStockFilter);
      }
      if (filterCriticalStock) {
        return rows.filter(item => {
          const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10);
          return qtd <= (activeTab === 'brindes' ? 5 : 2);
        });
      }
    }
    return rows;
  }, [activeTab, lentesData, armacoesData, brindesData, pagarData, receberData, transferenciasData, vouchersData, appliedStockFilter, filterCriticalStock, salesData, selectedStockCity]);

  const handleExportStockExcel = (type) => {
    try {
      const isArmacao = type === 'armacoes';
      const isBrinde = type === 'brindes';
      const rawList = isArmacao ? armacoesData : isBrinde ? brindesData : lentesData;
      const todayStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const filename = `Estoque_${isArmacao ? 'Armacoes' : isBrinde ? 'Brindes' : 'Lentes'}_Yasmin_Otica_${todayStr}.xlsx`;

      if (!rawList || rawList.length === 0) {
        alert(`Não há registros de estoque de ${isArmacao ? 'armações' : isBrinde ? 'brindes' : 'lentes'} para exportar.`);
        return;
      }

      const formattedRows = rawList.map((item, index) => {
        if (isArmacao) {
          return {
            'Nº': index + 1,
            'Unidade': item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central',
            'Marca': item.MARCA || item.marca || '',
            'Modelo': item.MODELO || item.modelo || '',
            'SKU / Referência': item.REFERENCIA_SKU || item.referencia_sku || item.SKU || item.REFERÊNCIA || '',
            'Cor': item.COR || item.cor || '',
            'Tamanho': item.TAMANHO || item.tamanho || '',
            'Material': item.MATERIAL || item.material || '',
            'Estoque (Peças)': parseInt(item.ESTOQUE || item.estoque || 0, 10),
            'Preço de Venda (R$)': item.PRECO_VENDA || item.preco_venda || '',
            'Preço de Custo (R$)': item.PRECO_COMPRA || item.preco_compra || '',
            'Observações': item.OBSERVACOES || item.observacoes || '',
            'Data Cadastro': item.DATA_CADASTRO || item.data_cadastro || ''
          };
        } else if (isBrinde) {
          return {
            'Nº': index + 1,
            'Unidade': item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central',
            'Nome / Descrição': item.NOME || item.nome || item.MODELO || '',
            'Categoria': item.CATEGORIA || item.categoria || 'Acessório',
            'SKU / Código': item.REFERENCIA_SKU || item.referencia_sku || item.CODIGO || item.SKU || '',
            'Cor': item.COR || item.cor || '',
            'Estoque (Unidades)': parseInt(item.ESTOQUE || item.estoque || 0, 10),
            'Preço de Venda (R$)': item.PRECO_VENDA || item.preco_venda || '0,00',
            'Preço de Custo (R$)': item.PRECO_COMPRA || item.preco_compra || '0,00',
            'Observações': item.OBSERVACOES || item.observacoes || '',
            'Data Cadastro': item.DATA_CADASTRO || item.data_cadastro || ''
          };
        } else {
          return {
            'Nº': index + 1,
            'Unidade': item.UNIDADE || item.CIDADE || item.LOJA || item.unidade || 'Central',
            'Marca': item.MARCA || item.marca || '',
            'Modelo / Linha': item.MODELO || item.modelo || '',
            'Material': item.MATERIAL || item.material || '',
            'Índice Refração': item.INDICE_REFRACAO || item.indice_refracao || '',
            'Tratamento': item.TRATAMENTO || item.tratamento || '',
            'Esférico Mín': item.ESFERICO_MIN || item.esferico_min || '',
            'Esférico Máx': item.ESFERICO_MAX || item.esferico_max || '',
            'Cilíndrico Mín': item.CILINDRICO_MIN || item.cilindrico_min || '',
            'Cilíndrico Máx': item.CILINDRICO_MAX || item.cilindrico_max || '',
            'Estoque (Pares)': parseInt(item.ESTOQUE || item.estoque || 0, 10),
            'Preço de Venda (R$)': item.PRECO_VENDA || item.preco_venda || '',
            'Preço de Custo (R$)': item.PRECO_COMPRA || item.preco_compra || '',
            'Observações': item.OBSERVACOES || item.observacoes || '',
            'Data Cadastro': item.DATA_CADASTRO || item.data_cadastro || ''
          };
        }
      });

      const ws = XLSX.utils.json_to_sheet(formattedRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isArmacao ? 'Estoque Armações' : isBrinde ? 'Estoque Brindes' : 'Estoque Lentes');
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Erro ao exportar estoque:', err);
      alert('Erro ao gerar arquivo Excel do estoque.');
    }
  };

  // Alertas Inteligentes de Estoque Baixo e Contas Vencidas
  const criticalStock = useMemo(() => {
    const list = [];
    lentesData.forEach(item => {
      const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10);
      if (qtd <= 2) {
        list.push({
          type: 'Lente',
          name: `${item.MARCA || item.marca || ''} ${item.MODELO || item.modelo || ''}`.trim() || 'Lente sem nome',
          qtd,
          rawItem: item
        });
      }
    });
    armacoesData.forEach(item => {
      const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10);
      if (qtd <= 2) {
        list.push({
          type: 'Armação',
          name: `${item.MARCA || item.marca || ''} ${item.MODELO || item.modelo || ''}`.trim() || 'Armação sem nome',
          qtd,
          rawItem: item
        });
      }
    });
    brindesData.forEach(item => {
      const qtd = parseInt(item.ESTOQUE || item.estoque || 0, 10);
      if (qtd <= 5) {
        list.push({
          type: 'Brinde',
          name: `${item.NOME || item.nome || item.MODELO || 'Brinde'}`.trim(),
          qtd,
          rawItem: item
        });
      }
    });
    return list;
  }, [lentesData, armacoesData, brindesData]);

  const overdueBills = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const list = [];
    pagarData.forEach(item => {
      const st = (item.STATUS || item.status || 'Pendente').trim();
      const dt = (item.DATA_VENCIMENTO || item.data_vencimento || '').toString().trim();
      if (st !== 'Pago' && st !== 'Liquidado' && dt && dt <= todayStr) {
        list.push({
          type: 'Pagar',
          descricao: item.DESCRICAO || item.descricao || 'Despesa',
          valor: parseCurrency(item.VALOR || item.valor),
          vencimento: dt
        });
      }
    });
    receberData.forEach(item => {
      const st = (item.STATUS || item.status || 'Pendente').trim();
      const dt = (item.DATA_VENCIMENTO || item.data_vencimento || '').toString().trim();
      if (st !== 'Recebido' && st !== 'Pago' && st !== 'Liquidado' && dt && dt <= todayStr) {
        list.push({
          type: 'Receber',
          descricao: item.DESCRICAO || item.descricao || 'Recebimento',
          valor: parseCurrency(item.VALOR || item.valor),
          vencimento: dt
        });
      }
    });
    return list;
  }, [pagarData, receberData]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1400px] mx-auto space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="p-2.5 glass-card hover:bg-white/10 transition-all rounded-xl text-slate-400 hover:text-white shadow-lg shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-widest border border-sky-500/20">Módulo ERP</span>
              <span className="text-xs text-slate-400 font-bold">Ótica e Financeiro</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-black title-gradient uppercase mt-1">Gestão de Ótica &amp; Financeiro</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {(activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') && (
            <button
              onClick={() => setIsStockFilterModalOpen(true)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border font-black rounded-xl shadow-lg transition-all text-xs sm:text-sm active:scale-95 ${
                appliedStockFilter
                  ? 'bg-gradient-to-r from-emerald-600/40 to-teal-600/40 border-emerald-400 text-emerald-100 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300 hover:text-white'
              }`}
              title={`Filtros & Relatórios de Estoque (${activeTab === 'armacoes' ? 'Armações' : activeTab === 'brindes' ? 'Brindes' : 'Lentes'})`}
            >
              <Filter size={15} className="text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Filtros de Estoque ({activeTab === 'armacoes' ? 'Armações' : activeTab === 'brindes' ? 'Brindes' : 'Lentes'})</span>
              <span className="sm:hidden">Filtros</span>
              {appliedStockFilter && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          )}
          {(activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600/30 to-sky-600/30 hover:from-indigo-600/50 hover:to-sky-600/50 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200 hover:text-white font-black rounded-xl shadow-lg transition-all text-xs sm:text-sm active:scale-95"
            >
              <ArrowLeftRight size={15} className="text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Transferir Estoque</span>
              <span className="sm:hidden">Transferir</span>
            </button>
          )}
          {!isAdding && activeTab !== 'fluxo_caixa' && activeTab !== 'transferencias' && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-sky-500/25 transition-all text-xs sm:text-sm active:scale-95"
            >
              <PlusCircle size={15} className="shrink-0" />
              <span className="hidden sm:inline">Novo Registro</span>
              <span className="sm:hidden">Novo</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Sucesso */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 font-bold"
          >
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Painel de Alertas Rápidos (Notificações) */}
      {overdueBills.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase tracking-wide">
            <AlertTriangle size={18} className="animate-pulse shrink-0" />
            <span>Contas Vencidas / Vencendo Hoje ({overdueBills.length})</span>
          </div>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {overdueBills.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl border border-amber-500/20 text-xs font-bold text-slate-200">
                <span className="truncate pr-2 text-slate-300">{item.type === 'Pagar' ? '📉 A Pagar' : '📈 A Receber'}: <span className="text-white font-black">{item.descricao}</span></span>
                <span className="shrink-0 font-black text-amber-300">{formatCurrency(item.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navegação Secundária em Abas */}
      <div className="flex overflow-x-auto pb-2 sm:grid sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-3 erp-scroll">
        <button
          onClick={() => { setActiveTab('lentes'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'lentes'
              ? 'bg-sky-500/20 border-sky-500 text-white shadow-lg shadow-sky-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'lentes' ? 'bg-sky-500 text-white' : 'bg-white/5 text-sky-400'}`}>
            <Eye size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Estoque</p>
            <p className="font-black text-sm">Lentes</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('armacoes'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'armacoes'
              ? 'bg-fuchsia-500/20 border-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'armacoes' ? 'bg-fuchsia-500 text-white' : 'bg-white/5 text-fuchsia-400'}`}>
            <Glasses size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Estoque</p>
            <p className="font-black text-sm">Armações</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('brindes'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'brindes'
              ? 'bg-pink-500/20 border-pink-500 text-white shadow-lg shadow-pink-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'brindes' ? 'bg-pink-500 text-white' : 'bg-white/5 text-pink-400'}`}>
            <Gift size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Estoque</p>
            <p className="font-black text-sm">Brindes</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('vouchers'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'vouchers'
              ? 'bg-gradient-to-br from-amber-500/20 to-fuchsia-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'vouchers' ? 'bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white' : 'bg-white/5 text-amber-400'}`}>
            <Ticket size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Promoções</p>
            <p className="font-black text-sm">Vouchers</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('receber'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'receber'
              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'receber' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-emerald-400'}`}>
            <TrendingUp size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Financeiro</p>
            <p className="font-black text-sm">A Receber</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('pagar'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'pagar'
              ? 'bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'pagar' ? 'bg-rose-500 text-white' : 'bg-white/5 text-rose-400'}`}>
            <TrendingDown size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Financeiro</p>
            <p className="font-black text-sm">A Pagar</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('transferencias'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'transferencias'
              ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'transferencias' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-indigo-400'}`}>
            <Truck size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Logística</p>
            <p className="font-black text-sm">Transferências</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('fluxo_caixa'); setIsAdding(false); }}
          className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all border shrink-0 min-w-[145px] sm:min-w-0 ${
            activeTab === 'fluxo_caixa'
              ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
              : 'glass-card border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${activeTab === 'fluxo_caixa' ? 'bg-purple-500 text-white' : 'bg-white/5 text-purple-400'}`}>
            <History size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Tesouraria & PDV</p>
            <p className="font-black text-sm">Histórico Caixa</p>
          </div>
        </button>
      </div>

      {/* Cartões Estatísticos da Aba Ativa */}
      {activeTab === 'vouchers' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Total de Vouchers</span>
              <Ticket size={18} className="text-amber-400" />
            </div>
            <p className="text-3xl font-black text-white">{vouchersStats.total}</p>
            <p className="text-[10px] text-slate-500 font-bold">Cupons cadastrados</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>Vouchers Ativos</span>
              <CheckCircle2 size={18} className="text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-300">{vouchersStats.ativos}</p>
            <p className="text-[10px] text-emerald-500/70 font-bold">Disponíveis para uso no PDV</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 space-y-1">
            <div className="flex items-center justify-between text-sky-400 text-xs font-bold uppercase tracking-wider">
              <span>Usos Realizados</span>
              <Sparkles size={18} className="text-sky-400" />
            </div>
            <p className="text-3xl font-black text-sky-300">{vouchersStats.totalUsos}</p>
            <p className="text-[10px] text-sky-500/70 font-bold">Resgates efetuados nas lojas</p>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-1">
            <div className="flex items-center justify-between text-rose-400 text-xs font-bold uppercase tracking-wider">
              <span>Esgotados / Inativos</span>
              <AlertCircle size={18} className="text-rose-400" />
            </div>
            <p className="text-3xl font-black text-rose-300">{vouchersStats.esgotados}</p>
            <p className="text-[10px] text-rose-500/70 font-bold">Limite de usos atingido</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') && (
            <div className="glass-card p-5 rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <PieChartIcon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                      Qualidade do Ambiente de Estoque &amp; Métricas Visuais
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                        Interativo
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      Distribuição proporcional de {activeTab === 'armacoes' ? 'Armações' : activeTab === 'brindes' ? 'Brindes' : 'Lentes'} por Saúde, Loja e Marca
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsStockFilterModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-black transition-all shadow active:scale-95"
                    title="Abrir Painel de Filtros Inteligentes & Relatórios"
                  >
                    <Filter size={14} />
                    <span className="hidden sm:inline">Painel de Filtros &amp; Relatórios ⚡</span>
                    <span className="sm:hidden">Filtros ⚡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStockChartHeader(prev => !prev)}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-colors"
                    title={showStockChartHeader ? "Ocultar gráfico" : "Exibir gráfico"}
                  >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${showStockChartHeader ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {showStockChartHeader && (
                <div className="pt-1">
                  <StockPieChart
                    items={currentTabRows}
                    compact={true}
                    title={`Distribuição do Inventário (${activeTab === 'armacoes' ? 'Armações' : activeTab === 'brindes' ? 'Brindes' : 'Lentes'})`}
                    onSliceClick={() => setIsStockFilterModalOpen(true)}
                  />
                </div>
              )}
            </div>
          )}

          {/* BARRA DE DISTRIBUIÇÃO POR CIDADE / FILIAL (Para Armações, Lentes e Brindes) */}
          {(activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') && stockDistributionByCity && (
            <div className="glass-card p-4 rounded-3xl border border-white/10 bg-slate-900/70 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      Distribuição de Estoque por Cidade / Filial
                      {selectedStockCity !== 'ALL' && (
                        <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-black border border-sky-500/30">
                          Filtrando {selectedStockCity}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      Saldo físico e variedade de {activeTab === 'armacoes' ? 'armações' : activeTab === 'brindes' ? 'brindes' : 'lentes'} isolados por loja
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition-all shadow-sm"
                    title="Transferir produtos entre lojas"
                  >
                    <ArrowLeftRight size={13} />
                    <span className="hidden sm:inline">Transferir entre Lojas</span>
                    <span className="sm:hidden">Transferir</span>
                  </button>
                  {selectedStockCity !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedStockCity('ALL')}
                      className="text-[11px] font-bold text-sky-400 hover:text-white flex items-center gap-1 hover:underline ml-1"
                    >
                      <span>Mostrar Todas</span>
                      <span>✕</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Botões / Pills de cada Cidade / Filial */}
              <div className="flex overflow-x-auto pb-1.5 sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-0.5 erp-scroll">
                {[
                  { id: 'ALL', label: 'Todas as Lojas', badge: `${stockDistributionByCity.totalItems} mod · ${stockDistributionByCity.totalUnits} un` },
                  { id: 'Central', label: 'Central (Todas)', badge: `${stockDistributionByCity.stores['Central']?.items || 0} mod · ${stockDistributionByCity.stores['Central']?.units || 0} un` },
                  { id: 'Cajati', label: 'Cajati', badge: `${stockDistributionByCity.stores['Cajati']?.items || 0} mod · ${stockDistributionByCity.stores['Cajati']?.units || 0} un` },
                  { id: 'Registro', label: 'Registro', badge: `${stockDistributionByCity.stores['Registro']?.items || 0} mod · ${stockDistributionByCity.stores['Registro']?.units || 0} un` },
                  { id: 'Jacupiranga', label: 'Jacupiranga', badge: `${stockDistributionByCity.stores['Jacupiranga']?.items || 0} mod · ${stockDistributionByCity.stores['Jacupiranga']?.units || 0} un` },
                  { id: 'Venda Externa', label: 'Venda Externa', badge: `${stockDistributionByCity.stores['Venda Externa']?.items || 0} mod · ${stockDistributionByCity.stores['Venda Externa']?.units || 0} un` },
                ].map(store => {
                  const isSelected = selectedStockCity === store.id;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => setSelectedStockCity(store.id)}
                      className={`flex flex-col text-left p-2.5 rounded-xl border transition-all shrink-0 min-w-[130px] sm:min-w-0 ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 text-white shadow-md shadow-sky-500/10 ring-1 ring-sky-400/50'
                          : 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-black truncate">{store.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        {store.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`grid gap-4 sm:gap-6 ${activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
          {activeTab === 'lentes' && (
            <>
              <div className="glass-card p-6 border-l-4 border-l-sky-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total de Linhas / Marcas</p>
                <p className="text-3xl font-black text-white mt-1">{lentesStats.total}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-indigo-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pares em Estoque</p>
                <p className="text-3xl font-black text-indigo-400 mt-1">{lentesStats.totalPares}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Custo Total em Estoque</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(lentesStats.valorEstoque)}</p>
              </div>
              <div
                onClick={() => setFilterCriticalStock(prev => !prev)}
                className={`glass-card p-6 border-l-4 cursor-pointer transition-all ${
                  filterCriticalStock
                    ? 'border-l-amber-500 ring-2 ring-amber-500/50 bg-amber-500/10'
                    : 'border-l-amber-500 hover:border-amber-400 hover:bg-white/5'
                }`}
                title="Clique para filtrar apenas itens com estoque crítico (<= 2 unidades)"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} className={lentesStats.criticos > 0 ? 'animate-pulse' : ''} />
                    Estoque Crítico (≤ 2)
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${filterCriticalStock ? 'bg-amber-500 text-slate-950 font-black' : 'bg-amber-500/20 text-amber-300'}`}>
                    {filterCriticalStock ? 'Filtro Ativo' : 'Ponto de Pedido'}
                  </span>
                </div>
                <p className="text-3xl font-black text-amber-300 mt-1">{lentesStats.criticos} itens</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {filterCriticalStock ? 'Clique para desativar filtro' : 'Clique para isolar no catálogo'}
                </p>
              </div>
            </>
          )}

          {activeTab === 'armacoes' && (
            <>
              <div className="glass-card p-6 border-l-4 border-l-fuchsia-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Modelos Cadastrados</p>
                <p className="text-3xl font-black text-white mt-1">{armacoesStats.total}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-pink-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Peças em Estoque</p>
                <p className="text-3xl font-black text-pink-400 mt-1">{armacoesStats.totalPecs}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Custo Total do Inventário</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(armacoesStats.valorEstoque)}</p>
              </div>
              <div
                onClick={() => setFilterCriticalStock(prev => !prev)}
                className={`glass-card p-6 border-l-4 cursor-pointer transition-all ${
                  filterCriticalStock
                    ? 'border-l-amber-500 ring-2 ring-amber-500/50 bg-amber-500/10'
                    : 'border-l-amber-500 hover:border-amber-400 hover:bg-white/5'
                }`}
                title="Clique para filtrar apenas modelos com estoque crítico (<= 2 unidades)"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} className={armacoesStats.criticos > 0 ? 'animate-pulse' : ''} />
                    Estoque Crítico (≤ 2)
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${filterCriticalStock ? 'bg-amber-500 text-slate-950 font-black' : 'bg-amber-500/20 text-amber-300'}`}>
                    {filterCriticalStock ? 'Filtro Ativo' : 'Ponto de Pedido'}
                  </span>
                </div>
                <p className="text-3xl font-black text-amber-300 mt-1">{armacoesStats.criticos} modelos</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {filterCriticalStock ? 'Clique para desativar filtro' : 'Clique para isolar no catálogo'}
                </p>
              </div>
            </>
          )}

          {activeTab === 'brindes' && (
            <>
              <div className="glass-card p-6 border-l-4 border-l-pink-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Modelos Cadastrados</p>
                <p className="text-3xl font-black text-white mt-1">{brindesStats.total}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-rose-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Peças em Estoque</p>
                <p className="text-3xl font-black text-rose-400 mt-1">{brindesStats.totalPecs}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Custo Total do Inventário</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(brindesStats.valorEstoque)}</p>
              </div>
              <div
                onClick={() => setFilterCriticalStock(prev => !prev)}
                className={`glass-card p-6 border-l-4 cursor-pointer transition-all ${
                  filterCriticalStock
                    ? 'border-l-amber-500 ring-2 ring-amber-500/50 bg-amber-500/10'
                    : 'border-l-amber-500 hover:border-amber-400 hover:bg-white/5'
                }`}
                title="Clique para filtrar apenas brindes com estoque crítico (<= 5 unidades)"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} className={brindesStats.criticos > 0 ? 'animate-pulse' : ''} />
                    Estoque Crítico (≤ 5)
                  </p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${filterCriticalStock ? 'bg-amber-500 text-slate-950 font-black' : 'bg-amber-500/20 text-amber-300'}`}>
                    {filterCriticalStock ? 'Filtro Ativo' : 'Ponto de Pedido'}
                  </span>
                </div>
                <p className="text-3xl font-black text-amber-300 mt-1">{brindesStats.criticos} itens</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {filterCriticalStock ? 'Clique para desativar filtro' : 'Clique para isolar no catálogo'}
                </p>
              </div>
            </>
          )}

          {activeTab === 'receber' && (
            <>
              <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recebido / Liquidado</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(receberStats.recebido)}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-amber-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pendente de Recebimento</p>
                <p className="text-3xl font-black text-amber-400 mt-1">{formatCurrency(receberStats.pendente)}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-sky-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total de Lançamentos</p>
                <p className="text-3xl font-black text-white mt-1">{receberStats.total}</p>
              </div>
            </>
          )}

          {activeTab === 'pagar' && (
            <>
              <div className="glass-card p-6 border-l-4 border-l-rose-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Pendente a Pagar</p>
                <p className="text-3xl font-black text-rose-400 mt-1">{formatCurrency(pagarStats.pendente)}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Contas Pagas / Liq.</p>
                <p className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(pagarStats.pago)}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-indigo-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total de Despesas Registradas</p>
                <p className="text-3xl font-black text-white mt-1">{pagarStats.total}</p>
              </div>
            </>
          )}

          {activeTab === 'transferencias' && (
            <>
              <div className="glass-card p-6 border-l-4 border-l-indigo-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Transferências Realizadas</p>
                <p className="text-3xl font-black text-indigo-400 mt-1">{transferStats.totalMoves}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-sky-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Peças / Pares Movimentados</p>
                <p className="text-3xl font-black text-sky-400 mt-1">{transferStats.totalItems}</p>
              </div>
              <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Status Operacional</p>
                <p className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
                  <CheckCircle size={20} /> Multi-Lojas Ativo
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    )}

      {/* Conteúdo Dinâmico por Aba */}
      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-card p-8 border border-white/10"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {activeTab === 'lentes' && 'Cadastrar Nova Lente no Estoque'}
                  {activeTab === 'armacoes' && 'Cadastrar Nova Armação no Estoque'}
                  {activeTab === 'brindes' && 'Cadastrar Novo Brinde / Cortesia no Estoque'}
                  {activeTab === 'vouchers' && 'Criar Novo Voucher / Cupom Promocional'}
                  {activeTab === 'receber' && 'Lançar Nova Conta a Receber'}
                  {activeTab === 'pagar' && 'Lançar Nova Conta a Pagar'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Preencha os campos abaixo para salvar no banco de dados ERP.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-6">
              {/* FORMULÁRIO DE LENTES */}
              {activeTab === 'lentes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unidade (Loja) *</label>
                    <select value={lentesForm.UNIDADE} onChange={e => setLentesForm({...lentesForm, UNIDADE: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50">
                      <option className="bg-slate-900" value="Central">Central (Todas)</option>
                      <option className="bg-slate-900" value="Cajati">Cajati</option>
                      <option className="bg-slate-900" value="Registro">Registro</option>
                      <option className="bg-slate-900" value="Jacupiranga">Jacupiranga</option>
                      <option className="bg-slate-900" value="Venda Externa">Venda Externa</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Marca da Lente *</label>
                    <input required type="text" placeholder="Ex: Essilor, Hoya, Zeiss, Yasmin Flex" value={lentesForm.MARCA} onChange={e => setLentesForm({...lentesForm, MARCA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Modelo / Nome Comercial *</label>
                    <input required type="text" placeholder="Ex: Multifocal Digital HD, Visão Simples" value={lentesForm.MODELO} onChange={e => setLentesForm({...lentesForm, MODELO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50" />
                  </div>
                  {/* MATERIAL DE LENTE */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Material</label>
                      <div className="flex items-center gap-1.5">
                        {!isAddingLenteMaterial && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsAddingLenteMaterial(true)}
                              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg transition-colors border border-sky-500/25 cursor-pointer"
                              title="Cadastrar e salvar novo material de lente"
                            >
                              <Plus size={12} className="stroke-[3]" />
                              <span>Adicionar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!lentesForm.MATERIAL) return;
                                if (window.confirm(`Deseja remover o material "${lentesForm.MATERIAL}" das opções disponíveis?`)) {
                                  handleRemoveLenteMaterial(lentesForm.MATERIAL);
                                }
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-colors border border-rose-500/25 cursor-pointer"
                              title={`Remover o material selecionado (${lentesForm.MATERIAL})`}
                            >
                              <Trash2 size={12} />
                              <span>Remover</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isAddingLenteMaterial ? (
                      <div className="space-y-1.5 bg-sky-500/5 p-2 rounded-xl border border-sky-500/30">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ex: Policarbonato 1.59, Trivex HD..."
                            value={newLenteMaterialInput}
                            onChange={e => setNewLenteMaterialInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddLenteMaterial();
                              } else if (e.key === 'Escape') {
                                setIsAddingLenteMaterial(false);
                                setNewLenteMaterialInput('');
                              }
                            }}
                            className="flex-1 bg-black/60 border border-sky-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddLenteMaterial()}
                            disabled={!newLenteMaterialInput.trim()}
                            className="px-3 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md shadow-sky-500/20 cursor-pointer"
                          >
                            <Check size={14} />
                            <span>Salvar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsAddingLenteMaterial(false); setNewLenteMaterialInput(''); }}
                            className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs transition-colors cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[10px] text-sky-300/80">O material ficará salvo e disponível para os próximos registros.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <select
                          value={lentesForm.MATERIAL}
                          onChange={e => {
                            if (e.target.value === '__NEW__') {
                              setIsAddingLenteMaterial(true);
                            } else {
                              setLentesForm({...lentesForm, MATERIAL: e.target.value});
                            }
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                        >
                          {lenteMaterialOptions.map(opt => (
                            <option key={opt.value} className="bg-slate-900" value={opt.value}>
                              {opt.label} {opt.isCustom ? '(Personalizado)' : ''}
                            </option>
                          ))}
                          <option className="bg-slate-800 text-sky-400 font-bold" value="__NEW__">
                            ➕ + Adicionar Outro Material...
                          </option>
                        </select>
                        {hiddenLenteMateriais.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleRestoreBaseLenteMateriais}
                              className="text-[10px] text-slate-500 hover:text-sky-400 underline cursor-pointer"
                            >
                              ↺ Restaurar materiais padrão ocultados
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Índice de Refração</label>
                    <input type="text" placeholder="1.56" value={lentesForm.INDICE_REFRACAO} onChange={e => setLentesForm({...lentesForm, INDICE_REFRACAO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50" />
                  </div>
                  {/* TRATAMENTO DE LENTE */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tratamento</label>
                      <div className="flex items-center gap-1.5">
                        {!isAddingLenteTratamento && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsAddingLenteTratamento(true)}
                              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg transition-colors border border-sky-500/25 cursor-pointer"
                              title="Cadastrar e salvar novo tratamento de lente"
                            >
                              <Plus size={12} className="stroke-[3]" />
                              <span>Adicionar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!lentesForm.TRATAMENTO) return;
                                if (window.confirm(`Deseja remover o tratamento "${lentesForm.TRATAMENTO}" das opções disponíveis?`)) {
                                  handleRemoveLenteTratamento(lentesForm.TRATAMENTO);
                                }
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-colors border border-rose-500/25 cursor-pointer"
                              title={`Remover o tratamento selecionado (${lentesForm.TRATAMENTO})`}
                            >
                              <Trash2 size={12} />
                              <span>Remover</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isAddingLenteTratamento ? (
                      <div className="space-y-1.5 bg-sky-500/5 p-2 rounded-xl border border-sky-500/30">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ex: Crizal Sapphire, Blue UV420..."
                            value={newLenteTratamentoInput}
                            onChange={e => setNewLenteTratamentoInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddLenteTratamento();
                              } else if (e.key === 'Escape') {
                                setIsAddingLenteTratamento(false);
                                setNewLenteTratamentoInput('');
                              }
                            }}
                            className="flex-1 bg-black/60 border border-sky-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddLenteTratamento()}
                            disabled={!newLenteTratamentoInput.trim()}
                            className="px-3 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md shadow-sky-500/20 cursor-pointer"
                          >
                            <Check size={14} />
                            <span>Salvar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsAddingLenteTratamento(false); setNewLenteTratamentoInput(''); }}
                            className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs transition-colors cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[10px] text-sky-300/80">O tratamento ficará salvo e disponível para os próximos registros.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <select
                          value={lentesForm.TRATAMENTO}
                          onChange={e => {
                            if (e.target.value === '__NEW__') {
                              setIsAddingLenteTratamento(true);
                            } else {
                              setLentesForm({...lentesForm, TRATAMENTO: e.target.value});
                            }
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                        >
                          {lenteTratamentoOptions.map(opt => (
                            <option key={opt.value} className="bg-slate-900" value={opt.value}>
                              {opt.label} {opt.isCustom ? '(Personalizado)' : ''}
                            </option>
                          ))}
                          <option className="bg-slate-800 text-sky-400 font-bold" value="__NEW__">
                            ➕ + Adicionar Outro Tratamento...
                          </option>
                        </select>
                        {hiddenLenteTratamentos.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleRestoreBaseLenteTratamentos}
                              className="text-[10px] text-slate-500 hover:text-sky-400 underline cursor-pointer"
                            >
                              ↺ Restaurar tratamentos padrão ocultados
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Grau Esférico (Esf.)</label>
                    <input
                      type="text"
                      placeholder="Ex: -2.00 ou -6.00 a +6.00"
                      value={lentesForm.ESFERICO || ''}
                      onChange={e => setLentesForm({
                        ...lentesForm,
                        ESFERICO: e.target.value,
                        ESFERICO_MIN: e.target.value
                      })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Grau Cilíndrico (Cil.)</label>
                    <input
                      type="text"
                      placeholder="Ex: -0.75 ou -4.00 a 0.00"
                      value={lentesForm.CILINDRICO || ''}
                      onChange={e => setLentesForm({
                        ...lentesForm,
                        CILINDRICO: e.target.value,
                        CILINDRICO_MIN: e.target.value
                      })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Diâmetro (mm)</label>
                    <input
                      type="text"
                      placeholder="Ex: 65mm, 70mm, 75mm"
                      value={lentesForm.DIAMETRO || lentesForm.EIXO || ''}
                      onChange={e => setLentesForm({ ...lentesForm, DIAMETRO: e.target.value, EIXO: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Adição (Multifocal)</label>
                    <input
                      type="text"
                      placeholder="Ex: +2.00"
                      value={lentesForm.ADICAO || ''}
                      onChange={e => setLentesForm({ ...lentesForm, ADICAO: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Estoque (Pares)</label>
                    <input type="number" min="0" value={lentesForm.ESTOQUE} onChange={e => setLentesForm({...lentesForm, ESTOQUE: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Preço de Custo (R$)</label>
                    <input type="text" placeholder="80,00" value={lentesForm.PRECO_COMPRA} onChange={e => setLentesForm({...lentesForm, PRECO_COMPRA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Preço de Venda (R$)</label>
                    <input type="text" placeholder="280,00" value={lentesForm.PRECO_VENDA} onChange={e => setLentesForm({...lentesForm, PRECO_VENDA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-bold focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                </div>
              )}

              {/* FORMULÁRIO DE ARMAÇÕES */}
              {activeTab === 'armacoes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unidade (Loja) *</label>
                    <select value={armacoesForm.UNIDADE} onChange={e => setArmacoesForm({...armacoesForm, UNIDADE: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50">
                      <option className="bg-slate-900" value="Central">Central (Todas)</option>
                      <option className="bg-slate-900" value="Cajati">Cajati</option>
                      <option className="bg-slate-900" value="Registro">Registro</option>
                      <option className="bg-slate-900" value="Jacupiranga">Jacupiranga</option>
                      <option className="bg-slate-900" value="Venda Externa">Venda Externa</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Marca da Armação *</label>
                    <input required type="text" placeholder="Ex: Ray-Ban, Oakley, Yasmin Gold, Vogue" value={armacoesForm.MARCA} onChange={e => setArmacoesForm({...armacoesForm, MARCA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Modelo / Nome Comercial *</label>
                    <input required type="text" placeholder="Ex: Aviador Retrô, Clubmaster, Slim Titanium" value={armacoesForm.MODELO} onChange={e => setArmacoesForm({...armacoesForm, MODELO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Referência / Código SKU</label>
                    <input type="text" placeholder="Ex: RB3025-001" value={armacoesForm.REFERENCIA_SKU} onChange={e => setArmacoesForm({...armacoesForm, REFERENCIA_SKU: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Cor</label>
                    <input type="text" placeholder="Ex: Preto Fosco, Tartaruga, Dourado" value={armacoesForm.COR} onChange={e => setArmacoesForm({...armacoesForm, COR: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  {/* MATERIAL DE ARMAÇÃO */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Material</label>
                      <div className="flex items-center gap-1.5">
                        {!isAddingArmacaoMaterial && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsAddingArmacaoMaterial(true)}
                              className="text-[11px] font-bold text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 px-2.5 py-1 rounded-lg transition-colors border border-fuchsia-500/25 cursor-pointer"
                              title="Cadastrar e salvar novo material de armação"
                            >
                              <Plus size={12} className="stroke-[3]" />
                              <span>Adicionar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!armacoesForm.MATERIAL) return;
                                if (window.confirm(`Deseja remover o material "${armacoesForm.MATERIAL}" das opções disponíveis?`)) {
                                  handleRemoveArmacaoMaterial(armacoesForm.MATERIAL);
                                }
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-colors border border-rose-500/25 cursor-pointer"
                              title={`Remover o material selecionado (${armacoesForm.MATERIAL})`}
                            >
                              <Trash2 size={12} />
                              <span>Remover</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isAddingArmacaoMaterial ? (
                      <div className="space-y-1.5 bg-fuchsia-500/5 p-2 rounded-xl border border-fuchsia-500/30">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ex: Grilamid TR90, Fibra de Carbono, Madeira..."
                            value={newArmacaoMaterialInput}
                            onChange={e => setNewArmacaoMaterialInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddArmacaoMaterial();
                              } else if (e.key === 'Escape') {
                                setIsAddingArmacaoMaterial(false);
                                setNewArmacaoMaterialInput('');
                              }
                            }}
                            className="flex-1 bg-black/60 border border-fuchsia-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddArmacaoMaterial()}
                            disabled={!newArmacaoMaterialInput.trim()}
                            className="px-3 py-2 bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md shadow-fuchsia-500/20 cursor-pointer"
                          >
                            <Check size={14} />
                            <span>Salvar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsAddingArmacaoMaterial(false); setNewArmacaoMaterialInput(''); }}
                            className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs transition-colors cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[10px] text-fuchsia-300/80">O material ficará salvo e disponível para os próximos registros.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <select
                          value={armacoesForm.MATERIAL}
                          onChange={e => {
                            if (e.target.value === '__NEW__') {
                              setIsAddingArmacaoMaterial(true);
                            } else {
                              setArmacoesForm({...armacoesForm, MATERIAL: e.target.value});
                            }
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50 cursor-pointer"
                        >
                          {armacaoMaterialOptions.map(opt => (
                            <option key={opt.value} className="bg-slate-900" value={opt.value}>
                              {opt.label} {opt.isCustom ? '(Personalizado)' : ''}
                            </option>
                          ))}
                          <option className="bg-slate-800 text-fuchsia-400 font-bold" value="__NEW__">
                            ➕ + Adicionar Outro Material...
                          </option>
                        </select>
                        {hiddenArmacaoMateriais.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleRestoreBaseArmacaoMateriais}
                              className="text-[10px] text-slate-500 hover:text-fuchsia-400 underline cursor-pointer"
                            >
                              ↺ Restaurar materiais padrão ocultados
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tamanho (Aro-Ponte-Haste)</label>
                    <input type="text" placeholder="55-18-140" value={armacoesForm.TAMANHO} onChange={e => setArmacoesForm({...armacoesForm, TAMANHO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Estoque Inicial (Peças) *</label>
                    <input required type="number" min="0" placeholder="5" value={armacoesForm.ESTOQUE} onChange={e => setArmacoesForm({...armacoesForm, ESTOQUE: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Preço de Custo (R$)</label>
                    <input type="text" placeholder="50,00" value={armacoesForm.PRECO_COMPRA} onChange={e => setArmacoesForm({...armacoesForm, PRECO_COMPRA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Preço de Venda (R$) *</label>
                    <input required type="text" placeholder="180,00" value={armacoesForm.PRECO_VENDA} onChange={e => setArmacoesForm({...armacoesForm, PRECO_VENDA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-bold focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">URL / Link da Foto (Imagem)</label>
                    <input type="text" placeholder="https://..." value={armacoesForm.IMAGEM} onChange={e => setArmacoesForm({...armacoesForm, IMAGEM: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observações</label>
                    <input type="text" placeholder="Ex: Linha premium com garantia estendida..." value={armacoesForm.OBSERVACOES} onChange={e => setArmacoesForm({...armacoesForm, OBSERVACOES: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500/50" />
                  </div>
                </div>
              )}

              {/* FORMULÁRIO DE BRINDES */}
              {activeTab === 'brindes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unidade (Loja) *</label>
                    <select value={brindesForm.UNIDADE} onChange={e => setBrindesForm({...brindesForm, UNIDADE: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50">
                      <option className="bg-slate-900" value="Central">Central (Todas)</option>
                      <option className="bg-slate-900" value="Cajati">Cajati</option>
                      <option className="bg-slate-900" value="Registro">Registro</option>
                      <option className="bg-slate-900" value="Jacupiranga">Jacupiranga</option>
                      <option className="bg-slate-900" value="Venda Externa">Venda Externa</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome / Descrição do Brinde *</label>
                    <input required type="text" placeholder="Ex: Estojo Rígido Yasmin, Flanela Microfibra, Limpa-Lentes Spray" value={brindesForm.NOME} onChange={e => setBrindesForm({...brindesForm, NOME: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoria do Brinde</label>
                    <select value={brindesForm.CATEGORIA} onChange={e => setBrindesForm({...brindesForm, CATEGORIA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50">
                      <option className="bg-slate-900" value="Estojo Rígido">Estojo Rígido</option>
                      <option className="bg-slate-900" value="Estojo Flexível">Estojo Flexível / Saquinho</option>
                      <option className="bg-slate-900" value="Flanela Microfibra">Flanela Microfibra</option>
                      <option className="bg-slate-900" value="Limpa-Lentes Spray">Limpa-Lentes Spray</option>
                      <option className="bg-slate-900" value="Cordão / Corrente">Cordão / Corrente de Armação</option>
                      <option className="bg-slate-900" value="Kit Limpeza e Cuidados">Kit Limpeza e Cuidados</option>
                      <option className="bg-slate-900" value="Brinde Promocional / Campanha">Brinde Promocional / Campanha</option>
                      <option className="bg-slate-900" value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Código de Barras / SKU</label>
                    <input type="text" placeholder="Ex: BRD-001 (auto se vazio)" value={brindesForm.REFERENCIA_SKU} onChange={e => setBrindesForm({...brindesForm, REFERENCIA_SKU: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Cor / Variação</label>
                    <input type="text" placeholder="Ex: Preto, Azul, Sortido, Floral" value={brindesForm.COR} onChange={e => setBrindesForm({...brindesForm, COR: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Estoque Inicial (Peças) *</label>
                    <input required type="number" min="0" placeholder="20" value={brindesForm.ESTOQUE} onChange={e => setBrindesForm({...brindesForm, ESTOQUE: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Preço de Custo (R$)</label>
                    <input type="text" placeholder="3,50" value={brindesForm.PRECO_COMPRA} onChange={e => setBrindesForm({...brindesForm, PRECO_COMPRA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Preço de Venda (R$) (0,00 = Cortesia)</label>
                    <input type="text" placeholder="0,00" value={brindesForm.PRECO_VENDA} onChange={e => setBrindesForm({...brindesForm, PRECO_VENDA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-pink-300 font-bold focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">URL / Link da Foto (Imagem)</label>
                    <input type="text" placeholder="https://..." value={brindesForm.IMAGEM} onChange={e => setBrindesForm({...brindesForm, IMAGEM: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observações</label>
                    <input type="text" placeholder="Ex: Fornecido gratuitamente na compra de óculos completos..." value={brindesForm.OBSERVACOES} onChange={e => setBrindesForm({...brindesForm, OBSERVACOES: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50" />
                  </div>
                </div>
              )}

              {/* FORMULÁRIO DE VOUCHERS / CUPONS */}
              {activeTab === 'vouchers' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Código do Voucher (Cupom) *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: PROMO50, VERAO10, VIP2026"
                      value={voucherForm.CODIGO}
                      onChange={e => setVoucherForm({ ...voucherForm, CODIGO: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-300 font-mono font-black uppercase focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome / Título da Campanha *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Desconto Especial de Inauguração, Campanha Volta às Aulas"
                      value={voucherForm.NOME}
                      onChange={e => setVoucherForm({ ...voucherForm, NOME: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo de Desconto *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setVoucherForm({ ...voucherForm, TIPO_DESCONTO: 'VALOR' })}
                        className={`py-3 px-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 ${
                          voucherForm.TIPO_DESCONTO === 'VALOR'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                            : 'bg-black/40 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <DollarSign size={14} /> Valor Fixo (R$)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVoucherForm({ ...voucherForm, TIPO_DESCONTO: 'PORCENTAGEM' })}
                        className={`py-3 px-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1.5 ${
                          voucherForm.TIPO_DESCONTO === 'PORCENTAGEM'
                            ? 'bg-fuchsia-500 text-white border-fuchsia-400 shadow-lg shadow-fuchsia-500/20'
                            : 'bg-black/40 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <Percent size={14} /> Porcentagem (%)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {voucherForm.TIPO_DESCONTO === 'PORCENTAGEM' ? 'Percentual de Desconto (%) *' : 'Valor do Desconto (R$) *'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                        {voucherForm.TIPO_DESCONTO === 'PORCENTAGEM' ? '%' : 'R$'}
                      </span>
                      <input
                        required
                        type="text"
                        placeholder={voucherForm.TIPO_DESCONTO === 'PORCENTAGEM' ? '10' : '50,00'}
                        value={voucherForm.VALOR_DESCONTO}
                        onChange={e => setVoucherForm({ ...voucherForm, VALOR_DESCONTO: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white font-black focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Limite de Usos (Quantidade) *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="10"
                      value={voucherForm.QUANTIDADE_TOTAL}
                      onChange={e => setVoucherForm({ ...voucherForm, QUANTIDADE_TOTAL: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Loja / Unidade Permitida</label>
                    <select
                      value={voucherForm.UNIDADE}
                      onChange={e => setVoucherForm({ ...voucherForm, UNIDADE: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50"
                    >
                      <option className="bg-slate-900" value="Todas">Todas as Lojas</option>
                      <option className="bg-slate-900" value="Cajati">Cajati</option>
                      <option className="bg-slate-900" value="Registro">Registro</option>
                      <option className="bg-slate-900" value="Jacupiranga">Jacupiranga</option>
                      <option className="bg-slate-900" value="Venda Externa">Venda Externa</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data de Validade (Opcional)</label>
                    <input
                      type="date"
                      value={voucherForm.VALIDADE}
                      onChange={e => setVoucherForm({ ...voucherForm, VALIDADE: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status Inicial</label>
                    <select
                      value={voucherForm.STATUS}
                      onChange={e => setVoucherForm({ ...voucherForm, STATUS: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50"
                    >
                      <option className="bg-slate-900" value="Ativo">Ativo (Pronto para Uso)</option>
                      <option className="bg-slate-900" value="Inativo">Inativo (Pausado)</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observações / Regras da Promoção</label>
                    <textarea
                      rows="2"
                      placeholder="Ex: Válido para compras acima de R$ 300, não cumulativo com outras promoções."
                      value={voucherForm.OBSERVACOES}
                      onChange={e => setVoucherForm({ ...voucherForm, OBSERVACOES: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* FORMULÁRIO DE CONTAS A RECEBER */}
              {activeTab === 'receber' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Descrição do Recebimento *</label>
                    <input required type="text" placeholder="Ex: Venda Óculos Completo OS #1042 - Parcela 1/2" value={receberForm.DESCRICAO} onChange={e => setReceberForm({...receberForm, DESCRICAO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valor (R$) *</label>
                    <input required type="text" placeholder="450,00" value={receberForm.VALOR} onChange={e => setReceberForm({...receberForm, VALOR: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-bold focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nome do Cliente (Sincronizado)</label>
                    <input 
                      list="datalist-clientes-receber"
                      type="text" 
                      placeholder="Ex: Yasmin Oliveira ou selecione..." 
                      value={receberForm.CLIENTE} 
                      onChange={e => setReceberForm({...receberForm, CLIENTE: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50" 
                    />
                    <datalist id="datalist-clientes-receber">
                      {clientsData && clientsData.map((c, idx) => {
                        const nome = c['Nome Completo'] || c['NOME'] || '';
                        const st = c['Status de Pagamento'] || 'Em dia';
                        const dev = c['Valor Devido'] || '0,00';
                        return <option key={idx} value={nome}>{`Status: ${st} | Devido: R$ ${dev}`}</option>;
                      })}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">OS / Nº Venda Relacionada</label>
                    <input type="text" placeholder="Ex: 1042" value={receberForm.VENDA_OS} onChange={e => setReceberForm({...receberForm, VENDA_OS: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data de Vencimento *</label>
                    <input required type="date" value={receberForm.DATA_VENCIMENTO} onChange={e => setReceberForm({...receberForm, DATA_VENCIMENTO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status do Recebimento</label>
                    <select value={receberForm.STATUS} onChange={e => setReceberForm({...receberForm, STATUS: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50">
                      <option className="bg-slate-900" value="Pendente">Pendente (A Receber)</option>
                      <option className="bg-slate-900" value="Recebido">Recebido / Liquidado</option>
                      <option className="bg-slate-900" value="Atrasado">Inadimplente / Atrasado</option>
                      <option className="bg-slate-900" value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Meio de Pagamento</label>
                    <select value={receberForm.MEIO_PAGAMENTO} onChange={e => setReceberForm({...receberForm, MEIO_PAGAMENTO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50">
                      <option className="bg-slate-900" value="Cartão de Crédito">Cartão de Crédito</option>
                      <option className="bg-slate-900" value="Cartão de Débito">Cartão de Débito</option>
                      <option className="bg-slate-900" value="Pix / Transferência">Pix / Transferência</option>
                      <option className="bg-slate-900" value="Boleto">Boleto</option>
                      <option className="bg-slate-900" value="Dinheiro">Dinheiro (Espécie)</option>
                      <option className="bg-slate-900" value="OS / A Definir">OS / A Definir</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data de Recebimento</label>
                    <input type="date" value={receberForm.DATA_RECEBIMENTO} onChange={e => setReceberForm({...receberForm, DATA_RECEBIMENTO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observações</label>
                    <textarea rows="2" placeholder="Ex: Detalhes ou notas sobre a parcela" value={receberForm.OBSERVACOES} onChange={e => setReceberForm({...receberForm, OBSERVACOES: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50" />
                  </div>
                </div>
              )}

              {/* FORMULÁRIO DE CONTAS A PAGAR */}
              {activeTab === 'pagar' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Descrição da Despesa / Conta *</label>
                    <input required type="text" placeholder="Ex: Compra de Lentes Lote Essilor #887, Aluguel Mês 07" value={pagarForm.DESCRICAO} onChange={e => setPagarForm({...pagarForm, DESCRICAO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valor (R$) *</label>
                    <input required type="text" placeholder="1.200,00" value={pagarForm.VALOR} onChange={e => setPagarForm({...pagarForm, VALOR: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-rose-400 font-bold focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoria</label>
                    <select value={pagarForm.CATEGORIA} onChange={e => setPagarForm({...pagarForm, CATEGORIA: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50">
                      <option className="bg-slate-900" value="Fornecedores de Lentes">Fornecedores de Lentes</option>
                      <option className="bg-slate-900" value="Fornecedores de Armações">Fornecedores de Armações</option>
                      <option className="bg-slate-900" value="Aluguel e Condomínio">Aluguel e Condomínio</option>
                      <option className="bg-slate-900" value="Salários e Comissões">Salários e Comissões</option>
                      <option className="bg-slate-900" value="Água, Luz e Internet">Água, Luz e Internet</option>
                      <option className="bg-slate-900" value="Marketing e Publicidade">Marketing e Publicidade</option>
                      <option className="bg-slate-900" value="Impostos e Taxas">Impostos e Taxas</option>
                      <option className="bg-slate-900" value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Fornecedor / Credor</label>
                    <input type="text" placeholder="Ex: Laboratório Óptico Central" value={pagarForm.FORNECEDOR} onChange={e => setPagarForm({...pagarForm, FORNECEDOR: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data de Vencimento *</label>
                    <input required type="date" value={pagarForm.DATA_VENCIMENTO} onChange={e => setPagarForm({...pagarForm, DATA_VENCIMENTO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status do Pagamento</label>
                    <select value={pagarForm.STATUS} onChange={e => setPagarForm({...pagarForm, STATUS: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50">
                      <option className="bg-slate-900" value="Pendente">Pendente (A Pagar)</option>
                      <option className="bg-slate-900" value="Pago">Pago / Liquidado</option>
                      <option className="bg-slate-900" value="Atrasado">Atrasado</option>
                      <option className="bg-slate-900" value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Data de Pagamento</label>
                    <input type="date" value={pagarForm.DATA_PAGAMENTO} onChange={e => setPagarForm({...pagarForm, DATA_PAGAMENTO: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observações / NF</label>
                    <input type="text" placeholder="Ex: NF-e 4492" value={pagarForm.OBSERVACOES} onChange={e => setPagarForm({...pagarForm, OBSERVACOES: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-sky-500/25 transition-all text-sm"
                >
                  Confirmar &amp; Salvar
                </button>
              </div>
            </form>
          </motion.div>
        ) : activeTab === 'fluxo_caixa' ? (
          <motion.div
            key="fluxo_caixa"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <History size={20} className="text-purple-400" />
                <span>Auditoria &amp; Fluxo de Caixa Integrado Multi-Lojas</span>
              </h3>
              <span className="text-xs text-slate-400 font-bold">
                Cajati · Registro · Jacupiranga · Venda Externa
              </span>
            </div>
            <CashHistoryContent
              cashMovements={data?.['FLUXO_CAIXA'] || []}
              salesData={data?.['Registro_Vendas'] || data?.['BD MARKETING'] || []}
              defaultUnit="Todas"
            />
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-card p-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                {activeTab === 'lentes' && <><Eye size={18} className="text-sky-400" /> Catálogo de Lentes em Estoque</>}
                {activeTab === 'armacoes' && <><Glasses size={18} className="text-fuchsia-400" /> Catálogo de Armações em Estoque</>}
                {activeTab === 'brindes' && <><Gift size={18} className="text-pink-400" /> Catálogo de Brindes &amp; Cortesias em Estoque</>}
                {activeTab === 'receber' && <><TrendingUp size={18} className="text-emerald-400" /> Tabela de Contas a Receber</>}
                {activeTab === 'pagar' && <><TrendingDown size={18} className="text-rose-400" /> Tabela de Contas a Pagar</>}
                {activeTab === 'transferencias' && <><Truck size={18} className="text-indigo-400" /> Registro e Auditoria de Transferências de Estoque</>}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {(activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') && (
                  <button
                    onClick={() => setIsStockFilterModalOpen(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-black rounded-xl transition-all shadow-sm active:scale-95 ${
                      appliedStockFilter
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300 hover:text-white'
                    }`}
                    title={`Filtros e Relatórios de Estoque (${activeTab === 'armacoes' ? 'Armações' : activeTab === 'brindes' ? 'Brindes' : 'Lentes'})`}
                  >
                    <Filter size={14} className="text-emerald-400" />
                    <span>Filtros de Estoque</span>
                    {appliedStockFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                )}

                {(appliedStockFilter || filterCriticalStock) && (activeTab === 'lentes' || activeTab === 'armacoes' || activeTab === 'brindes') && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/15 to-emerald-500/15 border border-sky-500/30 text-sky-200 text-xs font-black shadow-sm">
                    <Filter size={14} className="text-sky-400 shrink-0" />
                    <span>
                      {appliedStockFilter ? appliedStockFilter.label : activeTab === 'brindes' ? 'Estoque Crítico (≤ 5 un)' : 'Estoque Crítico (≤ 2 un)'}
                    </span>
                    <button
                      onClick={() => setIsStockFilterModalOpen(true)}
                      className="ml-1 text-slate-300 hover:text-white underline text-[11px]"
                    >
                      Alterar
                    </button>
                    <button
                      onClick={() => {
                        setAppliedStockFilters(prev => ({ ...prev, [activeTab]: null }));
                        setFilterCriticalStock(false);
                      }}
                      className="ml-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition-colors"
                      title="Limpar e exibir estoque completo"
                    >
                      Limpar ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <DataTable
              sheetName={getSheetName()}
              rows={currentTabRows}
              onRowUpdate={handleRowUpdateWithSync}
              onDeleteRow={onDeleteRow}
              onViewInstallments={activeTab === 'receber' ? handleViewInstallments : undefined}
              onViewVoucherUsage={activeTab === 'vouchers' ? handleViewVoucherUsage : undefined}
              currentUser={currentUser}
              showPrintLabel={activeTab === 'armacoes' || activeTab === 'lentes' || activeTab === 'brindes'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Transferência de Produtos entre Lojas */}
      <ProductTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        data={data}
        currentUser={currentUser}
        onTransferComplete={handleTransferComplete}
      />

      {/* Modal de Impressão de Etiquetas Térmicas (50x30mm) */}
      <PrintableLabelModal
        isOpen={Boolean(labelModalItem)}
        onClose={() => setLabelModalItem(null)}
        data={labelModalItem}
        defaultType="armacao"
      />

      {/* Modal de Filtros Inteligentes & Relatórios de Estoque */}
      <StockFilterModal
        isOpen={isStockFilterModalOpen}
        onClose={() => setIsStockFilterModalOpen(false)}
        type={activeTab === 'armacoes' ? 'armacoes' : activeTab === 'brindes' ? 'brindes' : 'lentes'}
        items={activeTab === 'armacoes' ? armacoesData : activeTab === 'brindes' ? brindesData : lentesData}
        salesData={salesData}
        activeFilter={appliedStockFilter}
        onApplyFilter={(filterConfig) => {
          setAppliedStockFilters(prev => ({ ...prev, [activeTab]: filterConfig }));
          setFilterCriticalStock(false);
        }}
        currentUser={currentUser}
      />

      {/* Modal de Mensalidades do Cliente */}
      <ClientInstallmentsModal
        isOpen={Boolean(clientInstallmentsInfo)}
        onClose={() => setClientInstallmentsInfo(null)}
        clientName={clientInstallmentsInfo?.clientName}
        rows={(data['CONTAS_RECEBER'] || []).filter(r => {
          if (!clientInstallmentsInfo) return false;
          if (clientInstallmentsInfo.clientId && (r.CLIENTE_ID === clientInstallmentsInfo.clientId || r.cliente_id === clientInstallmentsInfo.clientId)) return true;
          if (clientInstallmentsInfo.clientCpf && (r.CLIENTE_CPF === clientInstallmentsInfo.clientCpf || r.cliente_cpf === clientInstallmentsInfo.clientCpf || r.CPF === clientInstallmentsInfo.clientCpf || r.cpf === clientInstallmentsInfo.clientCpf)) return true;
          const rName = r.CLIENTE || r.cliente || r.NOME || r.Nome || r['NOME DO CLIENTE'];
          if (clientInstallmentsInfo.clientName && clientInstallmentsInfo.clientName !== 'Cliente Desconhecido' && rName === clientInstallmentsInfo.clientName) return true;
          return false;
        }).sort((a, b) => {
          // Sort by VENCIMENTO
          const dateA = a.DATA_VENCIMENTO || a['DATA VENCIMENTO'] || a.VENCIMENTO;
          const dateB = b.DATA_VENCIMENTO || b['DATA VENCIMENTO'] || b.VENCIMENTO;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateA) - new Date(dateB);
        })}
        onRowUpdate={handleRowUpdateWithSync}
        onDeleteRow={onDeleteRow}
        currentUser={currentUser}
      />

      {/* Modal Quem Usou / Histórico de Uso do Voucher */}
      {voucherUsageModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-card bg-slate-900/95 border border-amber-500/30 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Cabeçalho */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Ticket size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      Histórico de Uso — Quem Usou
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {voucherUsageModalItem.CODIGO || voucherUsageModalItem.codigo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {voucherUsageModalItem.NOME || voucherUsageModalItem.nome || 'Campanha Promocional'} • Unidade: {voucherUsageModalItem.UNIDADE || 'Todas'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoucherUsageModalItem(null)}
                className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo / Conteúdo */}
            <div className="p-5 overflow-y-auto space-y-4 erp-scroll">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Tipo Desconto</span>
                  <p className="text-sm font-black text-amber-400">
                    {voucherUsageModalItem.TIPO_DESCONTO === 'PORCENTAGEM' ? `${voucherUsageModalItem.VALOR_DESCONTO}% OFF` : `R$ ${voucherUsageModalItem.VALOR_DESCONTO} OFF`}
                  </p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Limite de Usos</span>
                  <p className="text-sm font-black text-white">
                    {voucherUsageModalItem.QUANTIDADE_TOTAL || 'Ilimitado'}
                  </p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Total Utilizado</span>
                  <p className="text-sm font-black text-sky-400">
                    {voucherUsageModalItem.QUANTIDADE_USADA || voucherUsageModalItem.quantidade_usada || 0} resgates
                  </p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Status</span>
                  <p className={`text-sm font-black ${(voucherUsageModalItem.STATUS || '').toLowerCase() === 'ativo' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {voucherUsageModalItem.STATUS || 'Ativo'}
                  </p>
                </div>
              </div>

              {/* Tabela de Clientes que Usaram */}
              {(() => {
                const rawH = voucherUsageModalItem.HISTORICO_USO || voucherUsageModalItem.usos_json || voucherUsageModalItem.historico_uso;
                let parsed = [];
                try {
                  if (typeof rawH === 'string') parsed = JSON.parse(rawH);
                  else if (Array.isArray(rawH)) parsed = rawH;
                } catch(e) {}
                if (!Array.isArray(parsed)) parsed = [];

                // Reconciliação com salesData para vouchers utilizados em vendas prévias
                const codeUpper = String(voucherUsageModalItem.CODIGO || voucherUsageModalItem.codigo || '').trim().toUpperCase();
                if (codeUpper && Array.isArray(salesData)) {
                  salesData.forEach(sale => {
                    const saleVoucher = String(sale['VOUCHER'] || sale.voucher || '').toUpperCase();
                    if (saleVoucher && saleVoucher.includes(codeUpper)) {
                      const saleClient = sale['NOME CLIENTE'] || sale['CLIENTE'] || sale['NOME'] || 'Cliente';
                      const alreadyIn = parsed.some(p => p.cliente === saleClient || (sale['OS DA VENDA'] && p.os === sale['OS DA VENDA']));
                      if (!alreadyIn) {
                        parsed.push({
                          cliente: saleClient,
                          cpf: sale['CPF'] || sale['CLIENTE_CPF'] || '',
                          dataHora: sale['DATA'] || sale['DATA  DA VENDA'] || '---',
                          os: sale['OS DA VENDA'] || sale['OS'] || 'Balcão',
                          valorDesconto: parseCurrency(sale['DESCONTO_VOUCHER'] || sale.descontoVoucher || voucherUsageModalItem.VALOR_DESCONTO)
                        });
                      }
                    }
                  });
                }

                if (parsed.length === 0) {
                  return (
                    <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                      <Sparkles size={32} className="mx-auto text-slate-500" />
                      <p className="text-sm font-bold text-slate-300">Nenhum resgate registrado ainda</p>
                      <p className="text-xs text-slate-500">Este voucher ainda não foi utilizado em nenhuma venda finalizada no PDV.</p>
                    </div>
                  );
                }

                const totalDesconto = parsed.reduce((acc, u) => acc + (parseCurrency(u.valorDesconto) || 0), 0);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                      <span>{parsed.length} resgate(s) registrado(s):</span>
                      <span className="text-emerald-400 font-black">
                        Total de Descontos Concedidos: R$ {parseCurrency(totalDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 bg-white/5 font-black">
                            <th className="py-3 px-4">#</th>
                            <th className="py-3 px-4">Cliente</th>
                            <th className="py-3 px-4">CPF</th>
                            <th className="py-3 px-4">Data / Horário</th>
                            <th className="py-3 px-4">OS / Venda</th>
                            <th className="py-3 px-4 text-right">Desconto Aplicado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-medium">
                          {parsed.map((uso, idx) => (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-3 px-4 text-white font-bold">{uso.cliente || 'Cliente'}</td>
                              <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{uso.cpf || '—'}</td>
                              <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{uso.dataHora || '—'}</td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded">
                                  {uso.os || 'PDV'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-emerald-400">
                                R$ {parseCurrency(uso.valorDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Rodapé */}
            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
              <button
                type="button"
                onClick={() => setVoucherUsageModalItem(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ErpOptica;
