import React, { useState, useMemo } from "react";
import { 
  ClipboardList, Search, Filter, Calendar, Clock, AlertTriangle, 
  CheckCircle, RefreshCw, Printer, MessageCircle, User, Eye, 
  Trash2, MapPin, ArrowLeft, ArrowUpDown, ChevronRight, ShieldAlert,
  Sparkles, CheckCircle2, AlertCircle, ShoppingBag, Phone, X, Check, PackageCheck, Tag,
  Glasses, ChevronDown, ChevronUp, LayoutGrid, Table as TableIcon, CreditCard, DollarSign,
  ShieldCheck, XCircle, FileText, Receipt, FlaskConical, Layers, Link
} from "lucide-react";
import PrintableOS from "./PrintableOS";
import PrintableLabOS from "./PrintableLabOS";
import { PrintableLabelModal } from "./PrintableLabel";
import { isSameClient } from "../firebaseSync";

// Cores dos status no Semáforo: Azul (Aguardando Confirmação Financeira), Vermelha, Amarela e Verde
export const OS_STATUS_CONFIG = {
  "Aguardando Confirmação": {
    label: "Aguardando Confirmação",
    color: "blue",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-[0_0_12px_rgba(14,165,233,0.25)]",
    dotClass: "bg-sky-400 animate-pulse",
    icon: "🔵"
  },
  "No Laboratório": {
    label: "No Laboratório",
    color: "red",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
    dotClass: "bg-rose-400",
    icon: "🔴"
  },
  "Aguardando Lente": {
    label: "Aguardando Lente",
    color: "red",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
    dotClass: "bg-rose-400",
    icon: "🔴"
  },
  "Em Produção": {
    label: "Em Produção / Montagem",
    color: "yellow",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
    dotClass: "bg-amber-400",
    icon: "🟡"
  },
  "Pronto para Retirada": {
    label: "Pronto para Retirada",
    color: "yellow",
    badgeClass: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.2)]",
    dotClass: "bg-yellow-400 animate-pulse",
    icon: "🟡"
  },
  "Entregue": {
    label: "Entregue ao Cliente",
    color: "green",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
    dotClass: "bg-emerald-400",
    icon: "🟢"
  },
  "Cancelada": {
    label: "Cancelada",
    color: "red",
    badgeClass: "bg-slate-700/40 text-slate-400 border-slate-600/40",
    dotClass: "bg-slate-500",
    icon: "⚫"
  }
};

const parseCurrency = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const formatMoney = (val) => {
  if (val === null || val === undefined || val === '') return '0,00';
  if (typeof val === 'number') {
    return isNaN(val) ? '0,00' : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return '0,00';
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? '0,00' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (val) => {
  if (!val) return '—';
  if (val instanceof Date) return val.toLocaleDateString('pt-BR');
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toLocaleDateString('pt-BR');
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
};

const formatCPF_CNPJ = (val) => {
  if (!val) return '';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return String(val);
};

export const toIsoDate = (val) => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return s;
};

export const cleanBoletoDisplay = (val) => {
  if (!val) return '';
  return String(val)
    .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
};

export const extractOrderInstallments = (order) => {
  if (!order) return [];
  let parcelas = [];
  try {
    if (order.raw?.PARCELAS_JSON) {
      parcelas = typeof order.raw.PARCELAS_JSON === 'string' ? JSON.parse(order.raw.PARCELAS_JSON) : order.raw.PARCELAS_JSON;
    } else if (order.parcelasJson) {
      parcelas = typeof order.parcelasJson === 'string' ? JSON.parse(order.parcelasJson) : order.parcelasJson;
    } else if (order.raw?.parcelas && Array.isArray(order.raw.parcelas)) {
      parcelas = order.raw.parcelas;
    } else if (order.parcelas && Array.isArray(order.parcelas)) {
      parcelas = order.parcelas;
    }
  } catch (err) {
    console.warn('Erro ao ler parcelas da OS:', err);
  }

  if (Array.isArray(parcelas) && parcelas.length > 0) {
    return parcelas;
  }

  // Auto-reconstrução a partir de formasPagamento se for Boleto
  const fpTexto = String(order.formasPagamento || order.raw?.FORMAS_PAGAMENTO || order.raw?.FORMA_PAGTO || order.raw?.MEIO_PAGAMENTO || '');
  const isBoleto = /boleto|carnê|carne/i.test(fpTexto);
  if (isBoleto) {
    const matchX = fpTexto.match(/(\d+)x\s*(?:de\s*)?R?\$?\s*([\d.,]+)/i);
    const vencListMatch = [...fpTexto.matchAll(/(\d+)ª\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/g)];
    const dateMap = {};
    vencListMatch.forEach(m => {
      dateMap[parseInt(m[1], 10)] = toIsoDate(m[2]);
    });

    if (matchX) {
      const numParcelas = parseInt(matchX[1], 10) || 1;
      const valorUnitario = parseCurrency(matchX[2]);
      if (numParcelas >= 1 && valorUnitario > 0) {
        const baseDate = new Date();
        const generated = [];
        for (let i = 1; i <= numParcelas; i++) {
          let calculatedDate = dateMap[i];
          if (!calculatedDate) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + 30 * i);
            calculatedDate = d.toISOString().split('T')[0];
          }
          generated.push({
            numero: i,
            totalParcelas: numParcelas,
            valor: formatMoney(valorUnitario),
            vencimento: calculatedDate
          });
        }
        return generated;
      }
    } else {
      const restVal = parseCurrency(order.restante) || Math.max(0, parseCurrency(order.valorTotal) - parseCurrency(order.valorEntrada));
      if (restVal > 0) {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 30);
        return [{
          numero: 1,
          totalParcelas: 1,
          valor: formatMoney(restVal),
          vencimento: dateMap[1] || toIsoDate(order.dtEntrega) || baseDate.toISOString().split('T')[0]
        }];
      }
    }
  }

  return [];
};

const getDeadlineInfo = (dtEntrega, status) => {
  if (!dtEntrega || status === "Entregue" || status === "Cancelada") return null;
  const s = String(dtEntrega).trim();
  let dStr = s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    dStr = `${y}-${m}-${d}`;
  }
  const deliveryDate = new Date(dStr + "T23:59:59");
  if (isNaN(deliveryDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deliveryDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { isDelayed: true, diffDays, text: `Atrasada há ${Math.abs(diffDays)} dia(s)` };
  } else if (diffDays === 0) {
    return { isDelayed: false, diffDays, text: "Previsto para HOJE" };
  } else if (diffDays === 1) {
    return { isDelayed: false, diffDays, text: "Previsto para amanhã" };
  } else {
    return { isDelayed: false, diffDays, text: `Faltam ${diffDays} dias` };
  }
};

export const isMatchingOS = (inv, targetOs) => {
  if (!inv || !targetOs) return false;
  const target = String(targetOs).trim().toLowerCase();
  if (!target || target === '—') return false;
  const targetPure = target.replace(/^os-?/i, '');
  const vOS = String(inv.VENDA_OS || inv.venda_os || inv.OS || inv.os || '').trim().toLowerCase();
  if (vOS) {
    if (vOS === target || vOS.replace(/^os-?/i, '') === targetPure) return true;
  }
  const doc = String(inv.DOCUMENTO || inv.documento || '').toLowerCase();
  const desc = String(inv.DESCRICAO || inv.descricao || '').toLowerCase();
  if (targetPure && (doc.includes(`os #${targetPure}`) || doc.includes(`os ${targetPure}`) || doc.includes(`os-${targetPure}`) || desc.includes(`os #${targetPure}`) || desc.includes(`os ${targetPure}`) || desc.includes(`os-${targetPure}`))) {
    return true;
  }
  return doc.includes(target) || desc.includes(target);
};

const OSManagement = ({ 
  data = {}, 
  salesData = [], 
  clientsData = [], 
  currentUser, 
  onAddRow,
  onAddBatch,
  onUpdateRow, 
  onDeleteRow, 
  onClearFinancialAndOS,
  onBack 
}) => {
  const isAdmin = ["admin", "administrativo"].includes(currentUser?.role);
  const isVendedor = currentUser?.role === 'vendedor';

  const [selectedUnit, setSelectedUnit] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' (informações abaixo) por padrão!
  const [collapsedOrders, setCollapsedOrders] = useState({});
  const [osDataForPrint, setOsDataForPrint] = useState(null);
  const [printClient, setPrintClient] = useState(null);
  const [osDataForLabPrint, setOsDataForLabPrint] = useState(null);
  const [printLabClient, setPrintLabClient] = useState(null);
  const [labelModalData, setLabelModalData] = useState(null);

  // Modal de Conferência Financeira & Aprovação de OS (Semáforo Azul)
  const [approvalModalOrder, setApprovalModalOrder] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Modal Formulário Lab
  const [labModalOrder, setLabModalOrder] = useState(null);
  const [labFormData, setLabFormData] = useState({});

  // Modal de Baixa de Entrega ao Cliente
  const [deliveryModalOrder, setDeliveryModalOrder] = useState(null);
  const [deliveryDateInput, setDeliveryDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryReceiverInput, setDeliveryReceiverInput] = useState('Próprio Cliente');
  const [deliveryNotesInput, setDeliveryNotesInput] = useState('');

  const toggleCollapse = (orderId) => {
    setCollapsedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const expandAll = () => {
    setCollapsedOrders({});
  };

  const collapseAll = (ordersList) => {
    const all = {};
    (ordersList || []).forEach(o => { all[o.id] = true; });
    setCollapsedOrders(all);
  };

  const openLabelModal = (order) => {
    const clientMatch = clientsData.find(c => isSameClient(c, {
      'Nome Completo': order.clientName,
      'WhatsApp': order.clientPhone,
      'CPF / CNPJ': order.clientCPF
    })) || {};

    setLabelModalData({
      ...clientMatch,
      ...order.raw,
      numeroOS: order.osNumber,
      osNumber: order.osNumber,
      clientName: order.clientName,
      armacao: order.armacao,
      lente: order.lente,
      unidade: order.unit,
      dtEntrega: formatDate(order.dtEntrega),
      odEsf: order.odEsf || order.raw?.OD_ESF || order.raw?.odEsf || clientMatch?.['OD_ESF'] || '',
      odCil: order.odCil || order.raw?.OD_CIL || order.raw?.odCil || clientMatch?.['OD_CIL'] || '',
      odEixo: order.odEixo || order.raw?.OD_EIXO || order.raw?.odEixo || clientMatch?.['OD_EIXO'] || '',
      odDnp: order.odDnp || order.raw?.OD_DNP || order.raw?.odDnp || clientMatch?.['OD_DNP'] || '',
      odAlt: order.odAlt || order.raw?.OD_ALT || order.raw?.odAlt || clientMatch?.['OD_ALT'] || '',
      oeEsf: order.oeEsf || order.raw?.OE_ESF || order.raw?.oeEsf || clientMatch?.['OE_ESF'] || '',
      oeCil: order.oeCil || order.raw?.OE_CIL || order.raw?.oeCil || clientMatch?.['OE_CIL'] || '',
      oeEixo: order.oeEixo || order.raw?.OE_EIXO || order.raw?.oeEixo || clientMatch?.['OE_EIXO'] || '',
      oeDnp: order.oeDnp || order.raw?.OE_DNP || order.raw?.oeDnp || clientMatch?.['OE_DNP'] || '',
      oeAlt: order.oeAlt || order.raw?.OE_ALT || order.raw?.oeAlt || clientMatch?.['OE_ALT'] || '',
      adicao: order.adicao || order.raw?.ADICAO || order.raw?.adicao || clientMatch?.['ADICAO'] || ''
    });
  };

  // Consolidação de todas as Ordens de Serviço
  const allOrders = useMemo(() => {
    const rawSales = salesData.length > 0 ? salesData : (data["Registro_Vendas"] || data["BD MARKETING"] || []);
    
    // Mapeia todas as vendas que possuem número de OS
    const list = rawSales.filter(sale => {
      const osNum = sale["OS DA VENDA"] || sale["OS"] || sale["OS da COMPRA"] || sale["VENDA_OS"];
      return !!osNum && String(osNum).trim() !== "" && String(osNum) !== "—";
    }).map((sale, idx) => {
      const osNumber = String(sale["OS DA VENDA"] || sale["OS"] || sale["VENDA_OS"] || "OS-" + (idx + 1)).trim();
      const clientName = (sale["NOME CLIENTE"] || sale["NOME"] || sale["Cliente"] || sale["Nome Completo"] || "Cliente").trim();
      
      // Localiza cliente no cadastro por ID/CPF único ou nome
      const matchedClient = clientsData.find(c => isSameClient(c, sale));

      // Detecta unidade por prefixo ou dado da venda
      let unit = sale["UNIDADE"] || sale["CIDADE"] || sale["LOJA"] || matchedClient?.["Cidade"] || "Central";
      if (osNumber.startsWith("CAJ-")) unit = "Cajati";
      else if (osNumber.startsWith("REG-")) unit = "Registro";
      else if (osNumber.startsWith("JAC-")) unit = "Jacupiranga";
      else if (osNumber.startsWith("EXT-")) unit = "Venda Externa";

      // Status padrão da OS
      let status = sale["STATUS_OS"] || sale["SITUAÇÃO"] || "No Laboratório";
      if (status === "Aguardando Confirmação" || status === "Aguardando Confirmação Financeira" || status === "Aguardando Pagamento" || status === "Aguardando Aprovação") {
        status = "Aguardando Confirmação";
      } else if (status === "Pago" || status === "PAGO" || status === "Entregue" || status === "Concluído") {
        status = "Entregue";
      } else if (status === "Pendente" || status === "PENDENTE" || status === "Aberto") {
        status = "No Laboratório";
      }

      const dtVenda = sale["DATA  DA VENDA"] || sale["DATA"] || "";
      const dtEntrega = sale["DATA ENTREGA ÓCULOS"] || sale["DATA_ENTREGA"] || sale["DATA VENCIMENTO"] || "";
      const dtEntregaReal = sale["DATA_ENTREGA_REAL"] || sale["DATA_BAIXA_ENTREGA"] || (status === "Entregue" ? (sale["DATA_RECEBIMENTO"] || sale["DATA ENTREGA ÓCULOS"] || sale["DATA_ENTREGA"] || "") : "");
      const quemRetirou = sale["QUEM_RETIROU"] || "";
      const obsEntrega = sale["OBS_ENTREGA"] || "";

      // Verifica atraso
      let isDelayed = false;
      if (dtEntrega && status !== "Entregue" && status !== "Cancelada") {
        const deliveryDate = new Date(dtEntrega + "T23:59:59");
        if (!isNaN(deliveryDate.getTime()) && deliveryDate < new Date()) {
          isDelayed = true;
        }
      }

      const clientCPF = matchedClient?.["CPF / CNPJ"] || matchedClient?.["CPF"] || sale["CPF"] || "";
      const valorTotal = sale["VALOR TOTAL"] || sale["VALOR"] || "0,00";
      const formasPagamento = sale["FORMAS_PAGAMENTO"] || sale["FORMA_PAGTO"] || sale["FORMA DE PAGAMENTO"] || sale["MEIO_PAGAMENTO"] || "";
      let valorEntrada = sale["VALOR ENTRADA"] || sale["SINAL"];
      let restante = sale["RESTANTE"];

      // Se for pagamento exclusivo em Boleto e não tiver entrada expressa
      const isApenasBoleto = /boleto|carnê|carne/i.test(formasPagamento) && !/dinheiro|pix|débito|debito|crédito|credito/i.test(formasPagamento);
      if (valorEntrada === undefined || valorEntrada === '') {
        if (isApenasBoleto) {
          valorEntrada = "0,00";
          if (!restante) restante = valorTotal;
        } else {
          valorEntrada = "0,00";
        }
      }
      if (restante === undefined || restante === '') {
        if (isApenasBoleto) {
          restante = valorTotal;
        } else {
          restante = "0,00";
        }
      }
      const dioptria = sale["DIOPTRIA"] || "";
      const medico = sale["MEDICO"] || "";

      // Dados de Prescrição Óptica Detalhada (OD e OE)
      const odEsf = sale["OD_ESF"] || sale["odEsf"] || sale["OD ESF"] || matchedClient?.["OD_ESF"] || matchedClient?.["odEsf"] || "";
      const odCil = sale["OD_CIL"] || sale["odCil"] || sale["OD CIL"] || matchedClient?.["OD_CIL"] || matchedClient?.["odCil"] || "";
      const odEixo = sale["OD_EIXO"] || sale["odEixo"] || sale["OD EIXO"] || matchedClient?.["OD_EIXO"] || matchedClient?.["odEixo"] || "";
      const odDnp = sale["OD_DNP"] || sale["odDnp"] || sale["OD DNP"] || matchedClient?.["OD_DNP"] || matchedClient?.["odDnp"] || "";
      const odAlt = sale["OD_ALT"] || sale["odAlt"] || sale["OD ALT"] || matchedClient?.["OD_ALT"] || matchedClient?.["odAlt"] || "";

      const oeEsf = sale["OE_ESF"] || sale["oeEsf"] || sale["OE ESF"] || matchedClient?.["OE_ESF"] || matchedClient?.["oeEsf"] || "";
      const oeCil = sale["OE_CIL"] || sale["oeCil"] || sale["OE CIL"] || matchedClient?.["OE_CIL"] || matchedClient?.["oeCil"] || "";
      const oeEixo = sale["OE_EIXO"] || sale["oeEixo"] || sale["OE EIXO"] || matchedClient?.["OE_EIXO"] || matchedClient?.["oeEixo"] || "";
      const oeDnp = sale["OE_DNP"] || sale["oeDnp"] || sale["OE DNP"] || matchedClient?.["OE_DNP"] || matchedClient?.["oeDnp"] || "";
      const oeAlt = sale["OE_ALT"] || sale["oeAlt"] || sale["OE ALT"] || matchedClient?.["OE_ALT"] || matchedClient?.["oeAlt"] || "";

      const adicao = sale["ADICAO"] || sale["adicao"] || sale["ADIÇÃO"] || matchedClient?.["ADICAO"] || matchedClient?.["adicao"] || "";
      const laboratorio = sale["LABORATORIO"] || sale["Laboratório"] || sale["LAB"] || "";
      const deadlineInfo = getDeadlineInfo(dtEntrega, status);

      // Metadados de Venda com Múltiplas OS vinculadas (Cobrança Única)
      const saleId = sale["saleId"] || sale["parentSaleId"] || sale.id || "";
      const isMultiOS = Boolean(
        sale["isMultiOS"] === true || 
        (Array.isArray(sale["allLinkedOS"]) && sale["allLinkedOS"].length > 1) ||
        (sale["multiOSCount"] && Number(sale["multiOSCount"]) > 1) ||
        (sale["totalOS"] && Number(sale["totalOS"]) > 1) ||
        /-\d+$/.test(osNumber)
      );
      const isSecondaryOS = Boolean(
        sale["isSecondaryOS"] === true || 
        (sale["FINANCEIRO_UNIFICADO"] === true && sale["VALOR TOTAL"] === '0,00')
      );
      const parentSaleId = sale["parentSaleId"] || (isSecondaryOS ? saleId : "");
      
      let osIndex = Number(sale["osIndex"]);
      if (isNaN(osIndex) || !osIndex) {
        const match = osNumber.match(/-(\d+)$/);
        osIndex = match ? Number(match[1]) : 1;
      }

      let totalOS = Number(sale["totalOS"] || sale["multiOSCount"]);
      if (isNaN(totalOS) || !totalOS) {
        if (Array.isArray(sale["allLinkedOS"]) && sale["allLinkedOS"].length > 0) {
          totalOS = sale["allLinkedOS"].length;
        } else if (isMultiOS) {
          totalOS = 2;
        } else {
          totalOS = 1;
        }
      }

      const osLabel = sale["osLabel"] || (isMultiOS ? `Óculos ${osIndex}` : "");
      const allLinkedOS = Array.isArray(sale["allLinkedOS"]) ? sale["allLinkedOS"] : [osNumber];
      const financeiroUnificado = Boolean(
        sale["FINANCEIRO_UNIFICADO"] === true || 
        sale["COBRANCA_UNICA"] === true ||
        isSecondaryOS
      );

      return {
        raw: sale,
        id: sale.id || ("os-" + idx),
        saleId,
        isMultiOS,
        isSecondaryOS,
        parentSaleId,
        osIndex,
        totalOS,
        osLabel,
        allLinkedOS,
        financeiroUnificado,
        osNumber,
        clientName,
        clientPhone: matchedClient?.["WhatsApp"] || sale["TELEFONE CLIENTE"] || sale["TELEFONE"] || "",
        clientCPF,
        clientCity: matchedClient?.["Cidade"] || unit,
        unit,
        product: sale["PRODUTO"] || (sale["LENTE"] || "") + " " + (sale["ARMAÇÃO"] || "").trim() || "Óculos Completo",
        lente: sale["LENTE"] || matchedClient?.["Marca de Lente"] || "",
        armacao: sale["ARMAÇÃO"] || matchedClient?.["Modelo de Armação"] || "",
        valorTotal,
        valorEntrada,
        restante,
        dioptria,
        medico,
        formasPagamento: cleanBoletoDisplay(formasPagamento),
        dtVenda,
        dtEntrega,
        dtEntregaReal,
        quemRetirou,
        obsEntrega,
        status,
        isDelayed,
        odEsf,
        odCil,
        odEixo,
        odDnp,
        odAlt,
        oeEsf,
        oeCil,
        oeEixo,
        oeDnp,
        oeAlt,
        adicao,
        laboratorio,
        deadlineInfo,
        clientData: matchedClient,
        matchedClient: matchedClient,
        parcelasJson: sale["PARCELAS_JSON"],
        duplicatasGeradas: sale["DUPLICATAS_GERADAS"] === true,
        pagamentoConferido: sale["PAGAMENTO_CONFERIDO"] === true || sale["PAGAMENTO_CONFERIDO"] === "Sim",
        voucher: sale["VOUCHER"] || sale["voucher"] || sale.raw?.["VOUCHER"] || matchedClient?.["VOUCHER"] || "",
        descontoVoucher: sale["DESCONTO_VOUCHER"] || sale["descontoVoucher"] || sale.raw?.["DESCONTO_VOUCHER"] || matchedClient?.["DESCONTO_VOUCHER"] || ""
      };
    });

    // Ordena da mais recente para a mais antiga
    return list.reverse();
  }, [salesData, data, clientsData]);

  // Filtro de Ordens de Serviço
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      // Filtro de Loja
      if (selectedUnit !== "ALL" && order.unit !== selectedUnit) return false;

      // Filtro de Status
      if (selectedStatusFilter === "DELAYED") {
        if (!order.isDelayed) return false;
      } else if (selectedStatusFilter !== "ALL" && order.status !== selectedStatusFilter) {
        return false;
      }

      // Busca por Texto Aprimorada
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const cleanQ = q.replace(/\D/g, '');
        const matchesOS = order.osNumber.toLowerCase().includes(q);
        const matchesClient = order.clientName.toLowerCase().includes(q);
        const matchesProduct = order.product.toLowerCase().includes(q);
        const matchesUnit = order.unit.toLowerCase().includes(q);
        const matchesArmacao = (order.armacao || '').toLowerCase().includes(q);
        const matchesLente = (order.lente || '').toLowerCase().includes(q);
        const matchesMedico = (order.medico || '').toLowerCase().includes(q);
        const matchesStatus = (order.status || '').toLowerCase().includes(q);
        const matchesLab = (order.laboratorio || '').toLowerCase().includes(q);
        const matchesVoucher = (order.voucher || '').toLowerCase().includes(q);

        const matchesSaleId = (order.saleId || '').toLowerCase().includes(q) || (order.parentSaleId || '').toLowerCase().includes(q);
        const matchesLinked = Array.isArray(order.allLinkedOS) && order.allLinkedOS.some(num => String(num).toLowerCase().includes(q));

        let matchesDoc = false;
        if (cleanQ.length >= 3) {
          const clientCPFNum = (order.clientCPF || '').replace(/\D/g, '');
          const clientPhoneNum = (order.clientPhone || '').replace(/\D/g, '');
          if (clientCPFNum.includes(cleanQ) || clientPhoneNum.includes(cleanQ)) {
            matchesDoc = true;
          }
        }

        if (!matchesOS && !matchesClient && !matchesProduct && !matchesUnit && !matchesArmacao && !matchesLente && !matchesMedico && !matchesStatus && !matchesLab && !matchesDoc && !matchesSaleId && !matchesLinked && !matchesVoucher) {
          return false;
        }
      }

      return true;
    });
  }, [allOrders, selectedUnit, selectedStatusFilter, search]);

  // Contadores para cards resumo
  const stats = useMemo(() => {
    const total = allOrders.length;
    const aguardandoConfirmacao = allOrders.filter(o => o.status === "Aguardando Confirmação").length;
    const noLab = allOrders.filter(o => o.status === "No Laboratório" || o.status === "Aguardando Lente").length;
    const emProducao = allOrders.filter(o => o.status === "Em Produção").length;
    const pronto = allOrders.filter(o => o.status === "Pronto para Retirada").length;
    const entregues = allOrders.filter(o => o.status === "Entregue").length;
    const atrasadas = allOrders.filter(o => o.isDelayed).length;

    return { total, aguardandoConfirmacao, noLab, emProducao, pronto, entregues, atrasadas };
  }, [allOrders]);

  // Confirmar Pagamento da OS, Gerar Duplicatas no Financeiro (CONTAS_RECEBER) e Liberar Montagem
  const handleConfirmApproval = async (order) => {
    if (!order || isApproving || isVendedor) return;
    setIsApproving(true);

    try {
      const todayStr = new Date().toLocaleDateString('pt-BR');
      const todayIso = new Date().toISOString().split('T')[0];
      const restVal = parseCurrency(order.restante);

      // 1. Extrair parcelas estruturadas ou reconstruir do Boleto
      const parcelas = extractOrderInstallments(order);

      // 2. Limpeza preventiva de quaisquer duplicatas pendentes pré-existentes desta OS (evita duplicidades após edição)
      const clientId = order.clientData?.id || order.raw?.CLIENTE_ID || '';
      const clientCpf = order.clientCPF || order.raw?.CLIENTE_CPF || '';
      const clientName = order.clientName || order.raw?.CLIENTE || 'Cliente';

      const existingReceber = data?.['CONTAS_RECEBER'] || [];
      const targetOs = String(order.osNumber).trim().toLowerCase();

      const stalePending = existingReceber.filter(r => {
        return isMatchingOS(r, targetOs) && r.STATUS !== 'Recebido' && r.STATUS !== 'Pago';
      });

      if (onDeleteRow && stalePending.length > 0) {
        for (const stale of stalePending) {
          await onDeleteRow('CONTAS_RECEBER', stale);
        }
      }

      const remainingReceber = existingReceber.filter(r => !stalePending.includes(r));
      
      // Checar se já existem duplicatas pendentes ativas (evita geração duplicada se clicado múltiplas vezes)
      const alreadyHasPendingDuplicatas = remainingReceber.some(r => {
        return isMatchingOS(r, targetOs) && r.STATUS !== 'Recebido' && r.STATUS !== 'Pago';
      });

      // Identificar parcelas que já foram recebidas/pagas anteriormente para não duplicá-las
      const paidInvoices = remainingReceber.filter(r => {
        return isMatchingOS(r, targetOs) && (r.STATUS === 'Recebido' || r.STATUS === 'Pago');
      });

      let newlyCreatedPendingSum = 0;

      const itemsToCreate = [];

      const isSecondaryUnified = Boolean(
        order.isSecondaryOS || 
        order.raw?.isSecondaryOS || 
        (order.financeiroUnificado && parseCurrency(order.valorTotal) === 0)
      );

      if ((onAddBatch || onAddRow) && !alreadyHasPendingDuplicatas && !isSecondaryUnified) {
        if (parcelas && parcelas.length > 0) {
          // GERA EXCLUSIVAMENTE AS PARCELAS DO BOLETO QUE AINDA NÃO FORAM PAGAS
          for (const p of parcelas) {
            const numP = p.numero || 1;
            const totP = p.totalParcelas || parcelas.length;
            // Verificar se esta parcela específica já foi paga anteriormente
            const isAlreadyPaid = paidInvoices.some(paid => {
              const doc = String(paid.DOCUMENTO || '').toLowerCase();
              const desc = String(paid.DESCRICAO || '').toLowerCase();
              return doc.includes(`${numP}/${totP}`) || desc.includes(`parcela ${numP}/${totP}`) || doc.includes(`parcela ${numP}`) || doc.includes(`${numP}ª`);
            });

            if (!isAlreadyPaid) {
              const valP = typeof p.valor === 'number' ? formatMoney(p.valor) : String(p.valor || '0,00');
              const isoVenc = toIsoDate(p.vencimento) || todayIso;
              newlyCreatedPendingSum += parseCurrency(valP);
              itemsToCreate.push({
                CLIENTE_ID: clientId,
                CLIENTE_CPF: clientCpf,
                CPF: clientCpf,
                CLIENTE: clientName,
                'NOME CLIENTE': clientName,
                NOME: clientName,
                DESCRICAO: `OS #${order.osNumber} - Parcela ${numP}/${totP} (${order.product || 'Óculos Completo'})`,
                VENDA_OS: order.osNumber,
                OS: order.osNumber,
                DOCUMENTO: `BOLETO ${numP}/${totP} - OS ${order.osNumber}`,
                VALOR: valP,
                DATA_VENCIMENTO: isoVenc,
                'DATA VENCIMENTO': isoVenc,
                VENCIMENTO: isoVenc,
                STATUS: 'Pendente',
                CIDADE: order.unit,
                LOJA: order.unit,
                UNIDADE: order.unit,
                MEIO_PAGAMENTO: 'Boleto',
                OBSERVACOES: `Duplicata gerada após aprovação financeira da OS #${order.osNumber}`,
                DATA_CADASTRO: todayStr
              });
            }
          }
        } else if (restVal > 0) {
          // GERA LANÇAMENTO ÚNICO APENAS SE NÃO FOR PARCELAMENTO
          const paidTotal = paidInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
          const effectiveRest = Math.max(0, restVal - paidTotal);
          if (effectiveRest > 0) {
            newlyCreatedPendingSum = effectiveRest;
            const isoVenc = toIsoDate(order.dtEntrega) || todayIso;
            itemsToCreate.push({
              CLIENTE_ID: clientId,
              CLIENTE_CPF: clientCpf,
              CPF: clientCpf,
              CLIENTE: clientName,
              'NOME CLIENTE': clientName,
              NOME: clientName,
              DESCRICAO: `Venda OS #${order.osNumber} - ${order.product || 'Óculos Completo'}`,
              VENDA_OS: order.osNumber,
              OS: order.osNumber,
              DOCUMENTO: `OS #${order.osNumber} - Saldo a Receber`,
              VALOR: formatMoney(effectiveRest),
              DATA_VENCIMENTO: isoVenc,
              'DATA VENCIMENTO': isoVenc,
              VENCIMENTO: isoVenc,
              STATUS: 'Pendente',
              CIDADE: order.unit,
              LOJA: order.unit,
              UNIDADE: order.unit,
              MEIO_PAGAMENTO: /boleto|carnê|carne/i.test(order.formasPagamento || '') ? 'Boleto' : 'A Prazo',
              OBSERVACOES: `Duplicata gerada após aprovação financeira da OS #${order.osNumber}. Total: R$ ${order.valorTotal}, Sinal: R$ ${order.valorEntrada}`,
              DATA_CADASTRO: todayStr
            });
          }
        }

        if (itemsToCreate.length > 0) {
          if (onAddBatch) {
            await onAddBatch('CONTAS_RECEBER', itemsToCreate);
          } else if (onAddRow) {
            for (const item of itemsToCreate) {
              await onAddRow('CONTAS_RECEBER', item);
            }
          }
        }
      }

      // 3. Atualizar débito na ficha do cliente em CLIENTES_CADASTRADOS
      const matchedClient = clientsData.find(c => isSameClient(c, order.raw || {})) || order.clientData || order.matchedClient;
      if (matchedClient && onUpdateRow && !order.raw?.DUPLICATAS_GERADAS && !isSecondaryUnified) {
        const curDebt = parseCurrency(matchedClient['Valor Devido']);
        const amountToAdd = newlyCreatedPendingSum > 0 ? newlyCreatedPendingSum : restVal;
        if (amountToAdd > 0) {
          const newDebt = (curDebt + amountToAdd).toFixed(2).replace('.', ',');
          await onUpdateRow('CLIENTES_CADASTRADOS', matchedClient, {
            ...matchedClient,
            'Valor Devido': newDebt,
            'Status de Pagamento': 'Inadimplente'
          });
        } else if (curDebt <= 0) {
          await onUpdateRow('CLIENTES_CADASTRADOS', matchedClient, {
            ...matchedClient,
            'Status de Pagamento': 'Em dia'
          });
        }
      }

      // 4. Liberar a OS para o laboratório / montagem dos óculos
      if (onUpdateRow) {
        const updatedRow = {
          ...order.raw,
          STATUS_OS: 'No Laboratório',
          SITUAÇÃO: restVal > 0 ? 'Pendente' : 'Pago',
          PAGAMENTO_CONFERIDO: 'Sim',
          DUPLICATAS_GERADAS: true,
          DATA_APROVACAO: todayStr,
          APROVADO_POR: currentUser?.username || 'Administração'
        };
        await onUpdateRow('Registro_Vendas', order.raw, updatedRow);
      }

      setApprovalModalOrder(null);
      setSuccessToast(`✅ OS #${order.osNumber} aprovada com sucesso! Duplicatas geradas no Financeiro e liberada para montagem no laboratório.`);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      console.error('Erro ao aprovar OS:', err);
      alert('Erro ao processar aprovação da OS: ' + (err.message || err));
    } finally {
      setIsApproving(false);
    }
  };

  // Exclusão Segura e Inteligente em Cascata da OS (com limpeza de duplicatas no Contas a Receber e recálculo do Cliente)
  const handleDeleteOS = async (order) => {
    if (!order || !onDeleteRow || isVendedor || !isAdmin) return;

    // Localizar duplicatas vinculadas no CONTAS_RECEBER
    const contasReceberList = data?.['CONTAS_RECEBER'] || [];
    const targetOS = String(order.osNumber || '').trim().toLowerCase();
    
    const matchingInvoices = contasReceberList.filter(inv => isMatchingOS(inv, targetOS));

    const pendingInvoices = matchingInvoices.filter(inv => inv.STATUS !== 'Recebido' && inv.STATUS !== 'Pago');
    const paidInvoices = matchingInvoices.filter(inv => inv.STATUS === 'Recebido' || inv.STATUS === 'Pago');

    let confirmMsg = `Tem certeza que deseja excluir permanentemente a OS #${order.osNumber} do cliente "${order.clientName}"?\n\n`;

    if (pendingInvoices.length > 0) {
      const pendingTotal = pendingInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
      confirmMsg += `• ${pendingInvoices.length} parcela(s) pendente(s) no Contas a Receber (Total: R$ ${formatMoney(pendingTotal)}) serão APAGADAS.\n`;
      confirmMsg += `• O saldo devedor do cliente será atualizado automaticamente.\n`;
    }

    if (paidInvoices.length > 0) {
      const paidTotal = paidInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
      confirmMsg += `\n⚠️ ATENÇÃO: Constam R$ ${formatMoney(paidTotal)} já marcados como quitados nesta OS.\n`;
    }

    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    // Pergunta opcional de estorno para o operador caso existam recebimentos já quitados
    let shouldRefundCash = false;
    const paidTotal = paidInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
    if (paidTotal > 0 && onAddRow) {
      shouldRefundCash = window.confirm(
        `Deseja registrar o ESTORNO de R$ ${formatMoney(paidTotal)} no Fluxo de Caixa do dia de hoje?\n\n` +
        `• [OK]: Lança uma SAÍDA / ESTORNO no Caixa de hoje (dinheiro devolvido ao cliente).\n` +
        `• [Cancelar]: Mantém os lançamentos passados do Caixa sem alteração.`
      );
    }

    try {
      // 1. Excluir duplicatas pendentes do CONTAS_RECEBER
      for (const inv of pendingInvoices) {
        await onDeleteRow('CONTAS_RECEBER', inv);
      }

      // Se estornou, excluir também duplicatas quitadas e lançar saída no caixa
      if (shouldRefundCash) {
        for (const inv of paidInvoices) {
          await onDeleteRow('CONTAS_RECEBER', inv);
        }

        if (onAddRow) {
          await onAddRow('FLUXO_CAIXA', {
            id: `mov_estorno_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            tipo: 'SAÍDA',
            dataHora: new Date().toISOString(),
            data: new Date().toLocaleDateString('pt-BR'),
            unidade: order.unit || currentUser?.city || 'Central',
            operador: currentUser?.username || 'Administração',
            valor: paidTotal,
            formaPagamento: 'ESTORNO / DEVOLUÇÃO',
            motivo: `Estorno por Exclusão da OS #${order.osNumber} - ${order.clientName}`,
            detalhes: `OS #${order.osNumber} excluída permanentemente.`,
            CLIENTE_ID: order.clientData?.id || order.matchedClient?.id || '',
            CLIENTE_CPF: order.clientCPF,
            CPF: order.clientCPF
          });
        }
      }

      // 2. Abater débito na ficha do cliente (CLIENTES_CADASTRADOS)
      const client = clientsData.find(c => isSameClient(c, order.raw || {})) || order.clientData || order.matchedClient;
      if (client && onUpdateRow) {
        const currentDebt = parseCurrency(client['Valor Devido'] || client['VALOR DEVIDO']);
        const pendingTotal = pendingInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
        const newDebt = Math.max(0, currentDebt - pendingTotal);
        const newStatus = newDebt === 0 ? 'Em dia' : client['Status de Pagamento'];

        await onUpdateRow('CLIENTES_CADASTRADOS', client, {
          ...client,
          'Valor Devido': newDebt.toFixed(2).replace('.', ','),
          'Status de Pagamento': newStatus
        });
      }

      // 3. Estorno de Estoque (devolver armação para o estoque se aplicável)
      const armacoesList = data?.['CAD_ARMACOES'] || [];
      const armacaoNome = String(order.raw['ARMAÇÃO'] || order.raw['MODELO'] || order.raw['PRODUTO'] || '').trim().toLowerCase();
      if (armacaoNome && armacaoNome !== '—' && armacaoNome !== 'não informada') {
        const matchedArmacao = armacoesList.find(a => {
          const nomeA = String(a['MODELO'] || a['NOME'] || a['DESCRICAO'] || '').trim().toLowerCase();
          return nomeA && (nomeA === armacaoNome || armacaoNome.includes(nomeA));
        });
        if (matchedArmacao && onUpdateRow) {
          const currStock = parseInt(matchedArmacao['ESTOQUE'] || matchedArmacao['QTD'] || '0', 10);
          await onUpdateRow('CAD_ARMACOES', matchedArmacao, {
            ...matchedArmacao,
            ESTOQUE: String(currStock + 1)
          });
        }
      }

      // 4. Excluir a OS da tabela Registro_Vendas
      await onDeleteRow('Registro_Vendas', order.raw);

      setSuccessToast(`✅ OS #${order.osNumber} excluída com sucesso! ${pendingInvoices.length > 0 ? `${pendingInvoices.length} duplicata(s) pendente(s) cancelada(s) no Financeiro.` : ''}`);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      console.error('Erro ao excluir OS e financeiro:', err);
      alert('Erro ao excluir OS: ' + (err.message || err));
    }
  };

  // Recusar / Cancelar OS (remove duplicatas pendentes e limpa débito do cliente)
  const handleRejectOS = async (order) => {
    if (!order || isVendedor) return;
    const confirmReject = window.confirm(
      `Deseja realmente RECUSAR e CANCELAR a OS #${order.osNumber} (${order.clientName})?\n\nNenhuma duplicata continuará no Financeiro e nenhum débito será cobrado do cliente.`
    );
    if (!confirmReject) return;

    try {
      // Remover quaisquer duplicatas pendentes vinculadas caso já existissem
      const contasReceberList = data?.['CONTAS_RECEBER'] || [];
      const targetOS = String(order.osNumber || '').trim().toLowerCase();
      const pendingInvoices = contasReceberList.filter(inv => {
        return isMatchingOS(inv, targetOS) && inv.STATUS !== 'Recebido' && inv.STATUS !== 'Pago';
      });

      if (onDeleteRow) {
        for (const inv of pendingInvoices) {
          await onDeleteRow('CONTAS_RECEBER', inv);
        }
      }

      // Abater débito do cliente se necessário
      const client = clientsData.find(c => isSameClient(c, order.raw || {})) || order.clientData || order.matchedClient;
      if (client && onUpdateRow && pendingInvoices.length > 0) {
        const currentDebt = parseCurrency(client['Valor Devido'] || client['VALOR DEVIDO']);
        const pendingTotal = pendingInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
        const newDebt = Math.max(0, currentDebt - pendingTotal);
        const newStatus = newDebt === 0 ? 'Em dia' : client['Status de Pagamento'];

        await onUpdateRow('CLIENTES_CADASTRADOS', client, {
          ...client,
          'Valor Devido': newDebt.toFixed(2).replace('.', ','),
          'Status de Pagamento': newStatus
        });
      }

      const todayStr = new Date().toLocaleDateString('pt-BR');
      const updatedRow = {
        ...order.raw,
        STATUS_OS: 'Cancelada',
        SITUAÇÃO: 'Cancelada',
        PAGAMENTO_CONFERIDO: 'Não',
        DUPLICATAS_GERADAS: false,
        DATA_CANCELAMENTO: todayStr,
        CANCELADO_POR: currentUser?.username || 'Administração'
      };
      if (onUpdateRow) {
        await onUpdateRow('Registro_Vendas', order.raw, updatedRow);
      }
      setApprovalModalOrder(null);
      setSuccessToast(`OS #${order.osNumber} foi cancelada. Duplicatas pendentes removidas e financeiro limpo.`);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      console.error('Erro ao cancelar OS:', err);
      alert('Erro ao cancelar OS: ' + err.message);
    }
  };

  // Atualizar Status da OS
  const handleUpdateStatus = (order, newStatus) => {
    if (isVendedor) return;

    if (order.status === "Aguardando Confirmação" && newStatus !== "Aguardando Confirmação") {
      if (newStatus === "Cancelada") {
        handleRejectOS(order);
        return;
      }
      setApprovalModalOrder(order);
      return;
    }

    const isConferido = order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim';
    
    // Bloqueia avanço para produção/entrega se o financeiro ainda não conferiu
    const blockedStatuses = ["Em Produção", "Pronto para Retirada", "Entregue"];
    if (!isConferido && blockedStatuses.includes(newStatus)) {
      alert(`⚠️ Bloqueio Financeiro!\n\nVocê não pode mover esta OS para "${newStatus}".\nO setor Financeiro precisa primeiro confirmar o pagamento / sinal.`);
      return;
    }

    if (newStatus === "Entregue") {
      setDeliveryModalOrder(order);
      setDeliveryDateInput(order.dtEntregaReal ? (order.dtEntregaReal.includes('-') ? order.dtEntregaReal : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]);
      setDeliveryReceiverInput(order.quemRetirou || 'Próprio Cliente');
      setDeliveryNotesInput(order.obsEntrega || '');
      return;
    }

    if (!onUpdateRow) return;
    const updatedRow = {
      ...order.raw,
      STATUS_OS: newStatus,
      SITUAÇÃO: newStatus === "Entregue" ? "Pago" : "Pendente"
    };
    onUpdateRow("Registro_Vendas", order.raw, updatedRow);
  };

  const handleTogglePgtoConferido = (order) => {
    if (!onUpdateRow || isVendedor) return;
    const isConferido = order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim';
    const updatedRow = {
      ...order.raw,
      PAGAMENTO_CONFERIDO: isConferido ? 'Não' : 'Sim'
    };
    onUpdateRow("Registro_Vendas", order.raw, updatedRow);
  };

  // Confirmar Baixa com Data Efetiva de Entrega
  const handleConfirmDelivery = (e) => {
    e.preventDefault();
    if (!deliveryModalOrder || !onUpdateRow || isVendedor) return;

    const chosenDate = deliveryDateInput || new Date().toISOString().split('T')[0];

    const updatedRow = {
      ...deliveryModalOrder.raw,
      STATUS_OS: "Entregue",
      SITUAÇÃO: "Pago",
      DATA_ENTREGA_REAL: chosenDate,
      DATA_BAIXA_ENTREGA: chosenDate,
      DATA_RECEBIMENTO: chosenDate,
      QUEM_RETIROU: deliveryReceiverInput || "Próprio Cliente",
      OBS_ENTREGA: deliveryNotesInput || ""
    };

    onUpdateRow("Registro_Vendas", deliveryModalOrder.raw, updatedRow);
    setDeliveryModalOrder(null);
  };

  // Enviar Mensagem via WhatsApp
  const handleSendWhatsApp = (order) => {
    const cleanPhone = (order.clientPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      alert("Telefone do cliente não encontrado no cadastro.");
      return;
    }
    const fullPhone = cleanPhone.length <= 11 ? ("55" + cleanPhone) : cleanPhone;
    
    let msg = "";
    if (order.status === "Pronto para Retirada") {
      msg = "Olá, *" + order.clientName + "*! Tudo bem? 😊\n\nSeus óculos da *Ordem de Serviço #" + order.osNumber + "* já estão *PRONTOS PARA RETIRADA* na *Yasmin Ótica*! 👓✨\n\nVocê já pode passar na loja para fazer a retirada e ajuste. Aguardamos sua visita! 💜";
    } else if (order.status === "No Laboratório" || order.status === "Em Produção") {
      msg = "Olá, *" + order.clientName + "*! Passando para avisar que sua *Ordem de Serviço #" + order.osNumber + "* na *Yasmin Ótica* está em produção no laboratório óptico. Em breve avisaremos assim que estiver pronto para retirada! 👓✨";
    } else {
      msg = "Olá, *" + order.clientName + "*! Segue a confirmação da sua *Ordem de Serviço #" + order.osNumber + "* na *Yasmin Ótica*. Qualquer dúvida estamos à disposição! 👓✨";
    }

    window.open("https://wa.me/" + fullPhone + "?text=" + encodeURIComponent(msg), "_blank");
  };

  // Impressão da OS
  const handlePrint = (order) => {
    setOsDataForLabPrint(null);
    setPrintLabClient(null);
    const cData = {
      ...order.raw,
      ...(order.clientData || {}),
      "Nome Completo": order.clientName || order.raw?.['CLIENTE'] || order.raw?.['NOME'],
      "WhatsApp": order.clientPhone || order.raw?.['TELEFONE'],
      "Cidade": order.clientCity || order.unit
    };
    setPrintClient(cData);
    setOsDataForPrint({
      numeroOS: order.osNumber,
      selectedCity: order.unit,
      unidade: order.unit,
      medico: order.raw["MEDICO"] || "",
      lente: order.lente || order.raw["LENTE"] || order.product,
      armacao: order.armacao || order.raw["ARMAÇÃO"] || "",
      valorTotal: order.valorTotal,
      valorEntrada: order.raw["VALOR ENTRADA"] || "0,00",
      restante: order.raw["RESTANTE"] || "0,00",
      dataEntrega: order.dtEntrega,
      formasPagamento: cleanBoletoDisplay(order.raw["FORMAS_PAGAMENTO"] || order.raw["MEIO_PAGAMENTO"] || ""),
      observacoes: order.raw["OBSERVACOES"] || order.obsEntrega || "",
      odEsf: order.odEsf || order.raw["OD_ESF"] || "",
      odCil: order.odCil || order.raw["OD_CIL"] || "",
      odEixo: order.odEixo || order.raw["OD_EIXO"] || "",
      odDnp: order.odDnp || order.raw["OD_DNP"] || "",
      odAlt: order.odAlt || order.raw["OD_ALT"] || "",
      oeEsf: order.oeEsf || order.raw["OE_ESF"] || "",
      oeCil: order.oeCil || order.raw["OE_CIL"] || "",
      oeEixo: order.oeEixo || order.raw["OE_EIXO"] || "",
      oeDnp: order.oeDnp || order.raw["OE_DNP"] || "",
      oeAlt: order.oeAlt || order.raw["OE_ALT"] || "",
      adicao: order.adicao || order.raw["ADICAO"] || ""
    });

    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintLab = (order) => {
    setLabModalOrder(order);
    setLabFormData({
      LABORATORIO: order.laboratorio || order.raw["LABORATORIO"] || "",
      OD_ESF: order.odEsf || order.raw["OD_ESF"] || "",
      OD_CIL: order.odCil || order.raw["OD_CIL"] || "",
      OD_EIXO: order.odEixo || order.raw["OD_EIXO"] || "",
      OE_ESF: order.oeEsf || order.raw["OE_ESF"] || "",
      OE_CIL: order.oeCil || order.raw["OE_CIL"] || "",
      OE_EIXO: order.oeEixo || order.raw["OE_EIXO"] || "",
      ADICAO: order.adicao || order.raw["ADICAO"] || "",
      OD_DNP: order.odDnp || order.raw["OD_DNP"] || "",
      OD_ALT: order.odAlt || order.raw["OD_ALT"] || "",
      OE_DNP: order.oeDnp || order.raw["OE_DNP"] || "",
      OE_ALT: order.oeAlt || order.raw["OE_ALT"] || "",
      PONTE_ARO: order.raw["PONTE_ARO"] || "",
      DIAGONAL_MAIOR: order.raw["DIAGONAL_MAIOR"] || "",
      ALTURA_VERTICAL: order.raw["ALTURA_VERTICAL"] || "",
      PONTE: order.raw["PONTE"] || "",
      ARO: order.raw["ARO"] || ""
    });
  };

  const handleConfirmLabPrint = (e) => {
    e.preventDefault();
    if (!labModalOrder) return;
    
    // Atualizar dados na OS atual
    const order = labModalOrder;
    const updatedRaw = {
      ...order.raw,
      ...labFormData
    };
    
    if (onUpdateRow && !isVendedor) {
      onUpdateRow("Registro_Vendas", order.raw, updatedRaw);
    }
    
    // Preparar impressão usando updatedRaw
    setOsDataForPrint(null);
    setPrintClient(null);
    const cData = {
      ...updatedRaw,
      ...(order.clientData || {}),
      "Nome Completo": order.clientName || updatedRaw?.['CLIENTE'] || updatedRaw?.['NOME'],
      "WhatsApp": order.clientPhone || updatedRaw?.['TELEFONE'],
      "Cidade": order.clientCity || order.unit
    };
    setPrintLabClient(cData);
    setOsDataForLabPrint({
      raw: updatedRaw,
      numeroOS: order.osNumber,
      selectedCity: order.unit,
      unidade: order.unit,
      laboratorio: updatedRaw["LABORATORIO"] || "",
      medico: updatedRaw["MEDICO"] || "",
      lente: order.lente || updatedRaw["LENTE"] || order.product,
      armacao: order.armacao || updatedRaw["ARMAÇÃO"] || "",
      valorTotal: order.valorTotal,
      valorEntrada: updatedRaw["VALOR ENTRADA"] || "0,00",
      restante: updatedRaw["RESTANTE"] || "0,00",
      dataEntrega: order.dtEntrega,
      formasPagamento: cleanBoletoDisplay(updatedRaw["FORMAS_PAGAMENTO"] || updatedRaw["MEIO_PAGAMENTO"] || ""),
      observacoes: updatedRaw["OBSERVACOES"] || order.obsEntrega || "",
      odEsf: updatedRaw["OD_ESF"] || "",
      odCil: updatedRaw["OD_CIL"] || "",
      odEixo: updatedRaw["OD_EIXO"] || "",
      odDnp: updatedRaw["OD_DNP"] || "",
      odAlt: updatedRaw["OD_ALT"] || "",
      oeEsf: updatedRaw["OE_ESF"] || "",
      oeCil: updatedRaw["OE_CIL"] || "",
      oeEixo: updatedRaw["OE_EIXO"] || "",
      oeDnp: updatedRaw["OE_DNP"] || "",
      oeAlt: updatedRaw["OE_ALT"] || "",
      adicao: updatedRaw["ADICAO"] || ""
    });

    setLabModalOrder(null);

    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Localiza todas as Ordens de Serviço vinculadas da mesma venda com cobrança unificada
  const getLinkedOrdersForSale = (order) => {
    if (!order) return [];
    const linkedNumbers = Array.isArray(order.allLinkedOS) ? order.allLinkedOS : [];
    const targetSaleId = order.saleId || order.parentSaleId;
    
    const matches = allOrders.filter(o => {
      if (o.id === order.id || o.osNumber === order.osNumber) return true;
      if (targetSaleId && (o.saleId === targetSaleId || o.parentSaleId === targetSaleId)) return true;
      if (linkedNumbers.length > 0 && linkedNumbers.includes(o.osNumber)) return true;
      if (Array.isArray(o.allLinkedOS) && o.allLinkedOS.includes(order.osNumber)) return true;
      const baseThis = String(order.osNumber).replace(/-\d+$/, '');
      const baseOther = String(o.osNumber).replace(/-\d+$/, '');
      if (baseThis && baseThis === baseOther && (order.isMultiOS || o.isMultiOS || /-\d+$/.test(order.osNumber))) return true;
      return false;
    });

    const unique = [];
    const seen = new Set();
    for (const item of matches) {
      const key = item.osNumber || item.id;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique.sort((a, b) => (a.osIndex || 1) - (b.osIndex || 1));
  };

  // Impressão em lote de todas as OSs vinculadas à mesma venda (várias páginas A4)
  const handlePrintAllOS = (order) => {
    const linked = getLinkedOrdersForSale(order);
    const ordersToPrint = linked.length > 0 ? linked : [order];
    
    setOsDataForLabPrint(null);
    setPrintLabClient(null);

    const primary = ordersToPrint[0];
    const cData = {
      ...primary.raw,
      ...(primary.clientData || {}),
      "Nome Completo": primary.clientName || primary.raw?.['CLIENTE'] || primary.raw?.['NOME'],
      "WhatsApp": primary.clientPhone || primary.raw?.['TELEFONE'],
      "Cidade": primary.clientCity || primary.unit
    };
    setPrintClient(cData);

    const mappedMulti = ordersToPrint.map((o, idx) => ({
      ...o.raw,
      numeroOS: o.osNumber,
      selectedCity: o.unit,
      unidade: o.unit,
      medico: o.medico || o.raw?.["MEDICO"] || "",
      lente: o.lente || o.raw?.["LENTE"] || o.product,
      armacao: o.armacao || o.raw?.["ARMAÇÃO"] || "",
      valorTotal: o.valorTotal,
      valorEntrada: o.raw?.["VALOR ENTRADA"] || "0,00",
      restante: o.raw?.["RESTANTE"] || "0,00",
      dataEntrega: o.dtEntrega,
      formasPagamento: cleanBoletoDisplay(o.raw?.["FORMAS_PAGAMENTO"] || o.raw?.["MEIO_PAGAMENTO"] || ""),
      observacoes: o.raw?.["OBSERVACOES"] || o.obsEntrega || "",
      odEsf: o.odEsf || o.raw?.["OD_ESF"] || "",
      odCil: o.odCil || o.raw?.["OD_CIL"] || "",
      odEixo: o.odEixo || o.raw?.["OD_EIXO"] || "",
      odDnp: o.odDnp || o.raw?.["OD_DNP"] || "",
      odAlt: o.odAlt || o.raw?.["OD_ALT"] || "",
      oeEsf: o.oeEsf || o.raw?.["OE_ESF"] || "",
      oeCil: o.oeCil || o.raw?.["OE_CIL"] || "",
      oeEixo: o.oeEixo || o.raw?.["OE_EIXO"] || "",
      oeDnp: o.oeDnp || o.raw?.["OE_DNP"] || "",
      oeAlt: o.oeAlt || o.raw?.["OE_ALT"] || "",
      adicao: o.adicao || o.raw?.["ADICAO"] || "",
      osIndex: o.osIndex || (idx + 1),
      totalOS: ordersToPrint.length,
      isMultiOS: true,
      clientData: cData
    }));

    setOsDataForPrint({
      ...mappedMulti[0],
      multiOrders: mappedMulti
    });

    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Impressão em lote de todas as fichas de laboratório vinculadas
  const handlePrintAllLab = (order) => {
    const linked = getLinkedOrdersForSale(order);
    const ordersToPrint = linked.length > 0 ? linked : [order];

    setOsDataForPrint(null);
    setPrintClient(null);

    const primary = ordersToPrint[0];
    const cData = {
      ...primary.raw,
      ...(primary.clientData || {}),
      "Nome Completo": primary.clientName || primary.raw?.['CLIENTE'] || primary.raw?.['NOME'],
      "WhatsApp": primary.clientPhone || primary.raw?.['TELEFONE'],
      "Cidade": primary.clientCity || primary.unit
    };
    setPrintLabClient(cData);

    const mappedMulti = ordersToPrint.map((o, idx) => ({
      raw: o.raw,
      numeroOS: o.osNumber,
      selectedCity: o.unit,
      unidade: o.unit,
      laboratorio: o.laboratorio || o.raw?.["LABORATORIO"] || "",
      medico: o.medico || o.raw?.["MEDICO"] || "",
      lente: o.lente || o.raw?.["LENTE"] || o.product,
      armacao: o.armacao || o.raw?.["ARMAÇÃO"] || "",
      valorTotal: o.valorTotal,
      valorEntrada: o.raw?.["VALOR ENTRADA"] || "0,00",
      restante: o.raw?.["RESTANTE"] || "0,00",
      dataEntrega: o.dtEntrega,
      formasPagamento: cleanBoletoDisplay(o.raw?.["FORMAS_PAGAMENTO"] || o.raw?.["MEIO_PAGAMENTO"] || ""),
      observacoes: o.raw?.["OBSERVACOES"] || o.obsEntrega || "",
      odEsf: o.odEsf || o.raw?.["OD_ESF"] || "",
      odCil: o.odCil || o.raw?.["OD_CIL"] || "",
      odEixo: o.odEixo || o.raw?.["OD_EIXO"] || "",
      odDnp: o.odDnp || o.raw?.["OD_DNP"] || "",
      odAlt: o.odAlt || o.raw?.["OD_ALT"] || "",
      oeEsf: o.oeEsf || o.raw?.["OE_ESF"] || "",
      oeCil: o.oeCil || o.raw?.["OE_CIL"] || "",
      oeEixo: o.oeEixo || o.raw?.["OE_EIXO"] || "",
      oeDnp: o.oeDnp || o.raw?.["OE_DNP"] || "",
      oeAlt: o.oeAlt || o.raw?.["OE_ALT"] || "",
      adicao: o.adicao || o.raw?.["ADICAO"] || "",
      osIndex: o.osIndex || (idx + 1),
      totalOS: ordersToPrint.length,
      isMultiOS: true
    }));

    setOsDataForLabPrint({
      ...mappedMulti[0],
      multiOrders: mappedMulti
    });

    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Impressão em lote de etiquetas térmicas de todas as OSs vinculadas
  const handlePrintAllLabels = (order) => {
    const linked = getLinkedOrdersForSale(order);
    const ordersToPrint = linked.length > 0 ? linked : [order];
    const clientMatch = clientsData.find(c => isSameClient(c, {
      'Nome Completo': order.clientName,
      'WhatsApp': order.clientPhone,
      'CPF / CNPJ': order.clientCPF
    })) || {};

    const multiItems = ordersToPrint.map((o, idx) => ({
      ...clientMatch,
      ...o.raw,
      numeroOS: o.osNumber,
      osNumber: o.osNumber,
      clientName: o.clientName,
      armacao: o.armacao,
      lente: o.lente,
      unidade: o.unit,
      dtEntrega: formatDate(o.dtEntrega),
      odEsf: o.odEsf || o.raw?.OD_ESF || o.raw?.odEsf || clientMatch?.['OD_ESF'] || '',
      odCil: o.odCil || o.raw?.OD_CIL || o.raw?.odCil || clientMatch?.['OD_CIL'] || '',
      odEixo: o.odEixo || o.raw?.OD_EIXO || o.raw?.odEixo || clientMatch?.['OD_EIXO'] || '',
      odDnp: o.odDnp || o.raw?.OD_DNP || o.raw?.odDnp || clientMatch?.['OD_DNP'] || '',
      odAlt: o.odAlt || o.raw?.OD_ALT || o.raw?.odAlt || clientMatch?.['OD_ALT'] || '',
      oeEsf: o.oeEsf || o.raw?.OE_ESF || o.raw?.oeEsf || clientMatch?.['OE_ESF'] || '',
      oeCil: o.oeCil || o.raw?.OE_CIL || o.raw?.oeCil || clientMatch?.['OE_CIL'] || '',
      oeEixo: o.oeEixo || o.raw?.OE_EIXO || o.raw?.oeEixo || clientMatch?.['OE_EIXO'] || '',
      oeDnp: o.oeDnp || o.raw?.OE_DNP || o.raw?.oeDnp || clientMatch?.['OE_DNP'] || '',
      oeAlt: o.oeAlt || o.raw?.OE_ALT || o.raw?.oeAlt || clientMatch?.['OE_ALT'] || '',
      adicao: o.adicao || o.raw?.ADICAO || o.raw?.adicao || clientMatch?.['ADICAO'] || '',
      osIndex: o.osIndex || (idx + 1),
      totalOS: ordersToPrint.length
    }));

    setLabelModalData({
      ...multiItems[0],
      multiItems
    });
  };

  return (
    <div className="space-y-8 font-sans pb-24">
      
      {/* ─── CABEÇALHO DA ABA ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 glass-card hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-pink-500/20 text-pink-400 border border-pink-500/30">
                {isAdmin ? 'Painel Administrativo' : 'Atendimento & Vendas'}
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2 sm:gap-3 mt-1">
              <ClipboardList className="text-pink-400 shrink-0" size={28} />
              Gestão de Ordens de Serviço (OS)
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Controle de produção, prazos e status do laboratório com sinalização visual Verde, Amarela e Vermelha.
            </p>
          </div>
        </div>

        {/* Filtro por Loja / Unidade */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/10 self-start md:self-auto overflow-x-auto erp-scroll max-w-full">
          <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1 shrink-0">
            <MapPin size={13} className="text-pink-400" /> Loja:
          </span>
          {[
            { id: "ALL", label: "Todas" },
            { id: "Cajati", label: "Cajati" },
            { id: "Registro", label: "Registro" },
            { id: "Jacupiranga", label: "Jacupiranga" },
            { id: "Venda Externa", label: "Venda Ext." }
          ].map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUnit(u.id)}
              className={"px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 " + (
                selectedUnit === u.id
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CARDS DE STATUS COM CORES PADRÃO (AZUL, VERDE, AMARELA E VERMELHA) ─── */}
      <div className="flex overflow-x-auto snap-x pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3 erp-scroll">
        
        {/* Total Geral */}
        <div 
          onClick={() => setSelectedStatusFilter("ALL")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "ALL" ? "border-sky-500 ring-2 ring-sky-500/30" : "border-white/5 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de OS</span>
            <ClipboardList size={16} className="text-sky-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.total}</p>
          <p className="text-[10px] text-slate-500 font-bold mt-1">Todas as emitidas</p>
        </div>

        {/* Azul: Aguardando Confirmação */}
        <div 
          onClick={() => setSelectedStatusFilter("Aguardando Confirmação")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "Aguardando Confirmação" 
              ? "border-sky-500 ring-2 ring-sky-500/40 bg-sky-500/10 shadow-[0_0_15px_rgba(14,165,233,0.25)]" 
              : "border-white/5 hover:border-sky-500/30"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-1">
              🔵 Aguardando Conf.
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-sky-300">{stats.aguardandoConfirmacao}</p>
          <p className="text-[10px] text-sky-400/80 font-bold mt-1">Conferência Pgto</p>
        </div>

        {/* Vermelho: No Laboratório */}
        <div 
          onClick={() => setSelectedStatusFilter("No Laboratório")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "No Laboratório" ? "border-rose-500 ring-2 ring-rose-500/30" : "border-white/5 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1">
              🔴 No Laboratório
            </span>
            <Clock size={16} className="text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-300">{stats.noLab}</p>
          <p className="text-[10px] text-rose-400/70 font-bold mt-1">Aguardando fabricação</p>
        </div>

        {/* Amarelo: Em Produção */}
        <div 
          onClick={() => setSelectedStatusFilter("Em Produção")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "Em Produção" ? "border-amber-500 ring-2 ring-amber-500/30" : "border-white/5 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
              🟡 Em Produção
            </span>
            <RefreshCw size={16} className="text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-300">{stats.emProducao}</p>
          <p className="text-[10px] text-amber-400/70 font-bold mt-1">Montagem de óculos</p>
        </div>

        {/* Amarelo: Pronto para Retirada */}
        <div 
          onClick={() => setSelectedStatusFilter("Pronto para Retirada")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "Pronto para Retirada" ? "border-yellow-500 ring-2 ring-yellow-500/30" : "border-white/5 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400 flex items-center gap-1">
              🟡 Pronto Retirada
            </span>
            <Sparkles size={16} className="text-yellow-400" />
          </div>
          <p className="text-2xl font-black text-yellow-300">{stats.pronto}</p>
          <p className="text-[10px] text-yellow-400/70 font-bold mt-1">Aguardando cliente</p>
        </div>

        {/* Verde: Entregue */}
        <div 
          onClick={() => setSelectedStatusFilter("Entregue")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "Entregue" ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-white/5 hover:border-white/20"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              🟢 Entregue
            </span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-300">{stats.entregues}</p>
          <p className="text-[10px] text-emerald-400/70 font-bold mt-1">Finalizadas com sucesso</p>
        </div>

        {/* Vermelho Alerta: Atrasadas */}
        <div 
          onClick={() => setSelectedStatusFilter("DELAYED")}
          className={"glass-card p-4 rounded-2xl cursor-pointer transition-all border shrink-0 min-w-[150px] sm:min-w-0 snap-start " + (
            selectedStatusFilter === "DELAYED" ? "border-red-500 ring-2 ring-red-500/40 bg-red-500/10" : "border-red-500/30 hover:border-red-500/50"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1">
              🚨 Atrasadas
            </span>
            <AlertCircle size={16} className="text-red-400 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-red-300">{stats.atrasadas}</p>
          <p className="text-[10px] text-red-400 font-bold mt-1">Passaram da previsão</p>
        </div>

      </div>

      {/* ─── BARRA DE PESQUISA & CONTROLES DE VISUALIZAÇÃO ─── */}
      <div className="glass-card p-4 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1 max-w-xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por OS, Cliente, CPF, Telefone, Lente ou Armação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-pink-500/50 shadow-inner"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              title="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 justify-between lg:justify-end">
          {selectedStatusFilter !== "ALL" && (
            <button 
              onClick={() => setSelectedStatusFilter("ALL")}
              className="text-xs text-rose-300 hover:text-white px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 transition-all font-bold"
            >
              Limpar Filtro ({selectedStatusFilter}) ✕
            </button>
          )}

          {/* Alternador de Modo de Visualização */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "cards"
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Exibir informações detalhadas abaixo de cada OS"
            >
              <LayoutGrid size={14} />
              <span>Informações Abaixo</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Exibir em formato de tabela"
            >
              <TableIcon size={14} />
              <span>Tabela</span>
            </button>
          </div>

          {/* Botão Expandir / Recolher Todos */}
          <button
            type="button"
            onClick={() => {
              if (Object.keys(collapsedOrders).length > 0) {
                expandAll();
              } else {
                collapseAll(filteredOrders);
              }
            }}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-bold"
            title={Object.keys(collapsedOrders).length > 0 ? "Expandir todas as informações abaixo" : "Recolher todas as informações"}
          >
            {Object.keys(collapsedOrders).length > 0 ? (
              <>
                <ChevronDown size={14} /> Expandir Todos
              </>
            ) : (
              <>
                <ChevronUp size={14} /> Recolher Todos
              </>
            )}
          </button>

          <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            {filteredOrders.length} {filteredOrders.length === 1 ? "OS" : "OSs"}
          </span>
        </div>
      </div>

      {/* ─── LISTAGEM DE ORDENS DE SERVIÇO ─── */}
      {filteredOrders.length > 0 ? (
        viewMode === "cards" ? (
          /* ─── MODO CARDS: INFORMAÇÕES APARECENDO ABAIXO (RECOMENDADO / PADRÃO) ─── */
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const statusConf = OS_STATUS_CONFIG[order.status] || OS_STATUS_CONFIG["No Laboratório"];
              const isCollapsed = Boolean(collapsedOrders[order.id]);
              const hasDetailedDioptria = Boolean(
                order.odEsf || order.odCil || order.odEixo || 
                order.oeEsf || order.oeCil || order.oeEixo || 
                order.adicao
              );

              return (
                <div 
                  key={order.id} 
                  className="glass-card rounded-2xl border border-white/10 hover:border-pink-500/30 transition-all shadow-2xl overflow-hidden bg-[#0d1322]/80"
                >
                  {/* Cabeçalho Principal da OS */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/5 bg-white/[0.02]">
                    
                    {/* Esquerda: Identificação, Unidade, Prazo e Cliente */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCollapse(order.id)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5"
                        title={isCollapsed ? "Exibir informações abaixo" : "Ocultar informações abaixo"}
                      >
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                      </button>

                      {/* Nº OS */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base sm:text-lg text-pink-400 bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-xl shadow-inner">
                          #{order.osNumber}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 border border-white/10">
                          {order.unit}
                        </span>
                        {order.isMultiOS && (
                          <span 
                            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"
                            title={`Venda com Múltiplas OS (${order.osIndex}/${order.totalOS})`}
                          >
                            <span className="text-xs">🔗</span> OS {order.osIndex}/{order.totalOS}
                          </span>
                        )}
                        {(order.isSecondaryOS || order.financeiroUnificado) && (
                          <span 
                            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            title="Cobrança Unificada na Venda Principal"
                          >
                            Cobrança Unificada
                          </span>
                        )}
                        {order.voucher && (
                          <span 
                            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-xs"
                            title={`Voucher utilizado: ${order.voucher}${order.descontoVoucher ? ` | Desconto: R$ ${formatMoney(order.descontoVoucher)}` : ''}`}
                          >
                            <span>🎟️</span> Voucher: {order.voucher} {parseCurrency(order.descontoVoucher) > 0 ? `(-R$ ${formatMoney(order.descontoVoucher)})` : ''}
                          </span>
                        )}
                      </div>

                      {/* Badge de Prazo */}
                      {order.status === "Entregue" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 size={13} /> Entregue ao Cliente
                        </span>
                      ) : order.isDelayed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-400 bg-red-500/15 border border-red-500/40 px-2.5 py-1 rounded-lg animate-pulse">
                          <AlertTriangle size={13} /> Atrasada ({order.deadlineInfo?.text || "Passou do prazo"})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          <Clock size={13} /> {order.deadlineInfo?.text || "No Prazo"}
                        </span>
                      )}

                      {/* Separador vertical sutil */}
                      <div className="hidden md:block h-6 w-px bg-white/10 mx-1" />

                      {/* Dados do Cliente */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-base tracking-wide">
                          {order.clientName}
                        </span>
                        {order.clientPhone && (
                          <a
                            href={`https://wa.me/55${order.clientPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all font-mono"
                            title="Conversar no WhatsApp"
                          >
                            <Phone size={11} /> {order.clientPhone}
                          </a>
                        )}
                        {order.clientCPF && (
                          <span className="text-xs text-slate-400 font-mono">
                            CPF: {formatCPF_CNPJ(order.clientCPF)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Direita: Status da Produção & Ações Rápidas */}
                    <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
                      
                      {/* Seletor de Status (Semáforo) */}
                      <div className="flex items-center gap-1.5">
                        {isVendedor ? (
                          <span 
                            className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider rounded-xl px-3 py-2 border cursor-default select-none ${statusConf.badgeClass}`}
                            title="Vendedor: Somente visualização. Alterações de status são restritas à administração."
                          >
                            <span className={`w-2 h-2 rounded-full ${statusConf.dotClass}`} />
                            <span>{statusConf.icon} {statusConf.label}</span>
                          </span>
                        ) : (
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateStatus(order, e.target.value)}
                            className={`text-xs font-black uppercase tracking-wider rounded-xl px-3 py-2 border cursor-pointer focus:outline-none transition-all ${statusConf.badgeClass}`}
                          >
                            <option value="Aguardando Confirmação" className="bg-slate-900 text-sky-300 font-bold">
                              🔵 Aguardando Confirmação (Azul)
                            </option>
                            <option value="No Laboratório" className="bg-slate-900 text-rose-300 font-bold">
                              🔴 No Laboratório (Vermelho)
                            </option>
                            <option value="Aguardando Lente" className="bg-slate-900 text-rose-300 font-bold">
                              🔴 Aguardando Lente (Vermelho)
                            </option>
                            <option value="Em Produção" className="bg-slate-900 text-amber-300 font-bold">
                              🟡 Em Produção / Montagem (Amarelo)
                            </option>
                            <option value="Pronto para Retirada" className="bg-slate-900 text-yellow-300 font-bold">
                              🟡 Pronto para Retirada (Amarelo)
                            </option>
                            <option value="Entregue" className="bg-slate-900 text-emerald-300 font-bold">
                              🟢 Entregue ao Cliente (Verde)
                            </option>
                            <option value="Cancelada" className="bg-slate-900 text-slate-400 font-bold">
                              ⚫ Cancelada
                            </option>
                          </select>
                        )}
                        
                        {order.status !== "Aguardando Confirmação" && (
                          isVendedor ? (
                            <div 
                              className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border transition-all w-full justify-center select-none cursor-default ${
                                (order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                              title="Conferência Financeira (Apenas visualização para vendedores)"
                            >
                              {(order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') ? (
                                <><CheckCircle2 size={14}/> Liberação Financeira OK</>
                              ) : (
                                <><DollarSign size={14}/> Pendente Financeiro</>
                              )}
                            </div>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => handleTogglePgtoConferido(order)}
                              className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border transition-all w-full justify-center ${
                                (order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                            >
                              {(order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') ? (
                                <><CheckCircle2 size={14}/> Liberação Financeira OK</>
                              ) : (
                                <><DollarSign size={14}/> Pendente Financeiro</>
                              )}
                            </button>
                          )
                        )}

                        {order.status === "Entregue" && !isVendedor && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeliveryModalOrder(order);
                              setDeliveryDateInput(order.dtEntregaReal ? (order.dtEntregaReal.includes('-') ? order.dtEntregaReal : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]);
                              setDeliveryReceiverInput(order.quemRetirou || 'Próprio Cliente');
                              setDeliveryNotesInput(order.obsEntrega || '');
                            }}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 transition-all font-bold flex items-center gap-1"
                            title="Alterar data ou detalhes de entrega"
                          >
                            <PackageCheck size={13} />
                            <span>Baixa</span>
                          </button>
                        )}
                      </div>

                      {/* Botões de Ações Rápidas */}
                      <div className="flex items-center gap-1.5">
                        {order.clientPhone && (
                          <button
                            onClick={() => handleSendWhatsApp(order)}
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors border border-emerald-500/20 flex items-center gap-1 text-xs font-bold"
                            title="Enviar aviso para o WhatsApp do Cliente"
                          >
                            <MessageCircle size={15} />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>
                        )}

                        <button
                          onClick={() => handlePrint(order)}
                          className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl transition-colors border border-sky-500/20 flex items-center gap-1 text-xs font-bold"
                          title="Imprimir Ordem de Serviço Oficial"
                        >
                          <Printer size={15} />
                          <span className="hidden sm:inline">Imprimir OS</span>
                        </button>

                        {order.isMultiOS && (
                          <button
                            onClick={() => handlePrintAllOS(order)}
                            className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl transition-colors border border-indigo-500/40 flex items-center gap-1 text-xs font-black shadow-sm"
                            title={`Imprimir Todas as ${order.totalOS || 'Múltiplas'} OSs Desta Venda de Uma Só Vez`}
                          >
                            <Printer size={15} />
                            <span className="hidden sm:inline">Todas OSs ({order.totalOS})</span>
                          </button>
                        )}

                        {order.status !== "Aguardando Confirmação" && order.status !== "Cancelada" && (
                          <>
                            <button
                              onClick={() => handlePrintLab(order)}
                              className="p-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 rounded-xl transition-colors border border-fuchsia-500/20 flex items-center gap-1 text-xs font-bold"
                              title="Imprimir OS de Laboratório"
                            >
                              <FlaskConical size={15} />
                              <span className="hidden sm:inline">OS Lab</span>
                            </button>
                            {order.isMultiOS && (
                              <button
                                onClick={() => handlePrintAllLab(order)}
                                className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl transition-colors border border-purple-500/40 flex items-center gap-1 text-xs font-black shadow-sm"
                                title={`Imprimir Todos os Labs das ${order.totalOS} OSs vinculadas`}
                              >
                                <FlaskConical size={15} />
                                <span className="hidden sm:inline">Todos Labs ({order.totalOS})</span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => openLabelModal(order)}
                          className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-colors border border-amber-500/20 flex items-center gap-1 text-xs font-bold"
                          title="Imprimir Etiqueta Térmica do Envelope Lab (50x30mm)"
                        >
                          <Tag size={15} />
                          <span className="hidden sm:inline">Etiqueta Lab</span>
                        </button>

                        {order.isMultiOS && (
                          <button
                            onClick={() => handlePrintAllLabels(order)}
                            className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl transition-colors border border-amber-500/40 flex items-center gap-1 text-xs font-black shadow-sm"
                            title={`Imprimir Todas as Etiquetas das ${order.totalOS} OSs vinculadas`}
                          >
                            <Tag size={15} />
                            <span className="hidden sm:inline">Todas Etiquetas</span>
                          </button>
                        )}

                        {isAdmin && onDeleteRow && (
                          <button
                            onClick={() => handleDeleteOS(order)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 rounded-xl transition-colors border border-rose-500/20"
                            title="Excluir OS e Financeiro Vinculado (Somente Admin)"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* ALERTA & AÇÕES DE CONFERÊNCIA FINANCEIRA PARA STATUS AZUL */}
                  {order.status === "Aguardando Confirmação" && (
                    <div className="mx-4 sm:mx-5 my-3 p-4 rounded-2xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 border border-sky-500/40 shadow-lg shadow-sky-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                          <DollarSign size={22} className="animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-sky-300">
                              Aguardando Confirmação Financeira
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Semáforo Azul 🔵
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            {isVendedor
                              ? "Esta OS está sob análise do setor financeiro. A montagem será liberada após a conferência."
                              : "O financeiro deve conferir o pagamento para gerar as duplicatas no sistema e liberar a montagem dos óculos."}
                          </p>
                        </div>
                      </div>

                      {!isVendedor ? (
                        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                          <button
                            type="button"
                            onClick={() => handleRejectOS(order)}
                            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition-all flex items-center gap-1.5"
                            title="Recusar e cancelar OS (não gera duplicatas)"
                          >
                            <XCircle size={15} />
                            <span>Recusar OS</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setApprovalModalOrder(order)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                            title="Conferir pagamento, gerar duplicatas no financeiro e liberar montagem"
                          >
                            <ShieldCheck size={16} />
                            <span>Confirmar Pagamento & Liberar Montagem</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                          <span className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-1.5">
                            <Clock size={14} className="text-sky-400" />
                            Aguardando liberação do Financeiro
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── INFORMAÇÕES APARECENDO ABAIXO (GRID ESTRUTURADO) ─── */}
                  {!isCollapsed && (
                    <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-black/20 animate-in fade-in duration-150">
                      
                      {/* Bloco 1: Armação & Lente (Produto) */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-pink-400 border-b border-white/5 pb-2">
                          <Glasses size={16} />
                          <span>Armação & Lente</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-0.5">
                              Armação
                            </span>
                            <p className="text-white font-bold leading-snug">
                              {order.armacao || "Armação própria do cliente"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block mb-0.5">
                              Lente
                            </span>
                            <p className="text-indigo-200 font-bold leading-snug">
                              {order.lente || order.product || "Lente oftálmica"}
                            </p>
                          </div>
                          {order.laboratorio && (
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block mb-0.5">
                                Laboratório Óptico
                              </span>
                              <p className="text-cyan-300 font-medium">
                                {order.laboratorio}
                              </p>
                            </div>
                          )}
                          {order.medico && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                Médico / Optometrista
                              </span>
                              <p className="text-slate-300">
                                {order.medico}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloco 2: Prescrição Óptica & Dioptrias */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-cyan-400 border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <Eye size={16} />
                            <span>Prescrição Óptica</span>
                          </div>
                          {order.adicao && (
                            <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-mono font-bold">
                              Adição: +{order.adicao}
                            </span>
                          )}
                        </div>

                        {hasDetailedDioptria ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-center text-[11px] font-mono border-collapse">
                              <thead>
                                <tr className="text-[9px] uppercase tracking-wider text-slate-400 bg-white/5">
                                  <th className="py-1 px-1 text-left">Olho</th>
                                  <th className="py-1 px-1">Esf</th>
                                  <th className="py-1 px-1">Cil</th>
                                  <th className="py-1 px-1">Eixo</th>
                                  <th className="py-1 px-1">DNP</th>
                                  <th className="py-1 px-1">Alt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                <tr className="hover:bg-white/[0.02]">
                                  <td className="py-1 px-1 text-left font-bold text-cyan-300">OD</td>
                                  <td className="py-1 px-1 text-white font-bold">{order.odEsf || '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.odCil || '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.odEixo ? `${order.odEixo}°` : '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.odDnp || '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.odAlt || '—'}</td>
                                </tr>
                                <tr className="hover:bg-white/[0.02]">
                                  <td className="py-1 px-1 text-left font-bold text-cyan-300">OE</td>
                                  <td className="py-1 px-1 text-white font-bold">{order.oeEsf || '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.oeCil || '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.oeEixo ? `${order.oeEixo}°` : '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.oeDnp || '—'}</td>
                                  <td className="py-1 px-1 text-slate-300">{order.oeAlt || '—'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ) : order.dioptria ? (
                          <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-xs font-mono text-cyan-200 space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Dioptria Consolidada:</span>
                            <p className="font-bold">{order.dioptria}</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-slate-400 italic">
                            Sem prescrição detalhada anexada nesta OS
                          </div>
                        )}
                      </div>

                      {/* Bloco 3: Datas & Prazos */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 border-b border-white/5 pb-2">
                          <Calendar size={16} />
                          <span>Datas & Prazos</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                            <span className="text-slate-400">Data da Venda:</span>
                            <span className="text-white font-bold">{formatDate(order.dtVenda)}</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                            <span className="text-slate-400">Previsão de Entrega:</span>
                            <span className={order.isDelayed ? "text-rose-400 font-black" : "text-amber-300 font-bold"}>
                              {formatDate(order.dtEntrega)}
                            </span>
                          </div>
                          {order.status === "Entregue" && (
                            <div className="py-1 text-emerald-400 space-y-0.5 border-b border-white/5">
                              <div className="flex justify-between items-center">
                                <span className="text-emerald-400/80">Baixa Realizada:</span>
                                <span className="font-bold">{formatDate(order.dtEntregaReal || order.dtEntrega)}</span>
                              </div>
                              {order.quemRetirou && (
                                <p className="text-[11px] text-slate-300">
                                  <span className="text-slate-500">Retirado por:</span> {order.quemRetirou}
                                </p>
                              )}
                            </div>
                          )}
                          {order.obsEntrega && (
                            <div className="pt-1 text-[11px] text-slate-300 italic bg-white/[0.02] p-2 rounded-lg border border-white/5">
                              "{order.obsEntrega}"
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloco 4: Financeiro & Pagamento */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-400 border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <CreditCard size={16} />
                            <span>Financeiro</span>
                          </div>
                          <span className="text-base font-black text-white">
                            R$ {formatMoney(order.valorTotal)}
                          </span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                            <span className="text-slate-400">Sinal / Entrada:</span>
                            <span className="text-emerald-400 font-bold">R$ {formatMoney(order.valorEntrada)}</span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
                            <span className="text-slate-400">Saldo Restante:</span>
                            {parseCurrency(order.restante) > 0 ? (
                              <span className="text-rose-400 font-black">R$ {formatMoney(order.restante)}</span>
                            ) : (
                              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                                ✓ 100% Quitado
                              </span>
                            )}
                          </div>
                          {order.voucher && (
                            <div className="flex justify-between items-center py-1 border-b border-white/5 bg-emerald-500/10 px-2 rounded-lg">
                              <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">🎟️ Voucher: {order.voucher}</span>
                              <span className="text-emerald-300 font-black text-xs">
                                {parseCurrency(order.descontoVoucher) > 0 ? `-R$ ${formatMoney(order.descontoVoucher)}` : 'Aplicado'}
                              </span>
                            </div>
                          )}
                          {order.formasPagamento && (
                            <div className="pt-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                Condições / Vencimentos:
                              </span>
                              <p className="text-[11px] text-slate-200 bg-black/40 p-2 rounded-xl border border-white/5 whitespace-pre-wrap leading-tight font-mono">
                                {order.formasPagamento}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        ) : (
          /* ─── MODO TABELA: COM SUB-LINHA EXPANSÍVEL (INFORMAÇÕES ABAIXO) ─── */
          <div className="glass-card overflow-hidden rounded-2xl border border-white/5 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-4 whitespace-nowrap">Nº OS & Unidade</th>
                    <th className="px-5 py-4 whitespace-nowrap">Cliente & Contato</th>
                    <th className="px-5 py-4 whitespace-nowrap">Armação, Lente & Óptica</th>
                    <th className="px-5 py-4 whitespace-nowrap">Datas (Venda / Entrega)</th>
                    <th className="px-5 py-4 whitespace-nowrap">Financeiro</th>
                    <th className="px-5 py-4 whitespace-nowrap">Status da Produção</th>
                    <th className="px-5 py-4 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrders.map(order => {
                    const statusConf = OS_STATUS_CONFIG[order.status] || OS_STATUS_CONFIG["No Laboratório"];
                    const isCollapsed = Boolean(collapsedOrders[order.id]);
                    const hasDetailedDioptria = Boolean(
                      order.odEsf || order.odCil || order.odEixo || 
                      order.oeEsf || order.oeCil || order.oeEixo || 
                      order.adicao
                    );

                    return (
                      <React.Fragment key={order.id}>
                        <tr className="hover:bg-white/[0.03] transition-colors group">
                          
                          {/* Nº OS e Loja */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleCollapse(order.id)}
                                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                                title={isCollapsed ? "Ver informações abaixo" : "Recolher informações"}
                              >
                                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                              </button>
                              <span className="font-mono font-black text-base text-pink-400">
                                #{order.osNumber}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                                {order.unit}
                              </span>
                            </div>
                            {order.isMultiOS && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span 
                                  className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"
                                  title={`Venda com Múltiplas OS (${order.osIndex}/${order.totalOS})`}
                                >
                                  🔗 OS {order.osIndex}/{order.totalOS}
                                </span>
                                {(order.isSecondaryOS || order.financeiroUnificado) && (
                                  <span 
                                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    title="Cobrança Unificada na Venda Principal"
                                  >
                                    Unificada
                                  </span>
                                )}
                              </div>
                            )}
                            {order.isDelayed ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-md mt-1.5">
                                <AlertTriangle size={10} /> Entrega Atrasada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 mt-1">
                                <Clock size={10} /> No Prazo
                              </span>
                            )}
                          </td>

                          {/* Cliente */}
                          <td className="px-5 py-4 min-w-[200px]">
                            <p className="font-bold text-white group-hover:text-pink-300 transition-colors text-sm">
                              {order.clientName}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {order.clientPhone && (
                                <span className="text-xs text-emerald-400 font-medium font-mono flex items-center gap-1">
                                  <Phone size={11} className="text-emerald-400" /> {order.clientPhone}
                                </span>
                              )}
                              {order.clientCPF && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  CPF: {formatCPF_CNPJ(order.clientCPF)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Descrição / Produto / Lente / Armação */}
                          <td className="px-5 py-4 min-w-[220px] max-w-xs">
                            <div className="space-y-1">
                              {order.armacao && (
                                <p className="text-xs font-bold text-slate-200">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 mr-1.5">Armação:</span>
                                  {order.armacao}
                                </p>
                              )}
                              {order.lente && (
                                <p className="text-xs font-bold text-indigo-300">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mr-1.5">Lente:</span>
                                  {order.lente}
                                </p>
                              )}
                              {!order.armacao && !order.lente && (
                                <p className="text-xs font-bold text-slate-200">{order.product}</p>
                              )}
                              {order.dioptria && (
                                <span className="inline-block text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded font-mono mt-0.5">
                                  {order.dioptria}
                                </span>
                              )}
                              {order.medico && (
                                <p className="text-[10px] text-slate-400">
                                  <span className="font-bold text-slate-500">Médico:</span> {order.medico}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Datas */}
                          <td className="px-5 py-4 whitespace-nowrap text-xs">
                            <div className="space-y-1">
                              <p className="text-slate-300">
                                <span className="text-slate-500 font-bold">Venda:</span> {formatDate(order.dtVenda)}
                              </p>
                              <p className={order.isDelayed ? "text-red-400 font-bold" : "text-slate-300 font-medium"}>
                                <span className="text-slate-500 font-normal">Previsão:</span> {formatDate(order.dtEntrega)}
                              </p>
                              {order.status === "Entregue" && (
                                <p className="text-emerald-400 font-bold flex items-center gap-1">
                                  <PackageCheck size={12} className="text-emerald-400" />
                                  Entregue: {formatDate(order.dtEntregaReal || order.dtEntrega)}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Financeiro */}
                          <td className="px-5 py-4 min-w-[210px] max-w-xs">
                            <p className="font-black text-white text-sm">
                              R$ {formatMoney(order.valorTotal)}
                            </p>
                            <div className="text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                              <p><span className="text-emerald-400 font-bold">Sinal:</span> R$ {formatMoney(order.valorEntrada)}</p>
                              {parseCurrency(order.restante) > 0 ? (
                                <p><span className="text-rose-400 font-bold">Restante:</span> R$ {formatMoney(order.restante)}</p>
                              ) : (
                                <p className="text-emerald-400 font-bold">100% Quitado</p>
                              )}
                            </div>
                            {order.voucher && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-2xs">
                                  🎟️ {order.voucher} {parseCurrency(order.descontoVoucher) > 0 ? `(-R$ ${formatMoney(order.descontoVoucher)})` : ''}
                                </span>
                              </div>
                            )}
                            {order.formasPagamento && (
                              <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Condições / Vencimentos:</span>
                                <p className="text-[10px] text-slate-300 font-medium whitespace-pre-wrap leading-tight bg-white/[0.03] p-1.5 rounded-lg border border-white/5">
                                  {order.formasPagamento}
                                </p>
                              </div>
                            )}
                          </td>

                          {/* Seletor de Status (Semáforo Verde, Amarela e Vermelha) */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              {isVendedor ? (
                                <span 
                                  className={"inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider rounded-xl px-3 py-2 border cursor-default select-none " + statusConf.badgeClass}
                                  title="Vendedor: Somente visualização."
                                >
                                  <span className={`w-2 h-2 rounded-full ${statusConf.dotClass}`} />
                                  <span>{statusConf.icon} {statusConf.label}</span>
                                </span>
                              ) : (
                                <select
                                  value={order.status}
                                  onChange={(e) => handleUpdateStatus(order, e.target.value)}
                                  className={"text-xs font-black uppercase tracking-wider rounded-xl px-3 py-2 border cursor-pointer focus:outline-none transition-all " + statusConf.badgeClass}
                                >
                                  <option value="Aguardando Confirmação" className="bg-slate-900 text-sky-300 font-bold">
                                    🔵 Aguardando Confirmação (Azul)
                                  </option>
                                  <option value="No Laboratório" className="bg-slate-900 text-rose-300 font-bold">
                                    🔴 No Laboratório (Vermelho)
                                  </option>
                                  <option value="Aguardando Lente" className="bg-slate-900 text-rose-300 font-bold">
                                    🔴 Aguardando Lente (Vermelho)
                                  </option>
                                  <option value="Em Produção" className="bg-slate-900 text-amber-300 font-bold">
                                    🟡 Em Produção / Montagem (Amarelo)
                                  </option>
                                  <option value="Pronto para Retirada" className="bg-slate-900 text-yellow-300 font-bold">
                                    🟡 Pronto para Retirada (Amarelo)
                                  </option>
                                  <option value="Entregue" className="bg-slate-900 text-emerald-300 font-bold">
                                    🟢 Entregue ao Cliente (Verde)
                                  </option>
                                  <option value="Cancelada" className="bg-slate-900 text-slate-400 font-bold">
                                    ⚫ Cancelada
                                  </option>
                                </select>
                              )}

                              {order.status === "Aguardando Confirmação" ? (
                                isVendedor ? (
                                  <span className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 select-none cursor-default">
                                    <Clock size={11} className="text-sky-400" />
                                    <span>Aguardando Fin.</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setApprovalModalOrder(order)}
                                    className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-sky-500/40 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 transition-all shadow-md shadow-sky-500/10 active:scale-95"
                                    title="Conferir pagamento e liberar montagem"
                                  >
                                    <ShieldCheck size={12} className="text-sky-400" />
                                    <span>Conferir Pgto</span>
                                  </button>
                                )
                              ) : (
                                isVendedor ? (
                                  <div 
                                    className={`flex items-center justify-between gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border select-none cursor-default ${
                                      (order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    }`}
                                    title="Conferência Financeira (Apenas visualização para vendedores)"
                                  >
                                    {(order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') ? (
                                      <><CheckCircle2 size={12}/> Financeiro Liberado</>
                                    ) : (
                                      <><DollarSign size={12}/> Pendente Fin.</>
                                    )}
                                  </div>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => handleTogglePgtoConferido(order)}
                                    className={`flex items-center justify-between gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${
                                      (order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                    }`}
                                    title="Conferência Financeira (Liberação para Produção)"
                                  >
                                    {(order.raw['PAGAMENTO_CONFERIDO'] === true || order.raw['PAGAMENTO_CONFERIDO'] === 'Sim') ? (
                                      <><CheckCircle2 size={12}/> Financeiro Liberado</>
                                    ) : (
                                      <><DollarSign size={12}/> Pendente Financeiro</>
                                    )}
                                  </button>
                                )
                              )}

                              {order.status === "Entregue" && !isVendedor && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryModalOrder(order);
                                    setDeliveryDateInput(order.dtEntregaReal ? (order.dtEntregaReal.includes('-') ? order.dtEntregaReal : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]);
                                    setDeliveryReceiverInput(order.quemRetirou || 'Próprio Cliente');
                                    setDeliveryNotesInput(order.obsEntrega || '');
                                  }}
                                  className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all font-bold flex items-center justify-between gap-1 w-fit"
                                  title="Alterar data ou detalhes de entrega"
                                >
                                  <span>📅 Baixa: {formatDate(order.dtEntregaReal || order.dtEntrega)}</span>
                                  <span className="text-[9px] underline ml-1">Editar</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Ações */}
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {order.clientPhone && (
                                <button
                                  onClick={() => handleSendWhatsApp(order)}
                                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors border border-emerald-500/20"
                                  title="Enviar aviso para o WhatsApp do Cliente"
                                >
                                  <MessageCircle size={15} />
                                </button>
                              )}

                              <button
                                onClick={() => handlePrint(order)}
                                className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl transition-colors border border-sky-500/20"
                                title="Imprimir Ordem de Serviço"
                              >
                                <Printer size={15} />
                              </button>

                              {order.isMultiOS && (
                                <button
                                  onClick={() => handlePrintAllOS(order)}
                                  className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl transition-colors border border-indigo-500/40"
                                  title={`Imprimir Todas as ${order.totalOS || 'Múltiplas'} OSs Desta Venda juntas`}
                                >
                                  <span className="text-xs font-bold flex items-center gap-1">
                                    <Printer size={14} />
                                    <span className="text-[10px]">({order.totalOS})</span>
                                  </span>
                                </button>
                              )}

                              {order.status !== "Aguardando Confirmação" && order.status !== "Cancelada" && (
                                <>
                                  <button
                                    onClick={() => handlePrintLab(order)}
                                    className="p-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 rounded-xl transition-colors border border-fuchsia-500/20"
                                    title="Imprimir OS de Laboratório"
                                  >
                                    <FlaskConical size={15} />
                                  </button>
                                  {order.isMultiOS && (
                                    <button
                                      onClick={() => handlePrintAllLab(order)}
                                      className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl transition-colors border border-purple-500/40"
                                      title={`Imprimir Todos os Labs das ${order.totalOS} OSs vinculadas`}
                                    >
                                      <span className="text-xs font-bold flex items-center gap-1">
                                        <FlaskConical size={14} />
                                        <span className="text-[10px]">({order.totalOS})</span>
                                      </span>
                                    </button>
                                  )}
                                </>
                              )}

                              <button
                                onClick={() => openLabelModal(order)}
                                className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-colors border border-amber-500/20"
                                title="Imprimir Etiqueta Envelope Lab (50x30mm)"
                              >
                                <Tag size={15} />
                              </button>

                              {order.isMultiOS && (
                                <button
                                  onClick={() => handlePrintAllLabels(order)}
                                  className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl transition-colors border border-amber-500/40"
                                  title={`Imprimir Todas as Etiquetas das ${order.totalOS} OSs vinculadas`}
                                >
                                  <span className="text-xs font-bold flex items-center gap-1">
                                    <Tag size={14} />
                                    <span className="text-[10px]">({order.totalOS})</span>
                                  </span>
                                </button>
                              )}

                              {isAdmin && onDeleteRow && (
                                <button
                                  onClick={() => handleDeleteOS(order)}
                                  className="p-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 rounded-xl transition-colors border border-rose-500/20"
                                  title="Excluir OS e Financeiro Vinculado (Somente Admin)"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>

                        {/* Sub-linha com Informações Detalhadas Abaixo (na tabela) */}
                        {!isCollapsed && (
                          <tr className="bg-black/30 border-b border-white/5">
                            <td colSpan={7} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-in fade-in duration-150">
                                
                                {/* Bloco 1: Armação & Lente */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-pink-400">
                                    <Glasses size={15} />
                                    <span>Armação & Lente</span>
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 block">Armação</span>
                                      <p className="text-white font-bold">{order.armacao || "Armação própria do cliente"}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400/80 block">Lente</span>
                                      <p className="text-indigo-200 font-bold">{order.lente || order.product || "Lente oftálmica"}</p>
                                    </div>
                                    {order.laboratorio && (
                                      <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400/80 block">Laboratório</span>
                                        <p className="text-cyan-300 font-medium">{order.laboratorio}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Bloco 2: Prescrição Óptica */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2">
                                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-cyan-400">
                                    <div className="flex items-center gap-2">
                                      <Eye size={15} />
                                      <span>Grau Óptico</span>
                                    </div>
                                    {order.adicao && (
                                      <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                                        Adição: +{order.adicao}
                                      </span>
                                    )}
                                  </div>

                                  {hasDetailedDioptria ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-center text-[11px] font-mono border-collapse">
                                        <thead>
                                          <tr className="text-[9px] uppercase tracking-wider text-slate-400 bg-white/5">
                                            <th className="py-1 px-1 text-left">Olho</th>
                                            <th className="py-1 px-1">Esf</th>
                                            <th className="py-1 px-1">Cil</th>
                                            <th className="py-1 px-1">Eixo</th>
                                            <th className="py-1 px-1">DNP</th>
                                            <th className="py-1 px-1">Alt</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                          <tr className="hover:bg-white/[0.02]">
                                            <td className="py-1 px-1 text-left font-bold text-cyan-300">OD</td>
                                            <td className="py-1 px-1 text-white font-bold">{order.odEsf || '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.odCil || '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.odEixo ? `${order.odEixo}°` : '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.odDnp || '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.odAlt || '—'}</td>
                                          </tr>
                                          <tr className="hover:bg-white/[0.02]">
                                            <td className="py-1 px-1 text-left font-bold text-cyan-300">OE</td>
                                            <td className="py-1 px-1 text-white font-bold">{order.oeEsf || '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.oeCil || '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.oeEixo ? `${order.oeEixo}°` : '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.oeDnp || '—'}</td>
                                            <td className="py-1 px-1 text-slate-300">{order.oeAlt || '—'}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-cyan-300 font-mono font-bold bg-black/40 p-2 rounded-lg border border-white/5">
                                      {order.dioptria || "Grau não informado"}
                                    </p>
                                  )}
                                </div>

                                {/* Bloco 3: Datas & Prazos */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1.5 text-xs">
                                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 mb-1">
                                    <Calendar size={15} />
                                    <span>Datas & Prazos</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Venda:</span>
                                    <span className="text-white font-bold">{formatDate(order.dtVenda)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Previsão:</span>
                                    <span className={order.isDelayed ? "text-rose-400 font-black" : "text-amber-300 font-bold"}>
                                      {formatDate(order.dtEntrega)}
                                    </span>
                                  </div>
                                  {order.status === "Entregue" && (
                                    <div className="text-emerald-400 pt-1 border-t border-white/5">
                                      <span>Entregue: {formatDate(order.dtEntregaReal || order.dtEntrega)}</span>
                                      {order.quemRetirou && <p className="text-[10px] text-slate-400">Retirou: {order.quemRetirou}</p>}
                                    </div>
                                  )}
                                </div>

                                {/* Bloco 4: Financeiro */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-400 mb-1">
                                    <div className="flex items-center gap-2">
                                      <CreditCard size={15} />
                                      <span>Financeiro</span>
                                    </div>
                                    <span className="font-black text-white">R$ {formatMoney(order.valorTotal)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Sinal:</span>
                                    <span className="text-emerald-400 font-bold">R$ {formatMoney(order.valorEntrada)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Restante:</span>
                                    <span className={parseCurrency(order.restante) > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-bold"}>
                                      {parseCurrency(order.restante) > 0 ? `R$ ${formatMoney(order.restante)}` : "100% Quitado"}
                                    </span>
                                  </div>
                                  {order.formasPagamento && (
                                    <p className="text-[10px] text-slate-300 font-mono bg-black/40 p-1.5 rounded border border-white/5 truncate">
                                      {order.formasPagamento}
                                    </p>
                                  )}
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="glass-card p-16 text-center rounded-2xl">
          <ClipboardList size={48} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhuma Ordem de Serviço encontrada</h3>
          <p className="text-slate-400 text-sm">Nenhuma OS corresponde aos filtros selecionados no momento.</p>
        </div>
      )}

      {/* ─── MODAL DE CONFERÊNCIA FINANCEIRA & APROVAÇÃO DE OS (GERAÇÃO DE DUPLICATAS) ─── */}
      {approvalModalOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-sky-500/40 rounded-3xl p-5 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative erp-scroll">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    Conferência Financeira de OS
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-black">Azul 🔵</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    OS #{approvalModalOrder.osNumber} · Unidade {approvalModalOrder.unit}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovalModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ficha da OS & Cliente */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Cliente:</span>
                <span className="text-white font-black text-sm">{approvalModalOrder.clientName}</span>
              </div>
              {approvalModalOrder.clientCPF && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">CPF:</span>
                  <span className="text-slate-300 font-mono">{formatCPF_CNPJ(approvalModalOrder.clientCPF)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Produto:</span>
                <span className="text-slate-200 font-medium">{approvalModalOrder.product}</span>
              </div>
              {approvalModalOrder.dtEntrega && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">Previsão de Entrega:</span>
                  <span className="text-sky-300 font-bold">{formatDate(approvalModalOrder.dtEntrega)}</span>
                </div>
              )}
            </div>

            {/* Grade de Valores e Sinal */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Valor Total</span>
                <span className="text-sm sm:text-base font-black text-white">R$ {formatMoney(approvalModalOrder.valorTotal)}</span>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
                <span className="text-[10px] font-black uppercase text-emerald-400 block mb-1">Sinal / Entrada</span>
                <span className="text-sm sm:text-base font-black text-emerald-300">R$ {formatMoney(approvalModalOrder.valorEntrada)}</span>
              </div>
              <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 text-center">
                <span className="text-[10px] font-black uppercase text-rose-400 block mb-1">Saldo a Cobrar</span>
                <span className="text-sm sm:text-base font-black text-rose-300">R$ {formatMoney(approvalModalOrder.restante)}</span>
              </div>
            </div>

            {/* Condições de Pagamento e Parcelas */}
            <div className="space-y-1.5 bg-white/[0.02] p-3.5 rounded-xl border border-white/5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Formas de Pagamento Declaradas:
              </span>
              <p className="text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
                {approvalModalOrder.formasPagamento || "Não especificado na abertura."}
              </p>

              {(() => {
                const parcs = extractOrderInstallments(approvalModalOrder);

                if (parcs && parcs.length > 0) {
                  return (
                    <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-indigo-400 block">
                        Duplicatas que serão criadas em Contas a Receber ({parcs.length} parcela{parcs.length > 1 ? 's' : ''}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {parcs.map((p, idx) => (
                          <div key={idx} className="bg-black/40 border border-white/10 p-2 rounded-lg flex items-center justify-between text-[11px]">
                            <div>
                              <span className="font-bold text-slate-300 block">{p.numero}ª Parcela</span>
                              {p.vencimento && (
                                <span className="text-[10px] text-slate-500 font-mono">Venc: {formatDate(p.vencimento)}</span>
                              )}
                            </div>
                            <span className="font-black text-emerald-400">R$ {typeof p.valor === 'number' ? formatMoney(p.valor) : p.valor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } else if (parseCurrency(approvalModalOrder.restante) > 0) {
                  return (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-amber-300 font-medium">
                      ℹ️ O saldo de <strong className="text-white">R$ {formatMoney(approvalModalOrder.restante)}</strong> será lançado como duplicata a receber no Financeiro.
                    </div>
                  );
                } else {
                  return (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-emerald-400 font-medium">
                      ✅ OS quitada integralmente no ato (sem duplicatas pendentes).
                    </div>
                  );
                }
              })()}
            </div>

            {/* Aviso informativo de liberação */}
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] flex items-center gap-2">
              <Sparkles size={16} className="text-sky-400 shrink-0" />
              <span>
                Ao confirmar, o sistema gerará as duplicatas em <strong>Contas a Receber</strong>, atualizará a ficha financeira do cliente e liberará a OS para a <strong>Montagem dos Óculos</strong>.
              </span>
            </div>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={isApproving}
                onClick={() => handleRejectOS(approvalModalOrder)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle size={15} />
                <span>Recusar / Cancelar OS</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => setApprovalModalOrder(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => handleConfirmApproval(approvalModalOrder)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-white text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirmar Pagamento & Liberar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Toast de Notificação */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[99999] p-4 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 size={20} className="shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ─── MODAL DE BAIXA / CONFIRMAR DATA DE ENTREGA AO CLIENTE ─── */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-emerald-500/30 rounded-3xl p-5 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 erp-scroll">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                  <PackageCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Baixa de Entrega ao Cliente</h3>
                  <p className="text-xs text-slate-400 font-mono">Ordem de Serviço #{deliveryModalOrder.osNumber} · {deliveryModalOrder.unit}</p>
                </div>
              </div>
              <button
                onClick={() => setDeliveryModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Informações do Cliente & Pedido */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1.5 text-xs text-slate-300">
              <p><span className="text-slate-500 font-bold">Cliente:</span> <span className="text-white font-bold">{deliveryModalOrder.clientName}</span></p>
              <p><span className="text-slate-500 font-bold">Produto:</span> {deliveryModalOrder.product}</p>
              <p><span className="text-slate-500 font-bold">Valor Total:</span> <span className="text-emerald-400 font-bold">R$ {formatMoney(deliveryModalOrder.valorTotal)}</span></p>
              {parseCurrency(deliveryModalOrder.restante) > 0 && (
                <p><span className="text-rose-400 font-bold">Saldo Restante na Entrega:</span> <span className="text-rose-400 font-black">R$ {formatMoney(deliveryModalOrder.restante)}</span></p>
              )}
            </div>

            {/* Formulário de Baixa */}
            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Calendar size={14} /> Data Efetiva da Entrega / Retirada
                </label>
                <input
                  type="date"
                  required
                  value={deliveryDateInput}
                  onChange={e => setDeliveryDateInput(e.target.value)}
                  className="w-full bg-black/40 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-400 shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User size={14} className="text-sky-400" /> Quem Retirou os Óculos?
                </label>
                <input
                  type="text"
                  placeholder="Ex: Próprio Cliente, Esposo(a), Mãe, etc."
                  value={deliveryReceiverInput}
                  onChange={e => setDeliveryReceiverInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">
                  Observações de Entrega (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Óculos ajustado, cliente satisfeito."
                  value={deliveryNotesInput}
                  onChange={e => setDeliveryNotesInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-white/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDeliveryModalOrder(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
                >
                  <Check size={16} /> Confirmar Baixa de Entrega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Formulário Lab */}
      {labModalOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f172a] border border-fuchsia-500/30 rounded-3xl p-5 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 my-4 sm:my-8 erp-scroll">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shadow-lg shadow-fuchsia-500/20">
                  <FlaskConical size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Gerar OS de Laboratório</h3>
                  <p className="text-xs text-slate-400 font-mono">Ordem de Serviço #{labModalOrder.osNumber} · {labModalOrder.unit}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLabModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmLabPrint} className="space-y-4">
              {isVendedor && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-amber-400" />
                  <span>Modo de visualização e impressão: Vendedores não podem alterar dados técnicos diretamente na Gestão de OS.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Laboratório</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.LABORATORIO || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, LABORATORIO: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
              </div>

              <h4 className="text-sm font-bold text-white mt-4 border-b border-white/10 pb-2">Prescrição / Dioptria</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OD Esférico</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OD_ESF || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OD_ESF: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OD Cilíndrico</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OD_CIL || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OD_CIL: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OD Eixo</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OD_EIXO || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OD_EIXO: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Adição (AD)</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.ADICAO || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, ADICAO: e.target.value})} className={`w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3 py-2 text-sm text-emerald-400 font-bold focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-emerald-400'}`} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OE Esférico</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OE_ESF || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OE_ESF: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OE Cilíndrico</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OE_CIL || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OE_CIL: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OE Eixo</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OE_EIXO || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OE_EIXO: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
              </div>

              <h4 className="text-sm font-bold text-white mt-4 border-b border-white/10 pb-2">Medidas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OD DNP</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OD_DNP || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OD_DNP: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OE DNP</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OE_DNP || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OE_DNP: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OD Altura</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OD_ALT || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OD_ALT: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">OE Altura</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.OE_ALT || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, OE_ALT: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
              </div>

              <h4 className="text-sm font-bold text-white mt-4 border-b border-white/10 pb-2">Dados da Armação</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Ponte + Aro</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.PONTE_ARO || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, PONTE_ARO: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Diagonal Maior</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.DIAGONAL_MAIOR || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, DIAGONAL_MAIOR: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Altura Vertical</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.ALTURA_VERTICAL || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, ALTURA_VERTICAL: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Ponte</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.PONTE || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, PONTE: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Aro</label>
                  <input type="text" readOnly={isVendedor} value={labFormData.ARO || ''} onChange={e => !isVendedor && setLabFormData({...labFormData, ARO: e.target.value})} className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none ${isVendedor ? 'opacity-80 cursor-default' : 'focus:border-fuchsia-400'}`} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setLabModalOrder(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-black shadow-lg shadow-fuchsia-500/25 flex items-center gap-2 transition-all"
                >
                  <Printer size={16} /> {isVendedor ? 'Imprimir OS de Laboratório' : 'Salvar & Imprimir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Componentes Invisíveis de Impressão */}
      {osDataForPrint && printClient && (
        <PrintableOS clientData={printClient} osData={osDataForPrint} />
      )}
      {osDataForLabPrint && printLabClient && (
        <PrintableLabOS clientData={printLabClient} osData={osDataForLabPrint} />
      )}

      {/* Modal de Impressão de Etiquetas Térmicas (50x30mm) */}
      <PrintableLabelModal
        isOpen={Boolean(labelModalData)}
        onClose={() => setLabelModalData(null)}
        data={labelModalData}
        defaultType="envelope_lab"
      />
    </div>
  );
};

export default OSManagement;
