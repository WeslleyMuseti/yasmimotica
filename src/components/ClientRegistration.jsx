import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, PhoneCall, Mail, MapPin, Map, Home, Building2, Hash, Compass, 
  CreditCard, CheckCircle, CheckCircle2, ArrowLeft, AtSign, PlusCircle, Users, 
  UserCheck, Download, Eye, Glasses, Tag, AlertTriangle, DollarSign, Calendar, 
  Activity, Sparkles, Layers, ShieldCheck, FileText, Clock, Edit2, Trash2, Save, Check
} from 'lucide-react';
import DataTable from './DataTable';
import OSGeneratorModal from './OSGeneratorModal';
import PrintableOS from './PrintableOS';
import ClientProfileModal from './ClientProfileModal';
import DocumentAttachmentInput from './DocumentAttachmentInput';
import * as XLSX from 'xlsx';
import { isSameClient } from '../firebaseSync';
import { executeOSCascadeDeletion } from '../osDeletionUtils';

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

const isValidCpfCnpj = (val) => {
  if (!val) return true; // Allows empty
  const clean = val.replace(/[^\d]+/g, '');
  if (clean.length === 0) return true;
  if (clean.length === 11) {
    if (/^(\d)\1{10}$/.test(clean)) return false;
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(clean.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(clean.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(10))) return false;
    return true;
  } else if (clean.length === 14) {
    if (/^(\d)\1{13}$/.test(clean)) return false;
    let size = clean.length - 2;
    let numbers = clean.substring(0, size);
    const digits = clean.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += numbers.charAt(size - i) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    size = size + 1;
    numbers = clean.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += numbers.charAt(size - i) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
  }
  return false;
};

const checkClientDuplicate = (form, editingClient, clients) => {
  if (!form || !clients || clients.length === 0) return { isDuplicate: false, errorName: '', errorCpf: '' };

  const formName = String(form['Nome Completo'] || form['NOME'] || '').trim().toLowerCase();
  const formCpf = String(form['CPF / CNPJ'] || form['CPF'] || '').replace(/\D/g, '');
  const formHasResp = Boolean(
    String(form['Responsável Nome'] || form['Responsável'] || '').trim() || 
    String(form['Responsável CPF'] || '').replace(/\D/g, '')
  );

  let errorName = '';
  let errorCpf = '';

  const editId = editingClient?.id || editingClient?.['_id'];
  const editOriginalName = String(editingClient?.['Nome Completo'] || editingClient?.['NOME'] || editingClient?.['Nome'] || '').trim().toLowerCase();
  const editOriginalCpf = String(editingClient?.['CPF / CNPJ'] || editingClient?.['CPF'] || '').replace(/\D/g, '');

  for (const c of clients) {
    if (editingClient) {
      if (c === editingClient) continue;
      if (editId && (c.id === editId || c['_id'] === editId)) continue;
      
      // Se coincidir com o cadastro que está sendo editado
      const cItemName = String(c['Nome Completo'] || c['NOME'] || '').trim().toLowerCase();
      const cItemCpf = String(c['CPF / CNPJ'] || c['CPF'] || '').replace(/\D/g, '');
      if (editOriginalName && cItemName === editOriginalName) {
        if (!editOriginalCpf || cItemCpf === editOriginalCpf) {
          continue;
        }
      }
    }

    const cName = String(c['Nome Completo'] || c['NOME'] || '').trim().toLowerCase();
    const cCpf = String(c['CPF / CNPJ'] || c['CPF'] || '').replace(/\D/g, '');
    const cHasResp = Boolean(
      String(c['Responsável Nome'] || c['Responsável'] || '').trim() || 
      String(c['Responsável CPF'] || '').replace(/\D/g, '')
    );

    // Validação de CPF Duplicado
    if (formCpf && formCpf.length >= 11 && cCpf && cCpf === formCpf) {
      const isRespLink = formHasResp || cHasResp;
      if (!isRespLink) {
        errorCpf = `O CPF informado já pertence ao cliente "${c['Nome Completo'] || c['NOME']}". Só é permitido repetir CPF se for Responsável de dependente.`;
      }
    }

    // Validação de Nome Duplicado
    if (formName && formName.length >= 3 && cName && cName === formName) {
      const isRespLink = formHasResp || cHasResp;
      if (!isRespLink) {
        errorName = `Já existe um cliente cadastrado com o nome "${c['Nome Completo'] || c['NOME']}". Só é permitido repetir nome se for dependente com Responsável preenchido.`;
      }
    }
  }

  return {
    isDuplicate: Boolean(errorName || errorCpf),
    errorName,
    errorCpf
  };
};

const ClientRegistration = ({ currentUser, clientsData, salesData = [], lentesData = [], armacoesData = [], receberData = [], data = {}, onAddClient, onUpdateClient, onDeleteClient, onAddSale, onUpdateSale, onDeleteSale, onAddRow, onUpdateRow, onDeleteRow, onBack, initialTab = 'todos' }) => {
  const [activeTab, setActiveTab] = useState(() => initialTab === 'novo' ? 'todos' : initialTab);
  const [osClientData, setOsClientData] = useState(null);
  const [osSaleData, setOsSaleData] = useState(null);
  const [osDataForPrint, setOsDataForPrint] = useState(null);
  const [profileClientData, setProfileClientData] = useState(null);
  const [isAdding, setIsAdding] = useState(() => initialTab === 'novo');
  const [editingClientData, setEditingClientData] = useState(null);

  useEffect(() => {
    if (initialTab === 'novo') {
      setIsAdding(true);
      setEditingClientData(null);
    } else if (initialTab && initialTab !== 'novo') {
      setActiveTab(initialTab);
      setIsAdding(false);
    }
  }, [initialTab]);

  const userCity = currentUser?.role === 'vendedor' ? (currentUser.city || currentUser.assignedStore || null) : null;
  const filteredLentes = useMemo(() => {
    if (!userCity) return lentesData;
    return (lentesData || []).filter(l => {
      const u = String(l.UNIDADE || l.CIDADE || l.LOJA || l.Unidade || '').trim().toUpperCase();
      return u && u !== 'CENTRAL' && u.includes(userCity.toUpperCase());
    });
  }, [lentesData, userCity]);

  const filteredArmacoes = useMemo(() => {
    if (!userCity) return armacoesData;
    return (armacoesData || []).filter(a => {
      const u = String(a.UNIDADE || a.CIDADE || a.LOJA || a.Unidade || '').trim().toUpperCase();
      return u && u !== 'CENTRAL' && u.includes(userCity.toUpperCase());
    });
  }, [armacoesData, userCity]);

  const [duplicateNameError, setDuplicateNameError] = useState('');
  const [duplicateCpfError, setDuplicateCpfError] = useState('');

  const [formData, setFormData] = useState({
    'Nome Completo': '',
    'Data de Nascimento': '',
    'CPF / CNPJ': '',
    'RG': '',
    'WhatsApp': '',
    'Nome Referência 1': '',
    'Referência 1': '',
    'Parentesco Ref. 1': '',
    'Nome Referência 2': '',
    'Referência 2': '',
    'Parentesco Ref. 2': '',
    'E-mail': '',
    'Instagram': '',
    'Facebook': '',
    'TikTok': '',
    'CEP': '',
    'Rua': '',
    'Número': '',
    'Bairro': '',
    'Cidade': '',
    'Estado': '',
    'Responsável Nome': '',
    'Responsável Data de Nascimento': '',
    'Responsável CPF': '',
    'Responsável RG': '',
    'Responsável WhatsApp': '',
    'Responsável Nome Referência 1': '',
    'Responsável Referência 1': '',
    'Responsável Parentesco Ref. 1': '',
    'Responsável Nome Referência 2': '',
    'Responsável Referência 2': '',
    'Responsável Parentesco Ref. 2': '',
    'Responsável Instagram': '',
    'Responsável Facebook': '',
    'Responsável TikTok': '',
    'Responsável CEP': '',
    'Responsável Rua': '',
    'Responsável Número': '',
    'Responsável Bairro': '',
    'Responsável Cidade': '',
    'Responsável Estado': '',
    // Documentos e Comprovantes Anexados (Cliente e Responsável)
    'Foto Documento Cliente': '',
    'Foto Comprovante Residência Cliente': '',
    'Foto Documento Responsável': '',
    'Foto Comprovante Residência Responsável': '',
    // Dados Completos de Óptica e OS
    'Marca de Lente': '',
    'Modelo de Armação': '',
    'Status de Pagamento': 'Em dia',
    'Valor Devido': '',
    'Data de Vencimento': '',
    numeroOS: '',
    medico: '',
    dataEntrega: '',
    unidadeOS: '',
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
    adicao: '',
    valorTotal: '',
    valorEntrada: '',
    restante: '',
    formasPagamento: '',
    observacoes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [responsavelCpfError, setResponsavelCpfError] = useState('');

  const handleStartEditClient = (client) => {
    if (!client) return;
    setEditingClientData(client);

    const clientName = (client['Nome Completo'] || client['NOME'] || client['Nome'] || '').toLowerCase().trim();
    const lastSale = salesData && salesData.length > 0
      ? salesData.slice().reverse().find(s => {
          const sName = (s['NOME CLIENTE'] || s['NOME'] || s['Cliente'] || '').toLowerCase().trim();
          return clientName && (sName === clientName || sName.includes(clientName) || clientName.includes(sName));
        })
      : null;

    setFormData({
      id: client.id || client['_id'] || undefined,
      'Nome Completo': client['Nome Completo'] || client['NOME'] || client['Nome'] || client['NOME DO CLIENTE'] || client['CLIENTE'] || '',
      'Data de Nascimento': client['Data de Nascimento'] || client['DATA NASCIMENTO'] || client['DATA_NASCIMENTO'] || client['Dt. Nasc.'] || '',
      'CPF / CNPJ': client['CPF / CNPJ'] || client['CPF'] || client['CNPJ'] || client['CPF/CNPJ'] || '',
      'RG': client['RG'] || client['RG / IE'] || client['rg'] || '',
      'WhatsApp': client['WhatsApp'] || client['TELEFONE'] || client['TELEFONE CLIENTE'] || client['Celular'] || client['TEL'] || '',
      'Nome Referência 1': client['Nome Referência 1'] || client['Nome Ref. 1'] || client['NOME_REF_1'] || client['NOME REFERENCIA 1'] || '',
      'Referência 1': client['Referência 1'] || client['REFERENCIA 1'] || client['Ref. 1'] || '',
      'Parentesco Ref. 1': client['Parentesco Ref. 1'] || client['PARENTESCO REF. 1'] || client['Parentesco 1'] || '',
      'Nome Referência 2': client['Nome Referência 2'] || client['Nome Ref. 2'] || client['NOME_REF_2'] || client['NOME REFERENCIA 2'] || '',
      'Referência 2': client['Referência 2'] || client['REFERENCIA 2'] || client['Ref. 2'] || '',
      'Parentesco Ref. 2': client['Parentesco Ref. 2'] || client['PARENTESCO REF. 2'] || client['Parentesco 2'] || '',
      'E-mail': client['E-mail'] || client['EMAIL'] || client['Email'] || '',
      'Instagram': client['Instagram'] || client['INSTAGRAM'] || '',
      'Facebook': client['Facebook'] || client['FACEBOOK'] || '',
      'TikTok': client['TikTok'] || client['TIKTOK'] || '',
      'CEP': client['CEP'] || '',
      'Rua': client['Rua'] || client['RUA'] || client['ENDEREÇO'] || client['Endereco'] || client['Logradouro'] || '',
      'Número': client['Número'] || client['NUMERO'] || client['Nº'] || client['Numero'] || '',
      'Bairro': client['Bairro'] || client['BAIRRO'] || '',
      'Cidade': client['Cidade'] || client['CIDADE'] || client['UNIDADE'] || client['Loja'] || '',
      'Estado': client['Estado'] || client['ESTADO'] || client['UF'] || '',
      'Responsável Nome': client['Responsável Nome'] || client['Responsável'] || client['RESPONSAVEL'] || client['NOME RESPONSAVEL'] || '',
      'Responsável Data de Nascimento': client['Responsável Data de Nascimento'] || client['RESPONSAVEL_DATA_NASCIMENTO'] || '',
      'Responsável CPF': client['Responsável CPF'] || client['RESPONSAVEL_CPF'] || '',
      'Responsável RG': client['Responsável RG'] || client['RESPONSAVEL_RG'] || '',
      'Responsável WhatsApp': client['Responsável WhatsApp'] || client['RESPONSAVEL_WHATSAPP'] || client['RESPONSAVEL_TELEFONE'] || '',
      'Responsável Nome Referência 1': client['Responsável Nome Referência 1'] || client['Responsável Nome Ref. 1'] || client['RESPONSAVEL_NOME_REF_1'] || '',
      'Responsável Referência 1': client['Responsável Referência 1'] || client['RESPONSAVEL_REF_1'] || '',
      'Responsável Parentesco Ref. 1': client['Responsável Parentesco Ref. 1'] || client['RESPONSAVEL_PARENTESCO_1'] || '',
      'Responsável Nome Referência 2': client['Responsável Nome Referência 2'] || client['Responsável Nome Ref. 2'] || client['RESPONSAVEL_NOME_REF_2'] || '',
      'Responsável Referência 2': client['Responsável Referência 2'] || client['RESPONSAVEL_REF_2'] || '',
      'Responsável Parentesco Ref. 2': client['Responsável Parentesco Ref. 2'] || client['RESPONSAVEL_PARENTESCO_2'] || '',
      'Responsável Instagram': client['Responsável Instagram'] || client['RESPONSAVEL_INSTAGRAM'] || '',
      'Responsável Facebook': client['Responsável Facebook'] || client['RESPONSAVEL_FACEBOOK'] || '',
      'Responsável TikTok': client['Responsável TikTok'] || client['RESPONSAVEL_TIKTOK'] || '',
      'Responsável CEP': client['Responsável CEP'] || client['RESPONSAVEL_CEP'] || '',
      'Responsável Rua': client['Responsável Rua'] || client['RESPONSAVEL_RUA'] || client['RESPONSAVEL_ENDERECO'] || '',
      'Responsável Número': client['Responsável Número'] || client['RESPONSAVEL_NUMERO'] || '',
      'Responsável Bairro': client['Responsável Bairro'] || client['RESPONSAVEL_BAIRRO'] || '',
      'Responsável Cidade': client['Responsável Cidade'] || client['RESPONSAVEL_CIDADE'] || '',
      'Responsável Estado': client['Responsável Estado'] || client['RESPONSAVEL_ESTADO'] || '',
      // Documentos e Comprovantes Anexados (Cliente e Responsável)
      'Foto Documento Cliente': client['Foto Documento Cliente'] || client['fotoDocumentoCliente'] || client['FOTO_DOCUMENTO_CLIENTE'] || '',
      'Foto Comprovante Residência Cliente': client['Foto Comprovante Residência Cliente'] || client['fotoComprovanteResidenciaCliente'] || client['FOTO_COMPROVANTE_CLIENTE'] || '',
      'Foto Documento Responsável': client['Foto Documento Responsável'] || client['fotoDocumentoResponsavel'] || client['FOTO_DOCUMENTO_RESPONSAVEL'] || '',
      'Foto Comprovante Residência Responsável': client['Foto Comprovante Residência Responsável'] || client['fotoComprovanteResidenciaResponsavel'] || client['FOTO_COMPROVANTE_RESPONSAVEL'] || '',
      'Marca de Lente': client['Marca de Lente'] || client['LENTE'] || client['MARCA DE LENTE'] || client['Lente'] || lastSale?.['LENTE'] || lastSale?.['PRODUTO'] || '',
      'Modelo de Armação': client['Modelo de Armação'] || client['ARMAÇÃO'] || client['MODELO DE ARMAÇÃO'] || client['ARMACAO'] || client['Armação'] || lastSale?.['ARMAÇÃO'] || '',
      'Status de Pagamento': client['Status de Pagamento'] || client['STATUS'] || client['status'] || 'Em dia',
      'Valor Devido': client['Valor Devido'] || client['VALOR DEVIDO'] || client['VALOR_DEVIDO'] || client['SALDO_DEVEDOR'] || '',
      'Data de Vencimento': client['Data de Vencimento'] || client['DATA VENCIMENTO'] || client['DATA_VENCIMENTO'] || '',
      // Campos Completos da OS
      numeroOS: client['numeroOS'] || client['OS DA VENDA'] || client['OS'] || client['VENDA_OS'] || lastSale?.['OS DA VENDA'] || lastSale?.['OS'] || '',
      medico: client['medico'] || client['MEDICO'] || client['Médico'] || lastSale?.['MEDICO'] || '',
      dataEntrega: client['dataEntrega'] || client['DATA ENTREGA ÓCULOS'] || client['DATA_ENTREGA'] || client['PREVISAO_ENTREGA'] || lastSale?.['DATA ENTREGA ÓCULOS'] || '',
      unidadeOS: client['unidadeOS'] || client['UNIDADE'] || client['Cidade'] || client['CIDADE'] || lastSale?.['CIDADE'] || lastSale?.['LOJA'] || '',
      odEsf: client['odEsf'] || client['OD_ESF'] || lastSale?.['OD_ESF'] || '',
      odCil: client['odCil'] || client['OD_CIL'] || lastSale?.['OD_CIL'] || '',
      odEixo: client['odEixo'] || client['OD_EIXO'] || lastSale?.['OD_EIXO'] || '',
      odDnp: client['odDnp'] || client['OD_DNP'] || lastSale?.['OD_DNP'] || '',
      odAlt: client['odAlt'] || client['OD_ALT'] || lastSale?.['OD_ALT'] || '',
      oeEsf: client['oeEsf'] || client['OE_ESF'] || lastSale?.['OE_ESF'] || '',
      oeCil: client['oeCil'] || client['OE_CIL'] || lastSale?.['OE_CIL'] || '',
      oeEixo: client['oeEixo'] || client['OE_EIXO'] || lastSale?.['OE_EIXO'] || '',
      oeDnp: client['oeDnp'] || client['OE_DNP'] || lastSale?.['OE_DNP'] || '',
      oeAlt: client['oeAlt'] || client['OE_ALT'] || lastSale?.['OE_ALT'] || '',
      adicao: client['adicao'] || client['ADICAO'] || lastSale?.['ADICAO'] || '',
      valorTotal: client['valorTotal'] || client['VALOR TOTAL'] || client['VALOR DA VENDA'] || client['VALOR DO ORÇAMENTO'] || lastSale?.['VALOR TOTAL'] || client['Valor Devido'] || '',
      valorEntrada: client['valorEntrada'] || client['VALOR ENTRADA'] || client['SINAL'] || lastSale?.['VALOR ENTRADA'] || '',
      restante: client['restante'] || client['RESTANTE'] || lastSale?.['RESTANTE'] || '',
      formasPagamento: client['formasPagamento'] || client['FORMAS_PAGAMENTO'] || client['MEIO_PAGAMENTO'] || client['FORMA DE PAGAMENTO'] || lastSale?.['FORMAS_PAGAMENTO'] || '',
      observacoes: client['observacoes'] || client['OBSERVACOES'] || client['Obs'] || lastSale?.['OBSERVACOES'] || ''
    });
    setDuplicateNameError('');
    setDuplicateCpfError('');
    setOsClientData(null);
    setOsSaleData(null);
    setProfileClientData(null);
    setIsAdding(true);
  };


  // Validação em tempo real de duplicidade de Nome e CPF
  useEffect(() => {
    if (!formData['Nome Completo'] && !formData['CPF / CNPJ']) {
      setDuplicateNameError('');
      setDuplicateCpfError('');
      return;
    }
    const check = checkClientDuplicate(formData, editingClientData, clientsData);
    setDuplicateNameError(check.errorName);
    setDuplicateCpfError(check.errorCpf);
  }, [
    formData['Nome Completo'],
    formData['CPF / CNPJ'],
    formData['Responsável Nome'],
    formData['Responsável CPF'],
    clientsData,
    editingClientData
  ]);

  const handleChange = (e) => {
    let { name, value } = e.target;

    if (name === 'CPF / CNPJ') {
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
    } else if (name === 'E-mail') {
      value = value.toLowerCase().replace(/\s/g, '');
    } else if (name === 'Instagram' || name === 'TikTok') {
      if (value.length > 0 && !value.startsWith('@')) {
        value = '@' + value.replace(/@/g, '');
      }
      if (value === '@') value = '';
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Verificação de duplicidade: não pode repetir Nome nem CPF a menos que seja Responsável
    const dupCheck = checkClientDuplicate(formData, editingClientData, clientsData);
    if (dupCheck.isDuplicate) {
      if (dupCheck.errorCpf) {
        setDuplicateCpfError(dupCheck.errorCpf);
        alert(dupCheck.errorCpf);
      } else if (dupCheck.errorName) {
        setDuplicateNameError(dupCheck.errorName);
        alert(dupCheck.errorName);
      }
      return;
    }

    setIsSubmitting(true);
    
    const valorDevidoNum = parseCurrency(formData['Valor Devido']);
    const isEmDia = formData['Status de Pagamento'] === 'Em dia' || valorDevidoNum <= 0;

    if (editingClientData) {
      const updatedRowData = {
        ...editingClientData,
        ...formData,
        id: editingClientData.id || formData.id || `client_${Date.now()}`
      };

      if (onUpdateClient) {
        onUpdateClient({ oldRow: editingClientData, newRow: updatedRowData });
      } else if (onUpdateRow) {
        onUpdateRow('CLIENTES_CADASTRADOS', editingClientData, updatedRowData);
      }

      // Sincronização Bidirecional: se o cliente foi marcado como "Em dia" ou dívida zero, quita no ERP Contas a Receber
      if (isEmDia && receberData && receberData.length > 0 && onUpdateRow) {
        receberData.forEach(conta => {
          const st = (conta.STATUS || conta.status || '').trim();
          if (isSameClient(updatedRowData, conta) && (st === 'Pendente' || st === 'Atrasado' || st === 'Inadimplente')) {
            onUpdateRow('CONTAS_RECEBER', conta, {
              ...conta,
              STATUS: 'Recebido',
              DATA_RECEBIMENTO: new Date().toISOString().split('T')[0]
            });
          }
        });
      }
    } else {
      const effectiveCity = formData['Cidade'] || userCity || 'Cajati';
      const newRowWithId = {
        ...formData,
        'Cidade': effectiveCity,
        'CIDADE': effectiveCity,
        id: formData.id || `client_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      };
      onAddClient(newRowWithId);

      // Sincronização Bidirecional: se o cliente é novo e já tem saldo devedor, cadastra em Contas a Receber no ERP com vínculo estrito por ID/CPF
      if (!isEmDia && valorDevidoNum > 0 && onAddRow) {
        onAddRow('CONTAS_RECEBER', {
          DESCRICAO: `Saldo Inicial / Cadastro (${formData['Marca de Lente'] || 'Lente'} + ${formData['Modelo de Armação'] || 'Armação'})`.trim(),
          CLIENTE_ID: newRowWithId.id,
          CLIENTE_CPF: newRowWithId['CPF / CNPJ'] || newRowWithId['CPF'] || '',
          CPF: newRowWithId['CPF / CNPJ'] || newRowWithId['CPF'] || '',
          CLIENTE: formData['Nome Completo'] || 'Cliente',
          NOME: formData['Nome Completo'] || 'Cliente',
          VENDA_OS: '',
          VALOR: valorDevidoNum.toFixed(2).replace('.', ','),
          DATA_VENCIMENTO: formData['Data de Vencimento'] || new Date().toISOString().split('T')[0],
          DATA_RECEBIMENTO: '',
          STATUS: 'Pendente',
          MEIO_PAGAMENTO: 'OS / A Definir',
          OBSERVACOES: 'Gerado automaticamente ao cadastrar o cliente'
        });
      }
    }
    
    setIsSubmitting(false);
    setSuccess(true);
    
    setTimeout(() => {
      setSuccess(false);
      setFormData({
        'Nome Completo': '',
        'Data de Nascimento': '',
        'CPF / CNPJ': '',
        'RG': '',
        'WhatsApp': '',
        'Nome Referência 1': '',
        'Referência 1': '',
        'Parentesco Ref. 1': '',
        'Nome Referência 2': '',
        'Referência 2': '',
        'Parentesco Ref. 2': '',
        'E-mail': '',
        'Instagram': '',
        'Facebook': '',
        'TikTok': '',
        'CEP': '',
        'Rua': '',
        'Número': '',
        'Bairro': '',
        'Cidade': '',
        'Estado': '',
        'Responsável Nome': '',
        'Responsável Data de Nascimento': '',
        'Responsável CPF': '',
        'Responsável RG': '',
        'Responsável WhatsApp': '',
        'Responsável Nome Referência 1': '',
        'Responsável Referência 1': '',
        'Responsável Parentesco Ref. 1': '',
        'Responsável Nome Referência 2': '',
        'Responsável Referência 2': '',
        'Responsável Parentesco Ref. 2': '',
        'Responsável Instagram': '',
        'Responsável Facebook': '',
        'Responsável TikTok': '',
        'Responsável CEP': '',
        'Responsável Rua': '',
        'Responsável Número': '',
        'Responsável Bairro': '',
        'Responsável Cidade': '',
        'Responsável Estado': '',
        'Foto Documento Cliente': '',
        'Foto Comprovante Residência Cliente': '',
        'Foto Documento Responsável': '',
        'Foto Comprovante Residência Responsável': '',
        'Marca de Lente': '',
        'Modelo de Armação': '',
        'Status de Pagamento': 'Em dia',
        'Valor Devido': '',
        'Data de Vencimento': ''
      });
      setIsAdding(false); 
      setEditingClientData(null);
    }, 2000);
  };

  // Sincronização em Tempo Real com o ERP Financeiro (CONTAS_RECEBER)
  const enrichedClients = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return (clientsData || []).map(client => {
      // Obter todas as duplicatas/boletos associadas a este cliente no ERP
      const clientInvoices = (receberData || []).filter(conta => isSameClient(client, conta));

      if (clientInvoices.length > 0) {
        let totalPendente = 0;
        let totalVencido = 0;
        let totalRecebido = 0;
        let proximoVencimento = null;

        clientInvoices.forEach(inv => {
          const st = String(inv.STATUS || inv.status || 'Pendente').trim();
          const val = parseCurrency(inv.VALOR || inv.valor);
          const venc = inv.DATA_VENCIMENTO || inv['DATA VENCIMENTO'] || inv.VENCIMENTO;
          const isPago = st === 'Recebido' || st === 'Pago';

          if (isPago) {
            totalRecebido += val;
          } else {
            totalPendente += val;
            if (venc && String(venc) < today) {
              totalVencido += val;
            }
            if (venc && (!proximoVencimento || String(venc) < String(proximoVencimento))) {
              proximoVencimento = venc;
            }
          }
        });

        let statusReal = 'Em dia';
        if (totalVencido > 0) {
          statusReal = 'Inadimplente';
        } else if (totalPendente > 0) {
          statusReal = 'Pendente';
        }

        return {
          ...client,
          'Valor Devido': totalPendente > 0 ? totalPendente.toFixed(2).replace('.', ',') : '0,00',
          'Status de Pagamento': statusReal,
          'Data de Vencimento': proximoVencimento || client['Data de Vencimento'] || '',
          _totalRecebidoERP: totalRecebido,
          _totalPendenteERP: totalPendente,
          _totalVencidoERP: totalVencido,
          _qtdBoletos: clientInvoices.length
        };
      }

      // Se não houver duplicatas em CONTAS_RECEBER, utiliza o saldo de cadastro
      const saldoCadastro = parseCurrency(client['Valor Devido'] || client['VALOR DEVIDO']);
      const statusCadastro = client['Status de Pagamento'] || (saldoCadastro > 0 ? 'Inadimplente' : 'Em dia');

      return {
        ...client,
        'Valor Devido': saldoCadastro > 0 ? saldoCadastro.toFixed(2).replace('.', ',') : '0,00',
        'Status de Pagamento': statusCadastro,
        _totalRecebidoERP: 0,
        _totalPendenteERP: saldoCadastro,
        _totalVencidoERP: statusCadastro === 'Inadimplente' ? saldoCadastro : 0,
        _qtdBoletos: 0
      };
    });
  }, [clientsData, receberData]);

  // Indicadores Consolidados do ERP para a Gestão de Clientes
  const financialSummary = useMemo(() => {
    let totalClientes = enrichedClients.length;
    let emDiaCount = 0;
    let inadimplentesCount = 0;
    let totalAReceber = 0;

    enrichedClients.forEach(c => {
      const st = c['Status de Pagamento'];
      const devido = parseCurrency(c['Valor Devido']);
      if (st === 'Inadimplente' || st === 'Pendente' || devido > 0) {
        inadimplentesCount++;
      } else {
        emDiaCount++;
      }
      totalAReceber += devido;
    });

    return { totalClientes, emDiaCount, inadimplentesCount, totalAReceber };
  }, [enrichedClients]);

  const filteredData = useMemo(() => {
    return enrichedClients.filter(client => {
      if (activeTab === 'todos') return true;
      const status = client['Status de Pagamento'];
      if (activeTab === 'inadimplentes') return status === 'Inadimplente' || status === 'Pendente';
      return status === 'Em dia';
    });
  }, [enrichedClients, activeTab]);

  const handleOpenOSModal = (client) => {
    if (!client) return;

    let recentSale = null;
    if (Array.isArray(salesData) && salesData.length > 0) {
      const clientSales = salesData.filter(sale => isSameClient(client, sale));
      if (clientSales.length > 0) {
        const getSaleTime = (s) => {
          if (s.timestamp && typeof s.timestamp === 'number') return s.timestamp;
          if (s.dataHora) {
            const t = new Date(s.dataHora).getTime();
            if (!isNaN(t)) return t;
          }
          const rawDate = s['DATA  DA VENDA'] || s['DATA DA VENDA'] || s['DATA_VENDA'] || s['Data da Venda'] || s['DATA'] || '';
          if (rawDate) {
            if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
              const t = new Date(rawDate).getTime();
              if (!isNaN(t)) return t;
            } else if (/^\d{2}\/\d{2}\/\d{4}/.test(rawDate)) {
              const parts = String(rawDate).split(/[\/\s,:]+/);
              if (parts.length >= 3) {
                const [d, m, y] = parts;
                const hh = parts[3] || '00';
                const mm = parts[4] || '00';
                const ss = parts[5] || '00';
                const t = new Date(`${y}-${m}-${d}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}`).getTime();
                if (!isNaN(t)) return t;
              }
            }
          }
          return 0;
        };

        const activeSales = clientSales.filter(sale => {
          const st = String(sale['STATUS_OS'] || sale['SITUAÇÃO'] || sale['STATUS'] || '').toLowerCase();
          return !['cancelado', 'cancelada'].includes(st);
        });
        const pool = activeSales.length > 0 ? activeSales : clientSales;
        recentSale = [...pool].reverse().sort((a, b) => getSaleTime(b) - getSaleTime(a))[0];
      }
    }

    if (recentSale) {
      const rawTotal = recentSale['VALOR TOTAL'] || recentSale['VALOR DA VENDA'] || recentSale.valorTotal || '';
      const rawEntrada = recentSale['VALOR ENTRADA'] !== undefined && recentSale['VALOR ENTRADA'] !== '' 
        ? recentSale['VALOR ENTRADA'] 
        : (recentSale['SINAL'] !== undefined && recentSale['SINAL'] !== '' ? recentSale['SINAL'] : (recentSale.valorEntrada ?? ''));
      const rawRestante = recentSale['RESTANTE'] !== undefined && recentSale['RESTANTE'] !== '' 
        ? recentSale['RESTANTE'] 
        : (recentSale.restante ?? '');
      const rawFormas = recentSale['FORMAS_PAGAMENTO'] || recentSale['FORMA_PAGTO'] || recentSale['FORMA DE PAGAMENTO'] || recentSale.formasPagamento || '';
      const rawFormaEntrada = recentSale['FORMA_ENTRADA'] || recentSale.formaPagamentoEntrada || '';
      const rawFormaRestante = recentSale['FORMA_RESTANTE'] || recentSale.formaPagamentoRestante || '';
      let rawParcelas = [];
      try {
        if (Array.isArray(recentSale.parcelas) && recentSale.parcelas.length > 0) {
          rawParcelas = recentSale.parcelas;
        } else if (recentSale['PARCELAS_JSON']) {
          rawParcelas = typeof recentSale['PARCELAS_JSON'] === 'string' ? JSON.parse(recentSale['PARCELAS_JSON']) : recentSale['PARCELAS_JSON'];
        }
      } catch (e) {}
      const rawItens = recentSale.itens || recentSale.cart || client.itens || [];
      const rawSaleId = recentSale.id || recentSale['_id'] || recentSale.saleId || recentSale['ID'] || '';

      const numTotal = parseCurrency(rawTotal);
      const numEntrada = parseCurrency(rawEntrada);
      let calculatedRestante = typeof rawRestante === 'number' ? rawRestante.toFixed(2).replace('.', ',') : String(rawRestante || '');
      if ((!calculatedRestante || calculatedRestante === '0,00' || calculatedRestante === '0') && numTotal > numEntrada) {
        calculatedRestante = (numTotal - numEntrada).toFixed(2).replace('.', ',');
      }

      const enrichedClient = {
        ...client,
        'Marca de Lente': client['Marca de Lente'] || recentSale['LENTE'] || recentSale['Marca de Lente'] || client['Lente'] || '',
        'Modelo de Armação': client['Modelo de Armação'] || recentSale['ARMAÇÃO'] || recentSale['Modelo de Armação'] || client['Armação'] || '',
        valorTotal: typeof rawTotal === 'number' ? rawTotal.toFixed(2).replace('.', ',') : String(rawTotal || ''),
        valorEntrada: typeof rawEntrada === 'number' ? rawEntrada.toFixed(2).replace('.', ',') : String(rawEntrada || ''),
        restante: calculatedRestante || '0,00',
        formasPagamento: rawFormas,
        formaPagamentoEntrada: rawFormaEntrada,
        formaPagamentoRestante: rawFormaRestante,
        parcelas: rawParcelas,
        itens: rawItens,
        saleId: rawSaleId
      };

      setOsClientData(enrichedClient);
      setOsSaleData(recentSale);
    } else {
      setOsClientData(client);
      setOsSaleData(null);
    }
  };

  const handleSaveAndPrintOS = (osData) => {
    const isMulti = Boolean(osData?.isMultiOS && Array.isArray(osData?.orders) && osData.orders.length > 0);
    const ordersList = isMulti ? osData.orders : [osData];
    const primaryOrder = ordersList[0] || osData;
    const saleCity = primaryOrder.selectedCity || primaryOrder.unidade || osData.selectedCity || osData.unidade || (currentUser?.role === 'vendedor' ? (currentUser.city || currentUser.assignedStore) : null) || osClientData['Cidade'] || 'Cajati';

    setOsDataForPrint(isMulti ? {
      ...primaryOrder,
      selectedCity: saleCity,
      unidade: saleCity,
      multiOrders: ordersList.map(o => ({
        ...o,
        selectedCity: o.selectedCity || o.unidade || saleCity,
        unidade: o.unidade || o.selectedCity || saleCity
      })),
      orders: ordersList.map(o => ({
        ...o,
        selectedCity: o.selectedCity || o.unidade || saleCity,
        unidade: o.unidade || o.selectedCity || saleCity
      }))
    } : {
      ...osData,
      selectedCity: saleCity,
      unidade: saleCity
    });

    // Automatically fallback to subtracting valorTotal - valorEntrada if restante is somehow missing or malformed
    let osRestante = parseCurrency(primaryOrder.restante ?? osData.restante);
    const primaryTotalStr = primaryOrder.valorTotal ?? osData.valorTotal;
    const primaryEntradaStr = primaryOrder.valorEntrada ?? osData.valorEntrada;
    if (osRestante === 0 && parseCurrency(primaryTotalStr) > 0) {
      osRestante = Math.max(0, parseCurrency(primaryTotalStr) - parseCurrency(primaryEntradaStr));
    }

    // NOTA: As duplicatas no financeiro (CONTAS_RECEBER) e o débito na ficha do cliente (Valor Devido)
    // NÃO são gerados no momento da emissão da OS. A nova OS entra com status "Aguardando Confirmação" (Azul).
    // A administração/financeiro confere o pagamento na tela de Gestão de OS e, ao confirmar,
    // as duplicatas são geradas no financeiro e a OS é liberada para montagem no laboratório!

    // Salvar automaticamente a(s) nova(s) OS em Registro_Vendas com status 'Aguardando Confirmação'
    if (onAddSale && osClientData) {
      const clientId = osClientData.id || osClientData['_id'] || osClientData.CLIENTE_ID || '';
      const clientCpf = String(osClientData['CPF / CNPJ'] || osClientData['CPF'] || '').trim();
      const clientName = osClientData['Nome Completo'] || osClientData['NOME'] || 'Cliente';
      const todayStr = new Date().toLocaleDateString('pt-BR');
      const dataVendaStr = primaryOrder.dataVenda || osData.dataVenda || todayStr;
      const resolvedFormaEntrada = primaryOrder.formaPagamentoEntrada || primaryOrder.FORMA_ENTRADA || osData.formaPagamentoEntrada || osData.FORMA_ENTRADA || '';
      const resolvedFormaRestante = primaryOrder.formaPagamentoRestante || primaryOrder.FORMA_RESTANTE || osData.formaPagamentoRestante || osData.FORMA_RESTANTE || '';
      const primaryNumOS = primaryOrder.numeroOS || osData.numeroOS;

      ordersList.forEach((orderItem, idx) => {
        const isSecondary = idx > 0 || Boolean(orderItem.isSecondaryOS);
        const itemOsNum = orderItem.numeroOS || (idx === 0 ? primaryNumOS : `${primaryNumOS}-${idx + 1}`);
        const itemTotal = isSecondary ? '0,00' : (orderItem.valorTotal || primaryTotalStr || '0,00');
        const itemEntrada = isSecondary ? '0,00' : (orderItem.valorEntrada || primaryEntradaStr || '0,00');
        const itemRestante = isSecondary ? '0,00' : (orderItem.restante || (osRestante > 0 ? osRestante.toFixed(2).replace('.', ',') : '0,00'));
        const itemFormas = isSecondary
          ? `Faturamento Unificado (Ver OS #${primaryNumOS})`
          : (orderItem.formasPagamento || osData.formasPagamento || '');
        const itemObservacoes = isSecondary
          ? `${orderItem.observacoes ? orderItem.observacoes + ' | ' : ''}[Faturamento Unificado na OS #${primaryNumOS}]`
          : (orderItem.observacoes || '');

        onAddSale({
          'CLIENTE_ID': clientId,
          'CLIENTE_CPF': clientCpf,
          'CPF': clientCpf,
          'DATA  DA VENDA': dataVendaStr,
          'DATA DA VENDA': dataVendaStr,
          'DATA_VENDA': dataVendaStr,
          'Data da Venda': dataVendaStr,
          'data_venda': dataVendaStr,
          'DATA': dataVendaStr,
          'PRODUTO': ((orderItem.lente || '') + (orderItem.armacao ? ` + ${orderItem.armacao}` : '')).trim() || 'Óculos Completo',
          'LENTE': orderItem.lente || '',
          'ARMAÇÃO': orderItem.armacao || '',
          'VALOR TOTAL': itemTotal,
          'VALOR DA VENDA': itemTotal,
          'VALOR ENTRADA': itemEntrada,
          'SINAL': itemEntrada,
          'RESTANTE': itemRestante,
          'FORMAS_PAGAMENTO': itemFormas,
          'FORMA_ENTRADA': resolvedFormaEntrada,
          'formaPagamentoEntrada': resolvedFormaEntrada,
          'FORMA_RESTANTE': resolvedFormaRestante,
          'formaPagamentoRestante': resolvedFormaRestante,
          'SITUAÇÃO': 'Aguardando Confirmação',
          'STATUS_OS': 'Aguardando Confirmação',
          'OS DA VENDA': itemOsNum,
          'OS': itemOsNum,
          'PREVISAO_ENTREGA': orderItem.dataEntrega || primaryOrder.dataEntrega || todayStr,
          'LABORATORIO': orderItem.laboratorio || primaryOrder.laboratorio || '',
          'NOME CLIENTE': clientName,
          'CLIENTE': clientName,
          'NOME': clientName,
          'PACIENTE': orderItem.nomePessoa || orderItem.PACIENTE || clientName,
          'NOME_BENEFICIARIO': orderItem.nomePessoa || orderItem.PACIENTE || clientName,
          'TELEFONE': osClientData['WhatsApp'] || osClientData['TELEFONE'] || '',
          'CIDADE': saleCity,
          'LOJA': saleCity,
          'UNIDADE': saleCity,
          'PAGAMENTO_CONFERIDO': 'Não',
          'DUPLICATAS_GERADAS': false,
          'PARCELAS_JSON': isSecondary ? '[]' : JSON.stringify(orderItem.parcelas || primaryOrder.parcelas || []),
          'FINANCEIRO_UNIFICADO': isSecondary,
          'isSecondaryOS': isSecondary,
          'DIOPTRIA': `OD: ${orderItem.odEsf || ''}/${orderItem.odCil || ''} OE: ${orderItem.oeEsf || ''}/${orderItem.oeCil || ''} AD: ${orderItem.adicao || ''}`,
          'OD_ESF': orderItem.odEsf || '',
          'OD_CIL': orderItem.odCil || '',
          'OD_EIXO': orderItem.odEixo || '',
          'OD_DNP': orderItem.odDnp || '',
          'OD_ALT': orderItem.odAlt || '',
          'OE_ESF': orderItem.oeEsf || '',
          'OE_CIL': orderItem.oeCil || '',
          'OE_EIXO': orderItem.oeEixo || '',
          'OE_DNP': orderItem.oeDnp || '',
          'OE_ALT': orderItem.oeAlt || '',
          'ADICAO': orderItem.adicao || '',
          'MEDICO': orderItem.medico || '',
          'OBSERVACOES': itemObservacoes
        });
      });

      // 🛡️ Fix 6: Se houver sinal / valor de entrada na OS, registrar no FLUXO_CAIXA respeitando o método de pagamento da Entrada
      const valorEntradaNum = parseCurrency(primaryEntradaStr);
      if (valorEntradaNum > 0 && onAddRow) {
        const numeroOS = primaryNumOS || 'OS';
        const rawEntradaMethod = String(resolvedFormaEntrada || primaryOrder.formasPagamento || osData.formasPagamento || 'DINHEIRO').toUpperCase();
        let cashMethod = 'DINHEIRO';
        if (rawEntradaMethod.includes('PIX')) cashMethod = 'PIX';
        else if (rawEntradaMethod.includes('DEBITO') || rawEntradaMethod.includes('DÉBITO')) cashMethod = 'DEBITO';
        else if (rawEntradaMethod.includes('CREDITO') || rawEntradaMethod.includes('CRÉDITO')) cashMethod = 'CREDITO';
        else if (rawEntradaMethod.includes('DINHEIRO')) cashMethod = 'DINHEIRO';

        onAddRow('FLUXO_CAIXA', {
          id: `mov_sinal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          saleId: `os_${numeroOS}`,
          osNumero: String(numeroOS),
          tipo: 'VENDA',
          dataHora: new Date().toISOString(),
          data: todayStr,
          unidade: saleCity,
          operador: currentUser?.username || 'Caixa',
          valor: valorEntradaNum,
          formaPagamento: cashMethod,
          motivo: `Sinal OS #${numeroOS}`,
          detalhes: `Sinal/Entrada OS #${numeroOS} - ${clientName}${resolvedFormaEntrada ? ` (${resolvedFormaEntrada})` : ''}`,
          CLIENTE_ID: clientId,
          CLIENTE_CPF: clientCpf,
          CPF: clientCpf
        });
      }
    }

    // Pequeno delay para garantir que o componente PrintableOS renderize antes de chamar o print
    setTimeout(() => {
      window.print();
      setOsClientData(null);
      setOsSaleData(null);
      setTimeout(() => setOsDataForPrint(null), 1000);
    }, 300);
  };

  // 🛡️ Fix 4: Quitação de Parcela no Perfil do Cliente
  const handleConfirmPayment = (paymentString, paymentOS, specificInvoice = null) => {
    if (!profileClientData) return;
    
    const amountPaid = parseCurrency(paymentString);
    if (amountPaid <= 0) return;

    const clientId = profileClientData.id || profileClientData['_id'] || '';
    const clientCpf = String(profileClientData['CPF / CNPJ'] || profileClientData['CPF'] || '').trim();
    const clientName = profileClientData['Nome Completo'] || profileClientData['NOME'] || 'Cliente';
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const todayIso = new Date().toISOString().split('T')[0];
    const clientCity = profileClientData['Cidade'] || (currentUser?.role === 'vendedor' ? (currentUser.city || currentUser.assignedStore) : null) || 'Cajati';

    // 1. Quitação no ERP (CONTAS_RECEBER)
    if (specificInvoice && onUpdateRow) {
      // Quitação direta de parcela específica
      onUpdateRow('CONTAS_RECEBER', specificInvoice, {
        ...specificInvoice,
        STATUS: 'Recebido',
        status: 'Recebido',
        DATA_RECEBIMENTO: todayIso
      });
    } else if (receberData && receberData.length > 0 && onUpdateRow) {
      // Quitação sequencial inteligente: busca duplicatas em aberto do cliente
      const clientInvoices = receberData.filter(conta => {
        const st = (conta.STATUS || conta.status || '').trim();
        return isSameClient(profileClientData, conta) && st !== 'Recebido' && st !== 'Pago';
      });

      // Se o usuário selecionou uma OS, prioriza parcelas vinculadas a essa OS
      if (paymentOS && paymentOS.trim() && paymentOS.trim() !== '—') {
        const osClean = paymentOS.trim().toLowerCase();
        clientInvoices.sort((a, b) => {
          const osA = String(a.VENDA_OS || a.OS || '').toLowerCase();
          const osB = String(b.VENDA_OS || b.OS || '').toLowerCase();
          if (osA === osClean && osB !== osClean) return -1;
          if (osB === osClean && osA !== osClean) return 1;
          const dA = new Date(a.DATA_VENCIMENTO || 0);
          const dB = new Date(b.DATA_VENCIMENTO || 0);
          return dA - dB;
        });
      } else {
        // Ordena pelas parcelas com vencimento mais antigo primeiro
        clientInvoices.sort((a, b) => {
          const dA = new Date(a.DATA_VENCIMENTO || 0);
          const dB = new Date(b.DATA_VENCIMENTO || 0);
          return dA - dB;
        });
      }

      let remainingToSettle = amountPaid;
      for (const conta of clientInvoices) {
        if (remainingToSettle <= 0) break;
        const contaVal = parseCurrency(conta.VALOR || conta.valor);
        if (remainingToSettle >= contaVal) {
          onUpdateRow('CONTAS_RECEBER', conta, {
            ...conta,
            STATUS: 'Recebido',
            status: 'Recebido',
            DATA_RECEBIMENTO: todayIso
          });
          remainingToSettle -= contaVal;
        } else {
          // Pagamento parcial: abate o saldo da parcela
          const novoSaldo = Math.max(0, contaVal - remainingToSettle);
          onUpdateRow('CONTAS_RECEBER', conta, {
            ...conta,
            VALOR: novoSaldo.toFixed(2).replace('.', ','),
            OBSERVACOES: `${conta.OBSERVACOES || ''} (Abatido R$ ${remainingToSettle.toFixed(2).replace('.', ',')} em ${todayStr})`.trim()
          });
          remainingToSettle = 0;
        }
      }
    }

    // 2. Registrar Entrada de Dinheiro no FLUXO_CAIXA
    if (onAddRow) {
      onAddRow('FLUXO_CAIXA', {
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tipo: 'RECEBIMENTO',
        dataHora: new Date().toISOString(),
        data: todayStr,
        unidade: clientCity,
        operador: currentUser?.username || 'Caixa',
        valor: amountPaid,
        formaPagamento: 'DINHEIRO / RECEBIMENTO',
        motivo: `Recebimento Boleto - ${clientName}`,
        detalhes: paymentOS ? `OS #${paymentOS}` : (specificInvoice ? `Parcela ${specificInvoice.DOCUMENTO || specificInvoice.DESCRICAO || ''}` : 'Recebimento de Débito'),
        CLIENTE_ID: clientId,
        CLIENTE_CPF: clientCpf,
        CPF: clientCpf
      });
    }

    // 3. Atualizar Ficha do Cliente (CLIENTES_CADASTRADOS)
    const currentDebt = parseCurrency(profileClientData['Valor Devido']);
    const newDebt = Math.max(0, currentDebt - amountPaid);
    const newStatus = newDebt === 0 ? 'Em dia' : profileClientData['Status de Pagamento'];

    const updatedClient = {
      ...profileClientData,
      'Valor Devido': newDebt.toFixed(2).replace('.', ','),
      'Status de Pagamento': newStatus
    };

    if (onUpdateClient) {
      onUpdateClient({ oldRow: profileClientData, newRow: updatedClient });
    } else if (onUpdateRow) {
      onUpdateRow('CLIENTES_CADASTRADOS', profileClientData, updatedClient);
    }
    setProfileClientData(updatedClient);

    // 4. Histórico de Vendas / Recebimentos
    if (onAddSale) {
      onAddSale({
        'CLIENTE_ID': clientId,
        'CLIENTE_CPF': clientCpf,
        'CPF': clientCpf,
        'DATA  DA VENDA': todayStr,
        'DATA': todayStr,
        'PRODUTO': '💰 Recebimento de Mensalidade / Boleto',
        'VALOR TOTAL': amountPaid.toFixed(2).replace('.', ','),
        'VALOR DA VENDA': amountPaid.toFixed(2).replace('.', ','),
        'SITUAÇÃO': 'Pago',
        'STATUS_OS': 'Pago',
        'OS DA VENDA': paymentOS ? paymentOS.trim() : (specificInvoice?.VENDA_OS || '—'),
        'NOME CLIENTE': clientName,
        'CLIENTE': clientName,
        'TELEFONE': profileClientData['WhatsApp'] || '',
        'CIDADE': clientCity,
        'LOJA': clientCity
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-[1400px] mx-auto"
    >
      {/* Barra Superior Profissional SaaS (Clean & Enterprise) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={onBack}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all rounded-xl text-slate-300 hover:text-white shrink-0"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white uppercase">Gestão de Clientes &amp; Financeiro</h2>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                ERP Sincronizado
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">Base cadastral, contas a receber e histórico integrado da Yasmin Ótica.</p>
          </div>
        </div>

        {!isAdding && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Tabs de Filtro */}
            <div className="flex overflow-x-auto erp-scroll bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button 
                onClick={() => setActiveTab('todos')} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  activeTab === 'todos' 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({financialSummary.totalClientes})
              </button>
              <button 
                onClick={() => setActiveTab('em-dia')} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'em-dia' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 size={13} className="text-emerald-400" />
                Em Dia ({financialSummary.emDiaCount})
              </button>
              <button 
                onClick={() => setActiveTab('inadimplentes')} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'inadimplentes' 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle size={13} className="text-rose-400" />
                Em Aberto ({financialSummary.inadimplentesCount})
              </button>
            </div>

            <button
              onClick={() => {
                setEditingClientData(null);
                setIsAdding(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition-all shadow-md shadow-sky-600/20 text-xs shrink-0"
            >
              <PlusCircle size={15} /> Novo Cliente
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Financeiros (Visíveis na listagem) */}
      {!isAdding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total de Clientes</p>
              <p className="text-2xl font-bold text-white tracking-tight mt-0.5">{financialSummary.totalClientes}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
              <Users size={18} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Clientes Em Dia</p>
              <p className="text-2xl font-bold text-emerald-400 tracking-tight mt-0.5">{financialSummary.emDiaCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Em Aberto / Débito</p>
              <p className="text-2xl font-bold text-rose-400 tracking-tight mt-0.5">{financialSummary.inadimplentesCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Total a Receber Aberto</p>
              <p className="text-xl font-bold font-mono text-amber-300 tracking-tight mt-0.5">
                R$ {financialSummary.totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <DollarSign size={18} />
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!isAdding ? (
          <motion.div 
            key="table"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl"
          >
            {filteredData.length > 0 ? (
              <>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Users size={14} className="text-sky-400"/> Clientes Cadastrados · {filteredData.length} registros
                </p>
                {/* Reutilizando a tabela do dashboard para listar os clientes */}
                <DataTable 
                  sheetName="CLIENTES_CADASTRADOS" 
                  rows={filteredData} 
                  onEditRow={(row) => handleStartEditClient(row)}
                  onGenerateOS={handleOpenOSModal} 
                  onViewProfile={setProfileClientData}
                  currentUser={currentUser}
                  onDeleteRow={onDeleteClient ? (sheet, row) => onDeleteClient(row) : null}
                />
              </>
            ) : (
              <div className="text-center py-20">
                <Users size={48} className="text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Nenhum cliente encontrado</h3>
                <p className="text-slate-400 mb-6">Não há clientes registrados na base com este filtro.</p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold transition-all"
                >
                  Cadastrar Novo Cliente
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-slate-900/95 border border-slate-800 p-4 sm:p-8 rounded-2xl shadow-2xl relative max-w-4xl mx-auto"
          >
            {success ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="flex flex-col items-center justify-center py-20 text-center z-10 relative"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle size={40} className="text-emerald-400" />
                </motion.div>
                <h3 className="text-2xl font-black text-white mb-2">{editingClientData ? 'Cadastro Atualizado!' : 'Cliente Cadastrado!'}</h3>
                <p className="text-slate-400 max-w-md mx-auto">{editingClientData ? 'As informações do cliente foram salvas com sucesso.' : 'O cliente foi adicionado com sucesso e já consta na sua tabela de registros.'}</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                {editingClientData && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-sky-500/15 via-slate-900 to-indigo-950/40 border border-sky-500/30 text-sky-300">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-black shrink-0">
                        <Edit2 size={18} />
                      </div>
                      <div>
                        <h4 className="font-black text-white text-sm flex items-center gap-2">
                          Editando Cadastro do Cliente
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">MODO EDIÇÃO</span>
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Alterando dados de: <strong className="text-sky-400">{editingClientData['Nome Completo'] || editingClientData['NOME'] || 'Cliente'}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdding(false);
                        setEditingClientData(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all border border-white/10 flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <ArrowLeft size={14} /> Voltar para a Lista
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* ─── SEÇÃO 1: DADOS PESSOAIS DO CLIENTE ─── */}
                  <div className="md:col-span-2 flex items-center justify-between border-b border-white/10 pb-2.5">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                        <User size={15} />
                      </span>
                      1. Informações Pessoais do Cliente
                    </h4>
                    <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                      Identificação Principal
                    </span>
                  </div>

                  {/* Nome */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <User size={13} className="text-sky-400" /> Nome Completo do Cliente
                    </label>
                    <input 
                      type="text" 
                      name="Nome Completo"
                      required
                      value={formData['Nome Completo']}
                      onChange={handleChange}
                      placeholder="Ex: Yasmin Oliveira"
                      className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
                        duplicateNameError ? 'border-amber-500/80 focus:ring-amber-500/50' : 'border-white/10 focus:ring-sky-500/50'
                      }`}
                    />
                    {duplicateNameError && (
                      <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold mt-1">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{duplicateNameError}</span>
                      </div>
                    )}
                  </div>

                  {/* Data de Nascimento */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <Calendar size={13} className="text-sky-400" /> Data de Nascimento
                    </label>
                    <input 
                      type="date" 
                      name="Data de Nascimento"
                      value={formData['Data de Nascimento']}
                      onChange={handleChange}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                    />
                  </div>

                  {/* Documento CPF */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <CreditCard size={13} className="text-indigo-400" /> CPF / CNPJ
                    </label>
                    <input 
                      type="text" 
                      name="CPF / CNPJ"
                      value={formData['CPF / CNPJ']}
                      onChange={handleChange}
                      onBlur={(e) => {
                        const val = e.target.value;
                        setCpfError(isValidCpfCnpj(val) ? '' : 'CPF/CNPJ Incorreto');
                      }}
                      placeholder="000.000.000-00"
                      className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
                        duplicateCpfError || cpfError ? 'border-amber-500/80 focus:ring-amber-500/50' : 'border-white/10 focus:ring-indigo-500/50'
                      }`}
                    />
                    {cpfError && <p className="text-red-500 text-xs ml-1 font-bold">{cpfError}</p>}
                    {duplicateCpfError && (
                      <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold mt-1">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{duplicateCpfError}</span>
                      </div>
                    )}
                  </div>

                  {/* RG */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <FileText size={13} className="text-indigo-400" /> RG
                    </label>
                    <input 
                      type="text" 
                      name="RG"
                      value={formData['RG']}
                      onChange={handleChange}
                      placeholder="00.000.000-0"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>

                  {/* Anexo: Foto do Documento do Cliente (RG / CPF / CNH) */}
                  <div className="md:col-span-2 pt-1">
                    <DocumentAttachmentInput
                      label="Foto do Documento do Cliente (RG / CPF / CNH)"
                      helperText="Anexe foto legível da frente e verso do RG, CPF ou CNH do cliente"
                      value={formData['Foto Documento Cliente']}
                      onChange={(val) => setFormData(prev => ({ ...prev, 'Foto Documento Cliente': val }))}
                      accentColor="indigo"
                      clientName={formData['Nome Completo'] || ''}
                    />
                  </div>

                  {/* Telefone WhatsApp */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-400" /> WhatsApp Principal
                    </label>
                    <input 
                      type="text" 
                      name="WhatsApp"
                      required
                      value={formData['WhatsApp']}
                      onChange={handleChange}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                  </div>

                  {/* Referência 1 com Nome, Telefone e Parentesco */}
                  <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1 flex items-center gap-1.5">
                        <PhoneCall size={13} className="text-teal-400" /> Referência 1
                      </label>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contato Pessoal</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                        Nome da Pessoa de Referência 1
                      </label>
                      <input 
                        type="text" 
                        name="Nome Referência 1"
                        value={formData['Nome Referência 1'] || ''}
                        onChange={handleChange}
                        placeholder="Ex: Maria Silva (Mãe, Irmão, etc.)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <div className="sm:col-span-7">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                          Telefone / WhatsApp
                        </label>
                        <input 
                          type="text" 
                          name="Referência 1"
                          value={formData['Referência 1']}
                          onChange={handleChange}
                          placeholder="(00) 00000-0000"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                          Parentesco
                        </label>
                        <select
                          name="Parentesco Ref. 1"
                          value={formData['Parentesco Ref. 1'] || ''}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-xs font-semibold"
                        >
                          <option value="">De quem é?</option>
                          <option value="Mãe">👩 Mãe</option>
                          <option value="Pai">👨 Pai</option>
                          <option value="Esposo(a)">💍 Esposo(a)</option>
                          <option value="Filho(a)">👶 Filho(a)</option>
                          <option value="Irmão/Irmã">👫 Irmão/Irmã</option>
                          <option value="Avô/Avó">👵 Avô/Avó</option>
                          <option value="Tio(a)">🧑‍🤝‍🧑 Tio(a)</option>
                          <option value="Primo(a)">👥 Primo(a)</option>
                          <option value="Namorado(a)">❤️ Namorado(a)</option>
                          <option value="Amigo(a)">🤝 Amigo(a)</option>
                          <option value="Vizinho(a)">🏘️ Vizinho(a)</option>
                          <option value="Trabalho">💼 Trabalho</option>
                          <option value="Outro">📌 Outro</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Referência 2 com Nome, Telefone e Parentesco */}
                  <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1 flex items-center gap-1.5">
                        <PhoneCall size={13} className="text-teal-400" /> Referência 2
                      </label>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contato Pessoal</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                        Nome da Pessoa de Referência 2
                      </label>
                      <input 
                        type="text" 
                        name="Nome Referência 2"
                        value={formData['Nome Referência 2'] || ''}
                        onChange={handleChange}
                        placeholder="Ex: João Santos (Pai, Amigo, etc.)"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <div className="sm:col-span-7">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                          Telefone / WhatsApp
                        </label>
                        <input 
                          type="text" 
                          name="Referência 2"
                          value={formData['Referência 2']}
                          onChange={handleChange}
                          placeholder="(00) 00000-0000"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                          Parentesco
                        </label>
                        <select
                          name="Parentesco Ref. 2"
                          value={formData['Parentesco Ref. 2'] || ''}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-xs font-semibold"
                        >
                          <option value="">De quem é?</option>
                          <option value="Mãe">👩 Mãe</option>
                          <option value="Pai">👨 Pai</option>
                          <option value="Esposo(a)">💍 Esposo(a)</option>
                          <option value="Filho(a)">👶 Filho(a)</option>
                          <option value="Irmão/Irmã">👫 Irmão/Irmã</option>
                          <option value="Avô/Avó">👵 Avô/Avó</option>
                          <option value="Tio(a)">🧑‍🤝‍🧑 Tio(a)</option>
                          <option value="Primo(a)">👥 Primo(a)</option>
                          <option value="Namorado(a)">❤️ Namorado(a)</option>
                          <option value="Amigo(a)">🤝 Amigo(a)</option>
                          <option value="Vizinho(a)">🏘️ Vizinho(a)</option>
                          <option value="Trabalho">💼 Trabalho</option>
                          <option value="Outro">📌 Outro</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                      <Mail size={13} className="text-amber-400" /> E-mail
                    </label>
                    <input 
                      type="email" 
                      name="E-mail"
                      value={formData['E-mail']}
                      onChange={handleChange}
                      placeholder="cliente@email.com"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                    />
                  </div>

                  {/* Redes Sociais */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Instagram */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-pink-400" /> Instagram
                      </label>
                      <input 
                        type="text" 
                        name="Instagram"
                        value={formData['Instagram']}
                        onChange={handleChange}
                        placeholder="@usuario"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                      />
                    </div>

                    {/* Facebook */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                        <Users size={13} className="text-blue-400" /> Facebook
                      </label>
                      <input 
                        type="text" 
                        name="Facebook"
                        value={formData['Facebook']}
                        onChange={handleChange}
                        placeholder="Nome ou link"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      />
                    </div>

                    {/* TikTok */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                        <Activity size={13} className="text-rose-400" /> TikTok
                      </label>
                      <input 
                        type="text" 
                        name="TikTok"
                        value={formData['TikTok']}
                        onChange={handleChange}
                        placeholder="@usuario"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-400/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* ─── SEÇÃO 2: ENDEREÇO DO CLIENTE (IMEDIATAMENTE APÓS OS DADOS DO CLIENTE) ─── */}
                  <div className="space-y-3 md:col-span-2 pt-4 border-t border-white/10 mt-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
                          <MapPin size={15} />
                        </span>
                        2. Endereço Residencial do Cliente
                      </h4>
                      <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/20">
                        Localização
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                      {/* CEP */}
                      <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Compass size={11} className="text-violet-400" /> CEP
                        </label>
                        <input 
                          type="text" 
                          name="CEP"
                          value={formData['CEP']}
                          onChange={handleChange}
                          placeholder="00000-000"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      {/* Rua */}
                      <div className="space-y-2 md:col-span-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <MapPin size={11} className="text-violet-400" /> Rua / Avenida
                        </label>
                        <input 
                          type="text" 
                          name="Rua"
                          value={formData['Rua']}
                          onChange={handleChange}
                          placeholder="Rua / Avenida do Cliente"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      {/* Número */}
                      <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Hash size={11} className="text-violet-400" /> Número
                        </label>
                        <input 
                          type="text" 
                          name="Número"
                          value={formData['Número']}
                          onChange={handleChange}
                          placeholder="Nº"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      {/* Bairro */}
                      <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Home size={11} className="text-violet-400" /> Bairro
                        </label>
                        <input 
                          type="text" 
                          name="Bairro"
                          value={formData['Bairro']}
                          onChange={handleChange}
                          placeholder="Bairro"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      {/* Cidade */}
                      <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Building2 size={11} className="text-violet-400" /> Cidade
                        </label>
                        <input 
                          type="text" 
                          name="Cidade"
                          value={formData['Cidade']}
                          onChange={handleChange}
                          placeholder="Cidade"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      {/* Estado */}
                      <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Map size={11} className="text-violet-400" /> Estado (UF)
                        </label>
                        <input 
                          type="text" 
                          name="Estado"
                          value={formData['Estado']}
                          onChange={handleChange}
                          placeholder="UF"
                          maxLength={2}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all uppercase"
                        />
                      </div>

                      {/* Anexo: Foto do Comprovante de Residência do Cliente */}
                      <div className="md:col-span-4 pt-1">
                        <DocumentAttachmentInput
                          label="Foto do Comprovante de Endereço / Residência do Cliente"
                          helperText="Conta recente de luz, água, internet, gás ou extrato com endereço do cliente"
                          value={formData['Foto Comprovante Residência Cliente']}
                          onChange={(val) => setFormData(prev => ({ ...prev, 'Foto Comprovante Residência Cliente': val }))}
                          accentColor="violet"
                          clientName={formData['Nome Completo'] || ''}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ─── SEÇÃO 3: CADASTRO DE RESPONSÁVEL ─── */}
                  <div className="space-y-4 md:col-span-2 pt-4 border-t border-white/10 mt-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                          <UserCheck size={15} />
                        </span>
                        3. Cadastro de Responsável (Opcional)
                      </h4>
                      <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
                        Pais / Tutores / Avalistas
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Nome do Responsável */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <UserCheck size={11} className="text-sky-400" /> Nome Completo do Responsável
                        </label>
                        <input type="text" name="Responsável Nome" value={formData['Responsável Nome']} onChange={handleChange} placeholder="Nome Completo do Responsável" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                      </div>
                      {/* Data de Nascimento do Responsável */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Calendar size={11} className="text-sky-400"/> Data de Nascimento do Responsável
                        </label>
                        <input 
                          type="date" 
                          name="Responsável Data de Nascimento" 
                          value={formData['Responsável Data de Nascimento']} 
                          onChange={handleChange} 
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" 
                        />
                      </div>
                      {/* CPF do Responsável */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <CreditCard size={11} className="text-indigo-400" /> CPF / CNPJ do Responsável
                        </label>
                        <input 
                          type="text" 
                          name="Responsável CPF" 
                          value={formData['Responsável CPF']} 
                          onChange={handleChange} 
                          onBlur={(e) => {
                            const val = e.target.value;
                            setResponsavelCpfError(isValidCpfCnpj(val) ? '' : 'CPF/CNPJ Incorreto');
                          }}
                          placeholder="CPF/CNPJ do Responsável" 
                          className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${responsavelCpfError ? 'border-red-500 focus:ring-red-500/50' : 'border-white/10 focus:ring-sky-500/50'}`} 
                        />
                        {responsavelCpfError && <p className="text-red-500 text-xs ml-1 font-bold">{responsavelCpfError}</p>}
                      </div>
                      {/* RG do Responsável */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <FileText size={11} className="text-indigo-400" /> RG do Responsável
                        </label>
                        <input type="text" name="Responsável RG" value={formData['Responsável RG']} onChange={handleChange} placeholder="RG do Responsável" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                      </div>

                      {/* Anexo: Foto do Documento do Responsável (RG / CPF / CNH) */}
                      <div className="md:col-span-2 pt-1">
                        <DocumentAttachmentInput
                          label="Foto do Documento do Responsável (RG / CPF / CNH)"
                          helperText="Documento oficial com foto do responsável legal ou tutor"
                          value={formData['Foto Documento Responsável']}
                          onChange={(val) => setFormData(prev => ({ ...prev, 'Foto Documento Responsável': val }))}
                          accentColor="sky"
                          clientName={formData['Responsável Nome'] || ''}
                        />
                      </div>
                      {/* WhatsApp do Responsável */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                          <Phone size={11} className="text-emerald-400" /> WhatsApp Principal do Responsável
                        </label>
                        <input type="text" name="Responsável WhatsApp" value={formData['Responsável WhatsApp']} onChange={handleChange} placeholder="WhatsApp do Responsável" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                      </div>

                      {/* Referência 1 do Responsável */}
                      <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1 flex items-center gap-1">
                            <PhoneCall size={11} className="text-teal-400" /> Referência 1 (Responsável)
                          </label>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Contato do Responsável</span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                            Nome da Pessoa de Referência 1
                          </label>
                          <input 
                            type="text" 
                            name="Responsável Nome Referência 1" 
                            value={formData['Responsável Nome Referência 1'] || ''} 
                            onChange={handleChange} 
                            placeholder="Nome da pessoa de referência 1" 
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all" 
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                          <div className="sm:col-span-7">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                              Telefone / WhatsApp
                            </label>
                            <input 
                              type="text" 
                              name="Responsável Referência 1" 
                              value={formData['Responsável Referência 1']} 
                              onChange={handleChange} 
                              placeholder="(00) 00000-0000" 
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all" 
                            />
                          </div>
                          <div className="sm:col-span-5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                              Parentesco
                            </label>
                            <select
                              name="Responsável Parentesco Ref. 1"
                              value={formData['Responsável Parentesco Ref. 1'] || ''}
                              onChange={handleChange}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-xs font-semibold"
                            >
                              <option value="">De quem é?</option>
                              <option value="Mãe">👩 Mãe</option>
                              <option value="Pai">👨 Pai</option>
                              <option value="Esposo(a)">💍 Esposo(a)</option>
                              <option value="Filho(a)">👶 Filho(a)</option>
                              <option value="Irmão/Irmã">👫 Irmão/Irmã</option>
                              <option value="Avô/Avó">👵 Avô/Avó</option>
                              <option value="Tio(a)">🧑‍🤝‍🧑 Tio(a)</option>
                              <option value="Primo(a)">👥 Primo(a)</option>
                              <option value="Namorado(a)">❤️ Namorado(a)</option>
                              <option value="Amigo(a)">🤝 Amigo(a)</option>
                              <option value="Vizinho(a)">🏘️ Vizinho(a)</option>
                              <option value="Trabalho">💼 Trabalho</option>
                              <option value="Outro">📌 Outro</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Referência 2 do Responsável */}
                      <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-1 flex items-center gap-1">
                            <PhoneCall size={11} className="text-teal-400" /> Referência 2 (Responsável)
                          </label>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Contato do Responsável</span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                            Nome da Pessoa de Referência 2
                          </label>
                          <input 
                            type="text" 
                            name="Responsável Nome Referência 2" 
                            value={formData['Responsável Nome Referência 2'] || ''} 
                            onChange={handleChange} 
                            placeholder="Nome da pessoa de referência 2" 
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all" 
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                          <div className="sm:col-span-7">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                              Telefone / WhatsApp
                            </label>
                            <input 
                              type="text" 
                              name="Responsável Referência 2" 
                              value={formData['Responsável Referência 2']} 
                              onChange={handleChange} 
                              placeholder="(00) 00000-0000" 
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all" 
                            />
                          </div>
                          <div className="sm:col-span-5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                              Parentesco
                            </label>
                            <select
                              name="Responsável Parentesco Ref. 2"
                              value={formData['Responsável Parentesco Ref. 2'] || ''}
                              onChange={handleChange}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-xs font-semibold"
                            >
                              <option value="">De quem é?</option>
                              <option value="Mãe">👩 Mãe</option>
                              <option value="Pai">👨 Pai</option>
                              <option value="Esposo(a)">💍 Esposo(a)</option>
                              <option value="Filho(a)">👶 Filho(a)</option>
                              <option value="Irmão/Irmã">👫 Irmão/Irmã</option>
                              <option value="Avô/Avó">👵 Avô/Avó</option>
                              <option value="Tio(a)">🧑‍🤝‍🧑 Tio(a)</option>
                              <option value="Primo(a)">👥 Primo(a)</option>
                              <option value="Namorado(a)">❤️ Namorado(a)</option>
                              <option value="Amigo(a)">🤝 Amigo(a)</option>
                              <option value="Vizinho(a)">🏘️ Vizinho(a)</option>
                              <option value="Trabalho">💼 Trabalho</option>
                              <option value="Outro">📌 Outro</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Redes do Responsável */}
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Sparkles size={11} className="text-pink-400" /> Instagram
                          </label>
                          <input type="text" name="Responsável Instagram" value={formData['Responsável Instagram']} onChange={handleChange} placeholder="@usuario" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Users size={11} className="text-blue-400" /> Facebook
                          </label>
                          <input type="text" name="Responsável Facebook" value={formData['Responsável Facebook']} onChange={handleChange} placeholder="Nome ou link" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Activity size={11} className="text-rose-400" /> TikTok
                          </label>
                          <input type="text" name="Responsável TikTok" value={formData['Responsável TikTok']} onChange={handleChange} placeholder="@usuario" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-400/50 transition-all" />
                        </div>
                      </div>

                      {/* Endereço do Responsável */}
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                        <div className="space-y-2 md:col-span-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Compass size={11} className="text-sky-400" /> CEP
                          </label>
                          <input type="text" name="Responsável CEP" value={formData['Responsável CEP']} onChange={handleChange} placeholder="00000-000" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <MapPin size={11} className="text-sky-400" /> Rua / Logradouro
                          </label>
                          <input type="text" name="Responsável Rua" value={formData['Responsável Rua']} onChange={handleChange} placeholder="Rua do Responsável" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Hash size={11} className="text-sky-400" /> Número
                          </label>
                          <input type="text" name="Responsável Número" value={formData['Responsável Número']} onChange={handleChange} placeholder="Nº" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Home size={11} className="text-sky-400" /> Bairro
                          </label>
                          <input type="text" name="Responsável Bairro" value={formData['Responsável Bairro']} onChange={handleChange} placeholder="Bairro" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Building2 size={11} className="text-sky-400" /> Cidade
                          </label>
                          <input type="text" name="Responsável Cidade" value={formData['Responsável Cidade']} onChange={handleChange} placeholder="Cidade" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all" />
                        </div>
                        <div className="space-y-2 md:col-span-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                            <Map size={11} className="text-sky-400" /> Estado
                          </label>
                          <input type="text" name="Responsável Estado" value={formData['Responsável Estado']} onChange={handleChange} placeholder="Estado" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all uppercase" maxLength={2} />
                        </div>

                        {/* Anexo: Foto do Comprovante de Residência do Responsável */}
                        <div className="md:col-span-4 pt-1">
                          <DocumentAttachmentInput
                            label="Foto do Comprovante de Residência do Responsável"
                            helperText="Comprovante de endereço do responsável (caso resida em endereço diferente)"
                            value={formData['Foto Comprovante Residência Responsável']}
                            onChange={(val) => setFormData(prev => ({ ...prev, 'Foto Comprovante Residência Responsável': val }))}
                            accentColor="teal"
                            clientName={formData['Responsável Nome'] || ''}
                          />
                        </div>
                      </div>
                    </div>
                  </div>



                </div>

                <div className="pt-6 mt-6 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                  {editingClientData && ['admin', 'administrativo'].includes(currentUser?.role) && onDeleteClient && (
                    <button 
                      type="button"
                      onClick={() => {
                        const nome = editingClientData['Nome Completo'] || editingClientData['NOME'] || 'este cliente';
                        if (window.confirm(`Tem certeza que deseja excluir o cadastro de "${nome}"? Esta ação removerá o cliente da base de dados e não pode ser desfeita.`)) {
                          onDeleteClient(editingClientData);
                          setIsAdding(false);
                          setEditingClientData(null);
                        }
                      }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Excluir Cliente
                    </button>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:ml-auto w-full sm:w-auto">
                    {clientsData.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setEditingClientData(null);
                        }}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-center"
                      >
                        Cancelar
                      </button>
                    )}
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} /> {editingClientData ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal e Área de Impressão da OS */}
      <OSGeneratorModal 
        isOpen={!!osClientData} 
        clientData={osClientData} 
        saleData={osSaleData}
        selectedCity={osSaleData?.['CIDADE'] || osSaleData?.['UNIDADE'] || osSaleData?.['selectedCity'] || userCity || ''}
        initialCity={osSaleData?.['CIDADE'] || osSaleData?.['UNIDADE'] || osSaleData?.['selectedCity'] || userCity || ''}
        lentesData={filteredLentes}
        armacoesData={filteredArmacoes}
        salesData={salesData}
        currentUser={currentUser}
        receberData={receberData}
        clientsData={clientsData}
        onClose={() => {
          setOsClientData(null);
          setOsSaleData(null);
        }} 
        onSaveAndPrint={handleSaveAndPrintOS} 
      />
      
      {osDataForPrint && (
        <PrintableOS clientData={osClientData} osData={osDataForPrint} />
      )}

      {/* Modal de Perfil e Histórico */}
      <ClientProfileModal
        isOpen={!!profileClientData}
        onClose={() => setProfileClientData(null)}
        clientData={profileClientData}
        currentUser={currentUser}
        onDeleteClient={onDeleteClient}
        onUpdateClient={onUpdateClient}
        clientHistory={salesData.filter(sale => isSameClient(profileClientData, sale))}
        receberData={receberData}
        onUpdateRow={onUpdateRow}
        onDeleteRow={onDeleteRow}
        onAddRow={onAddRow}
        onUpdateSale={(oldSale, updatedSale) => {
          if (onUpdateSale) {
            onUpdateSale(oldSale, updatedSale);
          } else if (onUpdateRow) {
            onUpdateRow('Registro_Vendas', oldSale, updatedSale);
          }
        }}
        onUpdateStatus={(newStatus) => {
          if (onUpdateClient && profileClientData) {
            onUpdateClient({
              oldRow: profileClientData,
              newRow: { ...profileClientData, 'Status de Pagamento': newStatus }
            });
            setProfileClientData({ ...profileClientData, 'Status de Pagamento': newStatus });

            // Sincronização com Contas a Receber do ERP com casamento estrito
            if (newStatus === 'Em dia' && receberData && receberData.length > 0 && onUpdateRow) {
              receberData.forEach(conta => {
                const st = (conta.STATUS || conta.status || '').trim();
                if (isSameClient(profileClientData, conta) && (st === 'Pendente' || st === 'Atrasado' || st === 'Inadimplente')) {
                  onUpdateRow('CONTAS_RECEBER', conta, {
                    ...conta,
                    STATUS: 'Recebido',
                    DATA_RECEBIMENTO: new Date().toISOString().split('T')[0]
                  });
                }
              });
            }
          }
        }}
        onAddPurchase={(newPurchase) => {
          if (onAddSale) {
            const clientId = profileClientData?.id || profileClientData?.['_id'] || '';
            const clientCpf = String(profileClientData?.['CPF / CNPJ'] || profileClientData?.['CPF'] || '').trim();
            onAddSale({
              ...newPurchase,
              'CLIENTE_ID': clientId,
              'CLIENTE_CPF': clientCpf,
              'CPF': clientCpf,
              'NOME CLIENTE': profileClientData?.['Nome Completo'] || profileClientData?.['NOME'] || '',
              'CLIENTE': profileClientData?.['Nome Completo'] || profileClientData?.['NOME'] || ''
            });
          }
        }}
        onEditClick={() => {
          handleStartEditClient(profileClientData);
        }}
        onGenerateOS={(clientData) => {
          handleOpenOSModal(clientData);
          setProfileClientData(null);
        }}
        onDeleteSale={async (historyIndex, deleteDebt = true) => {
          const clientSales = salesData.filter(sale => isSameClient(profileClientData, sale));
          const saleToDelete = clientSales[historyIndex];
          if (saleToDelete) {
            const osNum = String(saleToDelete['OS DA VENDA'] || saleToDelete['OS'] || saleToDelete['VENDA_OS'] || '').trim();
            const fullData = data && Object.keys(data).length > 0 ? data : {
              Registro_Vendas: salesData,
              CONTAS_RECEBER: receberData,
              CAD_ARMACOES: armacoesData,
              CAD_LENTES: lentesData,
              CLIENTES_CADASTRADOS: clientsData
            };

            try {
              await executeOSCascadeDeletion({
                osNumber: osNum,
                saleRow: saleToDelete,
                data: fullData,
                clientsData,
                onDeleteRow,
                onUpdateRow,
                deleteDebt
              });
            } catch (err) {
              console.warn('Aviso ao excluir venda em cascata:', err);
              if (onDeleteSale) {
                onDeleteSale(saleToDelete);
              }
            }
          }
        }}
        onRegisterPayment={handleConfirmPayment}
        data={data}
        receberData={receberData}
        onUpdateRow={onUpdateRow}
        onAddRow={onAddRow}
      />
    </motion.div>
  );
};

export default ClientRegistration;
