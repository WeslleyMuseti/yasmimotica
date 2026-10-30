import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart, User, Search, Plus, Trash2, CheckCircle2,
  Printer, DollarSign, CreditCard, QrCode, FileText,
  Package, AlertTriangle, ArrowRight, Eye, ChevronDown,
  Sparkles, RefreshCw, X, ShieldCheck, Calendar, Phone,
  UserPlus, ClipboardList, Glasses, Layers, Tag, Check,
  Lock, Unlock, ArrowDownRight, ArrowUpRight, Building, Wallet, History, Receipt,
  Ticket, Percent, AlertOctagon, Star, Gift, Loader2, Info, Clock
} from 'lucide-react';
import PrintableOS from './PrintableOS';
import PrintableReceipt from './PrintableReceipt';
import OSGeneratorModal from './OSGeneratorModal';
import CashManagementModal, { PrintableCashVoucher, parseItemDate } from './CashManagementModal';
import CashHistoryModal from './CashHistoryModal';
import PrintableCashClosingReport from './PrintableCashClosingReport';
import { PrintableLabelModal } from './PrintableLabel';
import { decrementStockAtomically, isSameClient } from '../firebaseSync';

const cleanVal = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let str = String(v).replace(/R\$\s?/g, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
      str = parts.join('');
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const fmtMoeda = (v) => `R$ ${Number(cleanVal(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseCurrency = cleanVal;

const withTimeout = (promise, ms = 2500) => {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(promise);
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de sincronização do banco')), ms))
  ]);
};

const POSRegister = ({
  data = {},
  setData,
  clientsData = [],
  salesData = [],
  armacoesData = [],
  lentesData = [],
  receberData = [],
  currentUser,
  onAddSale,
  onAddClient,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onAddBatch,
  onNavigateToNewClient,
  onNavigateToERP,
  onBack
}) => {
  // ─── ESTADOS PRINCIPAIS ──────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');

  // Modal de Cadastro Rápido de Cliente (sem sair do PDV e sem perder o carrinho)
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({
    nome: '',
    cpf: '',
    whatsapp: '',
    cidade: '',
    odEsf: '',
    oeEsf: '',
    medico: ''
  });
  const [quickClientError, setQuickClientError] = useState('');
  const [isSavingQuickClient, setIsSavingQuickClient] = useState(false);

  // Carrinho de Compras
  const [cart, setCart] = useState([]);
  const [mobileTab, setMobileTab] = useState('produtos'); // 'produtos' | 'carrinho'
  const [productCategory, setProductCategory] = useState('armacoes'); // 'mais_vendidos', 'armacoes', 'lentes', 'todos', 'avulso'
  const [productSearch, setProductSearch] = useState('');
  const [selectedCityStock, setSelectedCityStock] = useState('TODAS');

  // Item Avulso
  const [customItem, setCustomItem] = useState({ nome: '', preco: '', qtd: 1, categoria: 'Outros' });

  // Desconto Global & Vouchers
  const [discountInput, setDiscountInput] = useState('');
  const discount = useMemo(() => cleanVal(discountInput), [discountInput]);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVouchers, setAppliedVouchers] = useState([]);
  const [voucherError, setVoucherError] = useState('');

  const vouchersData = useMemo(() => data?.['VOUCHERS'] || [], [data]);

  // ─── SISTEMA DE PAGAMENTO ────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [currentMethod, setCurrentMethod] = useState('dinheiro'); // 'dinheiro', 'pix', 'debito', 'credito', 'carne'
  const [currentStage, setCurrentStage] = useState('entrada'); // 'entrada' | 'restante'
  const [paymentInputVal, setPaymentInputVal] = useState('');
  const [payInstallments, setPayInstallments] = useState(1);
  const [payFirstDueDate, setPayFirstDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [customDueDates, setCustomDueDates] = useState({});
  const [cashTendered, setCashTendered] = useState('');
  const [posSaleDate, setPosSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [posSaleTime, setPosSaleTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const getInstallmentDate = (firstDateStr, offset) => {
    if (!firstDateStr) {
      const d = new Date();
      d.setDate(d.getDate() + 30 * (offset + 1));
      return d.toISOString().split('T')[0];
    }
    const parts = firstDateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setMonth(d.getMonth() + offset);
      return d.toISOString().split('T')[0];
    }
    return firstDateStr;
  };

  // Estado de Sucesso / Pós-Venda
  const [completedSale, setCompletedSale] = useState(null);
  const [savedClientForOS, setSavedClientForOS] = useState(null);
  const [isFinalizingSale, setIsFinalizingSale] = useState(false);

  // Modal de Geração de OS
  const [isOSModalOpen, setIsOSModalOpen] = useState(false);
  const [osPrintData, setOsPrintData] = useState(null);
  const [receiptPrintData, setReceiptPrintData] = useState(null);

  // ─── GESTÃO DE FLUXO DE CAIXA, TURNOS & SANGRIA ──────────────────
  const isVendor = currentUser?.role === 'vendedor';
  const isExternalVendor = isVendor && (
    String(currentUser?.city || currentUser?.assignedStore || '').trim().toLowerCase().includes('extern') ||
    String(currentUser?.role || '').trim().toLowerCase().includes('extern')
  );

  const isProductFromVendaExterna = (item) => {
    if (!item) return false;
    const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.Unidade || item.unidade || '').trim().toLowerCase();
    return u.includes('extern');
  };
  // Se for vendedor de loja fixa, fica travado na unidade. Se for Vendedor Externo (ou admin), pode selecionar a loja livremente no PDV!
  const userFixedCity = (isVendor && !isExternalVendor) ? (currentUser?.city || currentUser?.assignedStore || null) : null;

  const [selectedPOSCity, setSelectedPOSCity] = useState(() => {
    return userFixedCity || (isExternalVendor ? 'Venda Externa' : (currentUser?.city || currentUser?.assignedStore || 'Cajati'));
  });

  useEffect(() => {
    if (userFixedCity) {
      setSelectedPOSCity(userFixedCity);
    }
  }, [userFixedCity]);

  const [cashModalState, setCashModalState] = useState({ isOpen: false, type: 'ABERTURA' });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [cashVoucherPrintData, setCashVoucherPrintData] = useState(null);
  const [cashClosingPdfData, setCashClosingPdfData] = useState(null);

  const handleTriggerCashPrint = (voucher) => {
    setOsPrintData(null);
    setReceiptPrintData(null);
    if (voucher && voucher.type === 'PDF_REPORT') {
      setCashVoucherPrintData(null);
      setCashClosingPdfData(voucher);
    } else {
      setCashClosingPdfData(null);
      setCashVoucherPrintData(voucher);
    }
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const cashMovements = useMemo(() => {
    return data?.['FLUXO_CAIXA'] || [];
  }, [data]);

  const activeSession = useMemo(() => {
    const cityMovements = [...cashMovements]
      .filter(m => m.unidade === selectedPOSCity)
      .sort((a, b) => {
        const da = parseItemDate(a)?.getTime() || 0;
        const db = parseItemDate(b)?.getTime() || 0;
        return da - db;
      });

    let currentOpen = null;
    cityMovements.forEach(m => {
      if (m.tipo === 'ABERTURA') {
        currentOpen = {
          unidade: m.unidade,
          operador: m.operador,
          fundoInicial: cleanVal(m.valor),
          dataHoraAbertura: m.dataHora || m.timestamp,
          timestamp: m.dataHora || m.timestamp
        };
      } else if (m.tipo === 'FECHAMENTO') {
        currentOpen = null;
      }
    });

    return currentOpen;
  }, [cashMovements, selectedPOSCity]);

  const liveDrawerCash = useMemo(() => {
    if (!activeSession) return 0;
    const sessionStart = parseItemDate({ dataHora: activeSession.dataHoraAbertura || activeSession.timestamp }) || new Date(0);
    const movements = cashMovements.filter(m => {
      if (m.unidade !== selectedPOSCity) return false;
      const mDate = parseItemDate(m);
      if (!mDate) return false;
      return mDate >= sessionStart;
    });

    let saldo = activeSession.fundoInicial || 0;
    movements.forEach(m => {
      const v = cleanVal(m.valor);
      const fp = String(m.formaPagamento || '').toUpperCase();
      const tipo = String(m.tipo || '').toUpperCase();
      if (tipo === 'SUPRIMENTO') saldo += v;
      else if (tipo === 'SANGRIA') saldo -= v;
      else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'PAGAMENTO') saldo -= v;
      else if (tipo === 'RECEBIMENTO' && (fp.includes('DINHEIRO') || !fp)) {
        saldo += v;
      } else if (tipo === 'VENDA' && fp.includes('DINHEIRO')) {
        saldo += v;
      }
    });
    return Math.max(0, saldo);
  }, [activeSession, cashMovements, selectedPOSCity]);

  const handleOpenCash = async (openData) => {
    if (onAddRow) {
      const dtIso = openData.dataHoraAbertura || openData.dataHora || new Date().toISOString();
      const dtObj = new Date(dtIso);
      const dtFormatted = openData.data || dtObj.toLocaleDateString('pt-BR');
      const dtTime = openData.hora || openData.HORA || dtObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dtDateTime = openData.DATA_HORA || dtObj.toLocaleString('pt-BR');
      await onAddRow('FLUXO_CAIXA', {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tipo: 'ABERTURA',
        dataHora: dtIso,
        dataHoraAbertura: dtIso,
        timestamp: dtObj.getTime(),
        DATA_HORA: dtDateTime,
        data: dtFormatted,
        DATA: dtFormatted,
        hora: dtTime,
        HORA: dtTime,
        unidade: openData.unidade,
        operador: openData.operador,
        valor: openData.fundoInicial,
        formaPagamento: 'DINHEIRO',
        motivo: 'Abertura de Caixa (Fundo de Troco)',
        detalhes: openData.observacoes || ''
      });
    }
  };

  const handleAddSangria = async (sangriaData) => {
    if (onAddRow) {
      const dtIso = sangriaData.dataHora || new Date().toISOString();
      const dtObj = new Date(dtIso);
      const dtFormatted = sangriaData.data || dtObj.toLocaleDateString('pt-BR');
      const dtTime = sangriaData.hora || sangriaData.HORA || dtObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dtDateTime = sangriaData.DATA_HORA || dtObj.toLocaleString('pt-BR');
      await onAddRow('FLUXO_CAIXA', {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tipo: 'SANGRIA',
        dataHora: dtIso,
        timestamp: dtObj.getTime(),
        DATA_HORA: dtDateTime,
        data: dtFormatted,
        DATA: dtFormatted,
        hora: dtTime,
        HORA: dtTime,
        unidade: sangriaData.unidade,
        operador: sangriaData.operador,
        valor: sangriaData.valor,
        formaPagamento: 'DINHEIRO',
        motivo: sangriaData.motivo,
        detalhes: sangriaData.detalhes || ''
      });

      // Se for despesa da loja, cria lançamento no CONTAS_PAGAR
      if (sangriaData.motivo === 'Pagamento de Despesa Local' || sangriaData.despesaCategoria) {
        await onAddRow('CONTAS_PAGAR', {
          'DESPESA': sangriaData.detalhes || sangriaData.motivo,
          'CATEGORIA': sangriaData.despesaCategoria || 'Despesa de Caixa',
          'VALOR': sangriaData.valor,
          'DATA': dtFormatted,
          'dataHora': dtIso,
          'timestamp': dtObj.getTime(),
          'DATA_HORA': dtDateTime,
          'hora': dtTime,
          'HORA': dtTime,
          'STATUS': 'Pago',
          'CIDADE': sangriaData.unidade,
          'OBSERVAÇÕES': `Sangria de Caixa realizada por ${sangriaData.operador}`
        });
      }
    }
  };

  const handleAddSuprimento = async (suprimentoData) => {
    if (onAddRow) {
      const dtIso = suprimentoData.dataHora || new Date().toISOString();
      const dtObj = new Date(dtIso);
      const dtFormatted = suprimentoData.data || dtObj.toLocaleDateString('pt-BR');
      const dtTime = suprimentoData.hora || suprimentoData.HORA || dtObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dtDateTime = suprimentoData.DATA_HORA || dtObj.toLocaleString('pt-BR');
      await onAddRow('FLUXO_CAIXA', {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tipo: 'SUPRIMENTO',
        dataHora: dtIso,
        timestamp: dtObj.getTime(),
        DATA_HORA: dtDateTime,
        data: dtFormatted,
        DATA: dtFormatted,
        hora: dtTime,
        HORA: dtTime,
        unidade: suprimentoData.unidade,
        operador: suprimentoData.operador,
        valor: suprimentoData.valor,
        formaPagamento: 'DINHEIRO',
        motivo: suprimentoData.motivo
      });
    }
  };

  const handleCloseCash = async (closeData) => {
    if (onAddRow) {
      const dtIso = closeData.dataHoraFechamento || closeData.dataHora || new Date().toISOString();
      const dtObj = new Date(dtIso);
      const dtFormatted = closeData.data || dtObj.toLocaleDateString('pt-BR');
      const dtTime = closeData.hora || closeData.HORA || dtObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dtDateTime = closeData.DATA_HORA || dtObj.toLocaleString('pt-BR');
      await onAddRow('FLUXO_CAIXA', {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tipo: 'FECHAMENTO',
        dataHora: dtIso,
        dataHoraFechamento: dtIso,
        timestamp: dtObj.getTime(),
        DATA_HORA: dtDateTime,
        dataFechamento: dtDateTime,
        data: dtFormatted,
        DATA: dtFormatted,
        hora: dtTime,
        HORA: dtTime,
        unidade: closeData.unidade,
        operador: closeData.operador,
        valor: closeData.dinheiroContado,
        fundoInicial: closeData.fundoInicial,
        totalVendas: closeData.totalVendas,
        dinheiroEsperado: closeData.dinheiroEsperado,
        diferenca: closeData.diferenca,
        status: closeData.status,
        formaPagamento: 'TODAS',
        motivo: `Fechamento de Caixa - ${closeData.status}`,
        detalhes: closeData.observacoes || ''
      });
    }
  };

  // ─── FONTES DE DADOS DO ESTOQUE ERP (Visível para todas as lojas) ─────────
  const erpArmacoes = useMemo(() => {
    return data?.['CAD_ARMACOES'] || armacoesData || [];
  }, [data, armacoesData]);

  const erpLentes = useMemo(() => {
    return data?.['CAD_LENTES'] || lentesData || [];
  }, [data, lentesData]);

  const erpGeral = useMemo(() => {
    return data?.['ESTOQUE'] || data?.['ESTOQUE ENTRADA SAÍDAS'] || [];
  }, [data]);

  const erpBrindes = useMemo(() => {
    return data?.['CAD_BRINDES'] || [];
  }, [data]);

  const erpAcessorios = useMemo(() => {
    return data?.['CAD_ACESSORIOS'] || [];
  }, [data]);

  // ─── FILTROS DE CLIENTES ─────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!clientSearch) return [];
    const q = clientSearch.toLowerCase();
    return clientsData.filter(c => {
      return (
        (c['Nome Completo'] && c['Nome Completo'].toLowerCase().includes(q)) ||
        (c['NOME'] && c['NOME'].toLowerCase().includes(q)) ||
        (c['CPF / CNPJ'] && c['CPF / CNPJ'].includes(q)) ||
        (c['WhatsApp'] && c['WhatsApp'].includes(q))
      );
    });
  }, [clientSearch, clientsData]);

  // ─── ANÁLISE FINANCEIRA E ALERTA DE INADIMPLÊNCIA DO CLIENTE NO PDV ────
  const selectedClientFinancials = useMemo(() => {
    if (!selectedClient) return null;
    const clientInvoices = (receberData || []).filter(inv => isSameClient(selectedClient, inv));
    let totalAberto = 0;
    let totalVencido = 0;
    let hasOverdue = false;
    const todayStr = new Date().toISOString().split('T')[0];

    clientInvoices.forEach(inv => {
      const val = cleanVal(inv.VALOR || inv.valor || 0);
      const st = String(inv.STATUS || inv.status || 'Pendente').trim();
      const isPaid = st === 'Recebido' || st === 'Pago';
      const dtVenc = String(inv.DATA_VENCIMENTO || inv['DATA VENCIMENTO'] || inv.VENCIMENTO || '');

      if (!isPaid) {
        totalAberto += val;
        if (dtVenc && dtVenc < todayStr) {
          hasOverdue = true;
          totalVencido += val;
        }
      }
    });

    if (clientInvoices.length === 0) {
      totalAberto = cleanVal(selectedClient['Valor Devido'] || selectedClient['VALOR DEVIDO'] || 0);
      if (String(selectedClient['Status de Pagamento'] || '').toLowerCase() === 'inadimplente') {
        hasOverdue = true;
        totalVencido = totalAberto;
      }
    }

    const isInadimplente = hasOverdue || String(selectedClient['Status de Pagamento'] || '').toLowerCase() === 'inadimplente';

    // Auditoria de Inadimplência do Responsável Legal (se houver)
    let respFinancials = null;
    const respName = String(selectedClient['Responsável Nome'] || selectedClient['Responsável'] || '').trim();
    const respCpf = String(selectedClient['Responsável CPF'] || '').replace(/\D/g, '');

    if (respName || respCpf) {
      const clean = (str) => String(str || '').toLowerCase().trim();
      const cleanDigits = (str) => String(str || '').replace(/\D/g, '');

      const respInvoices = (receberData || []).filter(inv => {
        const invCpf = cleanDigits(inv.CPF || inv.cpf || inv['CPF / CNPJ']);
        if (respCpf && invCpf && invCpf === respCpf) return true;
        const invClient = clean(inv.CLIENTE || inv.cliente || inv['Nome Completo']);
        if (respName && invClient && invClient === clean(respName)) return true;
        return false;
      });

      let respAberto = 0;
      let respVencido = 0;
      let respHasOverdue = false;

      respInvoices.forEach(inv => {
        const val = cleanVal(inv.VALOR || inv.valor || 0);
        const st = String(inv.STATUS || inv.status || 'Pendente').trim();
        const isPaid = st === 'Recebido' || st === 'Pago';
        const dtVenc = String(inv.DATA_VENCIMENTO || inv['DATA VENCIMENTO'] || inv.VENCIMENTO || '');

        if (!isPaid) {
          respAberto += val;
          if (dtVenc && dtVenc < todayStr) {
            respHasOverdue = true;
            respVencido += val;
          }
        }
      });

      if (respInvoices.length === 0 && Array.isArray(clientsData) && clientsData.length > 0) {
        const respClient = clientsData.find(c => {
          const cCpf = cleanDigits(c['CPF'] || c['cpf']);
          if (respCpf && cCpf && cCpf === respCpf) return true;
          const cName = clean(c['Nome Completo'] || c['NOME']);
          if (respName && cName && cName === clean(respName)) return true;
          return false;
        });
        if (respClient) {
          const dev = cleanVal(respClient['Valor Devido'] || respClient['VALOR DEVIDO'] || 0);
          if (dev > 0 || String(respClient['Status de Pagamento'] || '').toLowerCase().includes('inadimplente')) {
            respAberto = dev;
            respVencido = dev;
            respHasOverdue = true;
          }
        }
      }

      if (respAberto > 0 || respHasOverdue) {
        respFinancials = {
          respName: respName || 'Responsável Legal',
          respCpf: respCpf ? respCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '',
          totalAberto: respAberto,
          totalVencido: respVencido > 0 ? respVencido : respAberto,
          isInadimplente: true,
          countInvoices: respInvoices.length
        };
      }
    }

    return {
      totalAberto,
      totalVencido: totalVencido > 0 ? totalVencido : (isInadimplente ? totalAberto : 0),
      isInadimplente,
      countInvoices: clientInvoices.length,
      respFinancials
    };
  }, [selectedClient, receberData, clientsData]);

  // ─── MAPA DE MAIS VENDIDOS (CROSS-REFERENCE COM VENDAS DO ERP) ────────
  const salesCountMap = useMemo(() => {
    const map = {};
    (salesData || []).forEach(sale => {
      const p = String(sale['PRODUTO'] || sale['ARMAÇÃO'] || sale['MODELO'] || '').toLowerCase();
      if (p) {
        map[p] = (map[p] || 0) + 1;
      }
    });
    return map;
  }, [salesData]);

  // ─── FILTROS DO CATÁLOGO DE PRODUTOS ──────────────────────────────
  const filteredProducts = useMemo(() => {
    let source = [];
    if (productCategory === 'armacoes') {
      source = erpArmacoes.map(i => ({ ...i, _type: 'armacoes' }));
    } else if (productCategory === 'lentes') {
      source = erpLentes.map(i => ({ ...i, _type: 'lentes' }));
    } else if (productCategory === 'brindes') {
      source = erpBrindes.map(i => ({ ...i, _type: 'brindes' }));
    } else if (productCategory === 'acessorios') {
      source = erpAcessorios.map(i => ({ ...i, _type: 'acessorios' }));
    } else if (productCategory === 'geral') {
      source = erpGeral.map(i => ({ ...i, _type: 'geral' }));
    } else if (productCategory === 'mais_vendidos') {
      const all = [
        ...erpArmacoes.map(i => ({ ...i, _type: 'armacoes' })),
        ...erpLentes.map(i => ({ ...i, _type: 'lentes' })),
        ...erpAcessorios.map(i => ({ ...i, _type: 'acessorios' }))
      ];
      source = all.sort((a, b) => {
        const textA = String(a['MODELO'] || a['MARCA'] || a['PRODUTO'] || '').toLowerCase();
        const textB = String(b['MODELO'] || b['MARCA'] || b['PRODUTO'] || '').toLowerCase();
        const countA = salesCountMap[textA] || 0;
        const countB = salesCountMap[textB] || 0;
        return countB - countA;
      });
    } else if (productCategory === 'todos') {
      source = [
        ...erpArmacoes.map(i => ({ ...i, _type: 'armacoes' })),
        ...erpLentes.map(i => ({ ...i, _type: 'lentes' })),
        ...erpAcessorios.map(i => ({ ...i, _type: 'acessorios' })),
        ...erpBrindes.map(i => ({ ...i, _type: 'brindes' })),
        ...erpGeral.map(i => ({ ...i, _type: 'geral' }))
      ];
    }

    const q = productSearch.toLowerCase().trim();
    const effectiveCityFilter = selectedCityStock !== 'TODAS' ? selectedCityStock : null;

    return source.filter(item => {
      if (effectiveCityFilter) {
        const itemUnit = String(item['UNIDADE'] || item['CIDADE'] || item['LOJA'] || item['Unidade'] || '').trim().toUpperCase();
        if (itemUnit && !itemUnit.includes(effectiveCityFilter.toUpperCase())) {
          return false;
        }
      }
      if (!q) return true;
      const text = Object.values(item).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [productCategory, erpArmacoes, erpLentes, erpAcessorios, erpBrindes, erpGeral, salesCountMap, productSearch, selectedCityStock]);

  // ─── OPERAÇÕES DO CARRINHO ───────────────────────────────────────
  const addToCart = (product, type) => {
    const rawStock = product['ESTOQUE'] !== undefined ? product['ESTOQUE'] : (product['EM ESTOQUE'] !== undefined ? product['EM ESTOQUE'] : (product['estoque'] !== undefined ? product['estoque'] : product['QTD']));
    const stockAvailable = parseInt(rawStock !== undefined && rawStock !== '' ? rawStock : 999, 10);

    // 🛡️ Regra: Vendedores (internos e externos) não podem selecionar produtos com estoque zerado ou esgotado (<= 0)
    if (isVendor && stockAvailable <= 0) {
      const prodName = `${product['MARCA'] || ''} ${product['MODELO'] || product['PRODUTO'] || product['NOME'] || 'Produto'}`.trim();
      alert(`⚠️ Item com Estoque Zerado!\n\nO produto "${prodName}" está esgotado (Estoque: 0 un).\n\nVendedores não têm permissão para adicionar produtos com estoque zerado no carrinho.`);
      return;
    }

    if (isExternalVendor && !isProductFromVendaExterna(product)) {
      const prodUnit = product['UNIDADE'] || product['CIDADE'] || product['LOJA'] || product['Unidade'] || 'Outra Loja';
      alert(`Inclusão não permitida para Vendedor Externo:\n\nEste produto pertence ao estoque da unidade "${prodUnit}".\n\nVendedores externos podem consultar produtos de todas as lojas, porém só têm permissão para adicionar produtos que pertençam ao estoque de "Venda Externa".\n\nCaso o cliente deseje este item, solicite a transferência do produto para Venda Externa no ERP.`);
      return;
    }

    const effectiveType = type || product._type || (product['CATEGORIA'] && !product['MARCA'] ? 'brindes' : product['LENTE'] ? 'lentes' : (product['COR'] || product['MODELO'] ? 'armacoes' : 'geral'));
    const id = product.id || `${effectiveType}_${product['MARCA'] || ''}_${product['MODELO'] || ''}_${product['REFERENCIA_SKU'] || ''}_${product['NOME'] || ''}_${product['LENTE'] || ''}`;
    
    let name = 'Produto';
    let details = '';

    if (effectiveType === 'armacoes') {
      name = `${product['MARCA'] || ''} ${product['MODELO'] || product['PRODUTO'] || 'Armação'}`.trim();
      const extra = [];
      if (product['REFERENCIA_SKU']) extra.push(`Ref: ${product['REFERENCIA_SKU']}`);
      if (product['COR']) extra.push(`Cor: ${product['COR']}`);
      if (product['UNIDADE']) extra.push(`Loja: ${product['UNIDADE']}`);
      details = extra.join(' | ');
    } else if (effectiveType === 'lentes') {
      name = `${product['MARCA'] || ''} ${product['MODELO'] || product['LENTE'] || product['PRODUTO'] || 'Lente'}`.trim();
      const extra = [];
      if (product['MATERIAL']) extra.push(product['MATERIAL']);
      if (product['INDICE_REFRACAO']) extra.push(`Índice: ${product['INDICE_REFRACAO']}`);
      if (product['TRATAMENTO']) extra.push(product['TRATAMENTO']);
      details = extra.join(' | ');
    } else if (effectiveType === 'acessorios') {
      name = `${product['MARCA'] ? product['MARCA'] + ' ' : ''}${product['NOME'] || product['MODELO'] || product['PRODUTO'] || 'Acessório'}`.trim();
      const extra = [];
      if (product['CATEGORIA']) extra.push(`Cat: ${product['CATEGORIA']}`);
      if (product['REFERENCIA_SKU']) extra.push(`Ref: ${product['REFERENCIA_SKU']}`);
      if (product['UNIDADE']) extra.push(`Loja: ${product['UNIDADE']}`);
      details = extra.join(' | ');
    } else if (effectiveType === 'brindes') {
      name = product['NOME'] || product['MODELO'] || product['PRODUTO'] || 'Brinde / Cortesia';
      const extra = [];
      if (product['CATEGORIA']) extra.push(`Cat: ${product['CATEGORIA']}`);
      if (product['COR']) extra.push(`Cor: ${product['COR']}`);
      if (product['REFERENCIA_SKU']) extra.push(`Ref: ${product['REFERENCIA_SKU']}`);
      if (product['UNIDADE']) extra.push(`Loja: ${product['UNIDADE']}`);
      details = extra.join(' | ');
    } else {
      name = product['PRODUTO'] || product['DESCRICAO'] || product['NOME'] || 'Produto do Estoque';
    }

    const price = cleanVal(product['PRECO_VENDA'] || product['VALOR'] || product['PRECO'] || product['VALOR UNITARIO'] || 0);

    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item => item.id === id ? { ...item, qtd: item.qtd + 1 } : item);
      }
      return [...prev, {
        id,
        rawProduct: product,
        type: effectiveType,
        nome: name,
        detalhes: details,
        imagem: product['IMAGEM'] || null,
        preco: price,
        qtd: 1,
        estoqueMax: stockAvailable
      }];
    });
  };

  const addCustomItemToCart = (e) => {
    e.preventDefault();
    if (!customItem.nome || !customItem.preco) return;
    const price = cleanVal(customItem.preco);
    setCart(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        type: 'avulso',
        nome: customItem.nome,
        detalhes: customItem.categoria || 'Serviço Avulso',
        preco: price,
        qtd: Number(customItem.qtd) || 1,
        categoria: customItem.categoria
      }
    ]);
    setCustomItem({ nome: '', preco: '', qtd: 1, categoria: 'Outros' });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qtd + delta;
        return newQty > 0 ? { ...item, qtd: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // ─── LEITOR DE CÓDIGO DE BARRAS USB AUTOMÁTICO ────────────────────
  const [barcodeToast, setBarcodeToast] = useState(null);
  const [labelModalData, setLabelModalData] = useState(null);

  const playScannerBeep = (isSuccess = true) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      if (isSuccess) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch (e) {
      // Audio context might be restricted prior to interaction
    }
  };

  useEffect(() => {
    if (barcodeToast) {
      const timer = setTimeout(() => setBarcodeToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [barcodeToast]);

  const handleBarcodeScanned = (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code || code.length < 2) return;

    const q = code.toUpperCase();

    const findMatch = (item) => {
      const sku = String(item['REFERENCIA_SKU'] || item['referencia_sku'] || item['REFERENCIA'] || item['referencia'] || item['Referência'] || item['CODIGO'] || item['codigo'] || item['SKU'] || item['sku'] || item['EAN'] || item['CODIGO_BARRAS'] || item.id || '').trim().toUpperCase();
      const modelo = String(item['NOME'] || item['nome'] || item['MODELO'] || item['modelo'] || item['PRODUTO'] || item['produto'] || item['DESCRICAO'] || item['descricao'] || '').trim().toUpperCase();
      const marca = String(item['MARCA'] || item['marca'] || '').trim().toUpperCase();
      const full = `${marca} ${modelo}`.trim().toUpperCase();

      if (sku && (sku === q || sku.replace(/\D/g, '') === q.replace(/\D/g, ''))) return true;
      if (sku && (sku.includes(q) || q.includes(sku)) && (sku.length >= 4 || q.length >= 4)) return true;
      if (modelo && modelo === q) return true;
      if (full && full === q) return true;
      return false;
    };

    let matchedItem = erpArmacoes.find(findMatch);
    let matchedType = 'armacoes';

    if (!matchedItem) {
      matchedItem = erpLentes.find(findMatch);
      if (matchedItem) {
        matchedType = 'lentes';
      } else {
        matchedItem = erpAcessorios.find(findMatch);
        if (matchedItem) {
          matchedType = 'acessorios';
        } else {
          matchedItem = erpBrindes.find(findMatch);
          if (matchedItem) {
            matchedType = 'brindes';
          } else {
            matchedItem = erpGeral.find(findMatch);
            if (matchedItem) {
              matchedType = 'geral';
            }
          }
        }
      }
    }

    if (matchedItem) {
      const rawStock = matchedItem['ESTOQUE'] !== undefined ? matchedItem['ESTOQUE'] : (matchedItem['EM ESTOQUE'] !== undefined ? matchedItem['EM ESTOQUE'] : (matchedItem['estoque'] !== undefined ? matchedItem['estoque'] : matchedItem['QTD']));
      const stockAvailable = parseInt(rawStock !== undefined && rawStock !== '' ? rawStock : 999, 10);
      const name = `${matchedItem['MARCA'] || ''} ${matchedItem['MODELO'] || matchedItem['PRODUTO'] || matchedItem['NOME'] || 'Produto'}`.trim();

      if (isVendor && stockAvailable <= 0) {
        playScannerBeep(false);
        setBarcodeToast({
          id: Date.now(),
          type: 'warning',
          title: 'Produto com Estoque Zerado',
          message: `O item "${name}" está esgotado (0 un). Vendedores não podem adicionar itens sem estoque.`,
          price: cleanVal(matchedItem['PRECO_VENDA'] || matchedItem['VALOR'] || 0)
        });
        return;
      }

      if (isExternalVendor && !isProductFromVendaExterna(matchedItem)) {
        playScannerBeep(false);
        const prodUnit = matchedItem['UNIDADE'] || matchedItem['CIDADE'] || matchedItem['LOJA'] || matchedItem['Unidade'] || 'Outra Filial';
        const name = `${matchedItem['MARCA'] || ''} ${matchedItem['MODELO'] || matchedItem['PRODUTO'] || matchedItem['NOME'] || 'Produto'}`.trim();
        setBarcodeToast({
          id: Date.now(),
          type: 'warning',
          title: 'Bloqueado para Vendedor Externo',
          message: `O item "${name}" pertence à unidade ${prodUnit}. Vendedores externos só podem adicionar itens de Venda Externa.`,
          price: cleanVal(matchedItem['PRECO_VENDA'] || matchedItem['VALOR'] || 0)
        });
        return;
      }

      addToCart(matchedItem, matchedType);
      playScannerBeep(true);
      setBarcodeToast({
        id: Date.now(),
        type: 'success',
        title: 'Produto adicionado via Leitor de Código de Barras!',
        message: `${name} (${matchedItem['REFERENCIA_SKU'] || matchedItem['CODIGO'] || matchedItem['SKU'] || code})`,
        price: cleanVal(matchedItem['PRECO_VENDA'] || matchedItem['VALOR'] || 0)
      });
    } else {
      playScannerBeep(false);
      setBarcodeToast({
        id: Date.now(),
        type: 'warning',
        title: 'Código Não Encontrado',
        message: `Código "${code}" lido, mas não localizado no estoque atual.`
      });
    }
  };

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;
    let keyTimestamps = [];

    const handleKeyDown = (e) => {
      const now = performance.now();
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      // Se for Enter (fim da transmissão do leitor USB)
      if (e.key === 'Enter' || e.keyCode === 13) {
        if (buffer.length >= 2) {
          const totalDuration = now - (keyTimestamps[0] || now);
          const avgInterval = totalDuration / Math.max(1, buffer.length - 1);

          // Leitor USB dispara caracteres rapidamente (< 60ms)
          if (!isInputFocused || avgInterval < 60) {
            e.preventDefault();
            e.stopPropagation();
            const scanned = buffer;
            buffer = '';
            keyTimestamps = [];

            if (isInputFocused && activeEl) {
              try {
                activeEl.blur();
                setProductSearch('');
                setClientSearch('');
              } catch (_) {}
            }

            handleBarcodeScanned(scanned);
            return;
          }
        }
        buffer = '';
        keyTimestamps = [];
        return;
      }

      // Captura apenas caracteres imprimíveis únicos
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (now - lastKeyTime > 80) {
          buffer = '';
          keyTimestamps = [];
        }

        buffer += e.key;
        keyTimestamps.push(now);
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [erpArmacoes, erpLentes, erpGeral]);

  // ─── CÁLCULOS FINANCEIROS E RESTANTE ─────────────────────────────
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  }, [cart]);

  const voucherDiscount = useMemo(() => {
    if (!appliedVouchers || appliedVouchers.length === 0) return 0;
    let totalDesc = 0;
    for (const v of appliedVouchers) {
      const tipo = String(v.TIPO_DESCONTO || v.tipo_desconto || 'VALOR').toUpperCase();
      const val = cleanVal(v.VALOR_DESCONTO || v.valor_desconto);
      if (tipo === 'PORCENTAGEM') {
        totalDesc += Math.round((subtotal * (val / 100)) * 100) / 100;
      } else {
        totalDesc += val;
      }
    }
    return Math.min(subtotal, Math.round(totalDesc * 100) / 100);
  }, [appliedVouchers, subtotal]);

  const totalFinal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) - voucherDiscount);
  }, [subtotal, discount, voucherDiscount]);

  const totalPaid = useMemo(() => {
    return payments.reduce((acc, p) => acc + p.valor, 0);
  }, [payments]);

  const remaining = useMemo(() => {
    return Math.max(0, totalFinal - totalPaid);
  }, [totalFinal, totalPaid]);

  const isFullyCovered = useMemo(() => {
    return totalFinal > 0 && remaining <= 0.01;
  }, [totalFinal, remaining]);

  // ─── HANDLERS DE VOUCHER / CUPOM (MÚLTIPLOS VOUCHERS) ───────────
  const handleApplyVoucher = (codeParam) => {
    const rawCode = codeParam || voucherCodeInput;
    const code = String(rawCode || '').trim().toUpperCase();
    setVoucherError('');
    if (!code) {
      setVoucherError('Digite o código do voucher.');
      return;
    }

    // Verificar se este voucher já foi adicionado nesta venda
    const isAlreadyAdded = appliedVouchers.some(v => {
      const c = String(v.CODIGO || v.codigo || '').trim().toUpperCase();
      return c === code;
    });
    if (isAlreadyAdded) {
      setVoucherError(`O voucher "${code}" já foi adicionado nesta venda.`);
      return;
    }

    const found = vouchersData.find(v => {
      const c = String(v.CODIGO || v.codigo || '').trim().toUpperCase();
      return c === code;
    });

    if (!found) {
      setVoucherError(`Voucher "${code}" não encontrado.`);
      return;
    }

    const status = String(found.STATUS || found.status || 'Ativo').trim().toLowerCase();
    if (status !== 'ativo') {
      setVoucherError(`Voucher "${code}" está ${status}.`);
      return;
    }

    const totalQtd = parseInt(found.QUANTIDADE_TOTAL || found.quantidade_total || 0, 10);
    const usedQtd = parseInt(found.QUANTIDADE_USADA || found.quantidade_usada || 0, 10);
    if (totalQtd > 0 && usedQtd >= totalQtd) {
      setVoucherError(`Voucher "${code}" esgotado (${usedQtd}/${totalQtd} usados).`);
      return;
    }

    const validity = found.VALIDADE || found.validade;
    if (validity) {
      const valDate = new Date(validity + 'T23:59:59');
      if (!isNaN(valDate.getTime()) && new Date() > valDate) {
        setVoucherError(`Voucher expirou em ${validity}.`);
        return;
      }
    }

    const store = found.UNIDADE || found.unidade || 'Todas';
    const currentCity = userFixedCity || selectedPOSCity || currentUser?.city || 'Todas';
    if (store !== 'Todas' && currentCity !== 'Todas' && store.toLowerCase() !== currentCity.toLowerCase()) {
      setVoucherError(`Voucher válido apenas para a loja ${store}.`);
      return;
    }

    setAppliedVouchers(prev => [...prev, found]);
    setVoucherError('');
    setVoucherCodeInput('');
  };

  const handleRemoveVoucher = (indexToRemove) => {
    if (typeof indexToRemove === 'number') {
      setAppliedVouchers(prev => prev.filter((_, idx) => idx !== indexToRemove));
    } else {
      setAppliedVouchers([]);
    }
    setVoucherError('');
  };

  // ─── HELPER: CONSTRUIR OBJETO DE PAGAMENTO ───────────────────────
  const formatSafeDate = (dStr) => {
    if (!dStr) return new Date().toLocaleDateString('pt-BR');
    if (dStr.includes('/')) return dStr;
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const buildPaymentObject = (method, val, cashReceivedVal, installmentsCount, dueDate, customDates = {}, stageOverride = null) => {
    let texto = '';
    let parcelasDetalhe = [];
    let trocoLocal = 0;
    const n = parseInt(installmentsCount, 10) || 1;
    const valorNumerico = Math.max(0, cleanVal(val));
    const isBoletoMethod = method === 'carne' || method === 'boleto';
    const effectiveStage = isBoletoMethod ? 'restante' : (stageOverride || currentStage || 'entrada');
    const stagePrefix = (!isBoletoMethod && effectiveStage === 'restante') ? '[Restante] ' : '';

    if (method === 'dinheiro') {
      const recebido = cleanVal(cashReceivedVal) || valorNumerico;
      trocoLocal = Math.max(0, recebido - valorNumerico);
      texto = `${stagePrefix}💵 Dinheiro: ${fmtMoeda(valorNumerico)}${trocoLocal > 0 ? ` (Recebido: ${fmtMoeda(recebido)} | Troco: ${fmtMoeda(trocoLocal)})` : ''}`;
    } else if (method === 'pix') {
      texto = `${stagePrefix}⚡ PIX: ${fmtMoeda(valorNumerico)}`;
    } else if (method === 'debito') {
      texto = `${stagePrefix}💳 Cartão Débito: ${fmtMoeda(valorNumerico)}`;
    } else if (method === 'credito') {
      const vParc = n > 0 ? valorNumerico / n : valorNumerico;
      if (n > 1) {
        for (let i = 1; i <= n; i++) {
          parcelasDetalhe.push({
            numero: i,
            totalParcelas: n,
            valor: vParc.toFixed(2).replace('.', ',')
          });
        }
        texto = `${stagePrefix}💳 Cartão Crédito (${n}x de ${fmtMoeda(vParc)}): ${fmtMoeda(valorNumerico)}`;
      } else {
        texto = `${stagePrefix}💳 Cartão Crédito (1x à vista): ${fmtMoeda(valorNumerico)}`;
      }
    } else if (method === 'carne' || method === 'boleto') {
      const vParc = n > 0 ? valorNumerico / n : valorNumerico;
      for (let i = 1; i <= n; i++) {
        const rawDue = customDates[i] || getInstallmentDate(dueDate, i - 1);
        const formattedDue = formatSafeDate(rawDue);
        parcelasDetalhe.push({
          numero: i,
          totalParcelas: n,
          vencimento: formattedDue,
          valor: vParc.toFixed(2).replace('.', ',')
        });
      }
      const vencsTexto = parcelasDetalhe.map(p => `${p.numero}ª ${p.vencimento}`).join(', ');
      texto = `📄 Boleto (${n}x de ${fmtMoeda(vParc)} | Venc: ${vencsTexto}): ${fmtMoeda(valorNumerico)}`;
    }

    return {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      metodo: method,
      stage: effectiveStage,
      valor: valorNumerico,
      texto,
      parcelas: parcelasDetalhe,
      troco: trocoLocal,
      valorRecebido: cleanVal(cashReceivedVal)
    };
  };

  // ─── ADICIONAR FORMA DE PAGAMENTO À LISTA FRACIONADA ──────────────
  const handleAddPayment = () => {
    if (payments.length > 0 && isFullyCovered) {
      alert(`O valor total da compra (${fmtMoeda(totalFinal)}) já está 100% coberto. Se deseja alterar as formas de pagamento, remova o pagamento lançado clicando na lixeira 🗑️ abaixo.`);
      return;
    }

    if (currentMethod === 'carne' && selectedClientFinancials?.isInadimplente) {
      const clientName = selectedClient?.['Nome Completo'] || selectedClient?.['NOME'] || 'o cliente';
      const vencido = fmtMoeda(selectedClientFinancials.totalVencido || selectedClientFinancials.totalAberto);
      const allow = window.confirm(
        `⚠️ ALERTA DE RISCO DE CRÉDITO:\n\n${clientName} possui parcelas vencidas em aberto no valor de ${vencido}.\n\nDeseja realmente autorizar a emissão de NOVO BOLETO para este cliente?`
      );
      if (!allow) return;
    }

    if (currentMethod === 'carne' && selectedClientFinancials?.respFinancials?.isInadimplente) {
      const respName = selectedClientFinancials.respFinancials.respName;
      const vencido = fmtMoeda(selectedClientFinancials.respFinancials.totalVencido || selectedClientFinancials.respFinancials.totalAberto);
      const allow = window.confirm(
        `⚠️ ALERTA DE RISCO DE CRÉDITO DO RESPONSÁVEL LEGAL:\n\nO Responsável Legal deste cliente (${respName}) possui parcelas vencidas em aberto no valor de ${vencido}.\n\nDeseja realmente autorizar a emissão de NOVO BOLETO para este cliente?`
      );
      if (!allow) return;
    }

    const rawVal = cleanVal(paymentInputVal) || (currentMethod === 'dinheiro' ? cleanVal(cashTendered) : 0) || remaining;
    const val = remaining > 0 ? Math.min(rawVal, remaining) : (rawVal || totalFinal);

    if (val <= 0) {
      alert('Informe o valor a ser pago nesta forma de pagamento.');
      return;
    }

    const newPay = buildPaymentObject(currentMethod, val, cashTendered, payInstallments, payFirstDueDate, customDueDates, currentStage);
    setPayments(prev => [...prev, newPay]);
    setPaymentInputVal('');
    setCashTendered('');
    setPayInstallments(1);
    setCustomDueDates({});
  };

  const togglePaymentStage = (id) => {
    setPayments(prev => prev.map(p => {
      if (p.id !== id) return p;
      const mLower = String(p.metodo || '').toLowerCase();
      if (mLower === 'carne' || mLower === 'boleto') return p;
      const nextStage = p.stage === 'restante' ? 'entrada' : 'restante';
      const cleanTexto = String(p.texto || '').replace(/^\[Restante\]\s*/i, '');
      return {
        ...p,
        stage: nextStage,
        texto: nextStage === 'restante' ? `[Restante] ${cleanTexto}` : cleanTexto
      };
    }));
  };

  const removePayment = (id) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  // ─── FINALIZAÇÃO DA VENDA NO CAIXA ──────────────────────────────
  const handleFinalizeSale = async () => {
    if (isFinalizingSale) return;
    if (!selectedClient) {
      alert('Por favor, selecione um cliente cadastrado no topo antes de finalizar a venda.');
      document.getElementById('pos-client-search-input')?.focus();
      return;
    }
    if (cart.length === 0) {
      alert('Adicione pelo menos um produto do estoque ao carrinho.');
      return;
    }

    let effectivePayments = [...payments];

    // Se houver pagamentos fracionados lançados, mas ainda falta cobrir
    if (effectivePayments.length > 0 && remaining > 0.01) {
      alert(`Ainda resta um saldo de ${fmtMoeda(remaining)} para cobrir o total de ${fmtMoeda(totalFinal)}. Adicione a forma de pagamento do restante antes de finalizar.`);
      return;
    }

    // Se nenhum pagamento foi adicionado à lista fracionada:
    if (effectivePayments.length === 0) {
      const valDigitado = cleanVal(paymentInputVal);
      // Se o usuário digitou um valor menor que o total sem clicar em adicionar fracionado:
      if (valDigitado > 0 && valDigitado < totalFinal - 0.01) {
        alert(`O valor digitado (${fmtMoeda(valDigitado)}) é menor que o total da compra (${fmtMoeda(totalFinal)}). Clique em "+ Dividir / Adicionar Este Pagamento Fracionado" para lançar os ${fmtMoeda(valDigitado)} e em seguida adicione a forma de pagamento do restante (${fmtMoeda(totalFinal - valDigitado)}).`);
        return;
      }

      const autoPay = buildPaymentObject(currentMethod, totalFinal, cashTendered, payInstallments, payFirstDueDate, customDueDates, currentStage);
      effectivePayments = [autoPay];
    }

    // Alerta de risco financeiro caso haja boleto para cliente inadimplente
    const hasCarne = effectivePayments.some(p => p.metodo === 'carne' || p.metodo === 'boleto');
    if (hasCarne && selectedClientFinancials?.isInadimplente) {
      const clientName = selectedClient['Nome Completo'] || selectedClient['NOME'] || 'o cliente';
      const vencido = fmtMoeda(selectedClientFinancials.totalVencido || selectedClientFinancials.totalAberto);
      const allow = window.confirm(
        `⚠️ ALERTA DE RISCO DE CRÉDITO:\n\n${clientName} possui parcelas vencidas no valor de ${vencido}.\n\nDeseja realmente autorizar e FINALIZAR a venda com emissão de novo boleto?`
      );
      if (!allow) return;
    }

    if (hasCarne && selectedClientFinancials?.respFinancials?.isInadimplente) {
      const respName = selectedClientFinancials.respFinancials.respName;
      const vencido = fmtMoeda(selectedClientFinancials.respFinancials.totalVencido || selectedClientFinancials.respFinancials.totalAberto);
      const allow = window.confirm(
        `⚠️ ALERTA DE RISCO DE CRÉDITO DO RESPONSÁVEL LEGAL:\n\nO Responsável Legal deste cliente (${respName}) possui parcelas vencidas em aberto no valor de ${vencido}.\n\nDeseja realmente autorizar e FINALIZAR a venda com emissão de novo boleto?`
      );
      if (!allow) return;
    }

    setIsFinalizingSale(true);

    const clientId = selectedClient.id || selectedClient._id || selectedClient.CLIENTE_ID || `client_${Date.now()}`;
    const clientCpf = String(selectedClient['CPF / CNPJ'] || selectedClient['CPF'] || '').trim();
    const clientName = selectedClient['Nome Completo'] || selectedClient['NOME'] || 'Cliente';
    const city = userFixedCity || selectedPOSCity || selectedClient['Cidade'] || selectedClient['CIDADE'] || currentUser?.city || 'Cajati';

    // 🛡️ Cálculo preciso da data e horário da venda informados pelo operador (respeita data e horário retroativos ou customizados)
    const getSaleDateInfo = () => {
      const now = new Date();
      const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const effectiveTime = posSaleTime || defaultTime;
      const [hStr, mStr] = effectiveTime.split(':');
      const hours = parseInt(hStr, 10) || now.getHours();
      const minutes = parseInt(mStr, 10) || now.getMinutes();

      let targetYear = now.getFullYear();
      let targetMonth = now.getMonth();
      let targetDay = now.getDate();

      if (posSaleDate) {
        const parts = posSaleDate.split('-');
        if (parts.length === 3) {
          targetYear = parseInt(parts[0], 10);
          targetMonth = parseInt(parts[1], 10) - 1;
          targetDay = parseInt(parts[2], 10);
        }
      }

      const customDate = new Date(targetYear, targetMonth, targetDay, hours, minutes, 0);
      const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      return {
        dateObj: customDate,
        formatted: customDate.toLocaleDateString('pt-BR'),
        iso: customDate.toISOString(),
        timestamp: customDate.getTime(),
        timeStr: timeFormatted
      };
    };

    const saleDateInfo = getSaleDateInfo();
    const effectiveSaleDateFormatted = saleDateInfo.formatted;
    const effectiveSaleDateIso = saleDateInfo.iso;
    const effectiveSaleTimestamp = saleDateInfo.timestamp;
    const effectiveSaleTimeStr = saleDateInfo.timeStr;
    const effectiveSaleDateTimeFmt = saleDateInfo.dateObj.toLocaleString('pt-BR');
    const nowIso = effectiveSaleDateIso;
    const todayStr = effectiveSaleDateFormatted;

    // Montar texto de pagamento consolidado
    const formaPagamentoTexto = effectivePayments.map(p => p.texto).join(' + ');
    const trocoTotal = effectivePayments.reduce((acc, p) => acc + (p.troco || 0), 0);
    const descricaoItens = cart.map(i => `${i.qtd}x ${i.nome}`).join(' + ');

    const valorTotalFmt = totalFinal.toFixed(2).replace('.', ',');
    const totalPagoImediato = effectivePayments.reduce((acc, p) => {
      const metodoLower = String(p.metodo || '').toLowerCase();
      if (metodoLower === 'boleto' || metodoLower === 'carne' || p.stage === 'restante') {
        return acc;
      }
      return acc + (cleanVal(p.valor) || 0);
    }, 0);
    const valorEntradaFmt = totalPagoImediato.toFixed(2).replace('.', ',');
    const restanteFmt = Math.max(0, totalFinal - totalPagoImediato).toFixed(2).replace('.', ',');
    const todasParcelas = effectivePayments
      .filter(p => p.metodo === 'carne' || p.metodo === 'boleto')
      .flatMap(p => p.parcelas || []);

    const formatPOSMethodName = (m, parcelas) => {
      const ml = String(m || '').toLowerCase();
      if (ml === 'dinheiro') return 'Dinheiro';
      if (ml === 'pix') return 'PIX';
      if (ml === 'debito') return 'Cartão de Débito';
      if (ml === 'credito') return parcelas && parcelas.length > 1 ? `Cartão de Crédito (${parcelas.length}x)` : 'Cartão de Crédito';
      if (ml === 'carne' || ml === 'boleto') return parcelas && parcelas.length > 0 ? `Boleto (${parcelas.length}x)` : 'Boleto';
      return m;
    };
    const entradaMethodsList = [...new Set(
      effectivePayments
        .filter(p => p.metodo !== 'carne' && p.metodo !== 'boleto' && p.stage !== 'restante')
        .map(p => formatPOSMethodName(p.metodo, p.parcelas))
    )];
    const restanteMethodsList = [...new Set(
      effectivePayments
        .filter(p => p.metodo === 'carne' || p.metodo === 'boleto' || p.stage === 'restante')
        .map(p => formatPOSMethodName(p.metodo, p.parcelas))
    )];
    const derivedFormaEntrada = entradaMethodsList.join(' + ');
    const derivedFormaRestante = restanteMethodsList.join(' + ');

    const saleId = `venda_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newSale = {
      id: saleId,
      dataHora: nowIso,
      timestamp: effectiveSaleTimestamp,
      DATA_HORA: effectiveSaleDateTimeFmt,
      HORA: effectiveSaleTimeStr,
      hora: effectiveSaleTimeStr,
      'CLIENTE_ID': clientId,
      'CLIENTE_CPF': clientCpf,
      'CPF': clientCpf,
      'CLIENTE': clientName,
      'NOME': clientName,
      'NOME CLIENTE': clientName,
      'CIDADE': city,
      'LOJA': city,
      'DATA': todayStr,
      'DATA  DA VENDA': todayStr,
      'DATA DA VENDA': todayStr,
      'DATA_VENDA': todayStr,
      'Data da Venda': todayStr,
      'data_venda': todayStr,
      'PRODUTO': descricaoItens,
      'VALOR TOTAL': totalFinal,
      'VALOR DA VENDA': totalFinal,
      'VALOR ENTRADA': valorEntradaFmt,
      'SINAL': valorEntradaFmt,
      'RESTANTE': restanteFmt,
      'FORMA_PAGTO': formaPagamentoTexto,
      'FORMA_ENTRADA': derivedFormaEntrada,
      'formaPagamentoEntrada': derivedFormaEntrada,
      'FORMA_RESTANTE': derivedFormaRestante,
      'formaPagamentoRestante': derivedFormaRestante,
      'pagamentosLista': effectivePayments,
      'parcelas': todasParcelas,
      'PARCELAS_JSON': JSON.stringify(todasParcelas),
      'VENDEDOR': currentUser?.username || 'Caixa',
      'VOUCHER': appliedVouchers.map(v => v.CODIGO || v.codigo).join(', '),
      'DESCONTO_VOUCHER': voucherDiscount
    };

    // Identificar itens de armação e lente vendidos para pré-carregar na OS
    const armacaoItem = cart.find(i => i.type === 'armacoes' || i.type === 'geral' || (i.rawProduct && (i.rawProduct.MARCA || i.rawProduct.MODELO)));
    const lenteItem = cart.find(i => i.type === 'lentes');
    const todosItensNomes = cart.map(i => `${i.qtd > 1 ? `${i.qtd}x ` : ''}${i.nome}`).join(' + ');

    const clientForOS = {
      ...selectedClient,
      'Modelo de Armação': armacaoItem ? armacaoItem.nome : (selectedClient['Modelo de Armação'] || ''),
      'Marca de Lente': lenteItem ? lenteItem.nome : (selectedClient['Marca de Lente'] || ''),
      'Armação': armacaoItem ? armacaoItem.nome : (selectedClient['Modelo de Armação'] || ''),
      'Lente': lenteItem ? lenteItem.nome : (selectedClient['Marca de Lente'] || ''),
      'PRODUTO': todosItensNomes || 'Óculos Completo',
      'Valor Devido': valorTotalFmt,
      'valorTotal': valorTotalFmt,
      'valorEntrada': valorEntradaFmt,
      'restante': restanteFmt,
      'formasPagamento': formaPagamentoTexto,
      'FORMA_ENTRADA': derivedFormaEntrada,
      'formaPagamentoEntrada': derivedFormaEntrada,
      'FORMA_RESTANTE': derivedFormaRestante,
      'formaPagamentoRestante': derivedFormaRestante,
      'parcelas': todasParcelas,
      'PARCELAS_JSON': JSON.stringify(todasParcelas),
      'Cidade': city,
      'CIDADE': city,
      'LOJA': city,
      'selectedCity': city,
      'dataVenda': effectiveSaleDateFormatted,
      'dataHora': nowIso,
      'timestamp': effectiveSaleTimestamp,
      'DATA_HORA': effectiveSaleDateTimeFmt,
      'HORA': effectiveSaleTimeStr,
      'hora': effectiveSaleTimeStr,
      'DATA  DA VENDA': effectiveSaleDateFormatted,
      'DATA DA VENDA': effectiveSaleDateFormatted,
      'DATA_VENDA': effectiveSaleDateFormatted,
      'Data da Venda': effectiveSaleDateFormatted,
      'DATA': effectiveSaleDateFormatted,
      'observacoes': `Venda Caixa PDV: ${todosItensNomes}`
    };

    const finalSaleData = {
      ...newSale,
      itens: [...cart],
      subtotal,
      desconto: discount,
      descontoVoucher: voucherDiscount,
      voucher: appliedVouchers.map(v => v.CODIGO || v.codigo).join(', '),
      vouchers: appliedVouchers,
      valorTotal: totalFinal,
      formaPagamento: formaPagamentoTexto,
      formaPagamentoEntrada: derivedFormaEntrada,
      formaPagamentoRestante: derivedFormaRestante,
      pagamentosLista: effectivePayments,
      trocoTotal,
      parcelas: todasParcelas,
      cidade: city,
      dataHora: nowIso,
      timestamp: effectiveSaleTimestamp,
      DATA_HORA: effectiveSaleDateTimeFmt,
      HORA: effectiveSaleTimeStr,
      hora: effectiveSaleTimeStr,
      dataVenda: effectiveSaleDateFormatted,
      vendedor: currentUser?.username || 'Caixa'
    };

    // 🛡️ 1. ABERTURA INSTANTÂNEA E GARANTIDA DO MODAL DE COMPROVANTE & ORDEM DE SERVIÇO
    setSavedClientForOS(clientForOS);
    setCompletedSale(finalSaleData);

    // 2. Limpar formulário de venda e carrinho do operador
    setCart([]);
    setPayments([]);
    setCurrentStage('entrada');
    setDiscountInput('');
    setCashTendered('');
    setPaymentInputVal('');
    setAppliedVouchers([]);
    setVoucherCodeInput('');
    setVoucherError('');
    setPosSaleDate(new Date().toISOString().slice(0, 10));
    const resetNowTime = new Date();
    setPosSaleTime(`${String(resetNowTime.getHours()).padStart(2, '0')}:${String(resetNowTime.getMinutes()).padStart(2, '0')}`);
    setIsFinalizingSale(false);

    // 3. Sincronização em background protegida com withTimeout para não prender a interface
    (async () => {
      try {
        // 1. Salvar Venda no Firebase (protegido contra falhas de rede)
        if (onAddSale) {
          try {
            await withTimeout(onAddSale(newSale), 3000);
          } catch (saleErr) {
            console.warn('Aviso ao registrar venda no banco de dados:', saleErr);
          }
        }

        // 1.1 Atualizar uso dos Cupons/Vouchers se aplicados e salvar histórico de uso detalhado
        if (appliedVouchers.length > 0 && onUpdateRow) {
          for (const v of appliedVouchers) {
            try {
              const currentUsed = parseInt(v.QUANTIDADE_USADA || v.quantidade_usada || 0, 10);
              const totalQtd = parseInt(v.QUANTIDADE_TOTAL || v.quantidade_total || 0, 10);
              const nextUsed = currentUsed + 1;
              const isEsgotado = totalQtd > 0 && nextUsed >= totalQtd;

              const tipoDesc = String(v.TIPO_DESCONTO || v.tipo_desconto || 'VALOR').toUpperCase();
              const valDescRaw = cleanVal(v.VALOR_DESCONTO || v.valor_desconto);
              const descThisVoucher = tipoDesc === 'PORCENTAGEM'
                ? Math.round((subtotal * (valDescRaw / 100)) * 100) / 100
                : valDescRaw;

              const usoEntry = {
                cliente: clientName,
                cpf: clientCpf,
                dataHora: new Date().toLocaleString('pt-BR'),
                os: newSale?.['OS DA VENDA'] || newSale?.['OS'] || selectedClient?.['OS'] || selectedClient?.['OS DA VENDA'] || 'PDV',
                valorDesconto: descThisVoucher
              };

              let existingHistory = [];
              try {
                const rawH = v.HISTORICO_USO || v.usos_json || v.historico_uso;
                if (typeof rawH === 'string') existingHistory = JSON.parse(rawH);
                else if (Array.isArray(rawH)) existingHistory = rawH;
              } catch (e) {
                existingHistory = [];
              }
              if (!Array.isArray(existingHistory)) existingHistory = [];
              const updatedHistory = [...existingHistory, usoEntry];

              const updatedVoucher = {
                ...v,
                QUANTIDADE_USADA: nextUsed,
                quantidade_usada: nextUsed,
                STATUS: isEsgotado ? 'Esgotado' : (v.STATUS || v.status || 'Ativo'),
                status: isEsgotado ? 'Esgotado' : (v.STATUS || v.status || 'Ativo'),
                HISTORICO_USO: JSON.stringify(updatedHistory),
                historico_uso: JSON.stringify(updatedHistory),
                usos_json: JSON.stringify(updatedHistory)
              };
              await withTimeout(onUpdateRow('VOUCHERS', v, updatedVoucher), 3000);
            } catch (vErr) {
              console.warn('Aviso ao atualizar cupom/voucher:', vErr);
            }
          }
        }

        // 2. Baixar Estoque dos Itens Vendidos no ERP (Transações Atômicas no Firestore)
        for (const item of cart) {
          if (item.rawProduct && (item.type === 'armacoes' || item.type === 'lentes' || item.type === 'acessorios' || item.type === 'brindes' || item.type === 'geral')) {
            let sheetName = 'CAD_ARMACOES';
            if (item.type === 'lentes') sheetName = 'CAD_LENTES';
            else if (item.type === 'acessorios') sheetName = 'CAD_ACESSORIOS';
            else if (item.type === 'brindes') sheetName = 'CAD_BRINDES';
            else if (item.type === 'geral') sheetName = 'ESTOQUE';

            const currentStock = parseInt(item.rawProduct['ESTOQUE'] || item.rawProduct['EM ESTOQUE'] || 0, 10);
            const updatedStock = Math.max(0, currentStock - item.qtd);
            const updatedProduct = {
              ...item.rawProduct,
              'ESTOQUE': updatedStock,
              ...(item.rawProduct['EM ESTOQUE'] !== undefined ? { 'EM ESTOQUE': updatedStock } : {}),
              ...(item.rawProduct['estoque'] !== undefined ? { 'estoque': updatedStock } : {})
            };
            item.rawProduct['ESTOQUE'] = updatedStock;
            if (item.rawProduct['EM ESTOQUE'] !== undefined) item.rawProduct['EM ESTOQUE'] = updatedStock;
            if (item.rawProduct['estoque'] !== undefined) item.rawProduct['estoque'] = updatedStock;

            // Baixa atômica no banco de dados em nuvem
            const targetDocId = item.rawProduct.id || item.rawProduct._id;
            if (targetDocId) {
              try {
                await withTimeout(decrementStockAtomically(sheetName, targetDocId, item.qtd), 3000);
              } catch (stockErr) {
                console.warn('Aviso no decremento atômico de estoque:', stockErr);
              }
            }

            // Atualização apenas do estado em memória local (evita gravação dupla no Firestore)
            if (typeof setData === 'function') {
              setData(prev => {
                if (!prev || !prev[sheetName]) return prev;
                return {
                  ...prev,
                  [sheetName]: prev[sheetName].map(r => {
                    const isMatch = r === item.rawProduct ||
                      (targetDocId && (r?.id === targetDocId || r?.['_id'] === targetDocId));
                    return isMatch ? updatedProduct : r;
                  })
                };
              });
            }
          }
        }

        // 3. Se houver parcelas de Boleto em venda que NÃO envolve confecção de OS (itens gerais sem armação/lente),
        // registrar em CONTAS_RECEBER. Caso haja armação ou lente, a geração das duplicatas fica retida
        // na OS (Semáforo Azul) até a conferência e liberação financeira pela administração!
        const hasOpticalItems = cart.some(i => i.type === 'armacoes' || i.type === 'lentes');
        if (!hasOpticalItems) {
          const parcelasItems = [];
          for (const pay of effectivePayments) {
            if ((pay.metodo === 'carne' || pay.metodo === 'boleto') && pay.parcelas && pay.parcelas.length > 0) {
              for (const p of pay.parcelas) {
                parcelasItems.push({
                  'CLIENTE_ID': clientId,
                  'CLIENTE_CPF': clientCpf,
                  'CPF': clientCpf,
                  'CLIENTE': clientName,
                  'NOME CLIENTE': clientName,
                  'DOCUMENTO': `BOLETO ${p.numero}/${p.totalParcelas} - PDV`,
                  'VALOR': typeof p.valor === 'number' ? p.valor.toFixed(2).replace('.', ',') : String(p.valor || '0,00'),
                  'DATA_VENCIMENTO': p.vencimento,
                  'DATA VENCIMENTO': p.vencimento,
                  'STATUS': 'Pendente',
                  'CIDADE': city,
                  'MEIO_PAGAMENTO': 'Boleto',
                  'DESCRICAO': `Venda PDV - Parcela ${p.numero}/${p.totalParcelas} (${descricaoItens})`
                });
              }
            }
          }
          if (parcelasItems.length > 0) {
            try {
              if (onAddBatch) {
                await withTimeout(onAddBatch('CONTAS_RECEBER', parcelasItems), 4000);
              } else if (onAddRow) {
                for (const item of parcelasItems) {
                  await withTimeout(onAddRow('CONTAS_RECEBER', item), 3000);
                }
              }
            } catch (crErr) {
              console.warn('Aviso ao registrar parcelas em lote em CONTAS_RECEBER:', crErr);
            }
          }
        }

        // 4. Registrar Movimentações no FLUXO_CAIXA em tempo real com rastreabilidade de cliente (em Lote)
        // Filtra para que APENAS meios de pagamento imediatos (DINHEIRO, PIX, DEBITO, CREDITO) pagos na Entrada (não marcados como Restante) gerem entrada imediata no caixa
        const immediatePayments = effectivePayments.filter(pay => {
          if (pay.stage === 'restante') return false;
          const m = String(pay.metodo || '').toUpperCase();
          return m === 'DINHEIRO' || m === 'PIX' || m === 'DEBITO' || m === 'CREDITO' ||
                 m.includes('DINHEIRO') || m.includes('PIX') || m.includes('DEBITO') || m.includes('DÉBITO') || m.includes('CREDITO') || m.includes('CRÉDITO');
        });

        if (immediatePayments.length > 0) {
          const cashMovements = immediatePayments.map(pay => ({
            id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            saleId: newSale.id,
            osNumero: newSale['OS DA VENDA'] || '',
            tipo: 'VENDA',
            dataHora: effectiveSaleDateIso,
            timestamp: effectiveSaleTimestamp,
            DATA_HORA: effectiveSaleDateTimeFmt,
            data: effectiveSaleDateFormatted,
            DATA: effectiveSaleDateFormatted,
            hora: effectiveSaleTimeStr,
            HORA: effectiveSaleTimeStr,
            unidade: city,
            operador: currentUser?.username || 'Caixa',
            valor: cleanVal(pay.valor),
            formaPagamento: String(pay.metodo || 'DINHEIRO').toUpperCase(),
            motivo: `Venda PDV - ${clientName}`,
            detalhes: descricaoItens,
            CLIENTE_ID: clientId,
            CLIENTE_CPF: clientCpf,
            CPF: clientCpf
          }));

          try {
            if (onAddBatch) {
              await withTimeout(onAddBatch('FLUXO_CAIXA', cashMovements), 4000);
            } else if (onAddRow) {
              for (const mov of cashMovements) {
                await withTimeout(onAddRow('FLUXO_CAIXA', mov), 3000);
              }
            }
          } catch (fcErr) {
            console.warn('Aviso ao registrar movimentação em lote no FLUXO_CAIXA:', fcErr);
          }
        }
      } catch (unexpectedErr) {
        console.warn('Aviso na rotina de sincronização da venda:', unexpectedErr);
      }
    })();
  };

  // ─── SALVAMENTO DA OS GERADA PELO MODAL PADRÃO (SUPORTE A 1 OU MÚLTIPLAS OS COM COBRANÇA UNIFICADA) ──
  const handleSaveOSFromModal = async (osGeneratedData) => {
    if (!savedClientForOS) return;
    const clientName = savedClientForOS['Nome Completo'] || savedClientForOS['NOME'] || 'Cliente';
    const todayStr = new Date().toLocaleDateString('pt-BR');

    const clientId = savedClientForOS.id || savedClientForOS._id || savedClientForOS.CLIENTE_ID || '';
    const clientCpf = String(savedClientForOS['CPF / CNPJ'] || savedClientForOS['CPF'] || '').trim();
    const salesSheetName = (data && data['Registro_Vendas']) ? 'Registro_Vendas' : 'BD MARKETING';

    const isMulti = Boolean(
      Array.isArray(osGeneratedData) || 
      (osGeneratedData?.isMultiOS && Array.isArray(osGeneratedData?.orders)) ||
      (Array.isArray(osGeneratedData?.orders) && osGeneratedData.orders.length > 1)
    );

    const osList = Array.isArray(osGeneratedData)
      ? osGeneratedData
      : (osGeneratedData?.orders && osGeneratedData.orders.length > 0)
        ? osGeneratedData.orders
        : [osGeneratedData];

    if (!isMulti || osList.length <= 1) {
      // ─── FLUXO CONVENCIONAL DE 1 OS ────────────────────────────────
      const singleData = osList[0] || osGeneratedData;
      const osRestante = Math.max(0, parseCurrency(singleData.valorTotal) - parseCurrency(singleData.valorEntrada));

      const singleSaleDate = singleData.dataVenda || completedSale?.['DATA  DA VENDA'] || completedSale?.['DATA'] || todayStr;
      const singleSaleIso = completedSale?.dataHora || (singleData.dataHora) || new Date().toISOString();
      const singleSaleTimestamp = completedSale?.timestamp || new Date(singleSaleIso).getTime();
      const singleSaleDataHoraFmt = completedSale?.DATA_HORA || new Date(singleSaleIso).toLocaleString('pt-BR');
      const singleSaleHoraFmt = completedSale?.HORA || completedSale?.hora || new Date(singleSaleIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const resolvedFormaEntrada = singleData.formaPagamentoEntrada || singleData.FORMA_ENTRADA || completedSale?.['FORMA_ENTRADA'] || completedSale?.formaPagamentoEntrada || '';
      const resolvedFormaRestante = singleData.formaPagamentoRestante || singleData.FORMA_RESTANTE || completedSale?.['FORMA_RESTANTE'] || completedSale?.formaPagamentoRestante || '';

      const mergedSaleData = {
        ...(completedSale || {}),
        'CLIENTE_ID': clientId,
        'CLIENTE_CPF': clientCpf,
        'CPF': clientCpf,
        'DATA': singleSaleDate,
        'DATA  DA VENDA': singleSaleDate,
        'DATA DA VENDA': singleSaleDate,
        'DATA_VENDA': singleSaleDate,
        'Data da Venda': singleSaleDate,
        'data_venda': singleSaleDate,
        'dataHora': singleSaleIso,
        'timestamp': singleSaleTimestamp,
        'DATA_HORA': singleSaleDataHoraFmt,
        'HORA': singleSaleHoraFmt,
        'hora': singleSaleHoraFmt,
        'PRODUTO': (singleData.lente + (singleData.armacao ? ` + ${singleData.armacao}` : '')).trim() || completedSale?.PRODUTO || 'Óculos com Grau',
        'LENTE': singleData.lente || '',
        'ARMAÇÃO': singleData.armacao || '',
        'LABORATORIO': singleData.laboratorio || '',
        'VALOR TOTAL': singleData.valorTotal || completedSale?.['VALOR TOTAL'],
        'VALOR DA VENDA': singleData.valorTotal || completedSale?.['VALOR DA VENDA'],
        'VALOR ENTRADA': singleData.valorEntrada || completedSale?.['VALOR ENTRADA'] || '0,00',
        'SINAL': singleData.valorEntrada || completedSale?.['SINAL'] || '0,00',
        'RESTANTE': singleData.restante || (osRestante > 0 ? osRestante.toFixed(2).replace('.', ',') : '0,00'),
        'FORMAS_PAGAMENTO': singleData.formasPagamento || completedSale?.['FORMA_PAGTO'] || '',
        'FORMA_ENTRADA': resolvedFormaEntrada,
        'formaPagamentoEntrada': resolvedFormaEntrada,
        'FORMA_RESTANTE': resolvedFormaRestante,
        'formaPagamentoRestante': resolvedFormaRestante,
        'SITUAÇÃO': 'Aguardando Confirmação',
        'OS DA VENDA': singleData.numeroOS,
        'OS': singleData.numeroOS,
        'VENDA_OS': singleData.numeroOS,
        'STATUS_OS': 'Aguardando Confirmação',
        'PAGAMENTO_CONFERIDO': 'Não',
        'DUPLICATAS_GERADAS': false,
        'PARCELAS_JSON': JSON.stringify(
          (singleData.parcelas && singleData.parcelas.length > 0)
            ? singleData.parcelas
            : (savedClientForOS?.parcelas || completedSale?.parcelas || [])
        ),
        'PREVISAO_ENTREGA': singleData.dataEntrega || todayStr,
        'NOME CLIENTE': clientName,
        'CLIENTE': clientName,
        'NOME': clientName,
        'PACIENTE': singleData.nomePessoa || singleData.PACIENTE || singleData.NOME_BENEFICIARIO || clientName,
        'NOME_BENEFICIARIO': singleData.nomePessoa || singleData.NOME_BENEFICIARIO || singleData.PACIENTE || clientName,
        'CLIENTE_BENEFICIARIO': singleData.nomePessoa || singleData.CLIENTE_BENEFICIARIO || clientName,
        'nomePessoa': singleData.nomePessoa || clientName,
        'RESPONSAVEL_LEGAL_INADIMPLENTE': !!singleData.RESPONSAVEL_LEGAL_INADIMPLENTE,
        'RESPONSAVEL_LEGAL_DEBITO': singleData.RESPONSAVEL_LEGAL_DEBITO || 0,
        'TELEFONE': savedClientForOS['WhatsApp'] || savedClientForOS['TELEFONE'] || completedSale?.TELEFONE || '',
        'CIDADE': singleData.selectedCity || singleData.unidade || userFixedCity || selectedPOSCity || savedClientForOS['Cidade'] || savedClientForOS['CIDADE'] || 'Cajati',
        'LOJA': singleData.selectedCity || singleData.unidade || userFixedCity || selectedPOSCity || savedClientForOS['Cidade'] || savedClientForOS['CIDADE'] || 'Cajati',
        'UNIDADE': singleData.selectedCity || singleData.unidade || userFixedCity || selectedPOSCity || savedClientForOS['Cidade'] || savedClientForOS['CIDADE'] || 'Cajati',
        'DIOPTRIA': `OD: ${singleData.odEsf || ''}/${singleData.odCil || ''} OE: ${singleData.oeEsf || ''}/${singleData.oeCil || ''} AD: ${singleData.adicao || ''}`,
        'OD_ESF': singleData.odEsf || '',
        'OD_CIL': singleData.odCil || '',
        'OD_EIXO': singleData.odEixo || '',
        'OD_DNP': singleData.odDnp || '',
        'OD_ALT': singleData.odAlt || '',
        'OE_ESF': singleData.oeEsf || '',
        'OE_CIL': singleData.oeCil || '',
        'OE_EIXO': singleData.oeEixo || '',
        'OE_DNP': singleData.oeDnp || '',
        'OE_ALT': singleData.oeAlt || '',
        'OD_PERTO_ESF': singleData.odPertoEsf || '',
        'OD_PERTO_CIL': singleData.odPertoCil || '',
        'OD_PERTO_EIXO': singleData.odPertoEixo || '',
        'OD_PERTO_DNP': singleData.odPertoDnp || '',
        'OD_PERTO_ALT': singleData.odPertoAlt || '',
        'OE_PERTO_ESF': singleData.oePertoEsf || '',
        'OE_PERTO_CIL': singleData.oePertoCil || '',
        'OE_PERTO_EIXO': singleData.oePertoEixo || '',
        'OE_PERTO_DNP': singleData.oePertoDnp || '',
        'OE_PERTO_ALT': singleData.oePertoAlt || '',
        'ADICAO': singleData.adicao || '',
        'MEDICO': singleData.medico || '',
        'OBSERVACOES': singleData.observacoes || completedSale?.OBSERVACOES || ''
      };

      if (completedSale && onUpdateRow) {
        // 🛡️ Não duplica a venda: atualiza a venda que acabou de ser criada no checkout!
        await onUpdateRow(salesSheetName, completedSale, mergedSaleData);
        setCompletedSale(mergedSaleData);
      } else if (onAddSale) {
        await onAddSale(mergedSaleData);
        setCompletedSale(mergedSaleData);
      }

      // 🛡️ Sincronizar data e OS no FLUXO_CAIXA (incluindo data e horário) para que não fique preso na data de hoje
      if (completedSale?.id && onUpdateRow && Array.isArray(cashMovements)) {
        try {
          const matchingMovements = cashMovements.filter(m => m.saleId === completedSale.id || (m.osNumero && m.osNumero === singleData.numeroOS));
          const labelRestante = resolvedFormaRestante && !resolvedFormaRestante.toLowerCase().includes('boleto')
            ? `Restante (${resolvedFormaRestante})`
            : 'Parcelado Boleto';
          for (const mov of matchingMovements) {
            const updatedMov = {
              ...mov,
              data: singleSaleDate,
              DATA: singleSaleDate,
              dataHora: singleSaleIso,
              timestamp: singleSaleTimestamp,
              DATA_HORA: singleSaleDataHoraFmt,
              hora: singleSaleHoraFmt,
              HORA: singleSaleHoraFmt,
              osNumero: singleData.numeroOS,
              cliente: clientName,
              valorTotalOS: parseCurrency(singleData.valorTotal),
              valorEntradaOS: parseCurrency(singleData.valorEntrada),
              valorRestanteBoleto: osRestante,
              formaRestanteOS: resolvedFormaRestante || 'Boleto',
              motivo: `Venda OS #${singleData.numeroOS} - ${clientName} (${mov.formaPagamento || 'PDV'})`,
              detalhes: osRestante > 0
                ? `OS #${singleData.numeroOS} • Total da OS: R$ ${singleData.valorTotal} (Entrada: R$ ${singleData.valorEntrada} | ${labelRestante}: R$ ${osRestante.toFixed(2).replace('.', ',')})`
                : `OS #${singleData.numeroOS} • Total da OS: R$ ${singleData.valorTotal} | ${mergedSaleData.PRODUTO || ''}`
            };
            await withTimeout(onUpdateRow('FLUXO_CAIXA', mov, updatedMov), 2000);
          }
        } catch (syncFcErr) {
          console.warn('Aviso ao sincronizar FLUXO_CAIXA com a data da OS:', syncFcErr);
        }
      }

      // Atualiza o número de OS real no histórico do voucher se houver
      if (completedSale?.vouchers && Array.isArray(completedSale.vouchers) && onUpdateRow) {
        for (const v of completedSale.vouchers) {
          try {
            const currentV = (data?.['VOUCHERS'] || data?.VOUCHERS || []).find(voucher =>
              (v.id && voucher.id === v.id) ||
              (v.CODIGO && String(voucher.CODIGO).toUpperCase() === String(v.CODIGO).toUpperCase())
            ) || v;
            const rawH = currentV.HISTORICO_USO || currentV.usos_json || currentV.historico_uso || v.HISTORICO_USO || v.usos_json;
            let hist = typeof rawH === 'string' ? JSON.parse(rawH) : (Array.isArray(rawH) ? rawH : []);
            if (Array.isArray(hist) && hist.length > 0) {
              const targetEntry = [...hist].reverse().find(entry =>
                (entry && (entry.os === 'PDV' || !entry.os)) &&
                (!clientName || entry.cliente === clientName)
              ) || hist[hist.length - 1];
              if (targetEntry && (targetEntry.os === 'PDV' || !targetEntry.os)) {
                targetEntry.os = singleData.numeroOS;
                await withTimeout(onUpdateRow('VOUCHERS', currentV, {
                  ...currentV,
                  HISTORICO_USO: JSON.stringify(hist),
                  historico_uso: JSON.stringify(hist),
                  usos_json: JSON.stringify(hist)
                }), 2000);
              }
            }
          } catch (e) {}
        }
      }

      setCashVoucherPrintData(null);
      setReceiptPrintData(null);
      setOsPrintData({
        ...singleData,
        FORMA_ENTRADA: resolvedFormaEntrada,
        formaPagamentoEntrada: resolvedFormaEntrada,
        FORMA_RESTANTE: resolvedFormaRestante,
        formaPagamentoRestante: resolvedFormaRestante,
        itens: completedSale?.itens || cart
      });
      setIsOSModalOpen(false);

      setTimeout(() => {
        window.print();
      }, 400);
      return;
    }

    // ─── FLUXO MULTI-OS COM FATURAMENTO / COBRANÇA UNIFICADA NO CLIENTE ───
    const allLinkedOSNumbers = osList.map(o => o.numeroOS);
    const primaryOS = osList[0];
    const saleId = completedSale?.id || `venda_${Date.now()}`;
    const city = primaryOS.selectedCity || primaryOS.unidade || osGeneratedData?.selectedCity || userFixedCity || selectedPOSCity || completedSale?.CIDADE || 'Cajati';

    const primarySaleDate = primaryOS.dataVenda || completedSale?.['DATA  DA VENDA'] || completedSale?.['DATA'] || todayStr;
    const multiSaleIso = completedSale?.dataHora || primaryOS.dataHora || new Date().toISOString();
    const multiSaleTimestamp = completedSale?.timestamp || new Date(multiSaleIso).getTime();
    const multiSaleDataHoraFmt = completedSale?.DATA_HORA || new Date(multiSaleIso).toLocaleString('pt-BR');
    const multiSaleHoraFmt = completedSale?.HORA || completedSale?.hora || new Date(multiSaleIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const multiFormaEntrada = osGeneratedData.formaPagamentoEntrada || osGeneratedData.FORMA_ENTRADA || primaryOS.formaPagamentoEntrada || primaryOS.FORMA_ENTRADA || completedSale?.['FORMA_ENTRADA'] || '';
    const multiFormaRestante = osGeneratedData.formaPagamentoRestante || osGeneratedData.FORMA_RESTANTE || primaryOS.formaPagamentoRestante || primaryOS.FORMA_RESTANTE || completedSale?.['FORMA_RESTANTE'] || '';

    // 1. Atualizar a Venda Principal / OS #1
    const mergedPrimarySaleData = {
      ...(completedSale || {}),
      id: saleId,
      saleId: saleId,
      'CLIENTE_ID': clientId,
      'CLIENTE_CPF': clientCpf,
      'CPF': clientCpf,
      'DATA': primarySaleDate,
      'DATA  DA VENDA': primarySaleDate,
      'DATA DA VENDA': primarySaleDate,
      'DATA_VENDA': primarySaleDate,
      'Data da Venda': primarySaleDate,
      'data_venda': primarySaleDate,
      'dataHora': multiSaleIso,
      'timestamp': multiSaleTimestamp,
      'DATA_HORA': multiSaleDataHoraFmt,
      'HORA': multiSaleHoraFmt,
      'hora': multiSaleHoraFmt,
      'OS DA VENDA': primaryOS.numeroOS,
      'OS': primaryOS.numeroOS,
      'VENDA_OS': primaryOS.numeroOS,
      isMultiOS: true,
      multiOSCount: osList.length,
      totalOS: osList.length,
      osIndex: 1,
      osLabel: primaryOS.label || 'Óculos 1',
      allLinkedOS: allLinkedOSNumbers,
      PRODUTO: [primaryOS.armacao, primaryOS.lente].filter(Boolean).join(' + ') || completedSale?.PRODUTO || 'Óculos 1',
      LENTE: primaryOS.lente || '',
      ARMAÇÃO: primaryOS.armacao || '',
      LABORATORIO: primaryOS.laboratorio || '',
      'VALOR TOTAL': osGeneratedData.valorTotal || primaryOS.valorTotal || completedSale?.['VALOR TOTAL'] || completedSale?.['VALOR DA VENDA'] || '0,00',
      'VALOR DA VENDA': osGeneratedData.valorTotal || primaryOS.valorTotal || completedSale?.['VALOR DA VENDA'] || completedSale?.['VALOR TOTAL'] || '0,00',
      'VALOR ENTRADA': osGeneratedData.valorEntrada || primaryOS.valorEntrada || completedSale?.['VALOR ENTRADA'] || completedSale?.['SINAL'] || '0,00',
      'SINAL': osGeneratedData.valorEntrada || primaryOS.valorEntrada || completedSale?.['SINAL'] || completedSale?.['VALOR ENTRADA'] || '0,00',
      'RESTANTE': osGeneratedData.restante || primaryOS.restante || completedSale?.['RESTANTE'] || '0,00',
      'FORMAS_PAGAMENTO': osGeneratedData.formasPagamento || primaryOS.formasPagamento || completedSale?.['FORMAS_PAGAMENTO'] || completedSale?.['FORMA_PAGTO'] || '',
      'FORMA_PAGTO': osGeneratedData.formasPagamento || primaryOS.formasPagamento || completedSale?.['FORMA_PAGTO'] || completedSale?.['FORMAS_PAGAMENTO'] || '',
      'FORMA_ENTRADA': multiFormaEntrada,
      'formaPagamentoEntrada': multiFormaEntrada,
      'FORMA_RESTANTE': multiFormaRestante,
      'formaPagamentoRestante': multiFormaRestante,
      'SITUAÇÃO': 'Aguardando Confirmação',
      'STATUS_OS': 'Aguardando Confirmação',
      'PAGAMENTO_CONFERIDO': 'Não',
      'DUPLICATAS_GERADAS': false,
      'FINANCEIRO_UNIFICADO': true,
      'COBRANCA_UNICA': true,
      'PARCELAS_JSON': JSON.stringify(
        (primaryOS.parcelas && primaryOS.parcelas.length > 0)
          ? primaryOS.parcelas
          : (osGeneratedData.parcelas && osGeneratedData.parcelas.length > 0)
            ? osGeneratedData.parcelas
            : (savedClientForOS?.parcelas || completedSale?.parcelas || [])
      ),
      'PREVISAO_ENTREGA': primaryOS.dataEntrega || todayStr,
      'NOME CLIENTE': clientName,
      'CLIENTE': clientName,
      'NOME': clientName,
      'PACIENTE': primaryOS.nomePessoa || primaryOS.PACIENTE || primaryOS.NOME_BENEFICIARIO || clientName,
      'NOME_BENEFICIARIO': primaryOS.nomePessoa || primaryOS.NOME_BENEFICIARIO || primaryOS.PACIENTE || clientName,
      'CLIENTE_BENEFICIARIO': primaryOS.nomePessoa || primaryOS.CLIENTE_BENEFICIARIO || clientName,
      'nomePessoa': primaryOS.nomePessoa || clientName,
      'RESPONSAVEL_LEGAL_INADIMPLENTE': !!osGeneratedData.RESPONSAVEL_LEGAL_INADIMPLENTE,
      'RESPONSAVEL_LEGAL_DEBITO': osGeneratedData.RESPONSAVEL_LEGAL_DEBITO || 0,
      'TELEFONE': savedClientForOS['WhatsApp'] || savedClientForOS['TELEFONE'] || completedSale?.TELEFONE || '',
      'CIDADE': city,
      'LOJA': city,
      'UNIDADE': city,
      'DIOPTRIA': `OD: ${primaryOS.odEsf || ''}/${primaryOS.odCil || ''} OE: ${primaryOS.oeEsf || ''}/${primaryOS.oeCil || ''} AD: ${primaryOS.adicao || ''}`,
      'OD_ESF': primaryOS.odEsf || '',
      'OD_CIL': primaryOS.odCil || '',
      'OD_EIXO': primaryOS.odEixo || '',
      'OD_DNP': primaryOS.odDnp || '',
      'OD_ALT': primaryOS.odAlt || '',
      'OD_DP': primaryOS.odDp || '',
      'OD_OPA': primaryOS.odOpa || '',
      'OE_ESF': primaryOS.oeEsf || '',
      'OE_CIL': primaryOS.oeCil || '',
      'OE_EIXO': primaryOS.oeEixo || '',
      'OE_DNP': primaryOS.oeDnp || '',
      'OE_ALT': primaryOS.oeAlt || '',
      'OD_PERTO_ESF': primaryOS.odPertoEsf || '',
      'OD_PERTO_CIL': primaryOS.odPertoCil || '',
      'OD_PERTO_EIXO': primaryOS.odPertoEixo || '',
      'OD_PERTO_DNP': primaryOS.odPertoDnp || '',
      'OD_PERTO_ALT': primaryOS.odPertoAlt || '',
      'OE_PERTO_ESF': primaryOS.oePertoEsf || '',
      'OE_PERTO_CIL': primaryOS.oePertoCil || '',
      'OE_PERTO_EIXO': primaryOS.oePertoEixo || '',
      'OE_PERTO_DNP': primaryOS.oePertoDnp || '',
      'OE_PERTO_ALT': primaryOS.oePertoAlt || '',
      'OE_DP': primaryOS.oeDp || '',
      'OE_OPA': primaryOS.oeOpa || '',
      'ADICAO': primaryOS.adicao || '',
      'MEDICO': primaryOS.medico || '',
      'OBSERVACOES': primaryOS.observacoes || completedSale?.OBSERVACOES || ''
    };

    // 2. Preparar as OSs complementares (Óculos 2, Óculos 3, etc.)
    const companionRows = osList.slice(1).map((secOS, idx) => ({
      id: `${saleId}_os_${idx + 2}`,
      saleId: saleId,
      parentSaleId: saleId,
      isMultiOS: true,
      isSecondaryOS: true,
      multiOSCount: osList.length,
      totalOS: osList.length,
      osIndex: idx + 2,
      osLabel: secOS.label || `Óculos ${idx + 2}`,
      allLinkedOS: allLinkedOSNumbers,
      CLIENTE_ID: clientId,
      CLIENTE_CPF: clientCpf,
      CPF: clientCpf,
      'NOME CLIENTE': clientName,
      CLIENTE: clientName,
      NOME: clientName,
      PACIENTE: secOS.nomePessoa || secOS.PACIENTE || secOS.NOME_BENEFICIARIO || `Beneficiário Óculos ${idx + 2}`,
      NOME_BENEFICIARIO: secOS.nomePessoa || secOS.NOME_BENEFICIARIO || secOS.PACIENTE || `Beneficiário Óculos ${idx + 2}`,
      CLIENTE_BENEFICIARIO: secOS.nomePessoa || secOS.CLIENTE_BENEFICIARIO || `Beneficiário Óculos ${idx + 2}`,
      nomePessoa: secOS.nomePessoa || `Beneficiário Óculos ${idx + 2}`,
      RESPONSAVEL_LEGAL_INADIMPLENTE: !!osGeneratedData.RESPONSAVEL_LEGAL_INADIMPLENTE,
      RESPONSAVEL_LEGAL_DEBITO: osGeneratedData.RESPONSAVEL_LEGAL_DEBITO || 0,
      TELEFONE: savedClientForOS['WhatsApp'] || savedClientForOS['TELEFONE'] || completedSale?.TELEFONE || '',
      CIDADE: userFixedCity || secOS.selectedCity || secOS.unidade || city,
      LOJA: userFixedCity || secOS.selectedCity || secOS.unidade || city,
      UNIDADE: userFixedCity || secOS.selectedCity || secOS.unidade || city,
      VENDEDOR: completedSale?.VENDEDOR || currentUser?.username || 'Caixa',
      DATA: secOS.dataVenda || primarySaleDate || todayStr,
      'DATA  DA VENDA': secOS.dataVenda || primarySaleDate || todayStr,
      'DATA DA VENDA': secOS.dataVenda || primarySaleDate || todayStr,
      'DATA_VENDA': secOS.dataVenda || primarySaleDate || todayStr,
      'Data da Venda': secOS.dataVenda || primarySaleDate || todayStr,
      'data_venda': secOS.dataVenda || primarySaleDate || todayStr,
      dataHora: multiSaleIso,
      timestamp: multiSaleTimestamp,
      DATA_HORA: multiSaleDataHoraFmt,
      hora: multiSaleHoraFmt,
      HORA: multiSaleHoraFmt,
      'OS DA VENDA': secOS.numeroOS,
      'OS': secOS.numeroOS,
      'VENDA_OS': secOS.numeroOS,
      STATUS_OS: 'Aguardando Confirmação',
      'SITUAÇÃO': 'Aguardando Confirmação',
      PRODUTO: [secOS.armacao, secOS.lente].filter(Boolean).join(' + ') || secOS.label || `Óculos ${idx + 2}`,
      LENTE: secOS.lente || '',
      ARMAÇÃO: secOS.armacao || '',
      LABORATORIO: secOS.laboratorio || '',
      OD_ESF: secOS.odEsf || '',
      OD_CIL: secOS.odCil || '',
      OD_EIXO: secOS.odEixo || '',
      OD_DNP: secOS.odDnp || '',
      OD_ALT: secOS.odAlt || '',
      OD_DP: secOS.odDp || '',
      OD_OPA: secOS.odOpa || '',
      OE_ESF: secOS.oeEsf || '',
      OE_CIL: secOS.oeCil || '',
      OE_EIXO: secOS.oeEixo || '',
      OE_DNP: secOS.oeDnp || '',
      OE_ALT: secOS.oeAlt || '',
      OD_PERTO_ESF: secOS.odPertoEsf || '',
      OD_PERTO_CIL: secOS.odPertoCil || '',
      OD_PERTO_EIXO: secOS.odPertoEixo || '',
      OD_PERTO_DNP: secOS.odPertoDnp || '',
      OD_PERTO_ALT: secOS.odPertoAlt || '',
      OE_PERTO_ESF: secOS.oePertoEsf || '',
      OE_PERTO_CIL: secOS.oePertoCil || '',
      OE_PERTO_EIXO: secOS.oePertoEixo || '',
      OE_PERTO_DNP: secOS.oePertoDnp || '',
      OE_PERTO_ALT: secOS.oePertoAlt || '',
      OE_DP: secOS.oeDp || '',
      OE_OPA: secOS.oeOpa || '',
      ADICAO: secOS.adicao || '',
      DIOPTRIA: `OD: ${secOS.odEsf || ''}/${secOS.odCil || ''} OE: ${secOS.oeEsf || ''}/${secOS.oeCil || ''} AD: ${secOS.adicao || ''}`,
      MEDICO: secOS.medico || '',
      OBSERVACOES: secOS.observacoes || '',
      PREVISAO_ENTREGA: secOS.dataEntrega || todayStr,
      // Faturamento e Cobrança Unificada (não duplica faturamento no Dashboard nem boleto)
      'VALOR TOTAL': '0,00',
      'VALOR DA VENDA': '0,00',
      'VALOR ENTRADA': '0,00',
      'SINAL': '0,00',
      'RESTANTE': '0,00',
      'VALOR_ITEM': secOS.valorTotal || '0,00',
      'FORMAS_PAGAMENTO': `Cobrança Unificada (Venda #${saleId})`,
      'FORMA_PAGTO': `Cobrança Unificada (Venda #${saleId})`,
      'FORMA_ENTRADA': multiFormaEntrada,
      'FORMA_RESTANTE': multiFormaRestante,
      'PAGAMENTO_CONFERIDO': 'Sim',
      'DUPLICATAS_GERADAS': true,
      'FINANCEIRO_UNIFICADO': true,
      'COBRANCA_UNICA': true
    }));

    if (completedSale && onUpdateRow) {
      await onUpdateRow(salesSheetName, completedSale, mergedPrimarySaleData);
    } else if (onAddSale) {
      await onAddSale(mergedPrimarySaleData);
    }

    // 🛡️ Sincronizar data, horário e OS no FLUXO_CAIXA para o fluxo Multi-OS
    if (completedSale?.id && onUpdateRow && Array.isArray(cashMovements)) {
      try {
        const matchingMovements = cashMovements.filter(m => m.saleId === completedSale.id || allLinkedOSNumbers.includes(m.osNumero));
        for (const mov of matchingMovements) {
          const updatedMov = {
            ...mov,
            data: primarySaleDate,
            DATA: primarySaleDate,
            dataHora: multiSaleIso,
            timestamp: multiSaleTimestamp,
            DATA_HORA: multiSaleDataHoraFmt,
            hora: multiSaleHoraFmt,
            HORA: multiSaleHoraFmt,
            osNumero: primaryOS.numeroOS
          };
          await withTimeout(onUpdateRow('FLUXO_CAIXA', mov, updatedMov), 2000);
        }
      } catch (syncFcErr) {
        console.warn('Aviso ao sincronizar FLUXO_CAIXA no Multi-OS:', syncFcErr);
      }
    }

    if (companionRows.length > 0) {
      if (onAddBatch) {
        await onAddBatch(salesSheetName, companionRows);
      } else if (onAddRow) {
        for (const row of companionRows) {
          await onAddRow(salesSheetName, row);
        }
      }
    }

    // Atualiza o número de OS no histórico do voucher se houver
    if (completedSale?.vouchers && Array.isArray(completedSale.vouchers) && onUpdateRow) {
      const osStr = allLinkedOSNumbers.join(', ');
      for (const v of completedSale.vouchers) {
        try {
          const currentV = (data?.['VOUCHERS'] || data?.VOUCHERS || []).find(voucher =>
            (v.id && voucher.id === v.id) ||
            (v.CODIGO && String(voucher.CODIGO).toUpperCase() === String(v.CODIGO).toUpperCase())
          ) || v;
          const rawH = currentV.HISTORICO_USO || currentV.usos_json || currentV.historico_uso || v.HISTORICO_USO || v.usos_json;
          let hist = typeof rawH === 'string' ? JSON.parse(rawH) : (Array.isArray(rawH) ? rawH : []);
          if (Array.isArray(hist) && hist.length > 0) {
            const targetEntry = [...hist].reverse().find(entry =>
              (entry && (entry.os === 'PDV' || !entry.os)) &&
              (!clientName || entry.cliente === clientName)
            ) || hist[hist.length - 1];
            if (targetEntry && (targetEntry.os === 'PDV' || !targetEntry.os)) {
              targetEntry.os = osStr;
              await withTimeout(onUpdateRow('VOUCHERS', currentV, {
                ...currentV,
                HISTORICO_USO: JSON.stringify(hist),
                historico_uso: JSON.stringify(hist),
                usos_json: JSON.stringify(hist)
              }), 2000);
            }
          }
        } catch (e) {}
      }
    }

    setCompletedSale(mergedPrimarySaleData);
    setCashVoucherPrintData(null);
    setReceiptPrintData(null);
    
    setOsPrintData({
      isMultiOS: true,
      selectedCity: city,
      unidade: city,
      multiOrders: osList.map((o, idx) => ({
        ...o,
        osIndex: idx + 1,
        totalOS: osList.length,
        numeroOS: o.numeroOS,
        selectedCity: o.selectedCity || o.unidade || city,
        unidade: o.unidade || o.selectedCity || city,
        clientData: savedClientForOS,
        isSecondaryOS: idx > 0,
        financeiroUnificado: true,
        valorTotal: idx === 0 ? (osGeneratedData.valorTotal || o.valorTotal || completedSale?.['VALOR TOTAL'] || '0,00') : '0,00',
        valorEntrada: idx === 0 ? (osGeneratedData.valorEntrada || o.valorEntrada || completedSale?.['VALOR ENTRADA'] || '0,00') : '0,00',
        restante: idx === 0 ? (osGeneratedData.restante || o.restante || completedSale?.['RESTANTE'] || '0,00') : '0,00',
        formasPagamento: idx === 0 ? (osGeneratedData.formasPagamento || o.formasPagamento || completedSale?.['FORMAS_PAGAMENTO'] || '') : `Cobrança Unificada (Venda #${saleId})`,
        FORMA_ENTRADA: multiFormaEntrada,
        formaPagamentoEntrada: multiFormaEntrada,
        FORMA_RESTANTE: multiFormaRestante,
        formaPagamentoRestante: multiFormaRestante,
        itens: [
          o.armacao ? { tipo: 'armacoes', type: 'armacoes', nome: o.armacao, qtd: 1 } : null,
          o.lente ? { tipo: 'lentes', type: 'lentes', nome: o.lente, qtd: 1 } : null
        ].filter(Boolean)
      })),
      ...primaryOS,
      FORMA_ENTRADA: multiFormaEntrada,
      formaPagamentoEntrada: multiFormaEntrada,
      FORMA_RESTANTE: multiFormaRestante,
      formaPagamentoRestante: multiFormaRestante,
      itens: completedSale?.itens || cart
    });
    setIsOSModalOpen(false);

    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handlePrintReceipt = (sale) => {
    setOsPrintData(null);
    setCashVoucherPrintData(null);
    setReceiptPrintData(sale);
    setTimeout(() => {
      window.print();
    }, 350);
  };

  const handleResetForNewSale = () => {
    setCompletedSale(null);
    setSavedClientForOS(null);
    setOsPrintData(null);
    setReceiptPrintData(null);
    setCashVoucherPrintData(null);
    setSelectedClient(null);
    setPayments([]);
    setCart([]);
    setClientSearch('');
    setCashTendered('');
    setDiscountInput('');
    setPaymentInputVal('');
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Visual de Leitor de Código de Barras */}
      {barcodeToast && (
        <div className="fixed top-5 right-5 z-[99999] max-w-sm w-full bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${barcodeToast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {barcodeToast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase text-white tracking-wide">{barcodeToast.title}</p>
              <p className="text-xs text-slate-300 font-medium truncate mt-0.5">{barcodeToast.message}</p>
              {barcodeToast.price !== undefined && (
                <p className="text-xs font-black text-amber-400 mt-1">{fmtMoeda(barcodeToast.price)}</p>
              )}
            </div>
            <button onClick={() => setBarcodeToast(null)} className="text-slate-400 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── CABEÇALHO DO CAIXA ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                Frente de Caixa <span className="text-emerald-400">PDV</span>
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-bold">Vendas ágeis com emissão de recibo e baixa no estoque ERP</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Operador / Atendente</span>
            <span className="text-sm font-bold text-white uppercase">{currentUser?.username || 'Operador'}</span>
          </div>
        </div>
      </div>

      {/* ─── BARRA DE CONTROLE DE CAIXA, TURNO & SANGRIA (MULTI-LOJA) ─── */}
      <div className="bg-slate-900/95 border border-slate-800/90 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          
          {/* LADO ESQUERDO: SELETOR DE LOJA & STATUS DO TURNO */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Seletor de Loja / Unidade */}
            <div className="h-10 flex items-center gap-2 bg-slate-950/90 border border-slate-700/60 px-3.5 rounded-xl shadow-inner">
              <Building size={15} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Loja:</span>
              {isVendor && !isExternalVendor ? (
                <div className="flex items-center gap-1.5 text-xs text-white font-black uppercase">
                  <span>{selectedPOSCity}</span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">Unidade Fixa</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPOSCity}
                    onChange={e => setSelectedPOSCity(e.target.value)}
                    className="bg-transparent text-xs text-white font-black uppercase outline-none cursor-pointer pr-1"
                  >
                    {['Cajati', 'Registro', 'Jacupiranga', 'Venda Externa'].map(c => (
                      <option key={c} value={c} className="bg-slate-900 text-white font-bold">{c}</option>
                    ))}
                  </select>
                  {isExternalVendor && (
                    <span className="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Vendedor Externo
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Status do Turno (Aberto / Fechado) */}
            {activeSession ? (
              <div className="h-10 flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 px-3.5 rounded-xl text-xs font-bold text-emerald-400 shadow-sm whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-lg shadow-emerald-400/50" />
                <span>
                  <strong>Caixa Aberto · {selectedPOSCity}</strong>
                  <span className="text-slate-400 font-normal ml-1.5 text-[11px]">
                    (Início: {activeSession.dataHoraAbertura ? new Date(activeSession.dataHoraAbertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---'})
                  </span>
                </span>
              </div>
            ) : (
              <div className="h-10 flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3.5 rounded-xl text-xs font-bold text-rose-400 shadow-sm whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                <span><strong>Caixa Fechado</strong> · {selectedPOSCity}</span>
              </div>
            )}
          </div>

          {/* LADO DIREITO: GAVETA & BOTÕES DE AÇÕES DE CAIXA */}
          <div className="flex overflow-x-auto pb-1 sm:flex-wrap items-center gap-2 erp-scroll max-w-full">
            
            {/* Gaveta Dinheiro em Espécie */}
            <div 
              onClick={() => setCashModalState({ isOpen: true, type: 'EXTRATO' })}
              className="h-10 bg-slate-950/90 hover:bg-black border border-emerald-500/40 hover:border-emerald-400 px-3.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all group shadow-sm active:scale-95 whitespace-nowrap shrink-0"
              title="Clique para ver o extrato detalhado do turno"
            >
              <Wallet size={15} className="text-emerald-400 shrink-0" />
              <div className="text-left flex items-baseline gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gaveta:</span>
                <span className="text-xs font-black text-emerald-400 font-mono group-hover:text-emerald-300">
                  {fmtMoeda(liveDrawerCash)}
                </span>
              </div>
            </div>

            {/* Botão de Histórico */}
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="h-10 flex items-center gap-1.5 px-3 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
              title="Consultar histórico detalhado de movimentações e reimprimir comprovantes"
            >
              <History size={14} className="text-indigo-400 shrink-0" />
              <span>📜 Histórico</span>
            </button>

            {/* Suprimento */}
            <button
              type="button"
              onClick={() => setCashModalState({ isOpen: true, type: 'SUPRIMENTO' })}
              className="h-10 flex items-center gap-1.5 px-3 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 hover:border-sky-400/50 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
              title="Inserir reforço de moedas ou cédulas de troco na gaveta"
            >
              <ArrowUpRight size={14} className="text-sky-400 shrink-0" />
              <span>📥 Suprimento</span>
            </button>

            {/* Sangria */}
            <button
              type="button"
              onClick={() => setCashModalState({ isOpen: true, type: 'SANGRIA' })}
              className="h-10 flex items-center gap-1.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 hover:border-rose-400/50 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
              title="Realizar retirada de dinheiro da gaveta para cofre ou despesa"
            >
              <ArrowDownRight size={14} className="text-rose-400 shrink-0" />
              <span>💸 Sangria</span>
            </button>

            {/* Extrato */}
            <button
              type="button"
              onClick={() => setCashModalState({ isOpen: true, type: 'EXTRATO' })}
              className="h-10 flex items-center gap-1.5 px-3 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 hover:border-purple-400/50 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
              title="Exibir resumo financeiro e faturamento por forma de pagamento"
            >
              <FileText size={14} className="text-purple-400 shrink-0" />
              <span>📊 Extrato</span>
            </button>

            {/* Botão Abrir / Fechar Caixa */}
            {activeSession ? (
              <button
                type="button"
                onClick={() => setCashModalState({ isOpen: true, type: 'FECHAMENTO' })}
                className="h-10 flex items-center gap-1.5 px-3.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
                title="Fechar turno com conferência cega e relatório Z"
              >
                <Lock size={14} className="text-amber-400 shrink-0" />
                <span>🔒 Fechar Caixa</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCashModalState({ isOpen: true, type: 'ABERTURA' })}
                className="h-10 flex items-center gap-2 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap shrink-0"
                title="Abrir turno e lançar fundo inicial de troco"
              >
                <Unlock size={15} />
                <span>🔓 Abrir Caixa</span>
              </button>
            )}
          </div>
        </div>

        {/* Alerta Preventivo de Gaveta com Alto Valor em Espécie */}
        {activeSession && liveDrawerCash >= 800 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-2.5 flex items-center justify-between gap-3 text-xs text-rose-300 animate-pulse">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              <span>
                <strong>Atenção de Segurança:</strong> Gaveta física com <strong>{fmtMoeda(liveDrawerCash)}</strong> em dinheiro. Recomendado realizar sangria para o cofre!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCashModalState({ isOpen: true, type: 'SANGRIA' })}
              className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[11px] font-black shrink-0"
            >
              Fazer Sangria Agora
            </button>
          </div>
        )}
      </div>

      {/* ─── ALTERNADOR DE VISUALIZAÇÃO EM DISPOSITIVOS MÓVEIS (< 1024px) ─── */}
      <div className="lg:hidden flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-xl">
        <button
          type="button"
          onClick={() => setMobileTab('produtos')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            mobileTab === 'produtos'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package size={15} />
          <span>1. Catálogo &amp; Cliente</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('carrinho')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            mobileTab === 'carrinho'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingCart size={15} />
          <span>2. Carrinho &amp; Caixa ({cart.reduce((a, b) => a + b.qtd, 0)})</span>
        </button>
      </div>

      {/* ─── GRID PRINCIPAL DO CAIXA ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ─── COLUNA DA ESQUERDA: CLIENTE & ESTOQUE ERP (7 cols) ──── */}
        <div className={`lg:col-span-7 space-y-6 ${mobileTab === 'carrinho' ? 'hidden lg:block' : 'block'}`}>

          {/* 1. SELEÇÃO DE CLIENTE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-sky-400" />
                1. Selecionar Cliente Cadastrado
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickClientForm({
                      nome: '',
                      cpf: '',
                      whatsapp: '',
                      cidade: selectedPOSCity || currentUser?.city || 'Cajati',
                      odEsf: '',
                      oeEsf: '',
                      medico: ''
                    });
                    setQuickClientError('');
                    setIsQuickClientModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Cadastrar cliente sem sair do PDV e sem perder o carrinho"
                >
                  <UserPlus size={14} /> + Cadastrar Novo Cliente
                </button>
              </div>
            </div>

            {selectedClient ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-black">
                      {(selectedClient['Nome Completo'] || selectedClient['NOME'] || 'C')[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-sm">{selectedClient['Nome Completo'] || selectedClient['NOME']}</h3>
                        {selectedClientFinancials?.isInadimplente ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            INADIMPLENTE
                          </span>
                        ) : selectedClientFinancials?.totalAberto > 0 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            COM DÉBITO
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            EM DIA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        WhatsApp: {selectedClient['WhatsApp'] || '—'} | CPF: {selectedClient['CPF / CNPJ'] || '—'} | Loja: {selectedClient['Cidade'] || selectedClient['CIDADE'] || 'Cajati'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                    title="Trocar Cliente"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* ALERTA VISUAL DE INADIMPLÊNCIA / DÉBITO NO PDV */}
                {selectedClientFinancials?.isInadimplente && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-rose-950/30">
                    <div className="flex items-center gap-2.5">
                      <AlertOctagon size={18} className="text-rose-400 shrink-0 animate-pulse" />
                      <div>
                        <p className="font-black text-rose-300 uppercase tracking-wide text-[11px]">
                          Atenção: Cliente Inadimplente com Débito Vencido
                        </p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Valor vencido: <strong className="text-rose-300 font-mono font-bold">{fmtMoeda(selectedClientFinancials.totalVencido)}</strong> (de {fmtMoeda(selectedClientFinancials.totalAberto)} em aberto no ERP)
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-[10px] font-black border border-rose-500/30 shrink-0 uppercase tracking-wider">
                      Alerta Financeiro
                    </span>
                  </div>
                )}
                {!selectedClientFinancials?.isInadimplente && selectedClientFinancials?.totalAberto > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <span>Cliente possui <strong>{fmtMoeda(selectedClientFinancials.totalAberto)}</strong> em parcelas futuras a vencer (situação em dia).</span>
                  </div>
                )}

                {/* ALERTA DE DÉBITO DO RESPONSÁVEL LEGAL NO PDV */}
                {selectedClientFinancials?.respFinancials?.isInadimplente && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-rose-950/40">
                    <div className="flex items-center gap-2.5">
                      <AlertOctagon size={18} className="text-rose-400 shrink-0 animate-pulse" />
                      <div>
                        <p className="font-black text-rose-300 uppercase tracking-wide text-[11px]">
                          Atenção: Responsável Legal ({selectedClientFinancials.respFinancials.respName}) com Débito
                        </p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Possui duplicatas em aberto / vencidas no valor de <strong className="text-rose-300 font-mono font-bold">{fmtMoeda(selectedClientFinancials.respFinancials.totalVencido || selectedClientFinancials.respFinancials.totalAberto)}</strong> no financeiro da loja.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-[10px] font-black border border-rose-500/30 shrink-0 uppercase tracking-wider">
                      Alerta Responsável
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="pos-client-search-input"
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar por Nome, WhatsApp ou CPF do cliente..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                {filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-56 overflow-y-auto">
                    {filteredClients.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientSearch('');
                        }}
                        className="w-full text-left p-3 hover:bg-sky-500/10 border-b border-slate-900 flex justify-between items-center transition-all"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{c['Nome Completo'] || c['NOME']}</p>
                          <p className="text-xs text-slate-400">CPF: {c['CPF / CNPJ'] || '—'} | Zap: {c['WhatsApp'] || '—'}</p>
                        </div>
                        <span className="text-xs font-black text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg">Selecionar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. CATÁLOGO DE ESTOQUE ERP */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Package size={16} className="text-amber-400" />
                2. Produtos do Estoque ERP
              </h2>

              <div className="flex overflow-x-auto pb-1.5 sm:flex-wrap items-center gap-1.5 erp-scroll">
                <button
                  type="button"
                  onClick={() => setProductCategory('mais_vendidos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${productCategory === 'mais_vendidos' ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  <Star size={13} className={productCategory === 'mais_vendidos' ? 'text-slate-950 fill-slate-950' : 'text-amber-400'} />
                  ⭐ Destaques / Populares
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('armacoes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${productCategory === 'armacoes' ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  👓 Armações ({erpArmacoes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('lentes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${productCategory === 'lentes' ? 'bg-indigo-500 text-white font-black shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  🔬 Lentes ({erpLentes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('acessorios')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${productCategory === 'acessorios' ? 'bg-amber-600 text-white font-black shadow-lg shadow-amber-600/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  🎒 Acessórios ({erpAcessorios.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('brindes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${productCategory === 'brindes' ? 'bg-pink-600 text-white font-black shadow-lg shadow-pink-600/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  🎁 Brindes ({erpBrindes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${productCategory === 'todos' ? 'bg-sky-600 text-white font-black shadow-md shadow-sky-600/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  📦 Todos ({erpArmacoes.length + erpLentes.length + erpAcessorios.length + erpBrindes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('avulso')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${productCategory === 'avulso' ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  ➕ Item Avulso
                </button>
              </div>
            </div>

            {productCategory !== 'avulso' ? (
              <>
                {isExternalVendor && (
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs shadow-sm">
                    <Info size={16} className="text-amber-400 shrink-0" />
                    <span>
                      <strong>Consulta de Lojas:</strong> Você pode visualizar os produtos e saldos de todas as filiais. Para incluir no carrinho, o item deve pertencer ao estoque de <strong>Venda Externa</strong>.
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar no ERP por marca, modelo, SKU, cor, material..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <select
                      value={selectedCityStock}
                      onChange={(e) => setSelectedCityStock(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none shrink-0"
                    >
                      <option value="TODAS">Todas as Lojas / Central</option>
                      <option value="Cajati">Cajati</option>
                      <option value="Registro">Registro</option>
                      <option value="Jacupiranga">Jacupiranga</option>
                      <option value="Venda Externa">Venda Externa</option>
                    </select>
                  </div>

                  {/* Atalhos Rápidos de Marcas / Categorias Populares */}
                  <div className="flex overflow-x-auto pb-1 sm:flex-wrap items-center gap-1.5 pt-0.5 erp-scroll">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0">Filtro Rápido:</span>
                    {(productCategory === 'brindes'
                      ? ['Estojo', 'Flanela', 'Limpa-Lentes', 'Cordão', 'Kit', 'Spray']
                      : ['Ray-Ban', 'Oakley', 'Vogue', 'Armani', 'Crizal', 'Transitions', 'Varilux', 'Solar']
                    ).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setProductSearch(productSearch.toLowerCase() === tag.toLowerCase() ? '' : tag)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${
                          productSearch.toLowerCase() === tag.toLowerCase()
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-1 underline"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </div>
                </div>

                <div 
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-2 erp-scroll ${cart.length > 0 ? 'pb-24 lg:pb-2' : ''}`}
                  style={{ maxHeight: '520px' }}
                >
                  {filteredProducts.slice(0, 100).map((prod, idx) => {
                    const isArmacao = productCategory === 'armacoes' || prod._type === 'armacoes';
                    const isBrinde = productCategory === 'brindes' || prod._type === 'brindes';
                    const isAcessorio = productCategory === 'acessorios' || prod._type === 'acessorios';
                    const brand = prod['MARCA'] || prod['marca'] || '';
                    const model = prod['NOME'] || prod['MODELO'] || prod['modelo'] || prod['PRODUTO'] || prod['DESCRICAO'] || '';
                    const sku = prod['REFERENCIA_SKU'] || prod['CODIGO'] || prod['SKU'] || '';
                    const cor = prod['COR'] || '';
                    const categoria = prod['CATEGORIA'] || '';
                    const unit = prod['UNIDADE'] || prod['CIDADE'] || prod['LOJA'] || 'Central';
                    const imagem = prod['IMAGEM'] || null;

                    const title = (isBrinde || isAcessorio) ? (prod['NOME'] || prod['MODELO'] || prod['PRODUTO'] || (isAcessorio ? 'Acessório' : 'Brinde')) : `${brand} ${model}`.trim() || 'Item ERP';
                    const price = cleanVal(prod['PRECO_VENDA'] || prod['preco_venda'] || prod['VALOR'] || prod['PRECO'] || 0);
                    const stock = parseInt(prod['ESTOQUE'] || prod['estoque'] || prod['EM ESTOQUE'] || 0, 10);

                    return (
                      <div
                        key={idx}
                        className={`bg-slate-950/90 border ${isBrinde ? 'border-pink-500/20 hover:border-pink-500/50' : isAcessorio ? 'border-amber-500/20 hover:border-amber-500/50' : 'border-slate-800 hover:border-amber-500/40'} p-3.5 rounded-2xl flex flex-col justify-between transition-all group shadow-sm`}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          {imagem ? (
                            <img src={imagem} alt={title} className="w-12 h-12 object-cover rounded-xl border border-white/10 shrink-0 bg-slate-900" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                              {isArmacao ? <Glasses size={18} className="text-amber-400" /> : isBrinde ? <Gift size={18} className="text-pink-400" /> : isAcessorio ? <Package size={18} className="text-amber-400" /> : <Eye size={18} className="text-indigo-400" />}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-white text-xs truncate group-hover:text-amber-400 transition-colors">
                              {title}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {categoria && (
                                <span className="text-[9px] font-bold text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
                                  {categoria}
                                </span>
                              )}
                              {sku && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                                  Ref: {sku}
                                </span>
                              )}
                              {cor && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                                  {cor}
                                </span>
                              )}
                              {unit && (
                                <span className="text-[9px] font-extrabold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">
                                  {unit}
                                </span>
                              )}
                              {isExternalVendor && !isProductFromVendaExterna(prod) && (
                                <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded flex items-center gap-1" title="Disponível apenas para consulta visual por vendedor externo">
                                  <Eye size={10} /> Consulta
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-900 mt-auto">
                          <div>
                            {isBrinde && price === 0 ? (
                              <span className="text-pink-400 font-black text-xs uppercase bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">Cortesia (R$ 0,00)</span>
                            ) : (
                              <span className="text-amber-400 font-black text-sm">{fmtMoeda(price)}</span>
                            )}
                            <div className="mt-0.5">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                stock > 2 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                                stock > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' :
                                'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              }`}>
                                {stock > 2 ? `Estoque: ${stock} un` : stock > 0 ? `⚠️ Ponto de Pedido: ${stock} un` : '🔴 Esgotado (0 un)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isVendor && stock <= 0 ? (
                              <button
                                type="button"
                                disabled
                                className="px-3.5 py-2 bg-slate-900 border border-rose-500/30 text-rose-400/80 rounded-xl text-xs font-bold transition-all cursor-not-allowed opacity-70 flex items-center gap-1"
                                title="Vendedores não podem selecionar produtos com estoque zerado"
                              >
                                <Lock size={12} className="text-rose-400" />
                                <span>Esgotado</span>
                              </button>
                            ) : isExternalVendor && !isProductFromVendaExterna(prod) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  alert(`Inclusão bloqueada para Vendedor Externo:\n\nEste produto pertence ao estoque da unidade "${unit || 'Outra Filial'}".\n\nVendedores externos podem consultar produtos de todas as lojas, mas só têm permissão para adicionar produtos que pertençam ao estoque de "Venda Externa".\n\nCaso o cliente deseje este item, solicite a transferência do produto para Venda Externa no ERP.`);
                                }}
                                className="px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                                title={`Produto alocado em ${unit || 'outra filial'}. Apenas consulta disponível para vendedor externo.`}
                              >
                                <Lock size={12} className="text-amber-400" />
                                <span>Outra Loja</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(prod, prod._type || productCategory)}
                                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/10 active:scale-95"
                              >
                                + Adicionar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-xs text-slate-500">
                      Nenhum produto do ERP encontrado com estes filtros.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <form onSubmit={addCustomItemToCart} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Descrição do Item / Serviço</label>
                    <input
                      type="text"
                      placeholder="Ex: Consulta Optométrica, Manutenção de Armação, Lente Especial..."
                      value={customItem.nome}
                      onChange={e => setCustomItem({ ...customItem, nome: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={customItem.preco}
                      onChange={e => setCustomItem({ ...customItem, preco: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all"
                >
                  + Adicionar ao Carrinho
                </button>
              </form>
            )}
          </div>

        </div>


        {/* ─── COLUNA DA DIREITA: CARRINHO & PAGAMENTO (5 cols) ────── */}
        <div id="pos-cart-section" className={`lg:col-span-5 space-y-6 ${mobileTab === 'produtos' ? 'hidden lg:block' : 'block'}`}>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-6">
            {/* Botão de Retorno no Modo Mobile */}
            <div className="lg:hidden pb-1">
              <button
                type="button"
                onClick={() => setMobileTab('produtos')}
                className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                &larr; Continuar Escolhendo Produtos
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart size={16} className="text-emerald-400" />
                Resumo do Pedido ({cart.reduce((a, b) => a + b.qtd, 0)})
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setPayments([]);
                  }}
                  className="text-[10px] text-rose-400 font-bold hover:underline"
                >
                  Limpar Tudo
                </button>
              )}
            </div>

            {/* LISTA DE ITENS DO CARRINHO */}
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 flex justify-between items-center">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {item.imagem ? (
                      <img src={item.imagem} alt={item.nome} className="w-8 h-8 object-cover rounded-lg border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Package size={13} className="text-emerald-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-extrabold text-white text-xs truncate">{item.nome}</p>
                      <p className="text-[10px] text-amber-400 font-bold">{fmtMoeda(item.preco)} un</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, -1)}
                        className="px-2 py-0.5 text-slate-400 hover:text-white font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-black text-white">{item.qtd}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, 1)}
                        className="px-2 py-0.5 text-slate-400 hover:text-white font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-black text-emerald-400 w-16 text-right">
                      {fmtMoeda(item.preco * item.qtd)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Carrinho vazio. Selecione itens do catálogo ao lado.
                </div>
              )}
            </div>

            {/* SUBTOTAL, CUPOM E DESCONTO */}
            <div className="space-y-2.5 border-t border-slate-800 pt-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Subtotal:</span>
                <span className="text-white font-black">{fmtMoeda(subtotal)}</span>
              </div>

              {/* CAMPO DE CUPOM / VOUCHER (SUPORTE A MÚLTIPLOS VOUCHERS) */}
              <div className="pt-1 pb-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Ticket size={13} className="text-emerald-400" />
                    Cupons / Vouchers:
                    {appliedVouchers.length > 0 && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                        {appliedVouchers.length}
                      </span>
                    )}
                  </span>
                  {appliedVouchers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVoucher()}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 hover:underline transition-colors"
                      title="Remover todos os cupons aplicados"
                    >
                      <X size={12} /> Limpar todos
                    </button>
                  )}
                </div>

                {/* Lista de Vouchers Aplicados */}
                {appliedVouchers.length > 0 && (
                  <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto pr-0.5">
                    {appliedVouchers.map((v, idx) => {
                      const tipo = String(v.TIPO_DESCONTO || v.tipo_desconto || 'VALOR').toUpperCase();
                      const val = cleanVal(v.VALOR_DESCONTO || v.valor_desconto);
                      const descItem = tipo === 'PORCENTAGEM' ? `${val}% OFF` : fmtMoeda(val);
                      return (
                        <div key={idx} className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                              <Ticket size={12} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-emerald-300 font-mono tracking-wider truncate">
                                {v.CODIGO || v.codigo}
                              </div>
                              <div className="text-[10px] text-emerald-400/80 truncate">
                                {v.NOME || v.nome || (tipo === 'PORCENTAGEM' ? `${val}% de desconto` : 'Voucher promocional')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-black text-emerald-400">
                              -{descItem}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVoucher(idx)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title="Remover este voucher"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center px-1 text-[11px] font-bold text-emerald-400">
                      <span>Total Descontos em Vouchers:</span>
                      <span className="font-black">-{fmtMoeda(voucherDiscount)}</span>
                    </div>
                  </div>
                )}

                {/* Campo de Entrada para Adicionar Cupom / Voucher */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCodeInput}
                      onChange={(e) => {
                        setVoucherCodeInput(e.target.value.toUpperCase());
                        setVoucherError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyVoucher();
                        }
                      }}
                      placeholder={appliedVouchers.length > 0 ? "+ Adicionar outro voucher..." : "Ex: PROMO50, VERAO10"}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyVoucher()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-950/40 shrink-0 flex items-center gap-1"
                    >
                      <Ticket size={12} />
                      {appliedVouchers.length > 0 ? '+ Adicionar' : 'Aplicar'}
                    </button>
                  </div>
                  {voucherError && (
                    <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                      <AlertTriangle size={11} className="shrink-0" />
                      <span>{voucherError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* DESCONTO MANUAL */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-bold">Desconto Extra (R$):</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  onBlur={(e) => {
                    const v = cleanVal(e.target.value);
                    setDiscountInput(v > 0 ? v.toFixed(2).replace('.', ',') : '');
                  }}
                  placeholder="0,00"
                  className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-right text-xs font-bold text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-slate-300">TOTAL DA COMPRA:</span>
                <span className="text-lg font-black text-emerald-400">{fmtMoeda(totalFinal)}</span>
              </div>
            </div>

            {/* ─── FORMA DE PAGAMENTO & FECHAMENTO ──────────────────── */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-emerald-400" />
                  Forma de Pagamento
                </label>
                {payments.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400">
                    {payments.length} fracionamento(s)
                  </span>
                )}
              </div>

              {/* STATUS DE COBERTURA / RESTANTE SE HOUVER FRACIONAMENTO */}
              {payments.length > 0 && (
                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                  isFullyCovered
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {isFullyCovered ? <CheckCircle2 size={15} className="text-emerald-400" /> : <AlertTriangle size={15} className="text-amber-400" />}
                    <span>{isFullyCovered ? 'Total Coberto!' : 'Falta Cobrir:'}</span>
                  </div>
                  <span className="font-black text-sm">
                    {isFullyCovered ? 'R$ 0,00' : fmtMoeda(remaining)}
                  </span>
                </div>
              )}

              {/* SELEÇÃO DO MÉTODO DESTE LANÇAMENTO */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
                {[
                  { id: 'dinheiro', label: '💵 Dinheiro' },
                  { id: 'pix', label: '⚡ PIX' },
                  { id: 'debito', label: '💳 Débito' },
                  { id: 'credito', label: '💳 Crédito' },
                  { id: 'carne', label: '📄 Boleto' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCurrentMethod(p.id);
                      if (p.id === 'carne') {
                        setCurrentStage('restante');
                      } else if (payments.length === 0) {
                        setCurrentStage('entrada');
                      }
                    }}
                    className={`min-h-[42px] py-2 px-1 rounded-xl text-xs font-bold transition-all border flex items-center justify-center text-center ${
                      currentMethod === p.id
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* SELETOR DE DESTINO DO PAGAMENTO (ENTRADA vs RESTANTE) - BOLETO SEMPRE RESTANTE */}
              {currentMethod !== 'carne' && (
                <div className="flex items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded-xl p-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 pl-1.5 shrink-0">Referente a:</span>
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <button
                      type="button"
                      onClick={() => setCurrentStage('entrada')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        currentStage !== 'restante'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🟢 Entrada (Pago Hoje)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStage('restante')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        currentStage === 'restante'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🟡 Restante (Falta)
                    </button>
                  </div>
                </div>
              )}

              {/* CAMPOS ESPECÍFICOS DO MÉTODO SELECIONADO */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                  <span className="text-xs text-slate-400 font-bold shrink-0">Valor deste Pagamento:</span>
                  <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-[140px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentInputVal}
                      onChange={e => setPaymentInputVal(e.target.value)}
                      onBlur={e => {
                        const v = cleanVal(e.target.value);
                        if (v > 0) setPaymentInputVal(v.toFixed(2).replace('.', ','));
                      }}
                      placeholder={(remaining > 0 ? remaining : totalFinal).toFixed(2).replace('.', ',')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 sm:py-1.5 pl-8 pr-2.5 text-right text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Se for Dinheiro */}
                {currentMethod === 'dinheiro' && (
                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                      <span className="text-xs text-slate-400 font-bold shrink-0">Valor Entregue pelo Cliente:</span>
                      <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-[140px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cashTendered}
                          onChange={e => setCashTendered(e.target.value)}
                          onBlur={e => {
                            const v = cleanVal(e.target.value);
                            if (v > 0) setCashTendered(v.toFixed(2).replace('.', ','));
                          }}
                          placeholder={(cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)).toFixed(2).replace('.', ',')}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 sm:py-1.5 pl-8 pr-2.5 text-right text-xs text-white font-bold focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    {cleanVal(cashTendered) > (cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) && (
                      <div className="flex justify-between items-center text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                        <span>Troco a Devolver:</span>
                        <span>{fmtMoeda(cleanVal(cashTendered) - (cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Se for Crédito ou Boleto */}
                {['carne', 'credito'].includes(currentMethod) && (
                  <div className="space-y-3 pt-2 border-t border-slate-900">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Parcelas:</span>
                      <select
                        value={payInstallments}
                        onChange={e => {
                          setPayInstallments(Number(e.target.value));
                          setCustomDueDates({});
                        }}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(n => (
                          <option key={n} value={n}>{n}x de {fmtMoeda((cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) / n)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Datas de vencimento das parcelas exibidas EXCLUSIVAMENTE para Boleto */}
                    {currentMethod === 'carne' && (
                      <>
                        {selectedClientFinancials?.isInadimplente && (
                          <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs space-y-1.5 shadow-md shadow-rose-950/40">
                            <div className="flex items-center gap-2 font-black text-rose-300 uppercase tracking-wide text-[11px]">
                              <AlertOctagon size={16} className="text-rose-400 shrink-0 animate-pulse" />
                              Risco de Inadimplência no Boleto
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">
                              O cliente possui parcelas vencidas no valor de <strong className="text-rose-400 font-bold">{fmtMoeda(selectedClientFinancials.totalVencido || selectedClientFinancials.totalAberto)}</strong>. Recomenda-se receber as pendências anteriores antes de emitir um novo boleto.
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-bold">1º Vencimento:</span>
                          <input
                            type="date"
                            value={payFirstDueDate}
                            onChange={e => {
                              setPayFirstDueDate(e.target.value);
                              setCustomDueDates({});
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-bold"
                          />
                        </div>

                        {/* TODAS AS DATAS DE VENCIMENTO DAS PARCELAS (BOLETO) */}
                        {payInstallments > 1 && (
                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                              <span className="flex items-center gap-1.5 uppercase tracking-wider font-black">
                                <Calendar size={13} /> Todas as Datas ({payInstallments}x)
                              </span>
                              <span className="text-slate-400">
                                {fmtMoeda((cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) / payInstallments)} / parc
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {Array.from({ length: payInstallments }, (_, i) => {
                                const num = i + 1;
                                const calculatedDate = getInstallmentDate(payFirstDueDate, i);
                                const currentDateVal = customDueDates[num] || calculatedDate;
                                const valPerParc = (cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) / payInstallments;
                                return (
                                  <div key={num} className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-black text-slate-300">
                                      {num}ª Parcela ({fmtMoeda(valPerParc)}):
                                    </span>
                                    <input
                                      type="date"
                                      value={currentDateVal}
                                      onChange={e => setCustomDueDates(prev => ({ ...prev, [num]: e.target.value }))}
                                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* BOTÃO PARA DIVIDIR / FRACIONAR O PAGAMENTO */}
                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={payments.length > 0 && isFullyCovered}
                  className={`w-full py-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    payments.length > 0 && isFullyCovered
                      ? 'bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {payments.length > 0 && isFullyCovered ? (
                    <span>✅ Total da Venda já Coberto ({fmtMoeda(totalFinal)})</span>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>
                        + Dividir / Adicionar Pagamento {
                          (cleanVal(paymentInputVal) || (currentMethod === 'dinheiro' ? cleanVal(cashTendered) : 0)) > 0
                            ? `de ${fmtMoeda(cleanVal(paymentInputVal) || cleanVal(cashTendered))}`
                            : (remaining > 0 ? `de ${fmtMoeda(remaining)}` : '')
                        }
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* LISTA DE PAGAMENTOS FRACIONADOS JÁ ADICIONADOS */}
              {payments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">Pagamentos Lançados nesta Venda:</span>
                    <button
                      type="button"
                      onClick={() => setPayments([])}
                      className="text-[10px] font-bold text-rose-400 hover:underline"
                    >
                      Limpar Pagamentos
                    </button>
                  </div>
                  {payments.map(p => {
                    const isBoletoItem = p.metodo === 'carne' || p.metodo === 'boleto';
                    const isRestanteItem = isBoletoItem || p.stage === 'restante';
                    return (
                      <div key={p.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div className="min-w-0 pr-2 flex items-center gap-1.5">
                          {!isBoletoItem ? (
                            <button
                              type="button"
                              onClick={() => togglePaymentStage(p.id)}
                              title="Clique para alternar entre Entrada (Pago Hoje) e Restante (Falta)"
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase border transition-all ${
                                isRestanteItem
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {isRestanteItem ? 'Restante' : 'Entrada'}
                            </button>
                          ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Restante
                            </span>
                          )}
                          <p className="font-bold text-white truncate">{p.texto}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-black ${isRestanteItem ? 'text-amber-400' : 'text-emerald-400'}`}>{fmtMoeda(p.valor)}</span>
                          <button
                            type="button"
                            onClick={() => removePayment(p.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            title="Remover Pagamento"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CAMPO DE DATA E HORÁRIO DA VENDA (OPÇÃO RETROATIVA/CUSTOMIZADA) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar size={14} className="text-sky-400 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-200 block text-[11px]">Data & Horário da Venda</span>
                      <span className="text-[9px] text-slate-400">Registrado em tudo: Venda, OS, Comprovante e Caixa</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setPosSaleDate(now.toISOString().slice(0, 10));
                      setPosSaleTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                    title="Definir data e horário para agora"
                  >
                    <Clock size={11} className="text-sky-400" />
                    Agora
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Data</label>
                    <input
                      type="date"
                      value={posSaleDate}
                      onChange={(e) => setPosSaleDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg px-2 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
                      title="Data do registro"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Horário</label>
                    <div className="relative">
                      <input
                        type="time"
                        value={posSaleTime}
                        onChange={(e) => setPosSaleTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg px-2 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
                        title="Horário do registro"
                      />
                    </div>
                  </div>
                </div>

                {posSaleDate !== new Date().toISOString().slice(0, 10) && (
                  <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                    <Info size={12} className="shrink-0 text-amber-400" />
                    <span>Data modificada: esta venda e suas movimentações financeiras serão registradas em <strong>{posSaleDate.split('-').reverse().join('/')} às {posSaleTime}</strong>.</span>
                  </div>
                )}
              </div>

              {/* BOTÃO PRINCIPAL: FINALIZAR VENDA NO CAIXA */}
              <button
                type="button"
                onClick={handleFinalizeSale}
                disabled={isFinalizingSale || cart.length === 0 || (payments.length > 0 && !isFullyCovered)}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl ${
                  isFinalizingSale
                    ? 'bg-emerald-600/60 text-white cursor-wait opacity-80'
                    : cart.length > 0 && (payments.length === 0 || isFullyCovered)
                      ? selectedClient
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/30 active:scale-[0.98] cursor-pointer'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 cursor-pointer shadow-lg shadow-sky-500/10'
                      : payments.length > 0 && !isFullyCovered
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {isFinalizingSale ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Finalizando Venda e Gerando Comprovante...</span>
                  </>
                ) : (
                  <>
                    {payments.length > 0 && !isFullyCovered ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    {cart.length === 0 
                      ? 'Adicione Produtos ao Carrinho' 
                      : !selectedClient 
                        ? 'Clique para Selecionar o Cliente' 
                        : payments.length > 0 && !isFullyCovered
                          ? `Falta Cobrir ${fmtMoeda(remaining)} (Adicione o Restante)`
                          : `Finalizar Venda no Caixa (${fmtMoeda(totalFinal)})`
                    }
                  </>
                )}
              </button>

            </div>
          </div>

        </div>

      </div>

      {/* ─── BARRA FLUTUANTE INFERIOR DO CARRINHO EM DISPOSITIVOS MÓVEIS ─── */}
      {mobileTab === 'produtos' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 animate-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={() => {
              setMobileTab('carrinho');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-black py-3 px-4 rounded-2xl shadow-2xl flex items-center justify-between border border-emerald-400/50 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-slate-950/20 text-slate-950">
                <ShoppingCart size={16} />
              </span>
              <span className="text-xs uppercase tracking-wide font-black">
                {cart.reduce((a, b) => a + b.qtd, 0)} {cart.reduce((a, b) => a + b.qtd, 0) === 1 ? 'item' : 'itens'} no carrinho
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-sm font-black">{fmtMoeda(totalFinal)}</span>
              <span className="text-[10px] font-black uppercase bg-slate-950 text-emerald-400 px-2 py-1 rounded-lg shadow-sm">
                Finalizar &rarr;
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ─── MODAL DE SUCESSO & IMPRESSÃO ─────────────────────────── */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Venda Concluída com Sucesso!</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Cliente: <span className="text-white">{completedSale.CLIENTE}</span>
              </p>
              <p className="text-2xl font-black text-emerald-400 mt-2">{fmtMoeda(completedSale.valorTotal)}</p>
              <div className="mt-2 space-y-1 text-left bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Pagamentos Efetuados:</span>
                {completedSale.pagamentosLista && completedSale.pagamentosLista.map((p, idx) => (
                  <p key={idx} className="text-slate-300">• {p.texto}</p>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handlePrintReceipt(completedSale)}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95"
              >
                <Receipt size={18} /> 🧾 Imprimir Comprovante de Venda
              </button>

              <button
                type="button"
                onClick={() => {
                  if (completedSale?.['OS DA VENDA'] && osPrintData) {
                    window.print();
                  } else {
                    setIsOSModalOpen(true);
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 active:scale-95"
              >
                <ClipboardList size={18} /> {completedSale?.isMultiOS && completedSale?.allLinkedOS ? `📋 Imprimir Ordens de Serviço (${completedSale.allLinkedOS.join(', ')})` : (completedSale?.['OS DA VENDA'] ? `📋 Imprimir Ordem de Serviço (${completedSale['OS DA VENDA']})` : '📋 Gerar e Imprimir Ordem de Serviço (OS)')}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (completedSale?.isMultiOS && Array.isArray(completedSale?.allLinkedOS)) {
                    const multiList = (osPrintData?.multiOrders && osPrintData.multiOrders.length > 0)
                      ? osPrintData.multiOrders.map(o => ({
                          ...completedSale,
                          ...o,
                          numeroOS: o.numeroOS,
                          osNumber: o.numeroOS,
                          OS: o.numeroOS,
                          'OS DA VENDA': o.numeroOS,
                          armacao: o.armacao || '',
                          lente: o.lente || '',
                          odEsf: o.odEsf || '',
                          odCil: o.odCil || '',
                          odEixo: o.odEixo || '',
                          odDnp: o.odDnp || '',
                          odAlt: o.odAlt || '',
                          oeEsf: o.oeEsf || '',
                          oeCil: o.oeCil || '',
                          oeEixo: o.oeEixo || '',
                          oeDnp: o.oeDnp || '',
                          oeAlt: o.oeAlt || '',
                          adicao: o.adicao || ''
                        }))
                      : completedSale.allLinkedOS.map(num => ({
                          ...completedSale,
                          numeroOS: num,
                          osNumber: num,
                          OS: num,
                          'OS DA VENDA': num
                        }));

                    setLabelModalData({
                      ...completedSale,
                      multiItems: multiList
                    });
                  } else {
                    setLabelModalData(completedSale);
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 text-amber-300 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Tag size={16} /> 🏷️ Imprimir Etiqueta Térmica (50x30mm)
              </button>

              <button
                type="button"
                onClick={handleResetForNewSale}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
              >
                ✨ Iniciar Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFICIAL DE GERAÇÃO DE OS (COM CÓDIGO POR CIDADE: CAJ, REG, JAC, EXT) */}
      {isOSModalOpen && savedClientForOS && (
        <OSGeneratorModal
          isOpen={isOSModalOpen}
          onClose={() => setIsOSModalOpen(false)}
          clientData={{
            ...savedClientForOS,
            itens: completedSale?.itens || savedClientForOS?.itens || cart || [],
            cart: completedSale?.itens || cart || [],
            saleId: completedSale?.id
          }}
          saleData={completedSale}
          selectedCity={selectedPOSCity || completedSale?.CIDADE || completedSale?.selectedCity || 'Cajati'}
          initialCity={selectedPOSCity || completedSale?.CIDADE || completedSale?.selectedCity || 'Cajati'}
          onSaveAndPrint={handleSaveOSFromModal}
          lentesData={erpLentes}
          armacoesData={erpArmacoes}
          salesData={salesData}
          currentUser={currentUser}
          receberData={receberData}
          clientsData={clientsData}
        />
      )}

      {/* COMPONENTE DE IMPRESSÃO DO COMPROVANTE DE VENDA */}
      {receiptPrintData && (
        <PrintableReceipt
          saleData={receiptPrintData}
          clientData={savedClientForOS || { 'Nome Completo': receiptPrintData?.CLIENTE }}
        />
      )}

      {/* COMPONENTE DE IMPRESSÃO DA ORDEM DE SERVIÇO OFICIAL */}
      {osPrintData && (
        <PrintableOS
          osData={{ ...osPrintData, itens: osPrintData.itens || completedSale?.itens || cart }}
          clientData={savedClientForOS || { 'Nome Completo': completedSale?.CLIENTE, itens: completedSale?.itens || cart }}
        />
      )}

      {/* COMPONENTE DE IMPRESSÃO DE SANGRIA / SUPRIMENTO / FECHAMENTO (80mm) */}
      {cashVoucherPrintData && (
        <PrintableCashVoucher
          type={cashVoucherPrintData.type}
          data={cashVoucherPrintData.data}
          unit={selectedPOSCity}
          operator={currentUser?.username || 'Caixa'}
        />
      )}

      {/* RELATÓRIO OFICIAL DE FECHAMENTO DE CAIXA EM PDF (A4) */}
      {cashClosingPdfData && (
        <PrintableCashClosingReport
          closingData={cashClosingPdfData.closingData}
          movements={cashClosingPdfData.movements}
          storeName={cashClosingPdfData.storeName || selectedPOSCity}
          periodLabel={cashClosingPdfData.periodLabel}
          reportTitle={cashClosingPdfData.reportTitle || cashClosingPdfData.title}
        />
      )}

      {/* MODAL DE CONTROLE DE CAIXA, TURNOS, SANGRIA & FECHAMENTO */}
      <CashManagementModal
        isOpen={cashModalState.isOpen}
        modalType={cashModalState.type}
        onClose={() => setCashModalState({ isOpen: false, type: 'ABERTURA' })}
        activeSession={activeSession}
        selectedCity={selectedPOSCity}
        currentUser={currentUser}
        cashMovements={cashMovements}
        salesData={salesData}
        onOpenCash={handleOpenCash}
        onAddSangria={handleAddSangria}
        onAddSuprimento={handleAddSuprimento}
        onCloseCash={handleCloseCash}
        onTriggerPrint={handleTriggerCashPrint}
      />

      {/* MODAL DE HISTÓRICO & AUDITORIA DE CAIXA */}
      <CashHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        cashMovements={cashMovements}
        salesData={salesData}
        receberData={receberData || data?.['CONTAS_RECEBER'] || []}
        selectedCity={selectedPOSCity}
        currentUser={currentUser}
        onTriggerPrint={handleTriggerCashPrint}
        onUpdateRow={onUpdateRow}
        onDeleteRow={onDeleteRow}
      />

      {/* MODAL DE IMPRESSÃO DE ETIQUETAS TÉRMICAS (50x30mm) */}
      <PrintableLabelModal
        isOpen={Boolean(labelModalData)}
        onClose={() => setLabelModalData(null)}
        data={labelModalData}
        defaultType={(labelModalData?.numeroOS || labelModalData?.OS || labelModalData?.['OS DA VENDA']) ? 'envelope_lab' : 'armacao'}
      />

      {/* ─── MODAL DE CADASTRO RÁPIDO DE CLIENTE (SEM PERDER O CARRINHO) ─── */}
      {isQuickClientModalOpen && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cadastro Rápido de Cliente</h3>
                  <p className="text-xs text-slate-400">Cadastre e vincule ao PDV sem perder os produtos do carrinho.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickClientModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {quickClientError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{quickClientError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!quickClientForm.nome.trim()) {
                  setQuickClientError('Por favor, informe o nome completo do cliente.');
                  return;
                }

                setIsSavingQuickClient(true);
                try {
                  const newClient = {
                    id: `cli_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    'Nome Completo': quickClientForm.nome.trim(),
                    'NOME': quickClientForm.nome.trim(),
                    'CPF / CNPJ': quickClientForm.cpf.trim(),
                    'CPF': quickClientForm.cpf.trim(),
                    'WhatsApp': quickClientForm.whatsapp.trim(),
                    'TELEFONE': quickClientForm.whatsapp.trim(),
                    'Cidade': quickClientForm.cidade || selectedPOSCity || currentUser?.city || 'Cajati',
                    'CIDADE': quickClientForm.cidade || selectedPOSCity || currentUser?.city || 'Cajati',
                    'OD_ESF': quickClientForm.odEsf.trim(),
                    'OE_ESF': quickClientForm.oeEsf.trim(),
                    'MEDICO': quickClientForm.medico.trim(),
                    'Status de Pagamento': 'Em dia',
                    'Valor Devido': '0,00',
                    'Data de Cadastro': new Date().toLocaleDateString('pt-BR')
                  };

                  if (onAddClient) {
                    await onAddClient(newClient);
                  }

                  setSelectedClient(newClient);
                  setIsQuickClientModalOpen(false);
                } catch (err) {
                  console.error('Erro ao salvar cliente rápido:', err);
                  setQuickClientError('Erro ao cadastrar cliente: ' + (err.message || err));
                } finally {
                  setIsSavingQuickClient(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Nome Completo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={quickClientForm.nome}
                  onChange={e => setQuickClientForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">CPF / CNPJ</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={quickClientForm.cpf}
                    onChange={e => {
                      let v = e.target.value.replace(/\D/g, '');
                      if (v.length <= 11) {
                        v = v.replace(/(\d{3})(\d)/, '$1.$2');
                        v = v.replace(/(\d{3})(\d)/, '$1.$2');
                        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                      }
                      setQuickClientForm(prev => ({ ...prev, cpf: v.slice(0, 14) }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">WhatsApp / Celular</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={quickClientForm.whatsapp}
                    onChange={e => {
                      let v = e.target.value.replace(/\D/g, '');
                      if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                      if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10, 14)}`;
                      setQuickClientForm(prev => ({ ...prev, whatsapp: v.slice(0, 15) }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Loja / Cidade</label>
                <select
                  value={quickClientForm.cidade || selectedPOSCity || 'Cajati'}
                  onChange={e => setQuickClientForm(prev => ({ ...prev, cidade: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                >
                  <option value="Cajati">Cajati</option>
                  <option value="Registro">Registro</option>
                  <option value="Jacupiranga">Jacupiranga</option>
                  <option value="Venda Externa">Venda Externa</option>
                </select>
              </div>

              {/* Prescrição Rápida Opcional */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-2.5">
                <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Glasses size={13} /> Grau / Receita Médica (Opcional)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="OD Esf (Ex: -1.50)"
                    value={quickClientForm.odEsf}
                    onChange={e => setQuickClientForm(prev => ({ ...prev, odEsf: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="OE Esf (Ex: -1.75)"
                    value={quickClientForm.oeEsf}
                    onChange={e => setQuickClientForm(prev => ({ ...prev, oeEsf: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="Médico Oftalmo"
                    value={quickClientForm.medico}
                    onChange={e => setQuickClientForm(prev => ({ ...prev, medico: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {onNavigateToNewClient && (
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        if (!window.confirm('Atenção: A tela de cadastro completo abrirá outra aba. Para não perder os itens do carrinho atual, recomendamos salvar pelo cadastro rápido. Deseja sair do PDV mesmo assim?')) {
                          return;
                        }
                      }
                      setIsQuickClientModalOpen(false);
                      onNavigateToNewClient();
                    }}
                    className="text-xs text-slate-400 hover:text-sky-400 underline font-medium"
                  >
                    Abrir cadastro completo (com anexos)
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsQuickClientModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuickClient}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-sky-600/20 flex items-center gap-1.5"
                  >
                    {isSavingQuickClient ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Salvar e Selecionar no PDV</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default POSRegister;
