import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Save, Printer, User, Eye, FileText, Calendar, DollarSign, 
  Activity, CheckCircle2, AlertTriangle, Trash2, Plus, CreditCard, 
  QrCode, Glasses, Layers, Copy, Info, MapPin, Tag, FlaskConical, ClipboardList,
  AlertOctagon, Sparkles
} from 'lucide-react';

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
  const num = typeof val === 'number' ? (isNaN(val) ? 0 : val) : parseCurrency(val);
  return Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const ensureIsoDate = (dStr) => {
  if (!dStr) return '';
  const s = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const parts = s.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return '';
};

export const ensureBrDate = (dStr) => {
  if (!dStr) return '';
  const s = String(dStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return s;
};

const parseInitialPayments = (clientData, saleData = {}) => {
  if (!clientData && !saleData) return [];
  const merged = { ...(saleData || {}), ...(clientData || {}) };
  let parcs = [];
  try {
    if (Array.isArray(merged['parcelas']) && merged['parcelas'].length > 0) {
      parcs = merged['parcelas'];
    } else if (merged['PARCELAS_JSON']) {
      parcs = typeof merged['PARCELAS_JSON'] === 'string' ? JSON.parse(merged['PARCELAS_JSON']) : merged['PARCELAS_JSON'];
    }
  } catch (e) {}

  const vFormas = merged['formasPagamento'] || merged['FORMAS_PAGAMENTO'] || merged['FORMA_PAGTO'] || merged['FORMA DE PAGAMENTO'] || merged['MEIO_PAGAMENTO'] || '';
  if (!vFormas && (!parcs || parcs.length === 0)) return [];

  const lines = String(vFormas)
    .replace(/(?:FORMA DE PAGAMENTO|FORMA_PAGTO|FORMA_PAGAMENTO|MEIO_PAGAMENTO)\s*:\s*/gi, '')
    .split(/\n|\s*\+\s*/)
    .map(l => l.trim())
    .filter(Boolean);

  const clientEntradaVal = parseCurrency(merged['valorEntrada'] || merged['VALOR ENTRADA'] || merged['SINAL'] || 0);
  const clientRestanteVal = parseCurrency(merged['restante'] || merged['RESTANTE'] || 0);
  let accumulatedEntrada = 0;

  const parsed = [];
  if (lines.length === 0 && parcs && parcs.length > 0) {
    const totalParcs = parcs.reduce((s, p) => s + (parseCurrency(p.valor || p.VALOR) || 0), 0) || clientRestanteVal;
    parsed.push({
      id: `init_pay_${Date.now()}_0`,
      method: 'Boleto',
      stage: 'restante',
      valor: totalParcs,
      installments: parcs.length,
      parcelas: parcs,
      texto: `📄 Boleto (${parcs.length}x): R$ ${formatCurrency(totalParcs)}`
    });
    return parsed;
  }

  lines.forEach((line, idx) => {
    let method = 'Dinheiro';
    if (/pix/i.test(line)) method = 'PIX';
    else if (/d[eé]bito/i.test(line)) method = 'Débito';
    else if (/cr[eé]dito/i.test(line)) method = 'Crédito';
    else if (/boleto|carn[eê]/i.test(line)) method = 'Boleto';
    else if (/combinar|retirada|entrega/i.test(line)) method = 'A Combinar na Retirada';

    const matchX = line.match(/(\d+)x/i);
    const n = matchX ? parseInt(matchX[1], 10) : 1;

    let val = 0;
    const matchTotal = line.match(/Total:\s*R?\$?\s*([\d.,]+)/i);
    if (matchTotal) {
      val = parseCurrency(matchTotal[1]);
    } else {
      const matchVal = [...line.matchAll(/R\$\s*([\d.,]+)/gi)];
      if (matchVal.length > 0) {
        val = parseCurrency(matchVal[matchVal.length - 1][1]);
      }
    }

    const numericVal = val || (parseCurrency(merged['valorTotal'] || merged['VALOR TOTAL'] || merged['VALOR DA VENDA']) || 0);
    let stage = 'entrada';
    if (method === 'Boleto' || /restante|falta|na retirada|na entrega|a pagar|a prazo/i.test(line)) {
      stage = 'restante';
    } else if (!/entrada|sinal/i.test(line) && clientRestanteVal > 0 && clientEntradaVal > 0 && accumulatedEntrada >= clientEntradaVal - 0.05 && Math.abs(numericVal - clientRestanteVal) < 0.05) {
      stage = 'restante';
    } else if (!/entrada|sinal/i.test(line) && clientEntradaVal === 0 && clientRestanteVal > 0 && Math.abs(numericVal - clientRestanteVal) < 0.05) {
      stage = 'restante';
    }

    if (stage === 'entrada') {
      accumulatedEntrada += numericVal;
    }

    parsed.push({
      id: `init_pay_${Date.now()}_${idx}`,
      method,
      stage,
      valor: numericVal,
      installments: n,
      parcelas: method === 'Boleto' ? (parcs && parcs.length > 0 ? parcs : []) : [],
      texto: line
    });
  });

  return parsed;
};

const formatMethodDisplayName = (method, installments = 1) => {
  if (!method) return '';
  const n = parseInt(installments, 10) || 1;
  if (method === 'Crédito' || method === 'Cartão de Crédito') {
    return n > 1 ? `Cartão de Crédito (${n}x)` : 'Cartão de Crédito';
  }
  if (method === 'Débito' || method === 'Cartão de Débito') {
    return 'Cartão de Débito';
  }
  if (method === 'Boleto') {
    return n > 1 ? `Boleto (${n}x)` : 'Boleto';
  }
  return method;
};

const OSGeneratorModal = ({ 
  isOpen, 
  onClose, 
  clientData, 
  saleData,
  onSaveAndPrint, 
  lentesData = [], 
  armacoesData = [], 
  salesData = [], 
  currentUser,
  receberData = [],
  clientsData = [],
  selectedCity: propSelectedCity = '',
  initialCity = ''
}) => {
  const [selectedCity, setSelectedCity] = useState('');
  const [baseOSNumber, setBaseOSNumber] = useState('');
  
  // Lista de Ordens de Serviço para suportar 1 ou MÚLTIPLAS OS na mesma venda
  const [osList, setOsList] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

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
  // 🛡️ Apenas fixa a cidade do vendedor se ela estiver explicitamente preenchida no cadastro do usuário (sem forçar Cajati indevidamente)
  const userCity = (isVendor && !isExternalVendor) ? (currentUser?.city || currentUser?.assignedStore || null) : null;
  const filteredLentes = userCity 
    ? lentesData.filter(l => {
        const u = String(l.UNIDADE || l.CIDADE || l.LOJA || l.Unidade || '').trim().toUpperCase();
        return u && u !== 'CENTRAL' && u.includes(userCity.toUpperCase());
      })
    : lentesData;
  const filteredArmacoes = userCity 
    ? armacoesData.filter(a => {
        const u = String(a.UNIDADE || a.CIDADE || a.LOJA || a.Unidade || '').trim().toUpperCase();
        return u && u !== 'CENTRAL' && u.includes(userCity.toUpperCase());
      })
    : armacoesData;

  // ─── AUDITORIA AUTOMÁTICA DE INADIMPLÊNCIA DO RESPONSÁVEL LEGAL ────────────
  const responsavelDebtCheck = useMemo(() => {
    if (!clientData) return null;

    const respName = String(
      clientData['Responsável Nome'] || 
      clientData['Responsável'] || 
      clientData['responsavel'] || 
      ''
    ).trim();

    const respCpf = String(
      clientData['Responsável CPF'] || 
      clientData['responsavelCpf'] || 
      ''
    ).replace(/\D/g, '');

    if (!respName && !respCpf) return null;

    const clean = (str) => String(str || '').toLowerCase().trim();
    const cleanDigits = (str) => String(str || '').replace(/\D/g, '');

    // 1. Varrer CONTAS_RECEBER por duplicatas/parcelas do responsável
    const respInvoices = (receberData || []).filter(inv => {
      const invCpf = cleanDigits(inv.CPF || inv.cpf || inv['CPF / CNPJ']);
      if (respCpf && invCpf && invCpf === respCpf) return true;

      const invClient = clean(inv.CLIENTE || inv.cliente || inv['Nome Completo']);
      if (respName && invClient && invClient === clean(respName)) return true;

      return false;
    });

    let totalAberto = 0;
    let totalVencido = 0;
    let hasOverdue = false;
    const todayStr = new Date().toISOString().split('T')[0];

    respInvoices.forEach(inv => {
      const val = parseCurrency(inv.VALOR || inv.valor || 0);
      const st = String(inv.STATUS || inv.status || 'Pendente').trim().toLowerCase();
      const isPaid = st.includes('recebido') || st.includes('pago');
      const dtVenc = String(inv.DATA_VENCIMENTO || inv['DATA VENCIMENTO'] || inv.VENCIMENTO || '');

      if (!isPaid) {
        totalAberto += val;
        const isoVenc = ensureIsoDate(dtVenc);
        if (isoVenc && isoVenc < todayStr) {
          hasOverdue = true;
          totalVencido += val;
        }
      }
    });

    // 2. Verificar se o Responsável possui cadastro próprio em CLIENTES_CADASTRADOS
    if (respInvoices.length === 0 && Array.isArray(clientsData) && clientsData.length > 0) {
      const respClient = clientsData.find(c => {
        const cCpf = cleanDigits(c['CPF'] || c['cpf']);
        if (respCpf && cCpf && cCpf === respCpf) return true;
        const cName = clean(c['Nome Completo'] || c['NOME']);
        if (respName && cName && cName === clean(respName)) return true;
        return false;
      });

      if (respClient) {
        const dev = parseCurrency(respClient['Valor Devido'] || respClient['VALOR DEVIDO'] || 0);
        const stCad = String(respClient['Status de Pagamento'] || '').toLowerCase();
        if (dev > 0 || stCad.includes('inadimplente')) {
          totalAberto = dev;
          totalVencido = dev;
          hasOverdue = true;
        }
      }
    }

    const isInadimplente = hasOverdue || totalVencido > 0 || (totalAberto > 0 && respInvoices.length > 0);

    return {
      respName: respName || 'Responsável Legal',
      respCpf: respCpf ? respCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '',
      totalAberto,
      totalVencido: totalVencido > 0 ? totalVencido : totalAberto,
      hasOverdue,
      isInadimplente: isInadimplente || totalAberto > 0,
      countInvoices: respInvoices.length
    };
  }, [clientData, receberData, clientsData]);

  // Flag para controle de valor total digitado manualmente pelo operador
  const [isManualTotal, setIsManualTotal] = useState(false);

  // Helper para buscar preço de produto no catálogo
  const getItemPrice = (name, list) => {
    if (!name || !Array.isArray(list) || list.length === 0) return 0;
    const cleanName = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!cleanName || cleanName === 'armação própria' || cleanName === 'não informada' || cleanName === 'propria' || cleanName === 'própria') return 0;

    const found = list.find(item => {
      const brand = String(item.MARCA || item.marca || '').trim().toLowerCase();
      const model = String(item.MODELO || item.modelo || '').trim().toLowerCase();
      const brandModel = `${brand} ${model}`.trim().replace(/\s+/g, ' ');
      const itemDesc = String(item.DESCRICAO || item.descricao || item.PRODUTO || item.produto || item.NOME || item.nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const sku = String(item.REFERENCIA_SKU || item.referencia_sku || item.SKU || item.sku || item.CODIGO || item.codigo || '').trim().toLowerCase();

      return (brandModel && brandModel === cleanName) || 
             (itemDesc && itemDesc === cleanName) || 
             (model && model === cleanName) || 
             (sku && sku === cleanName) ||
             (brandModel && cleanName.startsWith(brandModel)) || 
             (itemDesc && cleanName.startsWith(itemDesc)) ||
             (cleanName.length >= 3 && brandModel && brandModel.startsWith(cleanName));
    });

    if (found) {
      const rawPrice = found.PRECO_VENDA !== undefined ? found.PRECO_VENDA : (
        found.preco_venda !== undefined ? found.preco_venda : (
          found.VALOR_VENDA !== undefined ? found.VALOR_VENDA : (
            found['PREÇO'] !== undefined ? found['PREÇO'] : (
              found.PRECO !== undefined ? found.PRECO : 0
            )
          )
        )
      );
      return parseCurrency(rawPrice);
    }
    return 0;
  };

  // Soma dinâmica de todos os produtos escolhidos em todas as OSs
  const calculateTotalFromOSList = (list) => {
    let sum = 0;
    const allLentes = lentesData?.length ? lentesData : filteredLentes;
    const allArmacoes = armacoesData?.length ? armacoesData : filteredArmacoes;
    (list || []).forEach(os => {
      if (os.lente) {
        sum += getItemPrice(os.lente, allLentes);
      }
      if (os.armacao) {
        sum += getItemPrice(os.armacao, allArmacoes);
      }
    });
    return sum;
  };

  // Payment builder state
  const [payMethod, setPayMethod] = useState('Dinheiro');
  const [payStage, setPayStage] = useState('entrada'); // 'entrada' | 'restante'
  const [payValue, setPayValue] = useState('');
  const [payInstallments, setPayInstallments] = useState('1');
  const [payFirstDueDate, setPayFirstDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [osCustomDueDates, setOsCustomDueDates] = useState({});
  const [payments, setPayments] = useState([]);

  const syncPaymentsToFormData = (payList, currentTotal) => {
    const total = currentTotal !== undefined ? parseCurrency(currentTotal) : parseCurrency(formData.valorTotal);
    const entradaPayments = payList.filter(p => p.method !== 'Boleto' && p.stage !== 'restante');
    const restantePayments = payList.filter(p => p.method === 'Boleto' || p.stage === 'restante');

    const entrada = entradaPayments.reduce((sum, p) => sum + p.valor, 0);
    const restanteFromList = restantePayments.reduce((sum, p) => sum + p.valor, 0);
    const allParcelas = payList.filter(p => p.method === 'Boleto').flatMap(p => p.parcelas || []);
    
    const rest = restanteFromList > 0 ? restanteFromList : Math.max(0, total - entrada);
    const cleanTexts = payList.map(p => p.texto.trim()).filter(Boolean);
    const textoFinal = cleanTexts.join('\n');

    const derivedFormaEntrada = [...new Set(entradaPayments.map(p => formatMethodDisplayName(p.method, p.installments)).filter(Boolean))].join(' + ');
    const derivedFormaRestante = [...new Set(restantePayments.map(p => formatMethodDisplayName(p.method, p.installments)).filter(Boolean))].join(' + ');

    let selectFormaRestante = derivedFormaRestante;
    let nextParcelasRestante = null;
    if (restantePayments.length === 1) {
      const rp = restantePayments[0];
      if (rp.method === 'Crédito' || rp.method === 'Cartão de Crédito') {
        selectFormaRestante = 'Cartão de Crédito';
        nextParcelasRestante = String(rp.installments || 1);
      } else if (rp.method === 'Boleto') {
        selectFormaRestante = 'Boleto';
      } else if (rp.method === 'Débito' || rp.method === 'Cartão de Débito') {
        selectFormaRestante = 'Cartão de Débito';
      }
    }

    setFormData(prev => ({
      ...prev,
      valorEntrada: entrada > 0 ? formatCurrency(entrada) : '0,00',
      restante: rest > 0 ? formatCurrency(rest) : '0,00',
      formaPagamentoEntrada: derivedFormaEntrada || (entrada > 0 ? prev.formaPagamentoEntrada : ''),
      formaPagamentoRestante: selectFormaRestante || (rest > 0 ? (prev.formaPagamentoRestante || (allParcelas.length > 0 ? 'Boleto' : '')) : ''),
      parcelasRestante: nextParcelasRestante || prev.parcelasRestante || '1',
      formasPagamento: textoFinal,
      parcelas: allParcelas
    }));
  };

  const buildPaymentText = (method, v, n, stage, parcelasDetalhe = []) => {
    const formattedV = formatCurrency(v);
    const isRestante = method === 'Boleto' || stage === 'restante';
    const stageTag = isRestante && method !== 'Boleto' ? ' (Restante)' : '';

    if (method === 'PIX') {
      return `⚡ PIX${stageTag}: R$ ${formattedV}`;
    }
    if (method === 'Débito') {
      return `💳 Cartão Débito${stageTag}: R$ ${formattedV}`;
    }
    if (method === 'Crédito') {
      if (n > 1) {
        const parcVal = (v / n).toFixed(2).replace('.', ',');
        return `💳 Cartão Crédito (${isRestante ? `Restante - ` : ''}${n}x de R$ ${parcVal}): R$ ${formattedV}`;
      }
      return `💳 Cartão Crédito (${isRestante ? 'Restante - ' : ''}1x à vista): R$ ${formattedV}`;
    }
    if (method === 'Boleto') {
      const parcVal = (v / n).toFixed(2).replace('.', ',');
      const vencsTextoArr = (parcelasDetalhe || []).map((p, idx) => {
        const parts = String(p.vencimento || '').split('-');
        const ptDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : p.vencimento;
        return `${p.numero || idx + 1}ª ${ptDate}`;
      });
      return `📄 Boleto (${n}x de R$ ${parcVal} | Venc: ${vencsTextoArr.join(', ')}): R$ ${formattedV}`;
    }
    if (method === 'A Combinar na Retirada') {
      return `🤝 A Combinar na Retirada (Restante): R$ ${formattedV}`;
    }
    return `💵 Dinheiro${stageTag}: R$ ${formattedV}`;
  };

  const handleAddPayment = () => {
    if (!payValue) return;
    const v = parseCurrency(payValue);
    if (v <= 0) return;
    const n = parseInt(payInstallments, 10) || 1;
    const effectiveStage = payMethod === 'Boleto' ? 'restante' : payStage;
    
    let parcelasDetalhe = [];

    if (payMethod === 'Boleto') {
      const parcVal = (v / n).toFixed(2).replace('.', ',');
      const baseDate = payFirstDueDate ? new Date(payFirstDueDate + 'T12:00:00') : new Date();

      for (let i = 1; i <= n; i++) {
        let calculatedDate = '';
        if (osCustomDueDates[i]) {
          calculatedDate = osCustomDueDates[i];
        } else {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + 30 * (i - 1));
          calculatedDate = d.toISOString().split('T')[0];
        }

        parcelasDetalhe.push({
          numero: i,
          totalParcelas: n,
          valor: parcVal,
          vencimento: calculatedDate
        });
      }
    }

    const text = buildPaymentText(payMethod, v, n, effectiveStage, parcelasDetalhe);

    const newPayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      method: payMethod,
      stage: effectiveStage,
      valor: v,
      installments: n,
      parcelas: parcelasDetalhe,
      texto: text
    };

    const nextPayments = [...payments, newPayment];
    setPayments(nextPayments);
    syncPaymentsToFormData(nextPayments);

    setPayValue('');
    setPayInstallments('1');
    setOsCustomDueDates({});
    // Se acabou de adicionar uma Entrada e ainda há saldo restante a cobrir, sugere o próximo como Restante
    const total = parseCurrency(formData.valorTotal);
    const nextCovered = nextPayments.reduce((sum, p) => sum + p.valor, 0);
    if (effectiveStage === 'entrada' && total > nextCovered + 0.01) {
      setPayStage('restante');
    } else {
      setPayStage('entrada');
    }
  };

  const handleTogglePaymentStage = (id) => {
    const nextPayments = payments.map(p => {
      if (p.id !== id || p.method === 'Boleto') return p;
      const nextStage = p.stage === 'restante' ? 'entrada' : 'restante';
      return {
        ...p,
        stage: nextStage,
        texto: buildPaymentText(p.method, p.valor, p.installments || 1, nextStage, p.parcelas)
      };
    });
    setPayments(nextPayments);
    syncPaymentsToFormData(nextPayments);
  };

  const handleRemovePayment = (id) => {
    const nextPayments = payments.filter(p => p.id !== id);
    setPayments(nextPayments);
    syncPaymentsToFormData(nextPayments);
  };

  const handleClearPayments = () => {
    setPayments([]);
    syncPaymentsToFormData([]);
  };

  const handleFillRemaining = () => {
    const total = parseCurrency(formData.valorTotal);
    const covered = payments.reduce((sum, p) => sum + p.valor, 0);
    const entradaManual = payments.length === 0 ? parseCurrency(formData.valorEntrada) : 0;
    const remaining = Math.max(0, total - (covered > 0 ? covered : entradaManual));
    if (remaining > 0) {
      setPayValue(formatCurrency(remaining));
      const hasEntradaAlready = payments.some(p => p.method !== 'Boleto' && p.stage !== 'restante') || entradaManual > 0;
      if (hasEntradaAlready && payMethod !== 'Boleto') {
        setPayStage('restante');
      }
    }
  };

  const [formData, setFormData] = useState({
    medico: '',
    dataVenda: new Date().toISOString().split('T')[0],
    dataEntrega: '',
    lente: '',
    armacao: '',
    odEsf: '', odCil: '', odEixo: '', odDnp: '', odAlt: '', odDp: '', odOpa: '',
    oeEsf: '', oeCil: '', oeEixo: '', oeDnp: '', oeAlt: '', oeDp: '', oeOpa: '',
    odPertoEsf: '', odPertoCil: '', odPertoEixo: '', odPertoDnp: '', odPertoAlt: '', odPertoDp: '', odPertoOpa: '',
    oePertoEsf: '', oePertoCil: '', oePertoEixo: '', oePertoDnp: '', oePertoAlt: '', oePertoDp: '', oePertoOpa: '',
    adicao: '',
    valorTotal: '',
    valorEntrada: '',
    restante: '',
    formaPagamentoEntrada: '',
    formaPagamentoRestante: '',
    parcelasRestante: '1',
    observacoes: '',
    numeroOS: '',
    formasPagamento: '',
    parcelas: [],
    responsavel: '',
    voucher: '',
    rg: '',
    laboratorio: ''
  });

  // Calcula o prefixo da unidade selecionada
  const getCityPrefix = (city) => {
    if (city === 'Cajati') return 'CAJ';
    if (city === 'Registro') return 'REG';
    if (city === 'Jacupiranga') return 'JAC';
    if (city === 'Venda Externa') return 'EXT';
    return 'CAJ';
  };

  // Calcula o próximo número base de OS devidamente formatado (Ex: CAJ-001, REG-001)
  const calculateNextBaseOS = (city, sData) => {
    const prefix = getCityPrefix(city);
    let maxNum = 0;
    (sData || []).forEach(sale => {
      const os = sale['OS DA VENDA'] || sale['OS'] || sale['VENDA_OS'];
      if (os && String(os).toUpperCase().startsWith(prefix.toUpperCase())) {
        const cleanNumPart = String(os).replace(new RegExp(`^${prefix}[-#\\s]?`, 'i'), '');
        const numPart = parseInt(cleanNumPart, 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Inicialização quando clientData abre
  useEffect(() => {
    if (clientData && isOpen) {
      const vTotal = clientData['valorTotal'] || 
        (saleData?.['VALOR TOTAL'] ? String(saleData['VALOR TOTAL']) : '') || 
        (saleData?.['VALOR DA VENDA'] ? String(saleData['VALOR DA VENDA']) : '') || 
        (saleData?.valorTotal ? String(saleData.valorTotal) : '') || 
        (clientData['VALOR TOTAL'] ? String(clientData['VALOR TOTAL']) : '') || 
        (clientData['VALOR DA VENDA'] ? String(clientData['VALOR DA VENDA']) : '') || 
        (clientData['VALOR DO ORÇAMENTO'] ? String(clientData['VALOR DO ORÇAMENTO']) : '') || '';
      const vFormas = clientData['formasPagamento'] || clientData['FORMA_PAGTO'] || clientData['FORMA DE PAGAMENTO'] || saleData?.['FORMAS_PAGAMENTO'] || saleData?.['FORMA_PAGTO'] || saleData?.['formasPagamento'] || '';
      const isBoletoOrCarne = /boleto|carnê|carne/i.test(vFormas);
      const vEntrada = clientData['valorEntrada'] !== undefined && clientData['valorEntrada'] !== '' 
        ? clientData['valorEntrada'] 
        : (saleData?.['VALOR ENTRADA'] !== undefined && saleData?.['VALOR ENTRADA'] !== '' 
            ? saleData['VALOR ENTRADA'] 
            : (saleData?.['SINAL'] !== undefined && saleData?.['SINAL'] !== '' 
                ? saleData['SINAL'] 
                : (isBoletoOrCarne ? '0,00' : (clientData['restante'] ? '0,00' : vTotal))));
      const vRestante = clientData['restante'] !== undefined && clientData['restante'] !== '' 
        ? clientData['restante'] 
        : (saleData?.['RESTANTE'] !== undefined && saleData?.['RESTANTE'] !== '' 
            ? saleData['RESTANTE'] 
            : (saleData?.['restante'] !== undefined && saleData?.['restante'] !== '' 
                ? saleData['restante'] 
                : (isBoletoOrCarne ? vTotal : '0,00')));
      // 🛡️ Ordem de Prioridade Soberana para a Loja/Unidade da OS:
      // 1. Loja ativa informada pelo chamador (propSelectedCity / initialCity do PDV)
      // 2. Unidade registrada na Venda (saleData.UNIDADE / CIDADE / LOJA / selectedCity)
      // 3. Unidade indicada explicitamente no clientData como loja (selectedCity / UNIDADE / LOJA)
      // 4. Unidade fixa do Vendedor logado (se configurada)
      // 5. Fallback na cidade residencial do cliente ou padrão Cajati
      const saleCityCandidate = propSelectedCity || initialCity ||
        saleData?.['UNIDADE'] || saleData?.['CIDADE'] || saleData?.['LOJA'] || saleData?.['selectedCity'] || saleData?.cidade ||
        clientData?.['selectedCity'] || clientData?.['UNIDADE'] || clientData?.['LOJA'];

      const vCidade = saleCityCandidate || userCity || clientData?.['Cidade'] || clientData?.['CIDADE'] || 'Cajati';
      const initialPayments = parseInitialPayments(clientData, saleData);
      setPayments(initialPayments);

      const initEntradaPay = initialPayments.filter(p => p.method !== 'Boleto' && p.stage !== 'restante');
      const initRestantePay = initialPayments.filter(p => p.method === 'Boleto' || p.stage === 'restante');
      const derivedInitEntrada = [...new Set(initEntradaPay.map(p => formatMethodDisplayName(p.method, p.installments)).filter(Boolean))].join(' + ');
      const derivedInitRestante = [...new Set(initRestantePay.map(p => formatMethodDisplayName(p.method, p.installments)).filter(Boolean))].join(' + ');

      const vFormaEntrada = clientData['formaPagamentoEntrada'] || clientData['FORMA_ENTRADA'] || saleData?.['FORMA_ENTRADA'] || derivedInitEntrada || '';
      const rawFormaRestanteInit = clientData['formaPagamentoRestante'] || clientData['FORMA_RESTANTE'] || saleData?.['FORMA_RESTANTE'] || derivedInitRestante || (isBoletoOrCarne ? 'Boleto' : '');
      const cardMatchInit = String(rawFormaRestanteInit).match(/^Cartão de Crédito\s*\((\d+)x\)$/i);
      const boletoMatchInit = String(rawFormaRestanteInit).match(/^Boleto\s*\((\d+)x\)$/i);
      const vFormaRestante = cardMatchInit
        ? 'Cartão de Crédito'
        : boletoMatchInit
        ? 'Boleto'
        : rawFormaRestanteInit;
      const vParcelasRestante = String(
        clientData['parcelasRestante'] ||
        clientData['PARCELAS_RESTANTE'] ||
        saleData?.['PARCELAS_RESTANTE'] ||
        (cardMatchInit ? cardMatchInit[1] : (initRestantePay.length === 1 && initRestantePay[0].method === 'Crédito' ? initRestantePay[0].installments : '1')) ||
        '1'
      );

      const targetCity = vCidade || 'Cajati';
      setSelectedCity(targetCity);

      const existingOS = clientData['OS DA VENDA'] || clientData['OS'] || clientData['numeroOS'] || saleData?.['OS DA VENDA'] || saleData?.['OS'];
      const nextBase = (existingOS && /\d/.test(String(existingOS))) 
        ? String(existingOS).replace(/-\d+$/, '').toUpperCase().trim() 
        : calculateNextBaseOS(targetCity, salesData);
      setBaseOSNumber(nextBase);

      // Detectar itens ópticos do carrinho para sugerir 1 ou múltiplas OS
      const rawItens = clientData.itens || clientData.cart || saleData?.itens || saleData?.cart || [];
      const extractedFrames = [];
      const extractedLenses = [];
      if (Array.isArray(rawItens) && rawItens.length > 0) {
        rawItens.forEach(item => {
          const qtd = Math.max(1, parseInt(item.qtd || 1, 10));
          const t = item.type || '';
          const sheet = item.rawProduct?.sheetName || item.sheetName || '';
          const name = String(item.nome || item.descricao || '');

          const isLens = t === 'lentes' || sheet === 'CAD_LENTES' || (/lente/i.test(name) && !/armaç[aã]o/i.test(name));
          const isFrame = !isLens && (t === 'armacoes' || sheet === 'CAD_ARMACOES' || /armaç[aã]o/i.test(name) || (item.rawProduct && item.rawProduct['MODELO'] && t !== 'brindes' && t !== 'avulso'));

          for (let i = 0; i < qtd; i++) {
            if (isFrame) extractedFrames.push(name || '');
            if (isLens) extractedLenses.push(name || '');
          }
        });
      }

      const pairCount = Math.max(extractedFrames.length, extractedLenses.length);
      const initialCount = pairCount >= 2 ? pairCount : 1;

      const rawSaleDate = saleData?.['DATA  DA VENDA'] || saleData?.['DATA DA VENDA'] || saleData?.['DATA_VENDA'] || saleData?.['Data da Venda'] || saleData?.['DATA'] || clientData?.['dataVenda'] || clientData?.['DATA  DA VENDA'] || clientData?.['DATA DA VENDA'] || clientData?.['DATA'];
      const initialSaleDateIso = ensureIsoDate(rawSaleDate) || new Date().toISOString().split('T')[0];

      const generatedList = [];
      for (let i = 0; i < initialCount; i++) {
        const osNum = initialCount > 1 ? `${nextBase}-${i + 1}` : nextBase;
        generatedList.push({
          id: `os_tab_${Date.now()}_${i}`,
          label: `Óculos ${i + 1}`,
          nomePessoa: i === 0 
            ? (clientData['Nome Completo'] || clientData['CLIENTE'] || clientData['Nome'] || '') 
            : (clientData['nomePessoa'] || clientData['PACIENTE'] || ''),
          numeroOS: osNum,
          medico: clientData['medico'] || clientData['MEDICO'] || '',
          dataVenda: initialSaleDateIso,
          dataEntrega: ensureIsoDate(clientData['dataEntrega'] || clientData['PREVISAO_ENTREGA'] || '') || clientData['dataEntrega'] || clientData['PREVISAO_ENTREGA'] || '',
          laboratorio: clientData['LABORATORIO'] || clientData['laboratorio'] || '',
          lente: extractedLenses[i] || (i === 0 ? (clientData['Marca de Lente'] || clientData['Lente'] || clientData['lente'] || '') : ''),
          armacao: extractedFrames[i] || (i === 0 ? (clientData['Modelo de Armação'] || clientData['Armação'] || clientData['armacao'] || '') : ''),
          odEsf: i === 0 ? (clientData['OD_ESF'] || clientData['odEsf'] || '') : '',
          odCil: i === 0 ? (clientData['OD_CIL'] || clientData['odCil'] || '') : '',
          odEixo: i === 0 ? (clientData['OD_EIXO'] || clientData['odEixo'] || '') : '',
          odDnp: i === 0 ? (clientData['OD_DNP'] || clientData['odDnp'] || '') : '',
          odAlt: i === 0 ? (clientData['OD_ALT'] || clientData['odAlt'] || '') : '',
          odDp: '', odOpa: '',
          oeEsf: i === 0 ? (clientData['OE_ESF'] || clientData['oeEsf'] || '') : '',
          oeCil: i === 0 ? (clientData['OE_CIL'] || clientData['oeCil'] || '') : '',
          oeEixo: i === 0 ? (clientData['OE_EIXO'] || clientData['oeEixo'] || '') : '',
          oeDnp: i === 0 ? (clientData['OE_DNP'] || clientData['oeDnp'] || '') : '',
          oeAlt: i === 0 ? (clientData['OE_ALT'] || clientData['oeAlt'] || '') : '',
          oeDp: '', oeOpa: '',
          odPertoEsf: i === 0 ? (clientData['OD_PERTO_ESF'] || clientData['odPertoEsf'] || '') : '',
          odPertoCil: i === 0 ? (clientData['OD_PERTO_CIL'] || clientData['odPertoCil'] || '') : '',
          odPertoEixo: i === 0 ? (clientData['OD_PERTO_EIXO'] || clientData['odPertoEixo'] || '') : '',
          odPertoDnp: i === 0 ? (clientData['OD_PERTO_DNP'] || clientData['odPertoDnp'] || '') : '',
          odPertoAlt: i === 0 ? (clientData['OD_PERTO_ALT'] || clientData['odPertoAlt'] || '') : '',
          odPertoDp: '', odPertoOpa: '',
          oePertoEsf: i === 0 ? (clientData['OE_PERTO_ESF'] || clientData['oePertoEsf'] || '') : '',
          oePertoCil: i === 0 ? (clientData['OE_PERTO_CIL'] || clientData['oePertoCil'] || '') : '',
          oePertoEixo: i === 0 ? (clientData['OE_PERTO_EIXO'] || clientData['oePertoEixo'] || '') : '',
          oePertoDnp: i === 0 ? (clientData['OE_PERTO_DNP'] || clientData['oePertoDnp'] || '') : '',
          oePertoAlt: i === 0 ? (clientData['OE_PERTO_ALT'] || clientData['oePertoAlt'] || '') : '',
          oePertoDp: '', oePertoOpa: '',
          adicao: i === 0 ? (clientData['ADICAO'] || clientData['adicao'] || '') : '',
          observacoes: i === 0 ? (clientData['observacoes'] || clientData['OBSERVACOES'] || '') : '',
          selectedCity: targetCity,
          unidade: targetCity,
          valorTotal: ''
        });
      }

      setOsList(generatedList);
      setActiveTabIndex(0);

      const initialHasPriorTotal = parseCurrency(vTotal) > 0;
      setIsManualTotal(initialHasPriorTotal);

      const autoCalculatedSum = calculateTotalFromOSList(generatedList);
      const effectiveTotal = initialHasPriorTotal 
        ? vTotal 
        : (autoCalculatedSum > 0 ? formatCurrency(autoCalculatedSum) : (vTotal || '0,00'));

      const numEffTotal = parseCurrency(effectiveTotal);
      const numEffEntrada = parseCurrency(vEntrada);
      const effectiveRestante = initialHasPriorTotal || parseCurrency(vRestante) > 0
        ? vRestante 
        : (numEffTotal > numEffEntrada ? formatCurrency(numEffTotal - numEffEntrada) : '0,00');

      setFormData(prev => ({
        ...prev,
        medico: clientData['medico'] || clientData['MEDICO'] || '',
        dataVenda: initialSaleDateIso,
        dataEntrega: ensureIsoDate(clientData['dataEntrega'] || clientData['PREVISAO_ENTREGA'] || '') || clientData['dataEntrega'] || clientData['PREVISAO_ENTREGA'] || '',
        lente: extractedLenses[0] || clientData['Marca de Lente'] || clientData['Lente'] || clientData['lente'] || '',
        armacao: extractedFrames[0] || clientData['Modelo de Armação'] || clientData['Armação'] || clientData['armacao'] || '',
        odEsf: clientData['OD_ESF'] || clientData['odEsf'] || '',
        odCil: clientData['OD_CIL'] || clientData['odCil'] || '',
        odEixo: clientData['OD_EIXO'] || clientData['odEixo'] || '',
        odDnp: clientData['OD_DNP'] || clientData['odDnp'] || '',
        odAlt: clientData['OD_ALT'] || clientData['odAlt'] || '',
        oeEsf: clientData['OE_ESF'] || clientData['oeEsf'] || '',
        oeCil: clientData['OE_CIL'] || clientData['oeCil'] || '',
        oeEixo: clientData['OE_EIXO'] || clientData['oeEixo'] || '',
        oeDnp: clientData['OE_DNP'] || clientData['oeDnp'] || '',
        oeAlt: clientData['OE_ALT'] || clientData['oeAlt'] || '',
        odPertoEsf: clientData['OD_PERTO_ESF'] || clientData['odPertoEsf'] || '',
        odPertoCil: clientData['OD_PERTO_CIL'] || clientData['odPertoCil'] || '',
        odPertoEixo: clientData['OD_PERTO_EIXO'] || clientData['odPertoEixo'] || '',
        odPertoDnp: clientData['OD_PERTO_DNP'] || clientData['odPertoDnp'] || '',
        odPertoAlt: clientData['OD_PERTO_ALT'] || clientData['odPertoAlt'] || '',
        oePertoEsf: clientData['OE_PERTO_ESF'] || clientData['oePertoEsf'] || '',
        oePertoCil: clientData['OE_PERTO_CIL'] || clientData['oePertoCil'] || '',
        oePertoEixo: clientData['OE_PERTO_EIXO'] || clientData['oePertoEixo'] || '',
        oePertoDnp: clientData['OE_PERTO_DNP'] || clientData['oePertoDnp'] || '',
        oePertoAlt: clientData['OE_PERTO_ALT'] || clientData['oePertoAlt'] || '',
        adicao: clientData['ADICAO'] || clientData['adicao'] || '',
        valorTotal: effectiveTotal,
        valorEntrada: vEntrada,
        restante: effectiveRestante,
        formaPagamentoEntrada: vFormaEntrada,
        formaPagamentoRestante: vFormaRestante,
        parcelasRestante: vParcelasRestante,
        formasPagamento: vFormas,
        observacoes: clientData['observacoes'] || clientData['OBSERVACOES'] || '',
        parcelas: (Array.isArray(clientData['parcelas']) && clientData['parcelas'].length > 0)
          ? clientData['parcelas']
          : (clientData['PARCELAS_JSON'] ? (typeof clientData['PARCELAS_JSON'] === 'string' ? JSON.parse(clientData['PARCELAS_JSON']) : clientData['PARCELAS_JSON']) : []),
        responsavel: clientData['Responsável Nome'] || clientData['Responsável'] || clientData['responsavel'] || '',
        rg: clientData['RG'] || clientData['rg'] || '',
        laboratorio: clientData['LABORATORIO'] || clientData['laboratorio'] || '',
        numeroOS: nextBase
      }));
    }
  }, [clientData, saleData, isOpen, currentUser, userCity, propSelectedCity, initialCity]);

  // Atualização de prefixo e base quando a cidade muda
  const handleCityChange = (newCity) => {
    setSelectedCity(newCity);
    const newBase = calculateNextBaseOS(newCity, salesData);
    setBaseOSNumber(newBase);
    setOsList(prev => prev.map((item, idx) => ({
      ...item,
      selectedCity: newCity,
      unidade: newCity,
      numeroOS: prev.length === 1 ? newBase : `${newBase}-${idx + 1}`
    })));
  };

  // Alteração do número base manualmente
  const handleBaseOSChange = (newBase) => {
    const upperBase = String(newBase).toUpperCase().trim();
    setBaseOSNumber(upperBase);
    setOsList(prev => prev.map((item, idx) => ({
      ...item,
      numeroOS: prev.length === 1 ? upperBase : `${upperBase}-${idx + 1}`
    })));
  };

  // Adicionar um novo óculos / OS vinculado
  const handleAddOS = () => {
    const nextIdx = osList.length;
    let cleanBase = (baseOSNumber || 'CAJ-001').replace(/-\d+$/, '');

    const updated = osList.map((os, i) => {
      if (osList.length === 1 && !os.numeroOS.includes('-')) {
        return { ...os, numeroOS: `${cleanBase}-1` };
      }
      return os;
    });

    const newOS = {
      id: `os_tab_${Date.now()}_${nextIdx}`,
      label: `Óculos ${nextIdx + 1}`,
      nomePessoa: '',
      numeroOS: `${cleanBase}-${nextIdx + 1}`,
      selectedCity: selectedCity || osList[0]?.selectedCity || 'Cajati',
      unidade: selectedCity || osList[0]?.unidade || 'Cajati',
      medico: osList[0]?.medico || formData.medico || '',
      dataVenda: osList[0]?.dataVenda || formData.dataVenda || new Date().toISOString().split('T')[0],
      dataEntrega: osList[0]?.dataEntrega || formData.dataEntrega || '',
      laboratorio: osList[0]?.laboratorio || formData.laboratorio || '',
      lente: '',
      armacao: '',
      odEsf: '', odCil: '', odEixo: '', odDnp: '', odAlt: '', odDp: '', odOpa: '',
      oeEsf: '', oeCil: '', oeEixo: '', oeDnp: '', oeAlt: '', oeDp: '', oeOpa: '',
      odPertoEsf: '', odPertoCil: '', odPertoEixo: '', odPertoDnp: '', odPertoAlt: '', odPertoDp: '', odPertoOpa: '',
      oePertoEsf: '', oePertoCil: '', oePertoEixo: '', oePertoDnp: '', oePertoAlt: '', oePertoDp: '', oePertoOpa: '',
      adicao: '',
      observacoes: '',
      valorTotal: ''
    };

    updated.push(newOS);
    setOsList(updated);
    setActiveTabIndex(updated.length - 1);
  };

  // Remover um óculos / OS da lista
  const handleRemoveOS = (idxToRemove) => {
    if (osList.length <= 1) return;
    const remaining = osList.filter((_, idx) => idx !== idxToRemove);
    const cleanBase = (baseOSNumber || 'CAJ-001').replace(/-\d+$/, '');
    const reindexed = remaining.map((os, i) => ({
      ...os,
      label: os.label.startsWith('Óculos ') ? `Óculos ${i + 1}` : os.label,
      numeroOS: remaining.length === 1 ? cleanBase : `${cleanBase}-${i + 1}`
    }));
    setOsList(reindexed);
    setActiveTabIndex(prev => Math.min(prev, reindexed.length - 1));

    if (!isManualTotal) {
      const autoSum = calculateTotalFromOSList(reindexed);
      const totalFmt = autoSum > 0 ? formatCurrency(autoSum) : '0,00';
      const entradaNum = parseCurrency(formData.valorEntrada);
      const restNum = Math.max(0, autoSum - entradaNum);
      setFormData(prev => ({
        ...prev,
        valorTotal: totalFmt,
        restante: autoSum > 0 ? formatCurrency(restNum) : '0,00'
      }));
      if (payments.length > 0) {
        syncPaymentsToFormData(payments, autoSum);
      }
    }
  };

  // Copiar dioptria do Óculos 1 para o Óculos atual ativo
  const handleCopyPrescriptionFromFirst = () => {
    if (activeTabIndex === 0 || !osList[0]) return;
    const source = osList[0];
    setOsList(prev => prev.map((os, idx) => {
      if (idx !== activeTabIndex) return os;
      return {
        ...os,
        medico: source.medico || os.medico,
        odEsf: source.odEsf,
        odCil: source.odCil,
        odEixo: source.odEixo,
        odDnp: source.odDnp,
        odAlt: source.odAlt,
        odDp: source.odDp,
        odOpa: source.odOpa,
        oeEsf: source.oeEsf,
        oeCil: source.oeCil,
        oeEixo: source.oeEixo,
        oeDnp: source.oeDnp,
        oeAlt: source.oeAlt,
        oeDp: source.oeDp,
        oeOpa: source.oeOpa,
        odPertoEsf: source.odPertoEsf,
        odPertoCil: source.odPertoCil,
        odPertoEixo: source.odPertoEixo,
        odPertoDnp: source.odPertoDnp,
        odPertoAlt: source.odPertoAlt,
        odPertoDp: source.odPertoDp,
        odPertoOpa: source.odPertoOpa,
        oePertoEsf: source.oePertoEsf,
        oePertoCil: source.oePertoCil,
        oePertoEixo: source.oePertoEixo,
        oePertoDnp: source.oePertoDnp,
        oePertoAlt: source.oePertoAlt,
        oePertoDp: source.oePertoDp,
        oePertoOpa: source.oePertoOpa,
        adicao: source.adicao,
        laboratorio: source.laboratorio || os.laboratorio
      };
    }));
  };

  const currentOS = osList[activeTabIndex] || osList[0] || {};

  // Manipulador de campos para a OS ativa
  const handleCurrentOSChange = (field, value) => {
    setOsList(prev => {
      const nextList = prev.map((item, idx) => {
        if (idx !== activeTabIndex) return item;
        return { ...item, [field]: value };
      });
      return nextList;
    });

    // Se for alteração de armação ou lente
    if (field === 'armacao' || field === 'lente') {
      if (activeTabIndex === 0) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }

      // Se o valor total estiver zerado ou sem valor prévio manual, busca no catálogo
      if (!isManualTotal || parseCurrency(formData.valorTotal) === 0) {
        const simulatedList = osList.map((item, idx) => {
          if (idx !== activeTabIndex) return item;
          return { ...item, [field]: value };
        });
        const autoSum = calculateTotalFromOSList(simulatedList);
        const totalFmt = autoSum > 0 ? formatCurrency(autoSum) : '0,00';
        const entradaNum = parseCurrency(formData.valorEntrada);
        const restNum = Math.max(0, autoSum - entradaNum);
        const restFmt = autoSum > 0 ? formatCurrency(restNum) : '0,00';

        setFormData(prev => ({
          ...prev,
          valorTotal: totalFmt,
          restante: restFmt
        }));

        if (payments.length > 0) {
          syncPaymentsToFormData(payments, autoSum);
        }
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Se for campo de número da OS, formata automaticamente em caixa alta
    if (name === 'numeroOS') {
      const upperVal = String(value).toUpperCase().trim();
      setFormData(prev => ({ ...prev, numeroOS: upperVal }));
      handleCurrentOSChange('numeroOS', upperVal);
      return;
    }

    // Se for campo de data da venda
    if (name === 'dataVenda') {
      setFormData(prev => ({ ...prev, dataVenda: value }));
      handleCurrentOSChange('dataVenda', value);
      return;
    }

    // Se for campo de formulário global financeiro
    if (
      name === 'valorTotal' ||
      name === 'valorEntrada' ||
      name === 'restante' ||
      name === 'formasPagamento' ||
      name === 'formaPagamentoEntrada' ||
      name === 'formaPagamentoRestante' ||
      name === 'parcelasRestante'
    ) {
      if (name === 'valorTotal') {
        const numVal = parseCurrency(value);
        if (numVal > 0) {
          setIsManualTotal(true);
        } else {
          setIsManualTotal(false);
          const autoSum = calculateTotalFromOSList(osList);
          if (autoSum > 0) {
            const totalFmt = formatCurrency(autoSum);
            const entradaNum = parseCurrency(formData.valorEntrada);
            const restNum = Math.max(0, autoSum - entradaNum);
            setFormData(prev => ({
              ...prev,
              valorTotal: totalFmt,
              restante: formatCurrency(restNum)
            }));
            return;
          }
        }
      }

      let newFormData = { ...formData, [name]: value };
      if (name === 'valorTotal' || name === 'valorEntrada') {
        const total = parseCurrency(newFormData.valorTotal) || 0;
        const entrada = parseCurrency(newFormData.valorEntrada) || 0;
        const rest = total - entrada;
        newFormData.restante = rest > 0 ? formatCurrency(rest) : '0,00';
      }
      if (name === 'formaPagamentoRestante' && value === 'Boleto') {
        setPayMethod('Boleto');
      } else if ((name === 'formaPagamentoRestante' || name === 'parcelasRestante') && newFormData.formaPagamentoRestante && newFormData.formaPagamentoRestante !== 'Boleto') {
        const targetRestMethod = newFormData.formaPagamentoRestante === 'Cartão de Crédito'
          ? 'Crédito'
          : newFormData.formaPagamentoRestante === 'Cartão de Débito'
          ? 'Débito'
          : newFormData.formaPagamentoRestante;
        const targetRestInst = newFormData.formaPagamentoRestante === 'Cartão de Crédito'
          ? (parseInt(newFormData.parcelasRestante || '1', 10) || 1)
          : 1;
        const nonBoletoRestItems = payments.filter(p => p.method !== 'Boleto' && p.stage === 'restante');
        if (nonBoletoRestItems.length === 1 && !payments.some(p => p.method === 'Boleto')) {
          const updatedPayments = payments.map(p => {
            if (p.id !== nonBoletoRestItems[0].id) return p;
            return {
              ...p,
              method: targetRestMethod,
              installments: targetRestInst,
              texto: buildPaymentText(targetRestMethod, p.valor, targetRestInst, 'restante', [])
            };
          });
          setPayments(updatedPayments);
          newFormData.formasPagamento = updatedPayments.map(p => p.texto.trim()).filter(Boolean).join('\n');
        }
      } else if (name === 'formaPagamentoEntrada' && value && !value.includes('+')) {
        const targetEntMethod = value === 'Cartão de Crédito'
          ? 'Crédito'
          : value === 'Cartão de Débito'
          ? 'Débito'
          : value;
        const entItems = payments.filter(p => p.method !== 'Boleto' && p.stage !== 'restante');
        if (entItems.length === 1) {
          const updatedPayments = payments.map(p => {
            if (p.id !== entItems[0].id) return p;
            return {
              ...p,
              method: targetEntMethod,
              texto: buildPaymentText(targetEntMethod, p.valor, p.installments || 1, 'entrada', [])
            };
          });
          setPayments(updatedPayments);
          newFormData.formasPagamento = updatedPayments.map(p => p.texto.trim()).filter(Boolean).join('\n');
        }
      }
      setFormData(newFormData);
      return;
    }

    // Caso contrário, atualiza a OS ativa no array
    handleCurrentOSChange(name, value);
  };

  const handleCalculateRestante = () => {
    const total = parseCurrency(formData.valorTotal) || 0;
    const entrada = parseCurrency(formData.valorEntrada) || 0;
    const rest = Math.max(0, total - entrada);
    setFormData(prev => ({
      ...prev,
      valorTotal: total > 0 ? formatCurrency(total) : prev.valorTotal,
      valorEntrada: entrada > 0 ? formatCurrency(entrada) : prev.valorEntrada,
      restante: rest > 0 ? formatCurrency(rest) : '0,00'
    }));
  };

  const handleSaveClick = () => {
    // 🛡️ Regra: Vendedores não podem salvar/gerar OS com produtos cujo estoque esteja zerado
    if (isVendor) {
      for (const osItem of osList) {
        const armName = String(osItem.armacao || '').trim().toLowerCase();
        if (armName && armName !== 'armação própria' && armName !== 'não informada') {
          const matchedArm = (armacoesData || []).find(a => `${a.MARCA || a.marca || ''} ${a.MODELO || a.modelo || ''}`.trim().toLowerCase() === armName);
          if (matchedArm) {
            const rawStock = matchedArm['ESTOQUE'] !== undefined ? matchedArm['ESTOQUE'] : (matchedArm['EM ESTOQUE'] !== undefined ? matchedArm['EM ESTOQUE'] : (matchedArm['estoque'] !== undefined ? matchedArm['estoque'] : matchedArm['QTD']));
            const stockNum = parseInt(rawStock !== undefined && rawStock !== '' ? rawStock : 999, 10);
            if (stockNum <= 0) {
              alert(`⚠️ Inclusão Bloqueada para Vendedor:\n\nA armação "${osItem.armacao}" está com estoque esgotado (0 un).\n\nVendedores não podem selecionar produtos com estoque zerado para gerar Ordem de Serviço.`);
              return;
            }
          }
        }
        const lenName = String(osItem.lente || '').trim().toLowerCase();
        if (lenName && lenName !== 'não informada') {
          const matchedLen = (lentesData || []).find(l => `${l.MARCA || l.marca || ''} ${l.MODELO || l.modelo || ''}`.trim().toLowerCase() === lenName);
          if (matchedLen) {
            const rawStock = matchedLen['ESTOQUE'] !== undefined ? matchedLen['ESTOQUE'] : (matchedLen['EM ESTOQUE'] !== undefined ? matchedLen['EM ESTOQUE'] : (matchedLen['estoque'] !== undefined ? matchedLen['estoque'] : matchedLen['QTD']));
            const stockNum = parseInt(rawStock !== undefined && rawStock !== '' ? rawStock : 999, 10);
            if (stockNum <= 0) {
              alert(`⚠️ Inclusão Bloqueada para Vendedor:\n\nA lente "${osItem.lente}" está com estoque esgotado (0 un).\n\nVendedores não podem selecionar produtos com estoque zerado para gerar Ordem de Serviço.`);
              return;
            }
          }
        }
      }
    }

    if (isExternalVendor) {
      for (const osItem of osList) {
        const armName = String(osItem.armacao || '').trim().toLowerCase();
        if (armName && armName !== 'armação própria' && armName !== 'não informada') {
          const matchedArm = (armacoesData || []).find(a => `${a.MARCA || a.marca || ''} ${a.MODELO || a.modelo || ''}`.trim().toLowerCase() === armName);
          if (matchedArm && !isProductFromVendaExterna(matchedArm)) {
            const u = matchedArm.UNIDADE || matchedArm.CIDADE || matchedArm.LOJA || matchedArm.Unidade || 'Outra Loja';
            alert(`Inclusão bloqueada para Vendedor Externo:\n\nA armação "${osItem.armacao}" pertence ao estoque da loja "${u}".\n\nVendedores externos podem consultar produtos de todas as lojas, mas só têm permissão para adicionar produtos que pertençam ao estoque de "Venda Externa".\n\nCaso o cliente deseje este item, solicite a transferência do produto para Venda Externa no ERP.`);
            return;
          }
        }
        const lenName = String(osItem.lente || '').trim().toLowerCase();
        if (lenName && lenName !== 'não informada') {
          const matchedLen = (lentesData || []).find(l => `${l.MARCA || l.marca || ''} ${l.MODELO || l.modelo || ''}`.trim().toLowerCase() === lenName);
          if (matchedLen && !isProductFromVendaExterna(matchedLen)) {
            const u = matchedLen.UNIDADE || matchedLen.CIDADE || matchedLen.LOJA || matchedLen.Unidade || 'Outra Loja';
            alert(`Inclusão bloqueada para Vendedor Externo:\n\nA lente "${osItem.lente}" pertence ao estoque da loja "${u}".\n\nVendedores externos podem consultar produtos de todas as lojas, mas só têm permissão para adicionar produtos que pertençam ao estoque de "Venda Externa".\n\nCaso o cliente deseje este item, solicite a transferência do produto para Venda Externa no ERP.`);
            return;
          }
        }
      }
    }

    const finalParcelas = payments.filter(p => p.method === 'Boleto').flatMap(p => p.parcelas || []);
    const entradaValNum = parseCurrency(formData.valorEntrada);
    const restanteValNum = parseCurrency(formData.restante);

    const entradaPayments = payments.filter(p => p.method !== 'Boleto' && p.stage !== 'restante');
    const restantePayments = payments.filter(p => p.method === 'Boleto' || p.stage === 'restante');

    const derivedEntradaMethod = [...new Set(entradaPayments.map(p => formatMethodDisplayName(p.method, p.installments)).filter(Boolean))].join(' + ');
    const derivedRestanteMethod = [...new Set(restantePayments.map(p => formatMethodDisplayName(p.method, p.installments)).filter(Boolean))].join(' + ');

    const finalFormaEntrada = entradaValNum > 0
      ? ((entradaPayments.length <= 1 && formData.formaPagamentoEntrada) ? formData.formaPagamentoEntrada : (derivedEntradaMethod || formData.formaPagamentoEntrada || 'Dinheiro / PIX'))
      : '';

    const rawCardFormaRestante = formData.formaPagamentoRestante === 'Cartão de Crédito' && parseInt(formData.parcelasRestante || '1', 10) > 1
      ? `Cartão de Crédito (${formData.parcelasRestante}x)`
      : formData.formaPagamentoRestante;

    const finalFormaRestante = restanteValNum > 0
      ? (finalParcelas.length > 0
          ? (derivedRestanteMethod || 'Boleto')
          : (restantePayments.length <= 1 && rawCardFormaRestante)
          ? rawCardFormaRestante
          : (derivedRestanteMethod || rawCardFormaRestante || ''))
      : '';

    let finalFormas = payments.length > 0 ? payments.map(p => p.texto).join('\n') : formData.formasPagamento;
    if (restanteValNum > 0 && restantePayments.length === 0 && finalFormaRestante) {
      const restLine = `Restante (${finalFormaRestante}): R$ ${formatCurrency(restanteValNum)}`;
      if (!finalFormas) {
        const entLine = entradaValNum > 0 ? `Entrada (${finalFormaEntrada || 'Sinal'}): R$ ${formatCurrency(entradaValNum)}` : '';
        finalFormas = [entLine, restLine].filter(Boolean).join('\n');
      } else if (!/restante|boleto|carn[eê]/i.test(finalFormas)) {
        finalFormas = `${finalFormas}\n${restLine}`;
      }
    } else if (!finalFormas && entradaValNum > 0 && finalFormaEntrada) {
      finalFormas = `Entrada (${finalFormaEntrada}): R$ ${formatCurrency(entradaValNum)}`;
    }

    const finalDataVendaIso = osList[0]?.dataVenda || formData.dataVenda || new Date().toISOString().split('T')[0];
    const finalDataVendaBr = ensureBrDate(finalDataVendaIso);
    const saleHora = saleData?.hora || saleData?.HORA || clientData?.hora || clientData?.HORA || '';
    const saleDataHora = saleData?.dataHora || saleData?.DATA_HORA || '';
    const saleTimestamp = saleData?.timestamp || '';

    // Alerta de crédito ao vendedor caso o Responsável Legal possua duplicatas/parcelas em aberto ou vencidas
    if (responsavelDebtCheck && responsavelDebtCheck.isInadimplente) {
      const debtFmt = formatCurrency(responsavelDebtCheck.totalVencido || responsavelDebtCheck.totalAberto);
      const allow = window.confirm(
        `⚠️ ALERTA DE RISCO DE CRÉDITO AO VENDEDOR:\n\n` +
        `O Responsável Legal deste cliente (${responsavelDebtCheck.respName}${responsavelDebtCheck.respCpf ? ` - CPF: ${responsavelDebtCheck.respCpf}` : ''}) ` +
        `possui parcelas/duplicatas em aberto ou vencidas no valor de R$ ${debtFmt} no financeiro!\n\n` +
        `Deseja realmente autorizar e prosseguir com a emissão da Ordem de Serviço?`
      );
      if (!allow) return;
    }

    if (osList.length <= 1) {
      const activeOS = osList[0] || {};
      const titularNome = clientData['Nome Completo'] || clientData['CLIENTE'] || clientData['Nome'] || '';
      const finalNomePessoa = activeOS.nomePessoa || formData.nomePessoa || titularNome;

      const singleData = {
        ...formData,
        ...activeOS,
        nomePessoa: finalNomePessoa,
        PACIENTE: finalNomePessoa,
        NOME_BENEFICIARIO: finalNomePessoa,
        CLIENTE_BENEFICIARIO: finalNomePessoa,
        RESPONSAVEL_LEGAL_INADIMPLENTE: !!responsavelDebtCheck?.isInadimplente,
        RESPONSAVEL_LEGAL_DEBITO: responsavelDebtCheck?.totalAberto || 0,
        dataVenda: finalDataVendaBr,
        dataVendaIso: finalDataVendaIso,
        dataHora: saleDataHora || undefined,
        timestamp: saleTimestamp || undefined,
        DATA_HORA: saleData?.DATA_HORA || undefined,
        hora: saleHora || undefined,
        HORA: saleHora || undefined,
        'DATA  DA VENDA': finalDataVendaBr,
        'DATA DA VENDA': finalDataVendaBr,
        'DATA_VENDA': finalDataVendaBr,
        'Data da Venda': finalDataVendaBr,
        'DATA': finalDataVendaBr,
        numeroOS: activeOS.numeroOS || formData.numeroOS || baseOSNumber,
        formasPagamento: finalFormas,
        formaPagamentoEntrada: finalFormaEntrada,
        FORMA_ENTRADA: finalFormaEntrada,
        formaPagamentoRestante: finalFormaRestante,
        FORMA_RESTANTE: finalFormaRestante,
        parcelasRestante: formData.parcelasRestante || '1',
        parcelas: finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || []),
        PARCELAS_JSON: JSON.stringify(finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])),
        selectedCity: selectedCity || 'Cajati',
        unidade: selectedCity || 'Cajati',
        laboratorio: activeOS.laboratorio || formData.laboratorio || ''
      };
      onSaveAndPrint(singleData);
    } else {
      const titularNome = clientData['Nome Completo'] || clientData['CLIENTE'] || clientData['Nome'] || '';

      const multiPayload = {
        isMultiOS: true,
        totalOS: osList.length,
        baseOS: baseOSNumber,
        dataVenda: finalDataVendaBr,
        dataVendaIso: finalDataVendaIso,
        dataHora: saleDataHora || undefined,
        timestamp: saleTimestamp || undefined,
        DATA_HORA: saleData?.DATA_HORA || undefined,
        hora: saleHora || undefined,
        HORA: saleHora || undefined,
        'DATA  DA VENDA': finalDataVendaBr,
        'DATA DA VENDA': finalDataVendaBr,
        'DATA_VENDA': finalDataVendaBr,
        'Data da Venda': finalDataVendaBr,
        'DATA': finalDataVendaBr,
        selectedCity: selectedCity || 'Cajati',
        unidade: selectedCity || 'Cajati',
        formasPagamento: finalFormas,
        formaPagamentoEntrada: finalFormaEntrada,
        FORMA_ENTRADA: finalFormaEntrada,
        formaPagamentoRestante: finalFormaRestante,
        FORMA_RESTANTE: finalFormaRestante,
        parcelasRestante: formData.parcelasRestante || '1',
        parcelas: finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || []),
        PARCELAS_JSON: JSON.stringify(finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])),
        valorTotal: formData.valorTotal,
        valorEntrada: formData.valorEntrada,
        restante: formData.restante,
        RESPONSAVEL_LEGAL_INADIMPLENTE: !!responsavelDebtCheck?.isInadimplente,
        RESPONSAVEL_LEGAL_DEBITO: responsavelDebtCheck?.totalAberto || 0,
        orders: osList.map((item, idx) => {
          const itemDataVendaIso = item.dataVenda || finalDataVendaIso;
          const itemDataVendaBr = ensureBrDate(itemDataVendaIso);
          const finalBeneficiario = item.nomePessoa || (idx === 0 ? titularNome : `Beneficiário Óculos ${idx + 1}`);

          return {
            ...formData,
            ...item,
            nomePessoa: finalBeneficiario,
            PACIENTE: finalBeneficiario,
            NOME_BENEFICIARIO: finalBeneficiario,
            CLIENTE_BENEFICIARIO: finalBeneficiario,
            RESPONSAVEL_LEGAL_INADIMPLENTE: !!responsavelDebtCheck?.isInadimplente,
            RESPONSAVEL_LEGAL_DEBITO: responsavelDebtCheck?.totalAberto || 0,
            dataVenda: itemDataVendaBr,
            dataVendaIso: itemDataVendaIso,
            dataHora: saleDataHora || undefined,
            timestamp: saleTimestamp || undefined,
            DATA_HORA: saleData?.DATA_HORA || undefined,
            hora: saleHora || undefined,
            HORA: saleHora || undefined,
            'DATA  DA VENDA': itemDataVendaBr,
            'DATA DA VENDA': itemDataVendaBr,
            'DATA_VENDA': itemDataVendaBr,
            'Data da Venda': itemDataVendaBr,
            'DATA': itemDataVendaBr,
            osIndex: idx + 1,
            totalOS: osList.length,
            numeroOS: item.numeroOS || `${baseOSNumber}-${idx + 1}`,
            selectedCity: selectedCity || 'Cajati',
            unidade: selectedCity || 'Cajati',
            isSecondaryOS: idx > 0,
            valorTotal: idx === 0 ? formData.valorTotal : '0,00',
            valorEntrada: idx === 0 ? formData.valorEntrada : '0,00',
            restante: idx === 0 ? formData.restante : '0,00',
            formasPagamento: idx === 0 ? finalFormas : `Faturamento Unificado (Ver OS #${baseOSNumber}${osList.length > 1 ? '-1' : ''})`,
            formaPagamentoEntrada: idx === 0 ? finalFormaEntrada : '',
            FORMA_ENTRADA: idx === 0 ? finalFormaEntrada : '',
            formaPagamentoRestante: idx === 0 ? finalFormaRestante : '',
            FORMA_RESTANTE: idx === 0 ? finalFormaRestante : '',
            parcelasRestante: idx === 0 ? (formData.parcelasRestante || '1') : '1',
            parcelas: idx === 0 ? (finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])) : [],
            PARCELAS_JSON: idx === 0 ? JSON.stringify(finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])) : '[]',
            laboratorio: item.laboratorio || ''
          };
        })
      };
      onSaveAndPrint(multiPayload);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 15 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.96, y: 15 }} 
          className="relative w-full max-w-5xl xl:max-w-6xl h-[92vh] max-h-[95vh] flex flex-col bg-slate-950 border border-slate-700/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] rounded-3xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/95 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-2xl flex items-center justify-center shadow-lg shadow-fuchsia-500/10">
                <FileText className="text-fuchsia-400" size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Gerar Ordem de Serviço
                  </h3>
                  {osList.length > 1 ? (
                    <span className="px-2.5 py-0.5 text-[11px] font-black uppercase rounded-full bg-gradient-to-r from-fuchsia-500/20 to-indigo-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm">
                      Multi-OS ({osList.length} Óculos)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-full bg-slate-800 text-slate-300 border border-white/10">
                      OS Padrão
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Cliente:</span>
                  <span className="text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                    {clientData?.['Nome Completo'] || clientData?.['NOME'] || 'Desconhecido'}
                  </span>
                  {(clientData?.['CPF'] || clientData?.['CPF / CNPJ']) && (
                    <span className="text-slate-400 font-mono text-[11px]">
                      CPF: {clientData?.['CPF'] || clientData?.['CPF / CNPJ']}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Fechar janela"
            >
              <X size={20} />
            </button>
          </div>

          {/* BARRA DE ABAS MULTI-OS COM BOTÃO DE ADICIONAR E AÇÕES - ALTURA EXPANDIDA E DESTAQUE */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-white/15 px-6 sm:px-8 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-inner">
            {/* Abas com rolagem horizontal suave */}
            <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-1 sm:pb-0">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 pr-2 border-r border-white/10 shrink-0">
                <Glasses size={16} className="text-fuchsia-400" />
                <span>Óculos da Venda:</span>
              </div>
              {osList.map((os, idx) => {
                const isActive = activeTabIndex === idx;
                return (
                  <button
                    key={os.id || idx}
                    type="button"
                    onClick={() => setActiveTabIndex(idx)}
                    className={`px-4.5 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2.5 transition-all shrink-0 ${
                      isActive 
                        ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-600/30 ring-2 ring-fuchsia-400/60' 
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Glasses size={17} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{os.label || `Óculos ${idx + 1}`}</span>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg font-black tracking-wide ${isActive ? 'bg-black/35 text-fuchsia-200 shadow-inner' : 'bg-black/40 text-slate-400'}`}>
                      {os.numeroOS || `#${idx + 1}`}
                    </span>
                    {idx === 0 ? (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Cobrança
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-500/30">
                        Laboratório
                      </span>
                    )}
                    {osList.length > 1 && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveOS(idx);
                        }}
                        className="ml-1 hover:text-rose-300 transition-colors p-1 rounded-lg hover:bg-rose-500/25"
                        title="Remover este óculos"
                      >
                        <X size={13} />
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddOS}
                className="px-4.5 py-2.5 sm:py-3 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 active:scale-95 text-sky-300 border-2 border-dashed border-sky-400/40 hover:border-sky-400 text-xs sm:text-sm font-black flex items-center gap-2 transition-all shrink-0 shadow-md shadow-sky-950/30"
                title="Adicionar mais um óculos / OS vinculado nesta mesma venda"
              >
                <Plus size={17} className="text-sky-400" />
                <span>Adicionar Óculos (OS)</span>
              </button>
            </div>

            {/* Ações da Aba Ativa */}
            {osList.length > 1 && activeTabIndex > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPrescriptionFromFirst}
                  className="px-4 py-2.5 sm:py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                  title="Copiar graus OD/OE do Óculos 1 para este óculos"
                >
                  <Copy size={15} className="text-indigo-300" />
                  <span>Copiar Receita do Óculos 1</span>
                </button>
              </div>
            )}
          </div>

          {/* Form Content */}
          <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
            
            {/* ⚠️ ALERTA CRÍTICO: RESPONSÁVEL LEGAL INADIMPLENTE OU COM DÉBITOS EM ABERTO */}
            {responsavelDebtCheck && responsavelDebtCheck.isInadimplente && (
              <div className="bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 animate-pulse">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider">
                        Alerta de Risco Financeiro
                      </span>
                      <h4 className="text-sm font-black text-rose-200 uppercase tracking-wide">
                        Responsável Legal com Débito / Inadimplência
                      </h4>
                    </div>
                    <p className="text-xs text-rose-100 font-medium mt-1 leading-relaxed">
                      O Responsável Legal <strong className="text-white underline font-bold">{responsavelDebtCheck.respName}</strong>
                      {responsavelDebtCheck.respCpf && <span> (CPF: <strong className="font-mono text-white">{responsavelDebtCheck.respCpf}</strong>)</span>} 
                      {' '}possui <strong className="text-rose-300 font-mono font-black text-sm">R$ {formatCurrency(responsavelDebtCheck.totalVencido || responsavelDebtCheck.totalAberto)}</strong> em duplicatas / parcelas em aberto no financeiro da loja!
                    </p>
                    <p className="text-[11px] text-rose-300/90 mt-0.5">
                      ⚠️ O vendedor e a gerência devem estar cientes antes de autorizar a emissão da OS ou parcelamento no boleto.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 bg-black/40 border border-rose-500/40 px-3.5 py-2 rounded-xl text-center self-stretch md:self-auto flex md:flex-col justify-between items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-rose-400">Total em Aberto</span>
                  <span className="text-base font-black text-rose-300 font-mono">
                    R$ {formatCurrency(responsavelDebtCheck.totalVencido || responsavelDebtCheck.totalAberto)}
                  </span>
                </div>
              </div>
            )}

            {/* 📋 BLOCO 1: DADOS FORMATADOS DA ORDEM DE SERVIÇO (OS) */}
            <div className="space-y-4 bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-md shadow-pink-500/10">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Dados da Ordem de Serviço (OS)
                      {osList.length > 1 && (
                        <span className="text-[11px] font-bold text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                          {currentOS.label || `Óculos ${activeTabIndex + 1}`} ({activeTabIndex + 1}/{osList.length})
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Identificação oficial, unidade da loja, datas e laboratório óptico
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-black/60 px-3.5 py-1.5 rounded-xl border border-pink-500/30 shadow-inner">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nº OS:</span>
                    <span className="text-sm font-mono font-black text-pink-400 tracking-wider">
                      #{currentOS.numeroOS || 'SEM NÚMERO'}
                    </span>
                  </div>
                  {osList.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Identificação:</span>
                      <input
                        type="text"
                        value={currentOS.label || ''}
                        onChange={(e) => handleCurrentOSChange('label', e.target.value)}
                        placeholder="Ex: Óculos 1 - Longe"
                        className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-fuchsia-300 font-bold focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/30 transition-all w-36 sm:w-44"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 👤 CAMPO NO COMEÇO DA OS: NOME DA PESSOA NESTA OS (BENEFICIÁRIO / PACIENTE) */}
              <div className="p-3.5 bg-gradient-to-r from-fuchsia-950/40 via-purple-950/30 to-indigo-950/40 border border-fuchsia-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-fuchsia-300 shrink-0">
                    <User size={16} />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5">
                      Nome da Pessoa nesta OS {activeTabIndex > 0 ? 'Extra' : ''} (Beneficiário / Paciente)
                    </span>
                    <p className="text-[10px] text-slate-300">
                      {activeTabIndex > 0 
                        ? 'Indique quem usará este óculos extra (ex: Filho, Cônjuge, Dependente). O pagamento permanece unificado no titular.'
                        : 'Identificação da pessoa que usará este óculos (se não informado, adota o titular da compra).'}
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-80">
                  <input
                    type="text"
                    value={currentOS.nomePessoa ?? (activeTabIndex === 0 ? (clientData['Nome Completo'] || clientData['CLIENTE'] || '') : '')}
                    onChange={(e) => handleCurrentOSChange('nomePessoa', e.target.value)}
                    placeholder={activeTabIndex > 0 ? "Ex: Maria Eduarda (Filha)" : (clientData['Nome Completo'] || "Nome do Paciente")}
                    className="w-full bg-black/70 border border-fuchsia-400/50 rounded-xl px-3.5 py-2 text-xs font-black text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/30 shadow-inner"
                  />
                </div>
              </div>

              {/* Grade de Campos da OS: Unidade, Nº da OS, Laboratório, Médico, Data Venda, Data Entrega */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 pt-1">
                {/* Unidade */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-slate-400 font-black tracking-wider flex items-center gap-1">
                    <MapPin size={11} className="text-pink-400" /> Unidade (Loja)
                  </label>
                  {userCity ? (
                    <div className="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold flex items-center justify-between">
                      <span>{selectedCity}</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">Fixa</span>
                    </div>
                  ) : (
                    <select 
                      value={selectedCity} 
                      onChange={(e) => handleCityChange(e.target.value)} 
                      className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-sky-400 font-bold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
                    >
                      <option value="">Selecione...</option>
                      <option value="Cajati">Cajati (CAJ)</option>
                      <option value="Registro">Registro (REG)</option>
                      <option value="Jacupiranga">Jacupiranga (JAC)</option>
                      <option value="Venda Externa">Venda Externa (EXT)</option>
                    </select>
                  )}
                </div>

                {/* Nº da OS */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-fuchsia-400 font-black tracking-wider flex items-center gap-1">
                    <Tag size={11} className="text-fuchsia-400" /> Nº desta OS
                  </label>
                  <input 
                    type="text" 
                    name="numeroOS" 
                    value={currentOS.numeroOS || ''} 
                    onChange={handleChange} 
                    placeholder="CAJ-001" 
                    className="w-full bg-black/70 border border-fuchsia-500/30 rounded-xl px-3 py-2 text-xs text-fuchsia-400 font-black font-mono uppercase focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/40 shadow-inner" 
                  />
                </div>

                {/* Data da Venda */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-amber-400 font-black tracking-wider flex items-center gap-1.5">
                    <Calendar size={11} className="text-amber-400" /> Data da Venda
                  </label>
                  <input 
                    type="date" 
                    name="dataVenda" 
                    value={currentOS.dataVenda || formData.dataVenda || ''} 
                    onChange={handleChange} 
                    className="w-full bg-slate-900/90 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 font-bold" 
                  />
                </div>

                {/* Data de Entrega */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-sky-400 font-black tracking-wider flex items-center gap-1.5">
                    <Calendar size={11} className="text-sky-400" /> Previsão Entrega
                  </label>
                  <input 
                    type="date" 
                    name="dataEntrega" 
                    value={currentOS.dataEntrega || ''} 
                    onChange={handleChange} 
                    className="w-full bg-slate-900/90 border border-sky-500/30 rounded-xl px-3 py-2 text-xs text-sky-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 font-bold" 
                  />
                </div>

                {/* Laboratório */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-slate-400 font-black tracking-wider flex items-center gap-1">
                    <FlaskConical size={11} className="text-cyan-400" /> Laboratório Óptico
                  </label>
                  <input 
                    list="datalist-labs-os"
                    type="text" 
                    name="laboratorio" 
                    value={currentOS.laboratorio || ''} 
                    onChange={handleChange} 
                    placeholder="Ex: Haytek, Essilor..." 
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 font-medium" 
                  />
                  <datalist id="datalist-labs-os">
                    <option value="Haytek" />
                    <option value="Essilor" />
                    <option value="Hoya" />
                    <option value="Optview" />
                    <option value="Digital Labs" />
                    <option value="Laboratório Central" />
                  </datalist>
                </div>

                {/* Médico */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-slate-400 font-black tracking-wider flex items-center gap-1">
                    <User size={11} className="text-slate-400" /> Médico / Optom.
                  </label>
                  <input 
                    type="text" 
                    name="medico" 
                    value={currentOS.medico || ''} 
                    onChange={handleChange} 
                    placeholder="Nome do Médico" 
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 font-medium" 
                  />
                </div>
              </div>

              {osList.length > 1 && (
                <div className="pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="text-[11px] text-slate-400">
                    Venda com Múltiplas OS vinculadas com faturamento unificado no mesmo cliente
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Nº Base da Venda:</span>
                    <input 
                      type="text" 
                      value={baseOSNumber} 
                      onChange={(e) => handleBaseOSChange(e.target.value)} 
                      placeholder="CAJ-001" 
                      className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-pink-300 font-mono font-bold w-28 uppercase focus:outline-none focus:border-pink-500" 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 👁️ BLOCO 2: PRESCRIÇÃO ÓPTICA & DIOPTRIAS (OD / OE) */}
            <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
                  <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Activity size={16} className="text-sky-400"/> Prescrição Óptica &amp; Dioptrias — {currentOS.label || `Óculos ${activeTabIndex + 1}`}
                  </h4>
                </div>
                {osList.length > 1 && activeTabIndex > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyPrescriptionFromFirst}
                    className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Copy size={13} />
                    <span>Copiar Receita do Óculos 1</span>
                  </button>
                )}
              </div>

              {/* Tabela de Dioptrias Estilo Laboratório Óptico */}
              <div className="bg-slate-950/80 rounded-2xl border border-white/10 p-4 shadow-inner space-y-4">
                
                {/* ─── 1. VISÃO DE LONGE ─── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                      <Glasses size={14} className="text-sky-400" /> 1. Visão de Longe (OD / OE)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Valores esférico, cilíndrico, eixo e medidas pupilares para Longe
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[620px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-center border-b border-white/5">
                          <th className="pb-2.5 text-left w-24 font-black">Olho</th>
                          <th className="pb-2.5 px-1 font-bold">Esférico</th>
                          <th className="pb-2.5 px-1 font-bold">Cilíndrico</th>
                          <th className="pb-2.5 px-1 font-bold">Eixo</th>
                          <th className="pb-2.5 px-1 font-bold">DNP</th>
                          <th className="pb-2.5 px-1 font-bold">Altura</th>
                          <th className="pb-2.5 px-1 font-bold">DP</th>
                          <th className="pb-2.5 px-1 font-bold">OPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {/* OD - Olho Direito (Longe) */}
                        <tr>
                          <td className="py-2.5 pr-3 text-left">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-black text-xs">
                              <span className="w-2 h-2 rounded-full bg-sky-400"></span> OD (Longe)
                            </span>
                          </td>
                          <td className="p-1"><input type="text" name="odEsf" value={currentOS.odEsf || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odCil" value={currentOS.odCil || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odEixo" value={currentOS.odEixo || ''} onChange={handleChange} placeholder="0°" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odDnp" value={currentOS.odDnp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odAlt" value={currentOS.odAlt || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odDp" value={currentOS.odDp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odOpa" value={currentOS.odOpa || ''} onChange={handleChange} placeholder="---" className="w-full bg-slate-900 border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                        </tr>
                        {/* OE - Olho Esquerdo (Longe) */}
                        <tr>
                          <td className="py-2.5 pr-3 text-left">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> OE (Longe)
                            </span>
                          </td>
                          <td className="p-1"><input type="text" name="oeEsf" value={currentOS.oeEsf || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oeCil" value={currentOS.oeCil || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oeEixo" value={currentOS.oeEixo || ''} onChange={handleChange} placeholder="0°" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oeDnp" value={currentOS.oeDnp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oeAlt" value={currentOS.oeAlt || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oeDp" value={currentOS.oeDp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oeOpa" value={currentOS.oeOpa || ''} onChange={handleChange} placeholder="---" className="w-full bg-slate-900 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ─── 2. VISÃO DE PERTO & ADIÇÃO ─── */}
                <div className="space-y-2 pt-3 border-t border-white/10">
                  <div className="flex flex-wrap items-center justify-between text-xs border-b border-white/5 pb-2 gap-2">
                    <span className="font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Glasses size={14} className="text-amber-400" /> 2. Visão de Perto (OD / OE) &amp; Adição
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Adição (Perto):</span>
                      <input 
                        type="text" 
                        name="adicao" 
                        value={currentOS.adicao || ''} 
                        onChange={handleChange} 
                        placeholder="+2.00" 
                        className="w-24 bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg px-2.5 py-1 text-center text-amber-300 font-mono text-xs font-bold" 
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[620px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-center border-b border-white/5">
                          <th className="pb-2.5 text-left w-24 font-black">Olho</th>
                          <th className="pb-2.5 px-1 font-bold">Esférico</th>
                          <th className="pb-2.5 px-1 font-bold">Cilíndrico</th>
                          <th className="pb-2.5 px-1 font-bold">Eixo</th>
                          <th className="pb-2.5 px-1 font-bold">DNP</th>
                          <th className="pb-2.5 px-1 font-bold">Altura</th>
                          <th className="pb-2.5 px-1 font-bold">DP</th>
                          <th className="pb-2.5 px-1 font-bold">OPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {/* OD - Olho Direito (Perto) */}
                        <tr>
                          <td className="py-2.5 pr-3 text-left">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black text-xs">
                              <span className="w-2 h-2 rounded-full bg-amber-400"></span> OD (Perto)
                            </span>
                          </td>
                          <td className="p-1"><input type="text" name="odPertoEsf" value={currentOS.odPertoEsf || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odPertoCil" value={currentOS.odPertoCil || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odPertoEixo" value={currentOS.odPertoEixo || ''} onChange={handleChange} placeholder="0°" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odPertoDnp" value={currentOS.odPertoDnp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odPertoAlt" value={currentOS.odPertoAlt || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odPertoDp" value={currentOS.odPertoDp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="odPertoOpa" value={currentOS.odPertoOpa || ''} onChange={handleChange} placeholder="---" className="w-full bg-slate-900 border border-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                        </tr>
                        {/* OE - Olho Esquerdo (Perto) */}
                        <tr>
                          <td className="py-2.5 pr-3 text-left">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 font-black text-xs">
                              <span className="w-2 h-2 rounded-full bg-orange-400"></span> OE (Perto)
                            </span>
                          </td>
                          <td className="p-1"><input type="text" name="oePertoEsf" value={currentOS.oePertoEsf || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oePertoCil" value={currentOS.oePertoCil || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oePertoEixo" value={currentOS.oePertoEixo || ''} onChange={handleChange} placeholder="0°" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oePertoDnp" value={currentOS.oePertoDnp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oePertoAlt" value={currentOS.oePertoAlt || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oePertoDp" value={currentOS.oePertoDp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                          <td className="p-1"><input type="text" name="oePertoOpa" value={currentOS.oePertoOpa || ''} onChange={handleChange} placeholder="---" className="w-full bg-slate-900 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 rounded-xl px-2 py-2 text-center text-white text-xs font-mono font-semibold transition-all" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>

            {/* Bloco 2: Produtos do Óculos Ativo */}
            <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2 border-b border-white/10 pb-3">
                <Eye size={16} className="text-fuchsia-400"/> Lente &amp; Armação — {currentOS.label || `Óculos ${activeTabIndex + 1}`}
              </h4>

              {isExternalVendor && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs text-amber-200 shadow-sm">
                  <Info size={16} className="text-amber-400 shrink-0" />
                  <span>
                    <strong>Consulta de Lojas:</strong> Você pode visualizar opções de todas as lojas, mas a OS só pode ser gerada com armações e lentes do estoque de <strong>Venda Externa</strong>.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Marca/Tipo da Lente</label>
                  <input 
                    list="datalist-lentes-os"
                    type="text" 
                    name="lente" 
                    value={currentOS.lente || ''} 
                    onChange={handleChange} 
                    placeholder="Selecione ou digite..."
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/30" 
                  />
                  <datalist id="datalist-lentes-os">
                    {filteredLentes.map((l, idx) => {
                      const nome = `${l.MARCA || l.marca || ''} ${l.MODELO || l.modelo || ''}`.trim();
                      const preco = l.PRECO_VENDA || l.preco_venda || '0,00';
                      const u = l.UNIDADE || l.CIDADE || l.LOJA || l.Unidade || '';
                      const extra = u ? ` (${u})` : '';
                      return <option key={idx} value={nome}>{`R$ ${preco}${extra}`}</option>;
                    })}
                  </datalist>
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Modelo da Armação</label>
                  <div className="flex items-center gap-3">
                    <input 
                      list="datalist-armacoes-os"
                      type="text" 
                      name="armacao" 
                      value={currentOS.armacao || ''} 
                      onChange={handleChange} 
                      placeholder="Selecione ou digite..."
                      className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/30" 
                    />
                    {(() => {
                      const selectedArmacaoObj = filteredArmacoes.find(a => `${a.MARCA || a.marca || ''} ${a.MODELO || a.modelo || ''}`.trim() === (currentOS.armacao || ''));
                      if (selectedArmacaoObj && selectedArmacaoObj.IMAGEM) {
                        return (
                          <div className="w-11 h-11 shrink-0 rounded-xl overflow-hidden border border-white/15 bg-black/60 shadow-xl">
                            <img src={selectedArmacaoObj.IMAGEM} alt="Armação" className="w-full h-full object-cover" />
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <datalist id="datalist-armacoes-os">
                    {filteredArmacoes.map((a, idx) => {
                      const nome = `${a.MARCA || a.marca || ''} ${a.MODELO || a.modelo || ''}`.trim();
                      const preco = a.PRECO_VENDA || a.preco_venda || '0,00';
                      const u = a.UNIDADE || a.CIDADE || a.LOJA || a.Unidade || '';
                      const extra = u ? ` (${u})` : '';
                      return <option key={idx} value={nome}>{`R$ ${preco}${extra}`}</option>;
                    })}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Bloco 3: Financeiro & Cobrança Unificada */}
            {(() => {
              const totalVal = parseCurrency(formData.valorTotal || saleData?.['VALOR TOTAL'] || clientData?.['valorTotal'] || 0);
              const entradaCardVal = parseCurrency(formData.valorEntrada || 0);
              const restanteCardVal = parseCurrency(formData.restante || 0);
              const paymentsSum = payments.reduce((sum, p) => sum + p.valor, 0);
              const hasRestanteInPayments = payments.some(p => p.method === 'Boleto' || p.stage === 'restante');
              const coveredVal = payments.length > 0
                ? (!hasRestanteInPayments && restanteCardVal > 0 && formData.formaPagamentoRestante
                    ? paymentsSum + restanteCardVal
                    : paymentsSum)
                : ((entradaCardVal > 0 ? entradaCardVal : 0) + (restanteCardVal > 0 && formData.formaPagamentoRestante ? restanteCardVal : 0));
              const remainingVal = Math.max(0, totalVal - coveredVal);
              const isFullyCovered = Math.abs(coveredVal - totalVal) < 0.05 && totalVal > 0;

              return (
                <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3">
                    <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-400"/> Financeiro &amp; Cobrança Unificada do Cliente
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Cobrança Unificada no Óculos 1
                    </span>
                  </div>

                  {/* Dica visual explicativa e elegante de Centralização Financeira */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-teal-950/40 border border-emerald-500/30 rounded-2xl flex items-start gap-3 shadow-md">
                    <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                      <Sparkles size={16} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-emerald-200 font-semibold leading-relaxed">
                        <strong className="text-emerald-300 font-bold">💡 Centralização Financeira:</strong> O valor total da compra de todos os óculos é cobrado aqui no Óculos 1. Os demais óculos são ordens de montagem para o laboratório.
                      </p>
                    </div>
                  </div>

                  {/* Banner de Cobrança Unificada se houver mais de 1 OS */}
                  {osList.length > 1 && (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-start gap-3 shadow-sm">
                      <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-emerald-300 uppercase tracking-wide flex items-center gap-2 flex-wrap">
                          <span>Faturamento Unificado para o Cliente</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono">
                            {osList.length} Ordens de Serviço Vinculadas
                          </span>
                        </p>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed">
                          O cliente será cobrado uma única vez pelo valor total da compra <strong className="text-emerald-300 font-mono font-bold">(R$ {formatCurrency(totalVal)})</strong>. Todas as {osList.length} OSs geradas compartilham a mesma venda, mesmo cadastro e mesmo vendedor, gerando fichas distintas para o laboratório sem duplicar títulos a receber ou saldo no boleto.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumo em 3 Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
                      <div>
                        <label className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider">Valor Total da Venda (R$)</label>
                        <input 
                          type="text" 
                          name="valorTotal" 
                          value={formData.valorTotal} 
                          onChange={handleChange} 
                          onBlur={handleCalculateRestante} 
                          className="w-full bg-transparent border-0 text-lg text-emerald-400 font-black focus:outline-none font-mono" 
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block pt-1 border-t border-white/5">Total cobrado do cliente na OS</span>
                    </div>

                    <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-teal-500/25">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase text-teal-300 font-bold tracking-wider">Sinal / Entrada (R$)</label>
                        {entradaCardVal > 0 && formData.formaPagamentoEntrada && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                            {formData.formaPagamentoEntrada}
                          </span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        name="valorEntrada" 
                        value={formData.valorEntrada} 
                        onChange={handleChange} 
                        onBlur={handleCalculateRestante} 
                        className="w-full bg-transparent border-0 text-lg text-teal-300 font-black focus:outline-none font-mono" 
                      />
                      <div className="pt-1 border-t border-white/5 space-y-1">
                        <label className="text-[9px] uppercase text-slate-400 font-bold block">Método de Pagamento da Entrada:</label>
                        <select
                          name="formaPagamentoEntrada"
                          value={formData.formaPagamentoEntrada || ''}
                          onChange={handleChange}
                          className="w-full bg-slate-900 border border-teal-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-teal-200 font-bold focus:outline-none focus:border-teal-400"
                        >
                          <option value="">Dinheiro, PIX e Cartões (Selecionar...)</option>
                          <option value="PIX">⚡ PIX</option>
                          <option value="Dinheiro">💵 Dinheiro</option>
                          <option value="Cartão de Débito">💳 Cartão de Débito</option>
                          <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                          <option value="PIX + Dinheiro">⚡💵 PIX + Dinheiro</option>
                          <option value="PIX + Cartão">⚡💳 PIX + Cartão</option>
                          {formData.formaPagamentoEntrada && !['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'PIX + Dinheiro', 'PIX + Cartão'].includes(formData.formaPagamentoEntrada) && (
                            <option value={formData.formaPagamentoEntrada}>{formData.formaPagamentoEntrada}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-amber-500/25">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase text-amber-300 font-bold tracking-wider">Restante / A Prazo (R$)</label>
                        {restanteCardVal > 0 && formData.formaPagamentoRestante && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {formData.formaPagamentoRestante === 'Cartão de Crédito' && parseInt(formData.parcelasRestante || '1', 10) > 1
                              ? `Crédito (${formData.parcelasRestante}x)`
                              : formData.formaPagamentoRestante}
                          </span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        name="restante" 
                        value={formData.restante} 
                        onChange={handleChange} 
                        className="w-full bg-transparent border-0 text-lg text-amber-300 font-black focus:outline-none font-mono" 
                        readOnly 
                      />
                      <div className="pt-1 border-t border-white/5 space-y-1.5">
                        <label className="text-[9px] uppercase text-amber-300/90 font-bold block">Método de Pagamento do Restante:</label>
                        <div className="flex items-center gap-1.5">
                          <select
                            name="formaPagamentoRestante"
                            value={formData.formaPagamentoRestante || ''}
                            onChange={handleChange}
                            className="w-full bg-slate-900 border border-amber-500/35 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-200 font-bold focus:outline-none focus:border-amber-400"
                          >
                            <option value="">Boleto a faturar / Selecionar método...</option>
                            <option value="Boleto">📄 Boleto (Parcelado / A Prazo)</option>
                            <option value="PIX">⚡ PIX (No Restante / Na Retirada)</option>
                            <option value="Cartão de Crédito">💳 Cartão de Crédito (No Restante)</option>
                            <option value="Cartão de Débito">💳 Cartão de Débito (No Restante)</option>
                            <option value="Dinheiro">💵 Dinheiro (No Restante / Na Retirada)</option>
                            <option value="A Combinar na Retirada">🤝 A Combinar na Retirada</option>
                            {formData.formaPagamentoRestante && !['Boleto', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'A Combinar na Retirada'].includes(formData.formaPagamentoRestante) && (
                              <option value={formData.formaPagamentoRestante}>{formData.formaPagamentoRestante}</option>
                            )}
                          </select>
                          {formData.formaPagamentoRestante === 'Cartão de Crédito' && (
                            <select
                              name="parcelasRestante"
                              value={formData.parcelasRestante || '1'}
                              onChange={handleChange}
                              className="w-20 shrink-0 bg-slate-900 border border-amber-500/35 rounded-lg px-2 py-1.5 text-[11px] text-amber-200 font-bold focus:outline-none focus:border-amber-400"
                              title="Parcelas no Cartão de Crédito para o Restante"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                <option key={n} value={String(n)}>{n}x</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status de Cobertura */}
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                    isFullyCovered 
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                      : coveredVal > totalVal + 0.01 
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {isFullyCovered ? (
                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle size={18} className={coveredVal > totalVal + 0.01 ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />
                      )}
                      <div>
                        <span>
                          {isFullyCovered 
                            ? '✅ Total da Venda 100% Coberto!' 
                            : coveredVal > totalVal + 0.01 
                            ? `⚠️ Valor lançado excede o total em R$ ${formatCurrency(coveredVal - totalVal)}` 
                            : `⚠️ Falta cobrir: R$ ${formatCurrency(remainingVal)}`}
                        </span>
                        <span className="text-[10px] opacity-80 block font-normal mt-0.5">
                          Lançado: R$ {formatCurrency(coveredVal)} de R$ {formatCurrency(totalVal)}
                        </span>
                      </div>
                    </div>
                    {remainingVal > 0 && (
                      <button
                        type="button"
                        onClick={handleFillRemaining}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-black uppercase transition-colors"
                      >
                        Preencher Restante
                      </button>
                    )}
                  </div>

                  {/* Construtor de Pagamentos */}
                  <div className="p-4 border border-emerald-500/30 rounded-2xl bg-emerald-500/5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label className="text-[11px] uppercase text-emerald-400 font-bold block tracking-wider">
                          Adicionar Forma de Pagamento
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Selecione o método para compor a Entrada ou o Restante
                        </span>
                      </div>

                      {/* Destino do Pagamento (Entrada vs Restante) quando não for Boleto */}
                      {payMethod !== 'Boleto' && (
                        <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setPayStage('entrada')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                              payStage === 'entrada'
                                ? 'bg-teal-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            🟢 Pago na Entrada (Sinal)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayStage('restante')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                              payStage === 'restante'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            🟡 Para o Restante (Falta)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Métodos */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'Dinheiro', label: '💵 Dinheiro' },
                        { id: 'PIX', label: '⚡ PIX' },
                        { id: 'Débito', label: '💳 Cartão Débito' },
                        { id: 'Crédito', label: '💳 Cartão Crédito' },
                        { id: 'Boleto', label: '📄 Boleto' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPayMethod(m.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            payMethod === m.id
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/20'
                              : 'bg-black/50 text-slate-300 border-white/10 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Campos do Pagamento */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                      <div className="sm:col-span-5 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Valor (R$)</label>
                          {remainingVal > 0 && (
                            <button
                              type="button"
                              onClick={handleFillRemaining}
                              className="text-[10px] text-emerald-400 hover:underline font-bold"
                            >
                              Usar R$ {formatCurrency(remainingVal)}
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={payValue}
                          onChange={e => setPayValue(e.target.value)}
                          placeholder={formatCurrency(remainingVal > 0 ? remainingVal : totalVal)}
                          className="w-full bg-slate-900 border border-white/15 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none font-bold font-mono"
                        />
                      </div>

                      {['Crédito', 'Boleto'].includes(payMethod) && (
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Parcelas</label>
                          <select
                            value={payInstallments}
                            onChange={e => {
                              setPayInstallments(e.target.value);
                              setOsCustomDueDates({});
                            }}
                            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-bold"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => {
                              const vNum = parseCurrency(payValue) || (remainingVal > 0 ? remainingVal : totalVal);
                              const perParc = vNum > 0 ? formatCurrency(vNum / n) : '0,00';
                              return (
                                <option key={n} value={n}>{n}x (R$ {perParc})</option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {payMethod === 'Boleto' && (
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">1º Vencimento</label>
                          <input
                            type="date"
                            value={payFirstDueDate}
                            onChange={e => {
                              setPayFirstDueDate(e.target.value);
                              setOsCustomDueDates({});
                            }}
                            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-bold"
                          />
                        </div>
                      )}

                      <div className={`sm:col-span-${['Crédito', 'Boleto'].includes(payMethod) ? (payMethod === 'Boleto' ? '12' : '4') : '7'}`}>
                        <button
                          type="button"
                          onClick={handleAddPayment}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                          <Plus size={14} /> Adicionar Pagamento {payMethod === 'Boleto' ? '(Restante no Boleto)' : (payStage === 'restante' ? '(Restante)' : '(Entrada)')}
                        </button>
                      </div>
                    </div>

                    {/* Grade de Vencimentos do Boleto se > 1x */}
                    {payMethod === 'Boleto' && parseInt(payInstallments, 10) > 1 && (
                      <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold border-b border-white/10 pb-1.5">
                          <span className="uppercase tracking-wider font-black flex items-center gap-1.5">
                            <Calendar size={13} /> Datas de Vencimento ({payInstallments}x)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Personalize as datas individuais se necessário
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1 max-h-40 overflow-y-auto">
                          {Array.from({ length: parseInt(payInstallments, 10) }).map((_, i) => {
                            const num = i + 1;
                            const baseD = payFirstDueDate ? new Date(payFirstDueDate + 'T12:00:00') : new Date();
                            const calcD = new Date(baseD);
                            calcD.setDate(calcD.getDate() + 30 * (num - 1));
                            const defaultIso = calcD.toISOString().split('T')[0];
                            const currentVal = osCustomDueDates[num] || defaultIso;

                            return (
                              <div key={num} className="bg-slate-900/90 p-2 rounded-lg border border-white/10 flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {num}ª Parcela
                                </span>
                                <input
                                  type="date"
                                  value={currentVal}
                                  onChange={e => {
                                    setOsCustomDueDates(prev => ({
                                      ...prev,
                                      [num]: e.target.value
                                    }));
                                  }}
                                  className="w-full bg-black/60 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white font-mono outline-none focus:border-emerald-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lista de Pagamentos Lançados */}
                  {payments.length > 0 && (
                    <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                          Pagamentos Adicionados ({payments.length})
                        </label>
                        <button
                          type="button"
                          onClick={handleClearPayments}
                          className="text-[10px] text-rose-400 hover:underline font-bold"
                        >
                          Limpar Todos
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {payments.map(p => {
                          const isRestanteItem = p.method === 'Boleto' || p.stage === 'restante';
                          return (
                            <div
                              key={p.id}
                              className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 flex-1 pr-2 flex-wrap">
                                <button
                                  type="button"
                                  disabled={p.method === 'Boleto'}
                                  onClick={() => handleTogglePaymentStage(p.id)}
                                  title={p.method === 'Boleto' ? 'Boleto é sempre contabilizado no Restante / A Prazo' : 'Clique para alternar entre Entrada e Restante'}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border transition-all ${
                                    isRestanteItem
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25'
                                      : 'bg-teal-500/15 text-teal-300 border-teal-500/35 hover:bg-teal-500/25'
                                  } ${p.method === 'Boleto' ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                  {isRestanteItem ? 'Restante' : 'Entrada'}
                                </button>
                                <p className="font-bold text-white">
                                  {p.texto}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePayment(p.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors shrink-0"
                                title="Remover pagamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campo Editável de Formas de Pagamento Selecionadas */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                      Resumo das Formas de Pagamento (Sincronizado)
                    </label>
                    <textarea 
                      name="formasPagamento" 
                      value={formData.formasPagamento} 
                      onChange={handleChange} 
                      rows="2" 
                      placeholder="Os pagamentos adicionados acima aparecerão aqui organizados..." 
                      className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 resize-none focus:outline-none focus:border-emerald-500/50 font-mono" 
                    />
                  </div>
                </div>
              );
            })()}

            {/* Observações da OS Ativa */}
            <div className="space-y-1.5 bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                Observações Adicionais ({currentOS.label || `Óculos ${activeTabIndex + 1}`})
              </label>
              <textarea 
                name="observacoes" 
                value={currentOS.observacoes || ''} 
                onChange={handleChange} 
                rows="2" 
                placeholder="Observações específicas para esta OS ou orientações ao laboratório..."
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-sky-500"
              ></textarea>
            </div>

          </div>

          {/* Footer / Actions */}
          <div className="sticky bottom-0 z-20 border-t border-white/10 bg-slate-900/95 backdrop-blur-md px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-400 font-bold">
              {osList.length > 1 ? (
                <span className="text-fuchsia-400 flex items-center gap-2">
                  <Layers size={16} /> {osList.length} OSs serão geradas vinculadas à Venda
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-2">
                  <FileText size={16} /> 1 Ordem de Serviço padrão
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={onClose} 
                className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveClick}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-fuchsia-500 to-indigo-500 hover:from-fuchsia-400 hover:to-indigo-400 text-white font-black text-xs rounded-xl shadow-lg shadow-fuchsia-500/25 transition-all active:scale-95"
              >
                <Printer size={16} /> {osList.length > 1 ? `Salvar e Imprimir ${osList.length} OSs` : 'Salvar e Imprimir OS'}
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OSGeneratorModal;
