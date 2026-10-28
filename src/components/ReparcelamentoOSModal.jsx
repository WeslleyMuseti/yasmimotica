import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RefreshCw, Calendar, DollarSign, FileText, CheckCircle2,
  AlertTriangle, Search, User, CreditCard, Calculator, Plus,
  Trash2, ArrowRight, Sparkles, ShieldCheck, Layers, Clock, Check,
  Printer
} from 'lucide-react';
import { isSameClient } from '../firebaseSync';
import PrintableReparcelamentoAgreement from './PrintableReparcelamentoAgreement';

import {
  parseCurrencyValue,
  formatMoneyBr,
  formatCurrencyBr,
  normalizeInstallmentDateIso,
  formatInstallmentDateBr,
  extractOSFromRow,
  resolveInstallmentClientName,
  filterInstallmentsByDateRange,
  buildOverdueInstallmentAlerts,
  generateInstallmentSchedule,
  buildReparcelamentoOSPayload
} from "../reparcelamentoUtils";

export {
  parseCurrencyValue,
  formatMoneyBr,
  formatCurrencyBr,
  normalizeInstallmentDateIso,
  formatInstallmentDateBr,
  extractOSFromRow,
  resolveInstallmentClientName,
  filterInstallmentsByDateRange,
  buildOverdueInstallmentAlerts,
  generateInstallmentSchedule,
  buildReparcelamentoOSPayload,
  PrintableReparcelamentoAgreement
};

const rowUidMap = new WeakMap();
let nextFallbackUid = 1;
const getRowUid = (r) => {
  if (!r || typeof r !== 'object') return '';
  if (r.id) return String(r.id);
  if (r._id) return String(r._id);
  if (!rowUidMap.has(r)) {
    const doc = r.DOCUMENTO || r.DESCRICAO || '';
    const venc = r.DATA_VENCIMENTO || r['DATA VENCIMENTO'] || r.VENCIMENTO || '';
    const val = r.VALOR || r.valor || r['VALOR PARCELA'] || '';
    rowUidMap.set(r, `row_uid_${nextFallbackUid++}_${doc}_${venc}_${val}`);
  }
  return rowUidMap.get(r);
};

const ReparcelamentoOSModal = ({
  isOpen,
  onClose,
  initialRow = null,
  initialClientName = '',
  initialClientId = '',
  initialClientCpf = '',
  initialOSNumber = '',
  receberData = [],
  salesData = [],
  clientsData = [],
  currentUser = null,
  onConfirmReparcelamento,
  onTriggerPrintAgreement
}) => {
  const defaultUnit = currentUser?.city || currentUser?.assignedStore || 'Central';

  // Agrupamento de todas as OS e Clientes com parcelas pendentes em CONTAS_RECEBER
  const osGroupsWithPending = useMemo(() => {
    const groupsMap = new Map();

    (receberData || []).forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const st = String(row.STATUS || row.status || 'Pendente').trim().toLowerCase();
      if (['recebido', 'pago', 'liquidado', 'cancelado', 'cancelada', 'reparcelado', 'substituido'].includes(st)) return;

      const clientName = resolveInstallmentClientName(row, clientsData, salesData);
      const osNum = extractOSFromRow(row) || 'SEM-OS';
      const key = `${osNum.toUpperCase()}__${clientName.toUpperCase()}`;

      if (!groupsMap.has(key)) {
        const matchedClient = (clientsData || []).find(c => isSameClient(c, row));
        groupsMap.set(key, {
          key,
          osNumber: osNum,
          clientName,
          clientId: row.CLIENTE_ID || row.cliente_id || matchedClient?.id || '',
          clientCpf: row.CLIENTE_CPF || row.CPF || row.cpf || matchedClient?.['CPF / CNPJ'] || matchedClient?.CPF || '',
          unit: row.CIDADE || row.LOJA || row.UNIDADE || matchedClient?.Cidade || defaultUnit,
          pendingRows: [],
          totalPendente: 0
        });
      }

      const grp = groupsMap.get(key);
      const val = parseCurrencyValue(row.VALOR || row.valor || row['VALOR PARCELA']);
      grp.pendingRows.push(row);
      grp.totalPendente += val;
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.totalPendente - a.totalPendente);
  }, [receberData, clientsData, salesData, defaultUnit]);

  const [searchOSOrClient, setSearchOSOrClient] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [includeAllClientPending, setIncludeAllClientPending] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Parâmetros do acordo / reparcelamento
  const [osInput, setOsInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientCpfInput, setClientCpfInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [unitInput, setUnitInput] = useState(defaultUnit);
  const [dataAcordo, setDataAcordo] = useState(() => new Date().toISOString().split('T')[0]);

  const [entradaInput, setEntradaInput] = useState('0,00');
  const [entradaFormaPagto, setEntradaFormaPagto] = useState('PIX');
  const [descontoInput, setDescontoInput] = useState('0,00');
  const [acrescimoInput, setAcrescimoInput] = useState('0,00');

  const [qtdParcelas, setQtdParcelas] = useState(3);
  const [meioPagamento, setMeioPagamento] = useState('Boleto');
  const [intervaloParcelas, setIntervaloParcelas] = useState('MESMO_DIA_MES');
  const [primeiroVencimento, setPrimeiroVencimento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [observacoes, setObservacoes] = useState('');
  const [customSchedule, setCustomSchedule] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializa a seleção quando o modal abre
  useEffect(() => {
    if (!isOpen) return;

    const d = new Date();
    d.setDate(d.getDate() + 30);
    const defaultFirstDue = d.toISOString().split('T')[0];
    setPrimeiroVencimento(defaultFirstDue);
    setDataAcordo(new Date().toISOString().split('T')[0]);
    setEntradaInput('0,00');
    setDescontoInput('0,00');
    setAcrescimoInput('0,00');
    setObservacoes('');
    setIncludeAllClientPending(false);

    if (initialRow || initialOSNumber || initialClientName) {
      const targetOs = (initialOSNumber || extractOSFromRow(initialRow) || '').toUpperCase();
      const targetClient = (initialClientName || (initialRow ? resolveInstallmentClientName(initialRow, clientsData, salesData) : '')).toUpperCase();

      let matchedGrp = null;
      if (targetOs && targetClient) {
        matchedGrp = osGroupsWithPending.find(
          g => g.osNumber.toUpperCase() === targetOs && g.clientName.toUpperCase() === targetClient
        );
      }
      if (!matchedGrp && targetOs && targetOs !== 'SEM-OS') {
        matchedGrp = osGroupsWithPending.find(g => g.osNumber.toUpperCase() === targetOs);
      }
      if (!matchedGrp && targetClient) {
        matchedGrp = osGroupsWithPending.find(g => g.clientName.toUpperCase() === targetClient);
      }

      if (matchedGrp) {
        applyGroupSelection(matchedGrp, false);
        return;
      }

      // Caso não tenha grupo prévio mas initialRow foi passado
      if (initialRow) {
        const cName = resolveInstallmentClientName(initialRow, clientsData, salesData);
        const osNum = extractOSFromRow(initialRow) || '';
        setOsInput(osNum);
        setClientNameInput(cName);
        setClientCpfInput(initialRow.CLIENTE_CPF || initialRow.CPF || initialClientCpf || '');
        setClientIdInput(initialRow.CLIENTE_ID || initialClientId || '');
        setUnitInput(initialRow.CIDADE || initialRow.LOJA || initialRow.UNIDADE || defaultUnit);
        setSelectedRowIds(new Set([getRowUid(initialRow)]));
        return;
      }
    }

    if (osGroupsWithPending.length > 0) {
      applyGroupSelection(osGroupsWithPending[0], false);
    } else {
      setSelectedGroupKey('');
      setOsInput('');
      setClientNameInput('');
      setClientCpfInput('');
      setClientIdInput('');
      setSelectedRowIds(new Set());
    }
  }, [isOpen, initialRow, initialOSNumber, initialClientName]);

  const applyGroupSelection = (grp, allClientMode = false) => {
    if (!grp) return;
    setSelectedGroupKey(grp.key);
    setOsInput(grp.osNumber === 'SEM-OS' ? '' : grp.osNumber);
    setClientNameInput(grp.clientName);
    setClientCpfInput(grp.clientCpf || '');
    setClientIdInput(grp.clientId || '');
    setUnitInput(grp.unit || defaultUnit);

    const candidateRows = allClientMode
      ? (receberData || []).filter(r => {
          const st = String(r.STATUS || r.status || 'Pendente').trim().toLowerCase();
          if (['recebido', 'pago', 'liquidado', 'cancelado', 'cancelada', 'reparcelado', 'substituido'].includes(st)) return false;
          const rClient = resolveInstallmentClientName(r, clientsData, salesData);
          return rClient.toUpperCase() === grp.clientName.toUpperCase();
        })
      : grp.pendingRows;

    const nextSet = new Set();
    candidateRows.forEach(r => nextSet.add(getRowUid(r)));
    setSelectedRowIds(nextSet);
  };

  // Parcelas candidatas da OS / Cliente selecionado
  const candidateInstallments = useMemo(() => {
    if (!clientNameInput && !osInput) return [];
    return (receberData || []).filter(r => {
      if (!r || typeof r !== 'object') return false;
      const rClient = resolveInstallmentClientName(r, clientsData, salesData);
      const rOs = extractOSFromRow(r) || 'SEM-OS';

      if (includeAllClientPending && clientNameInput) {
        return rClient.toUpperCase() === clientNameInput.toUpperCase();
      }
      if (selectedGroupKey) {
        const grp = osGroupsWithPending.find(g => g.key === selectedGroupKey);
        if (grp) {
          return rClient.toUpperCase() === grp.clientName.toUpperCase() &&
                 rOs.toUpperCase() === grp.osNumber.toUpperCase();
        }
      }
      if (osInput) {
        return rOs.toUpperCase() === osInput.trim().toUpperCase();
      }
      return rClient.toUpperCase() === clientNameInput.trim().toUpperCase();
    }).sort((a, b) => {
      const da = normalizeInstallmentDateIso(a.DATA_VENCIMENTO || a['DATA VENCIMENTO'] || a.VENCIMENTO);
      const db = normalizeInstallmentDateIso(b.DATA_VENCIMENTO || b['DATA VENCIMENTO'] || b.VENCIMENTO);
      return da.localeCompare(db);
    });
  }, [receberData, clientNameInput, osInput, includeAllClientPending, selectedGroupKey, osGroupsWithPending, clientsData, salesData]);

  const pendingCandidateRows = useMemo(() => {
    return candidateInstallments.filter(r => {
      const st = String(r.STATUS || r.status || 'Pendente').trim().toLowerCase();
      return !['recebido', 'pago', 'liquidado', 'cancelado', 'cancelada', 'reparcelado', 'substituido'].includes(st);
    });
  }, [candidateInstallments]);

  const paidCandidateRows = useMemo(() => {
    return candidateInstallments.filter(r => {
      const st = String(r.STATUS || r.status || 'Pendente').trim().toLowerCase();
      return ['recebido', 'pago', 'liquidado'].includes(st);
    });
  }, [candidateInstallments]);

  const selectedPendingRows = useMemo(() => {
    return pendingCandidateRows.filter(r => selectedRowIds.has(getRowUid(r)));
  }, [pendingCandidateRows, selectedRowIds]);

  const saldoOriginalSelecionado = useMemo(() => {
    return selectedPendingRows.reduce(
      (acc, r) => acc + parseCurrencyValue(r.VALOR || r.valor || r['VALOR PARCELA'] || 0),
      0
    );
  }, [selectedPendingRows]);

  const entradaNum = parseCurrencyValue(entradaInput);
  const descontoNum = parseCurrencyValue(descontoInput);
  const acrescimoNum = parseCurrencyValue(acrescimoInput);

  const novoSaldoAReparcelar = useMemo(() => {
    return Math.max(0, Math.round((saldoOriginalSelecionado - descontoNum + acrescimoNum - entradaNum) * 100) / 100);
  }, [saldoOriginalSelecionado, descontoNum, acrescimoNum, entradaNum]);

  // Atualiza automaticamente o cronograma quando parâmetros mudam
  useEffect(() => {
    if (novoSaldoAReparcelar <= 0) {
      setCustomSchedule([]);
      return;
    }
    const generated = generateInstallmentSchedule({
      totalAmount: novoSaldoAReparcelar,
      count: qtdParcelas,
      firstDueDateIso: primeiroVencimento,
      intervalType: intervaloParcelas
    });
    setCustomSchedule(generated);
  }, [novoSaldoAReparcelar, qtdParcelas, primeiroVencimento, intervaloParcelas]);

  const filteredOSGroups = useMemo(() => {
    if (!searchOSOrClient.trim()) return osGroupsWithPending;
    const q = searchOSOrClient.toLowerCase().trim();
    return osGroupsWithPending.filter(g =>
      g.osNumber.toLowerCase().includes(q) ||
      g.clientName.toLowerCase().includes(q) ||
      String(g.clientCpf || '').toLowerCase().includes(q)
    );
  }, [osGroupsWithPending, searchOSOrClient]);

  const totalScheduleCustom = useMemo(() => {
    return Math.round(customSchedule.reduce((acc, s) => acc + parseCurrencyValue(s.valor), 0) * 100) / 100;
  }, [customSchedule]);

  const scheduleDiff = Math.round((novoSaldoAReparcelar - totalScheduleCustom) * 100) / 100;

  const handleScheduleDateChange = (index, newDateIso) => {
    setCustomSchedule(prev => prev.map((item, idx) => idx === index ? { ...item, vencimento: newDateIso } : item));
  };

  const handleScheduleValueChange = (index, newValStr) => {
    setCustomSchedule(prev => prev.map((item, idx) => idx === index ? { ...item, valor: newValStr } : item));
  };

  const handleRecalculateSchedule = () => {
    if (novoSaldoAReparcelar <= 0) {
      setCustomSchedule([]);
      return;
    }
    const generated = generateInstallmentSchedule({
      totalAmount: novoSaldoAReparcelar,
      count: qtdParcelas,
      firstDueDateIso: primeiroVencimento,
      intervalType: intervaloParcelas
    });
    setCustomSchedule(generated);
  };

  // Resolução dos dados cadastrais completos do cliente para o Termo de Acordo
  const currentClientDetails = useMemo(() => {
    const found = (clientsData || []).find(c =>
      isSameClient(c, {
        id: clientIdInput,
        CLIENTE_ID: clientIdInput,
        'CPF / CNPJ': clientCpfInput,
        CPF: clientCpfInput,
        'Nome Completo': clientNameInput,
        NOME: clientNameInput,
        CLIENTE: clientNameInput
      })
    );
    if (!found) {
      return {
        name: clientNameInput || 'Cliente',
        cpf: clientCpfInput || '',
        rg: '',
        phone: '',
        address: '',
        responsible: null
      };
    }

    const rua = found['Rua'] || found['ENDERECO'] || found['Endereço'] || found['LOGRADOURO'] || '';
    const num = found['Número'] || found['NUMERO'] || found['Numero'] || '';
    const bairro = found['Bairro'] || found['BAIRRO'] || '';
    const cidade = found['Cidade'] || found['CIDADE'] || unitInput || defaultUnit;
    const estado = found['Estado'] || found['ESTADO'] || found['UF'] || 'SP';
    const cep = found['CEP'] || found['Cep'] || found['cep'] || '';

    const addressParts = [
      rua && num ? `${rua}, nº ${num}` : (rua || (num ? `Nº ${num}` : '')),
      bairro ? `Bairro ${bairro}` : '',
      `${cidade}/${estado}`,
      cep ? `CEP ${cep}` : ''
    ].filter(Boolean);

    const respName = found['Responsável Nome'] || found['Responsável'] || found['RESPONSAVEL'];
    const respCpf = found['Responsável CPF'] || found['RESPONSAVEL_CPF'] || '';
    const respPhone = found['Responsável WhatsApp'] || found['RESPONSAVEL_WHATSAPP'] || '';

    return {
      name: found['Nome Completo'] || found['NOME'] || found['CLIENTE'] || clientNameInput || 'Cliente',
      cpf: found['CPF / CNPJ'] || found['CPF'] || clientCpfInput || '',
      rg: found['RG'] || found['rg'] || '',
      phone: found['WhatsApp'] || found['Telefone'] || found['Celular'] || found['FONE'] || '',
      address: addressParts.length > 0 ? addressParts.join(' - ') : '',
      responsible: respName ? { name: respName, cpf: respCpf, phone: respPhone } : null
    };
  }, [clientsData, clientIdInput, clientCpfInput, clientNameInput, unitInput, defaultUnit]);

  // Construtor do objeto de dados para impressão do Termo de Acordo
  const buildAgreementPayload = () => {
    const intervaloLabelMap = {
      'MESMO_DIA_MES': 'Mensal (mesmo dia a cada mês)',
      'DIAS_30': 'A cada 30 dias corridos',
      'QUINZENAL': 'A cada 15 dias (quinzenal)'
    };
    return {
      osNumero: osInput || 'AVULSO',
      clientName: currentClientDetails?.name || clientNameInput || 'Cliente',
      clientCpf: currentClientDetails?.cpf || clientCpfInput || '',
      clientRg: currentClientDetails?.rg || '',
      clientPhone: currentClientDetails?.phone || '',
      clientAddress: currentClientDetails?.address || '',
      responsible: currentClientDetails?.responsible || null,
      unit: unitInput || defaultUnit,
      dataAcordo: dataAcordo || new Date().toISOString().split('T')[0],
      observacoes,
      operador: currentUser?.username || 'Yasmin Ótica',
      originalTotal: saldoOriginalSelecionado,
      oldRows: selectedPendingRows.map(r => ({
        ...r,
        diasAtraso: r.diasAtraso !== undefined ? r.diasAtraso : (r.DIAS_ATRASO || 0)
      })),
      entradaValor: entradaNum,
      entradaMeioPagamento: entradaFormaPagto,
      descontoValor: descontoNum,
      acrescimoValor: acrescimoNum,
      novoSaldo: novoSaldoAReparcelar,
      meioPagamento: meioPagamento || 'Boleto',
      qtdParcelas: qtdParcelas || (customSchedule ? customSchedule.length : 1),
      intervaloRegra: intervaloLabelMap[intervaloParcelas] || 'Mensal',
      schedule: customSchedule,
      agreementId: `REP-${String(osInput || 'AVULSO').replace(/^#/, '')}-${Date.now().toString().slice(-6)}`
    };
  };

  const [printAgreementData, setPrintAgreementData] = useState(null);

  // Apenas imprimir o termo para assinatura (sem salvar ainda ou para prévia)
  const handlePrintAgreementOnly = () => {
    if (selectedPendingRows.length === 0) {
      alert('Selecione pelo menos uma parcela pendente da OS para gerar o termo de reparcelamento.');
      return;
    }
    const agr = buildAgreementPayload();
    setPrintAgreementData(agr);
    if (onTriggerPrintAgreement) {
      onTriggerPrintAgreement(agr);
    }
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Salvar no financeiro e já abrir a impressão do termo na sequência
  const handleConfirmAndPrint = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    if (selectedPendingRows.length === 0) {
      alert('Selecione pelo menos uma parcela pendente da OS para realizar o reparcelamento.');
      return;
    }

    if (novoSaldoAReparcelar > 0 && Math.abs(scheduleDiff) > 0.05) {
      alert(`A soma das novas parcelas (${formatCurrencyBr(totalScheduleCustom)}) difere do saldo a reparcelar (${formatCurrencyBr(novoSaldoAReparcelar)}). Clique em "Redistribuir Igual" ou ajuste os valores.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const agr = buildAgreementPayload();
      const payload = buildReparcelamentoOSPayload({
        osNumber: osInput || 'AVULSO',
        clientName: clientNameInput || 'Cliente',
        clientId: clientIdInput,
        clientCpf: clientCpfInput,
        unit: unitInput || defaultUnit,
        selectedPendingRows,
        entradaValor: entradaNum,
        entradaMeioPagamento: entradaFormaPagto,
        descontoValor: descontoNum,
        acrescimoValor: acrescimoNum,
        meioPagamento,
        schedule: customSchedule,
        dataAcordoIso: dataAcordo,
        observacoes,
        operador: currentUser?.username || 'ERP'
      });

      if (onConfirmReparcelamento) {
        await onConfirmReparcelamento(payload);
      }

      setPrintAgreementData(agr);
      if (onTriggerPrintAgreement) {
        onTriggerPrintAgreement(agr);
      }
      setTimeout(() => {
        window.print();
        onClose();
      }, 300);
    } catch (err) {
      console.error('Erro ao processar reparcelamento de OS:', err);
      alert('Ocorreu um erro ao salvar o reparcelamento.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    // 🛡️ Ao gerar um reparcelamento, imprime todas as informações do formulário no Termo Oficial de Acordo A4
    return handleConfirmAndPrint(e);
  };

  if (!isOpen && !printAgreementData) return null;

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md"
          >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          style={{
            backgroundImage:
              'radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.14) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.14) 0px, transparent 55%)'
          }}
          className="glass-card bg-slate-900/95 border border-sky-500/30 shadow-2xl rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Cabeçalho Elegante */}
          <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-white/10 bg-slate-950/70">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500/25 to-indigo-500/25 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
                <RefreshCw size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 text-[10px] font-black uppercase tracking-widest border border-sky-500/30">
                    Módulo Financeiro ERP
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                    Boleto / Renegociação
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mt-0.5">
                  Módulo de Reparcelamento Referente à OS
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/10 transition-all cursor-pointer"
              title="Fechar Módulo de Reparcelamento"
            >
              <X size={20} />
            </button>
          </div>

          {/* Corpo com Rolagem */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 erp-scroll">
            {/* SEÇÃO 1: SELEÇÃO DA OS / CLIENTE COM PENDÊNCIAS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Coluna Esquerda: Seletor de OS / Cliente */}
              <div className="lg:col-span-5 bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3.5 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Search size={14} />
                    <span>1. Selecionar OS / Cliente</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                    {osGroupsWithPending.length} OS em aberto
                  </span>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchOSOrClient}
                    onChange={e => setSearchOSOrClient(e.target.value)}
                    placeholder="Buscar por Nº da OS, Nome do Cliente ou CPF..."
                    className="w-full bg-slate-900/90 border border-white/10 focus:border-sky-500/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 erp-scroll flex-1">
                  {filteredOSGroups.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs font-bold border border-dashed border-white/10 rounded-xl">
                      Nenhuma OS com parcelas pendentes encontrada para este filtro.
                    </div>
                  ) : (
                    filteredOSGroups.map(grp => {
                      const isSelected = selectedGroupKey === grp.key;
                      return (
                        <button
                          key={grp.key}
                          type="button"
                          onClick={() => applyGroupSelection(grp, includeAllClientPending)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border-sky-400 text-white shadow-md shadow-sky-500/10'
                              : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5 text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono font-black text-[10px] border border-sky-500/30">
                                {grp.osNumber === 'SEM-OS' ? 'Sem OS' : `OS #${grp.osNumber}`}
                              </span>
                              <span className="font-black text-xs text-white truncate">
                                {grp.clientName}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                              <span>{grp.pendingRows.length} parcela(s) em aberto</span>
                              <span>•</span>
                              <span>📍 {grp.unit}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-amber-400 font-mono">
                              {formatCurrencyBr(grp.totalPendente)}
                            </p>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Saldo OS</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Opção de consolidar todas as parcelas pendentes do mesmo cliente */}
                {clientNameInput && (
                  <label className="flex items-center gap-2 pt-2 border-t border-white/10 text-[11px] font-bold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeAllClientPending}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIncludeAllClientPending(checked);
                        const grp = osGroupsWithPending.find(g => g.key === selectedGroupKey);
                        if (grp) applyGroupSelection(grp, checked);
                      }}
                      className="rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-sky-500"
                    />
                    <span>Incluir todas as parcelas pendentes de <strong className="text-sky-300">{clientNameInput}</strong></span>
                  </label>
                )}
              </div>

              {/* Coluna Direita: Parcelas Pendentes da OS Selecionada */}
              <div className="lg:col-span-7 bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3.5 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Layers size={14} />
                      <span>2. Parcelas da OS para Reparcelar</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Marque as parcelas pendentes/vencidas que serão substituídas pelo novo parcelamento:
                    </p>
                  </div>

                  {paidCandidateRows.length > 0 && (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">
                      ✓ {paidCandidateRows.length} parcela(s) já paga(s) preservada(s)
                    </span>
                  )}
                </div>

                {/* Campos de Identificação da OS e Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-900/80 p-3 rounded-xl border border-white/5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Nº da OS Referência *
                    </label>
                    <input
                      type="text"
                      required
                      value={osInput}
                      onChange={e => setOsInput(e.target.value.toUpperCase())}
                      placeholder="Ex: CAJ-001"
                      className="w-full bg-black/50 border border-sky-500/30 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 font-mono font-black uppercase outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Nome do Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientNameInput}
                      onChange={e => setClientNameInput(e.target.value)}
                      placeholder="Nome do Cliente"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Loja / Unidade
                    </label>
                    <select
                      value={unitInput}
                      onChange={e => setUnitInput(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none"
                    >
                      <option value="Central" className="bg-slate-900">Central</option>
                      <option value="Cajati" className="bg-slate-900">Cajati</option>
                      <option value="Registro" className="bg-slate-900">Registro</option>
                      <option value="Jacupiranga" className="bg-slate-900">Jacupiranga</option>
                      <option value="Venda Externa" className="bg-slate-900">Venda Externa</option>
                    </select>
                  </div>
                </div>

                {/* Lista de Parcelas Pendentes */}
                <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/30 divide-y divide-white/5 erp-scroll flex-1">
                  {pendingCandidateRows.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs font-bold">
                      Selecione uma OS com parcelas em aberto ao lado para carregar os títulos.
                    </div>
                  ) : (
                    pendingCandidateRows.map((row, idx) => {
                      const uid = getRowUid(row);
                      const isChecked = selectedRowIds.has(uid);
                      const val = parseCurrencyValue(row.VALOR || row.valor || row['VALOR PARCELA']);
                      const vencIso = normalizeInstallmentDateIso(row.DATA_VENCIMENTO || row['DATA VENCIMENTO'] || row.VENCIMENTO);
                      const isVencida = vencIso && vencIso <= todayIso;
                      const rowOs = extractOSFromRow(row);

                      return (
                        <label
                          key={uid}
                          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${
                            isChecked ? 'bg-sky-500/10 hover:bg-sky-500/15' : 'hover:bg-white/5 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedRowIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(uid)) next.delete(uid);
                                  else next.add(uid);
                                  return next;
                                });
                              }}
                              className="rounded border-white/20 bg-slate-900 text-sky-500"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {rowOs && (
                                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-sky-300 font-mono text-[10px] font-black">
                                    OS #{rowOs}
                                  </span>
                                )}
                                <span className="font-bold text-white truncate">
                                  {row.DOCUMENTO || row.DESCRICAO || `Parcela ${idx + 1}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>Vencimento: <strong className="text-slate-200 font-mono">{formatInstallmentDateBr(vencIso)}</strong></span>
                                {isVencida ? (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-black uppercase text-[9px]">
                                    Vencida
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black uppercase text-[9px]">
                                    A Vencer
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="font-mono font-black text-amber-300 shrink-0">
                            {formatCurrencyBr(val)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: SIMULAÇÃO E PARÂMETROS DO REPARCELAMENTO */}
            <div className="bg-slate-950/70 border border-sky-500/25 rounded-2xl p-4 sm:p-5 space-y-5 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Calculator size={16} className="text-sky-400" />
                  <span>3. Condições do Reparcelamento da OS #{osInput || '—'}</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  Padrão de parcelamento a prazo: <strong className="text-sky-400">Boleto</strong>
                </span>
              </div>

              {/* Cards de Cálculo Financeiro em Tempo Real */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Saldo Selecionado ({selectedPendingRows.length} parc.)
                  </span>
                  <p className="text-lg sm:text-xl font-black text-white font-mono mt-0.5">
                    {formatCurrencyBr(saldoOriginalSelecionado)}
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    (-) Entrada no Ato
                  </span>
                  <p className="text-lg sm:text-xl font-black text-emerald-300 font-mono mt-0.5">
                    {formatCurrencyBr(entradaNum)}
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Ajuste (Desc. / Acrésc.)
                  </span>
                  <p className="text-lg sm:text-xl font-black text-amber-300 font-mono mt-0.5">
                    {acrescimoNum - descontoNum >= 0 ? `+ ${formatCurrencyBr(acrescimoNum - descontoNum)}` : `- ${formatCurrencyBr(Math.abs(acrescimoNum - descontoNum))}`}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-400/50 rounded-xl p-3 shadow-lg shadow-sky-500/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-300">
                    (=) Novo Saldo a Reparcelar
                  </span>
                  <p className="text-lg sm:text-xl font-black text-white font-mono mt-0.5">
                    {formatCurrencyBr(novoSaldoAReparcelar)}
                  </p>
                </div>
              </div>

              {/* Controles de Entrada, Desconto, Acréscimo, Nº de Parcelas e Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Entrada / Amortização Hoje (R$)
                  </label>
                  <input
                    type="text"
                    value={entradaInput}
                    onChange={e => setEntradaInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-slate-900 border border-white/10 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono font-black outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Meio Pagto. da Entrada
                  </label>
                  <select
                    value={entradaFormaPagto}
                    onChange={e => setEntradaFormaPagto(e.target.value)}
                    disabled={entradaNum <= 0}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none disabled:opacity-40"
                  >
                    <option value="PIX" className="bg-slate-900">PIX</option>
                    <option value="Dinheiro" className="bg-slate-900">Dinheiro (Espécie)</option>
                    <option value="Cartão de Débito" className="bg-slate-900">Cartão de Débito</option>
                    <option value="Cartão de Crédito" className="bg-slate-900">Cartão de Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Desconto Concedido (R$)
                  </label>
                  <input
                    type="text"
                    value={descontoInput}
                    onChange={e => setDescontoInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-slate-900 border border-white/10 focus:border-sky-400 rounded-xl px-3 py-2 text-xs text-sky-300 font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Juros / Acréscimo (R$)
                  </label>
                  <input
                    type="text"
                    value={acrescimoInput}
                    onChange={e => setAcrescimoInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-slate-900 border border-white/10 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-sky-400 block mb-1">
                    Nova Qtd. de Parcelas *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={qtdParcelas}
                      onChange={e => setQtdParcelas(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white font-black outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n} className="bg-slate-900">
                          {n}x {novoSaldoAReparcelar > 0 ? `de ${formatCurrencyBr(novoSaldoAReparcelar / n)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-sky-400 block mb-1">
                    Data do 1º Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={primeiroVencimento}
                    onChange={e => setPrimeiroVencimento(e.target.value)}
                    className="w-full bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Intervalo entre Parcelas
                  </label>
                  <select
                    value={intervaloParcelas}
                    onChange={e => setIntervaloParcelas(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                  >
                    <option value="MESMO_DIA_MES" className="bg-slate-900">Mensal (Mesmo dia de cada mês)</option>
                    <option value="30_DIAS" className="bg-slate-900">A cada 30 dias corridos</option>
                    <option value="15_DIAS" className="bg-slate-900">Quinzenal (A cada 15 dias)</option>
                    <option value="7_DIAS" className="bg-slate-900">Semanal (A cada 7 dias)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Modalidade das Parcelas
                  </label>
                  <select
                    value={meioPagamento}
                    onChange={e => setMeioPagamento(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                  >
                    <option value="Boleto" className="bg-slate-900">📄 Boleto</option>
                    <option value="Cartão de Crédito" className="bg-slate-900">💳 Cartão de Crédito</option>
                    <option value="Pix / Transferência" className="bg-slate-900">⚡ Pix Agendado / Transferência</option>
                  </select>
                </div>
              </div>

              {/* Atalhos Rápidos de Quantidade de Parcelas */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
                    Atalhos Rápidos:
                  </span>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQtdParcelas(n)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                        qtdParcelas === n
                          ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRecalculateSchedule}
                  className="text-[11px] font-bold text-sky-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Redistribuir Igual</span>
                </button>
              </div>

              {/* CRONOGRAMA EDITÁVEL DAS NOVAS PARCELAS */}
              {novoSaldoAReparcelar > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Calendar size={14} className="text-sky-400" />
                      <span>Cronograma das Novas Parcelas (Datas e Valores Personalizáveis)</span>
                    </span>
                    <span className={`text-xs font-mono font-black ${Math.abs(scheduleDiff) <= 0.05 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Soma das Parcelas: {formatCurrencyBr(totalScheduleCustom)}
                      {Math.abs(scheduleDiff) > 0.05 && ` (Diferença: ${formatCurrencyBr(scheduleDiff)})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1 erp-scroll">
                    {customSchedule.map((parc, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/90 border border-white/10 hover:border-sky-500/40 rounded-xl p-3 flex flex-col gap-2 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 font-mono font-black text-[11px] border border-sky-500/30">
                            {parc.numero}/{parc.totalParcelas}ª Parcela — Boleto
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            OS #{osInput || '—'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                              Vencimento
                            </label>
                            <input
                              type="date"
                              value={parc.vencimento}
                              onChange={e => handleScheduleDateChange(idx, e.target.value)}
                              className="w-full bg-black/50 border border-white/10 focus:border-sky-400 rounded-lg px-2 py-1 text-[11px] text-white font-mono font-bold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                              Valor (R$)
                            </label>
                            <input
                              type="text"
                              value={parc.valor}
                              onChange={e => handleScheduleValueChange(idx, e.target.value)}
                              className="w-full bg-black/50 border border-white/10 focus:border-emerald-400 rounded-lg px-2 py-1 text-[11px] text-emerald-300 font-mono font-black outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações do Acordo */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Data do Acordo
                  </label>
                  <input
                    type="date"
                    value={dataAcordo}
                    onChange={e => setDataAcordo(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Motivo / Observações do Reparcelamento
                  </label>
                  <input
                    type="text"
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="Ex: Cliente solicitou alteração das datas de vencimento e redivisão do saldo da OS..."
                    className="w-full bg-slate-900 border border-white/10 focus:border-sky-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>
                  As <strong>{selectedPendingRows.length} parcela(s) antiga(s)</strong> selecionadas serão substituídas por <strong>{novoSaldoAReparcelar > 0 ? `${customSchedule.length} nova(s) parcela(s)` : 'quitação à vista'}</strong> vinculadas à <strong>OS #{osInput || 'AVULSO'}</strong>.
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePrintAgreementOnly}
                  disabled={isSubmitting || selectedPendingRows.length === 0}
                  title="Visualizar e Imprimir Termo de Acordo em Folha A4 para o Cliente Assinar"
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600/60 text-sky-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer size={15} className="text-sky-400" />
                  <span>Imprimir Termo (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndPrint}
                  disabled={isSubmitting || selectedPendingRows.length === 0}
                  title="Salvar no Financeiro e Imprimir Termo de Acordo para Assinatura do Cliente"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Confirmar & Imprimir</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedPendingRows.length === 0}
                  title="Salvar Reparcelamento no Financeiro sem Imprimir"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-sky-500/25 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>{isSubmitting ? 'Processando...' : 'Confirmar'}</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>

    {/* Componente Oficial Imprimível em Folha Única A4 para Assinatura */}
    <PrintableReparcelamentoAgreement agreementData={printAgreementData} />
    </>
  );
};

export default ReparcelamentoOSModal;
