import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  ClipboardList, 
  Eye, 
  Calendar, 
  DollarSign, 
  PackageCheck, 
  AlertCircle,
  Building2, 
  User, 
  Stethoscope, 
  Glasses,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  QrCode,
  FileText,
  ShieldCheck,
  Clock,
  AlertOctagon
} from 'lucide-react';
import { buildNormalizedDateTime } from '../dateSyncUtils';

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

const formatMoney = (val) => {
  return Number(cleanVal(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrency = cleanVal;

const formatSafeDate = (dStr) => {
  if (!dStr) return new Date().toLocaleDateString('pt-BR');
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

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

const formatEditMethodLabel = (method, installments = 1) => {
  const m = String(method || '').toLowerCase();
  const n = parseInt(installments, 10) || 1;
  if (m === 'pix') return 'PIX';
  if (m === 'debito') return 'Cartão de Débito';
  if (m === 'credito') return n > 1 ? `Cartão de Crédito (${n}x)` : 'Cartão de Crédito';
  if (m === 'carne' || m === 'boleto') return n > 1 ? `Boleto (${n}x)` : 'Boleto';
  if (m === 'dinheiro') return 'Dinheiro';
  if (m === 'combinar' || /combinar|retirada/i.test(m)) return 'A Combinar na Retirada';
  return method || '';
};

const buildPaymentObject = (method, val, cashReceivedVal, installmentsCount, dueDate, customDates = {}, stage = 'entrada') => {
  let texto = '';
  let parcelasDetalhe = [];
  let trocoLocal = 0;
  const n = parseInt(installmentsCount, 10) || 1;
  const valorNumerico = Math.max(0, cleanVal(val));
  const isBoletoMethod = method === 'carne' || method === 'boleto';
  const isCombinarMethod = method === 'combinar';
  const effectiveStage = (isBoletoMethod || isCombinarMethod) ? 'restante' : (stage === 'restante' ? 'restante' : 'entrada');
  const stageTag = effectiveStage === 'restante' && !isBoletoMethod && !isCombinarMethod ? ' (Restante)' : '';

  if (method === 'dinheiro') {
    const recebido = cleanVal(cashReceivedVal) || valorNumerico;
    trocoLocal = Math.max(0, recebido - valorNumerico);
    texto = `💵 Dinheiro${stageTag}: ${fmtMoeda(valorNumerico)}${trocoLocal > 0 ? ` (Recebido: ${fmtMoeda(recebido)} | Troco: ${fmtMoeda(trocoLocal)})` : ''}`;
  } else if (method === 'pix') {
    texto = `⚡ PIX${stageTag}: ${fmtMoeda(valorNumerico)}`;
  } else if (method === 'debito') {
    texto = `💳 Cartão Débito${stageTag}: ${fmtMoeda(valorNumerico)}`;
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
      texto = `💳 Cartão Crédito (${effectiveStage === 'restante' ? 'Restante - ' : ''}${n}x de ${fmtMoeda(vParc)}): ${fmtMoeda(valorNumerico)}`;
    } else {
      texto = `💳 Cartão Crédito (${effectiveStage === 'restante' ? 'Restante - ' : ''}1x à vista): ${fmtMoeda(valorNumerico)}`;
    }
  } else if (method === 'combinar') {
    texto = `🤝 A Combinar na Retirada (Restante): ${fmtMoeda(valorNumerico)}`;
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
    installments: n,
    valor: valorNumerico,
    texto,
    parcelas: parcelasDetalhe,
    troco: trocoLocal,
    valorRecebido: cleanVal(cashReceivedVal)
  };
};

const parsePaymentsFromString = (fpStr, totalExpected, defaultDue, entradaExpected = 0, restanteExpected = 0) => {
  if (!fpStr || typeof fpStr !== 'string') return null;
  const parts = fpStr.split(/\n|\s*\+\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return null;
  
  let accEntrada = 0;
  const parsed = [];
  for (const part of parts) {
    let metodo = 'dinheiro';
    if (/pix/i.test(part)) metodo = 'pix';
    else if (/d[eé]bito/i.test(part)) metodo = 'debito';
    else if (/cr[eé]dito/i.test(part)) metodo = 'credito';
    else if (/boleto|carn[eê]/i.test(part)) metodo = 'carne';
    else if (/combinar|retirada/i.test(part)) metodo = 'combinar';
    
    const xMatch = part.match(/(\d+)x/i);
    const n = xMatch ? parseInt(xMatch[1], 10) : 1;
    
    const valMatches = [...part.matchAll(/R\$\s*([\d.,]+)/gi)];
    let val = 0;
    if (valMatches.length > 0) {
      val = cleanVal(valMatches[valMatches.length - 1][1]);
    }
    
    if (val > 0) {
      let stage = 'entrada';
      if (metodo === 'carne' || metodo === 'combinar' || /restante|falta|na retirada|na entrega|a pagar|a prazo/i.test(part)) {
        stage = 'restante';
      } else if (!/entrada|sinal/i.test(part) && restanteExpected > 0 && entradaExpected > 0 && accEntrada >= entradaExpected - 0.05 && Math.abs(val - restanteExpected) < 0.05) {
        stage = 'restante';
      }
      if (stage === 'entrada') accEntrada += val;
      parsed.push(buildPaymentObject(metodo, val, val, n, defaultDue, {}, stage));
    }
  }
  return parsed.length > 0 ? parsed : null;
};

const EditOSModal = ({
  isOpen,
  onClose,
  osData,
  clientData,
  currentUser,
  onSave
}) => {
  const [formData, setFormData] = useState({
    numeroOS: '',
    status: 'Aguardando Confirmação',
    armacao: '',
    lente: '',
    laboratorio: '',
    medico: '',
    dataVenda: '',
    dataEntrega: '',
    valorTotal: '',
    valorEntrada: '',
    restante: '',
    formaPagamentoEntrada: '',
    formaPagamentoRestante: '',
    formasPagamento: '',
    observacoes: '',
    odEsf: '',
    odCil: '',
    odEixo: '',
    odDnp: '',
    odAlt: '',
    oeEsf: '',
    oeCil: '',
    oeEixo: '',
    oeDnp: '',
    oeAlt: '',
    odPertoEsf: '',
    odPertoCil: '',
    odPertoEixo: '',
    odPertoDnp: '',
    odPertoAlt: '',
    oePertoEsf: '',
    oePertoCil: '',
    oePertoEixo: '',
    oePertoDnp: '',
    oePertoAlt: '',
    adicao: ''
  });

  const [activeTab, setActiveTab] = useState('geral'); // 'geral', 'receita', 'financeiro'

  // Construtor Dinâmico de Formas de Pagamento (Idêntico ao Caixa / PDV)
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

  useEffect(() => {
    if (osData) {
      const numOS = String(osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || osData['OS da COMPRA'] || '').trim();
      const rawTotal = osData['VALOR TOTAL'] || osData['VALOR DO ORÇAMENTO'] || osData['VALOR DA VENDA'] || osData['VALOR'] || '';
      const totalNum = cleanVal(rawTotal);
      const rawEntrada = osData['VALOR ENTRADA'] || osData['SINAL'] || '';
      const entradaNum = cleanVal(rawEntrada);
      const rawRestante = osData['RESTANTE'] || '';
      const restanteNum = cleanVal(rawRestante) || Math.max(0, totalNum - entradaNum);
      const fpStr = osData['FORMAS_PAGAMENTO'] || osData['FORMA_PAGTO'] || osData['FORMA DE PAGAMENTO'] || osData['MEIO_PAGAMENTO'] || '';
      const rawFormaEntrada = osData['FORMA_ENTRADA'] || osData['formaPagamentoEntrada'] || '';
      const rawFormaRestante = osData['FORMA_RESTANTE'] || osData['formaPagamentoRestante'] || '';

      setFormData({
        numeroOS: numOS,
        status: 'Aguardando Confirmação',
        armacao: osData['ARMAÇÃO'] || osData['Armação'] || osData['PRODUTO'] || '',
        lente: osData['LENTE'] || osData['Lente'] || '',
        laboratorio: osData['LABORATORIO'] || osData['Laboratório'] || osData['LAB'] || '',
        medico: osData['MEDICO'] || osData['Médico'] || '',
        dataVenda: osData['DATA  DA VENDA'] || osData['DATA DA VENDA'] || osData['DATA_VENDA'] || osData['Data da Venda'] || osData['data_venda'] || osData['dataVenda'] || osData['DATA'] || osData['Data'] || '',
        dataEntrega: osData['DATA ENTREGA ÓCULOS'] || osData['DATA_ENTREGA'] || osData['Previsão Entrega'] || osData['DATA VENCIMENTO'] || '',
        valorTotal: formatMoney(totalNum),
        valorEntrada: formatMoney(entradaNum),
        restante: formatMoney(restanteNum),
        formaPagamentoEntrada: rawFormaEntrada,
        formaPagamentoRestante: rawFormaRestante,
        formasPagamento: fpStr,
        observacoes: osData['OBSERVACOES'] || osData['OBS'] || osData['Observações'] || '',
        // Prescrição OD
        odEsf: osData['OD_ESF'] || osData['odEsf'] || osData['OD ESF'] || '',
        odCil: osData['OD_CIL'] || osData['odCil'] || osData['OD CIL'] || '',
        odEixo: osData['OD_EIXO'] || osData['odEixo'] || osData['OD EIXO'] || '',
        odDnp: osData['OD_DNP'] || osData['odDnp'] || osData['OD DNP'] || '',
        odAlt: osData['OD_ALT'] || osData['odAlt'] || osData['OD ALT'] || '',
        // Prescrição OE
        oeEsf: osData['OE_ESF'] || osData['oeEsf'] || osData['OE ESF'] || '',
        oeCil: osData['OE_CIL'] || osData['oeCil'] || osData['OE CIL'] || '',
        oeEixo: osData['OE_EIXO'] || osData['oeEixo'] || osData['OE EIXO'] || '',
        oeDnp: osData['OE_DNP'] || osData['oeDnp'] || osData['OE DNP'] || '',
        oeAlt: osData['OE_ALT'] || osData['oeAlt'] || osData['OE ALT'] || '',
        // Perto OD
        odPertoEsf: osData['OD_PERTO_ESF'] || osData['odPertoEsf'] || '',
        odPertoCil: osData['OD_PERTO_CIL'] || osData['odPertoCil'] || '',
        odPertoEixo: osData['OD_PERTO_EIXO'] || osData['odPertoEixo'] || '',
        odPertoDnp: osData['OD_PERTO_DNP'] || osData['odPertoDnp'] || '',
        odPertoAlt: osData['OD_PERTO_ALT'] || osData['odPertoAlt'] || '',
        // Perto OE
        oePertoEsf: osData['OE_PERTO_ESF'] || osData['oePertoEsf'] || '',
        oePertoCil: osData['OE_PERTO_CIL'] || osData['oePertoCil'] || '',
        oePertoEixo: osData['OE_PERTO_EIXO'] || osData['oePertoEixo'] || '',
        oePertoDnp: osData['OE_PERTO_DNP'] || osData['oePertoDnp'] || '',
        oePertoAlt: osData['OE_PERTO_ALT'] || osData['oePertoAlt'] || '',
        // Adição
        adicao: osData['ADICAO'] || osData['adicao'] || osData['ADIÇÃO'] || ''
      });

      // Inicializa pagamentos a partir dos dados existentes da OS
      let initialPays = [];
      let rawPayments = osData.payments;
      if (typeof rawPayments === 'string') {
        try { rawPayments = JSON.parse(rawPayments); } catch (e) {}
      }
      if (Array.isArray(rawPayments) && rawPayments.length > 0) {
        initialPays = rawPayments;
      } else {
        const parsedFromString = parsePaymentsFromString(fpStr, totalNum, payFirstDueDate, entradaNum, restanteNum);
        if (parsedFromString && parsedFromString.length > 0) {
          initialPays = parsedFromString;
        } else {
          let boletoParcs = [];
          try {
            if (osData.PARCELAS_JSON) boletoParcs = JSON.parse(osData.PARCELAS_JSON);
            else if (Array.isArray(osData.parcelas)) boletoParcs = osData.parcelas;
          } catch (e) {}

        if (boletoParcs.length > 0) {
          const boletoVal = restanteNum > 0 ? restanteNum : boletoParcs.reduce((acc, p) => acc + cleanVal(p.valor), 0);
          const n = boletoParcs.length;
          const vParc = boletoVal / n;
          const vencsTexto = boletoParcs.map(p => `${p.numero}ª ${p.vencimento}`).join(', ');
          initialPays.push({
            id: 'init_carne',
            metodo: 'carne',
            stage: 'restante',
            valor: boletoVal,
            texto: `📄 Boleto (${n}x de ${fmtMoeda(vParc)} | Venc: ${vencsTexto}): ${fmtMoeda(boletoVal)}`,
            parcelas: boletoParcs
          });

          if (entradaNum > 0) {
            let m = 'dinheiro';
            if (/pix/i.test(rawFormaEntrada || fpStr)) m = 'pix';
            else if (/d[eé]bito/i.test(rawFormaEntrada || fpStr)) m = 'debito';
            else if (/cr[eé]dito/i.test(rawFormaEntrada || fpStr)) m = 'credito';
            initialPays.unshift(buildPaymentObject(m, entradaNum, entradaNum, 1, '', {}, 'entrada'));
          }
        } else if (totalNum > 0) {
          const isApenasBoleto = /boleto|carn[eê]/i.test(fpStr) && !/dinheiro|pix|d[eé]bito|cr[eé]dito/i.test(fpStr);
          if (isApenasBoleto) {
            const match = fpStr.match(/(\d+)x/i);
            const n = match ? parseInt(match[1], 10) : 1;
            const defDue = new Date();
            defDue.setDate(defDue.getDate() + 30);
            initialPays.push(buildPaymentObject('carne', totalNum, totalNum, n, defDue.toISOString().split('T')[0], {}, 'restante'));
          } else if (entradaNum > 0 && restanteNum > 0) {
            let mEnt = 'dinheiro';
            const entRef = rawFormaEntrada || fpStr;
            if (/pix/i.test(entRef)) mEnt = 'pix';
            else if (/d[eé]bito/i.test(entRef)) mEnt = 'debito';
            else if (/cr[eé]dito/i.test(entRef)) mEnt = 'credito';
            initialPays.push(buildPaymentObject(mEnt, entradaNum, entradaNum, 1, '', {}, 'entrada'));

            let mRest = 'carne';
            const restRef = rawFormaRestante || fpStr;
            if (rawFormaRestante || /combinar|retirada/i.test(fpStr)) {
              const targetRestStr = rawFormaRestante || fpStr;
              if (/pix/i.test(targetRestStr)) mRest = 'pix';
              else if (/d[eé]bito/i.test(targetRestStr)) mRest = 'debito';
              else if (/cr[eé]dito/i.test(targetRestStr)) mRest = 'credito';
              else if (/dinheiro/i.test(targetRestStr)) mRest = 'dinheiro';
              else if (/combinar|retirada/i.test(targetRestStr)) mRest = 'combinar';
              else if (/boleto|carn[eê]/i.test(targetRestStr)) mRest = 'carne';
            }
            const xRestMatch = String(restRef).match(/(\d+)x/i);
            const nRest = xRestMatch ? parseInt(xRestMatch[1], 10) : 1;
            const defDue = new Date();
            defDue.setDate(defDue.getDate() + 30);
            initialPays.push(buildPaymentObject(mRest, restanteNum, restanteNum, nRest, defDue.toISOString().split('T')[0], {}, 'restante'));
          } else {
            const singleRef = (entradaNum === 0 && restanteNum > 0) ? (rawFormaRestante || fpStr) : (rawFormaEntrada || fpStr);
            let m = 'dinheiro';
            if (/pix/i.test(singleRef)) m = 'pix';
            else if (/d[eé]bito/i.test(singleRef)) m = 'debito';
            else if (/cr[eé]dito/i.test(singleRef)) m = 'credito';
            else if (/combinar|retirada/i.test(singleRef)) m = 'combinar';
            else if (/boleto|carn[eê]/i.test(singleRef)) m = 'carne';
            const xSingleMatch = String(singleRef || fpStr).match(/(\d+)x/i);
            const nSingle = xSingleMatch ? parseInt(xSingleMatch[1], 10) : 1;
            const defDue = new Date();
            defDue.setDate(defDue.getDate() + 30);
            const stageInit = (m === 'carne' || m === 'combinar' || (entradaNum === 0 && restanteNum > 0)) ? 'restante' : 'entrada';
            initialPays.push(buildPaymentObject(m, totalNum, totalNum, nSingle, defDue.toISOString().split('T')[0], {}, stageInit));
          }
        }
      }
    }
    setPayments(initialPays);
  }
}, [osData]);

  if (!isOpen || !osData) return null;

  // Cálculos de Cobertura e Valores
  const totalFinal = cleanVal(formData.valorTotal);
  const covered = payments.reduce((acc, p) => acc + (cleanVal(p.valor) || 0), 0);
  const remaining = Math.max(0, totalFinal - covered);
  const isFullyCovered = Math.abs(covered - totalFinal) < 0.01 && totalFinal > 0;

  const totalPagoImediato = payments.reduce((acc, p) => {
    const m = String(p.metodo || '').toLowerCase();
    if (m === 'boleto' || m === 'carne' || p.stage === 'restante') return acc;
    return acc + (cleanVal(p.valor) || 0);
  }, 0);

  const totalBoletoCarne = payments.reduce((acc, p) => {
    const m = String(p.metodo || '').toLowerCase();
    if (m === 'boleto' || m === 'carne' || p.stage === 'restante') return acc + (cleanVal(p.valor) || 0);
    return acc;
  }, 0);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Adicionar forma de pagamento à lista fracionada
  const handleAddPayment = () => {
    if (payments.length > 0 && isFullyCovered) {
      alert(`O valor total da OS (${fmtMoeda(totalFinal)}) já está 100% coberto. Se deseja alterar as formas de pagamento, remova um pagamento clicando na lixeira 🗑️ abaixo.`);
      return;
    }

    if (currentMethod === 'carne' && String(clientData?.['Status de Pagamento'] || '').toLowerCase() === 'inadimplente') {
      const clientName = clientData?.['Nome Completo'] || clientData?.['NOME'] || 'o cliente';
      const allow = window.confirm(
        `⚠️ ALERTA DE RISCO DE CRÉDITO:\n\n${clientName} possui pendências financeiras registradas no cadastro.\n\nDeseja autorizar o parcelamento em BOLETO para este cliente?`
      );
      if (!allow) return;
    }

    const rawVal = cleanVal(paymentInputVal) || (currentMethod === 'dinheiro' ? cleanVal(cashTendered) : 0) || remaining;
    const val = remaining > 0 ? Math.min(rawVal, remaining) : (rawVal || totalFinal);

    if (val <= 0) {
      alert('Informe o valor a ser pago nesta forma de pagamento.');
      return;
    }

    const effectiveStage = (currentMethod === 'carne' || currentMethod === 'combinar') ? 'restante' : currentStage;
    const newPay = buildPaymentObject(currentMethod, val, cashTendered, payInstallments, payFirstDueDate, customDueDates, effectiveStage);
    const nextList = [...payments, newPay];
    setPayments(nextList);
    setPaymentInputVal('');
    setCashTendered('');
    setPayInstallments(1);
    setCustomDueDates({});
    const nextCov = nextList.reduce((acc, p) => acc + (cleanVal(p.valor) || 0), 0);
    if (effectiveStage === 'entrada' && totalFinal > nextCov + 0.01) {
      setCurrentStage('restante');
    } else {
      setCurrentStage('entrada');
    }
  };

  const togglePaymentStage = (id) => {
    setPayments(prev => prev.map(p => {
      if (p.id !== id || p.metodo === 'carne' || p.metodo === 'boleto' || p.metodo === 'combinar') return p;
      const nextStage = p.stage === 'restante' ? 'entrada' : 'restante';
      const rebuilt = buildPaymentObject(p.metodo, p.valor, p.valorRecebido || p.valor, p.installments || (p.parcelas?.length || 1), payFirstDueDate, {}, nextStage);
      return {
        ...p,
        stage: nextStage,
        texto: rebuilt.texto
      };
    }));
  };

  const removePayment = (id) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleClearPayments = () => {
    setPayments([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const isSecondary = Boolean(
      osData?.isSecondaryOS || 
      (osData?.FINANCEIRO_UNIFICADO && (cleanVal(osData?.['VALOR TOTAL']) === 0 || osData?.['VALOR TOTAL'] === '0,00'))
    );

    if (isSecondary) {
      const secNormDate = buildNormalizedDateTime(formData.dataVenda, osData.hora || osData.HORA);
      const updatedRow = {
        ...osData,
        'OS DA VENDA': (formData.numeroOS && formData.numeroOS.trim()) || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || '',
        'OS': (formData.numeroOS && formData.numeroOS.trim()) || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || '',
        'VENDA_OS': (formData.numeroOS && formData.numeroOS.trim()) || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || '',
        'STATUS_OS': 'Aguardando Confirmação',
        'SITUAÇÃO': 'Aguardando Confirmação',
        'PAGAMENTO_CONFERIDO': 'Sim',
        'DUPLICATAS_GERADAS': true,
        'isSecondaryOS': true,
        'isMultiOS': true,
        'saleId': osData.saleId || osData.parentSaleId || '',
        'parentSaleId': osData.parentSaleId || osData.saleId || '',
        'FINANCEIRO_UNIFICADO': true,
        'COBRANCA_UNICA': true,
        'ARMAÇÃO': formData.armacao,
        'LENTE': formData.lente,
        'PRODUTO': [formData.armacao, formData.lente].filter(Boolean).join(' + ') || osData['PRODUTO'] || 'Óculos Completo',
        'LABORATORIO': formData.laboratorio,
        'MEDICO': formData.medico,
        'DATA  DA VENDA': secNormDate.brDate,
        'DATA DA VENDA': secNormDate.brDate,
        'DATA_VENDA': secNormDate.brDate,
        'Data da Venda': secNormDate.brDate,
        'data_venda': secNormDate.brDate,
        'DATA': secNormDate.brDate,
        dataVenda: secNormDate.isoDate,
        data: secNormDate.brDate,
        dataHora: secNormDate.isoDateTime,
        DATA_HORA: secNormDate.brDateTime,
        timestamp: secNormDate.timestamp,
        hora: secNormDate.timeStr,
        HORA: secNormDate.timeStr,
        'DATA ENTREGA ÓCULOS': formData.dataEntrega,
        'DATA_ENTREGA': formData.dataEntrega,
        'VALOR TOTAL': '0,00',
        'VALOR': '0,00',
        'VALOR DA VENDA': '0,00',
        'VALOR ENTRADA': '0,00',
        'SINAL': '0,00',
        'RESTANTE': '0,00',
        'FORMAS_PAGAMENTO': osData['FORMAS_PAGAMENTO'] || `Cobrança Unificada (Venda #${osData.saleId || ''})`,
        'FORMA_PAGTO': osData['FORMA_PAGTO'] || `Cobrança Unificada (Venda #${osData.saleId || ''})`,
        'OD_ESF': formData.odEsf,
        'OD_CIL': formData.odCil,
        'OD_EIXO': formData.odEixo,
        'OD_DNP': formData.odDnp,
        'OD_ALT': formData.odAlt,
        'OE_ESF': formData.oeEsf,
        'OE_CIL': formData.oeCil,
        'OE_EIXO': formData.oeEixo,
        'OE_DNP': formData.oeDnp,
        'OE_ALT': formData.oeAlt,
        'OD_PERTO_ESF': formData.odPertoEsf,
        'OD_PERTO_CIL': formData.odPertoCil,
        'OD_PERTO_EIXO': formData.odPertoEixo,
        'OD_PERTO_DNP': formData.odPertoDnp,
        'OD_PERTO_ALT': formData.odPertoAlt,
        'OE_PERTO_ESF': formData.oePertoEsf,
        'OE_PERTO_CIL': formData.oePertoCil,
        'OE_PERTO_EIXO': formData.oePertoEixo,
        'OE_PERTO_DNP': formData.oePertoDnp,
        'OE_PERTO_ALT': formData.oePertoAlt,
        'ADICAO': formData.adicao,
        'OBSERVACOES': formData.observacoes,
        'DATA_EDICAO': new Date().toISOString(),
        'EDITADO_POR': currentUser?.username || 'Usuário'
      };

      if (onSave) {
        onSave(updatedRow);
      }
      return;
    }

    const totalVal = cleanVal(formData.valorTotal);
    if (totalVal <= 0) {
      alert('Por favor, informe um Valor Total válido para a OS.');
      setActiveTab('financeiro');
      return;
    }

    // Se nenhum pagamento adicionado, tenta auto-gerar cobrindo 100%
    let effectivePayments = [...payments];
    if (effectivePayments.length === 0) {
      const valDigitado = cleanVal(paymentInputVal);
      if (valDigitado > 0 && valDigitado < totalVal - 0.01) {
        alert(`O valor digitado (${fmtMoeda(valDigitado)}) é menor que o total da OS (${fmtMoeda(totalVal)}). Clique em "+ Dividir / Adicionar Pagamento" para lançar e adicione a forma de pagamento do restante.`);
        setActiveTab('financeiro');
        return;
      }
      const autoPay = buildPaymentObject(currentMethod, totalVal, cashTendered, payInstallments, payFirstDueDate, customDueDates, currentStage);
      effectivePayments = [autoPay];
    }

    const sumPayments = effectivePayments.reduce((acc, p) => acc + (cleanVal(p.valor) || 0), 0);
    if (Math.abs(sumPayments - totalVal) > 0.05) {
      alert(`⚠️ Erro de Validação Financeira!\n\nA soma das formas de pagamento (R$ ${formatMoney(sumPayments)}) deve ser exatamente igual ao Valor Total da OS (R$ ${formatMoney(totalVal)}).\nDiferença: R$ ${formatMoney(Math.abs(sumPayments - totalVal))}`);
      setActiveTab('financeiro');
      return;
    }

    // Cálculo exato de Entrada vs Restante (suportando tanto Boleto quanto Restante em PIX/Cartão/Dinheiro)
    const entradaPays = effectivePayments.filter(p => {
      const m = String(p.metodo || '').toLowerCase();
      return m !== 'boleto' && m !== 'carne' && p.stage !== 'restante';
    });
    const restantePays = effectivePayments.filter(p => {
      const m = String(p.metodo || '').toLowerCase();
      return m === 'boleto' || m === 'carne' || p.stage === 'restante';
    });

    const entradaFinal = entradaPays.reduce((acc, p) => acc + (cleanVal(p.valor) || 0), 0);
    const restanteFinal = Math.max(0, totalVal - entradaFinal);

    const derivedFormaEntrada = [...new Set(entradaPays.map(p => formatEditMethodLabel(p.metodo, p.installments || (p.parcelas?.length || 1))).filter(Boolean))].join(' + ');
    const derivedFormaRestante = [...new Set(restantePays.map(p => formatEditMethodLabel(p.metodo, p.installments || (p.parcelas?.length || 1))).filter(Boolean))].join(' + ');

    const finalFormaEntrada = entradaFinal > 0 ? (derivedFormaEntrada || formData.formaPagamentoEntrada || '') : '';
    const finalFormaRestante = restanteFinal > 0 ? (derivedFormaRestante || formData.formaPagamentoRestante || '') : '';

    // Extração de parcelas estruturadas de boleto
    const allBoletoParcelas = effectivePayments
      .filter(p => p.metodo === 'carne' || p.metodo === 'boleto')
      .flatMap(p => p.parcelas || []);

    const normDate = buildNormalizedDateTime(formData.dataVenda, osData.hora || osData.HORA);

    const updatedRow = {
      ...osData,
      'OS DA VENDA': (formData.numeroOS && formData.numeroOS.trim()) || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || '',
      'OS': (formData.numeroOS && formData.numeroOS.trim()) || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || '',
      'VENDA_OS': (formData.numeroOS && formData.numeroOS.trim()) || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || '',
      // Reconfirmação Obrigatória do Financeiro (Semáforo Azul)
      'STATUS_OS': 'Aguardando Confirmação',
      'SITUAÇÃO': 'Aguardando Confirmação',
      'PAGAMENTO_CONFERIDO': 'Não',
      'DUPLICATAS_GERADAS': osData.isSecondaryOS ? true : false,
      'isSecondaryOS': Boolean(osData.isSecondaryOS),
      'isMultiOS': Boolean(osData.isMultiOS),
      'saleId': osData.saleId || osData.parentSaleId || '',
      'parentSaleId': osData.parentSaleId || osData.saleId || '',
      'FINANCEIRO_UNIFICADO': Boolean(osData.FINANCEIRO_UNIFICADO || osData.isSecondaryOS),
      'COBRANCA_UNICA': Boolean(osData.COBRANCA_UNICA || osData.isSecondaryOS),
      'ARMAÇÃO': formData.armacao,
      'LENTE': formData.lente,
      'PRODUTO': formData.lente ? `${formData.armacao || 'Armação'} + ${formData.lente}` : (formData.armacao || osData['PRODUTO'] || 'Óculos Completo'),
      'LABORATORIO': formData.laboratorio,
      'MEDICO': formData.medico,
      'DATA  DA VENDA': normDate.brDate,
      'DATA DA VENDA': normDate.brDate,
      'DATA_VENDA': normDate.brDate,
      'Data da Venda': normDate.brDate,
      'data_venda': normDate.brDate,
      'DATA': normDate.brDate,
      dataVenda: normDate.isoDate,
      data: normDate.brDate,
      dataHora: normDate.isoDateTime,
      DATA_HORA: normDate.brDateTime,
      timestamp: normDate.timestamp,
      hora: normDate.timeStr,
      HORA: normDate.timeStr,
      'DATA ENTREGA ÓCULOS': formData.dataEntrega,
      'DATA_ENTREGA': formData.dataEntrega,
      'VALOR TOTAL': formatMoney(totalVal),
      'VALOR': formatMoney(totalVal),
      'VALOR DA VENDA': formatMoney(totalVal),
      'VALOR ENTRADA': formatMoney(entradaFinal),
      'SINAL': formatMoney(entradaFinal),
      'RESTANTE': formatMoney(restanteFinal),
      'FORMA_ENTRADA': finalFormaEntrada,
      'formaPagamentoEntrada': finalFormaEntrada,
      'FORMA_RESTANTE': finalFormaRestante,
      'formaPagamentoRestante': finalFormaRestante,
      'FORMAS_PAGAMENTO': effectivePayments.map(p => p.texto).join(' + '),
      'FORMA_PAGTO': effectivePayments.map(p => p.texto).join(' + '),
      'PARCELAS_JSON': JSON.stringify(allBoletoParcelas),
      'parcelas': allBoletoParcelas,
      'payments': effectivePayments,
      'OD_ESF': formData.odEsf,
      'OD_CIL': formData.odCil,
      'OD_EIXO': formData.odEixo,
      'OD_DNP': formData.odDnp,
      'OD_ALT': formData.odAlt,
      'OE_ESF': formData.oeEsf,
      'OE_CIL': formData.oeCil,
      'OE_EIXO': formData.oeEixo,
      'OE_DNP': formData.oeDnp,
      'OE_ALT': formData.oeAlt,
      'OD_PERTO_ESF': formData.odPertoEsf,
      'OD_PERTO_CIL': formData.odPertoCil,
      'OD_PERTO_EIXO': formData.odPertoEixo,
      'OD_PERTO_DNP': formData.odPertoDnp,
      'OD_PERTO_ALT': formData.odPertoAlt,
      'OE_PERTO_ESF': formData.oePertoEsf,
      'OE_PERTO_CIL': formData.oePertoCil,
      'OE_PERTO_EIXO': formData.oePertoEixo,
      'OE_PERTO_DNP': formData.oePertoDnp,
      'OE_PERTO_ALT': formData.oePertoAlt,
      'ADICAO': formData.adicao,
      'OBSERVACOES': formData.observacoes,
      'DATA_EDICAO': new Date().toISOString(),
      'EDITADO_POR': currentUser?.username || 'Usuário'
    };

    if (onSave) {
      onSave(updatedRow);
    }
  };

  const clientName = clientData?.['Nome Completo'] || clientData?.['NOME'] || osData?.['NOME CLIENTE'] || osData?.['CLIENTE'] || 'Cliente';
  const clientCPF = clientData?.['CPF / CNPJ'] || clientData?.['CPF'] || osData?.['CPF'] || '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99990] flex items-center justify-center p-2.5 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg lg:max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          {/* Cabeçalho do Modal */}
          <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/25 shrink-0">
                <ClipboardList size={22} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2.5 py-0.5 rounded-full">
                    Edição de OS
                  </span>
                  <span className="text-xs font-mono font-black text-pink-300">
                    {formData.numeroOS ? `#${formData.numeroOS}` : 'Sem número'}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    Semáforo Azul
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
                  <span>{clientName}</span>
                  {clientCPF && (
                    <span className="text-xs font-normal text-slate-400">({clientCPF})</span>
                  )}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0"
              title="Fechar (ESC)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Abas de Navegação Interna */}
          <div className="px-3 sm:px-6 pt-2 sm:pt-3 pb-0 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto erp-scroll whitespace-nowrap">
            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 shrink-0 ${
                activeTab === 'geral'
                  ? 'text-pink-400 border-pink-500 bg-slate-900'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Glasses size={15} />
              <span>Produto, Laboratório & Prazos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('receita')}
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 shrink-0 ${
                activeTab === 'receita'
                  ? 'text-sky-400 border-sky-500 bg-slate-900'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Eye size={15} />
              <span>Prescrição Óptica (OD / OE)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('financeiro')}
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 shrink-0 ${
                activeTab === 'financeiro'
                  ? 'text-emerald-400 border-emerald-500 bg-slate-900'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <DollarSign size={15} />
              <span>Financeiro & Formas de Pagamento (PDV)</span>
            </button>
          </div>

          {/* Conteúdo do Formulário */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 custom-scrollbar">
            
            {/* ─── ABA 1: GERAL (PRODUTOS & PRAZOS) ─── */}
            {activeTab === 'geral' && (
              <div className="space-y-6">
                
                {/* Banner de Semáforo Azul e Número da OS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Número da OS</span>
                      {formData.numeroOS && (
                        <span className="text-[9px] font-mono text-pink-400 font-bold">
                          #{formData.numeroOS}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.numeroOS}
                      onChange={e => handleChange('numeroOS', e.target.value.toUpperCase().trim())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-pink-300 font-mono font-bold uppercase focus:outline-none focus:border-pink-500 shadow-inner"
                      placeholder="Ex: CAJ-001"
                    />
                  </div>

                  <div className="sm:col-span-2 flex flex-col justify-center">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                      Status da OS (Reconfirmação Automática)
                    </label>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                      <span>Ao salvar qualquer alteração, a OS voltará para <strong>🔵 Aguardando Confirmação</strong> (Semáforo Azul) para conferência obrigatória do Financeiro.</span>
                    </div>
                  </div>
                </div>

                {/* Linha 2: Datas & Entrega */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Calendar size={13} className="text-sky-400" /> Data da Venda
                    </label>
                    <input
                      type="text"
                      value={formData.dataVenda}
                      onChange={e => handleChange('dataVenda', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      placeholder="DD/MM/AAAA ou AAAA-MM-DD"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Calendar size={13} className="text-amber-400" /> Previsão de Entrega dos Óculos
                    </label>
                    <input
                      type="text"
                      value={formData.dataEntrega}
                      onChange={e => handleChange('dataEntrega', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      placeholder="DD/MM/AAAA ou AAAA-MM-DD"
                    />
                  </div>
                </div>

                {/* Linha 3: Armação & Lente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Glasses size={13} className="text-amber-400" /> Armação / Modelo
                    </label>
                    <input
                      type="text"
                      value={formData.armacao}
                      onChange={e => handleChange('armacao', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      placeholder="Marca e Modelo da Armação"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Eye size={13} className="text-sky-400" /> Lente Oftálmica
                    </label>
                    <input
                      type="text"
                      value={formData.lente}
                      onChange={e => handleChange('lente', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      placeholder="Marca, Tipo e Tratamentos da Lente"
                    />
                  </div>
                </div>

                {/* Linha 4: Laboratório & Médico */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Building2 size={13} className="text-purple-400" /> Laboratório Óptico
                    </label>
                    <input
                      type="text"
                      value={formData.laboratorio}
                      onChange={e => handleChange('laboratorio', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      placeholder="Ex: Haytek, Braslab, Essilor, Central"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Stethoscope size={13} className="text-teal-400" /> Médico Oftalmo / Optometrista
                    </label>
                    <input
                      type="text"
                      value={formData.medico}
                      onChange={e => handleChange('medico', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      placeholder="Nome do Doutor ou Clínica"
                    />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Observações Gerais da OS
                  </label>
                  <textarea
                    rows={2}
                    value={formData.observacoes}
                    onChange={e => handleChange('observacoes', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 resize-none"
                    placeholder="Anotações técnicas, especificações de montagem ou observações do cliente..."
                  />
                </div>

              </div>
            )}

            {/* ─── ABA 2: PRESCRIÇÃO ÓPTICA (OD / OE / ADIÇÃO) ─── */}
            {activeTab === 'receita' && (
              <div className="space-y-6">
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-sky-300">
                  <Eye size={16} className="shrink-0 text-sky-400" />
                  <span>Dioptrias vinculadas a esta Ordem de Serviço. Os dados impressos no A4 e na OS do Laboratório usarão estes parâmetros.</span>
                </div>

                {/* Tabela Olho Direito (OD) - Longe */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-sky-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    1. Visão de Longe — Olho Direito (OD)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Esférico</label>
                      <input
                        type="text"
                        value={formData.odEsf}
                        onChange={e => handleChange('odEsf', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Cilíndrico</label>
                      <input
                        type="text"
                        value={formData.odCil}
                        onChange={e => handleChange('odCil', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Eixo (°)</label>
                      <input
                        type="text"
                        value={formData.odEixo}
                        onChange={e => handleChange('odEixo', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500"
                        placeholder="180"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">DNP (mm)</label>
                      <input
                        type="text"
                        value={formData.odDnp}
                        onChange={e => handleChange('odDnp', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500"
                        placeholder="31"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Altura (mm)</label>
                      <input
                        type="text"
                        value={formData.odAlt}
                        onChange={e => handleChange('odAlt', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-sky-500"
                        placeholder="18"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabela Olho Esquerdo (OE) - Longe */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    1. Visão de Longe — Olho Esquerdo (OE)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Esférico</label>
                      <input
                        type="text"
                        value={formData.oeEsf}
                        onChange={e => handleChange('oeEsf', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Cilíndrico</label>
                      <input
                        type="text"
                        value={formData.oeCil}
                        onChange={e => handleChange('oeCil', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Eixo (°)</label>
                      <input
                        type="text"
                        value={formData.oeEixo}
                        onChange={e => handleChange('oeEixo', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                        placeholder="180"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">DNP (mm)</label>
                      <input
                        type="text"
                        value={formData.oeDnp}
                        onChange={e => handleChange('oeDnp', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                        placeholder="31"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Altura (mm)</label>
                      <input
                        type="text"
                        value={formData.oeAlt}
                        onChange={e => handleChange('oeAlt', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                        placeholder="18"
                      />
                    </div>
                  </div>
                </div>

                {/* ─── VISÃO DE PERTO & ADIÇÃO ─── */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/25 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      2. Visão de Perto (OD / OE) &amp; Adição
                    </h4>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Adição (Perto)
                      </label>
                      <input
                        type="text"
                        value={formData.adicao}
                        onChange={e => handleChange('adicao', e.target.value)}
                        className="w-24 bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono text-center focus:outline-none focus:border-amber-400 font-bold"
                        placeholder="+2.00"
                      />
                    </div>
                  </div>

                  {/* OD Perto */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-amber-400 uppercase">Olho Direito (OD - Perto)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Esférico</label>
                        <input
                          type="text"
                          value={formData.odPertoEsf}
                          onChange={e => handleChange('odPertoEsf', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Cilíndrico</label>
                        <input
                          type="text"
                          value={formData.odPertoCil}
                          onChange={e => handleChange('odPertoCil', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Eixo (°)</label>
                        <input
                          type="text"
                          value={formData.odPertoEixo}
                          onChange={e => handleChange('odPertoEixo', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400"
                          placeholder="180"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">DNP (mm)</label>
                        <input
                          type="text"
                          value={formData.odPertoDnp}
                          onChange={e => handleChange('odPertoDnp', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400"
                          placeholder="31"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Altura (mm)</label>
                        <input
                          type="text"
                          value={formData.odPertoAlt}
                          onChange={e => handleChange('odPertoAlt', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400"
                          placeholder="18"
                        />
                      </div>
                    </div>
                  </div>

                  {/* OE Perto */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <h5 className="text-[11px] font-bold text-orange-400 uppercase">Olho Esquerdo (OE - Perto)</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Esférico</label>
                        <input
                          type="text"
                          value={formData.oePertoEsf}
                          onChange={e => handleChange('oePertoEsf', e.target.value)}
                          className="w-full bg-slate-900 border border-orange-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-orange-400"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Cilíndrico</label>
                        <input
                          type="text"
                          value={formData.oePertoCil}
                          onChange={e => handleChange('oePertoCil', e.target.value)}
                          className="w-full bg-slate-900 border border-orange-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-orange-400"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Eixo (°)</label>
                        <input
                          type="text"
                          value={formData.oePertoEixo}
                          onChange={e => handleChange('oePertoEixo', e.target.value)}
                          className="w-full bg-slate-900 border border-orange-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-orange-400"
                          placeholder="180"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">DNP (mm)</label>
                        <input
                          type="text"
                          value={formData.oePertoDnp}
                          onChange={e => handleChange('oePertoDnp', e.target.value)}
                          className="w-full bg-slate-900 border border-orange-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-orange-400"
                          placeholder="31"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Altura (mm)</label>
                        <input
                          type="text"
                          value={formData.oePertoAlt}
                          onChange={e => handleChange('oePertoAlt', e.target.value)}
                          className="w-full bg-slate-900 border border-orange-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-orange-400"
                          placeholder="18"
                        />
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ─── ABA 3: FINANCEIRO & FORMAS DE PAGAMENTO DO PDV ─── */}
            {activeTab === 'financeiro' && (
              <div className="space-y-6">
                {(osData?.isSecondaryOS || (osData?.FINANCEIRO_UNIFICADO && (cleanVal(osData?.['VALOR TOTAL']) === 0 || osData?.['VALOR TOTAL'] === '0,00'))) && (
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-start gap-3">
                    <span className="text-base">🔗</span>
                    <div>
                      <p className="font-black text-white text-sm">Ordem de Serviço com Cobrança Unificada</p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Esta OS pertence a um atendimento com múltiplos óculos. O faturamento, contas a receber e parcelas de boleto foram gerados exclusivamente na OS Principal para não duplicar dívidas no cliente.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bloco 1: Valor Total e Resumo de Entrada / Restante */}
                {(() => {
                  const entradaMethodLabel = [...new Set(payments.filter(p => p.metodo !== 'carne' && p.metodo !== 'boleto' && p.stage !== 'restante').map(p => formatEditMethodLabel(p.metodo, p.installments || (p.parcelas?.length || 1))).filter(Boolean))].join(' + ') || formData.formaPagamentoEntrada || '';
                  const restanteMethodLabel = [...new Set(payments.filter(p => p.metodo === 'carne' || p.metodo === 'boleto' || p.stage === 'restante').map(p => formatEditMethodLabel(p.metodo, p.installments || (p.parcelas?.length || 1))).filter(Boolean))].join(' + ') || formData.formaPagamentoRestante || '';

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                          <DollarSign size={13} className="text-emerald-400" /> Valor Total da OS (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.valorTotal}
                          onChange={e => handleChange('valorTotal', e.target.value)}
                          onBlur={e => {
                            const v = cleanVal(e.target.value);
                            if (v > 0) handleChange('valorTotal', formatMoney(v));
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-emerald-400 font-black focus:outline-none focus:border-emerald-500"
                          placeholder="0,00"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <DollarSign size={13} className="text-teal-400" /> Entrada / Imediato
                          </label>
                          {totalPagoImediato > 0 && entradaMethodLabel && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                              {entradaMethodLabel}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-teal-300 font-bold">
                          {fmtMoeda(totalPagoImediato)}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5 block">
                          {entradaMethodLabel ? `Forma da Entrada: ${entradaMethodLabel}` : 'Dinheiro, PIX, Débito e Crédito'}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <DollarSign size={13} className="text-amber-400" /> Restante / A Prazo / Boleto
                          </label>
                          {totalBoletoCarne > 0 && restanteMethodLabel && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {restanteMethodLabel}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-amber-300 font-bold">
                          {fmtMoeda(totalBoletoCarne)}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5 block">
                          {restanteMethodLabel ? `Forma do Restante: ${restanteMethodLabel}` : 'Gera duplicatas no Financeiro'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Banner de Validação da Soma das Formas de Pagamento */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
                  isFullyCovered
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : covered > totalFinal + 0.01
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {isFullyCovered ? (
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle size={18} className={covered > totalFinal + 0.01 ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />
                    )}
                    <div>
                      <p className="font-black text-sm">
                        {isFullyCovered 
                          ? '✅ Valor Total da OS 100% Coberto!' 
                          : covered > totalFinal + 0.01
                          ? `⚠️ Valor Lançado Excede o Total da OS!`
                          : `⚠️ Falta Cobrir: ${fmtMoeda(remaining)}`}
                      </p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Lançado: <strong>{fmtMoeda(covered)}</strong> de <strong>{fmtMoeda(totalFinal)}</strong>
                        {covered > totalFinal + 0.01 && ` (Excesso de ${fmtMoeda(covered - totalFinal)})`}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-black px-3 py-1 rounded-xl bg-black/30 border border-white/10">
                    {isFullyCovered ? 'R$ 0,00' : fmtMoeda(remaining)}
                  </span>
                </div>

                {/* Seletor de Método de Pagamento (Idêntico ao PDV) */}
                <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                        Adicionar Forma de Pagamento
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Construtor Dinâmico PDV (Entrada e Restante)
                      </span>
                    </div>

                    {currentMethod !== 'carne' && (
                      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setCurrentStage('entrada')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                            currentStage === 'entrada'
                              ? 'bg-teal-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🟢 Entrada (Sinal)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentStage('restante')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                            currentStage === 'restante'
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🟡 Restante (Falta)
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { id: 'dinheiro', label: '💵 Dinheiro' },
                      { id: 'pix', label: '⚡ PIX' },
                      { id: 'debito', label: '💳 Débito' },
                      { id: 'credito', label: '💳 Crédito' },
                      { id: 'carne', label: '📄 Boleto' },
                      { id: 'combinar', label: '🤝 A Combinar' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCurrentMethod(p.id);
                          if (p.id === 'combinar') setCurrentStage('restante');
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                          currentMethod === p.id
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Campos do Método Selecionado */}
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400 font-bold">Valor deste Lançamento:</span>
                      <div className="relative flex-1 max-w-[160px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={paymentInputVal}
                          onChange={e => setPaymentInputVal(e.target.value)}
                          onBlur={e => {
                            const v = cleanVal(e.target.value);
                            if (v > 0) setPaymentInputVal(formatMoney(v));
                          }}
                          placeholder={formatMoney(remaining > 0 ? remaining : totalFinal)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-1.5 pl-8 pr-2.5 text-right text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Dinheiro: Troco */}
                    {currentMethod === 'dinheiro' && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-400 font-bold">Valor Entregue pelo Cliente:</span>
                          <div className="relative flex-1 max-w-[160px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={cashTendered}
                              onChange={e => setCashTendered(e.target.value)}
                              onBlur={e => {
                                const v = cleanVal(e.target.value);
                                if (v > 0) setCashTendered(formatMoney(v));
                              }}
                              placeholder={formatMoney(cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal))}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-1.5 pl-8 pr-2.5 text-right text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
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

                    {/* Crédito ou Boleto */}
                    {['carne', 'credito'].includes(currentMethod) && (
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-bold">Parcelas:</span>
                          <select
                            value={payInstallments}
                            onChange={e => {
                              setPayInstallments(Number(e.target.value));
                              setCustomDueDates({});
                            }}
                            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
                              const calcVal = (cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) / n;
                              return (
                                <option key={n} value={n}>{n}x de {fmtMoeda(calcVal)}</option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Vencimentos exclusivamente para Boleto */}
                        {currentMethod === 'carne' && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-bold">1º Vencimento:</span>
                              <input
                                type="date"
                                value={payFirstDueDate}
                                onChange={e => {
                                  setPayFirstDueDate(e.target.value);
                                  setCustomDueDates({});
                                }}
                                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-bold"
                              />
                            </div>

                            {payInstallments > 1 && (
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                                  <span className="flex items-center gap-1.5 uppercase tracking-wider font-black">
                                    <Calendar size={13} /> Todas as Datas ({payInstallments}x)
                                  </span>
                                  <span className="text-slate-400 font-mono">
                                    {fmtMoeda((cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) / payInstallments)} / parc
                                  </span>
                                </div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                  {Array.from({ length: payInstallments }, (_, i) => {
                                    const num = i + 1;
                                    const calculatedDate = getInstallmentDate(payFirstDueDate, i);
                                    const currentDateVal = customDueDates[num] || calculatedDate;
                                    const valPerParc = (cleanVal(paymentInputVal) || (remaining > 0 ? remaining : totalFinal)) / payInstallments;
                                    return (
                                      <div key={num} className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-black text-slate-300">
                                          {num}ª Parcela ({fmtMoeda(valPerParc)}):
                                        </span>
                                        <input
                                          type="date"
                                          value={currentDateVal}
                                          onChange={e => setCustomDueDates(prev => ({ ...prev, [num]: e.target.value }))}
                                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botão de Adicionar / Dividir Pagamento */}
                    <button
                      type="button"
                      onClick={handleAddPayment}
                      disabled={payments.length > 0 && isFullyCovered}
                      className={`w-full py-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                        payments.length > 0 && isFullyCovered
                          ? 'bg-slate-950/60 text-slate-500 border-slate-800 cursor-not-allowed'
                          : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {payments.length > 0 && isFullyCovered ? (
                        <span>✅ Total da OS já Coberto ({fmtMoeda(totalFinal)})</span>
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>
                            + Dividir / Adicionar Pagamento {currentMethod === 'carne' ? '(Restante no Boleto)' : (currentStage === 'restante' ? '(Restante)' : '(Entrada)')} {
                              (cleanVal(paymentInputVal) || (currentMethod === 'dinheiro' ? cleanVal(cashTendered) : 0)) > 0
                                ? `de ${fmtMoeda(cleanVal(paymentInputVal) || cleanVal(cashTendered))}`
                                : (remaining > 0 ? `de ${fmtMoeda(remaining)}` : '')
                            }
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Lista de Pagamentos Lançados */}
                {payments.length > 0 && (
                  <div className="space-y-2 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Pagamentos Lançados nesta OS ({payments.length}):
                      </span>
                      <button
                        type="button"
                        onClick={handleClearPayments}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:underline transition-colors"
                      >
                        Limpar Todos
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {payments.map(p => {
                        const isRestantePay = p.metodo === 'carne' || p.metodo === 'boleto' || p.stage === 'restante';
                        const isBoletoFixed = p.metodo === 'carne' || p.metodo === 'boleto';
                        return (
                          <div key={p.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0 pr-2 flex-wrap">
                              <button
                                type="button"
                                disabled={isBoletoFixed}
                                onClick={() => togglePaymentStage(p.id)}
                                title={isBoletoFixed ? 'Boleto é sempre contabilizado no Restante / A Prazo' : 'Clique para alternar entre Entrada e Restante'}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border transition-all ${
                                  isRestantePay
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25'
                                    : 'bg-teal-500/15 text-teal-300 border-teal-500/35 hover:bg-teal-500/25'
                                } ${isBoletoFixed ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                {isRestantePay ? 'Restante' : 'Entrada'}
                              </button>
                              <p className="font-bold text-white leading-relaxed">{p.texto}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-emerald-400 font-mono text-sm">{fmtMoeda(p.valor)}</span>
                              <button
                                type="button"
                                onClick={() => removePayment(p.id)}
                                className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
                                title="Remover este pagamento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Alerta Informativo de Reconfirmação do Financeiro */}
                <div className="p-4 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-sky-200 text-xs flex items-start gap-3">
                  <ShieldCheck size={20} className="text-sky-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-wide text-sky-300">
                      Reconfirmação Financeira Obrigatória (Semáforo Azul)
                    </p>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      Ao salvar as alterações, a OS voltará para <strong>"Aguardando Confirmação"</strong>. O financeiro revalidará os lançamentos e gerará as duplicatas limpas e atualizadas no sistema, evitando qualquer cobrança duplicada no boleto do cliente.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* Rodapé de Ações */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono font-bold text-slate-400">
                <span>Total: <strong className="text-emerald-400">{fmtMoeda(totalFinal)}</strong></span>
                <span>•</span>
                <span>Lançado: <strong className={isFullyCovered ? "text-emerald-400" : "text-amber-400"}>{fmtMoeda(covered)}</strong></span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all text-center"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save size={16} />
                  <span>Salvar Alterações da OS</span>
                </button>
              </div>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditOSModal;
