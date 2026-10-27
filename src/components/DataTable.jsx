import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, Table2, Edit2, Save, X, ClipboardList, Eye, Trash2, Printer, Tag, AlertTriangle, Paperclip, Upload, FileText, RefreshCw } from 'lucide-react';
import RowEditModal from './RowEditModal';
import PrintableOS from './PrintableOS';
import { PrintableLabelModal } from './PrintableLabel';
import ReceiptModal from './ReceiptModal';

const PAGE_SIZE = 25;

export const COLUMN_LABELS = {
  'OS': 'OS', 'DATA': 'Data', 'ANO': 'Ano', 'MÊS': 'Mês', 'CIDADE': 'Cidade',
  'NOME': 'Nome', 'DATA NASCIMENTO': 'Dt. Nasc.', 'TELEFONE CLIENTE': 'Telefone',
  'PRODUTO': 'Produto', 'DATA ENTREGA ÓCULOS': 'Entrega',
  'SATISFAÇÃO DO CLIENTE': 'Satisfação', 'RESULTADO DA LIGAÇÃO/ MENSAGEM (30 DIAS)': 'Result. 30d',
  'RESULTADO DA LIGAÇÃO/ MENSAGE (6 MESES)': 'Result. 6m',
  'DATA VENCIMENTO': 'Vencimento', 'LOJA': 'Loja',
  'VALOR PARCELA': 'Valor Parcela', 'PARCELA': 'Parcela', 'MOVIMENTAÇÃO': 'Moviment.',
  'N': 'Nº', 'DATA ORÇAMENTO': 'Data Orç.', 'NOME DO CLIENTE': 'Cliente',
  'VALOR DO ORÇAMENTO': 'Valor', 'ARMAÇÃO': 'Armação', 'LENTE': 'Lente',
  'OS DA VENDA': 'OS Venda', 'DATA  DA VENDA': 'Data da Venda',
  'DATA DA VENDA': 'Data da Venda', 'DATA_VENDA': 'Data da Venda',
  'data_venda': 'Data da Venda', 'Data da Venda': 'Data da Venda',
  'DATA DO CADASTRAMENTO': 'Dt. Cadastro', 'DIOPTRIA': 'Dioptria',
  'TIPO PRODUTO': 'Tipo', 'QTD (PAR)': 'Qtd.',
  // Campos ERP Ótica
  'unidade': 'Unidade (Cidade)', 'UNIDADE': 'Unidade (Cidade)',
  'imagem': 'Imagem/Foto', 'IMAGEM': 'Imagem/Foto',
  'marca': 'Marca', 'MARCA': 'Marca',
  'modelo': 'Modelo', 'MODELO': 'Modelo',
  'material': 'Material', 'MATERIAL': 'Material',
  'indice_refracao': 'Índ. Refração', 'INDICE_REFRACAO': 'Índ. Refração',
  'tratamento': 'Tratamento', 'TRATAMENTO': 'Tratamento',
  'esferico': 'Grau Esf.', 'ESFERICO': 'Grau Esf.',
  'cilindrico': 'Grau Cil.', 'CILINDRICO': 'Grau Cil.',
  'diametro': 'Diâmetro (mm)', 'DIAMETRO': 'Diâmetro (mm)',
  'eixo': 'Diâmetro (mm)', 'EIXO': 'Diâmetro (mm)',
  'adicao': 'Adição (Add)', 'ADICAO': 'Adição (Add)',
  'esferico_min': 'Esf. Mín.', 'esferico_max': 'Esf. Máx.',
  'cilindrico_min': 'Cil. Mín.', 'cilindrico_max': 'Cil. Máx.',
  'preco_compra': 'Pr. Compra (R$)', 'PRECO_COMPRA': 'Pr. Compra (R$)',
  'preco_venda': 'Pr. Venda (R$)', 'PRECO_VENDA': 'Pr. Venda (R$)',
  'estoque': 'Estoque', 'ESTOQUE': 'Estoque',
  'referencia_sku': 'SKU / Ref.', 'REFERENCIA_SKU': 'SKU / Ref.',
  'cor': 'Cor', 'COR': 'Cor',
  'tamanho': 'Tamanho', 'TAMANHO': 'Tamanho',
  'descricao': 'Descrição', 'DESCRICAO': 'Descrição',
  'categoria': 'Categoria', 'CATEGORIA': 'Categoria',
  'valor': 'Valor (R$)', 'VALOR': 'Valor (R$)',
  'data_vencimento': 'Vencimento', 'DATA_VENCIMENTO': 'Vencimento',
  'data_pagamento': 'Pagamento', 'DATA_PAGAMENTO': 'Pagamento',
  'data_recebimento': 'Recebimento', 'DATA_RECEBIMENTO': 'Recebimento',
  'status': 'Status', 'STATUS': 'Status',
  'fornecedor': 'Fornecedor', 'FORNECEDOR': 'Fornecedor',
  'observacoes': 'Observações', 'OBSERVACOES': 'Observações',
  'cliente': 'Cliente', 'CLIENTE': 'Cliente',
  'venda_os': 'OS / Venda', 'VENDA_OS': 'OS / Venda',
  'meio_pagamento': 'Meio Pag.', 'MEIO_PAGAMENTO': 'Meio Pag.',
  'comprovante': 'Comprovante', 'COMPROVANTE': 'Comprovante', 'ANEXO_COMPROVANTE': 'Comprovante',
  // Campos de Transferência de Estoque
  'origem': 'Loja Origem', 'ORIGEM': 'Loja Origem',
  'destino': 'Loja Destino', 'DESTINO': 'Loja Destino',
  'quantidade': 'Qtd.', 'QUANTIDADE': 'Qtd.',
  'saldo_origem_restante': 'Saldo Origem', 'SALDO_ORIGEM_RESTANTE': 'Saldo Origem',
  'saldo_destino_final': 'Saldo Destino', 'SALDO_DESTINO_FINAL': 'Saldo Destino',
  'motivo': 'Motivo', 'MOTIVO': 'Motivo',
  'operador': 'Operador Resp.', 'OPERADOR': 'Operador Resp.',
  'data_hora': 'Data/Hora', 'DATA_HORA': 'Data/Hora',
  // Campos de Vouchers / Cupons
  'codigo': 'Código Voucher', 'CODIGO': 'Código Voucher',
  'tipo_desconto': 'Tipo Desconto', 'TIPO_DESCONTO': 'Tipo Desconto',
  'valor_desconto': 'Desconto', 'VALOR_DESCONTO': 'Desconto',
  'quantidade_total': 'Qtd. Total', 'QUANTIDADE_TOTAL': 'Qtd. Total',
  'quantidade_usada': 'Qtd. Usada', 'QUANTIDADE_USADA': 'Qtd. Usada',
  'validade': 'Validade', 'VALIDADE': 'Validade',
  'data_criacao': 'Criado em', 'DATA_CRIACAO': 'Criado em',
  // Campos de Clientes & Responsável
  'Nome Completo': 'Nome',
  'Data de Nascimento': 'Dt. Nasc.',
  'CPF / CNPJ': 'CPF/CNPJ',
  'WhatsApp': 'WhatsApp',
  'Nome Referência 1': 'Nome Ref. 1',
  'Referência 1': 'Ref. 1',
  'Parentesco Ref. 1': 'Parentesco Ref. 1',
  'Nome Referência 2': 'Nome Ref. 2',
  'Referência 2': 'Ref. 2',
  'Parentesco Ref. 2': 'Parentesco Ref. 2',
  'E-mail': 'E-mail',
  'Instagram': 'Instagram',
  'Facebook': 'Facebook',
  'TikTok': 'TikTok',
  'CEP': 'CEP',
  'Rua': 'Rua',
  'Número': 'Nº',
  'Bairro': 'Bairro',
  'Cidade': 'Cidade',
  'Estado': 'UF',
  'Marca de Lente': 'Lente',
  'Modelo de Armação': 'Armação',
  'Status de Pagamento': 'Status',
  'Valor Devido': 'Valor Devido',
  'Responsável Nome': 'Resp. Nome',
  'Responsável Data de Nascimento': 'Resp. Dt. Nasc.',
  'Responsável CPF': 'Resp. CPF',
  'Responsável RG': 'Resp. RG',
  'Responsável WhatsApp': 'Resp. WhatsApp',
  'Responsável Nome Referência 1': 'Resp. Nome Ref. 1',
  'Responsável Referência 1': 'Resp. Ref. 1',
  'Responsável Parentesco Ref. 1': 'Resp. Parentesco Ref. 1',
  'Responsável Nome Referência 2': 'Resp. Nome Ref. 2',
  'Responsável Referência 2': 'Resp. Ref. 2',
  'Responsável Parentesco Ref. 2': 'Resp. Parentesco Ref. 2',
  'Responsável Instagram': 'Resp. Instagram',
  'Responsável Facebook': 'Resp. Facebook',
  'Responsável TikTok': 'Resp. TikTok',
  'Responsável CEP': 'Resp. CEP',
  'Responsável Rua': 'Resp. Rua',
  'Responsável Número': 'Resp. Nº',
  'Responsável Bairro': 'Resp. Bairro',
  'Responsável Cidade': 'Resp. Cidade',
  'Responsável Estado': 'Resp. UF',
  'CLIENTE_CPF': 'CPF/CNPJ',
  'CLIENTE_ID': 'ID Cliente'
};

// Dicionário de Grupos Canônicos para Eliminar Colunas e Campos Duplicados
export const CANONICAL_ALIASES = [
  {
    id: 'status',
    canonical: 'STATUS',
    label: 'Status',
    keys: ['STATUS', 'status', 'Status', 'SITUAÇÃO', 'Situação', 'Status de Pagamento', 'STATUS_PAGAMENTO']
  },
  {
    id: 'cliente',
    canonical: 'CLIENTE',
    label: 'Cliente',
    keys: ['CLIENTE', 'cliente', 'NOME DO CLIENTE', 'NOME CLIENTE', 'Nome Completo', 'NOME', 'nome', 'Cliente']
  },
  {
    id: 'cpf',
    canonical: 'CPF',
    label: 'CPF / CNPJ',
    keys: ['CPF / CNPJ', 'CPF', 'cpf', 'CLIENTE_CPF', 'cliente_cpf']
  },
  {
    id: 'cliente_id',
    canonical: 'CLIENTE_ID',
    label: 'ID do Cliente',
    keys: ['CLIENTE_ID', 'cliente_id', 'ID DO CLIENTE', 'ID_CLIENTE']
  },
  {
    id: 'valor',
    canonical: 'VALOR',
    label: 'Valor (R$)',
    keys: ['VALOR', 'valor', 'VALOR (R$)', 'VALOR TOTAL', 'VALOR DA VENDA', 'Valor']
  },
  {
    id: 'data_venda',
    canonical: 'DATA  DA VENDA',
    label: 'Data da Venda',
    keys: ['DATA  DA VENDA', 'DATA DA VENDA', 'DATA_VENDA', 'data_venda', 'Data da Venda', 'DATA', 'Data', 'data']
  },
  {
    id: 'vencimento',
    canonical: 'DATA_VENCIMENTO',
    label: 'Vencimento',
    keys: ['DATA_VENCIMENTO', 'DATA VENCIMENTO', 'data_vencimento', 'VENCIMENTO', 'vencimento', 'Data de Vencimento']
  },
  {
    id: 'pagamento',
    canonical: 'DATA_RECEBIMENTO',
    label: 'Recebimento / Pagamento',
    keys: ['DATA_RECEBIMENTO', 'DATA RECEBIMENTO', 'data_recebimento', 'RECEBIMENTO', 'recebimento', 'DATA_PAGAMENTO', 'DATA PAGAMENTO', 'data_pagamento', 'PAGAMENTO']
  },
  {
    id: 'meio_pagamento',
    canonical: 'MEIO_PAGAMENTO',
    label: 'Meio de Pagamento',
    keys: ['MEIO_PAGAMENTO', 'meio_pagamento', 'FORMA DE PAGAMENTO', 'FORMA_PAGAMENTO', 'FORMA', 'forma_pagamento']
  },
  {
    id: 'cidade',
    canonical: 'CIDADE',
    label: 'Loja / Cidade',
    keys: ['CIDADE', 'cidade', 'UNIDADE', 'unidade', 'LOJA', 'loja', 'Cidade']
  },
  {
    id: 'comprovante',
    canonical: 'COMPROVANTE',
    label: 'Comprovante',
    keys: ['COMPROVANTE', 'comprovante', 'ANEXO_COMPROVANTE', 'anexo_comprovante']
  },
  {
    id: 'descricao',
    canonical: 'DESCRICAO',
    label: 'Descrição',
    keys: ['DESCRICAO', 'descricao', 'DOCUMENTO', 'documento', 'HISTORICO']
  },
  {
    id: 'os',
    canonical: 'VENDA_OS',
    label: 'OS / Venda',
    keys: ['VENDA_OS', 'venda_os', 'OS', 'os', 'Nº DA OS', 'OS DA VENDA']
  },
  {
    id: 'observacoes',
    canonical: 'OBSERVACOES',
    label: 'Observações',
    keys: ['OBSERVACOES', 'observacoes', 'OBSERVAÇÕES', 'observações', 'DETALHES', 'detalhes']
  },
  {
    id: 'whatsapp',
    canonical: 'WhatsApp',
    label: 'WhatsApp / Telefone',
    keys: ['WhatsApp', 'whatsapp', 'TELEFONE', 'telefone', 'TELEFONE CLIENTE', 'Celular']
  },
  {
    id: 'estoque',
    canonical: 'ESTOQUE',
    label: 'Estoque',
    keys: ['ESTOQUE', 'estoque', 'EM ESTOQUE', 'QTD', 'QUANTIDADE', 'quantidade']
  },
  {
    id: 'preco_venda',
    canonical: 'PRECO_VENDA',
    label: 'Preço Venda (R$)',
    keys: ['PRECO_VENDA', 'preco_venda', 'VALOR_VENDA', 'PREÇO DE VENDA']
  },
  {
    id: 'preco_compra',
    canonical: 'PRECO_COMPRA',
    label: 'Preço Compra (R$)',
    keys: ['PRECO_COMPRA', 'preco_compra', 'VALOR_COMPRA', 'CUSTO']
  }
];

export const getRowValue = (row, col) => {
  if (!row) return '';
  if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
    return row[col];
  }
  const trimmed = String(col || '').trim();
  const group = CANONICAL_ALIASES.find(g =>
    g.keys.some(k => k.toLowerCase() === trimmed.toLowerCase())
  );
  if (group) {
    for (const alias of group.keys) {
      if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
        return row[alias];
      }
    }
  }
  return '';
};

const formatCPF_CNPJ = (val) => {
  if (!val) return '—';
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
  if (!val) return '—';
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

const fmt = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  if (val instanceof Date) return val.toLocaleDateString('pt-BR');
  if (typeof val === 'number') {
    // Detecta datas seriais do Excel (entre 30000 e 60000 = anos 1982-2064)
    if (val > 30000 && val < 60000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return d.toLocaleDateString('pt-BR');
    }
    return val.toLocaleString('pt-BR');
  }
  const s = String(val);
  // Se for formato YYYY-MM-DD, formata para DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [ano, mes, dia] = s.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return s;
};

export const cleanBoletoDisplay = (val) => {
  if (typeof val !== 'string') return val;
  return val
    .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
};

export const isMeaningfulRow = (row) => {
  if (!row || typeof row !== 'object') return false;
  return Object.entries(row).some(([k, v]) => {
    if (v === null || v === undefined || v === '') return false;
    const s = String(v).trim();
    return s !== '' && s !== '—' && s !== '-' && s !== '#N/A' && s !== 'Sem Registro na Base Antiga';
  });
};

const DataTable = ({ sheetName, rows, onRowUpdate, onEditRow, onGenerateOS, onViewInstallments, onReparcelarOS, onViewProfile, onViewVoucherUsage, onDeleteRow, currentUser, allowEdit = true, showPrintOS = false, showPrintLabel = false }) => {
  const isAdmin = ['admin', 'administrativo'].includes(currentUser?.role);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingRow, setEditingRow] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [printRowData, setPrintRowData] = useState(null);
  const [printClientData, setPrintClientData] = useState(null);
  const [labelModalItem, setLabelModalItem] = useState(null);
  const [receiptModalRow, setReceiptModalRow] = useState(null);

  const handleEditClick = (row) => {
    setEditingRow(row);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingRow(null);
    setIsEditModalOpen(false);
  };

  const handleSaveModal = (updatedData) => {
    if (onRowUpdate) {
      onRowUpdate(sheetName, editingRow, updatedData);
    }
    setEditingRow(null);
    setIsEditModalOpen(false);
  };

  const allCols = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const keys = new Set();
    const validRows = rows.filter(isMeaningfulRow);
    const targetRows = validRows.length > 0 ? validRows : rows;

    const forbiddenCols = ['password', 'senha', 'pass', 'hash', 'token', 'secret'];

    targetRows.forEach(r => {
      if (!r || typeof r !== 'object') return;
      Object.keys(r).forEach(k => {
        if (!k || k.startsWith('_')) return;
        const kLower = k.toLowerCase().trim();
        if (forbiddenCols.some(f => kLower.includes(f))) return; // Filtro de segurança: nunca exibir senhas ou credenciais

        // Preserva e inclui todas as colunas preenchidas na planilha (com emojis e caracteres especiais)
        const hasVal = targetRows.some(row => row && typeof row === 'object' && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '');
        if (hasVal) keys.add(k);
      });
    });
    if (sheetName === 'CAD_ARMACOES') {
      ['IMAGEM', 'MARCA', 'MODELO', 'REFERENCIA_SKU', 'COR', 'TAMANHO', 'MATERIAL', 'ESTOQUE', 'PRECO_VENDA', 'PRECO_COMPRA', 'UNIDADE', 'OBSERVACOES'].forEach(col => keys.add(col));
    }
    if (sheetName === 'CAD_LENTES') {
      ['MARCA', 'MODELO', 'ESFERICO', 'CILINDRICO', 'DIAMETRO', 'EIXO', 'ADICAO', 'MATERIAL', 'INDICE_REFRACAO', 'TRATAMENTO', 'ESFERICO_MIN', 'ESFERICO_MAX', 'CILINDRICO_MIN', 'CILINDRICO_MAX', 'ESTOQUE', 'PRECO_COMPRA', 'PRECO_VENDA', 'UNIDADE', 'OBSERVACOES'].forEach(col => keys.add(col));
    }
    if (sheetName === 'CAD_BRINDES') {
      ['IMAGEM', 'NOME', 'CATEGORIA', 'REFERENCIA_SKU', 'COR', 'ESTOQUE', 'PRECO_VENDA', 'PRECO_COMPRA', 'UNIDADE', 'OBSERVACOES'].forEach(col => keys.add(col));
    }

    const colsList = [...keys].filter(k => k && k !== '' && !k.startsWith('_'));

    // Dicionário de prioridade de colunas para cada módulo/catálogo do ERP
    const priorityMaps = {
      CAD_BRINDES: [
        'IMAGEM', 'imagem',
        'NOME', 'nome', 'DESCRICAO', 'descricao',
        'CATEGORIA', 'categoria',
        'REFERENCIA_SKU', 'referencia_sku', 'SKU', 'CODIGO',
        'COR', 'cor',
        'ESTOQUE', 'estoque',
        'PRECO_VENDA', 'preco_venda', 'PREÇO',
        'PRECO_COMPRA', 'preco_compra', 'CUSTO',
        'UNIDADE', 'unidade', 'CIDADE', 'cidade', 'LOJA',
        'OBSERVACOES', 'observacoes'
      ],
      CAD_ARMACOES: [
        'IMAGEM', 'imagem',
        'MARCA', 'marca',
        'MODELO', 'modelo',
        'REFERENCIA_SKU', 'referencia_sku', 'SKU', 'REFERÊNCIA',
        'COR', 'cor',
        'TAMANHO', 'tamanho',
        'ESTOQUE', 'estoque',
        'PRECO_VENDA', 'preco_venda', 'VALOR_VENDA', 'PREÇO',
        'PRECO_COMPRA', 'preco_compra', 'VALOR_COMPRA', 'CUSTO',
        'MATERIAL', 'material',
        'UNIDADE', 'unidade', 'CIDADE', 'cidade', 'LOJA',
        'OBSERVACOES', 'observacoes'
      ],
      CAD_LENTES: [
        'MARCA', 'marca',
        'MODELO', 'modelo', 'TIPO',
        'ESFERICO', 'esferico',
        'CILINDRICO', 'cilindrico',
        'DIAMETRO', 'diametro',
        'EIXO', 'eixo',
        'ADICAO', 'adicao',
        'TRATAMENTO', 'tratamento',
        'MATERIAL', 'material',
        'INDICE_REFRACAO', 'indice_refracao',
        'ESTOQUE', 'estoque',
        'PRECO_VENDA', 'preco_venda',
        'PRECO_COMPRA', 'preco_compra',
        'ESFERICO_MIN', 'esferico_min', 'ESFERICO_MAX', 'esferico_max',
        'CILINDRICO_MIN', 'cilindrico_min', 'CILINDRICO_MAX', 'cilindrico_max',
        'UNIDADE', 'unidade', 'CIDADE', 'cidade',
        'OBSERVACOES', 'observacoes'
      ],
      CONTAS_PAGAR: [
        'STATUS', 'status',
        'DESCRICAO', 'descricao', 'DESPESA', 'despesa',
        'VALOR', 'valor',
        'DATA_VENCIMENTO', 'DATA VENCIMENTO', 'VENCIMENTO',
        'CATEGORIA', 'categoria',
        'FORNECEDOR', 'fornecedor',
        'DATA_PAGAMENTO', 'DATA PAGAMENTO', 'PAGAMENTO',
        'CIDADE', 'UNIDADE', 'LOJA',
        'OBSERVACOES', 'observacoes'
      ],
      CONTAS_RECEBER: [
        'STATUS', 'status',
        'CLIENTE', 'cliente', 'NOME DO CLIENTE',
        'VALOR', 'valor',
        'DATA_VENCIMENTO', 'DATA VENCIMENTO', 'VENCIMENTO',
        'MEIO_PAGAMENTO', 'meio_pagamento', 'FORMA DE PAGAMENTO',
        'COMPROVANTE', 'comprovante',
        'DESCRICAO', 'descricao',
        'VENDA_OS', 'OS', 'Nº DA OS',
        'DATA_RECEBIMENTO', 'DATA RECEBIMENTO',
        'OBSERVACOES', 'observacoes'
      ],
      Registro_Vendas: [
        'Nº DA OS', 'OS', 'ID',
        'DATA  DA VENDA', 'DATA', 'DATA DA VENDA',
        'CLIENTE', 'NOME DO CLIENTE', 'Nome Completo',
        'VALOR TOTAL', 'VALOR DA VENDA', 'VALOR',
        'FORMA DE PAGAMENTO', 'FORMA',
        'VENDEDOR', 'OPERADOR',
        'CIDADE', 'LOJA', 'UNIDADE',
        'PRODUTO', 'LENTE', 'ARMAÇÃO',
        'STATUS'
      ],
      'BD MARKETING': [
        'Nº DA OS', 'OS', 'ID',
        'DATA  DA VENDA', 'DATA', 'DATA DA VENDA',
        'CLIENTE', 'NOME DO CLIENTE',
        'VALOR TOTAL', 'VALOR DA VENDA', 'VALOR',
        'FORMA DE PAGAMENTO', 'FORMA',
        'VENDEDOR', 'OPERADOR',
        'CIDADE', 'LOJA',
        'PRODUTO'
      ],
      CLIENTES_CADASTRADOS: [
        'Nome Completo', 'NOME', 'NOME DO CLIENTE', 'CLIENTE',
        'WhatsApp', 'TELEFONE', 'TELEFONE CLIENTE',
        'CPF / CNPJ', 'CPF',
        'RG',
        'Cidade', 'CIDADE', 'LOJA',
        'Status de Pagamento', 'STATUS',
        'Valor Devido', 'VALOR DEVIDO',
        'Marca de Lente', 'LENTE',
        'Modelo de Armação', 'ARMAÇÃO',
        'Data de Nascimento', 'DATA NASCIMENTO',
        'Data de Vencimento', 'DATA VENCIMENTO',
        'Responsável Nome', 'Responsável',
        'Responsável WhatsApp', 'Responsável CPF', 'Responsável RG',
        'Rua', 'Número', 'Bairro', 'CEP', 'Estado',
        'Nome Referência 1', 'Referência 1', 'Parentesco Ref. 1', 
        'Nome Referência 2', 'Referência 2', 'Parentesco Ref. 2',
        'Responsável Nome Referência 1', 'Responsável Referência 1', 'Responsável Parentesco Ref. 1',
        'Responsável Nome Referência 2', 'Responsável Referência 2', 'Responsável Parentesco Ref. 2',
        'E-mail', 'Instagram', 'Facebook', 'TikTok'
      ],
      TRANSFERENCIAS_ESTOQUE: [
        'ID', 'id',
        'DATA', 'data',
        'HORA', 'hora',
        'TIPO', 'tipo',
        'PRODUTO', 'produto',
        'ORIGEM', 'origem',
        'DESTINO', 'destino',
        'QUANTIDADE', 'quantidade',
        'SALDO_ORIGEM_RESTANTE', 'saldo_origem_restante',
        'SALDO_DESTINO_FINAL', 'saldo_destino_final',
        'MOTIVO', 'motivo',
        'OPERADOR', 'operador',
        'STATUS', 'status',
        'OBSERVACOES', 'observacoes'
      ],
      VOUCHERS: [
        'STATUS', 'status',
        'CODIGO', 'codigo',
        'NOME', 'nome',
        'TIPO_DESCONTO', 'tipo_desconto',
        'VALOR_DESCONTO', 'valor_desconto',
        'QUANTIDADE_TOTAL', 'quantidade_total',
        'QUANTIDADE_USADA', 'quantidade_usada',
        'UNIDADE', 'unidade',
        'VALIDADE', 'validade',
        'DATA_CRIACAO', 'data_criacao',
        'OBSERVACOES', 'observacoes'
      ]
    };

    const targetPriority = priorityMaps[sheetName] || (
      colsList.some(k => k.includes('Nome Completo') || k.includes('WhatsApp')) ? priorityMaps.CLIENTES_CADASTRADOS : null
    );

    const sorted = targetPriority ? colsList.sort((a, b) => {
      const idxA = targetPriority.indexOf(a);
      const idxB = targetPriority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    }) : colsList;

    // Desduplica colunas de aliases conhecidos (evita exibir STATUS e status, CLIENTE e NOME CLIENTE, etc.)
    const seenGroups = new Set();
    const deduplicated = [];

    sorted.forEach(col => {
      const trimmed = String(col).trim();
      const group = CANONICAL_ALIASES.find(g =>
        g.keys.some(k => k.toLowerCase() === trimmed.toLowerCase())
      );
      if (group) {
        if (!seenGroups.has(group.id)) {
          seenGroups.add(group.id);
          deduplicated.push(col);
        }
      } else {
        const lower = trimmed.toLowerCase();
        if (!seenGroups.has(lower)) {
          seenGroups.add(lower);
          deduplicated.push(col);
        }
      }
    });

    return deduplicated;
  }, [rows, sheetName]);

  const filtered = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    let validRows = rows.filter(isMeaningfulRow);
    if (validRows.length === 0) validRows = rows;

    // Vendedores agora podem visualizar o estoque de todas as lojas e filiais igual ao administrador

    if (search) {
      const q = search.toLowerCase().trim();
      validRows = validRows.filter(r =>
        Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
      );
    }
    return validRows;
  }, [rows, search, currentUser, sheetName]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Table2 size={40} className="mb-4 opacity-30" />
        <p className="font-bold">Nenhum dado encontrado nesta aba.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            {filtered.length.toLocaleString()} registros
          </span>
          {search && <span className="text-xs text-sky-400 font-bold">· filtrado</span>}
        </div>
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 erp-scroll">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap w-20">Ações</th>
              {allCols.map(col => (
                <th key={col} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                  {COLUMN_LABELS[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">
                  <div className="flex items-center gap-1">
                    {allowEdit && (
                      <button 
                        onClick={() => onEditRow ? onEditRow(row) : handleEditClick(row)} 
                        className="p-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors" 
                        title="Editar Cadastro / Registro"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {onViewProfile && (
                      <button onClick={() => onViewProfile(row)} className="p-1.5 flex items-center gap-1.5 px-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors font-black text-xs" title="Abrir Perfil do Cliente">
                        <Eye size={14} /> Perfil
                      </button>
                    )}
                    {onViewInstallments && (
                      <button onClick={() => onViewInstallments(row)} className="p-1.5 flex items-center gap-1.5 px-2.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors font-black text-xs" title="Ver Todas as Mensalidades / Boletos do Cliente">
                        <Table2 size={14} /> Mensalidades
                      </button>
                    )}
                    {onReparcelarOS && sheetName === 'CONTAS_RECEBER' && (
                      <button
                        onClick={() => onReparcelarOS(row)}
                        className="p-1.5 flex items-center gap-1.5 px-2.5 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-all font-black text-xs shadow-sm"
                        title="Reparcelar / Renegociar Parcelas referente à OS no Financeiro"
                      >
                        <RefreshCw size={13} className="text-indigo-400" />
                        <span>Reparcelar OS</span>
                      </button>
                    )}
                    {onViewVoucherUsage && sheetName === 'VOUCHERS' && (
                      <button 
                        onClick={() => onViewVoucherUsage(row)} 
                        className="p-1.5 flex items-center gap-1.5 px-2.5 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-all font-black text-xs shadow-sm"
                        title="Ver Quem Usou / Histórico de Uso deste Voucher"
                      >
                        <Eye size={13} />
                        <span>Quem Usou 👁️</span>
                      </button>
                    )}
                    {sheetName === 'CONTAS_RECEBER' && (
                      <button 
                        onClick={() => setReceiptModalRow(row)} 
                        className={`p-1.5 flex items-center gap-1.5 px-2.5 rounded-lg transition-all font-black text-xs border ${
                          (row.COMPROVANTE || row.comprovante || row.ANEXO_COMPROVANTE)
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 shadow-sm'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border-white/10'
                        }`}
                        title={(row.COMPROVANTE || row.comprovante || row.ANEXO_COMPROVANTE) ? "Ver Comprovante Anexado" : "Anexar Comprovante de Pagamento"}
                      >
                        <Paperclip size={13} className={(row.COMPROVANTE || row.comprovante || row.ANEXO_COMPROVANTE) ? "text-emerald-400" : "text-slate-400"} />
                        <span className="hidden sm:inline">{(row.COMPROVANTE || row.comprovante || row.ANEXO_COMPROVANTE) ? 'Comprovante' : '+ Anexar'}</span>
                      </button>
                    )}
                    {onGenerateOS && (
                      <button onClick={() => onGenerateOS(row)} className="p-1.5 bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 rounded-lg transition-colors" title="Gerar OS">
                        <ClipboardList size={14} />
                      </button>
                    )}
                    {/* Botão Reimprimir OS (oculto no Dashboard, exibido apenas se showPrintOS=true) */}
                    {showPrintOS && (row['OS'] || row['OS DA VENDA'] || row['OS da COMPRA'] || row['VENDA_OS']) && (
                      <button
                        onClick={() => {
                          const rowOS = row['OS'] || row['OS DA VENDA'] || row['OS da COMPRA'] || row['VENDA_OS'];
                          setPrintRowData({
                            numeroOS: rowOS,
                            selectedCity: row['CIDADE'] || row['LOJA'] || row['UNIDADE'] || 'Central',
                            unidade: row['CIDADE'] || row['LOJA'] || row['UNIDADE'] || 'Central',
                            medico: row['MEDICO'] || '',
                            lente: row['LENTE'] || row['PRODUTO'] || '',
                            armacao: row['ARMAÇÃO'] || '',
                            valorTotal: row['VALOR TOTAL'] || row['VALOR'] || '0,00',
                            valorEntrada: row['VALOR ENTRADA'] || '0,00',
                            restante: row['RESTANTE'] || '0,00',
                            dataEntrega: row['DATA ENTREGA ÓCULOS'] || row['DATA_ENTREGA'] || '',
                            formasPagamento: row['FORMAS_PAGAMENTO'] || row['MEIO_PAGAMENTO'] || '',
                            observacoes: row['OBSERVACOES'] || '',
                            odEsf: row['OD_ESF'] || '',
                            odCil: row['OD_CIL'] || '',
                            odEixo: row['OD_EIXO'] || '',
                            odDnp: row['OD_DNP'] || '',
                            odAlt: row['OD_ALT'] || '',
                            oeEsf: row['OE_ESF'] || '',
                            oeCil: row['OE_CIL'] || '',
                            oeEixo: row['OE_EIXO'] || '',
                            oeDnp: row['OE_DNP'] || '',
                            oeAlt: row['OE_ALT'] || '',
                            adicao: row['ADICAO'] || ''
                          });
                          setPrintClientData({
                            ...row,
                            'Nome Completo': row['Nome Completo'] || row['NOME'] || row['NOME DO CLIENTE'] || row['CLIENTE'] || 'Cliente',
                            'CPF / CNPJ': row['CPF / CNPJ'] || row['CPF'] || '',
                            'WhatsApp': row['WhatsApp'] || row['TELEFONE'] || row['TELEFONE CLIENTE'] || '',
                            'Cidade': row['CIDADE'] || row['Cidade'] || 'Central'
                          });
                          setTimeout(() => window.print(), 300);
                        }}
                        className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors"
                        title="Reimprimir Ordem de Serviço"
                      >
                        <Printer size={14} />
                      </button>
                    )}
                    {/* Botão Imprimir Etiqueta Térmica 50x30mm (oculto no Dashboard, exibido apenas se showPrintLabel=true) */}
                    {showPrintLabel && (
                      <button
                        onClick={() => setLabelModalItem(row)}
                        className="p-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-lg transition-colors"
                        title="Imprimir Etiqueta Térmica (50x30mm) - Haste / Envelope Lab"
                      >
                        <Tag size={14} />
                      </button>
                    )}

                    {isAdmin && onDeleteRow && (
                      <button 
                        onClick={() => {
                          const nome = row['Nome Completo'] || row['NOME'] || row['CLIENTE'] || row['MODELO'] || row['DESCRICAO'] || row['CODIGO'] || row['REFERENCIA_SKU'] || row['FORNECEDOR'] || 'este registro';
                          if (window.confirm(`Tem certeza que deseja excluir "${nome}"? Esta ação é definitiva e não pode ser desfeita.`)) {
                            onDeleteRow(sheetName, row);
                          }
                        }} 
                        className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors" 
                        title="Excluir Registro (Somente Admin)"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
                {allCols.map(col => {
                  const val = getRowValue(row, col);
                  const colLower = col.toLowerCase();

                  // ─── ALERTA DE ESTOQUE MÍNIMO (PONTO DE PEDIDO) ───
                  if (col === 'ESTOQUE' || col === 'estoque' || col === 'EM ESTOQUE' || col === 'Estoque' || col === 'QTD' || col === 'QTD (PAR)' || col === 'quantidade' || col === 'QUANTIDADE') {
                    const stockNum = parseInt(val, 10);
                    if (!isNaN(stockNum)) {
                      if (stockNum === 0) {
                        return (
                          <td key={col} className="px-4 py-3 whitespace-nowrap text-xs">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm animate-pulse">
                              🔴 0 un (Esgotado)
                            </span>
                          </td>
                        );
                      }
                      if (stockNum <= 2) {
                        return (
                          <td key={col} className="px-4 py-3 whitespace-nowrap text-xs">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                              ⚠️ {stockNum} un (Ponto de Pedido)
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={col} className="px-4 py-3 whitespace-nowrap text-xs">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {stockNum} un
                          </span>
                        </td>
                      );
                    }
                  }

                  if (col === 'IMAGEM' && val && String(val).startsWith('data:image')) {
                    return (
                      <td key={col} className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">
                        <div className="w-8 h-8 rounded bg-black/30 overflow-hidden border border-white/10">
                          <img src={val} alt="Armação" className="w-full h-full object-cover" />
                        </div>
                      </td>
                    );
                  }

                  if (colLower === 'comprovante' || colLower === 'anexo_comprovante') {
                    const hasReceipt = Boolean(val || row.COMPROVANTE || row.comprovante || row.ANEXO_COMPROVANTE);
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap text-xs">
                        {hasReceipt ? (
                          <button
                            type="button"
                            onClick={() => setReceiptModalRow(row)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-sm"
                            title="Visualizar Comprovante em Alta Resolução"
                          >
                            <Paperclip size={13} />
                            <span>Ver Comprovante</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReceiptModalRow(row)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
                            title="Anexar Comprovante (Foto ou PDF)"
                          >
                            <Upload size={12} />
                            <span>Anexar</span>
                          </button>
                        )}
                      </td>
                    );
                  }

                  if (col === 'Nome Completo' || col === 'NOME' || col === 'NOME DO CLIENTE' || col === 'CLIENTE') {
                    return (
                      <td key={col} className="px-4 py-3 text-white font-bold whitespace-nowrap text-xs">
                        {val || '—'}
                      </td>
                    );
                  }

                  if (colLower.includes('whatsapp') || colLower.includes('telefone')) {
                    return (
                      <td key={col} className="px-4 py-3 text-emerald-400 font-medium whitespace-nowrap text-xs font-mono">
                        {val ? String(val) : '—'}
                      </td>
                    );
                  }

                  if (colLower.includes('cpf') || colLower.includes('cnpj')) {
                    return (
                      <td key={col} className="px-4 py-3 text-slate-200 font-mono font-medium whitespace-nowrap text-xs">
                        {formatCPF_CNPJ(val)}
                      </td>
                    );
                  }

                  if (colLower.includes('rg') && !colLower.includes('cargo') && !colLower.includes('largura')) {
                    return (
                      <td key={col} className="px-4 py-3 text-slate-200 font-mono font-medium whitespace-nowrap text-xs">
                        {formatRG(val)}
                      </td>
                    );
                  }

                  if (col === 'Status de Pagamento' || col === 'STATUS' || col === 'status') {
                    const st = String(val || 'Em dia').trim();
                    const isEmDia = st.toLowerCase() === 'em dia' || st.toLowerCase() === 'pago' || st.toLowerCase() === 'recebido';
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap text-xs">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isEmDia
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {st}
                        </span>
                      </td>
                    );
                  }

                  if (colLower.includes('devido') || colLower === 'valor devido' || colLower === 'saldo devedor') {
                    const num = parseCurrency(val);
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap text-xs font-black">
                        <span className={num > 0 ? 'text-rose-400' : 'text-slate-400'}>
                          R$ {formatMoney(val)}
                        </span>
                      </td>
                    );
                  }

                  if (col === 'UNIDADE' || col === 'CIDADE' || col === 'LOJA' || col === 'unidade' || col === 'cidade') {
                    const uStr = String(val || '').trim();
                    if (!uStr) {
                      return <td key={col} className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">—</td>;
                    }
                    let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                    const lowerU = uStr.toLowerCase();
                    if (lowerU.includes('cajati')) badgeClass = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
                    else if (lowerU.includes('registro')) badgeClass = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
                    else if (lowerU.includes('jacupiranga')) badgeClass = 'bg-teal-500/15 text-teal-300 border-teal-500/30';
                    else if (lowerU.includes('central')) badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    else if (lowerU.includes('externa')) badgeClass = 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30';
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap text-xs">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                          📍 {uStr}
                        </span>
                      </td>
                    );
                  }

                  const isPaymentOrDocCol = colLower.includes('meio_pagamento') || colLower.includes('forma') || colLower === 'documento';
                  const formatted = fmt(val);
                  const displayContent = isPaymentOrDocCol ? cleanBoletoDisplay(formatted) : formatted;

                  return (
                    <td 
                      key={col} 
                      className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs max-w-[320px] overflow-hidden text-ellipsis"
                      title={val !== null && val !== undefined ? String(val) : ''}
                    >
                      {displayContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500 font-bold">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const num = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button key={num} onClick={() => setPage(num)}
                  className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                    page === num ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}>
                  {num}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      <RowEditModal
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveModal}
        rowData={editingRow}
        allCols={allCols}
        COLUMN_LABELS={COLUMN_LABELS}
        sheetName={sheetName}
      />

      {/* Componente Invisível de Impressão da OS */}
      {printRowData && printClientData && (
        <PrintableOS clientData={printClientData} osData={printRowData} />
      )}

      {/* Modal de Impressão de Etiquetas Térmicas (50x30mm) */}
      <PrintableLabelModal
        isOpen={Boolean(labelModalItem)}
        onClose={() => setLabelModalItem(null)}
        data={labelModalItem}
        defaultType={(labelModalItem?.numeroOS || labelModalItem?.OS || labelModalItem?.['OS DA VENDA'] || labelModalItem?.['OS da COMPRA']) ? 'envelope_lab' : 'armacao'}
      />

      {/* Modal de Anexo e Visualização de Comprovante de Pagamento */}
      <ReceiptModal
        isOpen={Boolean(receiptModalRow)}
        onClose={() => setReceiptModalRow(null)}
        row={receiptModalRow}
        onSave={async ({ comprovante, nomeArquivo, dataAnexo, markAsPaid }) => {
          if (onRowUpdate && receiptModalRow) {
            const updated = {
              ...receiptModalRow,
              COMPROVANTE: comprovante,
              comprovante: comprovante,
              DATA_COMPROVANTE: dataAnexo,
              NOME_COMPROVANTE: nomeArquivo,
              ...(markAsPaid ? { STATUS: 'Recebido', status: 'Recebido', DATA_RECEBIMENTO: new Date().toLocaleDateString('pt-BR') } : {})
            };
            await onRowUpdate(sheetName, receiptModalRow, updated);
            setReceiptModalRow(updated);
          }
        }}
        onDelete={async () => {
          if (onRowUpdate && receiptModalRow) {
            const updated = {
              ...receiptModalRow,
              COMPROVANTE: '',
              comprovante: '',
              ANEXO_COMPROVANTE: '',
              DATA_COMPROVANTE: '',
              NOME_COMPROVANTE: ''
            };
            await onRowUpdate(sheetName, receiptModalRow, updated);
            setReceiptModalRow(updated);
          }
        }}
      />
    </motion.div>
  );
};

export default DataTable;
