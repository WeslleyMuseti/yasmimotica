import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, Phone, MapPin, Calendar, CreditCard, ShoppingBag, PlusCircle, 
  AlertTriangle, CheckCircle, Activity, Edit2, ClipboardList, DollarSign, 
  AtSign, Trash2, Printer, Glasses, Home, Building2, Hash, Compass, Mail, 
  Sparkles, UserCheck, ArrowLeft, Save, Check, Users, ShieldCheck, FileText, Clock,
  Pencil, CheckCircle2, Paperclip, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PrintableOS from './PrintableOS';
import PrintableClientProfile from './PrintableClientProfile';
import DocumentAttachmentInput from './DocumentAttachmentInput';
import EditOSModal from './EditOSModal';
import ReceiptModal from './ReceiptModal';
import { isSameClient } from '../firebaseSync';
import { syncOSPaymentDate, syncInstallmentPaymentDate } from '../dateSyncUtils';

const formatCPF_CNPJ = (val) => {
  if (!val) return 'Não informado';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return String(val);
};

const formatRG = (val) => {
  if (!val) return 'Não informado';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 9) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
  }
  return String(val);
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

const ClientProfileModal = ({ 
  isOpen, 
  onClose, 
  clientData, 
  clientHistory = [], 
  onUpdateStatus, 
  onUpdateClient,
  onAddPurchase, 
  onEditClick, 
  onGenerateOS, 
  onRegisterPayment, 
  onDeleteSale, 
  onDeleteClient, 
  currentUser, 
  data = {},
  receberData = [], 
  onUpdateRow,
  onAddRow,
  onDeleteRow,
  onUpdateSale
}) => {
  const [currentClient, setCurrentClient] = useState(clientData);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentOS, setPaymentOS] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const [osDataForPrint, setOsDataForPrint] = useState(null);
  const [isPrintingProfile, setIsPrintingProfile] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState(false);

  // Impressão da ficha cadastral completa (dados pessoais + responsável legal)
  const handlePrintProfile = () => {
    setOsDataForPrint(null);
    setIsPrintingProfile(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintingProfile(false), 1500);
    }, 250);
  };
  
  // Edição de Ordem de Serviço (OS) existente no perfil
  const [editingOS, setEditingOS] = useState(null);
  const [osSuccessMessage, setOsSuccessMessage] = useState(false);
  const [localHistory, setLocalHistory] = useState(clientHistory);
  const [receiptModalInvoice, setReceiptModalInvoice] = useState(null);

  // Modal de Quitação de Parcela com Opção de Contar no Caixa
  const [settleModalInvoice, setSettleModalInvoice] = useState(null);
  const [settlePaymentDate, setSettlePaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settleCountInCash, setSettleCountInCash] = useState(true);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Modal de Exclusão de Venda / OS com Opção de Apagar ou Manter Dívida
  const [saleDeleteModalData, setSaleDeleteModalData] = useState(null);
  const [saleDeleteDebtChoice, setSaleDeleteDebtChoice] = useState(true);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  useEffect(() => {
    setLocalHistory(clientHistory);
  }, [clientHistory]);

  const handleSaveOS = async (updatedRow) => {
    // 1. Garantir que a OS volte obrigatoriamente para "Aguardando Confirmação" (Semáforo Azul)
    const finalizedRow = {
      ...updatedRow,
      'STATUS_OS': 'Aguardando Confirmação',
      'SITUAÇÃO': 'Aguardando Confirmação',
      'PAGAMENTO_CONFERIDO': 'Não',
      'DUPLICATAS_GERADAS': false
    };

    // 2. Limpeza atômica de parcelas antigas/duplicatas pendentes em CONTAS_RECEBER vinculadas a esta OS
    const osNum = String(editingOS?.['OS DA VENDA'] || editingOS?.['OS'] || editingOS?.['VENDA_OS'] || editingOS?.['OS da COMPRA'] || '').trim();
    if (osNum && osNum !== '—' && Array.isArray(receberData) && receberData.length > 0) {
      const targetOS = osNum.toLowerCase();
      const pendingInvoices = receberData.filter(inv => {
        return isMatchingOS(inv, targetOS) && inv.STATUS !== 'Recebido' && inv.STATUS !== 'Pago';
      });

      if (onDeleteRow && pendingInvoices.length > 0) {
        for (const inv of pendingInvoices) {
          try {
            await onDeleteRow('CONTAS_RECEBER', inv);
          } catch (delErr) {
            console.warn('Erro ao remover duplicata pendente da OS antiga:', delErr);
          }
        }
      }

      // Se havia duplicatas pendentes, ajusta o débito do cliente para não haver cobrança dupla
      const totalRemoved = pendingInvoices.reduce((sum, inv) => sum + parseCurrency(inv.VALOR), 0);
      if (totalRemoved > 0 && currentClient && onUpdateRow) {
        const curDebt = parseCurrency(currentClient['Valor Devido']);
        const newDebt = Math.max(0, curDebt - totalRemoved);
        const updatedClient = {
          ...currentClient,
          'Valor Devido': newDebt.toFixed(2).replace('.', ','),
          'Status de Pagamento': newDebt === 0 ? 'Em dia' : currentClient['Status de Pagamento']
        };
        try {
          await onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updatedClient);
          setCurrentClient(updatedClient);
          if (onUpdateClient) {
            onUpdateClient({ oldRow: currentClient, newRow: updatedClient });
          }
        } catch (debtErr) {
          console.warn('Erro ao atualizar débito do cliente na reconfirmação da OS:', debtErr);
        }
      }
    }

    if (onUpdateSale && editingOS) {
      await onUpdateSale(editingOS, finalizedRow);
    } else if (onUpdateRow && editingOS) {
      await onUpdateRow('Registro_Vendas', editingOS, finalizedRow);
    }

    if (onUpdateRow && editingOS) {
      const fullData = data && Object.keys(data).length > 0 ? data : {
        Registro_Vendas: clientHistory,
        CONTAS_RECEBER: receberData
      };
      await syncOSPaymentDate({
        osNumber: finalizedRow['OS DA VENDA'] || finalizedRow['OS'],
        saleRow: finalizedRow,
        newDate: finalizedRow['DATA DA VENDA'] || finalizedRow['DATA'],
        newTime: finalizedRow.hora || finalizedRow.HORA,
        data: fullData,
        onUpdateRow
      });
    }
    setLocalHistory(prev => prev.map(item => {
      const isThis = item === editingOS ||
        (item.id && item.id === editingOS?.id) ||
        (item['OS DA VENDA'] && item['OS DA VENDA'] === editingOS?.['OS DA VENDA']) ||
        (item['OS'] && item['OS'] === editingOS?.['OS']);
      return isThis ? finalizedRow : item;
    }));
    setEditingOS(null);
    setOsSuccessMessage(true);
    setTimeout(() => setOsSuccessMessage(false), 5000);
  };

  // Formulário de Edição Interna no Modal
  const [editFormData, setEditFormData] = useState({});

  useEffect(() => {
    if (clientData) {
      setCurrentClient(clientData);
      setEditFormData({
        id: clientData.id || clientData['_id'] || undefined,
        'Nome Completo': clientData['Nome Completo'] || clientData['NOME'] || clientData['Nome'] || '',
        'Data de Nascimento': clientData['Data de Nascimento'] || clientData['DATA NASCIMENTO'] || clientData['Dt. Nasc.'] || '',
        'CPF / CNPJ': clientData['CPF / CNPJ'] || clientData['CPF'] || clientData['CNPJ'] || '',
        'RG': clientData['RG'] || clientData['rg'] || '',
        'WhatsApp': clientData['WhatsApp'] || clientData['TELEFONE'] || clientData['TELEFONE CLIENTE'] || clientData['Celular'] || '',
        'Nome Referência 1': clientData['Nome Referência 1'] || clientData['Nome Ref. 1'] || clientData['NOME_REF_1'] || '',
        'Referência 1': clientData['Referência 1'] || clientData['REFERENCIA 1'] || '',
        'Parentesco Ref. 1': clientData['Parentesco Ref. 1'] || clientData['PARENTESCO REF. 1'] || '',
        'Nome Referência 2': clientData['Nome Referência 2'] || clientData['Nome Ref. 2'] || clientData['NOME_REF_2'] || '',
        'Referência 2': clientData['Referência 2'] || clientData['REFERENCIA 2'] || '',
        'Parentesco Ref. 2': clientData['Parentesco Ref. 2'] || clientData['PARENTESCO REF. 2'] || '',
        'E-mail': clientData['E-mail'] || clientData['EMAIL'] || '',
        'Instagram': clientData['Instagram'] || clientData['INSTAGRAM'] || '',
        'Facebook': clientData['Facebook'] || clientData['FACEBOOK'] || '',
        'TikTok': clientData['TikTok'] || clientData['TIKTOK'] || '',
        'CEP': clientData['CEP'] || '',
        'Rua': clientData['Rua'] || clientData['RUA'] || clientData['ENDEREÇO'] || '',
        'Número': clientData['Número'] || clientData['NUMERO'] || clientData['Nº'] || '',
        'Bairro': clientData['Bairro'] || clientData['BAIRRO'] || '',
        'Cidade': clientData['Cidade'] || clientData['CIDADE'] || clientData['UNIDADE'] || '',
        'Estado': clientData['Estado'] || clientData['ESTADO'] || clientData['UF'] || '',
        'Responsável Nome': clientData['Responsável Nome'] || clientData['Responsável'] || clientData['RESPONSAVEL'] || '',
        'Responsável Data de Nascimento': clientData['Responsável Data de Nascimento'] || '',
        'Responsável CPF': clientData['Responsável CPF'] || clientData['RESPONSAVEL_CPF'] || '',
        'Responsável RG': clientData['Responsável RG'] || clientData['RESPONSAVEL_RG'] || '',
        'Responsável WhatsApp': clientData['Responsável WhatsApp'] || clientData['RESPONSAVEL_WHATSAPP'] || '',
        'Responsável Nome Referência 1': clientData['Responsável Nome Referência 1'] || clientData['Responsável Nome Ref. 1'] || clientData['RESPONSAVEL_NOME_REF_1'] || '',
        'Responsável Referência 1': clientData['Responsável Referência 1'] || '',
        'Responsável Parentesco Ref. 1': clientData['Responsável Parentesco Ref. 1'] || '',
        'Responsável Nome Referência 2': clientData['Responsável Nome Referência 2'] || clientData['Responsável Nome Ref. 2'] || clientData['RESPONSAVEL_NOME_REF_2'] || '',
        'Responsável Referência 2': clientData['Responsável Referência 2'] || '',
        'Responsável Parentesco Ref. 2': clientData['Responsável Parentesco Ref. 2'] || '',
        'Responsável Instagram': clientData['Responsável Instagram'] || '',
        'Responsável Facebook': clientData['Responsável Facebook'] || '',
        'Responsável TikTok': clientData['Responsável TikTok'] || '',
        'Responsável CEP': clientData['Responsável CEP'] || '',
        'Responsável Rua': clientData['Responsável Rua'] || clientData['RESPONSAVEL_RUA'] || '',
        'Responsável Número': clientData['Responsável Número'] || '',
        'Responsável Bairro': clientData['Responsável Bairro'] || '',
        'Responsável Cidade': clientData['Responsável Cidade'] || '',
        'Responsável Estado': clientData['Responsável Estado'] || '',
        // Documentos e Comprovantes Anexados
        'Foto Documento Cliente': clientData['Foto Documento Cliente'] || clientData['fotoDocumentoCliente'] || clientData['FOTO_DOCUMENTO_CLIENTE'] || '',
        'Foto Comprovante Residência Cliente': clientData['Foto Comprovante Residência Cliente'] || clientData['fotoComprovanteResidenciaCliente'] || clientData['FOTO_COMPROVANTE_CLIENTE'] || '',
        'Foto Documento Responsável': clientData['Foto Documento Responsável'] || clientData['fotoDocumentoResponsavel'] || clientData['FOTO_DOCUMENTO_RESPONSAVEL'] || '',
        'Foto Comprovante Residência Responsável': clientData['Foto Comprovante Residência Responsável'] || clientData['fotoComprovanteResidenciaResponsavel'] || clientData['FOTO_COMPROVANTE_RESPONSAVEL'] || '',
        'Marca de Lente': clientData['Marca de Lente'] || clientData['LENTE'] || '',
        'Modelo de Armação': clientData['Modelo de Armação'] || clientData['ARMAÇÃO'] || '',
        'Status de Pagamento': clientData['Status de Pagamento'] || clientData['STATUS'] || 'Em dia',
        'Valor Devido': clientData['Valor Devido'] || clientData['VALOR DEVIDO'] || '',
        'Data de Vencimento': clientData['Data de Vencimento'] || clientData['DATA VENCIMENTO'] || ''
      });
      setIsEditing(false);
      setIsRegisteringPayment(false);
      setIsAddingPurchase(false);
    }
  }, [clientData, isOpen]);

  const [newPurchase, setNewPurchase] = useState({
    'DATA  DA VENDA': new Date().toISOString().split('T')[0],
    'PRODUTO': '',
    'VALOR TOTAL': '',
    'SITUAÇÃO': 'Pago',
    'OS DA VENDA': ''
  });

  if (typeof document === 'undefined') return null;

  const clientErpInvoices = useMemo(() => {
    return (receberData || []).filter(item => {
      if (!currentClient) return false;
      return isSameClient(currentClient, item);
    });
  }, [receberData, currentClient]);

  // Cálculos financeiros em tempo real sincronizados com CONTAS_RECEBER (ERP)
  const realFinancials = useMemo(() => {
    let saldoDevedorReal = 0;
    let totalRecebidoReal = 0;
    let hasOverdue = false;
    let hasPending = false;
    const todayStr = new Date().toISOString().split('T')[0];

    clientErpInvoices.forEach(inv => {
      const val = parseCurrency(inv.VALOR || inv.valor || 0);
      const st = String(inv.STATUS || inv.status || 'Pendente').trim();
      const isPaid = st === 'Recebido' || st === 'Pago';
      const dtVenc = String(inv.DATA_VENCIMENTO || inv['DATA VENCIMENTO'] || inv.VENCIMENTO || '');

      if (isPaid) {
        totalRecebidoReal += val;
      } else {
        saldoDevedorReal += val;
        hasPending = true;
        if (dtVenc && dtVenc < todayStr) {
          hasOverdue = true;
        }
      }
    });

    if (clientErpInvoices.length === 0) {
      saldoDevedorReal = parseCurrency(currentClient?.['Valor Devido'] || currentClient?.['VALOR DEVIDO'] || 0);
    }

    let statusReal = 'Em dia';
    if (saldoDevedorReal > 0) {
      statusReal = hasOverdue ? 'Inadimplente' : 'Pendente';
    }

    return {
      saldoDevedorReal,
      totalRecebidoReal,
      statusReal,
      hasPending,
      hasOverdue
    };
  }, [clientErpInvoices, currentClient]);

  const handleSettleSingleInvoice = (inv) => {
    setSettleModalInvoice(inv);
    setSettlePaymentDate(new Date().toISOString().split('T')[0]);
    setSettleCountInCash(true);
  };

  const handleConfirmSettleModal = async () => {
    if (!settleModalInvoice || isSubmittingSettle) return;
    setIsSubmittingSettle(true);
    const inv = settleModalInvoice;
    const val = parseCurrency(inv.VALOR || inv.valor);
    const osNum = inv.VENDA_OS || inv.OS || inv.venda_os || '';

    try {
      if (onRegisterPayment) {
        onRegisterPayment(val, osNum, inv, settleCountInCash);
        const currentDebt = parseCurrency(currentClient?.['Valor Devido']);
        const newDebt = Math.max(0, currentDebt - val);
        const newStatus = newDebt === 0 ? 'Em dia' : currentClient?.['Status de Pagamento'];
        setCurrentClient(prev => ({
          ...prev,
          'Valor Devido': newDebt.toFixed(2).replace('.', ','),
          'Status de Pagamento': newStatus
        }));
      } else {
        // (a) update installment in CONTAS_RECEBER to STATUS: 'Recebido' e sincroniza no FLUXO_CAIXA apenas se settleCountInCash for true
        await syncInstallmentPaymentDate({
          installmentRow: inv,
          newPaymentDate: settlePaymentDate || new Date().toISOString().split('T')[0],
          data,
          onUpdateRow,
          onAddRow,
          currentUser,
          contarNoCaixa: settleCountInCash
        });

        // (b) decrement client's 'Valor Devido' in CLIENTES_CADASTRADOS
        const currentDebt = parseCurrency(currentClient?.['Valor Devido']);
        const newDebt = Math.max(0, currentDebt - val);
        const newStatus = newDebt === 0 ? 'Em dia' : currentClient?.['Status de Pagamento'];
        const updatedClient = {
          ...currentClient,
          'Valor Devido': newDebt.toFixed(2).replace('.', ','),
          'Status de Pagamento': newStatus
        };
        if (onUpdateClient) {
          onUpdateClient({ oldRow: currentClient, newRow: updatedClient });
        } else if (onUpdateRow) {
          onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updatedClient);
        }
        setCurrentClient(updatedClient);
      }
      setSettleModalInvoice(null);
    } catch (err) {
      console.error('Erro ao registrar recebimento de parcela:', err);
      alert('Erro ao registrar quitação da parcela.');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleConfirmSaleDelete = async () => {
    if (!saleDeleteModalData || isDeletingSale) return;
    setIsDeletingSale(true);
    try {
      if (onDeleteSale) {
        await onDeleteSale(saleDeleteModalData.index, saleDeleteDebtChoice);
      }
      setSaleDeleteModalData(null);
    } catch (err) {
      console.error('Erro ao excluir venda/OS:', err);
      alert('Erro ao excluir venda/OS.');
    } finally {
      setIsDeletingSale(false);
    }
  };

  const clientOSList = useMemo(() => {
    const list = new Set();
    if (clientHistory && Array.isArray(clientHistory)) {
      clientHistory.forEach(c => {
        const os = c['OS DA VENDA'] || c['OS'] || c['VENDA_OS'] || c['OS_VENDA'];
        if (os && String(os).trim() && String(os).trim() !== '—' && String(os).trim() !== '-' && String(os).trim() !== 'N/A') {
          list.add(String(os).trim());
        }
      });
    }
    if (clientErpInvoices && Array.isArray(clientErpInvoices)) {
      clientErpInvoices.forEach(inv => {
        const os = inv.VENDA_OS || inv.venda_os || inv.OS || inv.os;
        if (os && String(os).trim() && String(os).trim() !== '—' && String(os).trim() !== '-' && String(os).trim() !== 'N/A') {
          list.add(String(os).trim());
        }
      });
    }
    return Array.from(list);
  }, [clientHistory, clientErpInvoices]);

  const handleStatusToggle = () => {
    const currentStatus = realFinancials.statusReal || currentClient['Status de Pagamento'] || 'Em dia';
    const newStatus = currentStatus === 'Em dia' ? 'Inadimplente' : 'Em dia';
    const updated = { ...currentClient, 'Status de Pagamento': newStatus };
    setCurrentClient(updated);
    if (onUpdateStatus) onUpdateStatus(newStatus);
    if (onUpdateClient) onUpdateClient({ oldRow: currentClient, newRow: updated });
  };

  const handleEditChange = (e) => {
    let { name, value } = e.target;
    if (name === 'CPF / CNPJ' || name === 'Responsável CPF') {
      value = value.replace(/\D/g, '');
      if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else {
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
      }
      value = value.slice(0, 18);
    } else if (name === 'WhatsApp' || name === 'Referência 1' || name === 'Referência 2' || name === 'Responsável WhatsApp' || name === 'Responsável Referência 1' || name === 'Responsável Referência 2') {
      value = value.replace(/\D/g, '');
      if (value.length > 0) {
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d)(\d{4})$/, '$1-$2');
      }
      value = value.slice(0, 15);
    }
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updated = {
      ...currentClient,
      ...editFormData,
      id: currentClient?.id || editFormData?.id || `client_${Date.now()}`
    };

    setCurrentClient(updated);

    if (onUpdateClient) {
      onUpdateClient({ oldRow: currentClient, newRow: updated });
    } else if (onUpdateRow) {
      onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updated);
    }

    setEditSuccessMessage(true);
    setTimeout(() => {
      setEditSuccessMessage(false);
      setIsEditing(false);
    }, 1200);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (onAddPurchase) {
      const pDate = newPurchase['DATA  DA VENDA'] || newPurchase['DATA DA VENDA'] || newPurchase['DATA'] || new Date().toISOString().split('T')[0];
      onAddPurchase({
        ...newPurchase,
        'DATA  DA VENDA': pDate,
        'DATA DA VENDA': pDate,
        'DATA_VENDA': pDate,
        'Data da Venda': pDate,
        'data_venda': pDate,
        'DATA': pDate,
        'NOME CLIENTE': currentClient['Nome Completo'] || currentClient['NOME'],
        'TELEFONE': currentClient['WhatsApp'] || ''
      });
    }
    setIsAddingPurchase(false);
    setNewPurchase({
      'DATA  DA VENDA': new Date().toISOString().split('T')[0],
      'PRODUTO': '',
      'VALOR TOTAL': '',
      'SITUAÇÃO': 'Pago',
      'OS DA VENDA': ''
    });
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && currentClient && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto custom-scrollbar"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg lg:max-w-4xl bg-[#0b1120] border border-white/10 rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
          >
            {/* Header com Efeito Vidro */}
            <div className="relative p-4 sm:p-7 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center z-10 shrink-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
              
              <div className="flex items-center gap-3 sm:gap-4 w-full">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 flex items-center justify-center border border-sky-500/30 shadow-[0_0_30px_rgba(56,189,248,0.15)] shrink-0">
                  {isEditing ? <Edit2 className="text-sky-400" size={22} /> : <User className="text-sky-400" size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate">
                      {isEditing ? 'Editar Cadastro' : (currentClient['Nome Completo'] || currentClient['NOME'] || 'Cliente Sem Nome')}
                    </h2>
                    {isEditing && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-black border border-sky-500/30 shrink-0">
                        MODO EDIÇÃO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {isEditing 
                      ? `Alterando informações de ${currentClient['Nome Completo'] || currentClient['NOME']}` 
                      : (currentClient['Cidade'] ? `${currentClient['Cidade']} • ` : '') + (currentClient['WhatsApp'] || 'Sem telefone')
                    }
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrintProfile}
                        title="Imprimir Ficha Cadastral com Dados Pessoais e do Responsável"
                        className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-black transition-all bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]"
                      >
                        <Printer size={13} />
                        <span className="hidden sm:inline">IMPRIMIR FICHA</span>
                      </button>

                      <button
                        onClick={handleStatusToggle}
                        title="Clique para alternar o status manualmente se necessário"
                        className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-black transition-all border ${
                          realFinancials.statusReal === 'Em dia'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                            : realFinancials.statusReal === 'Pendente'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                        }`}
                      >
                        {realFinancials.statusReal === 'Em dia' ? <CheckCircle size={13}/> : <AlertTriangle size={13}/>}
                        <span className="hidden sm:inline">{realFinancials.statusReal.toUpperCase()}</span>
                      </button>
                    </>
                  )}

                  <button onClick={onClose} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all bg-white/5 border border-white/10">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Mensagem de Sucesso */}
            {editSuccessMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-3 text-emerald-300 text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle size={16} className="text-emerald-400" />
                <span>Cadastro atualizado com sucesso no sistema e sincronizado com a nuvem!</span>
              </motion.div>
            )}

            {/* Body */}
            <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar bg-black/20 flex-1 space-y-6 erp-scroll">

              {/* ─── MODO EDIÇÃO INTERNO NO MODAL ─── */}
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-6">
                  
                  {/* Seção 1: Dados Pessoais */}
                  <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-xs font-black uppercase tracking-widest text-sky-400 flex items-center gap-2 border-b border-white/10 pb-2">
                      <User size={14} /> 1. Dados Pessoais
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome Completo *</label>
                        <input
                          type="text"
                          name="Nome Completo"
                          required
                          value={editFormData['Nome Completo'] || ''}
                          onChange={handleEditChange}
                          placeholder="Ex: Yasmin Oliveira"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Nascimento</label>
                        <input
                          type="date"
                          name="Data de Nascimento"
                          value={editFormData['Data de Nascimento'] || ''}
                          onChange={handleEditChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">CPF / CNPJ</label>
                        <input
                          type="text"
                          name="CPF / CNPJ"
                          value={editFormData['CPF / CNPJ'] || ''}
                          onChange={handleEditChange}
                          placeholder="000.000.000-00"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documento RG</label>
                        <input
                          type="text"
                          name="RG"
                          value={editFormData['RG'] || ''}
                          onChange={handleEditChange}
                          placeholder="RG do cliente"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">WhatsApp / Telefone</label>
                        <input
                          type="text"
                          name="WhatsApp"
                          value={editFormData['WhatsApp'] || ''}
                          onChange={handleEditChange}
                          placeholder="(00) 00000-0000"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>

                      {/* Anexo: Foto do Documento do Cliente */}
                      <div className="md:col-span-2 pt-1">
                        <DocumentAttachmentInput
                          label="Foto do Documento do Cliente (RG / CPF / CNH)"
                          helperText="Anexe foto nítida do documento oficial com foto do titular"
                          value={editFormData['Foto Documento Cliente']}
                          onChange={(val) => setEditFormData(prev => ({ ...prev, 'Foto Documento Cliente': val }))}
                          accentColor="indigo"
                          clientName={editFormData['Nome Completo'] || ''}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Contato, Redes & Referências */}
                  <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2 border-b border-white/10 pb-2">
                      <Phone size={14} /> 2. Contato &amp; Redes Sociais
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail</label>
                        <input
                          type="email"
                          name="E-mail"
                          value={editFormData['E-mail'] || ''}
                          onChange={handleEditChange}
                          placeholder="email@exemplo.com"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instagram</label>
                        <input
                          type="text"
                          name="Instagram"
                          value={editFormData['Instagram'] || ''}
                          onChange={handleEditChange}
                          placeholder="@usuario"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      {/* Referência 1 do Cliente */}
                      <div className="md:col-span-2 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Referência 1 (Contato Pessoal)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nome da Pessoa</label>
                            <input
                              type="text"
                              name="Nome Referência 1"
                              value={editFormData['Nome Referência 1'] || ''}
                              onChange={handleEditChange}
                              placeholder="Nome da pessoa"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                            <input
                              type="text"
                              name="Referência 1"
                              value={editFormData['Referência 1'] || ''}
                              onChange={handleEditChange}
                              placeholder="(00) 00000-0000"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Parentesco</label>
                            <input
                              type="text"
                              name="Parentesco Ref. 1"
                              value={editFormData['Parentesco Ref. 1'] || ''}
                              onChange={handleEditChange}
                              placeholder="Ex: Mãe, Esposo(a)"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Referência 2 do Cliente */}
                      <div className="md:col-span-2 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Referência 2 (Contato Pessoal)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nome da Pessoa</label>
                            <input
                              type="text"
                              name="Nome Referência 2"
                              value={editFormData['Nome Referência 2'] || ''}
                              onChange={handleEditChange}
                              placeholder="Nome da pessoa"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                            <input
                              type="text"
                              name="Referência 2"
                              value={editFormData['Referência 2'] || ''}
                              onChange={handleEditChange}
                              placeholder="(00) 00000-0000"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Parentesco</label>
                            <input
                              type="text"
                              name="Parentesco Ref. 2"
                              value={editFormData['Parentesco Ref. 2'] || ''}
                              onChange={handleEditChange}
                              placeholder="Ex: Pai, Amigo(a)"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Endereço Residencial */}
                  <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-xs font-black uppercase tracking-widest text-violet-400 flex items-center gap-2 border-b border-white/10 pb-2">
                      <MapPin size={14} /> 3. Endereço Residencial
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">CEP</label>
                        <input
                          type="text"
                          name="CEP"
                          value={editFormData['CEP'] || ''}
                          onChange={handleEditChange}
                          placeholder="00000-000"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rua / Logradouro</label>
                        <input
                          type="text"
                          name="Rua"
                          value={editFormData['Rua'] || ''}
                          onChange={handleEditChange}
                          placeholder="Rua / Avenida"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Número</label>
                        <input
                          type="text"
                          name="Número"
                          value={editFormData['Número'] || ''}
                          onChange={handleEditChange}
                          placeholder="Nº"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bairro</label>
                        <input
                          type="text"
                          name="Bairro"
                          value={editFormData['Bairro'] || ''}
                          onChange={handleEditChange}
                          placeholder="Bairro"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cidade</label>
                        <input
                          type="text"
                          name="Cidade"
                          value={editFormData['Cidade'] || ''}
                          onChange={handleEditChange}
                          placeholder="Cidade"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado (UF)</label>
                        <input
                          type="text"
                          name="Estado"
                          value={editFormData['Estado'] || ''}
                          onChange={handleEditChange}
                          placeholder="SP"
                          maxLength={2}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 uppercase"
                        />
                      </div>

                      {/* Anexo: Foto do Comprovante de Residência do Cliente */}
                      <div className="md:col-span-4 pt-1">
                        <DocumentAttachmentInput
                          label="Foto do Comprovante de Residência / Endereço do Cliente"
                          helperText="Anexe foto legível de conta de consumo ou correspondência recente"
                          value={editFormData['Foto Comprovante Residência Cliente']}
                          onChange={(val) => setEditFormData(prev => ({ ...prev, 'Foto Comprovante Residência Cliente': val }))}
                          accentColor="violet"
                          clientName={editFormData['Nome Completo'] || ''}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 4: Responsável */}
                  <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2 border-b border-white/10 pb-2">
                      <UserCheck size={14} /> 4. Dados do Responsável (Opcional)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Responsável</label>
                        <input
                          type="text"
                          name="Responsável Nome"
                          value={editFormData['Responsável Nome'] || ''}
                          onChange={handleEditChange}
                          placeholder="Nome do Responsável"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">CPF do Responsável</label>
                        <input
                          type="text"
                          name="Responsável CPF"
                          value={editFormData['Responsável CPF'] || ''}
                          onChange={handleEditChange}
                          placeholder="000.000.000-00"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">WhatsApp do Responsável</label>
                        <input
                          type="text"
                          name="Responsável WhatsApp"
                          value={editFormData['Responsável WhatsApp'] || ''}
                          onChange={handleEditChange}
                          placeholder="(00) 00000-0000"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>

                      {/* Referência 1 do Responsável */}
                      <div className="md:col-span-2 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Referência 1 (Responsável)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nome da Pessoa</label>
                            <input
                              type="text"
                              name="Responsável Nome Referência 1"
                              value={editFormData['Responsável Nome Referência 1'] || ''}
                              onChange={handleEditChange}
                              placeholder="Nome da pessoa"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                            <input
                              type="text"
                              name="Responsável Referência 1"
                              value={editFormData['Responsável Referência 1'] || ''}
                              onChange={handleEditChange}
                              placeholder="(00) 00000-0000"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Parentesco</label>
                            <input
                              type="text"
                              name="Responsável Parentesco Ref. 1"
                              value={editFormData['Responsável Parentesco Ref. 1'] || ''}
                              onChange={handleEditChange}
                              placeholder="Ex: Mãe, Esposo(a)"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Referência 2 do Responsável */}
                      <div className="md:col-span-2 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Referência 2 (Responsável)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nome da Pessoa</label>
                            <input
                              type="text"
                              name="Responsável Nome Referência 2"
                              value={editFormData['Responsável Nome Referência 2'] || ''}
                              onChange={handleEditChange}
                              placeholder="Nome da pessoa"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                            <input
                              type="text"
                              name="Responsável Referência 2"
                              value={editFormData['Responsável Referência 2'] || ''}
                              onChange={handleEditChange}
                              placeholder="(00) 00000-0000"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Parentesco</label>
                            <input
                              type="text"
                              name="Responsável Parentesco Ref. 2"
                              value={editFormData['Responsável Parentesco Ref. 2'] || ''}
                              onChange={handleEditChange}
                              placeholder="Ex: Pai, Amigo(a)"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Anexos: Documento e Comprovante do Responsável */}
                      <div className="md:col-span-2 pt-1">
                        <DocumentAttachmentInput
                          label="Foto do Documento do Responsável (RG / CPF / CNH)"
                          helperText="Anexe documento oficial com foto do responsável"
                          value={editFormData['Foto Documento Responsável']}
                          onChange={(val) => setEditFormData(prev => ({ ...prev, 'Foto Documento Responsável': val }))}
                          accentColor="sky"
                          clientName={editFormData['Responsável Nome'] || ''}
                        />
                      </div>
                      <div className="md:col-span-2 pt-1">
                        <DocumentAttachmentInput
                          label="Foto do Comprovante de Residência do Responsável"
                          helperText="Anexe comprovante de endereço do responsável"
                          value={editFormData['Foto Comprovante Residência Responsável']}
                          onChange={(val) => setEditFormData(prev => ({ ...prev, 'Foto Comprovante Residência Responsável': val }))}
                          accentColor="teal"
                          clientName={editFormData['Responsável Nome'] || ''}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 5: Dados Ópticos & Financeiro */}
                  <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 flex items-center gap-2 border-b border-white/10 pb-2">
                      <CreditCard size={14} /> 5. Situação Financeira &amp; Preferências
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status de Pagamento</label>
                        <select
                          name="Status de Pagamento"
                          value={editFormData['Status de Pagamento'] || 'Em dia'}
                          onChange={handleEditChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        >
                          <option value="Em dia">✅ Em dia</option>
                          <option value="Inadimplente">⚠️ Inadimplente</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Devedor (R$)</label>
                        <input
                          type="text"
                          name="Valor Devido"
                          value={editFormData['Valor Devido'] || ''}
                          onChange={handleEditChange}
                          placeholder="0,00"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Vencimento</label>
                        <input
                          type="date"
                          name="Data de Vencimento"
                          value={editFormData['Data de Vencimento'] || ''}
                          onChange={handleEditChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ações da Edição */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
                    >
                      <ArrowLeft size={16} /> Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-7 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center gap-2"
                    >
                      <Save size={16} /> Salvar Alterações
                    </button>
                  </div>
                </form>
              ) : (
                /* ─── MODO VISUALIZAÇÃO PADRÃO DO PERFIL ─── */
                <>
                  {/* Cards de Resumo Formatados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:border-amber-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <CreditCard size={13} className="text-amber-400"/> CPF / CNPJ
                      </p>
                      <p className="text-sm font-black text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {formatCPF_CNPJ(currentClient['CPF / CNPJ'] || currentClient['CPF'])}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:border-blue-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <CreditCard size={13} className="text-blue-400"/> Documento RG
                      </p>
                      <p className="text-sm font-black text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {formatRG(currentClient['RG'] || currentClient['rg'])}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:border-emerald-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <User size={13} className="text-emerald-400"/> Responsável
                      </p>
                      <p className="text-sm font-bold text-slate-200 truncate">
                        {currentClient['Responsável Nome'] || currentClient['Responsável'] || 'Titular da Conta'}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:border-pink-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Calendar size={13} className="text-pink-400"/> Vencimento
                      </p>
                      <p className="text-sm font-bold text-slate-200">
                        {currentClient['Data de Vencimento'] || currentClient['Vencimento'] || '—'}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:border-cyan-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Activity size={13} className="text-cyan-400"/> Lente Atual
                      </p>
                      <p className="text-sm font-bold text-slate-200 truncate">
                        {currentClient['Marca de Lente'] || currentClient['Lente'] || '—'}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center hover:border-indigo-500/30 transition-all">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <ShoppingBag size={13} className="text-indigo-400"/> Total de Compras
                      </p>
                      <p className="text-sm font-black text-indigo-300">
                        {clientHistory.length} {clientHistory.length === 1 ? 'pedido' : 'pedidos'}
                      </p>
                    </div>

                    <div className="col-span-1 sm:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 flex items-center gap-1.5">
                          <DollarSign size={13} className="text-emerald-400"/> Saldo Devedor em Aberto (ERP)
                        </p>
                        <p className={`text-xl font-bold font-mono tracking-tight ${realFinancials.saldoDevedorReal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          R$ {formatMoney(realFinancials.saldoDevedorReal)}
                        </p>
                        {realFinancials.totalRecebidoReal > 0 && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Total já quitado: <span className="text-emerald-400 font-bold font-mono">R$ {formatMoney(realFinancials.totalRecebidoReal)}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {realFinancials.saldoDevedorReal > 0 ? (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            realFinancials.statusReal === 'Inadimplente'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {realFinancials.statusReal === 'Inadimplente' ? 'Débito Vencido' : 'Parcelas em Aberto'}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            100% Em Dia
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações Complementares: Endereço & Responsável */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Endereço do Cliente */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h4 className="text-xs font-black uppercase tracking-widest text-violet-400 flex items-center gap-2 mb-3">
                        <MapPin size={14} /> Endereço Residencial do Cliente
                      </h4>
                      <div className="text-sm text-slate-300 space-y-1.5">
                        <p><span className="text-slate-500 font-bold">Logradouro:</span> <span className="text-white font-medium">{currentClient['Rua'] ? `${currentClient['Rua']}, Nº ${currentClient['Número'] || 'S/N'}` : 'Não informado'}</span></p>
                        <p><span className="text-slate-500 font-bold">Bairro:</span> <span className="text-slate-200">{currentClient['Bairro'] || '—'}</span></p>
                        <p><span className="text-slate-500 font-bold">Cidade/UF:</span> <span className="text-slate-200">{currentClient['Cidade'] ? `${currentClient['Cidade']} - ${currentClient['Estado'] || 'SP'}` : '—'} {currentClient['CEP'] ? `(CEP: ${currentClient['CEP']})` : ''}</span></p>
                      </div>

                      {/* Pessoas de Referência do Cliente */}
                      {(currentClient['Nome Referência 1'] || currentClient['Referência 1'] || currentClient['Nome Referência 2'] || currentClient['Referência 2']) && (
                        <div className="pt-3 border-t border-white/10 mt-3 space-y-2">
                          <p className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                            <Users size={13} /> Pessoas de Referência (Cliente):
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {(currentClient['Nome Referência 1'] || currentClient['Referência 1']) && (
                              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-teal-400/80 block">Ref. 1</span>
                                <div className="font-bold text-white text-sm truncate">
                                  {currentClient['Nome Referência 1'] || 'Pessoa não nomeada'}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-300">
                                  <Phone size={11} className="text-teal-400 shrink-0" />
                                  <span className="truncate">{currentClient['Referência 1'] || 'Sem tel.'}</span>
                                  {currentClient['Parentesco Ref. 1'] && (
                                    <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-bold ml-auto shrink-0">
                                      {currentClient['Parentesco Ref. 1']}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {(currentClient['Nome Referência 2'] || currentClient['Referência 2']) && (
                              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-teal-400/80 block">Ref. 2</span>
                                <div className="font-bold text-white text-sm truncate">
                                  {currentClient['Nome Referência 2'] || 'Pessoa não nomeada'}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-300">
                                  <Phone size={11} className="text-teal-400 shrink-0" />
                                  <span className="truncate">{currentClient['Referência 2'] || 'Sem tel.'}</span>
                                  {currentClient['Parentesco Ref. 2'] && (
                                    <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-bold ml-auto shrink-0">
                                      {currentClient['Parentesco Ref. 2']}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cadastro do Responsável */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h4 className="text-xs font-black uppercase tracking-widest text-sky-400 flex items-center gap-2 mb-3">
                        <User size={14} /> Dados do Responsável
                      </h4>
                      {(currentClient['Responsável Nome'] || currentClient['Responsável']) ? (
                        <div className="text-sm text-slate-300 space-y-1.5">
                          <p><span className="text-slate-500 font-bold">Nome:</span> <span className="text-white font-bold">{currentClient['Responsável Nome'] || currentClient['Responsável']}</span></p>
                          {currentClient['Responsável Data de Nascimento'] && (
                            <p><span className="text-slate-500 font-bold">Nascimento:</span> {currentClient['Responsável Data de Nascimento']}</p>
                          )}
                          <p>
                            <span className="text-slate-500 font-bold">CPF:</span> <span className="text-slate-200 font-medium">{formatCPF_CNPJ(currentClient['Responsável CPF'])}</span>
                            <span className="text-slate-500 font-bold ml-3">RG:</span> <span className="text-slate-200 font-medium">{formatRG(currentClient['Responsável RG'])}</span>
                          </p>
                          <p><span className="text-slate-500 font-bold">WhatsApp:</span> <span className="text-emerald-400 font-medium">{currentClient['Responsável WhatsApp'] || '—'}</span></p>
                          {(currentClient['Responsável Referência 1'] || currentClient['Responsável Referência 2'] || currentClient['Responsável Nome Referência 1'] || currentClient['Responsável Nome Referência 2']) && (
                            <div className="pt-3 border-t border-white/10 mt-3 space-y-2">
                              <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                <Users size={13} /> Pessoas de Referência (Responsável):
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {(currentClient['Responsável Nome Referência 1'] || currentClient['Responsável Referência 1']) && (
                                  <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 block">Ref. 1</span>
                                    <div className="font-bold text-white text-sm truncate">
                                      {currentClient['Responsável Nome Referência 1'] || 'Pessoa não nomeada'}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-slate-300">
                                      <Phone size={11} className="text-amber-400 shrink-0" />
                                      <span className="truncate">{currentClient['Responsável Referência 1'] || 'Sem tel.'}</span>
                                      {currentClient['Responsável Parentesco Ref. 1'] && (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto shrink-0">
                                          {currentClient['Responsável Parentesco Ref. 1']}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {(currentClient['Responsável Nome Referência 2'] || currentClient['Responsável Referência 2']) && (
                                  <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 block">Ref. 2</span>
                                    <div className="font-bold text-white text-sm truncate">
                                      {currentClient['Responsável Nome Referência 2'] || 'Pessoa não nomeada'}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-slate-300">
                                      <Phone size={11} className="text-amber-400 shrink-0" />
                                      <span className="truncate">{currentClient['Responsável Referência 2'] || 'Sem tel.'}</span>
                                      {currentClient['Responsável Parentesco Ref. 2'] && (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold ml-auto shrink-0">
                                          {currentClient['Responsável Parentesco Ref. 2']}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {currentClient['Responsável Rua'] && (
                            <p className="pt-2"><span className="text-slate-500 font-bold">Endereço:</span> {`${currentClient['Responsável Rua']}, ${currentClient['Responsável Número'] || 'S/N'} - ${currentClient['Responsável Bairro'] || ''}, ${currentClient['Responsável Cidade'] || ''}/${currentClient['Responsável Estado'] || ''}`}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-2">Nenhum responsável cadastrado para este cliente.</p>
                      )}
                    </div>
                  </div>

                  {/* ─── DOCUMENTOS & COMPROVANTES ANEXADOS (AUDITORIA / ADMIN) ─── */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-sky-400" />
                          Documentos &amp; Comprovantes Anexados
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Conferência de identidade e residência do cliente e responsável pelos administradores.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-bold transition-all"
                      >
                        <Edit2 size={13} /> Gerenciar Anexos
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Documento do Cliente */}
                      <DocumentAttachmentInput
                        label="Foto do Documento do Cliente (RG / CPF / CNH)"
                        helperText="Documento oficial de identificação do titular"
                        value={currentClient['Foto Documento Cliente'] || currentClient['fotoDocumentoCliente']}
                        onChange={(val) => {
                          const updated = { ...currentClient, 'Foto Documento Cliente': val };
                          setCurrentClient(updated);
                          if (onUpdateClient) onUpdateClient({ oldRow: currentClient, newRow: updated });
                          else if (onUpdateRow) onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updated);
                        }}
                        accentColor="indigo"
                        clientName={currentClient['Nome Completo'] || currentClient['NOME'] || ''}
                      />

                      {/* Comprovante de Residência do Cliente */}
                      <DocumentAttachmentInput
                        label="Foto do Comprovante de Residência (Cliente)"
                        helperText="Conta de consumo ou correspondência com endereço"
                        value={currentClient['Foto Comprovante Residência Cliente'] || currentClient['fotoComprovanteResidenciaCliente']}
                        onChange={(val) => {
                          const updated = { ...currentClient, 'Foto Comprovante Residência Cliente': val };
                          setCurrentClient(updated);
                          if (onUpdateClient) onUpdateClient({ oldRow: currentClient, newRow: updated });
                          else if (onUpdateRow) onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updated);
                        }}
                        accentColor="violet"
                        clientName={currentClient['Nome Completo'] || currentClient['NOME'] || ''}
                      />

                      {/* Documento do Responsável */}
                      <DocumentAttachmentInput
                        label="Foto do Documento do Responsável (RG / CPF / CNH)"
                        helperText="Documento do responsável legal / tutor"
                        value={currentClient['Foto Documento Responsável'] || currentClient['fotoDocumentoResponsavel']}
                        onChange={(val) => {
                          const updated = { ...currentClient, 'Foto Documento Responsável': val };
                          setCurrentClient(updated);
                          if (onUpdateClient) onUpdateClient({ oldRow: currentClient, newRow: updated });
                          else if (onUpdateRow) onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updated);
                        }}
                        accentColor="sky"
                        clientName={currentClient['Responsável Nome'] || currentClient['RESPONSAVEL'] || ''}
                      />

                      {/* Comprovante de Residência do Responsável */}
                      <DocumentAttachmentInput
                        label="Foto do Comprovante de Residência (Responsável)"
                        helperText="Comprovante de endereço do responsável"
                        value={currentClient['Foto Comprovante Residência Responsável'] || currentClient['fotoComprovanteResidenciaResponsavel']}
                        onChange={(val) => {
                          const updated = { ...currentClient, 'Foto Comprovante Residência Responsável': val };
                          setCurrentClient(updated);
                          if (onUpdateClient) onUpdateClient({ oldRow: currentClient, newRow: updated });
                          else if (onUpdateRow) onUpdateRow('CLIENTES_CADASTRADOS', currentClient, updated);
                        }}
                        accentColor="teal"
                        clientName={currentClient['Responsável Nome'] || currentClient['RESPONSAVEL'] || ''}
                      />
                    </div>
                  </div>

                  {/* Histórico de Compras */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black flex items-center gap-2"><ShoppingBag className="text-sky-400" size={18}/> Histórico de Compras</h3>
                  </div>

                  {/* Timeline de Histórico */}
                  {(localHistory && localHistory.length > 0) ? (
                    <div className="space-y-4 mb-6">
                      {localHistory.map((compra, index) => {
                        const dt = compra['DATA  DA VENDA'] || compra['DATA'] || compra['DATA ENTREGA ÓCULOS'] || 'Data Desconhecida';
                        const formatDt = dt instanceof Date ? dt.toLocaleDateString('pt-BR') : typeof dt === 'number' && dt > 30000 ? new Date((dt - 25569) * 86400 * 1000).toLocaleDateString('pt-BR') : dt;
                        const statusOS = compra['STATUS_OS'] || compra['SITUAÇÃO'] || '';
                        const hasOS = !!(compra['OS DA VENDA'] || compra['OS'] || compra['VENDA_OS']);

                        return (
                          <div key={index} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md">{formatDt}</span>
                                {statusOS && (
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    statusOS === 'Aguardando Confirmação'
                                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-sm'
                                      : statusOS === 'Entregue' || statusOS === 'Concluído' || statusOS === 'Pago'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : statusOS === 'Aguardando Lente'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                      : statusOS === 'Pronto para Retirada'
                                      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  }`}>
                                    {statusOS === 'Aguardando Confirmação' ? '🔵 Aguardando Confirmação' : statusOS}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">OS: {compra['OS DA VENDA'] || compra['OS'] || '—'}</span>
                                {onDeleteSale && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaleDeleteModalData({ index, compra, osNum: compra['OS DA VENDA'] || compra['OS'] || '—' });
                                      setSaleDeleteDebtChoice(true);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center rounded-full bg-white/0 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                                    title="Excluir OS / Venda com opção para dívidas"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1 mb-3">
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Descrição:</p>
                              <p className="text-sm font-bold text-slate-100 bg-black/30 p-2.5 rounded-xl border border-white/5">
                                {compra['PRODUTO'] || compra['LENTE'] || compra['ARMAÇÃO'] || compra['DESCRICAO'] || 'Óculos Completo'}
                              </p>
                              {compra['OBSERVACOES'] && (
                                <p className="text-xs text-slate-400 italic">
                                  <span className="font-semibold text-slate-500">Obs:</span> {compra['OBSERVACOES']}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-2">
                              <span className="text-sm font-black text-emerald-400">R$ {formatMoney(compra['VALOR TOTAL'] || compra['VALOR DO ORÇAMENTO'] || compra['VALOR DA VENDA'] || compra['VALOR'])}</span>
                              
                              <div className="flex items-center gap-2">
                                {/* Botão Editar OS */}
                                {hasOS && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOS(compra)}
                                    className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 font-bold px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 transition-all active:scale-95"
                                    title="Editar Dados da OS (Graus, Armação, Lente, Status, Prazos, Valores)"
                                  >
                                    <Pencil size={13} />
                                    <span>Editar OS</span>
                                  </button>
                                )}

                                {hasOS && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const compFormas = compra['FORMAS_PAGAMENTO'] || compra['MEIO_PAGAMENTO'] || compra['FORMA DE PAGAMENTO'] || '';
                                      const isApenasBoleto = /boleto|carnê|carne/i.test(compFormas) && !/dinheiro|pix|débito|debito|crédito|credito/i.test(compFormas);
                                      const compTotal = compra['VALOR TOTAL'] || compra['VALOR'] || '0,00';
                                      const compEntrada = compra['VALOR ENTRADA'] || compra['SINAL'] || (isApenasBoleto ? '0,00' : '0,00');
                                      const compRestante = compra['RESTANTE'] || (isApenasBoleto ? compTotal : '0,00');
                                      let parsedParcelas = [];
                                      if (Array.isArray(compra.parcelas)) {
                                        parsedParcelas = compra.parcelas;
                                      } else if (compra['PARCELAS_JSON']) {
                                        try {
                                          parsedParcelas = typeof compra['PARCELAS_JSON'] === 'string'
                                            ? JSON.parse(compra['PARCELAS_JSON'])
                                            : compra['PARCELAS_JSON'];
                                        } catch (_) {
                                          parsedParcelas = [];
                                        }
                                      }

                                      setOsDataForPrint({
                                        numeroOS: compra['OS DA VENDA'] || compra['OS'] || compra['VENDA_OS'],
                                        selectedCity: compra['CIDADE'] || compra['UNIDADE'] || currentClient['Cidade'] || 'Central',
                                        unidade: compra['CIDADE'] || compra['UNIDADE'] || currentClient['Cidade'] || 'Central',
                                        medico: compra['MEDICO'] || '',
                                        lente: compra['LENTE'] || compra['PRODUTO'] || '',
                                        armacao: compra['ARMAÇÃO'] || '',
                                        valorTotal: compTotal,
                                        valorEntrada: compEntrada,
                                        restante: compRestante,
                                        dataVenda: compra['DATA  DA VENDA'] || compra['DATA DA VENDA'] || compra['DATA_VENDA'] || compra['Data da Venda'] || compra['data_venda'] || compra['DATA'] || compra['Data'] || '',
                                        dataEntrega: compra['DATA ENTREGA ÓCULOS'] || compra['DATA_ENTREGA'] || compra['PREVISAO_ENTREGA'] || '',
                                        formasPagamento: compFormas,
                                        FORMA_ENTRADA: compra['FORMA_ENTRADA'] || compra['formaPagamentoEntrada'] || '',
                                        formaPagamentoEntrada: compra['formaPagamentoEntrada'] || compra['FORMA_ENTRADA'] || '',
                                        FORMA_RESTANTE: compra['FORMA_RESTANTE'] || compra['formaPagamentoRestante'] || '',
                                        formaPagamentoRestante: compra['formaPagamentoRestante'] || compra['FORMA_RESTANTE'] || '',
                                        parcelas: parsedParcelas,
                                        PARCELAS_JSON: compra['PARCELAS_JSON'] || '',
                                        isSecondaryOS: Boolean(compra.isSecondaryOS || compra.FINANCEIRO_UNIFICADO || compra.financeiroUnificado),
                                        financeiroUnificado: Boolean(compra.isSecondaryOS || compra.FINANCEIRO_UNIFICADO || compra.financeiroUnificado),
                                        nomePessoa: compra['PACIENTE'] || compra['NOME_BENEFICIARIO'] || compra.nomePessoa || '',
                                        PACIENTE: compra['PACIENTE'] || compra['NOME_BENEFICIARIO'] || compra.nomePessoa || '',
                                        observacoes: compra['OBSERVACOES'] || '',
                                        odEsf: compra['OD_ESF'] || '',
                                        odCil: compra['OD_CIL'] || '',
                                        odEixo: compra['OD_EIXO'] || '',
                                        odDnp: compra['OD_DNP'] || '',
                                        odAlt: compra['OD_ALT'] || '',
                                        oeEsf: compra['OE_ESF'] || '',
                                        oeCil: compra['OE_CIL'] || '',
                                        oeEixo: compra['OE_EIXO'] || '',
                                        oeDnp: compra['OE_DNP'] || '',
                                        oeAlt: compra['OE_ALT'] || '',
                                        adicao: compra['ADICAO'] || ''
                                      });
                                      setIsPrintingProfile(false);
                                      setTimeout(() => {
                                        window.print();
                                        setTimeout(() => setOsDataForPrint(null), 1500);
                                      }, 300);
                                    }}
                                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                                  >
                                    <Printer size={13} /> Imprimir OS
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl mb-6">
                      <p className="text-xs text-slate-500">Nenhuma compra registrada para este cliente.</p>
                    </div>
                  )}

                  {/* Boletos do Cliente (Contas a Receber) */}
                  {clientErpInvoices && clientErpInvoices.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-emerald-400">
                          <DollarSign size={18} /> Mensalidades e Boletos (Financeiro)
                        </h3>
                        <span className="text-xs text-slate-400 font-medium">
                          {clientErpInvoices.length} {clientErpInvoices.length === 1 ? 'duplicata vinculada' : 'duplicatas vinculadas'}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-950 text-slate-400 border-b border-white/5 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="p-3 font-black">Descrição / Venda OS</th>
                              <th className="p-3 font-black">Vencimento</th>
                              <th className="p-3 font-black">Valor</th>
                              <th className="p-3 font-black text-center">Situação</th>
                              <th className="p-3 font-black text-center">Comprovante</th>
                              <th className="p-3 font-black text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientErpInvoices.sort((a,b) => {
                              const dA = new Date(a.DATA_VENCIMENTO || a['DATA VENCIMENTO'] || a.VENCIMENTO || 0);
                              const dB = new Date(b.DATA_VENCIMENTO || b['DATA VENCIMENTO'] || b.VENCIMENTO || 0);
                              return dA - dB;
                            }).map((inv, idx) => {
                              const dtVenc = inv.DATA_VENCIMENTO || inv['DATA VENCIMENTO'] || inv.VENCIMENTO;
                              let formatVenc = dtVenc;
                              if (dtVenc) {
                                const [y,m,d] = String(dtVenc).split('-');
                                if (y && m && d) formatVenc = `${d}/${m}/${y}`;
                              }
                              const status = inv.STATUS || inv.status || 'Pendente';
                              const isPaid = status === 'Recebido' || status === 'Pago';
                              const statusColor = isPaid 
                                ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' 
                                : status.includes('Atrasado') || status.includes('Inadimplente') 
                                ? 'text-rose-400 bg-rose-400/10 border-rose-400/20' 
                                : 'text-amber-400 bg-amber-400/10 border-amber-400/20';
                              const hasReceipt = Boolean(inv.COMPROVANTE || inv.comprovante || inv.ANEXO_COMPROVANTE);

                              return (
                                <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                  <td className="p-3 font-bold text-slate-300">
                                    {inv.DESCRICAO || inv.descricao || `Venda OS #${inv.VENDA_OS || inv.OS}`}
                                  </td>
                                  <td className="p-3 font-medium text-slate-400">
                                    {formatVenc}
                                  </td>
                                  <td className="p-3 font-black text-slate-200">
                                    R$ {formatMoney(parseCurrency(inv.VALOR))}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider inline-block ${statusColor}`}>
                                      {status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    {hasReceipt ? (
                                      <button
                                        type="button"
                                        onClick={() => setReceiptModalInvoice(inv)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shadow-sm"
                                        title="Ver Comprovante Anexado"
                                      >
                                        <Paperclip size={12} />
                                        <span>Comprovante</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setReceiptModalInvoice(inv)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
                                        title="Anexar Comprovante de Pagamento"
                                      >
                                        <Upload size={11} />
                                        <span>Anexar</span>
                                      </button>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {isPaid ? (
                                      <span className="text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                                        <CheckCircle size={11} /> Quitado
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleSettleSingleInvoice(inv)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shadow-sm"
                                        title="Quitar esta parcela e lançar no Fluxo de Caixa"
                                      >
                                        <CheckCircle size={11} />
                                        <span>Quitar</span>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Form de Registro de Pagamento */}
                  <AnimatePresence>
                    {isRegisteringPayment && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (onRegisterPayment) {
                            onRegisterPayment(paymentAmount, paymentOS);
                            setIsRegisteringPayment(false);
                            setPaymentAmount('');
                            setPaymentOS('');
                          }
                        }}
                        className="mb-6 p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                            <DollarSign size={15} /> Registrar Pagamento do Cliente
                          </h4>
                          {parseCurrency(currentClient['Valor Devido']) > 0 && (
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(formatMoney(currentClient['Valor Devido']))}
                              className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all"
                            >
                              Preencher Saldo Devedor (R$ {formatMoney(currentClient['Valor Devido'])})
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-emerald-400 font-bold ml-1">Valor do Pagamento (R$)</label>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              required 
                              placeholder="0,00" 
                              value={paymentAmount} 
                              onChange={e => setPaymentAmount(e.target.value)} 
                              onBlur={e => {
                                const num = parseCurrency(e.target.value);
                                if (num > 0) setPaymentAmount(formatMoney(num));
                              }}
                              className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60" 
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-emerald-400 font-bold ml-1">OS Selecionada</label>
                            <input 
                              type="text" 
                              placeholder="Nenhuma ou digite o Nº da OS" 
                              value={paymentOS} 
                              onChange={e => setPaymentOS(e.target.value)} 
                              className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500/60" 
                            />
                          </div>
                        </div>

                        {/* Botões de Seleção das OSs Existentes do Cliente */}
                        <div className="space-y-2 pt-1">
                          <label className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-between">
                            <span>Clique no botão para selecionar a OS referente:</span>
                            {paymentOS ? (
                              <span className="text-emerald-400 font-black">Vinculado à OS: {paymentOS}</span>
                            ) : (
                              <span className="text-slate-500">Sem OS vinculada (Avulso)</span>
                            )}
                          </label>

                          <div className="flex flex-wrap gap-2">
                            {clientOSList.length > 0 ? (
                              clientOSList.map(osNum => (
                                <button
                                  key={osNum}
                                  type="button"
                                  onClick={() => setPaymentOS(osNum)}
                                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                    paymentOS === osNum
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/25 scale-[1.02]'
                                      : 'bg-black/40 text-slate-300 border-white/10 hover:border-emerald-500/40 hover:text-white'
                                  }`}
                                >
                                  <ClipboardList size={13} /> OS #{osNum}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500 italic py-1">Nenhuma OS anterior encontrada no histórico do cliente.</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setPaymentOS('')}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                                !paymentOS
                                  ? 'bg-slate-700 text-white border-slate-500 font-black'
                                  : 'bg-black/40 text-slate-400 border-white/10 hover:text-white'
                              }`}
                            >
                              Sem OS / Pagamento Geral
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/20">
                          <button type="button" onClick={() => setIsRegisteringPayment(false)} className="px-5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all">
                            Cancelar
                          </button>
                          <button type="submit" className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-1.5">
                            <CheckCircle size={14} /> Confirmar Pagamento {paymentOS ? `(OS: ${paymentOS})` : ''}
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Barra de Ações do Rodapé do Modal */}
                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 w-full pt-4 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handlePrintProfile}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-all shadow-md"
                        title="Imprimir Ficha Cadastral Completa do Cliente e Responsável Legal"
                      >
                        <Printer size={15} /> Imprimir Ficha Cadastral
                      </button>

                      <button
                        onClick={() => {
                          if (onEditClick) {
                            onEditClick(currentClient);
                          } else {
                            setIsEditing(true);
                          }
                        }}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 transition-all shadow-md shadow-sky-500/10"
                      >
                        <Edit2 size={15} /> Editar Cadastro
                      </button>
                      
                      {onGenerateOS && (
                        <button
                          onClick={() => onGenerateOS(currentClient)}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20"
                        >
                          <ClipboardList size={15} /> Gerar OS
                        </button>
                      )}

                      <button
                        onClick={() => setIsRegisteringPayment(!isRegisteringPayment)}
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                          isRegisteringPayment 
                            ? 'bg-white/10 text-white' 
                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                        }`}
                      >
                        <DollarSign size={15} /> Registrar Pagamento
                      </button>

                      {['admin', 'administrativo'].includes(currentUser?.role) && onDeleteClient && (
                        <button
                          type="button"
                          onClick={() => {
                            const nome = currentClient['Nome Completo'] || currentClient['NOME'] || 'este cliente';
                            if (window.confirm(`Tem certeza que deseja excluir o cadastro do cliente "${nome}"? Esta ação removerá o cliente da base de dados e não pode ser desfeita.`)) {
                              onDeleteClient(currentClient);
                              onClose();
                            }
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all"
                          title="Excluir Cliente (Somente Administradores)"
                        >
                          <Trash2 size={15} /> Excluir
                        </button>
                      )}
                    </div>

                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-center">
                      Fechar
                    </button>
                  </div>
                </>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      {osDataForPrint && currentClient && (
        <PrintableOS clientData={currentClient} osData={osDataForPrint} />
      )}
      {(isPrintingProfile || (!osDataForPrint && isOpen)) && currentClient && (
        <PrintableClientProfile clientData={currentClient} storeName="YASMIN ÓTICA" />
      )}
      {/* Modal de Edição de OS */}
      <EditOSModal
        isOpen={!!editingOS}
        onClose={() => setEditingOS(null)}
        osData={editingOS}
        clientData={currentClient}
        currentUser={currentUser}
        onSave={handleSaveOS}
      />
      {/* Toast de Sucesso da OS */}
      <AnimatePresence>
        {osSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs uppercase tracking-wider"
          >
            <CheckCircle2 size={18} />
            <span>OS atualizada com sucesso! Enviada para Aguardando Confirmação do Financeiro.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Anexo e Visualização de Comprovante de Pagamento da Mensalidade */}
      <ReceiptModal
        isOpen={Boolean(receiptModalInvoice)}
        onClose={() => setReceiptModalInvoice(null)}
        row={receiptModalInvoice}
        onSave={async ({ comprovante, nomeArquivo, dataAnexo, markAsPaid }) => {
          if (onUpdateRow && receiptModalInvoice) {
            const updated = {
              ...receiptModalInvoice,
              COMPROVANTE: comprovante,
              comprovante: comprovante,
              DATA_COMPROVANTE: dataAnexo,
              NOME_COMPROVANTE: nomeArquivo,
              ...(markAsPaid ? { STATUS: 'Recebido', status: 'Recebido', DATA_RECEBIMENTO: new Date().toLocaleDateString('pt-BR') } : {})
            };
            await onUpdateRow('CONTAS_RECEBER', receiptModalInvoice, updated);
            setReceiptModalInvoice(updated);
          }
        }}
        onDelete={async () => {
          if (onUpdateRow && receiptModalInvoice) {
            const updated = {
              ...receiptModalInvoice,
              COMPROVANTE: '',
              comprovante: '',
              ANEXO_COMPROVANTE: '',
              DATA_COMPROVANTE: '',
              NOME_COMPROVANTE: ''
            };
            await onUpdateRow('CONTAS_RECEBER', receiptModalInvoice, updated);
            setReceiptModalInvoice(updated);
          }
        }}
      />

      {/* ─── MODAL DE QUITAÇÃO DE PARCELA COM OPÇÃO DE CONTABILIZAR NO CAIXA ─── */}
      <AnimatePresence>
        {settleModalInvoice && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Recebimento de Parcela</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {settleModalInvoice.VENDA_OS || settleModalInvoice.OS ? `OS #${settleModalInvoice.VENDA_OS || settleModalInvoice.OS}` : 'Conta a Receber'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettleModalInvoice(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-white/5 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Descrição:</span>
                  <span className="text-white font-bold">{settleModalInvoice.DESCRICAO || settleModalInvoice.descricao || 'Parcela'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Valor da Parcela:</span>
                  <span className="text-emerald-400 font-black text-sm">
                    R$ {formatMoney(parseCurrency(settleModalInvoice.VALOR || settleModalInvoice.valor))}
                  </span>
                </div>
                {settleModalInvoice.DATA_VENCIMENTO && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Vencimento Original:</span>
                    <span className="text-slate-300 font-mono">{settleModalInvoice.DATA_VENCIMENTO}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                  Data Efetiva do Pagamento
                </label>
                <input
                  type="date"
                  value={settlePaymentDate}
                  onChange={(e) => setSettlePaymentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Opção para Contar no Caixa ou Não */}
              <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-400" />
                    Contabilizar no Fluxo de Caixa?
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettleCountInCash(prev => !prev)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      settleCountInCash
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {settleCountInCash ? 'SIM (No Caixa)' : 'NÃO (Apenas Baixa)'}
                  </button>
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-400">
                  {settleCountInCash
                    ? '✅ O valor entrará como RECEBIMENTO no livro caixa da loja e somará no fechamento diário.'
                    : '⚠️ Apenas baixa administrativa/contábil: o saldo devedor do cliente será abatido, mas o dinheiro NÃO entrará no caixa da loja.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleModalInvoice(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSettleModal}
                  disabled={isSubmittingSettle}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20"
                >
                  {isSubmittingSettle ? 'Processando...' : 'Confirmar Recebimento'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL DE EXCLUSÃO DE OS COM OPÇÃO DE APAGAR OU MANTER DÍVIDA ─── */}
      <AnimatePresence>
        {saleDeleteModalData && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Trash2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Exclusão de Ordem de Serviço</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      OS #{saleDeleteModalData.osNum}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSaleDeleteModalData(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Você solicitou a exclusão desta Ordem de Serviço. Como deseja tratar as <strong>dívidas / parcelas</strong> vinculadas a ela?
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setSaleDeleteDebtChoice(true)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                    saleDeleteDebtChoice
                      ? 'bg-rose-500/15 border-rose-500/50 shadow-sm'
                      : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${saleDeleteDebtChoice ? 'border-rose-400 bg-rose-500' : 'border-slate-600'}`}>
                      {saleDeleteDebtChoice && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className="text-xs font-black text-white">🔴 Apagar a OS e ELIMINAR a dívida (Padrão)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 pl-6">
                    Exclui a OS, apaga as parcelas em Contas a Receber e zera a cobrança desta OS na ficha do cliente.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleDeleteDebtChoice(false)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                    !saleDeleteDebtChoice
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
                      : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!saleDeleteDebtChoice ? 'border-amber-400 bg-amber-500' : 'border-slate-600'}`}>
                      {!saleDeleteDebtChoice && <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                    </div>
                    <span className="text-xs font-black text-white">🟡 Apagar a OS e MANTER a dívida ativa</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 pl-6">
                    Exclui a OS da produção/laboratório, mas preserva os boletos e o saldo devedor do cliente para cobrança ativa.
                  </p>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleDeleteModalData(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaleDelete}
                  disabled={isDeletingSale}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-500/20"
                >
                  {isDeletingSale ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ClientProfileModal;
