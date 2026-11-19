import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

function excelDateToStr(serial) {
  if (!serial) return '';
  if (typeof serial === 'string') return serial.trim();
  if (typeof serial === 'number') {
    if (serial > 30000 && serial < 60000) {
      const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yr = d.getUTCFullYear();
        return `${day}/${mon}/${yr}`;
      }
    }
    return String(serial);
  }
  return String(serial);
}

console.log('Lendo planilha_backup_legada.xlsx...');
const wb = XLSX.readFile('planilha_backup_legada.xlsx');

console.log('Mapeando Vendas...');
const vendas = XLSX.utils.sheet_to_json(wb.Sheets['Registro_Vendas'] || []).map((r, i) => ({
  id: i + 1,
  data_venda: excelDateToStr(r['DATA DA VENDA']),
  ano: String(r['ANO'] || ''),
  mes: String(r['MÊS'] || ''),
  loja: String(r['LOJA'] || ''),
  vendedora: String(r['VENDEDORA'] || ''),
  os: String(r['OS'] || ''),
  cliente: String(r[' CLIENTE'] || r['CLIENTE'] || r['Nome'] || ''),
  responsavel: String(r['RESPOSÁVEL'] || r['RESPONSÁVEL'] || ''),
  telefone_responsavel: String(r['TELEFONE RESPONSÁVEL'] || ''),
  telefone_cliente: String(r['TELEFONE CLIENTE'] || r['TELEFONE'] || ''),
  lente: String(r[' LENTE'] || r['LENTE'] || ''),
  armacao: String(r['ARMAÇÃO'] || ''),
  dioptria: String(r['DIOPTRIA'] || ''),
  medico: String(r['OPTOMETRIA             OU                                OFTAMOLOGISTA'] || ''),
  valor_armacao: String(r['VALOR ARMAÇÃO'] || ''),
  valor_lente: String(r['VALOR LENTE'] || ''),
  valor_produto: String(r['VALOR DO PRODUTO'] || ''),
  valor_entrada: String(r['VALOR ENTRADA'] || ''),
  n_parcelas: String(r['N° PARCELAS'] || ''),
  tipo_compra: String(r['TIPO DE COMPRA'] || ''),
  rg: String(r['RG '] || r['RG'] || ''),
  cpf: String(r['CPF'] || ''),
  data_nascimento: excelDateToStr(r['DATA DE NASCIMENTO'])
}));

console.log('Mapeando Parcelas...');
const parcelas = XLSX.utils.sheet_to_json(wb.Sheets['Controle_Parcelas'] || []).map((r, i) => ({
  id: i + 1,
  data_vencimento: excelDateToStr(r['DATA VENCIMENTO']),
  mes: String(r['MÊS'] || ''),
  ano: String(r['ANO'] || ''),
  os: String(r['OS'] || ''),
  loja: String(r['LOJA'] || ''),
  nome_cliente: String(r['NOME'] || ''),
  valor_parcela: String(r['VALOR PARCELA'] || ''),
  parcela: String(r['PARCELA'] || ''),
  contato: String(r['CONTATO'] || ''),
  status: String(r[' STATUS'] || r['STATUS'] || 'Aberto'),
  observacoes: [r['OBS'], r['ACORDO'], r['MENSAGEM PARA O CLIENTE']].filter(Boolean).join(' | ')
}));

console.log('Mapeando Vouchers...');
const vouchers = XLSX.utils.sheet_to_json(wb.Sheets['VOUCHER'] || []).map((r, i) => ({
  id: i + 1,
  codigo_voucher: String(r['VOUCHER'] || ''),
  data: excelDateToStr(r['DATA']),
  mes: String(r['Mês'] || r['MES'] || ''),
  ano: String(r['Ano'] || r['ANO'] || ''),
  instagram: String(r['INSTA'] || ''),
  os: String(r['OS'] || ''),
  data_compra: excelDateToStr(r['DATA COMPRA']),
  cidade: String(r['CIDADE'] || '')
}));

console.log('Mapeando Estoque...');
const estoque = XLSX.utils.sheet_to_json(wb.Sheets['ESTOQUE'] || []).filter(r => r['LENTE'] || r['DIOPTRIA']).map((r, i) => ({
  id: i + 1,
  lente: String(r['LENTE'] || ''),
  dioptria: String(r['DIOPTRIA'] || ''),
  entradas: String(r['ENTRADAS (PAR)'] || r['ENTRADAS'] || ''),
  saidas: String(r['SAÍDAS (PAR)'] || r['SAIDAS'] || ''),
  em_estoque: String(r['EM ESTOQUE'] || ''),
  quantidade: String(r['EM ESTOQUE'] || '1')
}));

console.log('Mapeando Marketing...');
const marketing = XLSX.utils.sheet_to_json(wb.Sheets['MARKETING'] || []).filter(r => r['NOME'] || r['OS']).map((r, i) => ({
  id: i + 1,
  os: String(r['OS'] || ''),
  vendedor: String(r['VENDEDOR (A)'] || r['VENDEDOR'] || ''),
  data_venda: excelDateToStr(r['DATA VENDA']),
  cidade: String(r['CIDADE'] || ''),
  nome_cliente: String(r['NOME'] || ''),
  idade: String(r['IDADE'] || ''),
  medico: String(r['OFTALMOLOGISTA /OPTOMETRISTA'] || ''),
  telefone: String(r['TELEFONE CLIENTE'] || r['TELEFONE'] || ''),
  instagram: String(r['INSTAGRAM'] || r['INSTA'] || ''),
  tipo_pos_venda: 'Registro Importado da Planilha Legada',
  obs_pos_venda: ''
}));

const stats = {
  marketing: marketing.length,
  vendas: vendas.length,
  vouchers: vouchers.length,
  parcelas: parcelas.length,
  estoque: estoque.length,
  total: marketing.length + vendas.length + vouchers.length + parcelas.length + estoque.length
};

const fullData = {
  stats,
  marketing,
  vendas,
  vouchers,
  parcelas,
  estoque
};

const outPath = path.resolve('public/data/legado_cache.json');
fs.writeFileSync(outPath, JSON.stringify(fullData));
console.log(`Cache gerado com sucesso em ${outPath}!`);
console.log('Totais:', stats);
