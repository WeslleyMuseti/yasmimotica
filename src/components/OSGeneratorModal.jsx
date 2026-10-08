import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Save, Printer, User, Eye, FileText, Calendar, DollarSign, 
  Activity, CheckCircle2, AlertTriangle, Trash2, Plus, CreditCard, 
  QrCode, Glasses, Layers, Copy 
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
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '').trim();
};

const parseInitialPayments = (clientData) => {
  if (!clientData) return [];
  let parcs = [];
  try {
    if (Array.isArray(clientData['parcelas']) && clientData['parcelas'].length > 0) {
      parcs = clientData['parcelas'];
    } else if (clientData['PARCELAS_JSON']) {
      parcs = typeof clientData['PARCELAS_JSON'] === 'string' ? JSON.parse(clientData['PARCELAS_JSON']) : clientData['PARCELAS_JSON'];
    }
  } catch (e) {}

  const vFormas = clientData['formasPagamento'] || clientData['FORMA_PAGTO'] || clientData['FORMA DE PAGAMENTO'] || clientData['MEIO_PAGAMENTO'] || '';
  if (!vFormas && (!parcs || parcs.length === 0)) return [];

  const lines = String(vFormas)
    .replace(/(?:FORMA DE PAGAMENTO|FORMA_PAGTO|FORMA_PAGAMENTO|MEIO_PAGAMENTO)\s*:\s*/gi, '')
    .split(/\n|\s*\+\s*/)
    .map(l => l.trim())
    .filter(Boolean);

  const parsed = [];
  lines.forEach((line, idx) => {
    let method = 'Dinheiro';
    if (/pix/i.test(line)) method = 'PIX';
    else if (/d[eé]bito/i.test(line)) method = 'Débito';
    else if (/cr[eé]dito/i.test(line)) method = 'Crédito';
    else if (/boleto|carn[eê]/i.test(line)) method = 'Boleto';

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

    parsed.push({
      id: `init_pay_${Date.now()}_${idx}`,
      method,
      valor: val || (parseCurrency(clientData['valorTotal'] || clientData['VALOR TOTAL']) || 0),
      installments: n,
      parcelas: method === 'Boleto' ? (parcs && parcs.length > 0 ? parcs : []) : [],
      texto: line
    });
  });

  return parsed;
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
  currentUser 
}) => {
  const [selectedCity, setSelectedCity] = useState('');
  const [baseOSNumber, setBaseOSNumber] = useState('');
  
  // Lista de Ordens de Serviço para suportar 1 ou MÚLTIPLAS OS na mesma venda
  const [osList, setOsList] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const userCity = currentUser?.role === 'vendedor' ? (currentUser.city || currentUser.assignedStore || 'Cajati') : null;
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

  // Payment builder state
  const [payMethod, setPayMethod] = useState('Dinheiro');
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
    const entrada = payList.filter(p => p.method !== 'Boleto').reduce((sum, p) => sum + p.valor, 0);
    const boletoTotal = payList.filter(p => p.method === 'Boleto').reduce((sum, p) => sum + p.valor, 0);
    const allParcelas = payList.filter(p => p.method === 'Boleto').flatMap(p => p.parcelas || []);
    
    const rest = boletoTotal > 0 ? boletoTotal : Math.max(0, total - entrada);
    const cleanTexts = payList.map(p => p.texto.trim()).filter(Boolean);
    const textoFinal = cleanTexts.join('\n');

    setFormData(prev => ({
      ...prev,
      valorEntrada: entrada > 0 ? formatCurrency(entrada) : '0,00',
      restante: rest > 0 ? formatCurrency(rest) : '0,00',
      formasPagamento: textoFinal,
      parcelas: allParcelas
    }));
  };

  const handleAddPayment = () => {
    if (!payValue) return;
    const v = parseCurrency(payValue);
    if (v <= 0) return;
    const n = parseInt(payInstallments, 10) || 1;
    const formattedV = formatCurrency(v);
    
    let text = `💵 Dinheiro: R$ ${formattedV}`;
    let parcelasDetalhe = [];

    if (payMethod === 'PIX') {
      text = `⚡ PIX: R$ ${formattedV}`;
    } else if (payMethod === 'Débito') {
      text = `💳 Cartão Débito: R$ ${formattedV}`;
    } else if (payMethod === 'Crédito') {
      if (n > 1) {
        const parcVal = (v / n).toFixed(2).replace('.', ',');
        text = `💳 Cartão Crédito (${n}x de R$ ${parcVal}): R$ ${formattedV}`;
      } else {
        text = `💳 Cartão Crédito (1x à vista): R$ ${formattedV}`;
      }
    } else if (payMethod === 'Boleto') {
      const parcVal = (v / n).toFixed(2).replace('.', ',');
      const vencsTextoArr = [];
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
        
        const parts = calculatedDate.split('-');
        const ptDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : calculatedDate;
        vencsTextoArr.push(`${i}ª ${ptDate}`);

        parcelasDetalhe.push({
          numero: i,
          totalParcelas: n,
          valor: parcVal,
          vencimento: calculatedDate
        });
      }
      text = `📄 Boleto (${n}x de R$ ${parcVal} | Venc: ${vencsTextoArr.join(', ')}): R$ ${formattedV}`;
    }

    const newPayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      method: payMethod,
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
    const remaining = Math.max(0, total - covered);
    if (remaining > 0) {
      setPayValue(formatCurrency(remaining));
    }
  };

  const [formData, setFormData] = useState({
    medico: '',
    dataEntrega: '',
    lente: '',
    armacao: '',
    odEsf: '', odCil: '', odEixo: '', odDnp: '', odAlt: '', odDp: '', odOpa: '',
    oeEsf: '', oeCil: '', oeEixo: '', oeDnp: '', oeAlt: '', oeDp: '', oeOpa: '',
    adicao: '',
    valorTotal: '',
    valorEntrada: '',
    restante: '',
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

  // Calcula o próximo número base de OS
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
    return `${prefix}-${maxNum + 1}`;
  };

  // Inicialização quando clientData abre
  useEffect(() => {
    if (clientData && isOpen) {
      const vTotal = clientData['valorTotal'] || clientData['Valor Devido'] || (clientData['VALOR TOTAL'] ? String(clientData['VALOR TOTAL']) : '') || '';
      const vFormas = clientData['formasPagamento'] || clientData['FORMA_PAGTO'] || clientData['FORMA DE PAGAMENTO'] || '';
      const isBoletoOrCarne = /boleto|carnê|carne/i.test(vFormas);
      const vEntrada = clientData['valorEntrada'] !== undefined && clientData['valorEntrada'] !== '' 
        ? clientData['valorEntrada'] 
        : (isBoletoOrCarne ? '0,00' : (clientData['restante'] ? '0,00' : vTotal));
      const vRestante = clientData['restante'] !== undefined && clientData['restante'] !== '' 
        ? clientData['restante'] 
        : (isBoletoOrCarne ? vTotal : '0,00');
      const vCidade = clientData['Cidade'] || clientData['CIDADE'] || clientData['LOJA'] || clientData['selectedCity'] || (currentUser?.role === 'vendedor' ? currentUser.city : '') || 'Cajati';
      const initialPayments = parseInitialPayments(clientData);
      setPayments(initialPayments);

      const targetCity = userCity || vCidade || 'Cajati';
      setSelectedCity(targetCity);

      const existingOS = clientData['OS DA VENDA'] || clientData['OS'] || clientData['numeroOS'] || saleData?.['OS DA VENDA'] || saleData?.['OS'];
      const nextBase = existingOS ? String(existingOS).replace(/-\d+$/, '') : calculateNextBaseOS(targetCity, salesData);
      setBaseOSNumber(nextBase);

      // Detectar itens ópticos do carrinho para sugerir 1 ou múltiplas OS
      const rawItens = clientData.itens || clientData.cart || saleData?.itens || [];
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

      const generatedList = [];
      for (let i = 0; i < initialCount; i++) {
        const osNum = initialCount > 1 ? `${nextBase}-${i + 1}` : nextBase;
        generatedList.push({
          id: `os_tab_${Date.now()}_${i}`,
          label: `Óculos ${i + 1}`,
          numeroOS: osNum,
          medico: clientData['medico'] || clientData['MEDICO'] || '',
          dataEntrega: clientData['dataEntrega'] || clientData['PREVISAO_ENTREGA'] || '',
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
          adicao: i === 0 ? (clientData['ADICAO'] || clientData['adicao'] || '') : '',
          observacoes: i === 0 ? (clientData['observacoes'] || clientData['OBSERVACOES'] || '') : '',
          valorTotal: ''
        });
      }

      setOsList(generatedList);
      setActiveTabIndex(0);

      setFormData(prev => ({
        ...prev,
        medico: clientData['medico'] || clientData['MEDICO'] || '',
        dataEntrega: clientData['dataEntrega'] || clientData['PREVISAO_ENTREGA'] || '',
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
        adicao: clientData['ADICAO'] || clientData['adicao'] || '',
        valorTotal: vTotal,
        valorEntrada: vEntrada,
        restante: vRestante,
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
  }, [clientData, isOpen, currentUser, userCity]);

  // Atualização de prefixo e base quando a cidade muda
  const handleCityChange = (newCity) => {
    setSelectedCity(newCity);
    const newBase = calculateNextBaseOS(newCity, salesData);
    setBaseOSNumber(newBase);
    setOsList(prev => prev.map((item, idx) => ({
      ...item,
      numeroOS: prev.length === 1 ? newBase : `${newBase}-${idx + 1}`
    })));
  };

  // Alteração do número base manualmente
  const handleBaseOSChange = (newBase) => {
    setBaseOSNumber(newBase);
    setOsList(prev => prev.map((item, idx) => ({
      ...item,
      numeroOS: prev.length === 1 ? newBase : `${newBase}-${idx + 1}`
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
      numeroOS: `${cleanBase}-${nextIdx + 1}`,
      medico: osList[0]?.medico || formData.medico || '',
      dataEntrega: osList[0]?.dataEntrega || formData.dataEntrega || '',
      laboratorio: osList[0]?.laboratorio || formData.laboratorio || '',
      lente: '',
      armacao: '',
      odEsf: '', odCil: '', odEixo: '', odDnp: '', odAlt: '', odDp: '', odOpa: '',
      oeEsf: '', oeCil: '', oeEixo: '', oeDnp: '', oeAlt: '', oeDp: '', oeOpa: '',
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
        adicao: source.adicao,
        laboratorio: source.laboratorio || os.laboratorio
      };
    }));
  };

  const currentOS = osList[activeTabIndex] || osList[0] || {};

  // Manipulador de campos para a OS ativa
  const handleCurrentOSChange = (field, value) => {
    setOsList(prev => prev.map((item, idx) => {
      if (idx !== activeTabIndex) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Se for campo de formulário global financeiro
    if (name === 'valorTotal' || name === 'valorEntrada' || name === 'restante' || name === 'formasPagamento') {
      let newFormData = { ...formData, [name]: value };
      if (name === 'valorTotal' || name === 'valorEntrada') {
        const total = parseCurrency(newFormData.valorTotal) || 0;
        const entrada = parseCurrency(newFormData.valorEntrada) || 0;
        const rest = total - entrada;
        newFormData.restante = rest > 0 ? formatCurrency(rest) : '0,00';
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
    const finalParcelas = payments.filter(p => p.method === 'Boleto').flatMap(p => p.parcelas || []);
    const finalFormas = payments.length > 0 ? payments.map(p => p.texto).join('\n') : formData.formasPagamento;

    if (osList.length <= 1) {
      const activeOS = osList[0] || {};
      const singleData = {
        ...formData,
        ...activeOS,
        numeroOS: activeOS.numeroOS || formData.numeroOS || baseOSNumber,
        formasPagamento: finalFormas,
        parcelas: finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || []),
        PARCELAS_JSON: JSON.stringify(finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])),
        selectedCity: selectedCity || 'Cajati',
        unidade: selectedCity || 'Cajati',
        laboratorio: activeOS.laboratorio || formData.laboratorio || ''
      };
      onSaveAndPrint(singleData);
    } else {
      const multiPayload = {
        isMultiOS: true,
        totalOS: osList.length,
        baseOS: baseOSNumber,
        selectedCity: selectedCity || 'Cajati',
        unidade: selectedCity || 'Cajati',
        formasPagamento: finalFormas,
        parcelas: finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || []),
        PARCELAS_JSON: JSON.stringify(finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])),
        valorTotal: formData.valorTotal,
        valorEntrada: formData.valorEntrada,
        restante: formData.restante,
        orders: osList.map((item, idx) => ({
          ...formData,
          ...item,
          osIndex: idx + 1,
          totalOS: osList.length,
          numeroOS: item.numeroOS || `${baseOSNumber}-${idx + 1}`,
          selectedCity: selectedCity || 'Cajati',
          unidade: selectedCity || 'Cajati',
          formasPagamento: finalFormas,
          parcelas: finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || []),
          PARCELAS_JSON: JSON.stringify(finalParcelas.length > 0 ? finalParcelas : (formData.parcelas || [])),
          laboratorio: item.laboratorio || ''
        }))
      };
      onSaveAndPrint(multiPayload);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-card border border-white/10 shadow-2xl rounded-2xl flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-fuchsia-500/20 rounded-xl flex items-center justify-center">
                <FileText className="text-fuchsia-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Gerar Ordem de Serviço
                  {osList.length > 1 && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                      Multi-OS ({osList.length} Óculos)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Cliente: <span className="text-sky-400 font-bold">{clientData?.['Nome Completo'] || clientData?.['NOME'] || 'Desconhecido'}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>

          {/* BARRA DE ABAS MULTI-OS COM BOTÃO DE ADICIONAR */}
          <div className="bg-slate-950/80 border-b border-white/10 px-6 py-3 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-2">
              {osList.map((os, idx) => (
                <button
                  key={os.id || idx}
                  type="button"
                  onClick={() => setActiveTabIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                    activeTabIndex === idx 
                      ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30 ring-1 ring-fuchsia-400' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <Glasses size={14} />
                  <span>{os.label || `Óculos ${idx + 1}`}</span>
                  <span className="text-[10px] font-mono opacity-80 font-black">
                    ({os.numeroOS || `#${idx + 1}`})
                  </span>
                  {osList.length > 1 && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOS(idx);
                      }}
                      className="ml-1 hover:text-rose-400 transition-colors p-0.5"
                      title="Remover este óculos"
                    >
                      <X size={12} />
                    </span>
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={handleAddOS}
                className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-black flex items-center gap-1.5 transition-all"
                title="Adicionar mais um óculos / OS vinculado nesta mesma venda"
              >
                <Plus size={14} /> Adicionar Óculos (OS)
              </button>
            </div>

            {osList.length > 1 && activeTabIndex > 0 && (
              <button
                type="button"
                onClick={handleCopyPrescriptionFromFirst}
                className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                title="Copiar graus OD/OE do Óculos 1 para este óculos"
              >
                <Copy size={13} /> Copiar Receita do Óculos 1
              </button>
            )}
          </div>

          {/* Form */}
          <div className="p-6 space-y-8">
            
            {/* Bloco 1: Receita / Dioptria do Óculos Ativo */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                  <Activity size={16} className="text-sky-400"/> Receita / Dioptria — {currentOS.label || `Óculos ${activeTabIndex + 1}`}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Identificação:</span>
                  <input
                    type="text"
                    value={currentOS.label || ''}
                    onChange={(e) => handleCurrentOSChange('label', e.target.value)}
                    placeholder="Ex: Óculos 1 - Longe"
                    className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-fuchsia-300 font-bold focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Unidade (Cidade)</label>
                  {userCity ? (
                    <div className="w-full bg-black/60 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-sm text-emerald-400 font-bold flex items-center justify-between">
                      <span>{selectedCity}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase">Unidade Fixa</span>
                    </div>
                  ) : (
                    <select 
                      value={selectedCity} 
                      onChange={(e) => handleCityChange(e.target.value)} 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-sky-400 font-bold focus:outline-none focus:border-sky-500/50"
                    >
                      <option value="">Selecione...</option>
                      <option value="Cajati">Cajati (CAJ)</option>
                      <option value="Registro">Registro (REG)</option>
                      <option value="Jacupiranga">Jacupiranga (JAC)</option>
                      <option value="Venda Externa">Venda Externa (EXT)</option>
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">
                    Nº desta OS {osList.length > 1 ? `(${activeTabIndex + 1}/${osList.length})` : ''}
                  </label>
                  <input 
                    type="text" 
                    name="numeroOS" 
                    value={currentOS.numeroOS || ''} 
                    onChange={handleChange} 
                    placeholder="CAJ-001" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-fuchsia-400 font-bold focus:outline-none focus:border-fuchsia-500/50" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Laboratório Óptico</label>
                  <input 
                    list="datalist-labs-os"
                    type="text" 
                    name="laboratorio" 
                    value={currentOS.laboratorio || ''} 
                    onChange={handleChange} 
                    placeholder="Ex: Haytek, Essilor, Hoya..." 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50" 
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

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Médico Oftalmologista</label>
                  <input 
                    type="text" 
                    name="medico" 
                    value={currentOS.medico || ''} 
                    onChange={handleChange} 
                    placeholder="Nome do Médico" 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Data de Entrega</label>
                  <input 
                    type="date" 
                    name="dataEntrega" 
                    value={currentOS.dataEntrega || ''} 
                    onChange={handleChange} 
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50" 
                  />
                </div>

                {osList.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold">Nº Base da Venda</label>
                    <input 
                      type="text" 
                      value={baseOSNumber} 
                      onChange={(e) => handleBaseOSChange(e.target.value)} 
                      placeholder="CAJ-001" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 font-mono focus:outline-none focus:border-slate-500" 
                    />
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm mt-4 border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-400 text-center">
                      <th className="pb-2 text-left w-12">Olho</th>
                      <th className="pb-2">Esférico</th>
                      <th className="pb-2">Cilíndrico</th>
                      <th className="pb-2">Eixo</th>
                      <th className="pb-2">DNP</th>
                      <th className="pb-2">Altura</th>
                      <th className="pb-2">DP</th>
                      <th className="pb-2">OPA</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-2">
                    <tr>
                      <td className="font-black text-sky-400 pr-2 text-left">OD</td>
                      <td className="px-1"><input type="text" name="odEsf" value={currentOS.odEsf || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1"><input type="text" name="odCil" value={currentOS.odCil || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1"><input type="text" name="odEixo" value={currentOS.odEixo || ''} onChange={handleChange} placeholder="0°" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1"><input type="text" name="odDnp" value={currentOS.odDnp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1"><input type="text" name="odAlt" value={currentOS.odAlt || ''} onChange={handleChange} placeholder="mm" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1"><input type="text" name="odDp" value={currentOS.odDp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1"><input type="text" name="odOpa" value={currentOS.odOpa || ''} onChange={handleChange} placeholder="---" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                    </tr>
                    <tr>
                      <td className="font-black text-emerald-400 pr-2 pt-2 text-left">OE</td>
                      <td className="px-1 pt-2"><input type="text" name="oeEsf" value={currentOS.oeEsf || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1 pt-2"><input type="text" name="oeCil" value={currentOS.oeCil || ''} onChange={handleChange} placeholder="0.00" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1 pt-2"><input type="text" name="oeEixo" value={currentOS.oeEixo || ''} onChange={handleChange} placeholder="0°" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1 pt-2"><input type="text" name="oeDnp" value={currentOS.oeDnp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1 pt-2"><input type="text" name="oeAlt" value={currentOS.oeAlt || ''} onChange={handleChange} placeholder="mm" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1 pt-2"><input type="text" name="oeDp" value={currentOS.oeDp || ''} onChange={handleChange} placeholder="mm" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                      <td className="px-1 pt-2"><input type="text" name="oeOpa" value={currentOS.oeOpa || ''} onChange={handleChange} placeholder="---" className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-xs font-mono" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="w-full sm:w-1/3 mt-3">
                <label className="text-[10px] uppercase text-slate-400 font-bold">Adição (Perto)</label>
                <input 
                  type="text" 
                  name="adicao" 
                  value={currentOS.adicao || ''} 
                  onChange={handleChange} 
                  placeholder="+0.00" 
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-center text-white font-mono text-sm" 
                />
              </div>
            </div>

            {/* Bloco 2: Produtos do Óculos Ativo */}
            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2 border-b border-white/10 pb-2">
                <Eye size={16} className="text-fuchsia-400"/> Lente & Armação — {currentOS.label || `Óculos ${activeTabIndex + 1}`}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Marca/Tipo da Lente</label>
                  <input 
                    list="datalist-lentes-os"
                    type="text" 
                    name="lente" 
                    value={currentOS.lente || ''} 
                    onChange={handleChange} 
                    placeholder="Selecione ou digite..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" 
                  />
                  <datalist id="datalist-lentes-os">
                    {filteredLentes.map((l, idx) => {
                      const nome = `${l.MARCA || l.marca || ''} ${l.MODELO || l.modelo || ''}`.trim();
                      const preco = l.PRECO_VENDA || l.preco_venda || '0,00';
                      return <option key={idx} value={nome}>{`R$ ${preco}`}</option>;
                    })}
                  </datalist>
                </div>
                <div className="space-y-1 relative">
                  <label className="text-[10px] uppercase text-slate-500 font-bold">Modelo da Armação</label>
                  <div className="flex items-center gap-3">
                    <input 
                      list="datalist-armacoes-os"
                      type="text" 
                      name="armacao" 
                      value={currentOS.armacao || ''} 
                      onChange={handleChange} 
                      placeholder="Selecione ou digite..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" 
                    />
                    {(() => {
                      const selectedArmacaoObj = filteredArmacoes.find(a => `${a.MARCA || a.marca || ''} ${a.MODELO || a.modelo || ''}`.trim() === (currentOS.armacao || ''));
                      if (selectedArmacaoObj && selectedArmacaoObj.IMAGEM) {
                        return (
                          <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-black/40 shadow-xl">
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
                      return <option key={idx} value={nome}>{`R$ ${preco}`}</option>;
                    })}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Bloco 3: Financeiro & Cobrança Unificada */}
            {(() => {
              const totalVal = parseCurrency(formData.valorTotal);
              const coveredVal = payments.reduce((sum, p) => sum + p.valor, 0);
              const remainingVal = Math.max(0, totalVal - coveredVal);
              const isFullyCovered = Math.abs(coveredVal - totalVal) < 0.05 && totalVal > 0;

              return (
                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2 border-b border-white/10 pb-2">
                    <DollarSign size={16} className="text-emerald-400"/> Financeiro &amp; Cobrança Unificada do Cliente
                  </h4>

                  {/* Banner de Cobrança Unificada se houver mais de 1 OS */}
                  {osList.length > 1 && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                          Faturamento Unificado para o Cliente ({osList.length} Ordens de Serviço Vinculadas)
                        </p>
                        <p className="text-[11px] text-slate-300 font-medium mt-0.5 leading-snug">
                          O cliente será cobrado uma única vez pelo valor total da compra ({formatCurrency(formData.valorTotal)}). Todas as {osList.length} OSs geradas compartilham a mesma venda, mesmo cadastro e mesmo vendedor, gerando fichas distintas para o laboratório sem duplicar títulos a receber ou saldo no boleto.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumo em 3 Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold">Valor Total da Venda (R$)</label>
                      <input 
                        type="text" 
                        name="valorTotal" 
                        value={formData.valorTotal} 
                        onChange={handleChange} 
                        onBlur={handleCalculateRestante} 
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-emerald-400 font-black focus:border-emerald-500 outline-none" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold">Sinal / Entrada (R$)</label>
                      <input 
                        type="text" 
                        name="valorEntrada" 
                        value={formData.valorEntrada} 
                        onChange={handleChange} 
                        onBlur={handleCalculateRestante} 
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-teal-300 font-bold focus:border-emerald-500 outline-none" 
                      />
                      <span className="text-[9px] text-slate-500 block">Dinheiro, PIX e Cartões</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-bold">Restante / A Prazo (R$)</label>
                      <input 
                        type="text" 
                        name="restante" 
                        value={formData.restante} 
                        onChange={handleChange} 
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-amber-300 font-black bg-white/5 outline-none" 
                        readOnly 
                      />
                      <span className="text-[9px] text-slate-500 block">Boleto</span>
                    </div>
                  </div>

                  {/* Status de Cobertura */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                    isFullyCovered 
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                      : coveredVal > totalVal + 0.01 
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isFullyCovered ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className={coveredVal > totalVal + 0.01 ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />
                      )}
                      <div>
                        <span>
                          {isFullyCovered 
                            ? '✅ Total da Venda 100% Coberto!' 
                            : coveredVal > totalVal + 0.01 
                            ? `⚠️ Valor lançado excede o total em R$ ${formatCurrency(coveredVal - totalVal)}` 
                            : `⚠️ Falta cobrir: R$ ${formatCurrency(remainingVal)}`}
                        </span>
                        <span className="text-[10px] opacity-75 block font-normal">
                          Lançado: R$ {formatCurrency(coveredVal)} de R$ {formatCurrency(totalVal)}
                        </span>
                      </div>
                    </div>
                    {remainingVal > 0 && (
                      <button
                        type="button"
                        onClick={handleFillRemaining}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-black uppercase transition-colors"
                      >
                        Preencher Restante
                      </button>
                    )}
                  </div>

                  {/* Construtor de Pagamentos */}
                  <div className="p-4 border border-emerald-500/30 rounded-xl bg-emerald-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase text-emerald-400 font-bold block">
                        Adicionar Forma de Pagamento
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Selecione o método para lançar
                      </span>
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            payMethod === m.id
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/20'
                              : 'bg-black/40 text-slate-400 border-white/5 hover:text-white'
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
                          <label className="text-[10px] uppercase text-slate-400 font-bold">Valor (R$)</label>
                          {remainingVal > 0 && (
                            <button
                              type="button"
                              onClick={handleFillRemaining}
                              className="text-[9px] text-emerald-400 hover:underline font-bold"
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
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 outline-none font-bold"
                        />
                      </div>

                      {['Crédito', 'Boleto'].includes(payMethod) && (
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] uppercase text-slate-400 font-bold">Parcelas</label>
                          <select
                            value={payInstallments}
                            onChange={e => {
                              setPayInstallments(e.target.value);
                              setOsCustomDueDates({});
                            }}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none font-bold"
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
                          <label className="text-[10px] uppercase text-slate-400 font-bold">1º Vencimento</label>
                          <input
                            type="date"
                            value={payFirstDueDate}
                            onChange={e => {
                              setPayFirstDueDate(e.target.value);
                              setOsCustomDueDates({});
                            }}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-bold"
                          />
                        </div>
                      )}

                      <div className={`sm:col-span-${['Crédito', 'Boleto'].includes(payMethod) ? (payMethod === 'Boleto' ? '12' : '4') : '7'}`}>
                        <button
                          type="button"
                          onClick={handleAddPayment}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                        >
                          <Plus size={14} /> Adicionar Pagamento
                        </button>
                      </div>
                    </div>

                    {/* Grade de Vencimentos do Boleto se > 1x */}
                    {payMethod === 'Boleto' && parseInt(payInstallments, 10) > 1 && (
                      <div className="mt-2 p-3 bg-black/60 rounded-xl border border-white/5 space-y-2">
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
                              <div key={num} className="bg-white/5 p-2 rounded-lg border border-white/10 flex flex-col gap-1">
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase text-slate-400 font-bold">
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
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {payments.map(p => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs"
                          >
                            <div className="flex-1 pr-2">
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
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Campo Editável de Formas de Pagamento Selecionadas */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold">
                      Resumo das Formas de Pagamento (Sincronizado)
                    </label>
                    <textarea 
                      name="formasPagamento" 
                      value={formData.formasPagamento} 
                      onChange={handleChange} 
                      rows="2"
                      placeholder="Os pagamentos adicionados acima aparecerão aqui organizados..." 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-300 resize-none focus:outline-none focus:border-emerald-500/50" 
                    />
                  </div>
                </div>
              );
            })()}

            {/* Observações da OS Ativa */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-500 font-bold">
                Observações Adicionais ({currentOS.label || `Óculos ${activeTabIndex + 1}`})
              </label>
              <textarea 
                name="observacoes" 
                value={currentOS.observacoes || ''} 
                onChange={handleChange} 
                rows="2" 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white resize-none"
              ></textarea>
            </div>

          </div>

          {/* Footer / Actions */}
          <div className="sticky bottom-0 border-t border-white/10 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400 font-bold">
              {osList.length > 1 ? (
                <span className="text-fuchsia-400 flex items-center gap-1.5">
                  <Layers size={15} /> {osList.length} OSs serão geradas vinculadas à Venda
                </span>
              ) : (
                <span>1 Ordem de Serviço padrão</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white transition-colors">
                Cancelar
              </button>
              <button 
                onClick={handleSaveClick}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-fuchsia-500 to-indigo-500 hover:from-fuchsia-400 hover:to-indigo-400 text-white font-black rounded-xl shadow-lg shadow-fuchsia-500/20 transition-all active:scale-95"
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
