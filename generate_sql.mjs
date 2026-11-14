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

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  const str = String(val).trim();
  if (str === '') return 'NULL';
  return "'" + str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, ' ') + "'";
}

const wb = XLSX.readFile('planilha_backup_legada.xlsx');

let sql = `-- ==============================================================================
-- BANCO DE DADOS HISTÓRICO LEGADO - YASMIN ÓTICA
-- Gerado automaticamente para o banco: u854247320_yasminotica
-- ==============================================================================

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET NAMES utf8mb4;

-- ------------------------------------------------------------------------------
-- 1. TABELA DE VENDAS HISTÓRICAS (9.325 registros)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`tb_vendas_legado\`;
CREATE TABLE \`tb_vendas_legado\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`data_venda\` VARCHAR(30),
  \`ano\` VARCHAR(10),
  \`mes\` VARCHAR(20),
  \`loja\` VARCHAR(60),
  \`vendedora\` VARCHAR(100),
  \`os\` VARCHAR(50),
  \`cliente\` VARCHAR(255),
  \`responsavel\` VARCHAR(255),
  \`telefone_responsavel\` VARCHAR(50),
  \`telefone_cliente\` VARCHAR(50),
  \`lente\` VARCHAR(255),
  \`armacao\` VARCHAR(255),
  \`dioptria\` TEXT,
  \`medico\` VARCHAR(255),
  \`valor_armacao\` VARCHAR(50),
  \`valor_lente\` VARCHAR(50),
  \`valor_produto\` VARCHAR(50),
  \`valor_entrada\` VARCHAR(50),
  \`n_parcelas\` VARCHAR(30),
  \`tipo_compra\` VARCHAR(100),
  \`rg\` VARCHAR(50),
  \`cpf\` VARCHAR(50),
  \`data_nascimento\` VARCHAR(30),
  INDEX \`idx_vendas_cli\` (\`cliente\`(100)),
  INDEX \`idx_vendas_cpf\` (\`cpf\`),
  INDEX \`idx_vendas_os\` (\`os\`),
  INDEX \`idx_vendas_loja\` (\`loja\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

// 1. Inserir Vendas
const vendasRows = XLSX.utils.sheet_to_json(wb.Sheets['Registro_Vendas'] || {});
console.log('Total Vendas rows:', vendasRows.length);

const chunkVendas = [];
for (const r of vendasRows) {
  const dt = excelDateToStr(r['DATA DA VENDA']);
  const ano = r['ANO'] || '';
  const mes = r['MÊS'] || '';
  const loja = r['LOJA'] || '';
  const vend = r['VENDEDORA'] || '';
  const os = r['OS'] || '';
  const cli = r[' CLIENTE'] || r['CLIENTE'] || r['Nome'] || '';
  const resp = r['RESPOSÁVEL'] || r['RESPONSÁVEL'] || '';
  const telResp = r['TELEFONE RESPONSÁVEL'] || '';
  const telCli = r['TELEFONE CLIENTE'] || r['TELEFONE'] || '';
  const lente = r[' LENTE'] || r['LENTE'] || '';
  const arm = r['ARMAÇÃO'] || '';
  const diop = r['DIOPTRIA'] || '';
  const med = r['OPTOMETRIA             OU                                OFTAMOLOGISTA'] || '';
  const vArm = r['VALOR ARMAÇÃO'] || '';
  const vLen = r['VALOR LENTE'] || '';
  const vProd = r['VALOR DO PRODUTO'] || '';
  const vEntr = r['VALOR ENTRADA'] || '';
  const nParc = r['N° PARCELAS'] || '';
  const tipoC = r['TIPO DE COMPRA'] || '';
  const rg = r['RG '] || r['RG'] || '';
  const cpf = r['CPF'] || '';
  const dtNasc = excelDateToStr(r['DATA DE NASCIMENTO']);

  chunkVendas.push(`(${escapeSql(dt)},${escapeSql(ano)},${escapeSql(mes)},${escapeSql(loja)},${escapeSql(vend)},${escapeSql(os)},${escapeSql(cli)},${escapeSql(resp)},${escapeSql(telResp)},${escapeSql(telCli)},${escapeSql(lente)},${escapeSql(arm)},${escapeSql(diop)},${escapeSql(med)},${escapeSql(vArm)},${escapeSql(vLen)},${escapeSql(vProd)},${escapeSql(vEntr)},${escapeSql(nParc)},${escapeSql(tipoC)},${escapeSql(rg)},${escapeSql(cpf)},${escapeSql(dtNasc)})`);
}

for (let i = 0; i < chunkVendas.length; i += 500) {
  const batch = chunkVendas.slice(i, i + 500);
  sql += `INSERT INTO \`tb_vendas_legado\` (\`data_venda\`,\`ano\`,\`mes\`,\`loja\`,\`vendedora\`,\`os\`,\`cliente\`,\`responsavel\`,\`telefone_responsavel\`,\`telefone_cliente\`,\`lente\`,\`armacao\`,\`dioptria\`,\`medico\`,\`valor_armacao\`,\`valor_lente\`,\`valor_produto\`,\`valor_entrada\`,\`n_parcelas\`,\`tipo_compra\`,\`rg\`,\`cpf\`,\`data_nascimento\`) VALUES \n${batch.join(',\n')};\n\n`;
}

// ------------------------------------------------------------------------------
// 2. TABELA DE CONTROLE DE PARCELAS / CARNÊS (6.954 registros)
// ------------------------------------------------------------------------------
sql += `-- ------------------------------------------------------------------------------
-- 2. TABELA DE CONTROLE DE PARCELAS / CARNÊS (6.954 registros)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`tb_parcelas_legado\`;
CREATE TABLE \`tb_parcelas_legado\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`data_vencimento\` VARCHAR(30),
  \`mes\` VARCHAR(20),
  \`ano\` VARCHAR(10),
  \`os\` VARCHAR(50),
  \`loja\` VARCHAR(60),
  \`nome_cliente\` VARCHAR(255),
  \`valor_parcela\` VARCHAR(50),
  \`parcela\` VARCHAR(30),
  \`contato\` VARCHAR(60),
  \`status\` VARCHAR(60),
  \`observacoes\` TEXT,
  INDEX \`idx_parc_nome\` (\`nome_cliente\`(100)),
  INDEX \`idx_parc_os\` (\`os\`),
  INDEX \`idx_parc_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

const parcelasRows = XLSX.utils.sheet_to_json(wb.Sheets['Controle_Parcelas'] || {});
console.log('Total Parcelas rows:', parcelasRows.length);
const chunkParcelas = [];
for (const r of parcelasRows) {
  const dtVenc = excelDateToStr(r['DATA VENCIMENTO']);
  const mes = r['MÊS'] || '';
  const ano = r['ANO'] || '';
  const os = r['OS'] || '';
  const loja = r['LOJA'] || '';
  const nome = r['NOME'] || '';
  const valP = r['VALOR PARCELA'] || '';
  const parc = r['PARCELA'] || '';
  const cont = r['CONTATO'] || '';
  const st = r[' STATUS'] || r['STATUS'] || '';
  const obs = [r['OBS'], r['ACORDO'], r['MENSAGEM PARA O CLIENTE']].filter(Boolean).join(' | ');

  chunkParcelas.push(`(${escapeSql(dtVenc)},${escapeSql(mes)},${escapeSql(ano)},${escapeSql(os)},${escapeSql(loja)},${escapeSql(nome)},${escapeSql(valP)},${escapeSql(parc)},${escapeSql(cont)},${escapeSql(st)},${escapeSql(obs)})`);
}

for (let i = 0; i < chunkParcelas.length; i += 500) {
  const batch = chunkParcelas.slice(i, i + 500);
  sql += `INSERT INTO \`tb_parcelas_legado\` (\`data_vencimento\`,\`mes\`,\`ano\`,\`os\`,\`loja\`,\`nome_cliente\`,\`valor_parcela\`,\`parcela\`,\`contato\`,\`status\`,\`observacoes\`) VALUES \n${batch.join(',\n')};\n\n`;
}

// ------------------------------------------------------------------------------
// 3. TABELA DE VOUCHERS (1.898 registros)
// ------------------------------------------------------------------------------
sql += `-- ------------------------------------------------------------------------------
-- 3. TABELA DE VOUCHERS (1.898 registros)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`tb_vouchers_legado\`;
CREATE TABLE \`tb_vouchers_legado\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`codigo_voucher\` VARCHAR(100),
  \`data\` VARCHAR(30),
  \`mes\` VARCHAR(20),
  \`ano\` VARCHAR(10),
  \`instagram\` VARCHAR(100),
  \`os\` VARCHAR(50),
  \`data_compra\` VARCHAR(30),
  \`cidade\` VARCHAR(60),
  INDEX \`idx_vouch_cod\` (\`codigo_voucher\`),
  INDEX \`idx_vouch_os\` (\`os\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

const vouchersRows = XLSX.utils.sheet_to_json(wb.Sheets['VOUCHER'] || {});
console.log('Total Vouchers rows:', vouchersRows.length);
const chunkVouchers = [];
for (const r of vouchersRows) {
  const cod = r['VOUCHER'] || '';
  const dt = excelDateToStr(r['DATA']);
  const mes = r['Mês'] || r['MES'] || '';
  const ano = r['Ano'] || r['ANO'] || '';
  const insta = r['INSTA'] || '';
  const os = r['OS'] || '';
  const dtComp = excelDateToStr(r['DATA COMPRA']);
  const cid = r['CIDADE'] || '';

  chunkVouchers.push(`(${escapeSql(cod)},${escapeSql(dt)},${escapeSql(mes)},${escapeSql(ano)},${escapeSql(insta)},${escapeSql(os)},${escapeSql(dtComp)},${escapeSql(cid)})`);
}

for (let i = 0; i < chunkVouchers.length; i += 500) {
  const batch = chunkVouchers.slice(i, i + 500);
  sql += `INSERT INTO \`tb_vouchers_legado\` (\`codigo_voucher\`,\`data\`,\`mes\`,\`ano\`,\`instagram\`,\`os\`,\`data_compra\`,\`cidade\`) VALUES \n${batch.join(',\n')};\n\n`;
}

// ------------------------------------------------------------------------------
// 4. TABELA DE ESTOQUE LEGADO (5.098 registros)
// ------------------------------------------------------------------------------
sql += `-- ------------------------------------------------------------------------------
-- 4. TABELA DE ESTOQUE LEGADO (5.098 registros)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`tb_estoque_legado\`;
CREATE TABLE \`tb_estoque_legado\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`lente\` VARCHAR(255),
  \`dioptria\` VARCHAR(100),
  \`entradas\` VARCHAR(30),
  \`saidas\` VARCHAR(30),
  \`em_estoque\` VARCHAR(30),
  INDEX \`idx_est_len\` (\`lente\`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

const estoqueRows = XLSX.utils.sheet_to_json(wb.Sheets['ESTOQUE'] || {});
console.log('Total Estoque rows:', estoqueRows.length);
const chunkEstoque = [];
for (const r of estoqueRows) {
  const lente = r['LENTE'] || '';
  const diop = r['DIOPTRIA'] || '';
  const ent = r['ENTRADAS (PAR)'] || r['ENTRADAS'] || '';
  const sai = r['SAÍDAS (PAR)'] || r['SAIDAS'] || '';
  const est = r['EM ESTOQUE'] || '';

  if (lente || diop) {
    chunkEstoque.push(`(${escapeSql(lente)},${escapeSql(diop)},${escapeSql(ent)},${escapeSql(sai)},${escapeSql(est)})`);
  }
}

for (let i = 0; i < chunkEstoque.length; i += 500) {
  const batch = chunkEstoque.slice(i, i + 500);
  sql += `INSERT INTO \`tb_estoque_legado\` (\`lente\`,\`dioptria\`,\`entradas\`,\`saidas\`,\`em_estoque\`) VALUES \n${batch.join(',\n')};\n\n`;
}

// ------------------------------------------------------------------------------
// 5. TABELA DE MARKETING & PÓS VENDAS (18.870 registros)
// ------------------------------------------------------------------------------
sql += `-- ------------------------------------------------------------------------------
-- 5. TABELA DE MARKETING & PÓS VENDAS (18.870 registros)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS \`tb_marketing_legado\`;
CREATE TABLE \`tb_marketing_legado\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`os\` VARCHAR(50),
  \`vendedor\` VARCHAR(100),
  \`data_venda\` VARCHAR(30),
  \`cidade\` VARCHAR(60),
  \`nome_cliente\` VARCHAR(255),
  \`idade\` VARCHAR(20),
  \`medico\` VARCHAR(255),
  \`telefone\` VARCHAR(50),
  INDEX \`idx_mkt_nome\` (\`nome_cliente\`(100)),
  INDEX \`idx_mkt_os\` (\`os\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

const mktRows = XLSX.utils.sheet_to_json(wb.Sheets['MARKETING'] || {});
console.log('Total Marketing rows:', mktRows.length);
const chunkMkt = [];
for (const r of mktRows) {
  const os = r['OS'] || '';
  const vend = r['VENDEDOR (A)'] || r['VENDEDOR'] || '';
  const dt = excelDateToStr(r['DATA VENDA']);
  const cid = r['CIDADE'] || '';
  const nome = r['NOME'] || '';
  const idade = r['IDADE'] || '';
  const med = r['OFTALMOLOGISTA /OPTOMETRISTA'] || '';
  const tel = r['TELEFONE CLIENTE'] || r['TELEFONE'] || '';

  if (nome || os) {
    chunkMkt.push(`(${escapeSql(os)},${escapeSql(vend)},${escapeSql(dt)},${escapeSql(cid)},${escapeSql(nome)},${escapeSql(idade)},${escapeSql(med)},${escapeSql(tel)})`);
  }
}

for (let i = 0; i < chunkMkt.length; i += 500) {
  const batch = chunkMkt.slice(i, i + 500);
  sql += `INSERT INTO \`tb_marketing_legado\` (\`os\`,\`vendedor\`,\`data_venda\`,\`cidade\`,\`nome_cliente\`,\`idade\`,\`medico\`,\`telefone\`) VALUES \n${batch.join(',\n')};\n\n`;
}

sql += `SET FOREIGN_KEY_CHECKS=1;\n`;

const desktopPath = '/Users/essencialcosmeticos/Desktop/banco_yasmin_legado.sql';
fs.writeFileSync(desktopPath, sql, 'utf8');
console.log('SQL generated successfully! Size:', (fs.statSync(desktopPath).size / (1024 * 1024)).toFixed(2), 'MB');
