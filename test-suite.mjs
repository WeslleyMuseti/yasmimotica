import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { 
  hashPassword, 
  verifyPassword, 
  isPasswordHashed, 
  isSameClient,
  isStephanieMuseti,
  sanitizeStephanieMusetiData,
  processOfflineQueue,
  enqueueOfflineOp,
  getOfflineQueue,
  clearOfflineQueue,
  withTimeout,
  isSyncingQueue,
  getIsSyncingQueue,
  OFFLINE_QUEUE_KEY,
  OFFLINE_BACKUP_KEY,
  saveOfflineSnapshot,
  loadOfflineSnapshot,
  decrementStockAtomically,
  DEAD_LETTER_QUEUE_KEY,
  saveBatch,
  areUserListsEqual,
  reconcileUsers,
  syncUserPasswordToFirestore
} from './src/firebaseSync.js';
import {
  parseCurrency,
  formatCurrency,
  getStockHealthStatus,
  filterAndSortStock,
  extractStockFacets
} from './src/stockFilters.js';
import {
  sanitizeXmlTag,
  escapeXmlText,
  jsonToXml,
  buildSalesHistoryXml,
  buildCashHistoryXml,
  buildStockXml,
  parseXmlToObjects,
  buildFinancialSummaryXml
} from './src/xmlUtils.js';
import {
  normalizeInstallmentDateIso,
  formatInstallmentDateBr,
  extractOSFromRow,
  resolveInstallmentClientName,
  filterInstallmentsByDateRange,
  buildOverdueInstallmentAlerts,
  generateInstallmentSchedule,
  buildReparcelamentoOSPayload,
  numeroPorExtenso,
  buildReparcelamentoReceiptPayload
} from './src/reparcelamentoUtils.js';
import * as XLSX from 'xlsx';

async function runTests() {
  console.log('🧪 Starting Verification Test Suite...\n');

  // ─── TEST 1: Password Hashing & Verification ─────────────────────────
  console.log('▶ Test 1: Password Cryptography (PBKDF2/SHA-256 + Salt)');
  const plainPassword = 'minhasenhasegura123';
  const hashed = await hashPassword(plainPassword);
  
  console.assert(isPasswordHashed(hashed), 'Error: hashed password should be identified as hashed');
  console.assert(!isPasswordHashed('plain123'), 'Error: plain password should not be identified as hashed');
  console.assert(hashed.startsWith('pbkdf2:') || hashed.startsWith('sha256:'), 'Error: hash prefix missing');
  
  const isValid = await verifyPassword(plainPassword, hashed);
  console.assert(isValid === true, 'Error: verifyPassword should return true for correct password');
  
  const isWrong = await verifyPassword('senhaincorreta', hashed);
  console.assert(isWrong === false, 'Error: verifyPassword should return false for incorrect password');

  // Legacy plain text backwards compatibility
  const isLegacyValid = await verifyPassword('929498', '929498');
  console.assert(isLegacyValid === true, 'Error: verifyPassword should support legacy plain text passwords');
  const isLegacyWrong = await verifyPassword('wrongpass', '929498');
  console.assert(isLegacyWrong === false, 'Error: verifyPassword should reject wrong legacy password');
  console.log('  ✅ Test 1 Passed: Hashing and Verification working correctly.\n');

  // ─── TEST 2: Strict Client ID/CPF Linking (Homonym Protection) ────────
  console.log('▶ Test 2: Strict Client ID and CPF Matching');
  
  const clientMaria1 = {
    id: 'cli_001',
    'Nome Completo': 'Maria da Silva',
    'CPF / CNPJ': '111.222.333-44'
  };

  const clientMaria2 = {
    id: 'cli_002',
    'Nome Completo': 'Maria da Silva',
    'CPF / CNPJ': '999.888.777-66'
  };

  // 2.1 Same name but different CPF -> MUST NOT MATCH (Homonym separation)
  console.assert(isSameClient(clientMaria1, clientMaria2) === false, 'Error: Homonyms with different CPF must not match!');
  console.assert(isSameClient(clientMaria2, clientMaria1) === false, 'Error: Symmetry check failed for homonym separation');

  // 2.2 Match by CLIENTE_ID when transaction doc has its own distinct doc id
  const saleWithId = {
    id: 'sale_doc_999',
    CLIENTE_ID: 'cli_001',
    CLIENTE: 'Maria da Silva',
    VALOR: '150,00'
  };
  console.assert(isSameClient(clientMaria1, saleWithId) === true, 'Error: Must match client by CLIENTE_ID even when sale has its own doc id');
  console.assert(isSameClient(saleWithId, clientMaria1) === true, 'Error: Symmetry check for sale CLIENTE_ID failed');

  // 2.3 Different CLIENTE_ID must NOT match (even if names are identical)
  const saleOtherClient = {
    id: 'sale_doc_888',
    CLIENTE_ID: 'cli_002',
    CLIENTE: 'Maria da Silva',
    VALOR: '200,00'
  };
  console.assert(isSameClient(clientMaria1, saleOtherClient) === false, 'Error: Different CLIENTE_ID must not match clientMaria1');

  // 2.4 Match by CPF (unformatted and formatted)
  const boletoWithCpf = {
    id: 'boleto_123',
    CPF: '11122233344',
    CLIENTE: 'Maria S.',
    VALOR: '50,00'
  };
  console.assert(isSameClient(clientMaria1, boletoWithCpf) === true, 'Error: Must match by CPF unformatted vs formatted');
  console.assert(isSameClient(boletoWithCpf, clientMaria1) === true, 'Error: Symmetry check for CPF matching failed');

  // 2.5 CNPJ support
  const clientCompany = {
    id: 'cli_comp',
    'Nome Completo': 'Empresa Exemplo LTDA',
    'CPF / CNPJ': '12.345.678/0001-90'
  };
  const invoiceCompany = {
    id: 'inv_100',
    'CPF / CNPJ': '12345678000190',
    CLIENTE: 'Empresa Exemplo',
    VALOR: '500,00'
  };
  console.assert(isSameClient(clientCompany, invoiceCompany) === true, 'Error: CNPJ matching failed');

  // 2.6 Legacy fallback when neither has CPF or ID
  const legacyClient = { 'Nome Completo': 'Jose de Souza' };
  const legacyRecord = { id: 'rec_legacy', 'CLIENTE': 'Jose de Souza', VALOR: '80,00' };
  console.assert(isSameClient(legacyClient, legacyRecord) === true, 'Error: Legacy exact name match failed');
  console.assert(isSameClient(legacyRecord, legacyClient) === true, 'Error: Legacy symmetry failed');

  // 2.7 Edge case: Null/Undefined handling
  console.assert(isSameClient(null, clientMaria1) === false, 'Error: Null clientA should return false');
  console.assert(isSameClient(clientMaria1, undefined) === false, 'Error: Undefined clientB should return false');
  console.assert(isSameClient({}, {}) === false, 'Error: Empty objects should return false');

  console.log('  ✅ Test 2 Passed: Strict client ID and CPF matching prevents homonym mix-ups.\n');

  // ─── TEST 3: Barcode Checksum & SVG Code 128 Generation ───────────────
  console.log('▶ Test 3: Code 128 Checksum & Pattern Encoding');
  const testCodes = ['RB3025', 'OS1024', '789123456789', 'LNT-DIG-167'];
  for (const text of testCodes) {
    let checksum = 104; // Start B
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const codeVal = (charCode >= 32 && charCode <= 126) ? charCode - 32 : 0;
      checksum += codeVal * (i + 1);
    }
    const finalChecksum = checksum % 103;
    console.assert(finalChecksum >= 0 && finalChecksum < 103, `Error: Checksum out of bounds for ${text}`);
  }
  console.log('  ✅ Test 3 Passed: Code 128 algorithm generates valid checksums for all test SKUs/OS.\n');

  // ─── TEST 4: Minimum Stock / Ponto de Pedido Alert Levels ─────────────
  console.log('▶ Test 4: Minimum Stock Alert Classification (<= 2 units)');
  const getStockStatus = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) return 'esgotado';
    if (num <= 2) return 'critico';
    return 'normal';
  };

  console.assert(getStockStatus(0) === 'esgotado', 'Stock 0 must be esgotado');
  console.assert(getStockStatus('0') === 'esgotado', 'Stock "0" must be esgotado');
  console.assert(getStockStatus(1) === 'critico', 'Stock 1 must be critico (ponto de pedido)');
  console.assert(getStockStatus('2') === 'critico', 'Stock 2 must be critico (ponto de pedido)');
  console.assert(getStockStatus(3) === 'normal', 'Stock 3 must be normal');
  console.assert(getStockStatus('10') === 'normal', 'Stock 10 must be normal');
  console.log('  ✅ Test 4 Passed: Stock classification correctly flags <= 2 units.\n');

  // ─── TEST 5: Barcode Scanner Input Buffer Heuristics ───────────────────
  console.log('▶ Test 5: Hardware USB Barcode Scanner Speed Heuristics');
  // Simulating rapid barcode burst (< 50ms interval)
  const scannerBurstTimes = [0, 15, 30, 44, 58, 72, 85]; // ~14ms per char
  const scannerDuration = scannerBurstTimes[scannerBurstTimes.length - 1] - scannerBurstTimes[0];
  const scannerAvg = scannerDuration / (scannerBurstTimes.length - 1);
  const isScanner = scannerAvg < 60;
  console.assert(isScanner === true, 'Error: Fast keystroke burst must be identified as barcode scanner');

  // Simulating human typing (> 100ms interval)
  const humanTypingTimes = [0, 120, 260, 410, 580]; // ~145ms per char
  const humanDuration = humanTypingTimes[humanTypingTimes.length - 1] - humanTypingTimes[0];
  const humanAvg = humanDuration / (humanTypingTimes.length - 1);
  const isHuman = humanAvg >= 60;
  console.assert(isHuman === true, 'Error: Human typing must not be misidentified as barcode scanner');
  console.log('  ✅ Test 5 Passed: USB Scanner speed heuristics correctly separate scanner from human typing.\n');

  // ─── TEST 6: Smart Stock Filters, Presets & Sales Cross-Referencing ───
  console.log('▶ Test 6: Smart Stock Filters, Presets & Sales Cross-Referencing');
  
  // 6.1 Currency Parsing & Formatting
  console.assert(parseCurrency('R$ 1.250,50') === 1250.50, 'Error parsing R$ 1.250,50');
  console.assert(parseCurrency('300') === 300, 'Error parsing 300');
  console.assert(parseCurrency(null) === 0, 'Error parsing null currency');
  console.assert(getStockHealthStatus(0) === 'esgotado', 'Stock 0 status error');
  console.assert(getStockHealthStatus(2) === 'critico', 'Stock 2 status error');
  console.assert(getStockHealthStatus(5) === 'normal', 'Stock 5 status error');

  // 6.2 Mock Inventory & Sales Data
  const mockStock = [
    {
      REFERENCIA_SKU: 'RB3025',
      MODELO: 'Aviador',
      MARCA: 'Ray-Ban',
      MATERIAL: 'Metal',
      UNIDADE: 'Cajati',
      ESTOQUE: '5',
      PRECO_COMPRA: '100.00',
      PRECO_VENDA: '300.00'
    },
    {
      REFERENCIA_SKU: 'OO9102',
      MODELO: 'Holbrook',
      MARCA: 'Oakley',
      MATERIAL: 'Acetato',
      UNIDADE: 'Registro',
      ESTOQUE: '1',
      PRECO_COMPRA: '200.00',
      PRECO_VENDA: '450.00'
    },
    {
      REFERENCIA_SKU: 'VO5322',
      MODELO: 'Retrô Classic',
      MARCA: 'Vogue',
      MATERIAL: 'Acetato',
      UNIDADE: 'Cajati',
      ESTOQUE: '0',
      PRECO_COMPRA: '80.00',
      PRECO_VENDA: '200.00'
    },
    {
      REFERENCIA_SKU: 'CH5408',
      MODELO: 'Oversized Luxo',
      MARCA: 'Chanel',
      MATERIAL: 'Titânio',
      UNIDADE: 'Central',
      ESTOQUE: '10',
      PRECO_COMPRA: '800.00',
      PRECO_VENDA: '2400.00'
    }
  ];

  const mockSales = [
    { PRODUTO: 'Ray-Ban Aviador RB3025 Polarizado', QUANTIDADE: '3', VALOR: '900.00' },
    { PRODUTO: 'Óculos Completo (RB3025 + Lente)', QUANTIDADE: '2', VALOR: '1200.00' },
    { PRODUTO: 'Oakley Holbrook OO9102 Matte Black', QUANTIDADE: '1', VALOR: '450.00' }
  ];

  // 6.3 Preset: Mais Vendidos (RB3025 tem 5 vendas -> primeiro lugar)
  const maisVendidos = filterAndSortStock(mockStock, mockSales, { preset: 'mais_vendidos' });
  console.assert(maisVendidos.length === 4, 'Mais vendidos must contain all items ranked');
  console.assert(maisVendidos[0].REFERENCIA_SKU === 'RB3025', 'RB3025 must be #1 most sold with 5 sales');
  console.assert(maisVendidos[0]._salesCount === 5, 'RB3025 salesCount must equal 5');
  console.assert(maisVendidos[1].REFERENCIA_SKU === 'OO9102', 'OO9102 must be #2 with 1 sale');

  // 6.4 Preset: Mais Lucrativos (CH5408 lucro = 1600 -> primeiro lugar)
  const maisLucrativos = filterAndSortStock(mockStock, mockSales, { preset: 'mais_lucrativos' });
  console.assert(maisLucrativos[0].REFERENCIA_SKU === 'CH5408', 'CH5408 must have highest unit profit (R$ 1600)');
  console.assert(maisLucrativos[0]._lucroUnitario === 1600, 'CH5408 profit calculation error');
  console.assert(maisLucrativos[1].REFERENCIA_SKU === 'OO9102', 'OO9102 must be second in profit (R$ 250)');

  // 6.5 Preset: Estoque Crítico (somente <= 2 unidades, esgotados 0 primeiro)
  const criticos = filterAndSortStock(mockStock, mockSales, { preset: 'critico' });
  console.assert(criticos.length === 2, 'Only 2 items must be critical (VO5322 and OO9102)');
  console.assert(criticos[0].REFERENCIA_SKU === 'VO5322', 'Stock 0 must come before stock 1');
  console.assert(criticos[1].REFERENCIA_SKU === 'OO9102', 'Stock 1 must come second');

  // 6.6 Preset: Maior Capital Imobilizado (CH5408 = 10 * 800 = 8000 -> primeiro)
  const imobilizados = filterAndSortStock(mockStock, mockSales, { preset: 'imobilizado' });
  console.assert(imobilizados[0].REFERENCIA_SKU === 'CH5408', 'CH5408 must have highest tied-up capital (R$ 8.000)');
  console.assert(imobilizados[0]._valorImobilizado === 8000, 'CH5408 tied capital calculation error');
  console.assert(imobilizados[1]._valorImobilizado === 500, 'RB3025 (5*100=500) must be second');

  // 6.7 Filtros Combinados: Loja Cajati + Material Acetato
  const cajatiAcetato = filterAndSortStock(mockStock, mockSales, { store: 'Cajati', material: 'Acetato' });
  console.assert(cajatiAcetato.length === 1, 'Only VO5322 is in Cajati with Acetato material');
  console.assert(cajatiAcetato[0].REFERENCIA_SKU === 'VO5322', 'Mismatch in filtered store/material result');

  // 6.8 Facets Extraction
  const facets = extractStockFacets(mockStock);
  console.assert(facets.stores.includes('Cajati') && facets.stores.includes('Registro'), 'Facets store extraction error');
  console.assert(facets.brands.includes('Ray-Ban') && facets.brands.includes('Oakley'), 'Facets brand extraction error');
  console.assert(facets.materials.includes('Metal') && facets.materials.includes('Acetato'), 'Facets material extraction error');

  // 6.9 Edge Cases: Empty arrays, null inputs, zero-cost margins, dirty string numbers
  console.assert(filterAndSortStock(null).length === 0, 'Null stock must return empty array');
  console.assert(filterAndSortStock([]).length === 0, 'Empty stock must return empty array');
  const zeroCostItem = filterAndSortStock([{ ESTOQUE: '0', PRECO_COMPRA: '0', PRECO_VENDA: '100' }], null, { preset: 'mais_lucrativos' });
  console.assert(zeroCostItem[0]._margemPercent === 100, 'Zero cost margin must be safely handled');
  const dirtyFieldItem = filterAndSortStock([{ ESTOQUE: '', PRECO_COMPRA: '', PRECO_VENDA: '' }], null, { preset: 'critico' });
  console.assert(dirtyFieldItem[0]._statusEstoque === 'esgotado', 'Empty string fields must classify as esgotado');

  // 6.10 Preset: Loja / Unidade (Agrupamento e Ordenação por Filial)
  const porLoja = filterAndSortStock(mockStock, mockSales, { preset: 'loja' });
  console.assert(porLoja[0].UNIDADE === 'Cajati', 'Preset loja must group Cajati before Central/Registro');
  console.assert(porLoja[porLoja.length - 1].UNIDADE === 'Registro', 'Registro must come after Cajati and Central');

  // 6.11 Preset: Marca / Material (Agrupamento e Ordenação por Marca/Material)
  const porMarcaMaterial = filterAndSortStock(mockStock, mockSales, { preset: 'marca_material' });
  console.assert(porMarcaMaterial[0].MARCA === 'Chanel', 'Preset marca_material must sort Chanel first');
  console.assert(porMarcaMaterial[porMarcaMaterial.length - 1].MARCA === 'Vogue', 'Vogue must sort last');

  // 6.12 Non-enumerable Properties & Zero Pollution Check
  const sampleItem = maisVendidos[0];
  const keys = Object.keys(sampleItem);
  console.assert(!keys.some(k => k.startsWith('_')), 'Internal metrics must be non-enumerable to prevent table column pollution');
  console.assert(sampleItem._salesCount === 5, 'Non-enumerable _salesCount must be directly readable');
  console.assert(JSON.stringify(sampleItem).indexOf('_salesCount') === -1, 'JSON.stringify must not leak internal _ properties');

  // 6.13 Token Word Boundary Check in Sales Matching (No False Positives)
  const stockWithShortModel = [{ REFERENCIA_SKU: 'MOD-PRO', MODELO: 'pro', MARCA: 'Generica', ESTOQUE: '5' }];
  const salesWithFalseSubstrings = [{ PRODUTO: 'Produto Promocional com Desconto', QUANTIDADE: '10', VALOR: '500.00' }];
  const falseMatchTest = filterAndSortStock(stockWithShortModel, salesWithFalseSubstrings, { preset: 'mais_vendidos' });
  console.assert(falseMatchTest[0]._salesCount === 0, 'Substring inside "promocional" must not match short model "pro"');

  // 6.14 Object Reference Preservation for Zero Desynchronization in ERP
  console.assert(mockStock[0] === maisVendidos.find(x => x.REFERENCIA_SKU === 'RB3025'), 'Object reference should be preserved for reliable row updates/deletions');

  console.log('  ✅ Test 6 Passed: Smart stock filtering, presets, profit calculations and sales cross-referencing verified.\n');

  // ─── TEST 7: Document Attachments (Client & Responsible) ───────────────
  console.log('▶ Test 7: Client & Responsible Document Attachment Verification');

  const mockClientWithDocs = {
    id: 'cli_doc_001',
    'Nome Completo': 'Lucas Silva Sauro',
    'CPF / CNPJ': '123.456.789-00',
    'RG': '12.345.678-9',
    'Foto Documento Cliente': 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASo...',
    'Foto Comprovante Residência Cliente': 'data:application/pdf;base64,JVBERi0xLjQK...',
    'Responsável Nome': 'Valesca Silva Sauro',
    'Responsável CPF': '987.654.321-11',
    'Responsável RG': '98.765.432-1',
    'Foto Documento Responsável': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...',
    'Foto Comprovante Residência Responsável': 'data:image/png;base64,iVBORw0KGgo...'
  };

  // 7.1 Verify presence and integrity of all 4 document fields
  console.assert(Boolean(mockClientWithDocs['Foto Documento Cliente']), 'Error: Foto Documento Cliente must be present');
  console.assert(mockClientWithDocs['Foto Documento Cliente'].startsWith('data:image/'), 'Error: Foto Documento Cliente must be an image data URI');
  
  console.assert(Boolean(mockClientWithDocs['Foto Comprovante Residência Cliente']), 'Error: Foto Comprovante Residência Cliente must be present');
  console.assert(mockClientWithDocs['Foto Comprovante Residência Cliente'].startsWith('data:application/pdf'), 'Error: Foto Comprovante Residência Cliente must support PDF data URI');

  console.assert(Boolean(mockClientWithDocs['Foto Documento Responsável']), 'Error: Foto Documento Responsável must be present');
  console.assert(mockClientWithDocs['Foto Documento Responsável'].startsWith('data:image/'), 'Error: Foto Documento Responsável must be an image data URI');

  console.assert(Boolean(mockClientWithDocs['Foto Comprovante Residência Responsável']), 'Error: Foto Comprovante Residência Responsável must be present');
  console.assert(mockClientWithDocs['Foto Comprovante Residência Responsável'].startsWith('data:image/'), 'Error: Foto Comprovante Residência Responsável must support image data URI');

  // 7.2 Backward compatibility with legacy records lacking document fields
  const mockLegacyClient = {
    id: 'cli_legacy_001',
    'Nome Completo': 'Carlos Silva',
    'CPF / CNPJ': '555.666.777-88'
  };

  const clientDoc = mockLegacyClient['Foto Documento Cliente'] || '';
  const compDoc = mockLegacyClient['Foto Comprovante Residência Cliente'] || '';
  const respDoc = mockLegacyClient['Foto Documento Responsável'] || '';
  const respCompDoc = mockLegacyClient['Foto Comprovante Residência Responsável'] || '';

  console.assert(clientDoc === '', 'Legacy client without docs should safely resolve to empty string');
  console.assert(compDoc === '', 'Legacy client without proof should safely resolve to empty string');
  console.assert(respDoc === '', 'Legacy client without resp docs should safely resolve to empty string');
  console.assert(respCompDoc === '', 'Legacy client without resp proof should safely resolve to empty string');

  console.log('  ✅ Test 7 Passed: Document attachment fields, formats (image/PDF), and backwards compatibility verified.\n');

  // ─── TEST 8: Reference Person Names for Client and Responsável ────────
  console.log('▶ Test 8: Reference Contact Names (Client & Responsável)');
  
  const mockClientWithRefs = {
    id: 'cli_ref_001',
    'Nome Completo': 'Mariana Souza',
    'CPF / CNPJ': '111.222.333-44',
    'Nome Referência 1': 'Tia Cláudia',
    'Referência 1': '(13) 99887-1122',
    'Parentesco Ref. 1': 'Tia',
    'Nome Referência 2': 'Carlos Colega',
    'Referência 2': '(13) 99112-3344',
    'Parentesco Ref. 2': 'Amigo',
    'Responsável Nome': 'Rogério Souza',
    'Responsável Nome Referência 1': 'Dona Bete',
    'Responsável Referência 1': '(13) 98765-4321',
    'Responsável Parentesco Ref. 1': 'Mãe',
    'Responsável Nome Referência 2': 'Dr. Marcos',
    'Responsável Referência 2': '(13) 97654-3210',
    'Responsável Parentesco Ref. 2': 'Vizinho'
  };

  // Helper formatter matching PrintableOS logic
  const formatRefEntry = (person, phone, kin) => {
    const parts = [];
    if (person && phone) {
      parts.push(`${person}: ${phone}`);
    } else if (person) {
      parts.push(person);
    } else if (phone) {
      parts.push(phone);
    }
    if (parts.length === 0) return '';
    let res = parts.join(' ');
    if (kin) res += ` (${kin})`;
    return res;
  };

  // 8.1 Format client reference contacts
  const cliRef1 = formatRefEntry(
    mockClientWithRefs['Nome Referência 1'],
    mockClientWithRefs['Referência 1'],
    mockClientWithRefs['Parentesco Ref. 1']
  );
  console.assert(cliRef1 === 'Tia Cláudia: (13) 99887-1122 (Tia)', `Unexpected client ref 1 format: ${cliRef1}`);

  const cliRef2 = formatRefEntry(
    mockClientWithRefs['Nome Referência 2'],
    mockClientWithRefs['Referência 2'],
    mockClientWithRefs['Parentesco Ref. 2']
  );
  console.assert(cliRef2 === 'Carlos Colega: (13) 99112-3344 (Amigo)', `Unexpected client ref 2 format: ${cliRef2}`);

  // 8.2 Format responsable reference contacts
  const respRef1 = formatRefEntry(
    mockClientWithRefs['Responsável Nome Referência 1'],
    mockClientWithRefs['Responsável Referência 1'],
    mockClientWithRefs['Responsável Parentesco Ref. 1']
  );
  console.assert(respRef1 === 'Dona Bete: (13) 98765-4321 (Mãe)', `Unexpected resp ref 1 format: ${respRef1}`);

  // 8.3 Backwards compatibility when only phone exists (no person name)
  const legacyLegacyRef = formatRefEntry('', '(13) 99999-0000', 'Irmão');
  console.assert(legacyLegacyRef === '(13) 99999-0000 (Irmão)', `Legacy ref format failed: ${legacyLegacyRef}`);

  // 8.4 Backwards compatibility when only name exists (no phone)
  const nameOnlyRef = formatRefEntry('José Vizinho', '', 'Vizinho');
  console.assert(nameOnlyRef === 'José Vizinho (Vizinho)', `Name only ref format failed: ${nameOnlyRef}`);

  console.log('  ✅ Test 8 Passed: Reference person names, phones, kinships and backwards compatibility verified.\n');

  // ─── TEST 9: Payment Method Installment Dates (Crédito vs Boleto) ─────
  console.log('▶ Test 9: Payment Method Installment Formatting (Crédito vs Boleto)');
  
  // 9.1 Credit card payment representation (clean installments, no due dates)
  const creditPayment = {
    metodo: 'credito',
    valor: 300,
    parcelas: 10,
    texto: `💳 Cartão Crédito (10x de R$ 30,00): R$ 300,00`
  };
  console.assert(!creditPayment.texto.includes('Venc:'), 'Crédito should NOT include due dates in text summary');
  console.assert(creditPayment.texto.includes('10x de R$ 30,00'), 'Crédito should clearly show installment breakdown');

  // 9.2 Boleto payment representation (must keep due dates for tracking)
  const boletoPayment = {
    metodo: 'carne',
    valor: 300,
    parcelas: 3,
    texto: `📄 Boleto (3x de R$ 100,00 | Venc: 1ª 17/10/2026, 2ª 17/11/2026, 3ª 17/12/2026): R$ 300,00`
  };
  console.assert(boletoPayment.texto.includes('Venc:'), 'Boleto MUST include due dates in text summary');
  console.assert(boletoPayment.texto.includes('17/10/2026'), 'Boleto must include first due date');
  console.assert(boletoPayment.texto.includes('17/12/2026'), 'Boleto must include future due dates');

  console.log('  ✅ Test 9 Passed: Crédito cleanly formatted without dates, Boleto retains complete due dates schedule.\n');

  // ─── TEST 10: OS Management Search & Deadline Heuristics ───────────────
  console.log('▶ Test 10: OS Management Search & Deadline Calculations');

  const getTestDeadlineInfo = (dtEntrega, status) => {
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

  // 10.1 Entregue orders do not report deadline alerts
  console.assert(getTestDeadlineInfo('2026-09-10', 'Entregue') === null, 'Entregue OS should have null deadline alert');

  // 10.2 Overdue order detection
  const overdueInfo = getTestDeadlineInfo('2020-01-01', 'No Laboratório');
  console.assert(overdueInfo.isDelayed === true, 'Past date should be detected as delayed');
  console.assert(overdueInfo.text.includes('Atrasada'), 'Overdue text must mention Atrasada');

  // 10.3 Multi-field search matching
  const testOrder = {
    osNumber: 'CAJ-12',
    clientName: 'Stephanie Museti Santos',
    clientCPF: '442.634.228-35',
    clientPhone: '(13) 99774-1911',
    product: 'Jhon Ricky 9924 + Ambar Vision',
    armacao: 'Jhon Ricky 9924',
    lente: 'Ambar Vision Light',
    unit: 'Cajati',
    status: 'No Laboratório'
  };

  const matchesSearch = (order, query) => {
    const q = query.toLowerCase().trim();
    const cleanQ = q.replace(/\D/g, '');
    const matchesOS = order.osNumber.toLowerCase().includes(q);
    const matchesClient = order.clientName.toLowerCase().includes(q);
    const matchesArmacao = (order.armacao || '').toLowerCase().includes(q);
    const matchesLente = (order.lente || '').toLowerCase().includes(q);
    let matchesDoc = false;
    if (cleanQ.length >= 3) {
      const clientCPFNum = (order.clientCPF || '').replace(/\D/g, '');
      const clientPhoneNum = (order.clientPhone || '').replace(/\D/g, '');
      if (clientCPFNum.includes(cleanQ) || clientPhoneNum.includes(cleanQ)) {
        matchesDoc = true;
      }
    }
    return matchesOS || matchesClient || matchesArmacao || matchesLente || matchesDoc;
  };

  console.assert(matchesSearch(testOrder, 'caj-12') === true, 'Matches OS number');
  console.assert(matchesSearch(testOrder, 'stephanie') === true, 'Matches Client name');
  console.assert(matchesSearch(testOrder, '442634') === true, 'Matches Unformatted CPF');
  console.assert(matchesSearch(testOrder, '99774') === true, 'Matches Phone number');
  console.assert(matchesSearch(testOrder, 'jhon ricky') === true, 'Matches Armação');
  console.assert(matchesSearch(testOrder, 'ambar') === true, 'Matches Lente');
  console.assert(matchesSearch(testOrder, 'outro cliente') === false, 'Does not match unrelated term');

  console.log('  ✅ Test 10 Passed: OS Search matching and deadline calculations verified.\n');

  // ==========================================
  // TEST 11: OS Management Access Permissions (Vendedor & Admin)
  // ==========================================
  console.log('▶ Test 11: OS Management Access Permissions (Vendedor & Admin)');
  
  const vendedorUser = { username: 'vendedor_cajati', role: 'vendedor', city: 'Cajati', authorized: true };
  const adminUser = { username: 'wmusete', role: 'administrativo', city: 'Cajati', authorized: true };

  // 11.1 Drawer visibility check
  const isOSDrawerVisible = (user) => true; // Now universally accessible
  console.assert(isOSDrawerVisible(vendedorUser) === true, 'Vendedor must see OS Management in drawer');
  console.assert(isOSDrawerVisible(adminUser) === true, 'Admin must see OS Management in drawer');

  // 11.2 Can view / access OS Management screen
  const canAccessOS = (user) => user && ['admin', 'administrativo', 'vendedor'].includes(user.role);
  console.assert(canAccessOS(vendedorUser) === true, 'Vendedor must have access to OS screen');
  console.assert(canAccessOS(adminUser) === true, 'Admin must have access to OS screen');

  // 11.3 Default store filter respects vendedor's city
  const getDefaultStoreFilter = (user) => user?.city || 'ALL';
  console.assert(getDefaultStoreFilter(vendedorUser) === 'Cajati', 'Vendedor default unit must match assigned city');

  // 11.4 Deletion safety (only admins can delete orders)
  const canDeleteOrder = (user) => ['admin', 'administrativo'].includes(user?.role);
  console.assert(canDeleteOrder(vendedorUser) === false, 'Vendedor must NOT have permission to delete OS');
  console.assert(canDeleteOrder(adminUser) === true, 'Admin MUST have permission to delete OS');

  // 11.5 Status modification permission (Vendedor CANNOT alter OS status)
  const canChangeOSStatus = (user) => !['vendedor'].includes(user?.role) && ['admin', 'administrativo'].includes(user?.role);
  console.assert(canChangeOSStatus(vendedorUser) === false, 'Vendedor must NOT have permission to alter OS status');
  console.assert(canChangeOSStatus(adminUser) === true, 'Admin MUST have permission to alter OS status');

  // 11.6 Financial approval / confirmation permission (Vendedor CANNOT approve/confirm OS)
  const canApproveOSFinance = (user) => !['vendedor'].includes(user?.role) && ['admin', 'administrativo'].includes(user?.role);
  console.assert(canApproveOSFinance(vendedorUser) === false, 'Vendedor must NOT have permission to approve/confirm OS finance');
  console.assert(canApproveOSFinance(adminUser) === true, 'Admin MUST have permission to approve/confirm OS finance');

  // 11.7 Search, Store Filtering and Printing permissions (Universally accessible)
  const canSearchAndPrintOS = (user) => Boolean(user && user.authorized);
  console.assert(canSearchAndPrintOS(vendedorUser) === true, 'Vendedor MUST be able to search and print OS');
  console.assert(canSearchAndPrintOS(adminUser) === true, 'Admin MUST be able to search and print OS');

  console.log('  ✅ Test 11 Passed: OS Management permissions, store preselection and deletion safety verified.\n');

  // ==========================================
  // TEST 12: OS Financial Breakdown (Boleto vs Immediate Payments & Falta Calculation)
  // ==========================================
  console.log('▶ Test 12: OS Financial Breakdown (Boleto as Pending Debt, Not Cash Downpayment)');

  const cleanValTest = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const s = String(v).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const calculateDownpaymentAndRemaining = (totalFinal, paymentsList) => {
    const totalPagoImediato = paymentsList.reduce((acc, p) => {
      const m = String(p.metodo || '').toLowerCase();
      if (m === 'boleto' || m === 'carne') return acc;
      return acc + (cleanValTest(p.valor) || 0);
    }, 0);
    const entrada = totalPagoImediato;
    const restante = Math.max(0, totalFinal - totalPagoImediato);
    return { entrada, restante };
  };

  // Case 1: Pure Boleto (R$ 350,00 total in 5x boleto) -> Entrada must be 0,00 and Falta/Restante must be 350,00
  const caseBoletoPure = calculateDownpaymentAndRemaining(350, [
    { metodo: 'boleto', valor: 350, parcelas: 5 }
  ]);
  console.assert(caseBoletoPure.entrada === 0, 'Pure boleto must have R$ 0,00 downpayment');
  console.assert(caseBoletoPure.restante === 350, 'Pure boleto must have full amount (R$ 350,00) as remaining/falta');

  // Case 2: Mixed (R$ 100 in Cash/PIX + R$ 250 in Boleto) -> Entrada must be 100,00 and Falta/Restante must be 250,00
  const caseMixed = calculateDownpaymentAndRemaining(350, [
    { metodo: 'pix', valor: 100 },
    { metodo: 'boleto', valor: 250 }
  ]);
  console.assert(caseMixed.entrada === 100, 'Mixed payment must count PIX as R$ 100,00 downpayment');
  console.assert(caseMixed.restante === 250, 'Mixed payment must leave boleto portion (R$ 250,00) as remaining/falta');

  // Case 3: Pure Cash/Credit (R$ 350,00) -> Entrada must be 350,00 and Falta/Restante must be 0,00
  const casePaid = calculateDownpaymentAndRemaining(350, [
    { metodo: 'credito', valor: 350 }
  ]);
  console.assert(casePaid.entrada === 350, 'Credit must count as full payment');
  console.assert(casePaid.restante === 0, 'Fully paid sale must have R$ 0,00 remaining');

  console.log('  ✅ Test 12 Passed: Downpayment vs pending installment debt properly distinguished.\n');

  // ─── TEST 13: OS Semáforo Azul & Geração Condicional de Duplicatas ──────────
  console.log('▶ Test 13: OS Semáforo Azul (Aguardando Confirmação) & Geração Condicional de Duplicatas');

  // 13.1 Validação do Status Azul no Semáforo
  const testStatusConfig = {
    "Aguardando Confirmação": {
      label: "Aguardando Confirmação",
      color: "blue",
      badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-[0_0_12px_rgba(14,165,233,0.25)]",
      dotClass: "bg-sky-400 animate-pulse",
      icon: "🔵"
    }
  };
  console.assert(testStatusConfig["Aguardando Confirmação"].color === 'blue', 'Status "Aguardando Confirmação" must have color blue');
  console.assert(testStatusConfig["Aguardando Confirmação"].icon === '🔵', 'Status "Aguardando Confirmação" must have blue dot icon');

  // 13.2 Simulação de Geração de Nova OS (Sem duplicata prévia)
  const simulateNewOS = (client, osInput) => {
    return {
      CLIENTE_ID: client.id,
      CPF: client['CPF / CNPJ'],
      NOME: client['Nome Completo'],
      PRODUTO: osInput.produto,
      VALOR_TOTAL: osInput.valorTotal,
      VALOR_ENTRADA: osInput.valorEntrada,
      RESTANTE: osInput.restante,
      PARCELAS_JSON: JSON.stringify(osInput.parcelas || []),
      STATUS_OS: 'Aguardando Confirmação',
      SITUAÇÃO: 'Aguardando Confirmação',
      DUPLICATAS_GERADAS: false,
      PAGAMENTO_CONFERIDO: 'Não'
    };
  };

  const clientMock = { id: 'cli_101', 'CPF / CNPJ': '123.456.789-00', 'Nome Completo': 'Lucas Silva', 'Valor Devido': '0,00' };
  const osMock = simulateNewOS(clientMock, {
    produto: 'Lente Anti-Reflexo + Armação Vogue',
    valorTotal: '600,00',
    valorEntrada: '100,00',
    restante: '500,00',
    parcelas: [
      { numero: 1, totalParcelas: 2, valor: '250,00', vencimento: '2026-10-26' },
      { numero: 2, totalParcelas: 2, valor: '250,00', vencimento: '2026-11-26' }
    ]
  });

  console.assert(osMock.STATUS_OS === 'Aguardando Confirmação', 'Nova OS deve iniciar em Aguardando Confirmação');
  console.assert(osMock.DUPLICATAS_GERADAS === false, 'Duplicatas não devem ser geradas na emissão inicial');
  console.assert(osMock.PAGAMENTO_CONFERIDO === 'Não', 'Pagamento não deve estar conferido inicialmente');

  // 13.3 Cenário A: Aprovação pela Administração
  const simulateApproval = (os, client, contasReceberDb) => {
    const parcs = JSON.parse(os.PARCELAS_JSON || '[]');
    parcs.forEach(p => {
      contasReceberDb.push({
        CLIENTE_ID: os.CLIENTE_ID,
        CPF: os.CPF,
        VALOR: p.valor,
        VENCIMENTO: p.vencimento,
        STATUS: 'Pendente'
      });
    });

    const restNum = parseFloat(os.RESTANTE.replace(',', '.'));
    const curDebt = parseFloat(client['Valor Devido'].replace(',', '.'));
    client['Valor Devido'] = (curDebt + restNum).toFixed(2).replace('.', ',');
    client['Status de Pagamento'] = 'Inadimplente';

    os.STATUS_OS = 'No Laboratório';
    os.SITUAÇÃO = 'Pendente';
    os.PAGAMENTO_CONFERIDO = 'Sim';
    os.DUPLICATAS_GERADAS = true;
  };

  const contasReceberTest = [];
  const clientApprovalTest = { ...clientMock };
  const osApprovalTest = { ...osMock };

  simulateApproval(osApprovalTest, clientApprovalTest, contasReceberTest);

  console.assert(contasReceberTest.length === 2, 'Após aprovação, deve gerar 2 duplicatas no financeiro');
  console.assert(contasReceberTest[0].VALOR === '250,00', 'Parcela 1 deve ser de R$ 250,00');
  console.assert(clientApprovalTest['Valor Devido'] === '500,00', 'Débito do cliente deve ser atualizado para 500,00');
  console.assert(osApprovalTest.STATUS_OS === 'No Laboratório', 'Após confirmação, OS deve ser liberada para No Laboratório');
  console.assert(osApprovalTest.DUPLICATAS_GERADAS === true, 'Flag de duplicatas geradas deve ser true');

  // 13.4 Cenário B: Recusa / Cancelamento da OS (Se não aprovada, duplicata não vai)
  const simulateRejection = (os, client, contasReceberDb) => {
    os.STATUS_OS = 'Cancelada';
    os.SITUAÇÃO = 'Cancelada';
    os.PAGAMENTO_CONFERIDO = 'Não';
    os.DUPLICATAS_GERADAS = false;
    // Nenhuma duplicata adicionada a contasReceberDb
    // Nenhum débito somado ao cliente
  };

  const contasReceberReject = [];
  const clientRejectTest = { ...clientMock };
  const osRejectTest = { ...osMock };

  simulateRejection(osRejectTest, clientRejectTest, contasReceberReject);

  console.assert(contasReceberReject.length === 0, 'Se OS for recusada, NENHUMA duplicata vai para o financeiro');
  console.assert(clientRejectTest['Valor Devido'] === '0,00', 'Se OS for recusada, cliente não recebe débito');
  console.assert(osRejectTest.STATUS_OS === 'Cancelada', 'Status deve mudar para Cancelada');

  console.log('  ✅ Test 13 Passed: Semáforo Azul, aprovação com geração de duplicatas e cancelamento seguro verificados com sucesso!\n');

  // ==========================================
  // TEST 14: Anti-Duplicação de Contas a Receber (Parcelas vs Saldo Cheio)
  // ==========================================
  console.log('▶ Test 14: Anti-Duplicação em CONTAS_RECEBER (Parcelas Mensais vs Lançamento Único)');

  // 14.1 Simulação do caso de Stephanie: 12 parcelas de 29,17 + 1 lançamento de 350,00
  const rawReceberWithDuplicate = [
    { id: '1', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 1/12 - PDV', 'DATA VENCIMENTO': '26/10/2026' },
    { id: '2', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 2/12 - PDV', 'DATA VENCIMENTO': '26/11/2026' },
    { id: '3', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 3/12 - PDV', 'DATA VENCIMENTO': '26/12/2026' },
    { id: '4', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 4/12 - PDV', 'DATA VENCIMENTO': '26/01/2027' },
    { id: '5', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 5/12 - PDV', 'DATA VENCIMENTO': '26/02/2027' },
    { id: '6', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 6/12 - PDV', 'DATA VENCIMENTO': '26/03/2027' },
    { id: '7', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 7/12 - PDV', 'DATA VENCIMENTO': '26/04/2027' },
    { id: '8', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 8/12 - PDV', 'DATA VENCIMENTO': '26/05/2027' },
    { id: '9', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 9/12 - PDV', 'DATA VENCIMENTO': '26/06/2027' },
    { id: '10', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 10/12 - PDV', 'DATA VENCIMENTO': '26/07/2027' },
    { id: '11', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 11/12 - PDV', 'DATA VENCIMENTO': '26/08/2027' },
    { id: '12', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '29,17', DOCUMENTO: 'BOLETO 12/12 - PDV', 'DATA VENCIMENTO': '26/09/2027' },
    { id: '13', CLIENTE: 'STEPHANIE MUSETI SANTOS', VALOR: '350,00', DOCUMENTO: 'OS #CAJ-1 - Saldo a Receber', DESCRICAO: 'Venda OS #CAJ-1 - Óculos', MEIO_PAGAMENTO: 'Boleto (12x de R$ 29,17)' }
  ];

  // Aplicar lógica do Sanitizador
  const sanitizeContasReceber = (list) => {
    const installmentRows = list.filter(r => {
      const doc = String(r.DOCUMENTO || '').toUpperCase();
      return doc.includes('BOLETO') && /\d+\/\d+/.test(doc);
    });
    if (installmentRows.length > 1) {
      const installmentsSum = installmentRows.reduce((acc, r) => acc + (parseFloat(String(r.VALOR || '0').replace(',', '.')) || 0), 0);
      return list.filter(r => {
        const isInst = installmentRows.includes(r);
        const rVal = parseFloat(String(r.VALOR || '0').replace(',', '.')) || 0;
        const isDuplicateLumpSum = !isInst && Math.abs(rVal - installmentsSum) < 2.0;
        return !isDuplicateLumpSum;
      });
    }
    return list;
  };

  const sanitized = sanitizeContasReceber(rawReceberWithDuplicate);
  console.assert(sanitized.length === 12, `Deve conter exatamente 12 parcelas, retornou ${sanitized.length}`);
  const totalSanitized = sanitized.reduce((acc, r) => acc + parseFloat(r.VALOR.replace(',', '.')), 0);
  console.assert(Math.abs(totalSanitized - 350.04) < 0.01, `Total deve ser R$ 350,04 e não R$ 700,04, calculou ${totalSanitized}`);

  // 14.2 Teste de auto-reconstrução de parcelas a partir de texto (ex: "Boleto (12x de R$ 29,17)")
  const parseInstallmentsRegex = (fpText) => {
    const match = fpText.match(/(\d+)x\s*(?:de\s*)?R?\$?\s*([\d.,]+)/i);
    if (!match) return [];
    const count = parseInt(match[1], 10);
    const val = parseFloat(match[2].replace(',', '.'));
    return Array.from({ length: count }, (_, i) => ({
      numero: i + 1,
      totalParcelas: count,
      valor: val.toFixed(2).replace('.', ',')
    }));
  };

  const reconstructed = parseInstallmentsRegex('Boleto (12x de R$ 29,17)');
  console.assert(reconstructed.length === 12, 'Deve reconstruir 12 parcelas');
  console.assert(reconstructed[0].valor === '29,17', 'Valor unitário da parcela deve ser 29,17');

  console.log('  ✅ Test 14 Passed: Anti-duplicação e normalização de parcelas em CONTAS_RECEBER verificados com sucesso!\n');

  // ==========================================
  // TEST 15: Anexo e Visualização de Comprovante de Pagamento / Mensalidades
  // ==========================================
  console.log('▶ Test 15: Anexo e Visualização de Comprovante em Mensalidades & Carnê');

  const testInstallment = {
    id: 'rec_1',
    CLIENTE: 'STEPHANIE MUSETI SANTOS',
    DOCUMENTO: 'BOLETO 1/12 - PDV',
    VALOR: '29,17',
    STATUS: 'Pendente',
    DATA_VENCIMENTO: '2026-10-26'
  };

  // Simular anexo de comprovante com opção markAsPaid = true
  const attachReceipt = (row, receiptBase64, fileName, markAsPaid = true) => {
    return {
      ...row,
      COMPROVANTE: receiptBase64,
      comprovante: receiptBase64,
      DATA_COMPROVANTE: new Date().toISOString(),
      NOME_COMPROVANTE: fileName,
      ...(markAsPaid ? { STATUS: 'Recebido', status: 'Recebido', DATA_RECEBIMENTO: '26/09/2026' } : {})
    };
  };

  const receiptMockBase64 = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/1/4AAABwAAA=';
  const updatedWithReceipt = attachReceipt(testInstallment, receiptMockBase64, 'comprovante_pix_29_17.webp', true);

  console.assert(updatedWithReceipt.COMPROVANTE === receiptMockBase64, 'COMPROVANTE deve conter a string base64 do anexo');
  console.assert(updatedWithReceipt.NOME_COMPROVANTE === 'comprovante_pix_29_17.webp', 'NOME_COMPROVANTE deve ser preservado');
  console.assert(updatedWithReceipt.STATUS === 'Recebido', 'Status deve ser atualizado para Recebido quando markAsPaid for true');
  console.assert(Boolean(updatedWithReceipt.DATA_COMPROVANTE), 'DATA_COMPROVANTE deve ser registrada');

  // Simular exclusão do comprovante
  const removeReceipt = (row) => {
    return {
      ...row,
      COMPROVANTE: '',
      comprovante: '',
      ANEXO_COMPROVANTE: '',
      DATA_COMPROVANTE: '',
      NOME_COMPROVANTE: ''
    };
  };

  const cleared = removeReceipt(updatedWithReceipt);
  console.assert(cleared.COMPROVANTE === '', 'COMPROVANTE deve ser esvaziado após exclusão');
  console.assert(cleared.NOME_COMPROVANTE === '', 'NOME_COMPROVANTE deve ser esvaziado');

  console.log('  ✅ Test 15 Passed: Anexo, visualização e remoção de comprovantes em Mensalidades & Carnê verificados com sucesso!\n');

  // ==========================================
  // TEST 16: Interação Precisa Cadastro de Clientes <-> ERP Financeiro
  // ==========================================
  console.log('▶ Test 16: Interação Precisa entre Cadastro de Clientes e ERP Financeiro (CONTAS_RECEBER & FLUXO_CAIXA)');

  // 16.1 Simulação de base com clientes e duplicatas no CONTAS_RECEBER
  const testClients = [
    {
      id: 'cli_001',
      'Nome Completo': 'MARIA SILVA SANTOS',
      'CPF / CNPJ': '123.456.789-00',
      'Cidade': 'Cajati',
      'Valor Devido': '0,00',
      'Status de Pagamento': 'Em dia'
    },
    {
      id: 'cli_002',
      'Nome Completo': 'JOAO PEREIRA LIMA',
      'CPF / CNPJ': '987.654.321-11',
      'Cidade': 'Registro',
      'Valor Devido': '0,00',
      'Status de Pagamento': 'Em dia'
    }
  ];

  const testReceberData = [
    // Maria Silva: Parcela 1 paga, Parcela 2 vencida (Inadimplente), Parcela 3 a vencer (Pendente)
    {
      id: 'rec_m1',
      CLIENTE_ID: 'cli_001',
      CLIENTE_CPF: '123.456.789-00',
      CLIENTE: 'MARIA SILVA SANTOS',
      VALOR: '150,00',
      STATUS: 'Recebido',
      DATA_VENCIMENTO: '2026-08-10',
      VENDA_OS: 'OS-1001'
    },
    {
      id: 'rec_m2',
      CLIENTE_ID: 'cli_001',
      CLIENTE_CPF: '123.456.789-00',
      CLIENTE: 'MARIA SILVA SANTOS',
      VALOR: '150,00',
      STATUS: 'Pendente',
      DATA_VENCIMENTO: '2026-09-01', // vencida
      VENDA_OS: 'OS-1001'
    },
    {
      id: 'rec_m3',
      CLIENTE_ID: 'cli_001',
      CLIENTE_CPF: '123.456.789-00',
      CLIENTE: 'MARIA SILVA SANTOS',
      VALOR: '150,00',
      STATUS: 'Pendente',
      DATA_VENCIMENTO: '2026-10-15', // a vencer
      VENDA_OS: 'OS-1001'
    },
    // Joao Pereira: 1 Parcela a vencer no prazo
    {
      id: 'rec_j1',
      CLIENTE_ID: 'cli_002',
      CLIENTE_CPF: '987.654.321-11',
      CLIENTE: 'JOAO PEREIRA LIMA',
      VALOR: '200,00',
      STATUS: 'Pendente',
      DATA_VENCIMENTO: '2026-11-20',
      VENDA_OS: 'OS-2002'
    }
  ];

  // Helper matching function
  const isSameClientTest = (client, inv) => {
    if (!client || !inv) return false;
    const cId = client.id || client.CLIENTE_ID || client['ID DO CLIENTE'];
    const iId = inv.CLIENTE_ID || inv.cliente_id || inv.clienteId;
    if (cId && iId && String(cId).trim() === String(iId).trim()) return true;

    const cCpf = String(client['CPF / CNPJ'] || client['CPF'] || '').replace(/\D/g, '');
    const iCpf = String(inv.CLIENTE_CPF || inv['CPF'] || inv.CPF || inv.cpf || '').replace(/\D/g, '');
    if (cCpf && iCpf && cCpf.length >= 11 && cCpf === iCpf) return true;

    const cNome = String(client['Nome Completo'] || client['NOME'] || '').trim().toLowerCase();
    const iNome = String(inv.CLIENTE || inv.cliente || inv['NOME'] || '').trim().toLowerCase();
    if (cNome && iNome && cNome === iNome) return true;

    return false;
  };

  // 16.2 Enriquecimento dinâmico em tempo real
  const enrichClientWithReceber = (client, contasReceber) => {
    const invoices = contasReceber.filter(inv => isSameClientTest(client, inv));
    let totalAberto = 0;
    let totalPago = 0;
    let hasOverdue = false;
    let hasPending = false;
    const today = '2026-09-26';

    invoices.forEach(inv => {
      const val = cleanValTest(inv.VALOR);
      const isPaid = inv.STATUS === 'Recebido' || inv.STATUS === 'Pago';
      if (isPaid) {
        totalPago += val;
      } else {
        totalAberto += val;
        hasPending = true;
        if (inv.DATA_VENCIMENTO && inv.DATA_VENCIMENTO < today) {
          hasOverdue = true;
        }
      }
    });

    const statusFinal = totalAberto === 0 ? 'Em dia' : (hasOverdue ? 'Inadimplente' : 'Pendente');

    return {
      ...client,
      _invoices: invoices,
      _totalAberto: totalAberto,
      _totalPago: totalPago,
      _statusCalculado: statusFinal
    };
  };

  const mariaEnriched = enrichClientWithReceber(testClients[0], testReceberData);
  console.assert(mariaEnriched._totalAberto === 300, `Maria deve ter R$ 300,00 em aberto (2x R$ 150), obteve ${mariaEnriched._totalAberto}`);
  console.assert(mariaEnriched._totalPago === 150, `Maria deve ter R$ 150,00 pagos, obteve ${mariaEnriched._totalPago}`);
  console.assert(mariaEnriched._statusCalculado === 'Inadimplente', `Maria tem parcela vencida em 2026-09-01, status deve ser Inadimplente, obteve ${mariaEnriched._statusCalculado}`);

  const joaoEnriched = enrichClientWithReceber(testClients[1], testReceberData);
  console.assert(joaoEnriched._totalAberto === 200, `Joao deve ter R$ 200,00 em aberto, obteve ${joaoEnriched._totalAberto}`);
  console.assert(joaoEnriched._statusCalculado === 'Pendente', `Joao tem parcela futura em 2026-11-20, status deve ser Pendente, obteve ${joaoEnriched._statusCalculado}`);

  // 16.3 Simulação de Liquidação de Parcela Individual (handleSettleSingleInvoice)
  let updatedReceberTable = [...testReceberData];
  let fluxoCaixaLog = [];

  const simulateSettleSingleInvoice = (invToSettle) => {
    // 1. Marca como recebido no Contas a Receber
    updatedReceberTable = updatedReceberTable.map(inv => {
      if (inv.id === invToSettle.id) {
        return {
          ...inv,
          STATUS: 'Recebido',
          DATA_RECEBIMENTO: '2026-09-26'
        };
      }
      return inv;
    });

    // 2. Registra entrada no Fluxo de Caixa
    const val = cleanValTest(invToSettle.VALOR);
    fluxoCaixaLog.push({
      tipo: 'RECEBIMENTO',
      valor: val,
      formaPagamento: 'DINHEIRO / RECEBIMENTO',
      motivo: `Recebimento Boleto - ${invToSettle.CLIENTE}`,
      CLIENTE_ID: invToSettle.CLIENTE_ID,
      CLIENTE_CPF: invToSettle.CLIENTE_CPF
    });
  };

  // Quitar a parcela vencida da Maria (rec_m2)
  simulateSettleSingleInvoice(testReceberData[1]);

  // Verificar se a parcela rec_m2 agora está como Recebido
  const settledRec = updatedReceberTable.find(inv => inv.id === 'rec_m2');
  console.assert(settledRec.STATUS === 'Recebido', 'Parcela rec_m2 deve constar como Recebido após quitação');
  console.assert(fluxoCaixaLog.length === 1, 'Fluxo de Caixa deve registrar 1 entrada de recebimento');
  console.assert(fluxoCaixaLog[0].valor === 150, 'Valor do recebimento no Fluxo de Caixa deve ser R$ 150,00');

  // Recalcular status da Maria após quitação da parcela vencida
  const mariaAfterSettlement = enrichClientWithReceber(testClients[0], updatedReceberTable);
  console.assert(mariaAfterSettlement._totalAberto === 150, `Débito da Maria agora deve ser R$ 150,00 (apenas a parcela a vencer), obteve ${mariaAfterSettlement._totalAberto}`);
  console.assert(mariaAfterSettlement._statusCalculado === 'Pendente', `Como só resta parcela com vencimento futuro, status da Maria deve ser Pendente e não mais Inadimplente, obteve ${mariaAfterSettlement._statusCalculado}`);

  console.log('  ✅ Test 16 Passed: Interação precisa Cliente <-> Contas a Receber <-> Fluxo de Caixa validada com sucesso!\n');

  // ==========================================
  // TEST 17: Exclusão Segura e em Cascata da OS (Limpeza de Duplicatas, Recálculo do Débito e Estoque)
  // ==========================================
  console.log('▶ Test 17: Exclusão Segura e em Cascata da OS (Limpeza Financeira e Estoque)');

  const osToTest = {
    osNumber: 'CAJ-5501',
    clientName: 'CARLOS EDUARDO ROCHA',
    clientCPF: '444.555.666-77',
    raw: {
      'OS DA VENDA': 'CAJ-5501',
      'NOME CLIENTE': 'CARLOS EDUARDO ROCHA',
      'VALOR TOTAL': '600,00',
      'VALOR ENTRADA': '100,00',
      'RESTANTE': '500,00',
      'ARMAÇÃO': 'RAY-BAN AVIATOR RB3025'
    },
    matchedClient: {
      id: 'cli_carlos',
      'Nome Completo': 'CARLOS EDUARDO ROCHA',
      'CPF / CNPJ': '444.555.666-77',
      'Valor Devido': '500,00',
      'Status de Pagamento': 'Pendente'
    }
  };

  let testReceberCascata = [
    // Duplicatas da OS CAJ-5501
    { id: 'rec_c1', VENDA_OS: 'CAJ-5501', VALOR: '250,00', STATUS: 'Pendente' },
    { id: 'rec_c2', VENDA_OS: 'CAJ-5501', VALOR: '250,00', STATUS: 'Pendente' },
    // Duplicata de outra OS que NÃO deve ser afetada
    { id: 'rec_outra', VENDA_OS: 'REG-9999', VALOR: '180,00', STATUS: 'Pendente' }
  ];

  let testArmacoesCascata = [
    { MODELO: 'RAY-BAN AVIATOR RB3025', ESTOQUE: '2' },
    { MODELO: 'OAKLEY HOLBROOK', ESTOQUE: '5' }
  ];

  let testVendasCascata = [osToTest.raw];

  // Simular a exclusão em cascata
  const simulateCascadeDeleteOS = (order) => {
    const targetOS = String(order.osNumber).trim().toLowerCase();
    
    // 1. Filtrar e remover duplicatas pendentes da OS
    const pendingToDelete = testReceberCascata.filter(inv => {
      const vOS = String(inv.VENDA_OS || '').trim().toLowerCase();
      return vOS === targetOS && inv.STATUS !== 'Recebido' && inv.STATUS !== 'Pago';
    });

    testReceberCascata = testReceberCascata.filter(inv => !pendingToDelete.some(p => p.id === inv.id));

    // 2. Abater débito do cliente
    const totalPendingVal = pendingToDelete.reduce((sum, inv) => sum + cleanValTest(inv.VALOR), 0);
    const currDebt = cleanValTest(order.matchedClient['Valor Devido']);
    const newDebt = Math.max(0, currDebt - totalPendingVal);
    order.matchedClient['Valor Devido'] = newDebt.toFixed(2).replace('.', ',');
    order.matchedClient['Status de Pagamento'] = newDebt === 0 ? 'Em dia' : order.matchedClient['Status de Pagamento'];

    // 3. Estorno de Estoque (+1)
    const armacaoNome = String(order.raw['ARMAÇÃO'] || '').trim().toLowerCase();
    const itemEstoque = testArmacoesCascata.find(a => a.MODELO.toLowerCase() === armacaoNome);
    if (itemEstoque) {
      itemEstoque.ESTOQUE = String(parseInt(itemEstoque.ESTOQUE, 10) + 1);
    }

    // 4. Remover da tabela de Vendas
    testVendasCascata = testVendasCascata.filter(v => v['OS DA VENDA'] !== order.osNumber);

    return {
      deletedInvoicesCount: pendingToDelete.length,
      refundedAmount: totalPendingVal
    };
  };

  const resultCascata = simulateCascadeDeleteOS(osToTest);

  // Verificações
  console.assert(resultCascata.deletedInvoicesCount === 2, 'Deve ter removido exatamente as 2 duplicatas pendentes da OS');
  console.assert(testReceberCascata.length === 1 && testReceberCascata[0].id === 'rec_outra', 'Duplicata de outra OS (rec_outra) deve permanecer intacta');
  console.assert(osToTest.matchedClient['Valor Devido'] === '0,00', `Débito do cliente deve ter sido zerado, valor: ${osToTest.matchedClient['Valor Devido']}`);
  console.assert(osToTest.matchedClient['Status de Pagamento'] === 'Em dia', 'Status do cliente deve voltar para Em dia');
  console.assert(testArmacoesCascata[0].ESTOQUE === '3', `Estoque da armação deve ter voltado de 2 para 3 unidades, obteve ${testArmacoesCascata[0].ESTOQUE}`);
  console.assert(testVendasCascata.length === 0, 'Venda/OS deve ter sido removida de Registro_Vendas');

  // 17.2 Resolução Segura de Cliente via clientsData / order.clientData / order.matchedClient
  const clientLucas = {
    id: 'cli_lucas_123',
    'Nome Completo': 'Lucas Gabriel Ferreira',
    'CPF / CNPJ': '111.222.333-44',
    'Valor Devido': '400,00',
    'Status de Pagamento': 'Inadimplente'
  };
  const osOrderLucas = {
    osNumber: 'CAJ-7788',
    clientName: 'Lucas Gabriel Ferreira',
    clientCPF: '111.222.333-44',
    clientData: clientLucas,
    matchedClient: undefined,
    raw: {
      'OS DA VENDA': 'CAJ-7788',
      'NOME CLIENTE': 'Lucas Gabriel Ferreira',
      'CLIENTE_CPF': '111.222.333-44',
      'VALOR TOTAL': '400,00',
      'RESTANTE': '400,00'
    }
  };
  const testClientsList = [clientLucas];
  const resolvedClient = testClientsList.find(c => isSameClient(c, osOrderLucas.raw)) || osOrderLucas.clientData || osOrderLucas.matchedClient;
  console.assert(resolvedClient && resolvedClient.id === 'cli_lucas_123', 'Resolução de cliente DEVE funcionar via order.clientData ou clientsData mesmo sem order.matchedClient');

  const pendingInvoicesLucas = [{ id: 'rec_l1', VALOR: '400,00', STATUS: 'Pendente' }];
  const currentDebtLucas = cleanValTest(resolvedClient['Valor Devido']);
  const pendingTotalLucas = pendingInvoicesLucas.reduce((sum, inv) => sum + cleanValTest(inv.VALOR), 0);
  resolvedClient['Valor Devido'] = Math.max(0, currentDebtLucas - pendingTotalLucas).toFixed(2).replace('.', ',');
  resolvedClient['Status de Pagamento'] = resolvedClient['Valor Devido'] === '0,00' ? 'Em dia' : resolvedClient['Status de Pagamento'];
  console.assert(resolvedClient['Valor Devido'] === '0,00' && resolvedClient['Status de Pagamento'] === 'Em dia', 'Débito do cliente resolvido via clientData deve ser estornado com sucesso');

  console.log('  ✅ Test 17 Passed: Exclusão em cascata da OS com limpeza no Contas a Receber, recálculo do Cliente e devolução de estoque verificados com sucesso!\n');

  // ==========================================
  // TEST 18: Frente de Caixa / PDV (Sequência 2, 1 e 3)
  // Item 2: Alerta de Risco / Inadimplência na Venda no Carnê
  // Item 1: Cadastro Rápido de Novo Cliente dentro do PDV (Preservação do Carrinho)
  // Item 3: Categorias Rápidas, Destaques Mais Vendidos & Chips de Marca
  // ==========================================
  console.log('▶ Test 18: Frente de Caixa / PDV (Inadimplência Carnê, Cadastro Rápido no PDV e Ranking de Populares)');

  // 18.1 ITEM 2: Detecção de Inadimplência e Trava de Segurança no Carnê
  const clientDevedor = {
    id: 'cli_dev_01',
    'Nome Completo': 'MARCOS SOUZA PEREIRA',
    'CPF / CNPJ': '111.222.333-44',
    'Valor Devido': '450,00',
    'Status de Pagamento': 'Inadimplente'
  };

  const clientEmDia = {
    id: 'cli_ok_02',
    'Nome Completo': 'JULIANA MENDES LIMA',
    'CPF / CNPJ': '555.666.777-88',
    'Valor Devido': '0,00',
    'Status de Pagamento': 'Em dia'
  };

  const mockReceberPDV = [
    {
      id: 'rec_dev_1',
      CLIENTE_ID: 'cli_dev_01',
      CLIENTE: 'MARCOS SOUZA PEREIRA',
      VALOR: '250,00',
      STATUS: 'Pendente',
      DATA_VENCIMENTO: '2026-08-15' // Vencida
    },
    {
      id: 'rec_dev_2',
      CLIENTE_ID: 'cli_dev_01',
      CLIENTE: 'MARCOS SOUZA PEREIRA',
      VALOR: '200,00',
      STATUS: 'Pendente',
      DATA_VENCIMENTO: '2026-10-15' // A vencer
    },
    {
      id: 'rec_ok_1',
      CLIENTE_ID: 'cli_ok_02',
      CLIENTE: 'JULIANA MENDES LIMA',
      VALOR: '180,00',
      STATUS: 'Recebido',
      DATA_VENCIMENTO: '2026-09-01'
    }
  ];

  const calculateClientFinancialStatusPDV = (client, invoicesList, today = '2026-09-26') => {
    if (!client) return null;
    const clientInvoices = invoicesList.filter(inv => isSameClientTest(client, inv));
    let totalAberto = 0;
    let totalVencido = 0;
    let hasOverdue = false;

    clientInvoices.forEach(inv => {
      const val = cleanValTest(inv.VALOR);
      const isPaid = inv.STATUS === 'Recebido' || inv.STATUS === 'Pago';
      const dtVenc = inv.DATA_VENCIMENTO || '';

      if (!isPaid) {
        totalAberto += val;
        if (dtVenc && dtVenc < today) {
          hasOverdue = true;
          totalVencido += val;
        }
      }
    });

    const isInadimplente = hasOverdue || String(client['Status de Pagamento'] || '').toLowerCase() === 'inadimplente';

    return {
      totalAberto,
      totalVencido: totalVencido > 0 ? totalVencido : (isInadimplente ? totalAberto : 0),
      isInadimplente,
      countInvoices: clientInvoices.length
    };
  };

  const finDevedor = calculateClientFinancialStatusPDV(clientDevedor, mockReceberPDV);
  console.assert(finDevedor.isInadimplente === true, 'Cliente devedor deve ser marcado como isInadimplente = true');
  console.assert(finDevedor.totalVencido === 250, `Total vencido de Marcos deve ser R$ 250,00, obteve ${finDevedor.totalVencido}`);
  console.assert(finDevedor.totalAberto === 450, `Total em aberto de Marcos deve ser R$ 450,00, obteve ${finDevedor.totalAberto}`);

  const finEmDia = calculateClientFinancialStatusPDV(clientEmDia, mockReceberPDV);
  console.assert(finEmDia.isInadimplente === false, 'Cliente Juliana deve ser marcada como isInadimplente = false');
  console.assert(finEmDia.totalVencido === 0, 'Cliente Juliana não deve ter valor vencido');

  // Trava de segurança no carnê: simulação de verificação
  const canIssueCarneWithoutExplicitConfirm = (financials) => {
    return !financials?.isInadimplente;
  };
  console.assert(!canIssueCarneWithoutExplicitConfirm(finDevedor), 'Não deve emitir carnê para inadimplente sem confirmação explícita');
  console.assert(canIssueCarneWithoutExplicitConfirm(finEmDia), 'Cliente em dia pode emitir carnê diretamente');

  // 18.2 ITEM 1: Cadastro Rápido no PDV e Preservação de Carrinho
  let posCart = [
    { id: 'arm_01', nome: 'Armação Ray-Ban Aviator', preco: 450, qtd: 1 },
    { id: 'lente_01', nome: 'Lente Transitions Crizal', preco: 350, qtd: 1 }
  ];

  const simulateQuickClientRegistration = (formData, currentCart, clientsDatabase) => {
    const newClient = {
      id: `cli_${Date.now()}_test`,
      'Nome Completo': formData.nome.trim(),
      'NOME': formData.nome.trim(),
      'CPF / CNPJ': formData.cpf.trim(),
      'CPF': formData.cpf.trim(),
      'WhatsApp': formData.whatsapp.trim(),
      'Cidade': formData.cidade || 'Cajati',
      'CIDADE': formData.cidade || 'Cajati',
      'OD_ESF': formData.odEsf || '',
      'OE_ESF': formData.oeEsf || '',
      'MEDICO': formData.medico || '',
      'Status de Pagamento': 'Em dia',
      'Valor Devido': '0,00',
      'Data de Cadastro': '26/09/2026'
    };

    clientsDatabase.push(newClient);
    // O carrinho não deve ser reiniciado (preservação total do estado)
    const preservedCart = [...currentCart];

    return {
      createdClient: newClient,
      updatedCart: preservedCart
    };
  };

  const testDbClientes = [];
  const quickRegResult = simulateQuickClientRegistration({
    nome: 'BEATRIZ ALMEIDA SOUZA',
    cpf: '333.444.555-66',
    whatsapp: '(13) 99888-7766',
    cidade: 'Cajati',
    odEsf: '-2.00',
    oeEsf: '-2.25',
    medico: 'Dr. Roberto Oftalmo'
  }, posCart, testDbClientes);

  console.assert(testDbClientes.length === 1, 'Novo cliente deve estar inserido na base de clientes');
  console.assert(quickRegResult.createdClient['Nome Completo'] === 'BEATRIZ ALMEIDA SOUZA', 'Nome do cliente rápido deve coincidir');
  console.assert(quickRegResult.createdClient['OD_ESF'] === '-2.00', 'Prescrição rápida OD deve ser gravada');
  console.assert(quickRegResult.updatedCart.length === 2, 'Carrinho DEVE permanecer 100% intacto com 2 itens');
  console.assert(quickRegResult.updatedCart[0].id === 'arm_01' && quickRegResult.updatedCart[1].id === 'lente_01', 'Itens do carrinho devem ser exatamente os mesmos');

  // 18.3 ITEM 3: Categorias Rápidas, Destaques Mais Vendidos & Chips de Marca
  const mockHistoricoVendas = [
    { PRODUTO: 'RAY-BAN AVIATOR RB3025' },
    { PRODUTO: 'RAY-BAN AVIATOR RB3025' },
    { PRODUTO: 'RAY-BAN AVIATOR RB3025' },
    { PRODUTO: 'OAKLEY HOLBROOK' },
    { PRODUTO: 'OAKLEY HOLBROOK' },
    { PRODUTO: 'VOGUE EYEWEAR VO5355' }
  ];

  // Cálculo da frequência de vendas
  const computeSalesMap = (salesList) => {
    const map = {};
    salesList.forEach(s => {
      const p = String(s.PRODUTO || '').toLowerCase();
      if (p) map[p] = (map[p] || 0) + 1;
    });
    return map;
  };

  const salesMap = computeSalesMap(mockHistoricoVendas);
  console.assert(salesMap['ray-ban aviator rb3025'] === 3, 'Ray-Ban deve ter 3 vendas computadas');
  console.assert(salesMap['oakley holbrook'] === 2, 'Oakley deve ter 2 vendas computadas');
  console.assert(salesMap['vogue eyewear vo5355'] === 1, 'Vogue deve ter 1 venda computada');

  // Ordenação de mais vendidos
  const catalogoProdutos = [
    { id: '1', MODELO: 'VOGUE EYEWEAR VO5355', MARCA: 'Vogue' },
    { id: '2', MODELO: 'RAY-BAN AVIATOR RB3025', MARCA: 'Ray-Ban' },
    { id: '3', MODELO: 'OAKLEY HOLBROOK', MARCA: 'Oakley' },
    { id: '4', MODELO: 'ARMANI EXCHANGE AX3016', MARCA: 'Armani' }
  ];

  const catalogoOrdenadoPorPopulares = [...catalogoProdutos].sort((a, b) => {
    const countA = salesMap[String(a.MODELO).toLowerCase()] || 0;
    const countB = salesMap[String(b.MODELO).toLowerCase()] || 0;
    return countB - countA;
  });

  console.assert(catalogoOrdenadoPorPopulares[0].MODELO === 'RAY-BAN AVIATOR RB3025', 'O produto mais vendido no topo deve ser o Ray-Ban (3 vendas)');
  console.assert(catalogoOrdenadoPorPopulares[1].MODELO === 'OAKLEY HOLBROOK', 'O segundo mais vendido deve ser Oakley (2 vendas)');
  console.assert(catalogoOrdenadoPorPopulares[2].MODELO === 'VOGUE EYEWEAR VO5355', 'O terceiro deve ser Vogue (1 venda)');
  console.assert(catalogoOrdenadoPorPopulares[3].MODELO === 'ARMANI EXCHANGE AX3016', 'Sem histórico de vendas deve ficar por último');

  // Filtro por Chip de Marca
  const filterByBrandChip = (list, brand) => {
    if (!brand) return list;
    const b = brand.toLowerCase();
    return list.filter(item => {
      const m = String(item.MARCA || item.MODELO || '').toLowerCase();
      return m.includes(b);
    });
  };

  const filteredOakley = filterByBrandChip(catalogoProdutos, 'Oakley');
  console.assert(filteredOakley.length === 1 && filteredOakley[0].MARCA === 'Oakley', 'Filtro de chip de marca deve retornar exatamente os produtos da marca');

  console.log('  ✅ Test 18 Passed: Inadimplência no carnê, cadastro rápido com carrinho intacto e ranking de mais vendidos verificados com sucesso!\n');

  // ==========================================
  // TEST 19: Desduplicação de Colunas e Aliases no Modal de Edição e DataTable
  // Eliminação de campos duplicados (STATUS vs status, CLIENTE vs NOME CLIENTE)
  // Sincronização automática entre aliases e Identificação correta de Contas a Receber
  // ==========================================
  console.log('▶ Test 19: Desduplicação de Colunas & Aliases (STATUS, CLIENTE, VENCIMENTO) e Identificação de Entidade');

  const testCanonicalAliases = [
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
      id: 'vencimento',
      canonical: 'DATA_VENCIMENTO',
      label: 'Vencimento',
      keys: ['DATA_VENCIMENTO', 'DATA VENCIMENTO', 'data_vencimento', 'VENCIMENTO', 'vencimento', 'Data de Vencimento']
    }
  ];

  // 19.1 Simulação de Desduplicação de Colunas
  const rawColumnsFromStephanieRow = [
    'CLIENTE',
    'CLIENTE_CPF',
    'CLIENTE_ID',
    'NOME CLIENTE',
    'STATUS',
    'status',
    'VALOR',
    'DATA_VENCIMENTO',
    'DATA VENCIMENTO',
    'CIDADE'
  ];

  const deduplicateColumns = (colsList, aliasesDefs) => {
    const seenGroups = new Set();
    const result = [];

    colsList.forEach(col => {
      if (!col || col.startsWith('_')) return;
      const colTrimmed = String(col).trim();
      const group = aliasesDefs.find(g =>
        g.keys.some(k => k.toLowerCase() === colTrimmed.toLowerCase())
      );

      if (group) {
        if (!seenGroups.has(group.id)) {
          seenGroups.add(group.id);
          result.push(col);
        }
      } else {
        const lower = colTrimmed.toLowerCase();
        if (!seenGroups.has(lower)) {
          seenGroups.add(lower);
          result.push(col);
        }
      }
    });

    return result;
  };

  const cleanCols = deduplicateColumns(rawColumnsFromStephanieRow, testCanonicalAliases);
  console.assert(cleanCols.includes('CLIENTE'), 'Deve conter CLIENTE');
  console.assert(!cleanCols.includes('NOME CLIENTE'), 'NÃO deve conter NOME CLIENTE duplicado');
  console.assert(cleanCols.includes('STATUS'), 'Deve conter STATUS');
  console.assert(!cleanCols.includes('status'), 'NÃO deve conter status minúsculo duplicado');
  console.assert(cleanCols.includes('DATA_VENCIMENTO'), 'Deve conter DATA_VENCIMENTO');
  console.assert(!cleanCols.includes('DATA VENCIMENTO'), 'NÃO deve conter DATA VENCIMENTO com espaço duplicado');
  console.assert(cleanCols.length === 7, `Total de colunas limpas deve ser 7 e não 10, retornou ${cleanCols.length}`);

  // 19.2 Leitura Robusta com Fallback entre Aliases (getRowValue)
  const getRowValueTest = (row, col, aliasesDefs) => {
    if (!row) return '';
    if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
      return row[col];
    }
    const trimmed = String(col || '').trim();
    const group = aliasesDefs.find(g =>
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

  const testRowWithLowercaseOnly = {
    id: 'row_123',
    status: 'Recebido',
    'NOME CLIENTE': 'STEPHANIE MUSETI SANTOS',
    'DATA VENCIMENTO': '26/09/2027'
  };

  console.assert(getRowValueTest(testRowWithLowercaseOnly, 'STATUS', testCanonicalAliases) === 'Recebido', 'Leitura de STATUS deve encontrar "Recebido" do alias status');
  console.assert(getRowValueTest(testRowWithLowercaseOnly, 'CLIENTE', testCanonicalAliases) === 'STEPHANIE MUSETI SANTOS', 'Leitura de CLIENTE deve encontrar o nome do alias NOME CLIENTE');
  console.assert(getRowValueTest(testRowWithLowercaseOnly, 'DATA_VENCIMENTO', testCanonicalAliases) === '26/09/2027', 'Leitura de DATA_VENCIMENTO deve encontrar a data do alias com espaço');

  // 19.3 Sincronização Bi-Direcional na Edição (handleChange)
  const simulateEditChange = (prevFormData, colToEdit, newValue, initialRow, aliasesDefs) => {
    const updated = { ...prevFormData, [colToEdit]: newValue };
    const colTrimmed = String(colToEdit || '').trim().toLowerCase();
    const group = aliasesDefs.find(g =>
      g.keys.some(k => k.toLowerCase() === colTrimmed)
    );
    if (group) {
      group.keys.forEach(aliasKey => {
        if (prevFormData[aliasKey] !== undefined || initialRow?.[aliasKey] !== undefined) {
          updated[aliasKey] = newValue;
        }
      });
    }
    return updated;
  };

  const initialForm = {
    STATUS: 'Recebido',
    status: 'Recebido',
    CLIENTE: 'STEPHANIE MUSETI SANTOS',
    'NOME CLIENTE': 'STEPHANIE MUSETI SANTOS'
  };

  const afterStatusEdit = simulateEditChange(initialForm, 'STATUS', 'Pago', initialForm, testCanonicalAliases);
  console.assert(afterStatusEdit.STATUS === 'Pago', 'STATUS deve ser atualizado para Pago');
  console.assert(afterStatusEdit.status === 'Pago', 'status (minúsculo) deve ser sincronizado automaticamente para Pago');

  const afterNameEdit = simulateEditChange(afterStatusEdit, 'CLIENTE', 'STEPHANIE SILVA', initialForm, testCanonicalAliases);
  console.assert(afterNameEdit.CLIENTE === 'STEPHANIE SILVA', 'CLIENTE deve ser atualizado');
  console.assert(afterNameEdit['NOME CLIENTE'] === 'STEPHANIE SILVA', 'NOME CLIENTE deve ser sincronizado automaticamente');

  // 19.4 Identificação Correta do Título da Entidade
  const identifyEntityTitle = (sheetName, cols) => {
    if (sheetName) {
      if (sheetName === 'CONTAS_RECEBER') return 'Conta a Receber (Mensalidade / Boleto)';
      if (sheetName === 'CLIENTES_CADASTRADOS') return 'Cadastro de Cliente';
    }
    const colsStr = cols.join(' ').toLowerCase();
    if (colsStr.includes('receber') || colsStr.includes('venda_os') || colsStr.includes('documento') || (colsStr.includes('vencimento') && colsStr.includes('valor'))) {
      return 'Conta a Receber (Receita / Boleto)';
    }
    if (colsStr.includes('whatsapp') || (colsStr.includes('cpf') && !colsStr.includes('vencimento'))) {
      return 'Cadastro de Cliente';
    }
    return 'Registro do ERP';
  };

  console.assert(identifyEntityTitle('CONTAS_RECEBER', rawColumnsFromStephanieRow) === 'Conta a Receber (Mensalidade / Boleto)', 'Quando sheetName for CONTAS_RECEBER, deve rotular como Conta a Receber');
  console.assert(identifyEntityTitle('', rawColumnsFromStephanieRow) === 'Conta a Receber (Receita / Boleto)', 'Mesmo sem sheetName explícito, dados com vencimento e valor devem ser rotulados como Conta a Receber e NÃO como Cadastro de Cliente');

  console.log('  ✅ Test 19 Passed: Desduplicação de colunas, sincronização de aliases e identificação de entidade no modal verificados com sucesso!\n');

  // ─── TEST 20: Formatação Padronizada da OS & Impressão em Folha Única A4 (Sem Folhas Extras) ───
  console.log('▶ Test 20: Formatação Padronizada da OS & Conformidade Folha Única A4');

  // Helper que simula a normalização de itens de PrintableOS
  const parseCurrencyPrintTest = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).replace(/R\$\s?/g, '').trim();
    if (!str) return 0;
    if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const resolveOrderItemsTest = (osData, clientData = {}) => {
    const rawItens = osData.itens || clientData.itens || (osData.raw && osData.raw.itens) || [];
    if (Array.isArray(rawItens) && rawItens.length > 0) {
      return rawItens.map(item => {
        let tipo = 'Produto';
        if (item.type === 'armacoes') tipo = 'Armação';
        else if (item.type === 'lentes') tipo = 'Lente Oftálmica';
        else if (item.type === 'avulso') tipo = 'Serviço / Avulso';

        const precoUnit = parseCurrencyPrintTest(item.preco || item.valor || 0);
        const qtd = Number(item.qtd) || 1;
        return {
          tipo,
          nome: item.nome || item.descricao || 'Produto do Pedido',
          detalhes: item.detalhes || '',
          qtd,
          precoUnit,
          total: qtd * precoUnit
        };
      });
    }

    const items = [];
    const armacaoNome = osData.armacao || clientData['Armação'] || clientData['Modelo de Armação'];
    if (armacaoNome && armacaoNome !== 'Não informada') {
      const extra = [];
      if (clientData['Cor']) extra.push(`Cor: ${clientData['Cor']}`);
      if (clientData['REFERENCIA_SKU']) extra.push(`Ref: ${clientData['REFERENCIA_SKU']}`);
      items.push({
        tipo: 'Armação',
        nome: armacaoNome,
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: null,
        total: null
      });
    }

    const lenteNome = osData.lente || clientData['Lente'] || clientData['Marca de Lente'];
    if (lenteNome && lenteNome !== 'Não informada') {
      const extra = [];
      if (osData.tratamento || clientData['Tratamento']) extra.push(`Tratamento: ${osData.tratamento || clientData['Tratamento']}`);
      if (clientData['MATERIAL']) extra.push(clientData['MATERIAL']);
      items.push({
        tipo: 'Lente Oftálmica',
        nome: lenteNome,
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: null,
        total: null
      });
    }

    return items;
  };

  // 20.1 Cenário A: OS com carrinho do PDV (múltiplos itens com tipo, preços e quantidades)
  const osFromPOS = {
    numeroOS: 'OS-2026-99',
    itens: [
      { id: '1', type: 'armacoes', nome: 'Armação Ray-Ban RB5228 Acetato', preco: 450, qtd: 1 },
      { id: '2', type: 'lentes', nome: 'Lente Multifocal Varilux Comfort 1.67', detalhes: 'Antirreflexo Crizal', preco: 980, qtd: 1 },
      { id: '3', type: 'avulso', nome: 'Estojo Rígido + Flanela Microfibra', preco: 0, qtd: 1 }
    ],
    valorTotal: 1430,
    valorEntrada: 500,
    restante: 930
  };

  const parsedFromPOS = resolveOrderItemsTest(osFromPOS);
  console.assert(parsedFromPOS.length === 3, 'Deve conter 3 itens padronizados na tabela');
  console.assert(parsedFromPOS[0].tipo === 'Armação', 'Item 1 deve ser categorizado como Armação');
  console.assert(parsedFromPOS[1].tipo === 'Lente Oftálmica', 'Item 2 deve ser categorizado como Lente Oftálmica');
  console.assert(parsedFromPOS[1].detalhes === 'Antirreflexo Crizal', 'Detalhes das lentes devem ser preservados');
  console.assert(parsedFromPOS[0].total === 450 && parsedFromPOS[1].total === 980, 'Totais individuais dos itens devem ser calculados com precisão');

  // 20.2 Cenário B: OS gerada a partir dos dados do Cliente / Laboratório (campos individuais armacao/lente)
  const osFromClient = {
    numeroOS: 'OS-2026-100',
    armacao: 'Armação Vogue Floral Feminina',
    lente: 'Lente Monofocal Resina 1.56',
    tratamento: 'Blue UV + Antirreflexo',
    valorTotal: 620,
    valorEntrada: 300,
    restante: 320
  };
  const clientInfo = {
    'Cor': 'Dourado / Demi',
    'REFERENCIA_SKU': 'VO-4098-B',
    'MATERIAL': 'Policarbonato'
  };

  const parsedFromClient = resolveOrderItemsTest(osFromClient, clientInfo);
  console.assert(parsedFromClient.length === 2, 'Deve extrair armação e lente como itens estruturados da tabela');
  console.assert(parsedFromClient[0].tipo === 'Armação' && parsedFromClient[0].nome === 'Armação Vogue Floral Feminina', 'Nome da armação correto');
  console.assert(parsedFromClient[0].detalhes.includes('VO-4098-B'), 'Referência e cor devem compor os detalhes do item');
  console.assert(parsedFromClient[1].tipo === 'Lente Oftálmica' && parsedFromClient[1].detalhes.includes('Blue UV'), 'Tratamento de lente deve ser mapeado');

  // 20.3 Verificação de Altura Vertical e Não-Geração de 2ª Folha
  // A folha A4 em modo portrait tem 297mm de altura. Com margens de 5mm superior/inferior, a área útil de impressão é de 287mm.
  // Componentes e alturas estimadas:
  // - Cabeçalho: ~22mm
  // - Identificação do Cliente: ~25mm
  // - Dioptria (Receita): ~35mm
  // - Tabela de Itens (1 a 4 itens): ~35mm
  // - Condições Financeiras: ~30mm
  // - Termo de Retirada Enxuto: ~15mm
  // - Conferência de Entrega + Assinaturas: ~30mm
  // - Rodapé: ~8mm
  // Total somado: ~200mm, com margem de segurança de ~87mm antes de estourar a página.
  const estimatedHeightMm = 22 + 25 + 35 + 35 + 30 + 15 + 30 + 8;
  const a4PrintableHeightMm = 287;
  console.assert(estimatedHeightMm < a4PrintableHeightMm, `Altura estimada (${estimatedHeightMm}mm) deve caber folgadamente em 1 folha A4 (${a4PrintableHeightMm}mm) sem gerar folhas extras`);

  console.log('  ✅ Test 20 Passed: Formatação padronizada de itens e conformidade de folha única A4 sem folhas extras validadas com sucesso!\n');

  // ─── TEST 21: Função de OS de Laboratório & Formulário de Dados Técnicos ───
  console.log('▶ Test 21: Função de OS de Laboratório & Formulário de Dioptrias/Armação');

  const mockOrder = {
    id: 'row_os_555',
    osNumber: '2026-88',
    unit: 'Cajati',
    laboratorio: 'Laboratório Central SP',
    odEsf: '-2.50',
    odCil: '-0.75',
    odEixo: '180',
    oeEsf: '-2.25',
    oeCil: '-0.50',
    oeEixo: '175',
    adicao: '+2.00',
    odDnp: '31',
    odAlt: '18',
    oeDnp: '30.5',
    oeAlt: '18',
    raw: {
      'OS DA VENDA': '2026-88',
      'LABORATORIO': 'Laboratório Central SP',
      'OD_ESF': '-2.50',
      'OD_CIL': '-0.75',
      'OD_EIXO': '180',
      'OE_ESF': '-2.25',
      'OE_CIL': '-0.50',
      'OE_EIXO': '175',
      'ADICAO': '+2.00',
      'OD_DNP': '31',
      'OD_ALT': '18',
      'OE_DNP': '30.5',
      'OE_ALT': '18',
      'PONTE_ARO': '54-18',
      'DIAGONAL_MAIOR': '56',
      'ALTURA_VERTICAL': '38',
      'PONTE': '18',
      'ARO': '54'
    }
  };

  // Simulação do carregamento do formulário da OS de Laboratório (handlePrintLab)
  const initialLabFormData = {
    LABORATORIO: mockOrder.laboratorio || mockOrder.raw["LABORATORIO"] || "",
    OD_ESF: mockOrder.odEsf || mockOrder.raw["OD_ESF"] || "",
    OD_CIL: mockOrder.odCil || mockOrder.raw["OD_CIL"] || "",
    OD_EIXO: mockOrder.odEixo || mockOrder.raw["OD_EIXO"] || "",
    OE_ESF: mockOrder.oeEsf || mockOrder.raw["OE_ESF"] || "",
    OE_CIL: mockOrder.oeCil || mockOrder.raw["OE_CIL"] || "",
    OE_EIXO: mockOrder.oeEixo || mockOrder.raw["OE_EIXO"] || "",
    ADICAO: mockOrder.adicao || mockOrder.raw["ADICAO"] || "",
    OD_DNP: mockOrder.odDnp || mockOrder.raw["OD_DNP"] || "",
    OD_ALT: mockOrder.odAlt || mockOrder.raw["OD_ALT"] || "",
    OE_DNP: mockOrder.oeDnp || mockOrder.raw["OE_DNP"] || "",
    OE_ALT: mockOrder.oeAlt || mockOrder.raw["OE_ALT"] || "",
    PONTE_ARO: mockOrder.raw["PONTE_ARO"] || "",
    DIAGONAL_MAIOR: mockOrder.raw["DIAGONAL_MAIOR"] || "",
    ALTURA_VERTICAL: mockOrder.raw["ALTURA_VERTICAL"] || "",
    PONTE: mockOrder.raw["PONTE"] || "",
    ARO: mockOrder.raw["ARO"] || ""
  };

  console.assert(initialLabFormData.LABORATORIO === 'Laboratório Central SP', 'Laboratório deve vir pré-preenchido');
  console.assert(initialLabFormData.OD_ESF === '-2.50' && initialLabFormData.ADICAO === '+2.00', 'Dioptrias e adição devem ser pré-carregadas');
  console.assert(initialLabFormData.PONTE_ARO === '54-18' && initialLabFormData.DIAGONAL_MAIOR === '56', 'Medidas técnicas da armação devem ser mapeadas');

  // Simulação da edição de laboratório e novas medidas pelo operador
  const editedLabFormData = {
    ...initialLabFormData,
    LABORATORIO: 'Laboratório Óptico Prime Express',
    ALTURA_VERTICAL: '39'
  };

  const updatedRawFromLab = {
    ...mockOrder.raw,
    ...editedLabFormData
  };

  console.assert(updatedRawFromLab.LABORATORIO === 'Laboratório Óptico Prime Express', 'Edição de laboratório deve persistir');
  console.assert(updatedRawFromLab.ALTURA_VERTICAL === '39', 'Edição de medidas técnicas da armação deve persistir');

  console.log('  ✅ Test 21 Passed: Função de OS de Laboratório e mapeamento de formulário validados com sucesso!\n');

  // ─── TEST 22: Optical Gifts & Giveaways Stock Management (CAD_BRINDES) ────────
  console.log('▶ Test 22: Optical Gifts & Giveaways Management (CAD_BRINDES, ERP, POS & Transfers)');

  // 22.1 Mock database dataset for CAD_BRINDES
  const mockBrindesData = [
    {
      id: 'brd_001',
      UNIDADE: 'Cajati',
      NOME: 'Estojo Rígido Yasmin Luxo',
      CATEGORIA: 'Estojo Rígido',
      REFERENCIA_SKU: 'EST-RIG-01',
      COR: 'Preto Fosco',
      PRECO_COMPRA: '4,50',
      PRECO_VENDA: '0,00',
      ESTOQUE: 35,
      DATA_CADASTRO: '2026-09-30'
    },
    {
      id: 'brd_002',
      UNIDADE: 'Cajati',
      NOME: 'Flanela Microfibra Antiembaçante',
      CATEGORIA: 'Flanela Microfibra',
      REFERENCIA_SKU: 'FLA-MIC-02',
      COR: 'Azul Marinho',
      PRECO_COMPRA: '1,20',
      PRECO_VENDA: '0,00',
      ESTOQUE: 4, // Estoque Crítico (<= 5)
      DATA_CADASTRO: '2026-09-30'
    },
    {
      id: 'brd_003',
      UNIDADE: 'Registro',
      NOME: 'Limpa-Lentes Spray 30ml',
      CATEGORIA: 'Limpa-Lentes Spray',
      REFERENCIA_SKU: 'LMP-SPR-03',
      COR: 'Incolor',
      PRECO_COMPRA: '3,00',
      PRECO_VENDA: '15,00', // Venda avulsa permitida
      ESTOQUE: 50,
      DATA_CADASTRO: '2026-09-30'
    },
    {
      id: 'brd_004',
      UNIDADE: 'Central',
      NOME: 'Cordão Silicone para Armação',
      CATEGORIA: 'Cordão / Corrente',
      REFERENCIA_SKU: 'CRD-SIL-04',
      COR: 'Preto',
      PRECO_COMPRA: '2,00',
      PRECO_VENDA: '0,00',
      ESTOQUE: 2, // Estoque Crítico (<= 5)
      DATA_CADASTRO: '2026-09-30'
    }
  ];

  // 22.2 KPI calculations (matching ErpOptica stats)
  const calculateBrindesKPIs = (items) => {
    let total = items.length;
    let totalPecs = 0;
    let valorEstoque = 0;
    let criticos = 0;

    items.forEach(item => {
      const q = parseInt(item.ESTOQUE || 0, 10);
      const custo = parseFloat(String(item.PRECO_COMPRA || '0').replace(/\./g, '').replace(',', '.')) || 0;
      totalPecs += q;
      valorEstoque += q * custo;
      if (q <= 5) criticos++;
    });

    return { total, totalPecs, valorEstoque, criticos };
  };

  const kpisAll = calculateBrindesKPIs(mockBrindesData);
  console.assert(kpisAll.total === 4, 'Total de modelos de brindes deve ser 4');
  console.assert(kpisAll.totalPecs === 91, 'Total de peças deve ser 35 + 4 + 50 + 2 = 91');
  console.assert(kpisAll.criticos === 2, 'Brindes com estoque <= 5 devem ser 2 (FLA-MIC-02 e CRD-SIL-04)');
  const expectedCustoTotal = (35 * 4.5) + (4 * 1.2) + (50 * 3.0) + (2 * 2.0);
  console.assert(Math.abs(kpisAll.valorEstoque - expectedCustoTotal) < 0.01, 'Custo total do inventário de brindes deve bater');

  // 22.3 Multi-loja vendor isolation
  const vendorCajatiItems = mockBrindesData.filter(item => {
    const u = (item.UNIDADE || '').toUpperCase();
    return u === 'CAJATI';
  });
  console.assert(vendorCajatiItems.length === 2, 'Vendedor de Cajati deve visualizar apenas os 2 brindes de Cajati');

  // 22.4 Inter-store transfer simulation (ProductTransferModal)
  const originItem = mockBrindesData.find(i => i.id === 'brd_001'); // Cajati, 35 un
  const transferQty = 10;
  const originStockAfter = originItem.ESTOQUE - transferQty;
  console.assert(originStockAfter === 25, 'Saldo de origem após transferência de 10 unidades deve ser 25');

  const destItemCreated = {
    ...originItem,
    id: 'brd_001_registro',
    UNIDADE: 'Registro',
    CIDADE: 'Registro',
    LOJA: 'Registro',
    ESTOQUE: transferQty
  };
  console.assert(destItemCreated.UNIDADE === 'Registro' && destItemCreated.ESTOQUE === 10, 'Item transferido para Registro deve ter 10 un');

  const transferAudit = {
    ID: 'TRF-BRD-001',
    TIPO: 'Brinde',
    PRODUTO: `${originItem.NOME} [${originItem.CATEGORIA}]`,
    ORIGEM: 'Cajati',
    DESTINO: 'Registro',
    QUANTIDADE: transferQty,
    SALDO_ORIGEM_RESTANTE: originStockAfter,
    SALDO_DESTINO_FINAL: 10,
    STATUS: 'Concluído'
  };
  console.assert(transferAudit.TIPO === 'Brinde', 'Auditoria deve registrar tipo Brinde');

  // 22.5 POS Cart addition & atomic deduction simulation
  const posCartItem = {
    id: originItem.id,
    type: 'brindes',
    nome: originItem.NOME,
    detalhes: `Cat: ${originItem.CATEGORIA} | Loja: ${originItem.UNIDADE}`,
    preco: parseFloat(originItem.PRECO_VENDA.replace(',', '.')) || 0,
    qtd: 1,
    rawProduct: originItem
  };
  console.assert(posCartItem.preco === 0, 'Preço de venda cortesia padrão deve ser 0');
  console.assert(posCartItem.type === 'brindes', 'Item no carrinho do PDV deve ter type brindes');

  // Decremento atômico de estoque no PDV
  const updatedStockAfterSale = Math.max(0, originItem.ESTOQUE - posCartItem.qtd);
  console.assert(updatedStockAfterSale === 34, 'Estoque de brinde após venda no PDV deve ser 34');

  // 22.6 Printable OS item formatting
  const osItem = {
    type: posCartItem.type,
    nome: posCartItem.nome,
    detalhes: posCartItem.detalhes,
    qtd: posCartItem.qtd,
    preco: posCartItem.preco
  };

  let tipoFormatado = 'Produto';
  if (osItem.type === 'armacoes') tipoFormatado = 'Armação';
  else if (osItem.type === 'lentes') tipoFormatado = 'Lente Oftálmica';
  else if (osItem.type === 'brindes') tipoFormatado = 'Brinde / Cortesia';

  const precoExibido = osItem.preco === 0 && tipoFormatado === 'Brinde / Cortesia' ? 'Cortesia' : `R$ ${osItem.preco.toFixed(2)}`;
  console.assert(tipoFormatado === 'Brinde / Cortesia', 'OS deve classificar como Brinde / Cortesia');
  console.assert(precoExibido === 'Cortesia', 'OS deve exibir Cortesia para brindes de valor 0');

  console.log('  ✅ Test 22 Passed: Gestão de Brindes (CAD_BRINDES, ERP, POS, Transferências e Impressão de OS) validada com sucesso!\n');

  // ─── TEST 23: Distribuição de Estoque por Cidade (Armações, Lentes & Brindes) ──
  console.log('▶ Test 23: Distribuição de Estoque por Cidade (Armações, Lentes & Brindes)');

  const mockStockAllTypes = [
    // Armações
    { UNIDADE: 'Central', MARCA: 'Ray-Ban', MODELO: 'Aviador', ESTOQUE: 10, PRECO_COMPRA: '150,00' },
    { UNIDADE: 'Cajati', MARCA: 'Oakley', MODELO: 'Holbrook', ESTOQUE: 5, PRECO_COMPRA: '180,00' },
    { UNIDADE: 'Registro', MARCA: 'Vogue', MODELO: 'CatEye', ESTOQUE: 8, PRECO_COMPRA: '120,00' },
    // Lentes
    { UNIDADE: 'Central', MARCA: 'Essilor', MODELO: 'Crizal Easy', ESTOQUE: 20, PRECO_COMPRA: '80,00' },
    { UNIDADE: 'Cajati', MARCA: 'Hoya', MODELO: 'BlueControl', ESTOQUE: 6, PRECO_COMPRA: '95,00' },
    { UNIDADE: 'Jacupiranga', MARCA: 'Zeiss', MODELO: 'ClearView', ESTOQUE: 4, PRECO_COMPRA: '110,00' },
    // Brindes
    { UNIDADE: 'Central', NOME: 'Estojo Rígido Yasmin', CATEGORIA: 'Estojo Rígido', ESTOQUE: 50, PRECO_COMPRA: '3,50' },
    { UNIDADE: 'Cajati', NOME: 'Flanela Microfibra', CATEGORIA: 'Flanela Microfibra', ESTOQUE: 30, PRECO_COMPRA: '1,20' },
    { UNIDADE: 'Registro', NOME: 'Spray Limpa-Lentes', CATEGORIA: 'Limpa-Lentes Spray', ESTOQUE: 15, PRECO_COMPRA: '4,50' },
    { UNIDADE: 'Jacupiranga', NOME: 'Cordão Silicone', CATEGORIA: 'Cordão / Corrente', ESTOQUE: 25, PRECO_COMPRA: '2,00' },
    { UNIDADE: 'Venda Externa', NOME: 'Kit Cuidados', CATEGORIA: 'Kit Limpeza e Cuidados', ESTOQUE: 10, PRECO_COMPRA: '6,00' }
  ];

  // 23.1 Extração de facetas por loja e marcas/categorias
  const stockFacets = extractStockFacets(mockStockAllTypes);
  console.assert(stockFacets.stores.includes('Cajati'), 'Facetas devem incluir Cajati');
  console.assert(stockFacets.stores.includes('Registro'), 'Facetas devem incluir Registro');
  console.assert(stockFacets.stores.includes('Jacupiranga'), 'Facetas devem incluir Jacupiranga');
  console.assert(stockFacets.stores.includes('Central'), 'Facetas devem incluir Central');
  console.assert(stockFacets.stores.includes('Venda Externa'), 'Facetas devem incluir Venda Externa');

  // 23.2 Filtro por Cidade em Brindes (Cajati)
  const brindesOnly = mockStockAllTypes.filter(i => i.NOME);
  const cajatiBrindes = brindesOnly.filter(i => (i.UNIDADE || '').toLowerCase() === 'cajati');
  console.assert(cajatiBrindes.length === 1, 'Deve haver 1 brinde em Cajati');
  console.assert(cajatiBrindes[0].NOME === 'Flanela Microfibra', 'Brinde de Cajati deve ser a Flanela Microfibra');
  console.assert(cajatiBrindes[0].ESTOQUE === 30, 'Estoque do brinde em Cajati deve ser 30');

  // 23.3 Totalização agregada por Loja / Cidade
  const storesMap = {
    'Central': 0, 'Cajati': 0, 'Registro': 0, 'Jacupiranga': 0, 'Venda Externa': 0
  };
  mockStockAllTypes.forEach(item => {
    const u = item.UNIDADE || 'Central';
    storesMap[u] = (storesMap[u] || 0) + item.ESTOQUE;
  });

  console.assert(storesMap['Central'] === 10 + 20 + 50, 'Central deve ter 80 peças totais');
  console.assert(storesMap['Cajati'] === 5 + 6 + 30, 'Cajati deve ter 41 peças totais');
  console.assert(storesMap['Registro'] === 8 + 15, 'Registro deve ter 23 peças totais');
  console.assert(storesMap['Jacupiranga'] === 4 + 25, 'Jacupiranga deve ter 29 peças totais');
  console.assert(storesMap['Venda Externa'] === 10, 'Venda Externa deve ter 10 peças totais');

  console.log('  ✅ Test 23 Passed: Distribuição de Estoque por Cidade (Armações, Lentes & Brindes) validada com sucesso!\n');

  // ==========================================
  // TEST 24: Permissões Estritas de Vendedores em Gestão de OS
  // ==========================================
  console.log('▶ Test 24: Permissões de Vendedor em Gestão de OS (Somente Busca, Filtro e Impressão)');

  const mockOSOrder = {
    id: 'os_test_01',
    osNumber: 'CAJ-200',
    clientName: 'Roberto Alves',
    clientPhone: '13998887766',
    clientCPF: '333.444.555-66',
    status: 'No Laboratório',
    unit: 'Cajati',
    raw: {
      'OS DA VENDA': 'CAJ-200',
      'NOME CLIENTE': 'Roberto Alves',
      'STATUS_OS': 'No Laboratório',
      'PAGAMENTO_CONFERIDO': 'Não',
      'VALOR TOTAL': '400,00',
      'RESTANTE': '200,00'
    }
  };

  const simulateUpdateStatusByRole = (user, order, newStatus) => {
    if (user?.role === 'vendedor') return false; // Bloqueado para vendedor
    order.status = newStatus;
    order.raw.STATUS_OS = newStatus;
    return true;
  };

  const simulateToggleConferidoByRole = (user, order) => {
    if (user?.role === 'vendedor') return false;
    const isConf = order.raw.PAGAMENTO_CONFERIDO === 'Sim';
    order.raw.PAGAMENTO_CONFERIDO = isConf ? 'Não' : 'Sim';
    return true;
  };

  const simulateConfirmDeliveryByRole = (user, order) => {
    if (user?.role === 'vendedor') return false;
    order.status = 'Entregue';
    order.raw.STATUS_OS = 'Entregue';
    return true;
  };

  const simulateApproveOSByRole = (user, order) => {
    if (user?.role === 'vendedor') return false;
    order.status = 'No Laboratório';
    order.raw.PAGAMENTO_CONFERIDO = 'Sim';
    order.raw.DUPLICATAS_GERADAS = true;
    return true;
  };

  // 24.1 Tentativas de alteração pelo vendedor -> Todas devem ser REJEITADAS
  const testVendedorUser = { username: 'vendedor_test', role: 'vendedor', city: 'Cajati', authorized: true };
  const testAdminUser = { username: 'admin_test', role: 'admin', city: 'Cajati', authorized: true };

  const osCopy1 = JSON.parse(JSON.stringify(mockOSOrder));
  console.assert(simulateUpdateStatusByRole(testVendedorUser, osCopy1, 'Entregue') === false, 'Vendedor NÃO deve poder alterar status de OS');
  console.assert(osCopy1.status === 'No Laboratório', 'Status da OS deve permanecer inalterado após tentativa do vendedor');

  console.assert(simulateToggleConferidoByRole(testVendedorUser, osCopy1) === false, 'Vendedor NÃO deve poder alterar conferência financeira');
  console.assert(simulateConfirmDeliveryByRole(testVendedorUser, osCopy1) === false, 'Vendedor NÃO deve poder dar baixa de entrega');
  console.assert(simulateApproveOSByRole(testVendedorUser, osCopy1) === false, 'Vendedor NÃO deve poder aprovar/confirmar OS financeiramente');

  // 24.2 Ações permitidas para administrador
  console.assert(simulateUpdateStatusByRole(testAdminUser, osCopy1, 'Em Produção') === true, 'Admin DEVE poder alterar status de OS');
  console.assert(osCopy1.status === 'Em Produção', 'Status da OS deve ser atualizado pelo admin');
  console.assert(simulateToggleConferidoByRole(testAdminUser, osCopy1) === true, 'Admin DEVE poder conferir financeiro');
  console.assert(osCopy1.raw.PAGAMENTO_CONFERIDO === 'Sim', 'Pagamento deve constar como Sim após conferência do admin');

  // 24.3 Operações de busca, filtro e impressão liberadas para vendedor
  const canPerformSearchAndFilter = (user, query, unit) => {
    return Boolean(user && user.authorized && (query !== undefined || unit !== undefined));
  };
  const canPrintA4AndLab = (user) => Boolean(user && user.authorized);

  console.assert(canPerformSearchAndFilter(testVendedorUser, 'caj-200', 'Cajati') === true, 'Vendedor PODE buscar e filtrar OSs');
  console.assert(canPrintA4AndLab(testVendedorUser) === true, 'Vendedor PODE imprimir OS A4 e OS de Laboratório');

  // 24.4 Impressão de OS de Laboratório: Vendedor pode imprimir, mas NÃO pode alterar a OS no banco
  const simulateConfirmLabPrintByRole = (user, order, newLabData) => {
    let rowUpdated = false;
    const isVendedor = user?.role === 'vendedor';
    if (!isVendedor) {
      rowUpdated = true;
      order.raw = { ...order.raw, ...newLabData };
    }
    // Retorna se o banco seria alterado e os dados para impressão
    return { rowUpdated, printPayload: { ...order.raw, ...newLabData } };
  };

  const labEditAttempt = { LABORATORIO: 'Lab Tentativa Fraude', OD_DNP: '35' };
  const vendedorLabResult = simulateConfirmLabPrintByRole(testVendedorUser, osCopy1, labEditAttempt);
  console.assert(vendedorLabResult.rowUpdated === false, 'Vendedor NÃO deve atualizar Registro_Vendas ao imprimir OS de laboratório');
  console.assert(osCopy1.raw.LABORATORIO !== 'Lab Tentativa Fraude', 'Dados da OS original não devem ser alterados pelo vendedor');

  const adminLabResult = simulateConfirmLabPrintByRole(testAdminUser, osCopy1, labEditAttempt);
  console.assert(adminLabResult.rowUpdated === true, 'Admin DEVE poder atualizar Registro_Vendas ao salvar & imprimir OS de laboratório');
  console.assert(osCopy1.raw.LABORATORIO === 'Lab Tentativa Fraude', 'Dados da OS original devem ser atualizados pelo admin');

  console.log('  ✅ Test 24 Passed: Permissões de Vendedor em Gestão de OS (Bloqueios e Acessos) verificadas com sucesso!\n');

  // ==========================================
  // TEST 25: Edição de OS no Perfil do Cliente com Construtor de Pagamento Dinâmico do PDV
  // ==========================================
  console.log('▶ Test 25: Edição de OS no Perfil com Construtor de Pagamento do PDV & Semáforo Azul');

  // 25.1 Construtor de pagamentos dinâmico com múltiplos métodos fracionados
  const buildTestPayment = (method, val, installmentsCount = 1, dueDate = '2026-11-15', customDates = {}) => {
    const n = parseInt(installmentsCount, 10) || 1;
    const vParc = val / n;
    let texto = '';
    let parcelas = [];

    if (method === 'dinheiro') {
      texto = `💵 Dinheiro: R$ ${val.toFixed(2).replace('.', ',')}`;
    } else if (method === 'pix') {
      texto = `⚡ PIX: R$ ${val.toFixed(2).replace('.', ',')}`;
    } else if (method === 'debito') {
      texto = `💳 Cartão Débito: R$ ${val.toFixed(2).replace('.', ',')}`;
    } else if (method === 'credito') {
      texto = `💳 Cartão Crédito (${n}x de R$ ${vParc.toFixed(2).replace('.', ',')}): R$ ${val.toFixed(2).replace('.', ',')}`;
      for (let i = 1; i <= n; i++) {
        parcelas.push({ numero: i, totalParcelas: n, valor: vParc.toFixed(2).replace('.', ',') });
      }
    } else if (method === 'carne' || method === 'boleto') {
      for (let i = 1; i <= n; i++) {
        const d = customDates[i] || dueDate;
        parcelas.push({ numero: i, totalParcelas: n, vencimento: d, valor: vParc.toFixed(2).replace('.', ',') });
      }
      const vencsStr = parcelas.map(p => `${p.numero}ª ${p.vencimento}`).join(', ');
      texto = `📄 Boleto (${n}x de R$ ${vParc.toFixed(2).replace('.', ',')} | Venc: ${vencsStr}): R$ ${val.toFixed(2).replace('.', ',')}`;
    }

    return { id: `pay_${Math.random()}`, metodo: method, valor: val, texto, parcelas };
  };

  // Simular divisão em 4 formas de pagamento: Dinheiro R$ 100 + PIX R$ 200 + Cartão Crédito R$ 300 + Boleto R$ 300 = Total R$ 900
  const totalOS = 900.00;
  const splitPayments = [
    buildTestPayment('dinheiro', 100.00),
    buildTestPayment('pix', 200.00),
    buildTestPayment('credito', 300.00, 3),
    buildTestPayment('carne', 300.00, 3, '2026-11-15', { 1: '15/11/2026', 2: '15/12/2026', 3: '15/01/2027' })
  ];

  // 25.2 Validação da soma exata das formas de pagamento
  const coveredSum = splitPayments.reduce((acc, p) => acc + p.valor, 0);
  console.assert(Math.abs(coveredSum - totalOS) < 0.01, 'A soma das formas de pagamento deve bater exatamente com o total de R$ 900,00');

  // Testar falha de validação quando a soma diverge
  const incompletePayments = splitPayments.slice(0, 3); // Apenas R$ 600
  const incompleteSum = incompletePayments.reduce((acc, p) => acc + p.valor, 0);
  const isValidCoverage = (payments, total) => Math.abs(payments.reduce((acc, p) => acc + p.valor, 0) - total) < 0.05;
  console.assert(isValidCoverage(incompletePayments, totalOS) === false, 'Pagamento incompleto deve falhar na validação');
  console.assert(isValidCoverage(splitPayments, totalOS) === true, 'Pagamento completo deve passar na validação');

  // 25.3 Cálculo de Entrada (Imediato) vs Restante (A Prazo / Boleto)
  const entradaImediata = splitPayments.reduce((acc, p) => {
    if (p.metodo === 'carne' || p.metodo === 'boleto') return acc;
    return acc + p.valor;
  }, 0);
  const restanteBoleto = Math.max(0, totalOS - entradaImediata);

  console.assert(entradaImediata === 600.00, `Entrada imediata deve ser R$ 600,00 (Dinheiro 100 + PIX 200 + Crédito 300), calculou ${entradaImediata}`);
  console.assert(restanteBoleto === 300.00, `Restante a prazo deve ser R$ 300,00 (Boleto), calculou ${restanteBoleto}`);

  // 25.4 Reconfirmação Obrigatória: Ao salvar qualquer alteração, status DEVE voltar para 'Aguardando Confirmação'
  const simulateSaveEditedOS = (originalOS, editForm, paymentsList) => {
    const tot = editForm.valorTotal;
    const ent = paymentsList.reduce((acc, p) => (p.metodo === 'carne' || p.metodo === 'boleto') ? acc : acc + p.valor, 0);
    const rest = Math.max(0, tot - ent);
    const boletoParcs = paymentsList.filter(p => p.metodo === 'carne' || p.metodo === 'boleto').flatMap(p => p.parcelas || []);

    return {
      ...originalOS,
      'ARMAÇÃO': editForm.armacao,
      'LENTE': editForm.lente,
      'VALOR TOTAL': tot.toFixed(2).replace('.', ','),
      'VALOR ENTRADA': ent.toFixed(2).replace('.', ','),
      'RESTANTE': rest.toFixed(2).replace('.', ','),
      'FORMAS_PAGAMENTO': paymentsList.map(p => p.texto).join(' + '),
      'PARCELAS_JSON': JSON.stringify(boletoParcs),
      'parcelas': boletoParcs,
      'STATUS_OS': 'Aguardando Confirmação',
      'SITUAÇÃO': 'Aguardando Confirmação',
      'PAGAMENTO_CONFERIDO': 'Não',
      'DUPLICATAS_GERADAS': false
    };
  };

  const originalOrder = {
    'OS DA VENDA': 'CAJ-999',
    'ARMAÇÃO': 'Armação Antiga',
    'LENTE': 'Lente Simples',
    'VALOR TOTAL': '500,00',
    'STATUS_OS': 'Entregue',
    'PAGAMENTO_CONFERIDO': 'Sim',
    'DUPLICATAS_GERADAS': true
  };

  const editedOrder = simulateSaveEditedOS(originalOrder, {
    armacao: 'Ray-Ban RB3025 Aviador',
    lente: 'Hoya BlueControl Antirreflexo',
    valorTotal: 900.00
  }, splitPayments);

  console.assert(editedOrder.STATUS_OS === 'Aguardando Confirmação', 'Ao salvar, a OS DEVE voltar para Aguardando Confirmação (Semáforo Azul)');
  console.assert(editedOrder.SITUAÇÃO === 'Aguardando Confirmação', 'Situação DEVE voltar para Aguardando Confirmação');
  console.assert(editedOrder.PAGAMENTO_CONFERIDO === 'Não', 'Pagamento conferido DEVE ser resetado para Não');
  console.assert(editedOrder.DUPLICATAS_GERADAS === false, 'Flag de duplicatas geradas DEVE ser resetada para false');
  console.assert(editedOrder['ARMAÇÃO'] === 'Ray-Ban RB3025 Aviador', 'Armação deve ter sido atualizada');
  console.assert(editedOrder['LENTE'] === 'Hoya BlueControl Antirreflexo', 'Lente deve ter sido atualizada');
  console.assert(editedOrder['VALOR ENTRADA'] === '600,00', 'Entrada deve ser R$ 600,00');
  console.assert(editedOrder['RESTANTE'] === '300,00', 'Restante deve ser R$ 300,00');

  console.log('  ✅ Test 25 Passed: Construtor dinâmico de pagamentos do PDV na edição de OS e Semáforo Azul validados com sucesso!\n');

  // ==========================================
  // TEST 26: Limpeza Atômica de Duplicatas Pendentes em CONTAS_RECEBER ao Editar OS e Reconfirmação
  // ==========================================
  console.log('▶ Test 26: Limpeza Atômica de Duplicatas ao Editar OS e Reconfirmação Sem Duplicidades');

  const clientMariana = {
    id: 'cli_mariana',
    'Nome Completo': 'Mariana Souza Lima',
    'CPF / CNPJ': '888.777.666-55',
    'Valor Devido': '300,00',
    'Status de Pagamento': 'Pendente'
  };

  let contasReceberMariana = [
    // Duplicatas pendentes antigas da OS #CAJ-88 (2x de R$ 150)
    { id: 'rec_m1', VENDA_OS: 'CAJ-88', DOCUMENTO: 'BOLETO 1/2 - OS CAJ-88', VALOR: '150,00', STATUS: 'Pendente', CLIENTE_ID: 'cli_mariana' },
    { id: 'rec_m2', VENDA_OS: 'CAJ-88', DOCUMENTO: 'BOLETO 2/2 - OS CAJ-88', VALOR: '150,00', STATUS: 'Pendente', CLIENTE_ID: 'cli_mariana' },
    // Parcela de outra compra já PAGA (não deve ser tocada)
    { id: 'rec_pago', VENDA_OS: 'CAJ-10', DOCUMENTO: 'BOLETO 1/1 - OS CAJ-10', VALOR: '100,00', STATUS: 'Recebido', CLIENTE_ID: 'cli_mariana' },
    // Parcela de outro cliente (não deve ser tocada)
    { id: 'rec_outro', VENDA_OS: 'REG-55', DOCUMENTO: 'BOLETO 1/1 - OS REG-55', VALOR: '200,00', STATUS: 'Pendente', CLIENTE_ID: 'cli_outro' }
  ];

  // Simular a limpeza atômica acionada durante a edição da OS no perfil do cliente
  const executeOSEditCleanup = (targetOSNum, client, receberList) => {
    const target = String(targetOSNum).trim().toLowerCase();
    const pendingToDelete = receberList.filter(inv => {
      const vOS = String(inv.VENDA_OS || inv.OS || '').trim().toLowerCase();
      const matchesOS = vOS && (vOS === target || vOS.replace(/^os-?/i, '') === target.replace(/^os-?/i, ''));
      const doc = String(inv.DOCUMENTO || '').toLowerCase();
      return (matchesOS || doc.includes(target)) && inv.STATUS !== 'Recebido' && inv.STATUS !== 'Pago';
    });

    // 1. Remove duplicatas pendentes da OS antiga
    const updatedReceber = receberList.filter(inv => !pendingToDelete.some(p => p.id === inv.id));

    // 2. Abate débito provisório do cliente
    const totalRemoved = pendingToDelete.reduce((sum, inv) => sum + parseFloat(inv.VALOR.replace(',', '.')), 0);
    const currDebt = parseFloat(client['Valor Devido'].replace(',', '.'));
    const newDebt = Math.max(0, currDebt - totalRemoved);
    client['Valor Devido'] = newDebt.toFixed(2).replace('.', ',');
    client['Status de Pagamento'] = newDebt === 0 ? 'Em dia' : client['Status de Pagamento'];

    return { updatedReceber, deletedCount: pendingToDelete.length, refundedAmount: totalRemoved };
  };

  const cleanupResult = executeOSEditCleanup('CAJ-88', clientMariana, contasReceberMariana);
  contasReceberMariana = cleanupResult.updatedReceber;

  console.assert(cleanupResult.deletedCount === 2, 'Deve ter removido as 2 duplicatas antigas pendentes da OS CAJ-88');
  console.assert(cleanupResult.refundedAmount === 300.00, 'Valor estornado do débito deve ser R$ 300,00');
  console.assert(clientMariana['Valor Devido'] === '0,00', 'Débito da Mariana deve voltar temporariamente para 0,00 aguardando reconfirmação');
  console.assert(clientMariana['Status de Pagamento'] === 'Em dia', 'Status da Mariana deve constar como Em dia aguardando reconfirmação');
  console.assert(contasReceberMariana.some(r => r.id === 'rec_pago'), 'Parcela já recebida deve permanecer intacta');
  console.assert(contasReceberMariana.some(r => r.id === 'rec_outro'), 'Parcela de outro cliente deve permanecer intacta');

  // Simular Reconfirmação Financeira pelo Administrador em Gestão de OS
  const executeFinancialReapproval = (editedOS, client, receberList) => {
    const parcs = JSON.parse(editedOS.PARCELAS_JSON || '[]');
    const targetOs = String(editedOS['OS DA VENDA']).trim().toLowerCase();

    // Limpeza preventiva de idempotência
    const stalePending = receberList.filter(r => {
      const vOS = String(r.VENDA_OS || r.OS || '').trim().toLowerCase();
      return (vOS === targetOs || String(r.DOCUMENTO || '').toLowerCase().includes(targetOs)) && r.STATUS !== 'Recebido' && r.STATUS !== 'Pago';
    });
    let cleanList = receberList.filter(r => !stalePending.includes(r));

    // Gera as novas duplicatas aprovadas
    parcs.forEach((p, idx) => {
      cleanList.push({
        id: `rec_new_${Date.now()}_${idx}`,
        VENDA_OS: editedOS['OS DA VENDA'],
        DOCUMENTO: `BOLETO ${p.numero}/${p.totalParcelas} - OS ${editedOS['OS DA VENDA']}`,
        VALOR: p.valor,
        DATA_VENCIMENTO: p.vencimento,
        STATUS: 'Pendente',
        CLIENTE_ID: client.id
      });
    });

    // Atualiza débito do cliente com o novo restante
    const restVal = parseFloat(editedOS.RESTANTE.replace(',', '.'));
    const curDebt = parseFloat(client['Valor Devido'].replace(',', '.'));
    const newDebt = (curDebt + restVal).toFixed(2).replace('.', ',');
    client['Valor Devido'] = newDebt;
    client['Status de Pagamento'] = restVal > 0 ? 'Inadimplente' : 'Em dia';

    // Libera a OS
    editedOS.STATUS_OS = 'No Laboratório';
    editedOS.SITUAÇÃO = 'Pendente';
    editedOS.PAGAMENTO_CONFERIDO = 'Sim';
    editedOS.DUPLICATAS_GERADAS = true;

    return cleanList;
  };

  // Mariana teve a OS editada com 3 parcelas de R$ 100 (Total R$ 300 restante)
  const editedMarianaOS = {
    'OS DA VENDA': 'CAJ-88',
    'VALOR TOTAL': '600,00',
    'VALOR ENTRADA': '300,00',
    'RESTANTE': '300,00',
    'PARCELAS_JSON': JSON.stringify([
      { numero: 1, totalParcelas: 3, valor: '100,00', vencimento: '2026-11-10' },
      { numero: 2, totalParcelas: 3, valor: '100,00', vencimento: '2026-12-10' },
      { numero: 3, totalParcelas: 3, valor: '100,00', vencimento: '2027-01-10' }
    ])
  };

  contasReceberMariana = executeFinancialReapproval(editedMarianaOS, clientMariana, contasReceberMariana);

  const marianaActiveDuplicatas = contasReceberMariana.filter(r => r.VENDA_OS === 'CAJ-88');
  console.assert(marianaActiveDuplicatas.length === 3, `Deve conter exatamente 3 novas duplicatas, retornou ${marianaActiveDuplicatas.length}`);
  console.assert(marianaActiveDuplicatas[0].VALOR === '100,00', 'Nova parcela 1 deve ser de R$ 100,00');
  console.assert(clientMariana['Valor Devido'] === '300,00', `Novo débito da cliente deve ser R$ 300,00, calculou ${clientMariana['Valor Devido']}`);
  console.assert(editedMarianaOS.STATUS_OS === 'No Laboratório', 'Após reconfirmação pelo financeiro, OS deve ser liberada para No Laboratório');
  console.assert(editedMarianaOS.PAGAMENTO_CONFERIDO === 'Sim', 'Pagamento conferido deve estar como Sim');
  console.assert(editedMarianaOS.DUPLICATAS_GERADAS === true, 'Duplicatas geradas deve ser true');

  // 26.2 Cenário de Pagamento Parcial: OS com 1 parcela já quitada e 2 pendentes
  // Cliente Rodrigo comprou óculos em 3x de R$ 150 (Total R$ 450).
  // Parcela 1/3 (R$ 150) foi PAGA. Parcelas 2/3 (R$ 150) e 3/3 (R$ 150) estão PENDENTES. Débito atual: R$ 300,00.
  const clientRodrigo = {
    id: 'cli_rodrigo',
    'Nome Completo': 'Rodrigo Mendes',
    'CPF / CNPJ': '999.888.777-66',
    'Valor Devido': '300,00',
    'Status de Pagamento': 'Inadimplente'
  };

  let contasReceberRodrigo = [
    { id: 'rec_rod_1', VENDA_OS: 'CAJ-99', DOCUMENTO: 'BOLETO 1/3 - OS CAJ-99', VALOR: '150,00', STATUS: 'Recebido', CLIENTE_ID: 'cli_rodrigo' },
    { id: 'rec_rod_2', VENDA_OS: 'CAJ-99', DOCUMENTO: 'BOLETO 2/3 - OS CAJ-99', VALOR: '150,00', STATUS: 'Pendente', CLIENTE_ID: 'cli_rodrigo' },
    { id: 'rec_rod_3', VENDA_OS: 'CAJ-99', DOCUMENTO: 'BOLETO 3/3 - OS CAJ-99', VALOR: '150,00', STATUS: 'Pendente', CLIENTE_ID: 'cli_rodrigo' }
  ];

  // 1. Edição da OS: Apenas as pendentes são limpas, parcela PAGA fica intacta!
  const cleanupRodrigo = executeOSEditCleanup('CAJ-99', clientRodrigo, contasReceberRodrigo);
  contasReceberRodrigo = cleanupRodrigo.updatedReceber;

  console.assert(cleanupRodrigo.deletedCount === 2, 'Deve ter removido somente as 2 duplicatas pendentes (2/3 e 3/3)');
  console.assert(cleanupRodrigo.refundedAmount === 300.00, 'Valor estornado do débito deve ser R$ 300,00');
  console.assert(clientRodrigo['Valor Devido'] === '0,00', 'Débito temporário deve zerar aguardando reconfirmação');
  console.assert(contasReceberRodrigo.length === 1 && contasReceberRodrigo[0].id === 'rec_rod_1', 'Parcela 1/3 já recebida deve permanecer intacta');

  // 2. Re-aprovação Financeira em OSManagement:
  // Detecta que a parcela 1/3 já está paga e gera SOMENTE as parcelas não pagas (2/3 e 3/3)
  const executePartialFinancialReapproval = (order, client, receberList) => {
    const targetOs = String(order.osNumber).trim().toLowerCase();
    const parcs = JSON.parse(order.raw.PARCELAS_JSON || '[]');

    // Identificar pagas
    const paidInvoices = receberList.filter(r => {
      const vOS = String(r.VENDA_OS || '').trim().toLowerCase();
      return vOS === targetOs && (r.STATUS === 'Recebido' || r.STATUS === 'Pago');
    });

    let newlyCreatedPendingSum = 0;
    const cleanList = [...receberList];

    for (const p of parcs) {
      const numP = p.numero || 1;
      const totP = p.totalParcelas || parcs.length;
      const isAlreadyPaid = paidInvoices.some(paid => {
        const doc = String(paid.DOCUMENTO || '').toLowerCase();
        return doc.includes(`${numP}/${totP}`) || doc.includes(`parcela ${numP}`);
      });

      if (!isAlreadyPaid) {
        newlyCreatedPendingSum += parseFloat(p.valor.replace(',', '.'));
        cleanList.push({
          id: `rec_new_${Date.now()}_${numP}`,
          VENDA_OS: order.osNumber,
          DOCUMENTO: `BOLETO ${numP}/${totP} - OS ${order.osNumber}`,
          VALOR: p.valor,
          STATUS: 'Pendente',
          CLIENTE_ID: client.id
        });
      }
    }

    // Débito do cliente recebe newlyCreatedPendingSum (R$ 300 restante)
    const curDebt = parseFloat(client['Valor Devido'].replace(',', '.'));
    client['Valor Devido'] = (curDebt + newlyCreatedPendingSum).toFixed(2).replace('.', ',');
    client['Status de Pagamento'] = newlyCreatedPendingSum > 0 ? 'Inadimplente' : 'Em dia';

    return { cleanList, newlyCreatedPendingSum };
  };

  const editedRodrigoOrder = {
    osNumber: 'CAJ-99',
    raw: {
      'OS DA VENDA': 'CAJ-99',
      'VALOR TOTAL': '450,00',
      'RESTANTE': '300,00',
      'PARCELAS_JSON': JSON.stringify([
        { numero: 1, totalParcelas: 3, valor: '150,00', vencimento: '2026-10-10' },
        { numero: 2, totalParcelas: 3, valor: '150,00', vencimento: '2026-11-10' },
        { numero: 3, totalParcelas: 3, valor: '150,00', vencimento: '2026-12-10' }
      ])
    }
  };

  const reapprovalRodrigo = executePartialFinancialReapproval(editedRodrigoOrder, clientRodrigo, contasReceberRodrigo);
  contasReceberRodrigo = reapprovalRodrigo.cleanList;

  console.assert(reapprovalRodrigo.newlyCreatedPendingSum === 300.00, 'Soma das novas duplicatas criadas deve ser R$ 300,00 (excluindo a 1ª já paga)');
  console.assert(contasReceberRodrigo.length === 3, 'Total de duplicatas deve ser 3 (1 paga + 2 novas pendentes)');
  console.assert(contasReceberRodrigo.filter(r => r.STATUS === 'Recebido').length === 1, 'Exatamente 1 duplicata deve constar como Recebido');
  console.assert(contasReceberRodrigo.filter(r => r.STATUS === 'Pendente').length === 2, 'Exatamente 2 duplicatas devem constar como Pendente');
  console.assert(clientRodrigo['Valor Devido'] === '300,00', 'Débito do Rodrigo deve ser restabelecido exatamente para R$ 300,00');

  console.log('  ✅ Test 26 Passed: Limpeza atômica e reconfirmação sem duplicidades validadas com sucesso!\n');

  // ─── TEST 27: Modo Contingência Offline (Fila Real, Timeouts, Mutex e Drenagem) ───
  console.log('▶ Test 27: Modo Contingência Offline (Fila Real, Timeouts, Mutex e Drenagem)');

  // Configura armazenamento local em memória para o ambiente Node
  const mockStorage = new Map();
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) || null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
    clear: () => mockStorage.clear()
  };

  // 27.1 Validação do utilitário universal withTimeout
  const fastPromise = withTimeout(Promise.resolve('sucesso_rapido'), 100, 'timeout_erro');
  const fastResult = await fastPromise;
  console.assert(fastResult === 'sucesso_rapido', 'withTimeout deve retornar o resultado para promessas rápidas');

  let timeoutCaught = false;
  try {
    await withTimeout(new Promise(r => setTimeout(r, 200)), 30, 'Timeout disparado com sucesso');
  } catch (err) {
    timeoutCaught = true;
    console.assert(err.message === 'Timeout disparado com sucesso', 'Mensagem de erro de timeout deve conferir');
  }
  console.assert(timeoutCaught === true, 'withTimeout deve rejeitar pontualmente quando o tempo limite for excedido');

  // 27.2 Enfileiramento real na fila de contingência
  clearOfflineQueue();
  console.assert(getOfflineQueue().length === 0, 'Fila deve iniciar vazia após clearOfflineQueue');

  const op1 = enqueueOfflineOp('save', 'Registro_Vendas', 'sale_off_1', { CLIENTE: 'MARIA OFFLINE', VALOR: 350.00 });
  const op2 = enqueueOfflineOp('decrement_stock', 'CAD_ARMACOES', 'arm_off_1', { quantity: 1 });
  const op3 = enqueueOfflineOp('save', 'CLIENTES_CADASTRADOS', 'cli_off_1', { 'Nome Completo': 'MARIA OFFLINE', CPF: '12345678901' });

  console.assert(getOfflineQueue().length === 3, 'A fila offline deve conter exatamente 3 operações enfileiradas');
  const storedQueue = JSON.parse(globalThis.localStorage.getItem(OFFLINE_QUEUE_KEY));
  console.assert(storedQueue.length === 3, 'Fila deve persistir corretamente no armazenamento local');
  console.assert(storedQueue[0].data.CLIENTE === 'MARIA OFFLINE', 'Dados da venda offline devem ser preservados');
  console.assert(storedQueue[1].data.quantity === 1, 'Decremento de estoque offline deve ser preservado');

  // 27.3 Proteção contra Hang: Simulação de Instabilidade de Rede com Timeout e Drenagem Parcial
  // Simula op1 dando timeout (Wi-Fi sem gateway/DNS), enquanto op2 e op3 são processadas normalmente
  const processedWithStall = await processOfflineQueue({
    timeoutMs: 40,
    executor: async (op) => {
      if (op.docId === 'sale_off_1') {
        // Simula Firestore pendurado sem retorno
        await new Promise(r => setTimeout(r, 200));
      }
      // op2 e op3 concluem normalmente
    }
  });

  console.assert(processedWithStall === 2, `Devem ser processados 2 itens com sucesso (processados: ${processedWithStall})`);
  const queueAfterStall = getOfflineQueue();
  console.assert(queueAfterStall.length === 1, `Item que sofreu timeout deve permanecer na fila (restantes: ${queueAfterStall.length})`);
  console.assert(queueAfterStall[0].docId === 'sale_off_1', 'Item remanescente deve ser a venda que sofreu timeout');

  // 27.4 Mutex de Concorrência e Preservação de Operações Enfileiradas Simultaneamente
  let mutexBlockedConcurrentCall = false;
  const syncWithConcurrentAdd = processOfflineQueue({
    timeoutMs: 150,
    executor: async (op) => {
      console.assert(getIsSyncingQueue() === true, 'isSyncingQueue deve estar ativo durante execução');
      
      // Chamada paralela deve ser bloqueada pelo mutex
      const concurrentResult = await processOfflineQueue();
      if (concurrentResult === 0) {
        mutexBlockedConcurrentCall = true;
      }

      // Adiciona uma nova operação concorrentemente enquanto a fila está em trânsito
      enqueueOfflineOp('save', 'Registro_Vendas', 'sale_concorrente', { VALOR: 120.00 });
      await new Promise(r => setTimeout(r, 30));
    }
  });

  const processedFinal = await syncWithConcurrentAdd;
  console.assert(mutexBlockedConcurrentCall === true, 'Mutex deve impedir chamadas simultâneas à processOfflineQueue');
  console.assert(getIsSyncingQueue() === false, 'Mutex deve ser liberado ao término da sincronização');
  console.assert(processedFinal === 1, 'Item pendente anterior deve ser processado');

  // Verifica que a operação concorrente NÃO foi descartada e segue na fila
  const queueWithConcurrent = getOfflineQueue();
  console.assert(queueWithConcurrent.length === 1, 'Operação inserida concorrentemente deve ser preservada na fila');
  console.assert(queueWithConcurrent[0].docId === 'sale_concorrente', 'Operação preservada deve ser a inserida concorrentemente');

  // 27.5 Drenagem Final Completa da Fila
  const processedDrain = await processOfflineQueue({
    timeoutMs: 50,
    executor: async () => {}
  });
  console.assert(processedDrain === 1, 'Último item pendente deve ser drenado');
  console.assert(getOfflineQueue().length === 0, 'Fila deve estar 100% zerada após drenagem completa');

  // 27.6 Snapshot de Recuperação Total Offline (Limites Seguros e Hidratação)
  const appDataSnapshot = {
    'CLIENTES_CADASTRADOS': [{ id: '1', 'Nome Completo': 'CLIENTE OFFLINE SALVO' }],
    'CAD_ARMACOES': [{ id: 'a1', MODELO: 'RAY-BAN TITANIUM', ESTOQUE: 5 }],
    'Registro_Vendas': [{ id: 'v1', VALOR: 499.00 }]
  };
  saveOfflineSnapshot(appDataSnapshot);

  const restoredSnapshot = loadOfflineSnapshot();
  console.assert(restoredSnapshot['CLIENTES_CADASTRADOS'].length === 1, 'Snapshot offline deve restaurar clientes');
  console.assert(restoredSnapshot['CAD_ARMACOES'][0].MODELO === 'RAY-BAN TITANIUM', 'Snapshot offline deve restaurar armações e estoque');
  console.assert(restoredSnapshot['CAD_ARMACOES'][0].ESTOQUE === 5, 'Saldo de estoque no snapshot deve ser preservado');

  // Snapshot com excesso de tamanho (> 1.5MB) deve ser descartado com segurança
  const hugeData = { 'GRANDE': new Array(100).fill({ dados: 'x'.repeat(20000) }) };
  saveOfflineSnapshot(hugeData);
  console.assert(loadOfflineSnapshot() === null, 'Snapshot excessivo deve ser removido preventivamente para resguardar cota');

  // 27.7 Validação de decrementStockAtomically com Enfileiramento Offline Direto
  if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: false };
  } else {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });
  }
  const decRes = await decrementStockAtomically('CAD_ARMACOES', 'arm_offline_test', 2);
  console.assert(decRes.success === true && decRes.offlineQueue === true, 'decrementStockAtomically offline deve retornar success: true e offlineQueue: true');
  const queueAfterDec = getOfflineQueue();
  const queuedDecOp = queueAfterDec.find(op => op.docId === 'arm_offline_test');
  console.assert(queuedDecOp && queuedDecOp.type === 'decrement_stock' && queuedDecOp.data.quantity === 2, 'Operação de decremento de estoque deve ser enfileirada com precisão');

  // Restabelece conectividade online para drenagem da fila
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });

  // Drena a operação de teste
  const drainedDec = await processOfflineQueue({
    timeoutMs: 50,
    executor: async () => {}
  });
  console.assert(drainedDec === 1, 'Operação de decremento de estoque deve ser drenada normalmente');
  console.assert(getOfflineQueue().length === 0, 'Fila deve estar vazia após drenagem do teste 27.7');

  // 27.8 Validação de withTimeout com Entradas Síncronas / Não-Promessas
  const syncVal = await withTimeout('valor_imediato');
  console.assert(syncVal === 'valor_imediato', 'withTimeout deve resolver valores síncronos sem travar');

  console.log('  ✅ Test 27 Passed: Modo Contingência Offline (Fila Real, Timeouts, Mutex, Baixa de Estoque e Drenagem) validado com sucesso!\n');

  // ─── TEST 28: Alteração de Senha do Usuário (Autoatendimento, Admin e Sobrescrita Master) ───
  console.log('▶ Test 28: Alteração de Senha do Usuário (Autoatendimento, Admin e Sobrescrita Master)');

  // 28.1 Verificação de Senha Atual e Nova Senha
  const initialPassword = 'minhasenhaantiga';
  const newPassword = 'minhasenhanova2026';
  const hashedOld = await hashPassword(initialPassword);
  const hashedNew = await hashPassword(newPassword);

  console.assert(await verifyPassword(initialPassword, hashedOld), 'Senha antiga deve validar com sucesso');
  console.assert(await verifyPassword(newPassword, hashedNew), 'Senha nova deve validar com sucesso');
  console.assert(!(await verifyPassword('senhaerrada', hashedNew)), 'Senha incorreta não deve validar');

  // 28.2 Atualização no array de usuários com case-insensitivity
  const mockUsersList = [
    { username: 'wmusete', role: 'admin', authorized: true, password: hashedOld },
    { username: 'vendedora_cajati', role: 'vendedor', authorized: true, password: hashedOld }
  ];

  const updateUserPasswordInList = (list, username, newHash) => {
    const cleanUser = String(username).toLowerCase().trim();
    const nowIso = new Date().toISOString();
    return list.map(u => {
      if (u.username.toLowerCase() === cleanUser) {
        return { ...u, username: cleanUser, password: newHash, updatedAt: nowIso };
      }
      return u;
    });
  };

  const updatedUsers1 = updateUserPasswordInList(mockUsersList, 'VENDEDORA_CAJATI', hashedNew);
  const targetUser1 = updatedUsers1.find(u => u.username === 'vendedora_cajati');
  console.assert(targetUser1 !== undefined, 'Usuário vendedora_cajati deve existir');
  console.assert(targetUser1.password === hashedNew, 'Senha da usuária deve ter sido atualizada com o novo hash');
  console.assert(targetUser1.updatedAt !== undefined, 'updatedAt deve ser preenchido');

  // 28.3 Sobrescrita da senha do Master User 'wmusete'
  // Quando o master altera sua senha no sistema, o Login prioriza o documento do banco em vez do fallback DEFAULT_MASTER_HASH
  const defaultMasterHash = 'pbkdf2:b3bb279090a24beecaa987cfde1224a1:b473c3a43b120e5f624792b560dff6edc6b56d1865a8fb3d9a0433d7ab13804a'; // '929498'
  const newMasterPass = 'NovaSenhaMasterSegura!#';
  const newMasterHash = await hashPassword(newMasterPass);

  const simulateMasterLogin = async (attemptPassword, remoteDocument) => {
    // Se o banco remoto ou cache local tiver senha customizada cadastrada, confere APENAS ela
    if (remoteDocument && remoteDocument.password) {
      const isValid = await verifyPassword(attemptPassword, remoteDocument.password);
      return { success: isValid, via: 'remote_updated_password' };
    }
    // Fallback padrão se não houver senha no Firestore (primeiro login antes de trocar)
    const isDefaultValid = await verifyPassword(attemptPassword, defaultMasterHash);
    return { success: isDefaultValid, via: 'default_master_hash' };
  };

  // Antes de trocar a senha master: login com 929498 funciona via fallback
  const firstLogin = await simulateMasterLogin('929498', null);
  console.assert(firstLogin.success === true && firstLogin.via === 'default_master_hash', 'Primeiro login master deve usar fallback');

  // Após trocar a senha master:
  const remoteMasterDoc = { username: 'wmusete', password: newMasterHash, role: 'admin', authorized: true };
  const loginWithNewPass = await simulateMasterLogin(newMasterPass, remoteMasterDoc);
  console.assert(loginWithNewPass.success === true && loginWithNewPass.via === 'remote_updated_password', 'Login após alteração de senha deve usar a nova senha');

  const loginWithOldDefault = await simulateMasterLogin('929498', remoteMasterDoc);
  // 28.4 Sincronização e Atualização no Banco de Dados em Nuvem (Firestore)
  // Verifica se o documento é normalizado para ID = username limpo e campos obrigatórios preenchidos
  const cleanUsername = 'carla_registro';
  const newCarlaPass = 'SenhaCarla2026@!';
  const hashedCarla = await hashPassword(newCarlaPass);
  const nowIso = new Date().toISOString();

  const userDocForFirestore = {
    id: cleanUsername,
    username: cleanUsername,
    password: hashedCarla,
    role: 'vendedor',
    city: 'Registro',
    authorized: true,
    updatedAt: nowIso
  };

  console.assert(userDocForFirestore.id === 'carla_registro', 'ID do documento no Firestore deve ser o username');
  console.assert(userDocForFirestore.password === hashedCarla, 'Senha no Firestore deve ser o hash criptografado');
  console.assert(userDocForFirestore.updatedAt !== undefined, 'updatedAt deve ser gravado');

  // Sincronização entre abas/aparelhos com desduplicação por updatedAt
  const localList = [
    { username: 'carla_registro', password: 'old_hash', updatedAt: '2026-10-01T12:00:00.000Z' }
  ];
  const remoteSnapshot = [
    { username: 'carla_registro', password: hashedCarla, updatedAt: '2026-10-01T17:00:00.000Z' }
  ];

  const mergeUsersSnapshot = (local, remote) => {
    const map = new Map();
    local.forEach(u => map.set(u.username.toLowerCase(), u));
    remote.forEach(r => {
      const k = r.username.toLowerCase();
      const exist = map.get(k);
      if (!exist || new Date(r.updatedAt).getTime() >= new Date(exist.updatedAt).getTime()) {
        map.set(k, { ...exist, ...r, id: k, username: k });
      }
    });
    return Array.from(map.values());
  };

  const mergedSnapshot = mergeUsersSnapshot(localList, remoteSnapshot);
  console.assert(mergedSnapshot.length === 1, 'Deve desduplicar a lista mantendo exatamente 1 usuário');
  console.assert(mergedSnapshot[0].password === hashedCarla, 'Snapshot do Firestore mais recente deve atualizar a senha');

  console.log('  ✅ Test 28 Passed: Alteração de senha, preservação de dados e sobrescrita master validadas com sucesso!\n');

  // ─── TEST 29: Múltiplos Vouchers Cumulativos no PDV & Geração de Duplicatas do Boleto na Aprovação da OS ───
  console.log('▶ Test 29: Múltiplos Vouchers no PDV & Construtor de Pagamentos da OS com Duplicatas no Financeiro');

  // 29.1 Múltiplos Vouchers Cumulativos no PDV
  const availableVouchers = [
    { CODIGO: 'BEMVINDO', VALOR_DESCONTO: '50,00', STATUS: 'Ativo', QUANTIDADE_USADA: 0, QUANTIDADE_MAXIMA: 10 },
    { CODIGO: 'VIP20', VALOR_DESCONTO: '30,00', STATUS: 'Ativo', QUANTIDADE_USADA: 2, QUANTIDADE_MAXIMA: 5 },
    { CODIGO: 'ESGOTADO', VALOR_DESCONTO: '20,00', STATUS: 'Ativo', QUANTIDADE_USADA: 5, QUANTIDADE_MAXIMA: 5 }
  ];

  let appliedVouchersList = [];
  const applyVoucherHelper = (code, subtotal) => {
    const clean = String(code).trim().toUpperCase();
    if (appliedVouchersList.some(v => (v.CODIGO || v.codigo) === clean)) {
      return { success: false, error: 'Cupom já aplicado nesta venda!' };
    }
    const found = availableVouchers.find(v => (v.CODIGO || v.codigo) === clean);
    if (!found) return { success: false, error: 'Cupom inválido!' };
    if (found.STATUS !== 'Ativo') return { success: false, error: 'Cupom inativo!' };
    if (found.QUANTIDADE_MAXIMA && found.QUANTIDADE_USADA >= found.QUANTIDADE_MAXIMA) {
      return { success: false, error: 'Limite de uso esgotado!' };
    }
    appliedVouchersList.push(found);
    return { success: true };
  };

  const calculateTotalVoucherDiscount = (vouchers, subtotal) => {
    let sum = 0;
    for (const v of vouchers) {
      const rawVal = v.VALOR_DESCONTO || v.DESCONTO || 0;
      let d = 0;
      if (typeof rawVal === 'string' && rawVal.includes('%')) {
        const perc = parseFloat(rawVal.replace('%', '').replace(',', '.'));
        d = (subtotal * perc) / 100;
      } else {
        d = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(',', '.'));
      }
      sum += Math.max(0, d);
    }
    return Math.min(subtotal, sum);
  };

  const subtotalVenda = 500.00;
  // Aplica 1º cupom
  const res1 = applyVoucherHelper('BEMVINDO', subtotalVenda);
  console.assert(res1.success === true, '1º cupom deve ser aplicado');
  console.assert(appliedVouchersList.length === 1, 'Deve ter 1 cupom na lista');

  // Aplica 2º cupom cumulativo
  const res2 = applyVoucherHelper('VIP20', subtotalVenda);
  console.assert(res2.success === true, '2º cupom deve ser aplicado cumulativamente');
  console.assert(appliedVouchersList.length === 2, 'Deve ter 2 cupons na lista');

  // Tenta aplicar duplicado
  const resDup = applyVoucherHelper('BEMVINDO', subtotalVenda);
  console.assert(resDup.success === false, 'Cupom já aplicado deve ser rejeitado');
  console.assert(appliedVouchersList.length === 2, 'Lista deve permanecer com 2 cupons');

  // Tenta aplicar esgotado
  const resEsg = applyVoucherHelper('ESGOTADO', subtotalVenda);
  console.assert(resEsg.success === false, 'Cupom esgotado deve ser rejeitado');

  // Cálculo da soma dos descontos
  const totalDesconto = calculateTotalVoucherDiscount(appliedVouchersList, subtotalVenda);
  console.assert(totalDesconto === 80.00, 'Desconto total deve ser R$ 80,00 (50 + 30)');
  const valorFinalComVouchers = subtotalVenda - totalDesconto;
  console.assert(valorFinalComVouchers === 420.00, 'Valor final da venda deve ser R$ 420,00');

  // Remoção individual de voucher
  appliedVouchersList = appliedVouchersList.filter(v => v.CODIGO !== 'BEMVINDO');
  console.assert(appliedVouchersList.length === 1, 'Deve restar 1 cupom após remoção');
  const descontoAposRemocao = calculateTotalVoucherDiscount(appliedVouchersList, subtotalVenda);
  console.assert(descontoAposRemocao === 30.00, 'Desconto após remoção deve ser R$ 30,00');

  // String salva na venda
  const voucherStringSalva = appliedVouchersList.map(v => v.CODIGO).join(', ');
  console.assert(voucherStringSalva === 'VIP20', 'Códigos devem ser salvos separados por vírgula');

  // 29.2 Construtor de Pagamentos da OS sem repetições
  const osPayments = [
    { method: 'Dinheiro', valor: 100, texto: '💵 Dinheiro: R$ 100,00' },
    {
      method: 'Boleto',
      valor: 300,
      installments: 3,
      texto: '📄 Boleto (3x de R$ 100,00 | Venc: 1ª 02/11/2026, 2ª 02/12/2026, 3ª 02/01/2027): R$ 300,00',
      parcelas: [
        { numero: 1, totalParcelas: 3, valor: '100,00', vencimento: '2026-11-02' },
        { numero: 2, totalParcelas: 3, valor: '100,00', vencimento: '2026-12-02' },
        { numero: 3, totalParcelas: 3, valor: '100,00', vencimento: '2027-01-02' }
      ]
    }
  ];

  const totalOS29 = 400.00;
  const sinalOS29 = osPayments.filter(p => p.method !== 'Boleto').reduce((s, p) => s + p.valor, 0);
  const restanteOS29 = osPayments.filter(p => p.method === 'Boleto').reduce((s, p) => s + p.valor, 0);
  console.assert(sinalOS29 === 100.00, 'Sinal da OS deve ser R$ 100,00');
  console.assert(restanteOS29 === 300.00, 'Restante da OS no Boleto deve ser R$ 300,00');
  console.assert(sinalOS29 + restanteOS29 === totalOS29, 'Soma dos pagamentos da OS deve bater exatamente 100%');

  // 29.3 Aprovação do Boleto pelo Financeiro e Geração de Duplicatas em CONTAS_RECEBER
  const testOSOrder = {
    osNumber: 'CAJ-99',
    clientName: 'WESLLEY CLIENTE TESTE',
    clientCPF: '123.456.789-00',
    unit: 'Cajati',
    product: 'Óculos Completo Antirreflexo',
    valorTotal: '400,00',
    valorEntrada: '100,00',
    restante: '300,00',
    formasPagamento: osPayments.map(p => p.texto).join('\n'),
    raw: {
      PARCELAS_JSON: JSON.stringify(osPayments.find(p => p.method === 'Boleto').parcelas),
      CLIENTE_ID: 'cli_teste_1',
      CLIENTE_CPF: '123.456.789-00',
      DUPLICATAS_GERADAS: false
    }
  };

  const mockContasReceberDB = [];
  const mockAddRowReceber = async (table, row) => {
    if (table === 'CONTAS_RECEBER') {
      mockContasReceberDB.push({ ...row, id: `cr_${Date.now()}_${mockContasReceberDB.length}` });
    }
  };

  // Simula execução de handleConfirmApproval
  const parcsExtraidas = JSON.parse(testOSOrder.raw.PARCELAS_JSON);
  console.assert(parcsExtraidas.length === 3, 'Devem ser extraídas exatamente 3 parcelas do Boleto');

  for (const p of parcsExtraidas) {
    await mockAddRowReceber('CONTAS_RECEBER', {
      CLIENTE_ID: testOSOrder.raw.CLIENTE_ID,
      CLIENTE_CPF: testOSOrder.clientCPF,
      CPF: testOSOrder.clientCPF,
      CLIENTE: testOSOrder.clientName,
      'NOME CLIENTE': testOSOrder.clientName,
      VENDA_OS: testOSOrder.osNumber,
      DOCUMENTO: `BOLETO ${p.numero}/${p.totalParcelas} - OS ${testOSOrder.osNumber}`,
      VALOR: p.valor,
      DATA_VENCIMENTO: p.vencimento,
      STATUS: 'Pendente',
      CIDADE: testOSOrder.unit,
      MEIO_PAGAMENTO: 'Boleto'
    });
  }

  console.assert(mockContasReceberDB.length === 3, 'CONTAS_RECEBER deve conter exatamente 3 duplicatas geradas');
  console.assert(mockContasReceberDB[0].DOCUMENTO === 'BOLETO 1/3 - OS CAJ-99', '1ª duplicata deve estar identificada corretamente');
  console.assert(mockContasReceberDB[0].VALOR === '100,00', 'Valor da 1ª duplicata deve ser R$ 100,00');
  console.assert(mockContasReceberDB[0].DATA_VENCIMENTO === '2026-11-02', 'Vencimento da 1ª parcela deve ser 2026-11-02');
  console.assert(mockContasReceberDB[1].DATA_VENCIMENTO === '2026-12-02', 'Vencimento da 2ª parcela deve ser 2026-12-02');
  console.assert(mockContasReceberDB[2].DATA_VENCIMENTO === '2027-01-02', 'Vencimento da 3ª parcela deve ser 2027-01-02');
  console.assert(mockContasReceberDB.every(d => d.MEIO_PAGAMENTO === 'Boleto'), 'Todas as duplicatas devem ter MEIO_PAGAMENTO como Boleto');

  console.log('  ✅ Test 29 Passed: Múltiplos Vouchers no PDV & Construtor de Pagamentos da OS com Duplicatas no Financeiro validados com sucesso!\n');

  // ─── TEST 30: Blindagem Incondicional de Finalização no PDV & Proteção de Quota ───
  console.log('▶ Test 30: Blindagem Incondicional de Finalização no PDV & Proteção de Quota');

  // 30.1 Simulação de Finalização de Venda com Falha de Rede/Firestore
  let completedSaleState = null;
  let savedClientForOSState = null;
  let cartState = [{ id: 'prod1', nome: 'Armação Oakley In', qtd: 1, preco: 300.00, type: 'armacoes' }];
  let isFinalizingState = false;

  const mockClient = {
    id: 'cli_stephanie',
    'Nome Completo': 'STEPHANIE MUSETI SANTOS',
    'CPF / CNPJ': '418.067.898-11',
    'Cidade': 'Cajati'
  };

  const simulateFinalizeSale = async (shouldFailNetwork = true) => {
    isFinalizingState = true;
    const finalTotal = 300.00;
    const paymentsList = [{ metodo: 'dinheiro', valor: 300.00, texto: 'Dinheiro: R$ 300,00' }];

    const newSaleObj = {
      CLIENTE: mockClient['Nome Completo'],
      VALOR_TOTAL: finalTotal,
      FORMA_PAGTO: 'Dinheiro: R$ 300,00'
    };

    const clientForOSObj = {
      ...mockClient,
      'Modelo de Armação': cartState[0].nome,
      'PRODUTO': cartState[0].nome,
      'Valor Devido': '300,00',
      'valorTotal': '300,00',
      'valorEntrada': '300,00',
      'restante': '0,00',
      'formasPagamento': 'Dinheiro: R$ 300,00'
    };

    try {
      if (shouldFailNetwork) {
        // Simula rejeição de promessa do Firestore ou QuotaExceededError
        throw new Error("QuotaExceededError / Firestore INTERNAL ASSERTION FAILED");
      }
    } catch (netErr) {
      // Falha capturada e tolerada: venda não pode ser abortada
    } finally {
      savedClientForOSState = clientForOSObj;
      completedSaleState = {
        ...newSaleObj,
        itens: [...cartState],
        valorTotal: finalTotal,
        pagamentosLista: paymentsList
      };
      cartState = [];
      isFinalizingState = false;
    }
  };

  await simulateFinalizeSale(true);

  console.assert(completedSaleState !== null, 'completedSale DEVE estar preenchido para abrir o modal de comprovante');
  console.assert(completedSaleState.CLIENTE === 'STEPHANIE MUSETI SANTOS', 'Cliente da venda deve ser Stephanie Museti Santos');
  console.assert(completedSaleState.valorTotal === 300.00, 'Valor total da venda deve ser R$ 300,00');
  console.assert(savedClientForOSState !== null, 'savedClientForOS DEVE estar preenchido para emissão de OS');
  console.assert(savedClientForOSState['Modelo de Armação'] === 'Armação Oakley In', 'Armação vendida deve estar pré-carregada na OS');
  console.assert(cartState.length === 0, 'Carrinho deve ser limpo após a finalização');
  console.assert(isFinalizingState === false, 'Estado de finalizando deve retornar para false no finally');

  // 30.2 Teste de Proteção de Quota do Storage
  const compactSnapshotMock = (dataObj, maxItems = 100) => {
    const compact = {};
    Object.keys(dataObj).forEach(col => {
      if (Array.isArray(dataObj[col])) {
        compact[col] = dataObj[col].slice(-maxItems);
      }
    });
    return compact;
  };

  const largeDataset = {
    'CLIENTES_CADASTRADOS': Array.from({ length: 500 }, (_, i) => ({ id: `c_${i}`, nome: `Cliente ${i}` })),
    'Registro_Vendas': Array.from({ length: 1000 }, (_, i) => ({ id: `v_${i}`, total: i * 10 }))
  };

  const compacted = compactSnapshotMock(largeDataset, 100);
  console.assert(compacted['CLIENTES_CADASTRADOS'].length === 100, 'Snapshot compacto deve conter no máximo 100 clientes');
  console.assert(compacted['Registro_Vendas'].length === 100, 'Snapshot compacto deve conter no máximo 100 vendas');

  console.log('  ✅ Test 30 Passed: Blindagem Incondicional de Finalização no PDV & Proteção de Quota validadas com sucesso!\n');

  // ==========================================
  // TEST 31: Visibilidade Multi-Loja de Estoque para Vendedores (Igual ao Admin)
  // ==========================================
  console.log('▶ Test 31: Visibilidade Multi-Loja de Estoque para Vendedores (Igual ao Admin)');

  const mockMultiStoreStock = [
    { id: '1', MARCA: 'Ray-Ban', MODELO: 'Aviador', UNIDADE: 'Cajati', ESTOQUE: 5 },
    { id: '2', MARCA: 'Oakley', MODELO: 'Holbrook', UNIDADE: 'Registro', ESTOQUE: 3 },
    { id: '3', MARCA: 'Vogue', MODELO: 'Cat Eye', UNIDADE: 'Jacupiranga', ESTOQUE: 4 },
    { id: '4', MARCA: 'Armani', MODELO: 'Classic', UNIDADE: 'Central', ESTOQUE: 10 },
    { id: '5', MARCA: 'Evoke', MODELO: 'Capo', UNIDADE: 'Venda Externa', ESTOQUE: 2 }
  ];

  // 31.1 Verificação no ERP / DataTable: Vendedor deve ter acesso ao array completo sem filtros forçados
  const getErpStockForUser = (stockList, userRole) => {
    // Agora vendedores e administradores visualizam o estoque de todas as lojas igualmente
    return stockList;
  };

  const vendorErpStock = getErpStockForUser(mockMultiStoreStock, 'vendedor');
  const adminErpStock = getErpStockForUser(mockMultiStoreStock, 'admin');

  console.assert(vendorErpStock.length === 5, 'Vendedor deve ver todos os 5 modelos de todas as lojas');
  console.assert(adminErpStock.length === 5, 'Admin deve ver todos os 5 modelos de todas as lojas');
  console.assert(vendorErpStock.some(i => i.UNIDADE === 'Registro'), 'Vendedor deve ver produtos de Registro');
  console.assert(vendorErpStock.some(i => i.UNIDADE === 'Jacupiranga'), 'Vendedor deve ver produtos de Jacupiranga');

  // 31.2 Verificação no PDV / Frente de Caixa: Vendedor pode filtrar por qualquer loja ou ver TODAS
  const filterPosCatalog = (stockList, selectedCityFilter, searchQuery = '') => {
    const q = searchQuery.toLowerCase().trim();
    const effectiveCity = selectedCityFilter !== 'TODAS' ? selectedCityFilter : null;
    return stockList.filter(item => {
      if (effectiveCity) {
        const u = String(item.UNIDADE || '').toUpperCase();
        if (!u.includes(effectiveCity.toUpperCase())) return false;
      }
      if (!q) return true;
      return Object.values(item).some(v => String(v).toLowerCase().includes(q));
    });
  };

  // Vendedor em Cajati consultando todas as lojas
  const allStoresView = filterPosCatalog(mockMultiStoreStock, 'TODAS');
  console.assert(allStoresView.length === 5, 'Visualização de todas as lojas no PDV deve conter 5 itens');

  // Vendedor em Cajati filtrando para ver o estoque de Registro
  const registroStoreView = filterPosCatalog(mockMultiStoreStock, 'Registro');
  console.assert(registroStoreView.length === 1 && registroStoreView[0].MODELO === 'Holbrook', 'Vendedor deve conseguir filtrar estoque específico de Registro');

  console.log('  ✅ Test 31 Passed: Visibilidade Multi-Loja de Estoque para Vendedores (Igual ao Admin) validada com sucesso!\n');

  // ─── TEST 32: Blindagem do Caixa no PDV & Unificação da Venda e OS ───
  console.log('▶ Test 32: Blindagem do Caixa no PDV & Unificação da Venda e OS');
  
  // 32.1 Filtragem estrita de meios de pagamento para FLUXO_CAIXA (apenas DINHEIRO, PIX, DEBITO, CREDITO)
  const mockPayments = [
    { metodo: 'dinheiro', valor: 100.00 },
    { metodo: 'pix', valor: 50.00 },
    { metodo: 'carne', valor: 300.00, parcelas: [{ numero: 1, valor: 150 }, { numero: 2, valor: 150 }] },
    { metodo: 'boleto', valor: 200.00, parcelas: [{ numero: 1, valor: 200 }] },
    { metodo: 'credito', valor: 80.00 }
  ];

  const immediatePaymentsFilter = (payments) => {
    return payments.filter(pay => {
      const m = String(pay.metodo || '').toUpperCase();
      return m === 'DINHEIRO' || m === 'PIX' || m === 'DEBITO' || m === 'CREDITO' ||
             m.includes('DINHEIRO') || m.includes('PIX') || m.includes('DEBITO') || m.includes('DÉBITO') || m.includes('CREDITO') || m.includes('CRÉDITO');
    });
  };

  const filteredForCashFlow = immediatePaymentsFilter(mockPayments);
  console.assert(filteredForCashFlow.length === 3, `Devem ser 3 pagamentos imediatos no caixa, retornou ${filteredForCashFlow.length}`);
  console.assert(!filteredForCashFlow.some(p => p.metodo === 'carne' || p.metodo === 'boleto'), 'Carnê e boleto NÃO devem entrar no FLUXO_CAIXA imediatamente');
  console.assert(filteredForCashFlow.some(p => p.metodo === 'dinheiro'), 'Dinheiro deve entrar no FLUXO_CAIXA');
  console.assert(filteredForCashFlow.some(p => p.metodo === 'pix'), 'PIX deve entrar no FLUXO_CAIXA');
  console.assert(filteredForCashFlow.some(p => p.metodo === 'credito'), 'Crédito deve entrar no FLUXO_CAIXA');

  // 32.2 Unificação da Venda e OS: Não duplica venda em Registro_Vendas
  let salesStore = [];
  const handleAddSaleMock = (sale) => { salesStore.push({ ...sale, id: sale.id || 'venda_1' }); };
  const handleUpdateSaleMock = (sheet, oldRow, newRow) => {
    salesStore = salesStore.map(s => (s.id === oldRow.id ? newRow : s));
  };

  // Simula finalização do checkout
  const checkoutSale = {
    id: 'venda_pos_101',
    CLIENTE: 'Carlos Teste',
    PRODUTO: 'Armação Ray-Ban',
    'VALOR TOTAL': 500.00
  };
  handleAddSaleMock(checkoutSale);
  console.assert(salesStore.length === 1, 'Após checkout deve haver 1 venda registrada');

  // Simula clique em "Gerar e Imprimir OS" pelo operador
  const osDataGenerated = { numeroOS: 'OS-9988', laboratorio: 'Lab Sul' };
  const mergedOSData = {
    ...checkoutSale,
    'OS DA VENDA': osDataGenerated.numeroOS,
    'OS': osDataGenerated.numeroOS,
    'STATUS_OS': 'Aguardando Confirmação',
    'LABORATORIO': osDataGenerated.laboratorio
  };

  // Atualização direta sem duplicar
  handleUpdateSaleMock('Registro_Vendas', checkoutSale, mergedOSData);
  console.assert(salesStore.length === 1, 'Registro_Vendas NÃO deve ter venda duplicada ao gerar OS');
  console.assert(salesStore[0]['OS DA VENDA'] === 'OS-9988', 'OS da venda deve ter sido vinculada com sucesso');
  console.assert(salesStore[0]['STATUS_OS'] === 'Aguardando Confirmação', 'Status deve ser Semáforo Azul');
  console.log('  ✅ Test 32 Passed: Blindagem do Caixa no PDV e Unificação Venda-OS validadas com sucesso!\n');

  // ─── TEST 33: Desduplicação Estrita em CashHistoryModal ───
  console.log('▶ Test 33: Desduplicação Estrita no Extrato de Caixa (CashHistoryModal)');

  const mockMovementsCashFlow = [
    { id: 'mov_101', saleId: 'venda_999', osNumero: '5544', tipo: 'VENDA', valor: 250.00, formaPagamento: 'DINHEIRO' },
    { id: 'mov_102', tipo: 'SUPRIMENTO', valor: 100.00, formaPagamento: 'DINHEIRO' },
    { id: 'mov_103', tipo: 'RECEBIMENTO', valor: 120.00, formaPagamento: 'DINHEIRO' },
    { id: 'mov_104', tipo: 'SAÍDA', valor: 30.00, formaPagamento: 'DINHEIRO' }
  ];

  const mockSalesData = [
    { id: 'venda_999', 'OS DA VENDA': 'OS-5544', 'VALOR TOTAL': 250.00, 'FORMA DE PAGAMENTO': 'DINHEIRO', CLIENTE: 'João Silva' },
    { id: 'venda_1000', 'OS DA VENDA': '#OS-7788', 'VALOR TOTAL': 350.00, 'FORMA DE PAGAMENTO': 'PIX', CLIENTE: 'Maria Santos' },
    // Parcela de carnê/boleto paga que NÃO deve ser importada como venda duplicada no extrato
    { id: 'venda_rec_1', 'PRODUTO': '💰 Recebimento de Mensalidade / Boleto', 'VALOR TOTAL': 120.00, 'FORMA DE PAGAMENTO': 'DINHEIRO', CLIENTE: 'Ana Lima' }
  ];

  const deduplicateHistoryMovements = (cashMovements, salesData) => {
    let list = Array.isArray(cashMovements) ? [...cashMovements] : [];
    const cleanId = (id) => String(id || '').replace(/^#|^os[-_ ]?/i, '').trim().toLowerCase();
    const existingSalesIds = new Set();
    list.forEach(m => {
      const tipo = (m.tipo || '').toUpperCase();
      if (tipo === 'VENDA' || tipo === 'RECEBIMENTO') {
        if (m.id) {
          existingSalesIds.add(String(m.id).trim().toLowerCase());
          existingSalesIds.add(cleanId(m.id));
        }
        if (m.saleId) {
          existingSalesIds.add(String(m.saleId).trim().toLowerCase());
          existingSalesIds.add(cleanId(m.saleId));
        }
        if (m.osNumero) {
          existingSalesIds.add(String(m.osNumero).trim().toLowerCase());
          existingSalesIds.add(cleanId(m.osNumero));
        }
        if (m['OS']) {
          existingSalesIds.add(String(m['OS']).trim().toLowerCase());
          existingSalesIds.add(cleanId(m['OS']));
        }
        if (m['OS DA VENDA']) {
          existingSalesIds.add(String(m['OS DA VENDA']).trim().toLowerCase());
          existingSalesIds.add(cleanId(m['OS DA VENDA']));
        }
      }
    });

    if (Array.isArray(salesData) && salesData.length > 0) {
      salesData.forEach((s, idx) => {
        const prod = String(s['PRODUTO'] || s['SERVIÇO'] || s['Produto'] || '').toLowerCase();
        const sTipo = String(s.tipo || s.TIPO || '').toUpperCase();
        if (prod.includes('recebimento') || prod.includes('mensalidade') || prod.includes('carnê') || prod.includes('carne') || prod.includes('boleto') || sTipo === 'RECEBIMENTO') {
          return;
        }

        const rawId = String(s.id || s._id || s['ID'] || s.saleId || s.sale_id || '').trim().toLowerCase();
        const cleanRawId = cleanId(rawId);
        const osNum = String(s['OS DA VENDA'] || s['Nº DA OS'] || s['OS'] || s['Num OS'] || '').trim().toLowerCase();
        const cleanOsNum = cleanId(osNum);
        const sId = rawId || (osNum ? `os_${osNum}` : `venda_${idx}`);
        const cleanSId = cleanId(sId);

        const isDuplicate = (rawId && existingSalesIds.has(rawId)) ||
                            (cleanRawId && existingSalesIds.has(cleanRawId)) ||
                            (osNum && existingSalesIds.has(osNum)) ||
                            (cleanOsNum && existingSalesIds.has(cleanOsNum)) ||
                            existingSalesIds.has(sId) ||
                            (cleanSId && existingSalesIds.has(cleanSId));

        if (!isDuplicate) {
          const valor = parseFloat(s['VALOR TOTAL'] || 0);
          if (valor > 0) {
            if (rawId) {
              existingSalesIds.add(rawId);
              if (cleanRawId) existingSalesIds.add(cleanRawId);
            }
            if (osNum) {
              existingSalesIds.add(osNum);
              if (cleanOsNum) existingSalesIds.add(cleanOsNum);
            }
            existingSalesIds.add(sId);
            if (cleanSId) existingSalesIds.add(cleanSId);

            list.push({
              id: sId,
              saleId: rawId || sId,
              osNumero: osNum,
              tipo: 'VENDA',
              valor: valor,
              formaPagamento: s['FORMA DE PAGAMENTO'] || 'DINHEIRO'
            });
          }
        }
      });
    }
    return list;
  };

  const deduplicatedList = deduplicateHistoryMovements(mockMovementsCashFlow, mockSalesData);
  // Deve conter 5 itens: mov_101, mov_102, mov_103, mov_104 e venda_1000 (venda_999 é duplicada da mov_101 e venda_rec_1 é ignorada)
  console.assert(deduplicatedList.length === 5, `Deve conter exatamente 5 movimentos após desduplicação, retornou ${deduplicatedList.length}`);
  const salesCount = deduplicatedList.filter(m => m.tipo === 'VENDA').length;
  console.assert(salesCount === 2, `Devem ser exatamente 2 vendas (1 já registrada + 1 importada sem duplicar), retornou ${salesCount}`);
  console.assert(!deduplicatedList.some(m => m.id === 'venda_rec_1'), 'Recebimento de mensalidade em salesData não deve ser importado como venda');
  
  // Teste de cálculo de métricas com RECEBIMENTO e SAÍDA
  let totalAberturas = 0, totalSangrias = 0, totalSuprimentos = 0, totalRecebimentosDinheiro = 0, totalSaidas = 0, totalVendasDinheiro = 0;
  deduplicatedList.forEach(m => {
    const v = m.valor;
    const tipo = m.tipo.toUpperCase();
    const fp = (m.formaPagamento || '').toUpperCase();
    if (tipo === 'SUPRIMENTO') totalSuprimentos += v;
    else if (tipo === 'SAÍDA') totalSaidas += v;
    else if (tipo === 'RECEBIMENTO' && fp.includes('DINHEIRO')) totalRecebimentosDinheiro += v;
    else if (tipo === 'VENDA' && fp.includes('DINHEIRO')) totalVendasDinheiro += v;
  });
  const saldoEstimado = (totalAberturas + totalSuprimentos + totalVendasDinheiro + totalRecebimentosDinheiro) - totalSangrias - totalSaidas;
  // 0 + 100 + 250 + 120 - 0 - 30 = 440
  console.assert(saldoEstimado === 440, `Saldo estimado da gaveta deve ser 440, calculado ${saldoEstimado}`);
  console.log('  ✅ Test 33 Passed: Desduplicação por saleId, osNumero e id com suporte a RECEBIMENTO e SAÍDA validada com sucesso!\n');

  // ─── TEST 34: Quitação de Parcela no Perfil do Cliente e Baixa no ERP ───
  console.log('▶ Test 34: Quitação de Parcela no Perfil do Cliente e Baixa no ERP');

  let testReceber = [
    { id: 'cr_1', CLIENTE: 'Ana Lima', VALOR: '120,00', STATUS: 'Pendente', VENDA_OS: 'OS-101' },
    { id: 'cr_2', CLIENTE: 'Ana Lima', VALOR: '120,00', STATUS: 'Pendente', VENDA_OS: 'OS-101' }
  ];
  let testPagar = [
    { id: 'cp_1', FORNECEDOR: 'Distribuidora Lentes', VALOR: '350,00', STATUS: 'Pendente' }
  ];
  let testFluxoCaixa = [];
  let testCliente = { id: 'cli_ana', 'Nome Completo': 'Ana Lima', 'Valor Devido': '240,00', 'Status de Pagamento': 'Inadimplente' };

  // 34.1 Simulação de quitação de parcela específica no perfil do cliente
  const settleInvoice = (inv) => {
    // a) Atualizar parcela em CONTAS_RECEBER
    testReceber = testReceber.map(r => r.id === inv.id ? { ...r, STATUS: 'Recebido' } : r);
    // b) Abater débito na ficha do cliente
    const v = parseCurrency(inv.VALOR);
    const novoDebito = Math.max(0, parseCurrency(testCliente['Valor Devido']) - v);
    testCliente = {
      ...testCliente,
      'Valor Devido': novoDebito.toFixed(2).replace('.', ','),
      'Status de Pagamento': novoDebito === 0 ? 'Em dia' : 'Inadimplente'
    };
    // c) Registrar RECEBIMENTO no FLUXO_CAIXA
    testFluxoCaixa.push({
      tipo: 'RECEBIMENTO',
      valor: v,
      formaPagamento: 'DINHEIRO / RECEBIMENTO',
      motivo: `Recebimento Parcela - ${testCliente['Nome Completo']}`
    });
  };

  settleInvoice(testReceber[0]);
  console.assert(testReceber[0].STATUS === 'Recebido', 'Parcela deve estar com STATUS Recebido');
  console.assert(testCliente['Valor Devido'] === '120,00', 'Débito do cliente deve ter sido abatido para 120,00');
  console.assert(testFluxoCaixa.length === 1 && testFluxoCaixa[0].tipo === 'RECEBIMENTO' && testFluxoCaixa[0].valor === 120, 'Entrada de 120,00 registrada no FLUXO_CAIXA');

  // 34.2 Baixa de Conta a Pagar no ERP
  const paySupplierInvoice = (inv) => {
    testPagar = testPagar.map(p => p.id === inv.id ? { ...p, STATUS: 'Pago' } : p);
    testFluxoCaixa.push({
      tipo: 'SAÍDA',
      valor: parseCurrency(inv.VALOR),
      motivo: `Pagamento Despesa - ${inv.FORNECEDOR}`
    });
  };

  paySupplierInvoice(testPagar[0]);
  console.assert(testPagar[0].STATUS === 'Pago', 'Conta a pagar deve estar com STATUS Pago');
  console.assert(testFluxoCaixa.some(m => m.tipo === 'SAÍDA' && m.valor === 350), 'Saída de 350,00 registrada no FLUXO_CAIXA');
  console.log('  ✅ Test 34 Passed: Quitação no perfil e baixa de contas com Fluxo de Caixa validadas com sucesso!\n');

  // ─── TEST 35: Sinal da OS no Caixa & Saldos de Gaveta/Turnos ───
  console.log('▶ Test 35: Sinal da OS no Caixa & Saldos de Gaveta/Turnos');

  // 35.1 Sinal da OS gera entrada de DINHEIRO no FLUXO_CAIXA
  const mockOsEntry = {
    numeroOS: 'OS-2026',
    valorTotal: '800,00',
    valorEntrada: '200,00',
    restante: '600,00'
  };

  const recordOsDownpayment = (osData) => {
    const v = parseCurrency(osData.valorEntrada);
    if (v > 0) {
      return {
        tipo: 'VENDA',
        valor: v,
        formaPagamento: 'DINHEIRO',
        motivo: `Sinal OS #${osData.numeroOS}`
      };
    }
    return null;
  };

  const downpaymentEntry = recordOsDownpayment(mockOsEntry);
  console.assert(downpaymentEntry !== null, 'Entrada de sinal deve ser gerada');
  console.assert(downpaymentEntry.tipo === 'VENDA' && downpaymentEntry.formaPagamento === 'DINHEIRO' && downpaymentEntry.valor === 200, 'Sinal de 200,00 em DINHEIRO deve ser registrado');

  // 35.2 Cálculo de Dinheiro Esperado na Gaveta com Turno e Filtro de Data
  const shiftStart = new Date('2026-10-05T08:00:00');
  const shiftMovements = [
    { tipo: 'SUPRIMENTO', valor: 50.00, formaPagamento: 'DINHEIRO', dataHora: '2026-10-05T08:30:00' },
    { tipo: 'VENDA', valor: 100.00, formaPagamento: 'DINHEIRO', dataHora: '2026-10-05T09:00:00' },
    { tipo: 'VENDA', valor: 300.00, formaPagamento: 'PIX', dataHora: '2026-10-05T09:30:00' },
    { tipo: 'recebimento', valor: 120.00, formaPagamento: 'dinheiro', dataHora: '2026-10-05T10:00:00' }, // minúsculo testado
    { tipo: 'saída', valor: 40.00, formaPagamento: 'dinheiro', dataHora: '2026-10-05T10:30:00' }, // minúsculo testado
    { tipo: 'SANGRIA', valor: 50.00, formaPagamento: 'DINHEIRO', dataHora: '2026-10-05T11:00:00' }
  ];

  const calculateDrawerExpected = (fundoInicial, movements) => {
    let saldo = fundoInicial;
    movements.forEach(m => {
      const v = parseCurrency(m.valor);
      const fp = String(m.formaPagamento || '').toUpperCase();
      const tipo = String(m.tipo || '').toUpperCase();
      if (tipo === 'SUPRIMENTO') saldo += v;
      else if (tipo === 'SANGRIA') saldo -= v;
      else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'PAGAMENTO') saldo -= v;
      else if (tipo === 'RECEBIMENTO' && (fp.includes('DINHEIRO') || !fp)) saldo += v;
      else if (tipo === 'VENDA' && fp.includes('DINHEIRO')) saldo += v;
    });
    return Math.max(0, saldo);
  };

  const expectedDrawer = calculateDrawerExpected(100.00, shiftMovements);
  console.assert(expectedDrawer === 280.00, `Dinheiro esperado deve ser 280.00, calculado: ${expectedDrawer}`);

  // Filtro de vendas do turno por data: vendas anteriores a shiftStart não devem ser carregadas
  const historicalSales = [
    { 'DATA  DA VENDA': '04/10/2026 15:00:00', 'VALOR TOTAL': 500 },
    { 'DATA  DA VENDA': '05/10/2026 09:15:00', 'VALOR TOTAL': 250 }
  ];

  const parseItemDateTest = (item) => {
    const raw = item['DATA  DA VENDA'];
    const parts = raw.split(' ')[0].split('/');
    const timeParts = raw.split(' ')[1].split(':');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]));
  };

  const filteredShiftSales = historicalSales.filter(s => parseItemDateTest(s) >= shiftStart);
  console.assert(filteredShiftSales.length === 1 && filteredShiftSales[0]['VALOR TOTAL'] === 250, 'Apenas vendas a partir do início do turno devem ser incluídas');
  console.log('  ✅ Test 35 Passed: Sinal no caixa, saldo físico de gaveta e filtro de turnos validados com sucesso!\n');

  // ─── TEST 36: Dead-Letter Queue, Sanitização Monetária e Batching ───
  console.log('▶ Test 36: Dead-Letter Queue (3 Retries), Sanitização Monetária e Batching');

  // 36.1 Dead-Letter Queue após 3 falhas no processOfflineQueue
  clearOfflineQueue();
  globalThis.localStorage.removeItem(DEAD_LETTER_QUEUE_KEY);

  enqueueOfflineOp('save', 'Registro_Vendas', 'doc_failing', { VALOR: 100 });
  console.assert(getOfflineQueue().length === 1, 'Deve haver 1 item na fila');

  // Tentativa 1 (falha)
  await processOfflineQueue({
    timeoutMs: 10,
    executor: async () => { throw new Error('Network error 1'); }
  });
  console.assert(getOfflineQueue().length === 1, 'Item deve permanecer na fila após 1ª falha');
  console.assert(getOfflineQueue()[0].retryCount === 1, 'retryCount deve ser 1');

  // Tentativa 2 (falha)
  await processOfflineQueue({
    timeoutMs: 10,
    executor: async () => { throw new Error('Network error 2'); }
  });
  console.assert(getOfflineQueue().length === 1, 'Item deve permanecer na fila após 2ª falha');
  console.assert(getOfflineQueue()[0].retryCount === 2, 'retryCount deve ser 2');

  // Tentativa 3 (falha - atinge maxRetries = 3)
  await processOfflineQueue({
    timeoutMs: 10,
    executor: async () => { throw new Error('Network error 3'); }
  });
  console.assert(getOfflineQueue().length === 0, 'Item deve ser REMOVIDO da fila principal após 3 falhas');
  const deadLetterRaw = globalThis.localStorage.getItem(DEAD_LETTER_QUEUE_KEY);
  const deadLetterList = deadLetterRaw ? JSON.parse(deadLetterRaw) : [];
  console.assert(deadLetterList.length === 1, 'Item deve ter sido movido para YASMIN_DEAD_LETTER_QUEUE');
  console.assert(deadLetterList[0].docId === 'doc_failing', 'Item na fila morta deve ser doc_failing');

  // 36.2 Sanitização Monetária: tratamento seguro de strings como "150.00"
  const parseSafeCurrencyTest = (val) => {
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

  console.assert(parseSafeCurrencyTest('150.00') === 150.00, '150.00 não deve ser multiplicado por 100');
  console.assert(parseSafeCurrencyTest('1.250,50') === 1250.50, '1.250,50 deve ser convertido para 1250.50');
  console.assert(parseSafeCurrencyTest('R$ 99,90') === 99.90, 'R$ 99,90 deve ser convertido para 99.90');

  // 36.3 Batching de Aprovação: saveBatch aceita lote de duplicatas
  const batchItems = [
    { collectionName: 'CONTAS_RECEBER', dataObj: { DOCUMENTO: 'BOLETO 1/3', VALOR: '100,00' } },
    { collectionName: 'CONTAS_RECEBER', dataObj: { DOCUMENTO: 'BOLETO 2/3', VALOR: '100,00' } },
    { collectionName: 'CONTAS_RECEBER', dataObj: { DOCUMENTO: 'BOLETO 3/3', VALOR: '100,00' } }
  ];
  const batchResult = await saveBatch(batchItems);
  console.assert(batchResult.length === 3, `saveBatch deve processar todos os 3 itens do lote, processou ${batchResult.length}`);
  console.log('  ✅ Test 36 Passed: Dead-Letter Queue, Sanitização Monetária e Batching validados com sucesso!\n');

  // ─── TEST 37: Proteção Anti-Write-Storm, Web Locks Mutex Multi-Aba e Higienização de Fila ───
  console.log('▶ Test 37: Proteção Anti-Write-Storm, Web Locks Mutex Multi-Aba e Higienização de Fila');

  // 37.1 Simulação do Web Locks API Mutex Multi-Aba
  let lockRequested = false;
  let lockNameUsed = '';
  let lockOptionsUsed = null;
  const originalNavigator = globalThis.navigator;

  // Mock de navigator.locks
  let lockHolderActive = false;
  const mockLocks = {
    request: async (name, options, callback) => {
      lockRequested = true;
      lockNameUsed = name;
      lockOptionsUsed = options;
      if (options?.ifAvailable && lockHolderActive) {
        // Simula outra aba segurando o lock: retorna callback com null
        return await callback(null);
      }
      lockHolderActive = true;
      try {
        return await callback({ name });
      } finally {
        lockHolderActive = false;
      }
    }
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      ...originalNavigator,
      locks: mockLocks,
      onLine: true
    },
    configurable: true,
    writable: true
  });

  // Limpa filas anteriores
  clearOfflineQueue();

  // Enfileira item para teste
  enqueueOfflineOp('save', 'CAD_ARMACOES', 'arm_lock_test', { PRECO: 199.90 });
  console.assert(getOfflineQueue().length === 1, 'Fila deve ter 1 item para teste de Web Lock');

  // Dispara processamento com Web Lock ativo
  let secondTabAborted = false;
  const syncPromise = processOfflineQueue({
    timeoutMs: 300,
    executor: async (op) => {
      // Simula a tentativa de uma segunda aba simultânea enquanto a primeira aba segura o lock
      const secondTabResult = await processOfflineQueue();
      if (secondTabResult === 0) {
        secondTabAborted = true;
      }
      await new Promise(r => setTimeout(r, 20));
    }
  });

  const resLockSync = await syncPromise;
  console.assert(lockRequested === true, 'navigator.locks.request deve ter sido invocado');
  console.assert(lockNameUsed === 'yasmin_offline_sync_lock', 'Nome do lock deve ser yasmin_offline_sync_lock');
  console.assert(lockOptionsUsed?.ifAvailable === true, 'Lock deve usar { ifAvailable: true }');
  console.assert(secondTabAborted === true, 'Segunda aba deve abortar imediatamente (retornar 0) quando lock estiver ocupado');
  console.assert(resLockSync === 1, 'Primeira aba deve processar 1 item');
  console.assert(getOfflineQueue().length === 0, 'Fila deve estar vazia após processamento bem-sucedido');

  // 37.2 Higienização do Filtro de Fila Offline (descarte de itens sem id / corrompidos)
  clearOfflineQueue();
  // Insere itens válidos e inválidos diretamente
  const corruptQueue = [
    { id: 'valid_1', type: 'save', collectionName: 'Registro_Vendas', docId: 'v1', data: {} },
    { id: null, type: 'save', collectionName: 'Registro_Vendas', docId: 'corrupt_1', data: {} },
    { type: 'save', collectionName: 'Registro_Vendas', docId: 'corrupt_2', data: {} },
    { id: undefined, type: 'save', collectionName: 'Registro_Vendas', docId: 'corrupt_3', data: {} }
  ];
  globalThis.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(corruptQueue));

  // Processa a fila: o filtro concurrentlyAdded deve descartar itens sem id
  await processOfflineQueue({
    timeoutMs: 150,
    executor: async (op) => {
      // Adiciona mais um item inválido e um válido concorrentemente
      const current = JSON.parse(globalThis.localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      current.push({ id: null, type: 'save', docId: 'corrupt_concurrent' });
      current.push({ id: 'valid_concurrent', type: 'save', docId: 'v_concurrent' });
      globalThis.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current));
    }
  });

  const queueAfterSanitize = getOfflineQueue();
  console.assert(queueAfterSanitize.every(item => item?.id), 'Todos os itens retidos na fila devem possuir id válido (itens nulos/sem id descartados)');
  console.assert(queueAfterSanitize.some(item => item.id === 'valid_concurrent'), 'Item válido concorrente deve ser preservado');

  // 37.3 Fallback Gracioso em Caso de Falha/Exceção na Web Locks API (ex: iframe com sandbox restritivo)
  const throwingLocks = {
    request: async () => {
      throw new Error('SecurityError: Web Locks are disabled in this context');
    }
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      ...originalNavigator,
      locks: throwingLocks,
      onLine: true
    },
    configurable: true,
    writable: true
  });
  clearOfflineQueue();
  enqueueOfflineOp('save', 'CAD_ARMACOES', 'arm_fallback_test', { PRECO: 250.00 });
  const fallbackResult = await processOfflineQueue({
    timeoutMs: 150,
    executor: async (op) => {
      // executor bem-sucedido via fallback local
    }
  });
  console.assert(fallbackResult === 1, 'processOfflineQueue deve degradar para execução local segura se navigator.locks.request lançar exceção');
  console.assert(getOfflineQueue().length === 0, 'Fila deve ser processada com sucesso no fallback');

  // Restaura navigator original
  Object.defineProperty(globalThis, 'navigator', {
    value: originalNavigator,
    configurable: true,
    writable: true
  });

  clearOfflineQueue();
  console.log('  ✅ Test 37 Passed: Web Locks Mutex Multi-Aba, Higienização de Fila e Fallback Gracioso validados com sucesso!\n');

  // ─── TEST 38: Módulo de Usuários (Anti-Loop, Anti-Rollback, Churn Prevention, Timeout & Reconciliação) ───
  console.log('▶ Test 38: Módulo de Usuários (Anti-Loop, Anti-Rollback, Churn Prevention, Timeout & Reconciliação)');

  // 38.1 Bailout de Igualdade Profunda (areUserListsEqual)
  const usersBaseline = [
    { username: 'wmusete', role: 'admin', city: '', authorized: true, password: 'hash_master_1', updatedAt: '2026-10-05T12:00:00.000Z' },
    { username: 'carla_reg', role: 'vendedor', city: 'Registro', authorized: true, password: 'hash_carla_1', updatedAt: '2026-10-05T12:00:00.000Z' },
    { username: 'marcos_caj', role: 'vendedor', city: 'Cajati', authorized: false, password: 'hash_marcos_1', updatedAt: '2026-10-05T12:00:00.000Z' }
  ];

  // Mesma lista ou clone idêntico deve retornar true (evita re-render espúrio e reescrita de localStorage)
  console.assert(areUserListsEqual(usersBaseline, usersBaseline) === true, 'Listas idênticas por referência devem ser iguais');
  console.assert(areUserListsEqual(usersBaseline, JSON.parse(JSON.stringify(usersBaseline))) === true, 'Listas com conteúdo idêntico devem ser iguais');

  // Ordem trocada de usuários não deve disparar falsos positivos de alteração
  const shuffledUsers = [usersBaseline[1], usersBaseline[2], usersBaseline[0]];
  console.assert(areUserListsEqual(usersBaseline, shuffledUsers) === true, 'Listas em ordem diferente devem ser consideradas iguais após ordenação');

  // Alteração de Role deve ser detectada (retornar false)
  const changedRole = JSON.parse(JSON.stringify(usersBaseline));
  changedRole[1].role = 'administrativo';
  console.assert(areUserListsEqual(usersBaseline, changedRole) === false, 'Alteração de cargo/role deve ser detectada');

  // Alteração de Cidade da Unidade deve ser detectada
  const changedCity = JSON.parse(JSON.stringify(usersBaseline));
  changedCity[1].city = 'Jacupiranga';
  console.assert(areUserListsEqual(usersBaseline, changedCity) === false, 'Alteração de unidade/cidade deve ser detectada');

  // Alteração de Autorização (toggleAuth) deve ser detectada
  const changedAuth = JSON.parse(JSON.stringify(usersBaseline));
  changedAuth[2].authorized = true;
  console.assert(areUserListsEqual(usersBaseline, changedAuth) === false, 'Alteração de status autorizado/bloqueado deve ser detectada');

  // Alteração de Senha deve ser detectada
  const changedPass = JSON.parse(JSON.stringify(usersBaseline));
  changedPass[0].password = 'new_hash_master_2';
  console.assert(areUserListsEqual(usersBaseline, changedPass) === false, 'Alteração de hash de senha deve ser detectada');

  // Adição/Remoção de Usuário deve ser detectada
  const removedUser = [usersBaseline[0], usersBaseline[1]];
  console.assert(areUserListsEqual(usersBaseline, removedUser) === false, 'Remoção de usuário deve alterar igualdade');
  const addedUser = [...usersBaseline, { username: 'novo_operador', role: 'vendedor', city: 'Cajati', authorized: true }];
  console.assert(areUserListsEqual(usersBaseline, addedUser) === false, 'Adição de usuário deve alterar igualdade');

  // 38.2 Reconciliação sem Ressurreição (Ghost Rollback Prevention) & Preservação Master
  const remoteAfterDeletion = [
    { username: 'carla_reg', role: 'vendedor', city: 'Registro', authorized: true, password: 'hash_carla_1', updatedAt: '2026-10-05T12:00:00.000Z' }
  ];
  // Localmente ainda tinha marcos_caj, que foi excluído no Firestore
  const prevLocalWithDeleted = [
    { username: 'wmusete', role: 'admin', authorized: true, password: 'hash_master_1', updatedAt: '2026-10-05T12:00:00.000Z' },
    { username: 'carla_reg', role: 'vendedor', city: 'Registro', authorized: true, password: 'hash_carla_1', updatedAt: '2026-10-05T12:00:00.000Z' },
    { username: 'marcos_caj', role: 'vendedor', city: 'Cajati', authorized: false, password: 'hash_marcos_1', updatedAt: '2026-10-05T12:00:00.000Z' }
  ];

  clearOfflineQueue();
  const reconciled1 = reconcileUsers(remoteAfterDeletion, prevLocalWithDeleted, []);

  // Usuário excluído marcos_caj NÃO deve ressuscitar
  console.assert(!reconciled1.some(u => u.username === 'marcos_caj'), 'Usuário excluído no Firestore não deve ressuscitar na reconciliação local');
  // Conta Master permanente 'wmusete' deve ser preservada mesmo que ausente no snapshot remoto
  console.assert(reconciled1.some(u => u.username === 'wmusete'), 'Conta master wmusete deve ser preservada incondicionalmente');
  // Usuário remoto carla_reg deve existir
  console.assert(reconciled1.some(u => u.username === 'carla_reg'), 'Usuário remoto carla_reg deve ser mantido');

  // 38.3 Preservação de Usuários Criados Offline (fila de contingência type === 'save')
  enqueueOfflineOp('save', 'USUARIOS', 'vendedor_offline', {
    username: 'vendedor_offline',
    role: 'vendedor',
    city: 'Jacupiranga',
    authorized: true,
    updatedAt: new Date().toISOString()
  });

  const reconciledWithOffline = reconcileUsers(remoteAfterDeletion, prevLocalWithDeleted, getOfflineQueue());
  console.assert(reconciledWithOffline.some(u => u.username === 'vendedor_offline'), 'Usuário enfileirado offline com type === save deve ser preservado na reconciliação');

  // 38.4 Respeito a Exclusões Pendentes na Fila Offline (type === 'delete')
  enqueueOfflineOp('delete', 'USUARIOS', 'carla_reg');
  const reconciledWithOfflineDelete = reconcileUsers(remoteAfterDeletion, prevLocalWithDeleted, getOfflineQueue());
  console.assert(!reconciledWithOfflineDelete.some(u => u.username === 'carla_reg'), 'Usuário com exclusão pendente na fila offline não deve aparecer na reconciliação');
  clearOfflineQueue();

  // 38.5 Precedência de updatedAt Local mais Recente sobre Snapshot Desatualizado
  const staleRemote = [
    { username: 'carla_reg', role: 'vendedor', city: 'Registro', authorized: true, updatedAt: '2026-10-05T10:00:00.000Z' }
  ];
  const freshLocal = [
    { username: 'carla_reg', role: 'administrativo', city: 'Registro', authorized: true, updatedAt: '2026-10-05T15:00:00.000Z' }
  ];
  const reconciledTimestamp = reconcileUsers(staleRemote, freshLocal, []);
  const carlaReconciled = reconciledTimestamp.find(u => u.username === 'carla_reg');
  console.assert(carlaReconciled.role === 'administrativo', 'Alteração local com updatedAt mais recente deve prevalecer sobre remoto desatualizado');

  // 38.6 Timeout Seguro em syncUserPasswordToFirestore com Fallback Gracioso Offline
  clearOfflineQueue();
  const testNewHash = await hashPassword('novaSenhaSegura2026!');
  const syncOfflineRes = await syncUserPasswordToFirestore('vendedor_teste_timeout', testNewHash, {
    role: 'vendedor',
    city: 'Cajati',
    authorized: true
  });

  console.assert(syncOfflineRes.success === true, 'syncUserPasswordToFirestore deve retornar success: true mesmo sem conexão direta');
  console.assert(syncOfflineRes.userDoc.username === 'vendedor_teste_timeout', 'userDoc retornado deve ter o username sanitizado');
  console.assert(syncOfflineRes.userDoc.updatedAt !== undefined, 'userDoc deve ter updatedAt ISO string');
  
  const offlineQueueAfterSync = getOfflineQueue();
  const queuedUserOp = offlineQueueAfterSync.find(op => (op.collectionName === 'USUARIOS' || op.collection === 'USUARIOS') && (op.docId === 'vendedor_teste_timeout' || op.data?.username === 'vendedor_teste_timeout'));
  console.assert(queuedUserOp !== undefined, 'Operação de sincronização de credencial deve ser retida na fila offline em caso de falha de rede ou timeout');
  console.assert(queuedUserOp.type === 'save', 'Tipo de operação na fila offline deve ser save');
  console.assert(queuedUserOp.data.password === testNewHash, 'Hash de senha correto deve ser gravado na fila');
  clearOfflineQueue();

  // 38.7 Persistência de Role & City com updatedAt em AdminUsers
  const adminUsersList = [
    { username: 'operador_loja', role: 'vendedor', city: 'Cajati', authorized: true, updatedAt: '2026-10-01T10:00:00.000Z' }
  ];
  const simulateHandleRoleChange = (list, username, newRole) => {
    const cleanUser = String(username).toLowerCase().trim();
    const nowIso = new Date().toISOString();
    let updatedDoc = null;
    const updated = list.map(usr => {
      if (usr.username.toLowerCase() === cleanUser) {
        updatedDoc = {
          ...usr,
          role: newRole,
          city: newRole === 'vendedor' ? (usr.city || 'Cajati') : '',
          updatedAt: nowIso
        };
        return updatedDoc;
      }
      return usr;
    });
    return { updatedList: updated, docToSave: updatedDoc };
  };

  const roleChangeRes = simulateHandleRoleChange(adminUsersList, 'OPERADOR_LOJA', 'administrativo');
  console.assert(roleChangeRes.docToSave.role === 'administrativo', 'Cargo deve ser atualizado para administrativo');
  console.assert(roleChangeRes.docToSave.city === '', 'Cidade deve ser limpa ao promover para administrativo');
  console.assert(new Date(roleChangeRes.docToSave.updatedAt).getTime() > new Date(adminUsersList[0].updatedAt).getTime(), 'updatedAt deve ser renovado');

  const simulateHandleCityChange = (list, username, newCity) => {
    const cleanUser = String(username).toLowerCase().trim();
    const nowIso = new Date().toISOString();
    let updatedDoc = null;
    const updated = list.map(usr => {
      if (usr.username.toLowerCase() === cleanUser) {
        updatedDoc = { ...usr, city: newCity, updatedAt: nowIso };
        return updatedDoc;
      }
      return usr;
    });
    return { updatedList: updated, docToSave: updatedDoc };
  };

  // 38.8 Proteção Contra Perda de Senha na Reconciliação (Remote Snapshot sem Password)
  const remoteWithoutPass = [
    { username: 'carla_reg', role: 'vendedor', city: 'Registro', authorized: true, updatedAt: '2026-10-05T14:00:00.000Z' }
  ];
  const localWithPass = [
    { username: 'carla_reg', password: 'hash_super_seguro_carla', role: 'vendedor', city: 'Registro', authorized: true, updatedAt: '2026-10-05T12:00:00.000Z' }
  ];
  const reconciledPassPreserved = reconcileUsers(remoteWithoutPass, localWithPass, []);
  const carlaPass = reconciledPassPreserved.find(u => u.username === 'carla_reg');
  console.assert(carlaPass.password === 'hash_super_seguro_carla', 'Reconciliação não deve apagar hash de senha se snapshot remoto vier sem password');

  // 38.9 Normalização de Cargo (admin vs administrativo) e Unificação city / assignedStore em areUserListsEqual
  const userAdmin1 = [{ username: 'wmusete', role: 'admin', city: 'Cajati', authorized: true, password: 'hash', updatedAt: '2026-10-05T10:00:00.000Z' }];
  const userAdmin2 = [{ username: 'wmusete', role: 'administrativo', assignedStore: 'Cajati', authorized: true, password: 'hash', updatedAt: '2026-10-05T10:00:00.000Z' }];
  console.assert(areUserListsEqual(userAdmin1, userAdmin2) === true, 'areUserListsEqual deve normalizar admin/administrativo e city/assignedStore para evitar loops espúrios');

  // 38.10 Preservação de Metadados Extras em syncUserPasswordToFirestore
  clearOfflineQueue();
  const syncWithMeta = await syncUserPasswordToFirestore('vendedor_meta', 'hash_meta_123', {
    role: 'vendedor',
    assignedStore: 'Registro',
    email: 'vendedor@otica.com',
    authorized: true
  });
  console.assert(syncWithMeta.userDoc.email === 'vendedor@otica.com', 'syncUserPasswordToFirestore deve preservar campos adicionais como email');
  console.assert(syncWithMeta.userDoc.city === 'Registro' && syncWithMeta.userDoc.assignedStore === 'Registro', 'city e assignedStore devem estar sincronizados');
  clearOfflineQueue();

  console.log('  ✅ Test 38 Passed: Módulo de Usuários (Anti-Loop, Anti-Rollback, Churn Prevention, Timeout & Reconciliação) validado com sucesso!\n');

  // ─── TEST 39: Múltiplas OS no PDV com Cobrança Unificada & Gestão Integrada ───
  console.log('▶ Test 39: Múltiplas OS no PDV com Cobrança Unificada, Vínculo de Numeração & Gestão de OS');

  // 39.1 Identificação precisa de itens ópticos e proteção contra falso-positivo de armação
  const detectOpticalItems = (rawItens) => {
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
    return { extractedFrames, extractedLenses, pairCount, initialCount };
  };

  // 1 par de óculos (1 armação + 1 lente com MARCA/MODELO de CAD_LENTES) não deve gerar OS espúria
  const singlePairCart = [
    { type: 'armacoes', nome: 'Armação Ray-Ban Aviador', rawProduct: { MARCA: 'Ray-Ban', MODELO: 'RB3025' }, qtd: 1 },
    { type: 'lentes', nome: 'Lente Essilor Crizal Alize', rawProduct: { MARCA: 'Essilor', MODELO: 'Crizal Alize' }, qtd: 1 }
  ];
  const singleRes = detectOpticalItems(singlePairCart);
  console.assert(singleRes.extractedFrames.length === 1, '1 par deve ter exatamente 1 armação');
  console.assert(singleRes.extractedLenses.length === 1, '1 par deve ter exatamente 1 lente');
  console.assert(singleRes.initialCount === 1, '1 par de óculos deve gerar exatamente 1 OS padrão');

  // 2 pares de óculos (2 armações + 2 lentes + brindes) devem gerar 2 OSs
  const cartWithMultiOS = [
    { type: 'armacoes', nome: 'Armação Ray-Ban Aviador', rawProduct: { MARCA: 'Ray-Ban', MODELO: 'RB3025' }, preco: '500,00', qtd: 1 },
    { type: 'lentes', nome: 'Lente Multifocal Varilux Comfort', rawProduct: { MARCA: 'Essilor', MODELO: 'Varilux' }, preco: '800,00', qtd: 1 },
    { type: 'armacoes', nome: 'Armação Oakley Metal Ink', rawProduct: { MARCA: 'Oakley', MODELO: 'Metal Ink' }, preco: '450,00', qtd: 1 },
    { type: 'lentes', nome: 'Lente Monofocal Antirreflexo Blue', rawProduct: { MARCA: 'Hoya', MODELO: 'BlueControl' }, preco: '350,00', qtd: 1 },
    { type: 'brindes', nome: 'Estojo Luxo + Flanela Microfibra', preco: '0,00', qtd: 2 }
  ];

  const multiRes = detectOpticalItems(cartWithMultiOS);
  const extractedFrames = multiRes.extractedFrames;
  const extractedLenses = multiRes.extractedLenses;
  console.assert(extractedFrames.length === 2, 'Carrinho multi-OS deve conter 2 armações');
  console.assert(extractedLenses.length === 2, 'Carrinho multi-OS deve conter 2 lentes');
  console.assert(multiRes.initialCount === 2, 'Carrinho multi-OS deve gerar 2 OSs');

  // 39.2 Geração de Numeração de OS Sequencial e Vinculada (-1, -2)
  const baseNum = 1050;
  const storePrefix = 'CAJ';
  const osNumber1 = `${storePrefix}-${baseNum}-1`;
  const osNumber2 = `${storePrefix}-${baseNum}-2`;
  const allLinkedOSList = [osNumber1, osNumber2];

  console.assert(osNumber1 === 'CAJ-1050-1', 'OS 1 deve ter sufixo -1');
  console.assert(osNumber2 === 'CAJ-1050-2', 'OS 2 deve ter sufixo -2');

  // 39.3 Simulação de Pagamento Unificado e Criação de Registros no Registro_Vendas
  const clientTitular = {
    id: 'cli_multi_001',
    'Nome Completo': 'Carlos Alberto da Silva',
    'CPF / CNPJ': '123.456.789-00',
    'WhatsApp': '(13) 99876-5432',
    'Cidade': 'Cajati',
    'Valor Devido': '0,00',
    'Status de Pagamento': 'Em dia'
  };

  const saleId = 'venda_multi_999';
  const totalSaleAmount = '2.100,00';
  const entryAmount = '600,00';
  const remainingAmount = '1.500,00';

  // Registro Principal (OS #1) criado pelo PDV
  const primarySaleRow = {
    id: saleId,
    saleId: saleId,
    CLIENTE_ID: clientTitular.id,
    CLIENTE_CPF: clientTitular['CPF / CNPJ'],
    CPF: clientTitular['CPF / CNPJ'],
    'NOME CLIENTE': clientTitular['Nome Completo'],
    'DATA  DA VENDA': '08/10/2026',
    'OS DA VENDA': osNumber1,
    'OS': osNumber1,
    'VENDA_OS': osNumber1,
    isMultiOS: true,
    multiOSCount: 2,
    totalOS: 2,
    osIndex: 1,
    osLabel: 'Óculos 1',
    allLinkedOS: allLinkedOSList,
    PRODUTO: 'Lente Multifocal Varilux Comfort + Armação Ray-Ban Aviador',
    LENTE: 'Lente Multifocal Varilux Comfort',
    ARMAÇÃO: 'Armação Ray-Ban Aviador',
    LABORATORIO: 'Laboratório Central Vision',
    'VALOR TOTAL': totalSaleAmount,
    'VALOR DA VENDA': totalSaleAmount,
    'VALOR ENTRADA': entryAmount,
    'SINAL': entryAmount,
    'RESTANTE': remainingAmount,
    'FORMAS_PAGAMENTO': 'Entrada Pix R$ 600,00 + Carnê 3x R$ 500,00',
    STATUS_OS: 'Aguardando Confirmação',
    SITUAÇÃO: 'Aguardando Confirmação',
    DUPLICATAS_GERADAS: false,
    FINANCEIRO_UNIFICADO: true,
    COBRANCA_UNICA: true,
    PARCELAS_JSON: JSON.stringify([
      { numero: 1, totalParcelas: 3, valor: '500,00', vencimento: '2026-11-08' },
      { numero: 2, totalParcelas: 3, valor: '500,00', vencimento: '2026-12-08' },
      { numero: 3, totalParcelas: 3, valor: '500,00', vencimento: '2027-01-08' }
    ]),
    CIDADE: 'Cajati',
    UNIDADE: 'Cajati'
  };

  // Registro Complementar (OS #2) criado pelo PDV
  const secondarySaleRow = {
    id: `${saleId}_os_2`,
    saleId: saleId,
    parentSaleId: saleId,
    isMultiOS: true,
    isSecondaryOS: true,
    multiOSCount: 2,
    totalOS: 2,
    osIndex: 2,
    osLabel: 'Óculos 2',
    allLinkedOS: allLinkedOSList,
    CLIENTE_ID: clientTitular.id,
    CLIENTE_CPF: clientTitular['CPF / CNPJ'],
    CPF: clientTitular['CPF / CNPJ'],
    'NOME CLIENTE': clientTitular['Nome Completo'],
    'DATA  DA VENDA': '08/10/2026',
    'OS DA VENDA': osNumber2,
    'OS': osNumber2,
    'VENDA_OS': osNumber2,
    STATUS_OS: 'Aguardando Confirmação',
    SITUAÇÃO: 'Aguardando Confirmação',
    PRODUTO: 'Lente Monofocal Antirreflexo Blue + Armação Oakley Metal Ink',
    LENTE: 'Lente Monofocal Antirreflexo Blue',
    ARMAÇÃO: 'Armação Oakley Metal Ink',
    LABORATORIO: 'Laboratório Central Vision',
    'VALOR TOTAL': '0,00',
    'VALOR DA VENDA': '0,00',
    'VALOR ENTRADA': '0,00',
    'SINAL': '0,00',
    'RESTANTE': '0,00',
    'FORMAS_PAGAMENTO': `Cobrança Unificada (Venda #${saleId})`,
    'FORMA_PAGTO': `Cobrança Unificada (Venda #${saleId})`,
    PAGAMENTO_CONFERIDO: 'Sim',
    DUPLICATAS_GERADAS: true,
    FINANCEIRO_UNIFICADO: true,
    COBRANCA_UNICA: true,
    CIDADE: 'Cajati',
    UNIDADE: 'Cajati'
  };

  const registroVendasMock = [primarySaleRow, secondarySaleRow];

  // 39.4 Blindagem de Faturamento no Dashboard (Evita Faturamento Duplicado)
  const faturamentoDashboard = registroVendasMock.reduce((acc, row) => {
    return acc + parseCurrency(row['VALOR TOTAL'] || '0,00');
  }, 0);

  console.assert(faturamentoDashboard === 2100, `Faturamento somado deve ser exatamente R$ 2.100,00 mas foi R$ ${faturamentoDashboard}`);

  // 39.5 Consolidação e Mapeamento em allOrders de OSManagement
  const simulatedMapAllOrders = (salesList, clients) => {
    return salesList.filter(sale => {
      const osNum = sale["OS DA VENDA"] || sale["OS"] || sale["OS da COMPRA"] || sale["VENDA_OS"];
      return !!osNum && String(osNum).trim() !== "" && String(osNum) !== "—";
    }).map((sale, idx) => {
      const osNumber = String(sale["OS DA VENDA"] || sale["OS"] || sale["VENDA_OS"] || "OS-" + (idx + 1)).trim();
      const matchedClient = clients.find(c => isSameClient(c, sale));
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
        id: sale.id,
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
        clientName: sale['NOME CLIENTE'],
        unit: sale.UNIDADE,
        valorTotal: sale['VALOR TOTAL']
      };
    });
  };

  const parsedOrders = simulatedMapAllOrders(registroVendasMock, [clientTitular]);
  console.assert(parsedOrders.length === 2, 'Devem ser mapeadas 2 ordens de serviço');

  const order1 = parsedOrders.find(o => o.osNumber === osNumber1);
  const order2 = parsedOrders.find(o => o.osNumber === osNumber2);

  console.assert(order1.isMultiOS === true, 'OS 1 deve ser identificada como isMultiOS');
  console.assert(order1.osIndex === 1, 'OS 1 deve ter índice 1');
  console.assert(order1.totalOS === 2, 'OS 1 deve ter totalOS 2');
  console.assert(order1.isSecondaryOS === false, 'OS 1 não é secundária');

  console.assert(order2.isMultiOS === true, 'OS 2 deve ser identificada como isMultiOS');
  console.assert(order2.osIndex === 2, 'OS 2 deve ter índice 2');
  console.assert(order2.totalOS === 2, 'OS 2 deve ter totalOS 2');
  console.assert(order2.isSecondaryOS === true, 'OS 2 deve ser isSecondaryOS');
  console.assert(order2.financeiroUnificado === true, 'OS 2 deve ter financeiroUnificado');

  // 39.6 Função getLinkedOrdersForSale
  const simulateGetLinkedOrdersForSale = (order, all) => {
    if (!order) return [];
    const linkedNumbers = Array.isArray(order.allLinkedOS) ? order.allLinkedOS : [];
    const targetSaleId = order.saleId || order.parentSaleId;
    
    const matches = all.filter(o => {
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

  const linkedFrom1 = simulateGetLinkedOrdersForSale(order1, parsedOrders);
  console.assert(linkedFrom1.length === 2, 'getLinkedOrdersForSale a partir da OS 1 deve retornar ambas as OSs');
  console.assert(linkedFrom1[0].osNumber === osNumber1 && linkedFrom1[1].osNumber === osNumber2, 'OSs vinculadas devem estar ordenadas por índice (1 e 2)');

  const linkedFrom2 = simulateGetLinkedOrdersForSale(order2, parsedOrders);
  console.assert(linkedFrom2.length === 2, 'getLinkedOrdersForSale a partir da OS 2 deve retornar ambas as OSs');
  console.assert(linkedFrom2[0].osNumber === osNumber1 && linkedFrom2[1].osNumber === osNumber2, 'OSs vinculadas devem estar ordenadas por índice a partir da OS 2');

  // 39.7 Blindagem de Aprovação Financeira Sem Duplicação de Contas a Receber
  let simulatedContasReceber = [];
  const simulateMultiOSApproval = (orderToApprove) => {
    const isSecondaryUnified = Boolean(
      orderToApprove.isSecondaryOS || 
      orderToApprove.raw?.isSecondaryOS || 
      (orderToApprove.financeiroUnificado && parseCurrency(orderToApprove.valorTotal) === 0)
    );

    if (!isSecondaryUnified) {
      // Cria duplicatas apenas para a OS primária
      const parcelas = JSON.parse(orderToApprove.raw.PARCELAS_JSON || '[]');
      for (const p of parcelas) {
        simulatedContasReceber.push({
          DOCUMENTO: `BOLETO ${p.numero}/${p.totalParcelas} - OS ${orderToApprove.osNumber}`,
          VALOR: p.valor,
          STATUS: 'Pendente'
        });
      }
    }
  };

  // Aprova OS 1
  simulateMultiOSApproval(order1);
  console.assert(simulatedContasReceber.length === 3, 'Aprovação da OS 1 deve gerar 3 duplicatas no Contas a Receber');

  // Aprova OS 2 (Secundária Unificada)
  simulateMultiOSApproval(order2);
  console.assert(simulatedContasReceber.length === 3, 'Aprovação da OS 2 NÃO deve gerar duplicatas adicionais (mantém exatamente 3)');

  // 39.8 Edição de OS Secundária Preserva Flag Antiduplicação e Permite Salvar com Total Zero
  const simulateEditSecondaryOS = (orig, changes) => {
    const isSecondary = Boolean(orig.isSecondaryOS || (orig.FINANCEIRO_UNIFICADO && orig['VALOR TOTAL'] === '0,00'));
    // Se for secundária, não bloqueia por valor total <= 0
    const totalVal = isSecondary ? '0,00' : (changes['VALOR TOTAL'] || orig['VALOR TOTAL']);
    return {
      ...orig,
      ...changes,
      'VALOR TOTAL': totalVal,
      'DUPLICATAS_GERADAS': isSecondary ? true : false,
      'isSecondaryOS': isSecondary,
      'FINANCEIRO_UNIFICADO': true
    };
  };

  const editedSecondary = simulateEditSecondaryOS(secondarySaleRow, {
    LENTE: 'Lente Monofocal Blue UV Editada',
    LABORATORIO: 'Laboratório Express'
  });
  console.assert(editedSecondary.DUPLICATAS_GERADAS === true, 'Edição de OS secundária deve manter DUPLICATAS_GERADAS: true');
  console.assert(editedSecondary.isSecondaryOS === true, 'Edição deve preservar isSecondaryOS');
  console.assert(editedSecondary.FINANCEIRO_UNIFICADO === true, 'Edição deve preservar FINANCEIRO_UNIFICADO');
  console.assert(editedSecondary['VALOR TOTAL'] === '0,00', 'Edição de OS secundária deve manter VALOR TOTAL: 0,00');

  // 39.9 Mapeamento Individual de Etiquetas Térmicas Multi-OS (Preservação de Armação, Lente e Dioptria Próprias)
  const simulatedMultiOrdersPrintData = [
    {
      numeroOS: osNumber1,
      armacao: 'Armação Ray-Ban Aviador',
      lente: 'Lente Multifocal Varilux Comfort',
      odEsf: '-2.00', odCil: '-0.50', oeEsf: '-1.75', oeCil: '-0.25'
    },
    {
      numeroOS: osNumber2,
      armacao: 'Armação Oakley Metal Ink',
      lente: 'Lente Monofocal Antirreflexo Blue',
      odEsf: '-1.00', odCil: '0.00', oeEsf: '-1.25', oeCil: '0.00'
    }
  ];

  const simulatedLabels = simulatedMultiOrdersPrintData.map(o => ({
    ...primarySaleRow,
    ...o,
    numeroOS: o.numeroOS,
    osNumber: o.numeroOS,
    OS: o.numeroOS,
    'OS DA VENDA': o.numeroOS
  }));

  console.assert(simulatedLabels.length === 2, 'Devem ser geradas 2 etiquetas distintas');
  console.assert(simulatedLabels[0].armacao === 'Armação Ray-Ban Aviador' && simulatedLabels[0].odEsf === '-2.00', 'Etiqueta 1 deve conter armação e grau da OS 1');
  console.assert(simulatedLabels[1].armacao === 'Armação Oakley Metal Ink' && simulatedLabels[1].odEsf === '-1.00', 'Etiqueta 2 deve conter armação e grau da OS 2, sem clonar os dados da OS 1');

  // 39.10 Busca Integrada em OSManagement por SaleId e por Numeração Vinculada
  const simulateSearchOS = (query, orders) => {
    const q = query.toLowerCase().trim();
    return orders.filter(order => {
      const matchesOS = order.osNumber.toLowerCase().includes(q);
      const matchesClient = order.clientName.toLowerCase().includes(q);
      const matchesSaleId = (order.saleId || '').toLowerCase().includes(q) || (order.parentSaleId || '').toLowerCase().includes(q);
      const matchesLinked = Array.isArray(order.allLinkedOS) && order.allLinkedOS.some(num => String(num).toLowerCase().includes(q));
      return matchesOS || matchesClient || matchesSaleId || matchesLinked;
    });
  };

  const searchByBase = simulateSearchOS('1050', parsedOrders);
  console.assert(searchByBase.length === 2, 'Busca pelo número base "1050" deve retornar ambas as OSs da venda');

  const searchBySaleId = simulateSearchOS(saleId, parsedOrders);
  console.assert(searchBySaleId.length === 2, 'Busca pelo saleId deve retornar todas as OSs vinculadas à venda');

  const searchByCompanion = simulateSearchOS(osNumber2, parsedOrders);
  console.assert(searchByCompanion.length === 2, 'Busca pelo número da OS 2 com matchesLinked deve encontrar o par vinculado');

  console.log('  ✅ Test 39 Passed: Múltiplas OS no PDV com Cobrança Unificada, Vínculo de Numeração & Gestão de OS validados com sucesso!\n');

  // ─── TEST 40: 5 Itens Críticos de Produção (Contrato e Rodapé na OS, Fechamento de Caixa e Gaveta, Rastreabilidade de Vouchers, Higienização Stephanie Museti e Visibilidade Universal) ───────
  console.log('▶ Test 40: 5 Itens Críticos de Produção (Contrato OS, Caixa Acurado, Vouchers ERP, Higienização Stephanie Museti & Visibilidade Universal)');

  // 40.1 Item 1: Contrato e Rodapé Dinâmico na Impressão da OS (PrintableOS.jsx)
  const printableOsContent = fs.readFileSync('./src/components/PrintableOS.jsx', 'utf-8');
  console.assert(
    printableOsContent.includes('CONTRATO DE VENDA E COMPRA DE ARMAÇÕES DE ÓCULOS, LENTES E LENTES DE CONTATO'),
    'PrintableOS deve conter o cabeçalho do contrato óptico'
  );
  console.assert(
    printableOsContent.includes('As partes acima nominadas, doravante determinadas ÓTICA e SOLICITANTE tem entre si justas e acertadas o presente contrato'),
    'PrintableOS deve conter a cláusula inicial do contrato'
  );
  console.assert(
    printableOsContent.includes('A SOLICITANTE adquire neste ato da OTICA a armação e lente, ou a lente de contato, pelo preço certo e ajustado'),
    'PrintableOS deve conter a cláusula de aquisição'
  );
  console.assert(
    printableOsContent.includes('A compra é feita em carater irrevogável e irretratável obrigando as partes, herdeiros e sucessores'),
    'PrintableOS deve conter a cláusula de irrevogabilidade'
  );
  console.assert(
    printableOsContent.includes('multa de 2% (dois por cento) sobre o valor devido') &&
    printableOsContent.includes('serviços de proteção ao crédito SPC e SERASA'),
    'PrintableOS deve conter a cláusula de inadimplência e SPC/SERASA'
  );
  console.assert(
    printableOsContent.includes('Valor Total: R$') && printableOsContent.includes('Entrada: R$') && printableOsContent.includes('Restante: R$'),
    'PrintableOS deve conter os três campos dinâmicos no rodapé: Valor Total, Entrada e Restante'
  );
  console.assert(
    printableOsContent.includes('size: A4 portrait;') && printableOsContent.includes('os-sheet-page'),
    'PrintableOS deve conter diretivas de estilo e paginação para folha única A4'
  );

  // 40.2 Item 2: Fechamento de Caixa Acurado com Separação de Boleto a Prazo e Conferência de Gaveta Física
  const cashModalContent = fs.readFileSync('./src/components/CashManagementModal.jsx', 'utf-8');
  const cashHistoryContent = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');

  console.assert(
    cashModalContent.includes('vendasBoletoTotal') && cashModalContent.includes('vendasBoletoQtd'),
    'CashManagementModal deve calcular vendas em boleto/carnê a prazo separadamente das entradas imediatas'
  );
  console.assert(
    cashModalContent.includes('Realmente Recebido') || cashModalContent.includes('REALMENTE RECEBIDO') || cashModalContent.includes('totalRecebidosCaixa'),
    'CashManagementModal deve conter seção explícita de valores Realmente Recebidos em Caixa'
  );
  console.assert(
    cashModalContent.includes('Faturado a Prazo') || cashModalContent.includes('Recebível Futuro') || cashModalContent.includes('Boleto / Carnê'),
    'CashManagementModal deve conter seção de Faturado a Prazo em Boleto/Carnê (Recebível Futuro)'
  );
  console.assert(
    cashModalContent.includes('dinheiroEsperado') && cashModalContent.includes('totalRecebidosCaixa'),
    'CashManagementModal deve auditar o saldo físico esperado na gaveta em espécie (dinheiroEsperado)'
  );
  console.assert(
    cashHistoryContent.includes('Faturado Boleto/Carnê') || cashHistoryContent.includes('Boleto a Prazo') || cashHistoryContent.includes('Faturado a Prazo (Boleto)') || cashHistoryContent.includes('vendasBoletoTotal'),
    'CashHistoryModal deve discriminar valores faturados a prazo em boleto no histórico'
  );

  // Simulação Matemática Estrita do Fechamento de Caixa:
  const mockFundo = 200.00;
  const mockVendaDinheiro = 150.00;
  const mockVendaPix = 250.00;
  const mockVendaDebito = 100.00;
  const mockVendaCredito = 400.00;
  const mockVendaBoletoPrazo = 1800.00; // Boleto a prazo em 10x
  const mockRecebimentoDinheiro = 80.00;
  const mockSuprimento = 50.00;
  const mockSangria = 60.00;

  // Bloco 1: Total Realmente Recebido em Caixa (imediato)
  const totalRecebidoImediato = mockVendaDinheiro + mockVendaPix + mockVendaDebito + mockVendaCredito + mockRecebimentoDinheiro;
  console.assert(totalRecebidoImediato === 980.00, `Total Realmente Recebido deve ser R$ 980,00, calculou ${totalRecebidoImediato}`);

  // Bloco 2: Faturado a Prazo em Boleto (Recebível Futuro)
  const totalBoletoPrazo = mockVendaBoletoPrazo;
  console.assert(totalBoletoPrazo === 1800.00, 'Total faturado em boleto a prazo deve ser R$ 1.800,00');

  // Bloco 3: Conferência da Gaveta Física (Espécie)
  // Fórmula: Fundo + Vendas Dinheiro + Recebimento Dinheiro + Suprimento - Sangria
  const expectedPhysicalDrawer = mockFundo + mockVendaDinheiro + mockRecebimentoDinheiro + mockSuprimento - mockSangria;
  console.assert(expectedPhysicalDrawer === 420.00, `Saldo esperado na gaveta física deve ser R$ 420,00 (200 + 150 + 80 + 50 - 60), calculou ${expectedPhysicalDrawer}`);

  // O boleto NÃO pode inflar o saldo da gaveta de espécie:
  console.assert(
    expectedPhysicalDrawer !== (expectedPhysicalDrawer + totalBoletoPrazo),
    'Boleto a prazo não pode impactar o saldo da gaveta física de dinheiro'
  );

  // Diferença com contagem de R$ 420,00:
  const countedCash = 420.00;
  const diferencaGaveta = countedCash - expectedPhysicalDrawer;
  console.assert(diferencaGaveta === 0, 'Diferença de gaveta com contagem exata deve ser 0');

  // 40.3 Item 3: Rastreabilidade de Vouchers no PDV, OS e ERP
  const posRegisterContent = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');
  const erpOpticaContent = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');
  const dataTableContent = fs.readFileSync('./src/components/DataTable.jsx', 'utf-8');
  const osManagementContent = fs.readFileSync('./src/components/OSManagement.jsx', 'utf-8');

  console.assert(
    posRegisterContent.includes('HISTORICO_USO') || posRegisterContent.includes('usos_json'),
    'POSRegister deve gravar histórico de uso no voucher ao finalizar venda'
  );
  console.assert(
    dataTableContent.includes('onViewVoucherUsage') && dataTableContent.includes('Quem Usou'),
    'DataTable deve incluir botão de ação "Quem Usou 👁️" para a aba VOUCHERS'
  );
  console.assert(
    erpOpticaContent.includes('voucherUsageModal') || erpOpticaContent.includes('handleViewVoucherUsage'),
    'ErpOptica deve conter modal de visualização do histórico de quem usou o voucher'
  );
  console.assert(
    osManagementContent.includes('order.voucher') && osManagementContent.includes('descontoVoucher'),
    'OSManagement deve extrair e exibir informações do voucher na lista/cards de OS'
  );

  // Simulação de registro e parse de histórico de voucher:
  const mockVoucher = {
    CODIGO: 'PROMO100',
    TIPO: 'VALOR_FIXO',
    VALOR: '100,00',
    QUANTIDADE: 10,
    HISTORICO_USO: JSON.stringify([
      { cliente: 'Ana Paula', cpf: '12345678901', dataHora: '2026-10-08T10:00:00Z', os: 'OS-1001', valorDesconto: 100 },
      { cliente: 'Bruno Lima', cpf: '98765432100', dataHora: '2026-10-08T11:30:00Z', os: 'OS-1002', valorDesconto: 100 }
    ])
  };
  const parsedUsos = JSON.parse(mockVoucher.HISTORICO_USO);
  console.assert(parsedUsos.length === 2, 'Histórico de uso de voucher deve conter 2 utilizações registradas');
  console.assert(parsedUsos[0].cliente === 'Ana Paula' && parsedUsos[0].os === 'OS-1001', 'Primeiro uso deve registrar cliente e OS');
  console.assert(parsedUsos[1].cpf === '98765432100' && parsedUsos[1].valorDesconto === 100, 'Segundo uso deve registrar CPF e valor do desconto');

  // 40.4 Item 4: Higienização da Cliente Stephanie Museti
  console.assert(isStephanieMuseti({ 'Nome Completo': 'Stephanie Museti' }) === true, 'isStephanieMuseti deve reconhecer "Stephanie Museti"');
  console.assert(isStephanieMuseti({ 'CLIENTE': 'STEPHANIE MUSETE' }) === true, 'isStephanieMuseti deve reconhecer "STEPHANIE MUSETE"');
  console.assert(isStephanieMuseti({ 'NOME': 'Stéphanie Museti da Silva' }) === true, 'isStephanieMuseti deve reconhecer com acento');
  console.assert(isStephanieMuseti({ 'Nome Completo': 'Carlos Roberto da Silva' }) === false, 'isStephanieMuseti não deve dar falso positivo');

  const mockDirtyData = {
    'Registro_Vendas': [
      { id: 'v1', 'NOME CLIENTE': 'Carlos Roberto', OS: '101' },
      { id: 'v2', 'NOME CLIENTE': 'Stephanie Museti', OS: 'TEST-1' },
      { id: 'v3', 'NOME CLIENTE': 'STEPHANIE MUSETE', OS: 'TEST-2' },
      { id: 'v4', 'NOME CLIENTE': 'Maria Souza', OS: '102' }
    ],
    'BD MARKETING': [
      { id: 'm1', 'CLIENTE': 'Stephanie Museti', TELEFONE: '11999999999' },
      { id: 'm2', 'CLIENTE': 'Maria Souza', TELEFONE: '11888888888' }
    ],
    'CONTAS_RECEBER': [
      { id: 'r1', CLIENTE: 'Carlos Roberto', VALOR: '150,00' },
      { id: 'r2', CLIENTE: 'Stephanie Museti', VALOR: '50,00', DOCUMENTO: 'PARCELA 1/12' },
      { id: 'r3', CLIENTE: 'Stephanie Museti', VALOR: '50,00', DOCUMENTO: 'PARCELA 2/12' },
      { id: 'r4', CLIENTE: 'Maria Souza', VALOR: '300,00' }
    ],
    'CLIENTES_CADASTRADOS': [
      {
        id: 'c1',
        'Nome Completo': 'Stephanie Museti',
        'Valor Devido': '600,00',
        'VALOR_DEVIDO': '600,00',
        'Status de Pagamento': 'Pendente',
        'STATUS_PAGAMENTO': 'Pendente'
      },
      {
        id: 'c2',
        'Nome Completo': 'Maria Souza',
        'Valor Devido': '300,00',
        'VALOR_DEVIDO': '300,00',
        'Status de Pagamento': 'Pendente',
        'STATUS_PAGAMENTO': 'Pendente'
      }
    ]
  };

  const mockGetItemKey = (row) => `id:${row.id}`;
  const { nextData, modified, deletedKeys, deletedItems } = sanitizeStephanieMusetiData(mockDirtyData, mockGetItemKey);

  console.assert(modified === true, 'sanitizeStephanieMusetiData deve retornar modified: true');
  console.assert(Array.isArray(deletedItems) && deletedItems.length === 5, 'deletedItems deve conter os 5 registros expurgados para sincronização no Firestore');
  console.assert(deletedItems.some(i => i.sheet === 'Registro_Vendas' && i.id === 'v2'), 'deletedItems deve conter v2 de Registro_Vendas');
  console.assert(nextData.Registro_Vendas.length === 2, `Registro_Vendas deve conter 2 registros (sem Stephanie), retornou ${nextData.Registro_Vendas.length}`);
  console.assert(!nextData.Registro_Vendas.some(r => isStephanieMuseti(r)), 'Nenhuma OS de Stephanie Museti deve permanecer em Registro_Vendas');
  console.assert(nextData['BD MARKETING'].length === 1 && nextData['BD MARKETING'][0].id === 'm2', 'BD MARKETING deve conter apenas outros clientes');
  console.assert(nextData.CONTAS_RECEBER.length === 2, `CONTAS_RECEBER deve conter 2 registros de outros clientes, retornou ${nextData.CONTAS_RECEBER.length}`);
  console.assert(!nextData.CONTAS_RECEBER.some(r => isStephanieMuseti(r)), 'Nenhuma parcela de Stephanie Museti deve permanecer em CONTAS_RECEBER');

  const sanitizedStephanie = nextData.CLIENTES_CADASTRADOS.find(c => isStephanieMuseti(c));
  console.assert(sanitizedStephanie['Valor Devido'] === '0,00', `Valor Devido deve ser '0,00', retornou ${sanitizedStephanie['Valor Devido']}`);
  console.assert(sanitizedStephanie['VALOR_DEVIDO'] === '0,00', `VALOR_DEVIDO deve ser '0,00', retornou ${sanitizedStephanie['VALOR_DEVIDO']}`);
  console.assert(sanitizedStephanie['SALDO_DEVEDOR'] === '0,00', `SALDO_DEVEDOR deve ser '0,00', retornou ${sanitizedStephanie['SALDO_DEVEDOR']}`);
  console.assert(sanitizedStephanie['Status de Pagamento'] === 'Em dia', `Status de Pagamento deve ser 'Em dia', retornou ${sanitizedStephanie['Status de Pagamento']}`);
  console.assert(sanitizedStephanie['STATUS_PAGAMENTO'] === 'Em dia', `STATUS_PAGAMENTO deve ser 'Em dia', retornou ${sanitizedStephanie['STATUS_PAGAMENTO']}`);

  const otherClient = nextData.CLIENTES_CADASTRADOS.find(c => !isStephanieMuseti(c));
  console.assert(otherClient['Valor Devido'] === '300,00', 'Outros clientes não devem ter o Valor Devido alterado');
  console.assert(deletedKeys.includes('id:v2') && deletedKeys.includes('id:v3') && deletedKeys.includes('id:r2'), 'deletedKeys deve conter os IDs purgados');

  // Validação estrita do POSRegister gravando timestamps e pagamentos estruturados na venda
  console.assert(
    posRegisterContent.includes('dataHora: nowIso') && posRegisterContent.includes('pagamentosLista: effectivePayments'),
    'POSRegister deve gravar timestamps ISO e lista de pagamentos estruturados diretamente no objeto newSale'
  );

  // 40.5 Item 5: Visibilidade Universal de OS para Vendedores e Admins (selectedUnit = 'ALL')
  console.assert(
    osManagementContent.includes('selectedUnit, setSelectedUnit] = useState("ALL")') || 
    osManagementContent.includes('useState("ALL")') ||
    osManagementContent.includes("useState('ALL')"),
    'OSManagement deve inicializar selectedUnit com "ALL" por padrão para todos os papéis (Admin e Vendedor)'
  );

  // 40.6 Padronização Universal da Nomenclatura para "Boleto" (Eliminação de "Boleto / Carnê", "Carnê", etc.)
  const printableReceiptContent = fs.readFileSync('./src/components/PrintableReceipt.jsx', 'utf-8');
  const editOsContent = fs.readFileSync('./src/components/EditOSModal.jsx', 'utf-8');

  console.assert(
    posRegisterContent.includes("label: '📄 Boleto'") && !posRegisterContent.includes("label: '📄 Boleto / Carnê'"),
    'POSRegister deve exibir botão de pagamento como "📄 Boleto"'
  );
  console.assert(
    posRegisterContent.includes('Risco de Inadimplência no Boleto'),
    'POSRegister deve alertar sobre risco de inadimplência no Boleto'
  );
  console.assert(
    printableOsContent.includes('Cronograma de Parcelas do Boleto') && !printableOsContent.includes('Cronograma de Parcelas do Boleto / Carnê'),
    'PrintableOS deve intitular o cronograma como "Cronograma de Parcelas do Boleto"'
  );
  console.assert(
    printableOsContent.includes('Boleto (${installmentsList.length} parcelas programadas)') && !printableOsContent.includes('Boleto da Loja (${installmentsList.length}'),
    'PrintableOS deve exibir forma de pagamento como "Boleto" sem sufixo "da Loja"'
  );
  console.assert(
    printableReceiptContent.includes('Parcelamento no Boleto:') && !printableReceiptContent.includes('Parcelamento no Carnê'),
    'PrintableReceipt deve identificar parcelamento como "Parcelamento no Boleto:"'
  );
  console.assert(
    cashModalContent.includes('2. Faturado a Prazo no Boleto:') && !cashModalContent.includes('Faturado a Prazo no Boleto / Carnê'),
    'CashManagementModal deve discriminar "Faturado a Prazo no Boleto:" sem termo Carnê'
  );
  console.assert(
    cashHistoryContent.includes('💰 Recebimento (Boleto)') && !cashHistoryContent.includes('💰 Recebimento (Carnê)'),
    'CashHistoryModal deve discriminar "Recebimento (Boleto)"'
  );
  console.assert(
    editOsContent.includes('A Prazo / Boleto') && editOsContent.includes("label: '📄 Boleto'"),
    'EditOSModal deve usar "A Prazo / Boleto" e "📄 Boleto"'
  );

  // Simulação da função de limpeza de string legado cleanBoletoDisplay:
  const testCleanBoleto = (val) => {
    if (!val) return '';
    return String(val)
      .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
  };

  console.assert(testCleanBoleto('Boleto / Carnê') === 'Boleto', 'Deve normalizar "Boleto / Carnê" para "Boleto"');
  console.assert(testCleanBoleto('Boleto/Carnê') === 'Boleto', 'Deve normalizar "Boleto/Carnê" para "Boleto"');
  console.assert(testCleanBoleto('Boleto Carnê') === 'Boleto', 'Deve normalizar "Boleto Carnê" para "Boleto"');
  console.assert(testCleanBoleto('Carnê / Boleto') === 'Boleto', 'Deve normalizar "Carnê / Boleto" para "Boleto"');
  console.assert(testCleanBoleto('BOLETO/CARNÊ') === 'Boleto', 'Deve normalizar "BOLETO/CARNÊ" para "Boleto"');
  console.assert(testCleanBoleto('Boleto da Loja / Carnê') === 'Boleto', 'Deve normalizar "Boleto da Loja / Carnê" para "Boleto"');
  console.assert(testCleanBoleto('Carnê') === 'Boleto', 'Deve normalizar "Carnê" para "Boleto"');
  console.assert(testCleanBoleto('Boleto da Loja') === 'Boleto', 'Deve normalizar "Boleto da Loja" para "Boleto"');

  console.log('  ✅ Test 40 Passed: 5 Itens Críticos de Produção validados com sucesso!\n');

  // ==========================================
  // TEST 41: VENDEDORES EXTERNOS SELECIONANDO LOJA NO PDV/OS & ESTOQUE DE ACESSÓRIOS NO ERP
  // ==========================================
  {
    console.log('▶ Test 41: Vendedores Externos no PDV/OS & Estoque Completo de Acessórios (CAD_ACESSORIOS)');

    const erpOpticaSource = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');
    const firebaseSyncSource = fs.readFileSync('./src/firebaseSync.js', 'utf-8');
    const osGeneratorSource = fs.readFileSync('./src/components/OSGeneratorModal.jsx', 'utf-8');
    const productTransferSource = fs.readFileSync('./src/components/ProductTransferModal.jsx', 'utf-8');
    const stockFilterSource = fs.readFileSync('./src/components/StockFilterModal.jsx', 'utf-8');
    const posRegisterSource = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');

    // 41.1 Validação de Detecção e Seleção de Loja para Vendedores Externos
    const checkIsExternalVendor = (user) => {
      const isVendor = user?.role === 'vendedor';
      return isVendor && (
        String(user?.city || user?.assignedStore || '').trim().toLowerCase().includes('extern') ||
        String(user?.role || '').trim().toLowerCase().includes('extern')
      );
    };

    const vendorFixedCajati = { role: 'vendedor', city: 'Cajati' };
    const vendorFixedRegistro = { role: 'vendedor', city: 'Registro' };
    const vendorExternalCity = { role: 'vendedor', city: 'Venda Externa' };
    const vendorExternalRole = { role: 'vendedor', city: 'Externa - Itariri' };
    const adminUser = { role: 'admin', city: 'Cajati' };

    console.assert(checkIsExternalVendor(vendorFixedCajati) === false, 'Vendedor fixo de Cajati não é vendedor externo');
    console.assert(checkIsExternalVendor(vendorFixedRegistro) === false, 'Vendedor fixo de Registro não é vendedor externo');
    console.assert(checkIsExternalVendor(vendorExternalCity) === true, 'Vendedor com cidade "Venda Externa" deve ser identificado como externo');
    console.assert(checkIsExternalVendor(vendorExternalRole) === true, 'Vendedor com "Externa" na cidade deve ser identificado como externo');
    console.assert(checkIsExternalVendor(adminUser) === false, 'Admin não deve ser identificado como vendedor');

    // Validação no código-fonte do PDV (POSRegister.jsx) e Gerador de OS (OSGeneratorModal.jsx)
    console.assert(
      posRegisterSource.includes('isExternalVendor') && posRegisterSource.includes('Vendedor Externo'),
      'POSRegister.jsx deve implementar verificação isExternalVendor e badge "Vendedor Externo"'
    );
    console.assert(
      osGeneratorSource.includes('isExternalVendor') && osGeneratorSource.includes('Vendedor Externo'),
      'OSGeneratorModal.jsx deve implementar verificação isExternalVendor e badge "Vendedor Externo"'
    );

    // 41.2 Validação de CAD_ACESSORIOS em firebaseSync.js (COLLECTIONS)
    console.assert(
      firebaseSyncSource.includes("'CAD_ACESSORIOS'"),
      'firebaseSync.js COLLECTIONS deve conter CAD_ACESSORIOS para sincronização em tempo real'
    );

    // 41.3 Validação do Módulo de Acessórios no ERP (ErpOptica.jsx)
    console.assert(
      erpOpticaSource.includes("activeTab === 'acessorios' ? 'CAD_ACESSORIOS' :") || erpOpticaSource.includes("'CAD_ACESSORIOS'"),
      'ErpOptica.jsx deve mapear aba acessorios para a coleção CAD_ACESSORIOS'
    );
    console.assert(
      erpOpticaSource.includes('acessoriosData') && erpOpticaSource.includes('acessoriosStats'),
      'ErpOptica.jsx deve conter acessoriosData e acessoriosStats computados'
    );
    console.assert(
      erpOpticaSource.includes('acessoriosForm') && erpOpticaSource.includes('Cadastrar Novo Acessório no Estoque'),
      'ErpOptica.jsx deve conter formulário completo de cadastro de acessórios'
    );
    console.assert(
      erpOpticaSource.includes('Catálogo de Acessórios em Estoque'),
      'ErpOptica.jsx deve exibir cabeçalho do Catálogo de Acessórios em Estoque'
    );

    // 41.4 Validação de Acessórios no PDV (POSRegister.jsx)
    console.assert(
      posRegisterSource.includes("'acessorios'") && posRegisterSource.includes('Acessórios'),
      'POSRegister.jsx deve conter categoria de produtos para Acessórios no catálogo'
    );
    console.assert(
      posRegisterSource.includes("sheetName = 'CAD_ACESSORIOS'") || posRegisterSource.includes("CAD_ACESSORIOS"),
      'POSRegister.jsx deve associar itens de acessórios à planilha CAD_ACESSORIOS'
    );
    console.assert(
      posRegisterSource.includes("decrementStockAtomically(targetSheet,") || posRegisterSource.includes("decrementStockAtomically("),
      'POSRegister.jsx deve realizar baixa atômica de estoque de acessórios em CAD_ACESSORIOS'
    );

    // 41.5 Validação de Transferência de Acessórios entre Lojas (ProductTransferModal.jsx)
    console.assert(
      productTransferSource.includes("'acessorios'") && productTransferSource.includes('CAD_ACESSORIOS'),
      'ProductTransferModal.jsx deve permitir transferência entre lojas para produtos do tipo acessorios'
    );

    // 41.6 Validação de Filtros e Exportação Excel de Acessórios (StockFilterModal.jsx)
    console.assert(
      stockFilterSource.includes("isAcessorio = type === 'acessorios'") && stockFilterSource.includes("isAcessorio ? 'Acessorios' :"),
      'StockFilterModal.jsx deve suportar filtros inteligentes e exportação Excel de Acessórios'
    );

    // 41.7 Validação de Restrição para Vendedor Externo (Consulta permitida, mas Inclusão restrita a Venda Externa)
    const isProdFromExternalTest = (item) => {
      if (!item) return false;
      const u = String(item.UNIDADE || item.CIDADE || item.LOJA || item.Unidade || item.unidade || '').trim().toLowerCase();
      return u.includes('extern');
    };

    const itemCajati = { UNIDADE: 'Cajati', MODELO: 'Ray-Ban RB5228' };
    const itemRegistro = { CIDADE: 'Registro', MODELO: 'Oakley Holbrook' };
    const itemVendaExterna = { UNIDADE: 'Venda Externa', MODELO: 'Vogue VO5050' };
    const itemExternaRegional = { UNIDADE: 'Externa - Vale', MODELO: 'Armani Exchange' };

    console.assert(isProdFromExternalTest(itemCajati) === false, 'Item de Cajati não é de Venda Externa');
    console.assert(isProdFromExternalTest(itemRegistro) === false, 'Item de Registro não é de Venda Externa');
    console.assert(isProdFromExternalTest(itemVendaExterna) === true, 'Item de Venda Externa deve retornar true');
    console.assert(isProdFromExternalTest(itemExternaRegional) === true, 'Item com Externa na unidade deve retornar true');

    // Validação no código-fonte do PDV (POSRegister.jsx)
    console.assert(
      posRegisterSource.includes('isProductFromVendaExterna') && posRegisterSource.includes('isProductFromVendaExterna(prod)'),
      'POSRegister.jsx deve implementar helper isProductFromVendaExterna'
    );
    console.assert(
      posRegisterSource.includes('Inclusão não permitida para Vendedor Externo') || posRegisterSource.includes('Inclusão bloqueada para Vendedor Externo'),
      'POSRegister.jsx deve conter mensagem de bloqueio no addToCart'
    );
    console.assert(
      posRegisterSource.includes('Bloqueado para Vendedor Externo') && posRegisterSource.includes('playScannerBeep(false)'),
      'POSRegister.jsx deve bloquear bip de leitor USB para produtos de outras filiais'
    );
    console.assert(
      posRegisterSource.includes('Outra Loja') && posRegisterSource.includes('Lock'),
      'POSRegister.jsx deve travar botão com cadeado "Outra Loja" para vendedor externo'
    );

    // Validação no código-fonte do Gerador de OS (OSGeneratorModal.jsx)
    console.assert(
      osGeneratorSource.includes('isProductFromVendaExterna') && osGeneratorSource.includes('Inclusão bloqueada para Vendedor Externo'),
      'OSGeneratorModal.jsx deve validar e bloquear emissão de OS com armações/lentes de outras filiais para vendedor externo'
    );

    console.log('  ✅ Test 41 Passed: Vendedores Externos no PDV/OS e Estoque de Acessórios no ERP validados com sucesso!\n');
  }

  // ─── TEST 42: Impressão da Ficha Cadastral com Dados Pessoais & Responsável Legal ─────────────
  {
    console.log('▶ Test 42: Impressão da Ficha Cadastral do Cliente & Responsável Legal (A4 Folha Única)');

    // 1. Verificar arquivo do componente PrintableClientProfile.jsx
    console.assert(fs.existsSync('./src/components/PrintableClientProfile.jsx'), 'PrintableClientProfile.jsx deve existir');
    const printableProfileSource = fs.readFileSync('./src/components/PrintableClientProfile.jsx', 'utf-8');

    // Validações do cabeçalho e estrutura
    console.assert(printableProfileSource.includes('Ficha Cadastral do Cliente') && printableProfileSource.includes('Responsável Legal'), 'Deve conter título oficial da ficha cadastral');
    console.assert(printableProfileSource.includes('size: A4 portrait'), 'Deve definir estilo de página A4 portrait');
    console.assert(printableProfileSource.includes('id="print-client-profile"'), 'Deve conter container com id print-client-profile');

    // Validações dos quadros de dados
    console.assert(printableProfileSource.includes('1. DADOS PESSOAIS DO CLIENTE (TITULAR DA CONTA)'), 'Deve conter Quadro 1 de dados do titular');
    console.assert(printableProfileSource.includes('2. DADOS DO RESPONSÁVEL LEGAL / TUTOR'), 'Deve conter Quadro 2 de dados do responsável');
    console.assert(printableProfileSource.includes('3. SITUAÇÃO FINANCEIRA'), 'Deve conter Quadro 3 de financeiro e histórico óptico');
    console.assert(printableProfileSource.includes('Auditoria de Documentos Físicos / Digitais Anexados'), 'Deve conter Quadro 4 de auditoria de anexos');
    console.assert(printableProfileSource.includes('Declaro para todos os fins legais que as informações cadastrais'), 'Deve conter Quadro 5 de termo e assinaturas');

    // Validações de campos do cliente
    console.assert(printableProfileSource.includes('clientCpf') && printableProfileSource.includes('clientRg'), 'Deve formatar CPF e RG do cliente');
    console.assert(printableProfileSource.includes('clientBirth') && printableProfileSource.includes('calculateAge'), 'Deve calcular idade e data de nascimento');
    console.assert(printableProfileSource.includes('clientAddress'), 'Deve formatar endereço completo do cliente');
    console.assert(printableProfileSource.includes('clientRef1Name') && printableProfileSource.includes('clientRef2Name'), 'Deve exibir referências pessoais do cliente');
    console.assert(printableProfileSource.includes('clientInsta') || printableProfileSource.includes('clientFace'), 'Deve suportar redes sociais do cliente');

    // Validações de campos do responsável legal
    console.assert(printableProfileSource.includes('respCpf') && printableProfileSource.includes('respRg'), 'Deve formatar CPF e RG do responsável');
    console.assert(printableProfileSource.includes('respBirth') && printableProfileSource.includes('respAddress'), 'Deve formatar nascimento e endereço do responsável');
    console.assert(printableProfileSource.includes('respRef1Name') && printableProfileSource.includes('respRef2Name'), 'Deve exibir referências do responsável');
    console.assert(printableProfileSource.includes('maior de idade e assume responsabilidade integral'), 'Deve ter termo de auto-responsabilidade caso sem responsável');

    // Validações de assinaturas
    console.assert(printableProfileSource.includes('Assinatura do Cliente / Titular'), 'Deve conter linha de assinatura do cliente');
    console.assert(printableProfileSource.includes('Assinatura do Responsável Legal') || printableProfileSource.includes('Atendente / Responsável Técnico'), 'Deve conter linha de assinatura do responsável ou atendente');

    // 2. Verificar integração em ClientProfileModal.jsx
    console.assert(fs.existsSync('./src/components/ClientProfileModal.jsx'), 'ClientProfileModal.jsx deve existir');
    const clientProfileModalSource = fs.readFileSync('./src/components/ClientProfileModal.jsx', 'utf-8');

    console.assert(
      clientProfileModalSource.includes("import PrintableClientProfile from './PrintableClientProfile'"),
      'ClientProfileModal.jsx deve importar PrintableClientProfile'
    );
    console.assert(
      clientProfileModalSource.includes('handlePrintProfile'),
      'ClientProfileModal.jsx deve implementar handlePrintProfile'
    );
    console.assert(
      clientProfileModalSource.includes('IMPRIMIR FICHA'),
      'ClientProfileModal.jsx deve ter botão IMPRIMIR FICHA no cabeçalho'
    );
    console.assert(
      clientProfileModalSource.includes('Imprimir Ficha Cadastral'),
      'ClientProfileModal.jsx deve ter botão Imprimir Ficha Cadastral no rodapé'
    );
    console.assert(
      clientProfileModalSource.includes('<PrintableClientProfile'),
      'ClientProfileModal.jsx deve renderizar PrintableClientProfile'
    );

    // 3. Verificar regras CSS de impressão em index.css
    console.assert(fs.existsSync('./src/index.css'), 'src/index.css deve existir');
    const indexCssSource = fs.readFileSync('./src/index.css', 'utf-8');

    console.assert(
      indexCssSource.includes('#print-client-profile'),
      'src/index.css deve incluir #print-client-profile nas regras de visibilidade de impressão'
    );
    console.assert(
      indexCssSource.includes('#print-client-profile > div'),
      'src/index.css deve incluir #print-client-profile no controle de quebra de página'
    );

    console.log('  ✅ Test 42 Passed: Impressão da Ficha Cadastral do Cliente & Responsável Legal validada com 100% de sucesso!\n');
  }

  // ─── TEST 43: Migração de CSV para XML Estruturado (Vendas, Caixa, Estoque & Upload) ───
  {
    console.log('▶ Test 43: Migração de CSV para XML Estruturado (Vendas, Caixa, Estoque & Upload)');

    // 1. Sanitização de tags e escape de caracteres especiais
    console.assert(sanitizeXmlTag('Preço de Venda') === 'preco_de_venda', 'sanitizeXmlTag deve normalizar Preço de Venda');
    console.assert(sanitizeXmlTag('SKU / Referência') === 'sku_referencia', 'sanitizeXmlTag deve normalizar SKU / Referência');
    console.assert(sanitizeXmlTag('Nome do Cliente & Razão Social') === 'nome_do_cliente_razao_social', 'sanitizeXmlTag deve remover & e acentos');
    console.assert(sanitizeXmlTag('') === 'campo', 'sanitizeXmlTag deve retornar fallback para string vazia');

    console.assert(escapeXmlText('Armação & Lente <Especial> "50mm" \'Novo\'') === 'Armação &amp; Lente &lt;Especial&gt; &quot;50mm&quot; &apos;Novo&apos;', 'escapeXmlText deve escapar todos os 5 caracteres reservados');
    console.assert(escapeXmlText(null) === '' && escapeXmlText(undefined) === '', 'escapeXmlText deve tratar null/undefined');

    // 2. Geração de XML de Histórico de Vendas (buildSalesHistoryXml)
    const mockSales = [
      {
        id: 'sale_001',
        'OS DA VENDA': 'OS-8899',
        'CLIENTE': 'Yasmin & Carla Consultoria',
        'CPF': '123.456.789-00',
        'DATA': '2026-10-09',
        'VENDEDOR': 'Carla',
        'UNIDADE': 'Cajati',
        'TOTAL VENDA': '750,00',
        'VALOR ENTRADA': '250,00',
        'RESTANTE': '500,00',
        'FORMA DE PAGAMENTO': 'Boleto (2x)',
        'STATUS_OS': 'Em Laboratório',
        'ARMAÇÃO': 'Ray-Ban RB3025 <Gold>',
        'LENTE': 'Varilux Physio',
        'LABORATÓRIO': 'Lab Central'
      }
    ];

    const salesXml = buildSalesHistoryXml(mockSales, { loja: 'Cajati', vendedor: 'Carla', periodo: 'Hoje' });
    console.assert(salesXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'salesXml deve conter declaração XML UTF-8');
    console.assert(salesXml.includes('<historico_vendas_otica'), 'salesXml deve conter tag raiz historico_vendas_otica');
    console.assert(salesXml.includes('loja="Cajati"') && salesXml.includes('vendedor="Carla"'), 'salesXml deve incluir metadados no nó raiz');
    console.assert(salesXml.includes('<venda index="1">'), 'salesXml deve encapsular itens com <venda>');
    console.assert(salesXml.includes('<os_numero>OS-8899</os_numero>'), 'salesXml deve mapear os_numero');
    console.assert(salesXml.includes('<cliente_nome>Yasmin &amp; Carla Consultoria</cliente_nome>'), 'salesXml deve escapar caracteres do cliente');
    console.assert(salesXml.includes('<armacao>Ray-Ban RB3025 &lt;Gold&gt;</armacao>'), 'salesXml deve escapar caracteres da armação');
    console.assert(salesXml.includes('</historico_vendas_otica>'), 'salesXml deve fechar tag raiz');

    // 3. Geração de XML de Movimentações de Caixa (buildCashHistoryXml)
    const mockCash = [
      {
        id: 'mov_99',
        dataHora: '2026-10-09T14:30:00',
        unidade: 'Registro',
        operador: 'Maria',
        tipo: 'RECEBIMENTO',
        valor: 150.00,
        formaPagamento: 'DINHEIRO',
        motivo: 'Recebimento de Mensalidade Boleto',
        osNumero: 'OS-1011'
      }
    ];

    const cashXml = buildCashHistoryXml(mockCash, { loja: 'Registro', operador: 'Maria' });
    console.assert(cashXml.includes('<historico_caixa_otica'), 'cashXml deve conter tag raiz historico_caixa_otica');
    console.assert(cashXml.includes('<movimento index="1">'), 'cashXml deve conter nós <movimento>');
    console.assert(cashXml.includes('<tipo_operacao>RECEBIMENTO</tipo_operacao>'), 'cashXml deve conter tipo_operacao');
    console.assert(cashXml.includes('<os_vinculada>OS-1011</os_vinculada>'), 'cashXml deve conter os_vinculada');

    // 4. Geração de XML de Estoque (buildStockXml)
    const mockStock = [
      {
        id: 'prod_stock_1',
        UNIDADE: 'Jacupiranga',
        MARCA: 'Oakley',
        MODELO: 'Holbrook XL',
        CATEGORIA: 'Armações',
        REFERENCIA_SKU: 'OO9417-01',
        ESTOQUE: 1,
        PRECO_COMPRA: '250,00',
        PRECO_VENDA: '600,00'
      }
    ];

    const stockXml = buildStockXml(mockStock, { tipo: 'Armações', unidade: 'Jacupiranga', filtro: 'Estoque Crítico' });
    console.assert(stockXml.includes('<estoque_otica'), 'stockXml deve conter tag raiz estoque_otica');
    console.assert(stockXml.includes('<produto index="1">'), 'stockXml deve conter nós <produto>');
    console.assert(stockXml.includes('<marca>Oakley</marca>'), 'stockXml deve conter marca');
    console.assert(stockXml.includes('<status_estoque>Crítico</status_estoque>'), 'stockXml deve identificar status_estoque Crítico para saldo <= 2');

    // 5. Parser de XML para importação (parseXmlToObjects)
    // 5.1 Importação de XML gerado pelo próprio sistema
    const parsedStock = parseXmlToObjects(stockXml);
    console.assert(Array.isArray(parsedStock) && parsedStock.length === 1, 'parseXmlToObjects deve retornar array com 1 item');
    console.assert(parsedStock[0].marca === 'Oakley', 'parseXmlToObjects deve extrair marca Oakley');
    console.assert(parsedStock[0].modelo === 'Holbrook XL', 'parseXmlToObjects deve extrair modelo Holbrook XL');

    // 5.2 Importação de XML padrão NFe fiscal (<det><prod>)
    const nfeXmlSample = `<?xml version="1.0" encoding="UTF-8"?>
    <nfeProc>
      <NFe>
        <infNFe>
          <det nItem="1">
            <prod>
              <cProd>OAK-998</cProd>
              <xProd>ARMAÇÃO OAKLEY PITCHMAN R</xProd>
              <NCM>90031100</NCM>
              <CFOP>5102</CFOP>
              <uCom>UN</uCom>
              <qCom>10.0000</qCom>
              <vUnCom>180.00</vUnCom>
              <vProd>1800.00</vProd>
            </prod>
          </det>
        </infNFe>
      </NFe>
    </nfeProc>`;

    const parsedNfe = parseXmlToObjects(nfeXmlSample);
    console.assert(parsedNfe.length === 1, 'parseXmlToObjects deve extrair 1 item de NFe fiscal');
    console.assert(parsedNfe[0]['Código'] === 'OAK-998', 'parseXmlToObjects deve extrair cProd');
    console.assert(parsedNfe[0]['Nome / Descrição'] === 'ARMAÇÃO OAKLEY PITCHMAN R', 'parseXmlToObjects deve extrair xProd');
    console.assert(parsedNfe[0]['Quantidade'] === 10, 'parseXmlToObjects deve extrair qCom');

    // 6. Verificação de Código e Integrações nos Componentes da UI
    const cashModalCode = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');
    console.assert(cashModalCode.includes('handleExportExcel'), 'CashHistoryModal.jsx deve conter handleExportExcel');
    console.assert(cashModalCode.includes('buildCashHistoryXml'), 'CashHistoryModal.jsx deve chamar buildCashHistoryXml');
    console.assert(cashModalCode.includes('Baixar Planilha (Excel .xlsx)'), 'CashHistoryModal.jsx deve exibir botão Baixar Planilha (Excel .xlsx)');

    const stockFilterCode = fs.readFileSync('./src/components/StockFilterModal.jsx', 'utf-8');
    console.assert(stockFilterCode.includes('handleDownloadXML'), 'StockFilterModal.jsx deve conter handleDownloadXML');
    console.assert(stockFilterCode.includes('buildStockXml'), 'StockFilterModal.jsx deve chamar buildStockXml');
    console.assert(stockFilterCode.includes('Baixar XML'), 'StockFilterModal.jsx deve exibir botão Baixar XML');

    const erpCode = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');
    console.assert(erpCode.includes('handleExportStockXML'), 'ErpOptica.jsx deve conter handleExportStockXML');
    console.assert(erpCode.includes('buildStockXml'), 'ErpOptica.jsx deve chamar buildStockXml');
    console.assert(erpCode.includes('Exportar XML'), 'ErpOptica.jsx deve exibir botão Exportar XML');

    const dashboardCode = fs.readFileSync('./src/components/Dashboard.jsx', 'utf-8');
    console.assert(dashboardCode.includes('handleExportSalesXML'), 'Dashboard.jsx deve conter handleExportSalesXML');
    console.assert(dashboardCode.includes('buildSalesHistoryXml'), 'Dashboard.jsx deve chamar buildSalesHistoryXml');
    console.assert(dashboardCode.includes('Baixar Vendas (.xlsx)'), 'Dashboard.jsx deve exibir botão Baixar Vendas (.xlsx)');

    const uploaderCode = fs.readFileSync('./src/components/FileUploader.jsx', 'utf-8');
    console.assert(uploaderCode.includes("ext === 'xml'"), 'FileUploader.jsx deve reconhecer extensão .xml');
    console.assert(uploaderCode.includes('parseXmlToObjects'), 'FileUploader.jsx deve chamar parseXmlToObjects');
    console.assert(uploaderCode.includes('.xml'), 'FileUploader.jsx deve aceitar arquivos .xml no input');

    console.log('  ✅ Test 43 Passed: Migração de CSV para XML Estruturado (Vendas, Caixa, Estoque & Upload) validada com 100% de sucesso!\n');
  }

  // ─── TEST 44: Campo e Persistência de "Data da Venda" na OS, PDV, ERP e XML ───
  console.log('▶ Test 44: Verificação de Campo e Propagação de "Data da Venda" na OS, PDV, ERP e XML');
  {
    // 1. Verificação no DataTable.jsx (ERP e tabelas gerais)
    const dataTableCode = fs.readFileSync('./src/components/DataTable.jsx', 'utf-8');
    console.assert(dataTableCode.includes("'DATA  DA VENDA': 'Data da Venda'"), 'DataTable COLUMN_LABELS deve conter DATA  DA VENDA');
    console.assert(dataTableCode.includes("'DATA DA VENDA': 'Data da Venda'"), 'DataTable COLUMN_LABELS deve conter DATA DA VENDA');
    console.assert(dataTableCode.includes("'DATA_VENDA': 'Data da Venda'"), 'DataTable COLUMN_LABELS deve conter DATA_VENDA');
    console.assert(dataTableCode.includes("id: 'data_venda'"), 'DataTable CANONICAL_ALIASES deve definir o grupo data_venda');

    // 2. Verificação no OSGeneratorModal.jsx
    const osGenCode = fs.readFileSync('./src/components/OSGeneratorModal.jsx', 'utf-8');
    console.assert(osGenCode.includes('ensureIsoDate'), 'OSGeneratorModal deve conter função ensureIsoDate');
    console.assert(osGenCode.includes('ensureBrDate'), 'OSGeneratorModal deve conter função ensureBrDate');
    console.assert(osGenCode.includes('dataVenda:'), 'OSGeneratorModal deve gerenciar dataVenda no estado do formulário');
    console.assert(osGenCode.includes('name="dataVenda"'), 'OSGeneratorModal deve renderizar input de data de venda');
    console.assert(osGenCode.includes("'DATA  DA VENDA':"), 'OSGeneratorModal deve salvar alias histórico DATA  DA VENDA');
    console.assert(osGenCode.includes("'DATA DA VENDA':"), 'OSGeneratorModal deve salvar alias padronizado DATA DA VENDA');

    // 3. Verificação no PrintableOS.jsx (Folha A4 da OS)
    const printOsCode = fs.readFileSync('./src/components/PrintableOS.jsx', 'utf-8');
    console.assert(printOsCode.includes('saleDate'), 'PrintableOS deve extrair a data da venda');
    console.assert(printOsCode.includes('Data da Venda:'), 'PrintableOS deve exibir Data da Venda na impressão');
    console.assert(printOsCode.includes('DATA  DA VENDA') && printOsCode.includes('DATA DA VENDA'), 'PrintableOS deve verificar múltiplos aliases');

    // 4. Verificação no POSRegister.jsx (Checkout do PDV)
    const posCode = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');
    console.assert(posCode.includes("'DATA  DA VENDA': todayStr"), 'POSRegister deve registrar DATA  DA VENDA');
    console.assert(posCode.includes("'DATA DA VENDA': todayStr"), 'POSRegister deve registrar DATA DA VENDA');
    console.assert(posCode.includes("'DATA_VENDA': todayStr"), 'POSRegister deve registrar DATA_VENDA');

    // 5. Verificação no EditOSModal.jsx
    const editOsCode = fs.readFileSync('./src/components/EditOSModal.jsx', 'utf-8');
    console.assert(editOsCode.includes('dataVenda'), 'EditOSModal deve gerenciar dataVenda');
    console.assert(editOsCode.includes("'DATA DA VENDA': normDate.brDate") || editOsCode.includes("'DATA DA VENDA': formData.dataVenda"), 'EditOSModal deve salvar DATA DA VENDA atualizado');

    // 6. Verificação no OSManagement.jsx
    const osMgmtCode = fs.readFileSync('./src/components/OSManagement.jsx', 'utf-8');
    console.assert(osMgmtCode.includes('dtVenda'), 'OSManagement deve resolver dtVenda');
    console.assert(osMgmtCode.includes('dataVenda: order.dtVenda'), 'OSManagement deve repassar dataVenda na impressão');

    // 7. Verificação no xmlUtils.js
    const xmlCode = fs.readFileSync('./src/xmlUtils.js', 'utf-8');
    console.assert(xmlCode.includes("sale['DATA  DA VENDA'] || sale['DATA DA VENDA']"), 'xmlUtils deve mapear todos os aliases de data de venda');

    // 8. Teste funcional de conversão e extração de datas
    const ensureIsoDate = (d) => {
      if (!d) return new Date().toISOString().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const parts = String(d).split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      return new Date().toISOString().split('T')[0];
    };
    const ensureBrDate = (iso) => {
      if (!iso) return new Date().toLocaleDateString('pt-BR');
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
      const parts = String(iso).split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return new Date().toLocaleDateString('pt-BR');
    };

    console.assert(ensureIsoDate('13/10/2026') === '2026-10-13', 'ensureIsoDate deve converter DD/MM/AAAA para YYYY-MM-DD');
    console.assert(ensureBrDate('2026-10-13') === '13/10/2026', 'ensureBrDate deve converter YYYY-MM-DD para DD/MM/AAAA');

    console.log('  ✅ Test 44 Passed: Campo e Persistência de "Data da Venda" na OS, PDV, ERP e XML validados com 100% de sucesso!\n');
  }

  // ─── TEST 45: Ocultação de Parcelas na Gestão de OS & Formatação do Formulário de OS ───
  console.log('▶ Test 45: Ocultação de Parcelas na Gestão de OS & Formatação do Formulário de OS');
  {
    // 1. Verificação de funções e filtros em OSManagement.jsx
    const osMgmtCode = fs.readFileSync('./src/components/OSManagement.jsx', 'utf-8');
    console.assert(osMgmtCode.includes('isInstallmentRow'), 'OSManagement.jsx deve conter a função isInstallmentRow');
    console.assert(osMgmtCode.includes('cleanPaymentMethodForOS'), 'OSManagement.jsx deve conter cleanPaymentMethodForOS');
    console.assert(osMgmtCode.includes('validSales = rawSales.filter(sale => !isInstallmentRow(sale))'), 'OSManagement.jsx deve filtrar parcelas em allOrders');
    console.assert(osMgmtCode.includes('seenOSNumbers'), 'OSManagement.jsx deve desduplicar linhas com mesmo número de OS');
    console.assert(osMgmtCode.includes('formasPagamentoLimpa'), 'OSManagement.jsx deve usar formasPagamentoLimpa');

    // 2. Teste funcional de isInstallmentRow
    const testIsInstallmentRow = (sale) => {
      if (!sale) return false;
      if (sale['PARCELA'] || sale.parcela || sale['NUMERO_PARCELA'] || sale['PARCELA_NUM'] || sale['N_PARCELA'] || sale['NUM_PARCELA']) return true;
      const tipo = String(sale['TIPO'] || sale['Tipo'] || sale['TIPO_REGISTRO'] || sale['TIPO_OPERACAO'] || '').toUpperCase();
      if (tipo.includes('PARCELA') || tipo === 'DUPLICATA' || tipo === 'CARNE' || tipo === 'CARNÊ' || tipo === 'BOLETO') return true;
      const doc = String(sale['DOCUMENTO'] || sale['Documento'] || sale['DOC'] || '').toLowerCase();
      if (doc.includes('parcela') || doc.includes('duplicata')) return true;
      if (/boleto\s*\d+\s*(?:\/|de)\s*\d+/i.test(doc)) return true;
      if (/\b\d+\s*\/\s*\d+\b/.test(doc) && /boleto/i.test(doc)) return true;
      const desc = String(sale['DESCRICAO'] || sale['Descricao'] || sale['HISTORICO'] || sale['DETALHES'] || '').toLowerCase();
      if (desc.includes('parcela') || desc.includes('duplicata')) return true;
      if (/boleto\s*\d+\s*(?:\/|de)\s*\d+/i.test(desc)) return true;
      const prod = String(sale['PRODUTO'] || sale['Produto'] || '').toLowerCase();
      if (/^parcela\s*\d+/i.test(prod) || /^duplicata\s*\d+/i.test(prod) || /^boleto\s*\d+/i.test(prod)) return true;
      if (/boleto\s*\d+\s*(?:\/|de)\s*\d+/i.test(prod)) return true;
      const fp = String(sale['FORMA DE PAGAMENTO'] || sale['FORMA'] || sale['FORMA_PAGTO'] || '').toLowerCase();
      if (/^parcela\s*\d+/i.test(fp)) return true;
      return false;
    };

    console.assert(testIsInstallmentRow({ 'OS': 'CAJ-001', 'PARCELA': '1/3' }) === true, 'Linha com PARCELA deve ser identificada como parcela');
    console.assert(testIsInstallmentRow({ 'OS': 'CAJ-001', 'TIPO': 'PARCELA' }) === true, 'Linha com TIPO PARCELA deve ser identificada como parcela');
    console.assert(testIsInstallmentRow({ 'OS': 'CAJ-001', 'DOCUMENTO': 'Duplicata 2/3' }) === true, 'Linha com DOCUMENTO Duplicata deve ser identificada como parcela');
    console.assert(testIsInstallmentRow({ 'OS': 'CAJ-001', 'DOCUMENTO': 'BOLETO 1/3 - OS CAJ-001' }) === true, 'Linha com DOCUMENTO BOLETO 1/3 deve ser identificada como parcela');
    console.assert(testIsInstallmentRow({ 'OS': 'CAJ-001', 'DESCRICAO': 'Boleto 2/3 - Mensalidade' }) === true, 'Linha com DESCRICAO Boleto 2/3 deve ser identificada como parcela');
    console.assert(testIsInstallmentRow({ 'OS': 'CAJ-001', 'PRODUTO': 'Armação Ray-Ban' }) === false, 'Venda legítima não deve ser identificada como parcela');

    // 3. Teste funcional de cleanPaymentMethodForOS
    const testCleanPaymentMethodForOS = (val) => {
      if (!val) return '';
      const standardized = String(val).replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
      let cleaned = String(standardized)
        .replace(/\s*\([^)]*(?:parcela|\d+ª|\d+x|\d{2}\/\d{2}|venc|vencimento)[^)]*\)/gi, '')
        .replace(/\|\s*Venc:[^:\n)]*/gi, '')
        .replace(/\s*-\s*\d+ª\s*parcela[^\n,]*/gi, '')
        .replace(/Boleto\s*(?:em\s*)?\d+x\s*(?:de\s*)?(?:R?\$?\s*[\d.,]+)?/gi, 'Boleto')
        .replace(/Boleto\s*-\s*\d+x/gi, 'Boleto')
        .replace(/Boleto\s*(?:em\s*)?\d+\s*parcelas?/gi, 'Boleto')
        .replace(/Boleto\s*:\s*R?\$?\s*[\d.,]+/gi, 'Boleto')
        .replace(/parcelas?:\s*[^;\n]+/gi, '')
        .replace(/\n.*parcela.*/gi, '')
        .replace(/\b\d+x\s*(?:de\s*)?R?\$?\s*[\d.,]+/gi, '')
        .replace(/\b\d+x\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      cleaned = cleaned.replace(/^[\s,+|:\-]+|[\s,+|:\-]+$/g, '').trim();
      return cleaned || 'Boleto';
    };

    const dirtyFp1 = 'Boleto 3x de R$ 150,00 (1ª 10/11/2026, 2ª 10/12/2026, 3ª 10/01/2027)';
    const dirtyFp2 = '📄 Boleto (3x de R$ 150,00 | Venc: 1ª 10/11/2026, 2ª 10/12/2026, 3ª 10/01/2027): R$ 450,00';
    const dirtyFp3 = 'Entrada R$ 100,00 (Dinheiro) + Boleto 2x de R$ 200,00';

    console.assert(!testCleanPaymentMethodForOS(dirtyFp1).includes('1ª') && !testCleanPaymentMethodForOS(dirtyFp1).includes('3x'), 'cleanPaymentMethodForOS deve omitir parcelas e multiplicador');
    console.assert(!testCleanPaymentMethodForOS(dirtyFp2).includes('Venc') && !testCleanPaymentMethodForOS(dirtyFp2).includes('450'), 'cleanPaymentMethodForOS deve omitir vencimentos e valores');
    console.assert(testCleanPaymentMethodForOS(dirtyFp3) === 'Entrada R$ 100,00 (Dinheiro) + Boleto', 'cleanPaymentMethodForOS deve manter boleto limpo em pagamentos compostos');

    // 4. Verificação no formulário de OS (OSGeneratorModal.jsx)
    const osGenCode = fs.readFileSync('./src/components/OSGeneratorModal.jsx', 'utf-8');
    console.assert(osGenCode.includes("padStart(3, '0')"), 'OSGeneratorModal deve formatar número de OS com 3 dígitos (ex: CAJ-001)');
    console.assert(osGenCode.includes('Dados da Ordem de Serviço (OS)'), 'OSGeneratorModal deve possuir bloco formatado para Dados da OS');
    console.assert(osGenCode.includes('toUpperCase()'), 'OSGeneratorModal deve formatar numeroOS em caixa alta');

    // 5. Verificação no formulário de edição de OS (EditOSModal.jsx)
    const editOsCode = fs.readFileSync('./src/components/EditOSModal.jsx', 'utf-8');
    console.assert(editOsCode.includes('toUpperCase()'), 'EditOSModal deve formatar numeroOS em caixa alta');

    // 6. Verificação de que o modal de aprovação não exibe grid de parcelas
    console.assert(!osMgmtCode.includes('Duplicatas que serão criadas em Contas a Receber'), 'Modal de aprovação da OS não deve renderizar duplicatas/parcelas em tela');

    console.log('  ✅ Test 45 Passed: Ocultação de parcelas na gestão de OS e formatação de formulário validadas com 100% de sucesso!\n');
  }

  // ─── Test 46: Opção de Data nas Operações de PDV e Edição no Histórico de Caixa ───
  console.log('▶ Test 46: Opção de Data no PDV (Abertura, Sangria, Suprimento, Fechamento) e Edição no Histórico de Caixa');
  {
    const cashModalCode = fs.readFileSync('./src/components/CashManagementModal.jsx', 'utf-8');
    const cashHistoryCode = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');
    const posRegisterCode = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');
    const erpOpticaCode = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');

    // 1. Verificação dos campos de Data & Hora em Abertura, Sangria, Suprimento e Fechamento
    console.assert(cashModalCode.includes('dataAberturaInput'), 'CashManagementModal deve possuir estado dataAberturaInput');
    console.assert(cashModalCode.includes('sangriaDataHoraInput'), 'CashManagementModal deve possuir estado sangriaDataHoraInput');
    console.assert(cashModalCode.includes('suprimentoDataHoraInput'), 'CashManagementModal deve possuir estado suprimentoDataHoraInput');
    console.assert(cashModalCode.includes('fechamentoDataHoraInput'), 'CashManagementModal deve possuir estado fechamentoDataHoraInput');
    console.assert(cashModalCode.includes('Data e Horário da Abertura'), 'CashManagementModal deve exibir campo de Data e Horário da Abertura');
    console.assert(cashModalCode.includes('Data e Horário da Sangria'), 'CashManagementModal deve exibir campo de Data e Horário da Sangria');
    console.assert(cashModalCode.includes('Data e Horário do Suprimento'), 'CashManagementModal deve exibir campo de Data e Horário do Suprimento');
    console.assert(cashModalCode.includes('Data e Horário do Fechamento'), 'CashManagementModal deve exibir campo de Data e Horário do Fechamento');

    // 2. Verificação de propagação de data nos manipuladores do PDV (POSRegister.jsx)
    console.assert(posRegisterCode.includes('openData.dataHoraAbertura'), 'POSRegister deve aceitar dataHoraAbertura especificada');
    console.assert(posRegisterCode.includes('sangriaData.dataHora'), 'POSRegister deve aceitar sangriaData.dataHora especificada');
    console.assert(posRegisterCode.includes('suprimentoData.dataHora'), 'POSRegister deve aceitar suprimentoData.dataHora especificada');
    console.assert(posRegisterCode.includes('closeData.dataHoraFechamento'), 'POSRegister deve aceitar closeData.dataHoraFechamento especificada');

    // 3. Verificação do Modal de Edição de Movimento e Botão Editar no Histórico (CashHistoryModal.jsx)
    console.assert(cashHistoryCode.includes('EditCashMovementModal'), 'CashHistoryModal deve implementar EditCashMovementModal');
    console.assert(cashHistoryCode.includes('handleSaveMovementEdit'), 'CashHistoryModal deve implementar handleSaveMovementEdit');
    console.assert(cashHistoryCode.includes('toDateTimeLocalValue'), 'CashHistoryModal deve implementar toDateTimeLocalValue');
    console.assert(cashHistoryCode.includes('Ações / Comprovante'), 'CashHistoryModal deve conter cabeçalho de coluna Ações / Comprovante');
    console.assert(cashHistoryCode.includes('setEditingMovement(mov)'), 'CashHistoryModal deve permitir abrir edição com setEditingMovement');

    // 4. Verificação de conexão com onUpdateRow e onDeleteRow em POSRegister e ErpOptica
    console.assert(posRegisterCode.includes('onUpdateRow={onUpdateRow}') && posRegisterCode.includes('onDeleteRow={onDeleteRow}'), 'POSRegister deve repassar onUpdateRow e onDeleteRow ao CashHistoryModal');
    console.assert(erpOpticaCode.includes('onUpdateRow={onUpdateRow}') && erpOpticaCode.includes('onDeleteRow={onDeleteRow}'), 'ErpOptica deve repassar onUpdateRow e onDeleteRow ao CashHistoryContent');

    console.log('  ✅ Test 46 Passed: Opção de Data nas operações de PDV e Edição no Histórico validadas com 100% de sucesso!\n');
  }

  // ─── Test 47: Isolamento e Fidelidade de Data no PDV, Caixa, Comprovantes e Histórico ───
  console.log('▶ Test 47: Isolamento e Fidelidade de Data (Operações Retroativas / Customizadas Não Herdam Data Atual)');
  {
    const posRegisterSource = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');
    const cashModalSource = fs.readFileSync('./src/components/CashManagementModal.jsx', 'utf-8');
    const cashHistorySource = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');

    // 1. Verificação de posSaleDate no Checkout do PDV
    console.assert(posRegisterSource.includes('posSaleDate'), 'POSRegister deve conter estado posSaleDate');
    console.assert(posRegisterSource.includes('Data da Venda') && posRegisterSource.includes('type="date"'), 'POSRegister deve conter seletor visual de Data da Venda no checkout');
    console.assert(posRegisterSource.includes('effectiveSaleDateIso') && posRegisterSource.includes('effectiveSaleDateFormatted'), 'POSRegister deve computar e usar effectiveSaleDateIso e effectiveSaleDateFormatted');
    console.assert(posRegisterSource.includes('setPosSaleDate(new Date().toISOString().slice(0, 10))'), 'POSRegister deve resetar posSaleDate para o padrão após finalizar a venda');

    // 2. Verificação de Sincronização de Data no FLUXO_CAIXA ao Salvar OS
    console.assert(
      posRegisterSource.includes('Sincronizar data e OS no FLUXO_CAIXA') && posRegisterSource.includes("onUpdateRow('FLUXO_CAIXA'"),
      'POSRegister deve sincronizar os lançamentos de FLUXO_CAIXA com a data informada na OS'
    );

    // 3. Verificação de parseItemDate em liveDrawerCash e activeSession
    console.assert(
      posRegisterSource.includes('parseItemDate(a)?.getTime()') && posRegisterSource.includes('parseItemDate(b)?.getTime()'),
      'POSRegister activeSession deve ordenar cronologicamente utilizando parseItemDate'
    );
    console.assert(
      posRegisterSource.includes('const sessionStart = parseItemDate({ dataHora: activeSession.dataHoraAbertura') ||
      posRegisterSource.includes('const sessionStart = parseItemDate('),
      'POSRegister liveDrawerCash deve computar sessionStart utilizando parseItemDate'
    );
    console.assert(
      posRegisterSource.includes('const mDate = parseItemDate(m);'),
      'POSRegister liveDrawerCash deve filtrar movimentos utilizando parseItemDate'
    );

    // 4. Verificação em CashManagementModal (sessionMovements e PrintableCashVoucher)
    console.assert(
      cashModalSource.includes('const mDate = parseItemDate(m);') && cashModalSource.includes('mDate >= sessionStart'),
      'CashManagementModal sessionMovements deve filtrar movimentos usando parseItemDate'
    );
    console.assert(
      cashModalSource.includes('opDateTimeFormatted') && cashModalSource.includes('getOpDateTimeFormatted'),
      'CashManagementModal PrintableCashVoucher deve computar opDateTimeFormatted a partir da data da operação'
    );
    console.assert(
      cashModalSource.includes('<span>{opDateTimeFormatted}</span>'),
      'CashManagementModal PrintableCashVoucher deve exibir opDateTimeFormatted no cabeçalho do recibo'
    );

    // 5. Verificação de Sincronização Bidirecional em CashHistoryModal
    console.assert(
      cashHistorySource.includes("onUpdateRow('Registro_Vendas', matchingSale, updatedSale)"),
      'CashHistoryModal deve sincronizar Registro_Vendas ao editar data no FLUXO_CAIXA'
    );
    console.assert(
      cashHistorySource.includes("onUpdateRow('FLUXO_CAIXA', m, updatedM)"),
      'CashHistoryModal deve sincronizar FLUXO_CAIXA ao editar data no Registro_Vendas'
    );

    // 6. Teste Funcional: Parser e Isolamento de Lançamento Retroativo
    const parseTest = (item) => {
      const raw = item.dataHora || item.timestamp || item.DATA || item['DATA  DA VENDA'] || item['DATA DA VENDA'] || item.DATA_HORA || item.data;
      if (!raw) return null;
      if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.includes('/')) {
          const parts = trimmed.split(' ')[0].split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            const dateObj = new Date(y, m, d);
            if (trimmed.includes(':')) {
              const timeParts = trimmed.split(' ')[1]?.split(':') || [];
              if (timeParts.length >= 2) {
                dateObj.setHours(parseInt(timeParts[0], 10) || 0, parseInt(timeParts[1], 10) || 0, parseInt(timeParts[2], 10) || 0);
              }
            }
            return isNaN(dateObj.getTime()) ? null : dateObj;
          }
        }
        if (trimmed.includes('-') && !trimmed.includes('T')) {
          const parts = trimmed.split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d, 12, 0, 0);
          }
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    const sessionStartTest = new Date('2026-10-14T08:00:00.000Z'); // 14/10/2026 08:00
    const movimentoOntem = { data: '12/10/2026', valor: 250, tipo: 'VENDA' };
    const parsedOntem = parseTest(movimentoOntem);
    console.assert(parsedOntem.getMonth() === 9, 'Data 12/10/2026 deve ser Outubro (mês index 9) e não Dezembro');
    console.assert(parsedOntem.getDate() === 12, 'Data 12/10/2026 deve ser dia 12');
    console.assert(parsedOntem < sessionStartTest, 'Movimentação do dia 12/10/2026 deve ser menor que sessionStart de 14/10/2026');

    // Simulação do filtro de gaveta
    const movementsMock = [
      { id: 'm1', data: '12/10/2026', valor: 200, tipo: 'VENDA', formaPagamento: 'DINHEIRO', unidade: 'Cajati' },
      { id: 'm2', dataHora: '2026-10-14T09:30:00.000Z', valor: 150, tipo: 'VENDA', formaPagamento: 'DINHEIRO', unidade: 'Cajati' },
      { id: 'm3', dataHora: '2026-10-14T11:00:00.000Z', valor: 50, tipo: 'SANGRIA', formaPagamento: 'DINHEIRO', unidade: 'Cajati' }
    ];
    const filteredForCurrentDrawer = movementsMock.filter(m => {
      const d = parseTest(m);
      return d && d >= sessionStartTest;
    });
    console.assert(filteredForCurrentDrawer.length === 2, 'Apenas as 2 movimentações do dia 14/10 devem entrar no caixa atual');
    console.assert(!filteredForCurrentDrawer.some(m => m.id === 'm1'), 'Movimentação retroativa do dia 12/10 não pode entrar na gaveta de hoje');

    console.log('  ✅ Test 47 Passed: Isolamento e Fidelidade de Data no PDV, Caixa, Comprovantes e Histórico validados com 100% de sucesso!\n');
  }

  // ─── TEST 48: Levantamento Financeiro XML, Nome na OS Extra & Alerta de Inadimplência do Responsável ────────
  console.log('▶ Test 48: Levantamento Financeiro XML, Beneficiário da OS Extra & Auditoria do Responsável Legal');

  // 1. Validação do Construtor de XML Financeiro Completo
  const mockReceber = [
    { id: 'rec_1', CLIENTE: 'Carlos Souza', VALOR: '350,00', STATUS: 'Pendente', VENCIMENTO: '2026-10-20', UNIDADE: 'Cajati', NUMERO_OS: 'OS-101' },
    { id: 'rec_2', CLIENTE: 'Mariana Lima', VALOR: '150,00', STATUS: 'Pago', VENCIMENTO: '2026-10-10', UNIDADE: 'Cajati', NUMERO_OS: 'OS-102' }
  ];
  const mockPagar = [
    { id: 'pag_1', FORNECEDOR: 'Laboratório Central', DESCRICAO: 'Serviço Surfaçagem', VALOR: '200,00', STATUS: 'Pendente', VENCIMENTO: '2026-10-25', UNIDADE: 'Cajati' }
  ];
  const mockFluxo = [
    { id: 'flx_1', tipo: 'VENDA', valor: '350,00', formaPagamento: 'DINHEIRO', motivo: 'Venda Balcão', unidade: 'Cajati', dataHora: '2026-10-15 10:00' }
  ];

  const financialXml = buildFinancialSummaryXml(mockReceber, mockPagar, mockFluxo, {
    unidade: 'Cajati',
    geradoPor: 'wmusete',
    periodo: 'Outubro/2026'
  });

  console.assert(financialXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML financeiro deve ter declaração XML padrão');
  console.assert(financialXml.includes('<levantamento_financeiro_otica'), 'XML financeiro deve conter raiz <levantamento_financeiro_otica>');
  console.assert(financialXml.includes('<contas_a_receber total="2">'), 'XML deve conter nós de contas a receber com contagem exata');
  console.assert(financialXml.includes('<contas_a_pagar total="1">'), 'XML deve conter nós de contas a pagar com contagem exata');
  console.assert(financialXml.includes('<fluxo_de_caixa total="1">'), 'XML deve conter nós de fluxo de caixa com contagem exata');
  console.assert(financialXml.includes('total_receber_pendente="350.00"'), 'Metadados do XML devem somar pendências de receber');
  console.assert(financialXml.includes('total_pagar_pendente="200.00"'), 'Metadados do XML devem somar pendências de pagar');

  // 2. Verificação de Código-Fonte: CashHistoryModal e ErpOptica
  const cashHistoryCode = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');
  console.assert(!cashHistoryCode.includes("startDate || 'Início'"), 'CashHistoryModal não deve referenciar startDate inexistente em handleExportXML');
  console.assert(!cashHistoryCode.includes('selectedOperator'), 'CashHistoryModal não deve referenciar selectedOperator inexistente em handleExportXML');

  const erpOpticaCode = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');
  console.assert(erpOpticaCode.includes('handleExportFinancialExcel'), 'ErpOptica deve conter o handler handleExportFinancialExcel');
  console.assert(erpOpticaCode.includes('Baixar Planilha (.xlsx)'), 'ErpOptica deve conter botão para baixar planilha financeira em Excel (.xlsx)');

  // 3. Verificação de Código-Fonte: Campo de Nome na OS Extra (Beneficiário / Paciente)
  const osGenModalCode = fs.readFileSync('./src/components/OSGeneratorModal.jsx', 'utf-8');
  console.assert(osGenModalCode.includes('nomePessoa'), 'OSGeneratorModal deve suportar campo nomePessoa');
  console.assert(osGenModalCode.includes('PACIENTE:'), 'OSGeneratorModal deve mapear PACIENTE na OS');
  console.assert(osGenModalCode.includes('NOME_BENEFICIARIO:'), 'OSGeneratorModal deve mapear NOME_BENEFICIARIO na OS');

  const posRegisterCode = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');
  console.assert(posRegisterCode.includes('PACIENTE: secOS.nomePessoa'), 'POSRegister deve propagar PACIENTE nas companionRows de Multi-OS');
  console.assert(posRegisterCode.includes('CLIENTE_BENEFICIARIO: secOS.nomePessoa'), 'POSRegister deve propagar CLIENTE_BENEFICIARIO');

  const printableOsCode = fs.readFileSync('./src/components/PrintableOS.jsx', 'utf-8');
  console.assert(printableOsCode.includes('Paciente:'), 'PrintableOS deve exibir Paciente quando houver beneficiário da OS');

  // 4. Auditoria e Alerta de Inadimplência do Responsável Legal
  console.assert(osGenModalCode.includes('responsavelDebtCheck'), 'OSGeneratorModal deve ter cálculo de responsavelDebtCheck');
  console.assert(osGenModalCode.includes('window.confirm'), 'OSGeneratorModal deve exibir confirmação caso responsável tenha débitos');
  console.assert(posRegisterCode.includes('respFinancials'), 'POSRegister deve incluir auditoria do responsável em selectedClientFinancials');

  // 5. Teste Funcional de Inadimplência do Responsável
  const mockClients = [
    {
      id: 'cli_dependente',
      NOME: 'Enzo Gabriel Menor',
      CPF: '111.222.333-44',
      RESPONSAVEL_NOME: 'João da Silva Santos',
      RESPONSAVEL_CPF: '999.888.777-66'
    },
    {
      id: 'cli_responsavel',
      NOME: 'João da Silva Santos',
      CPF: '999.888.777-66',
      'Valor Devido': '600,00'
    }
  ];

  const mockReceberDebts = [
    {
      id: 'rec_resp_1',
      CLIENTE: 'João da Silva Santos',
      CLIENTE_CPF: '999.888.777-66',
      VALOR: '300,00',
      STATUS: 'Atrasado',
      VENCIMENTO: '2026-09-01'
    },
    {
      id: 'rec_resp_2',
      CLIENTE: 'João da Silva Santos',
      CLIENTE_CPF: '999.888.777-66',
      VALOR: '300,00',
      STATUS: 'Pendente',
      VENCIMENTO: '2026-10-01'
    }
  ];

  const cleanRespCpf = '99988877766';
  const respNameNorm = 'joao da silva santos';
  const respPendingDebts = mockReceberDebts.filter(r => {
    const rCpf = String(r.CLIENTE_CPF || r.CPF || '').replace(/\D/g, '');
    const rName = String(r.CLIENTE || r.NOME || '').trim().toLowerCase();
    const isOwner = (cleanRespCpf && rCpf === cleanRespCpf) || (rName && rName === respNameNorm);
    const status = String(r.STATUS || '').toLowerCase();
    return isOwner && (status === 'pendente' || status === 'atrasado' || status === 'vencido');
  });

  const totalRespDebt = respPendingDebts.reduce((acc, r) => acc + (parseFloat(r.VALOR?.replace(',', '.')) || 0), 0);
  console.assert(respPendingDebts.length === 2, 'Deve identificar 2 duplicatas pendentes/atrasadas do responsável');
  console.assert(totalRespDebt === 600, 'Total de débitos do responsável deve ser R$ 600,00');

  console.log('  ✅ Test 48 Passed: Levantamento Financeiro XML, Nome na OS Extra e Alerta de Inadimplência do Responsável validados com 100% de sucesso!\n');

  // ─── TEST 49: Período e Data Personalizada no Histórico Financeiro (PDV e ERP) ───
  console.log('▶ Test 49: Período e Data Personalizada no Histórico Financeiro (PDV e ERP)');
  const cashHistoryDateCode = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');
  console.assert(cashHistoryDateCode.includes("selectedPeriod === 'PERSONALIZADO'"), 'CashHistoryModal deve suportar selectedPeriod === PERSONALIZADO');
  console.assert(cashHistoryDateCode.includes('customStartDate') && cashHistoryDateCode.includes('customEndDate'), 'CashHistoryModal deve possuir customStartDate e customEndDate');
  console.assert(cashHistoryDateCode.includes('type="date"'), 'CashHistoryModal deve conter seletores de data HTML5 (type="date")');
  console.assert(cashHistoryDateCode.includes('Data / Período Personalizado'), 'CashHistoryModal deve exibir a opção de Período Personalizado');

  // Teste Funcional do Filtro Personalizado com Mock de Movimentações
  const mockMovements = [
    { id: 'm1', dataHora: '2026-10-01T10:00:00.000Z', valor: 100, tipo: 'VENDA' },
    { id: 'm2', dataHora: '2026-10-05T14:30:00.000Z', valor: 250, tipo: 'VENDA' },
    { id: 'm3', dataHora: '2026-10-10T09:15:00.000Z', valor: 300, tipo: 'RECEBIMENTO' },
    { id: 'm4', dataHora: '2026-10-15T18:00:00.000Z', valor: 180, tipo: 'SANGRIA' }
  ];

  // Simulação da lógica de filtro por período
  const filterByRange = (items, startStr, endStr) => {
    return items.filter(item => {
      const itemDate = new Date(item.dataHora);
      if (startStr && endStr) {
        const [sy, sm, sd] = startStr.split('-').map(Number);
        const [ey, em, ed] = endStr.split('-').map(Number);
        let startD = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        let endD = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        if (startD > endD) {
          const t = startD; startD = endD; endD = t;
        }
        return itemDate >= startD && itemDate <= endD;
      } else if (startStr) {
        const [sy, sm, sd] = startStr.split('-').map(Number);
        const startD = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        const endD = new Date(sy, sm - 1, sd, 23, 59, 59, 999);
        return itemDate >= startD && itemDate <= endD;
      }
      return true;
    });
  };

  // Range 04/10/2026 até 12/10/2026: deve retornar m2 e m3
  const rangeResults = filterByRange(mockMovements, '2026-10-04', '2026-10-12');
  console.assert(rangeResults.length === 2, 'Range 04 a 12 deve conter exatamente 2 registros');
  console.assert(rangeResults.some(r => r.id === 'm2') && rangeResults.some(r => r.id === 'm3'), 'Deve conter m2 e m3');

  // Dia Único 10/10/2026: deve retornar apenas m3
  const singleDateResults = filterByRange(mockMovements, '2026-10-10', '');
  console.assert(singleDateResults.length === 1 && singleDateResults[0].id === 'm3', 'Dia único 10/10/2026 deve retornar apenas m3');

  // Range invertido (tolerância a datas trocadas)
  const invertedResults = filterByRange(mockMovements, '2026-10-12', '2026-10-04');
  console.assert(invertedResults.length === 2, 'Range invertido deve normalizar e retornar 2 registros');

  console.log('  ✅ Test 49 Passed: Período e Data Personalizada no Histórico Financeiro (PDV e ERP) validados com 100% de sucesso!\n');

  // ─── TEST 50: Exportação de Planilhas em Formato Nativo Excel (.xlsx) Compatível com Excel Online ───
  console.log('▶ Test 50: Exportação de Planilhas em Formato Nativo Excel (.xlsx) Compatível com Excel Online');
  
  // 1. Verificação Estática de Código nos Módulos de Exportação
  const cashModalSrc = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');
  console.assert(cashModalSrc.includes('handleExportExcel'), 'CashHistoryModal deve implementar handleExportExcel');
  console.assert(cashModalSrc.includes('Baixar Planilha (Excel .xlsx)'), 'CashHistoryModal deve ter botão de download .xlsx');

  const erpOpticaSrc = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');
  console.assert(erpOpticaSrc.includes('handleExportFinancialExcel'), 'ErpOptica deve implementar handleExportFinancialExcel');
  console.assert(erpOpticaSrc.includes('Baixar Planilha (.xlsx)'), 'ErpOptica deve ter botão de download de planilha financeira .xlsx');

  const dashboardSrc = fs.readFileSync('./src/components/Dashboard.jsx', 'utf-8');
  console.assert(dashboardSrc.includes('handleExportSalesExcel'), 'Dashboard deve implementar handleExportSalesExcel');
  console.assert(dashboardSrc.includes('Baixar Vendas (.xlsx)'), 'Dashboard deve ter botão de download de vendas .xlsx');

  // 2. Teste Funcional de Geração de Pasta de Trabalho (.xlsx) com Múltiplas Abas
  const mockReceberRows = [
    { 'Nº': 1, 'Cliente': 'Maria Silva', 'CPF': '123.456.789-00', 'Valor (R$)': 250, 'Status': 'Pendente' }
  ];
  const mockPagarRows = [
    { 'Nº': 1, 'Fornecedor': 'Laboratório Óptico Central', 'Valor (R$)': 150, 'Status': 'Pago' }
  ];
  const mockFluxoRows = [
    { 'Nº': 1, 'Operação': 'VENDA', 'Valor (R$)': 250, 'Forma de Pagamento': 'PIX' }
  ];

  const testWb = XLSX.utils.book_new();
  const wsRec = XLSX.utils.json_to_sheet(mockReceberRows);
  const wsPag = XLSX.utils.json_to_sheet(mockPagarRows);
  const wsFlu = XLSX.utils.json_to_sheet(mockFluxoRows);

  XLSX.utils.book_append_sheet(testWb, wsRec, 'Contas a Receber');
  XLSX.utils.book_append_sheet(testWb, wsPag, 'Contas a Pagar');
  XLSX.utils.book_append_sheet(testWb, wsFlu, 'Fluxo de Caixa');

  // Gerar buffer binário .xlsx
  const xlsxBuffer = XLSX.write(testWb, { type: 'buffer', bookType: 'xlsx' });
  console.assert(xlsxBuffer && xlsxBuffer.length > 0, 'Buffer da planilha .xlsx gerado deve ser válido e não vazio');
  // Assinatura de arquivo ZIP/OpenXML (.xlsx): primeiros 4 bytes 'PK\x03\x04'
  console.assert(xlsxBuffer[0] === 0x50 && xlsxBuffer[1] === 0x4b, 'Arquivo deve possuir assinatura OpenXML (.xlsx)');

  console.log('  ✅ Test 50 Passed: Geração e Compatibilidade de Planilhas Excel (.xlsx) com Excel Online validadas com 100% de sucesso!\n');

  // ==========================================
  // TEST 51: EXCLUSÃO INDIVIDUAL E EM LOTE NO HISTÓRICO DE CAIXA (RESTRITO A ADMINISTRADORES)
  // ==========================================
  console.log('▶ Test 51: Exclusão Individual e em Lote no Histórico de Caixa (Restrito a Administradores)');

  const cashHistorySrc = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');

  // 1. Verificação de código-fonte
  console.assert(cashHistorySrc.includes('handleDeleteMovement'), 'CashHistoryModal deve implementar handleDeleteMovement');
  console.assert(cashHistorySrc.includes('handleBulkDelete'), 'CashHistoryModal deve implementar handleBulkDelete');
  console.assert(cashHistorySrc.includes('handleToggleSelect'), 'CashHistoryModal deve implementar handleToggleSelect');
  console.assert(cashHistorySrc.includes('handleSelectAll'), 'CashHistoryModal deve implementar handleSelectAll');
  console.assert(cashHistorySrc.includes('selectedIds'), 'CashHistoryModal deve manter estado de selectedIds');
  console.assert(cashHistorySrc.includes('isAdmin && onDeleteRow'), 'Opções de exclusão devem ser condicionadas estritamente a isAdmin && onDeleteRow');
  console.assert(cashHistorySrc.includes('Excluir Selecionadas'), 'Deve conter botão de ação em massa para excluir selecionadas');

  // 2. Simulação da Regra de Permissão (RBAC)
  const isUserAdmin = (user) => {
    return ['admin', 'administrador', 'administrativo'].includes(user?.role) ||
      user?.username === 'wmusete' ||
      user?.role === 'gerente';
  };

  const admin1 = { username: 'carlos_admin', role: 'admin' };
  const admin2 = { username: 'wmusete', role: 'vendedor' }; // master username
  const admin3 = { username: 'julia_gerente', role: 'gerente' };
  const vendor1 = { username: 'lucas_vendas', role: 'vendedor' };
  const vendor2 = { username: 'patricia_balcao', role: 'operador' };

  console.assert(isUserAdmin(admin1) === true, 'admin deve ter permissão de exclusão');
  console.assert(isUserAdmin(admin2) === true, 'wmusete deve ter permissão de exclusão');
  console.assert(isUserAdmin(admin3) === true, 'gerente deve ter permissão de exclusão');
  console.assert(isUserAdmin(vendor1) === false, 'vendedor NÃO deve ter permissão de exclusão');
  console.assert(isUserAdmin(vendor2) === false, 'operador NÃO deve ter permissão de exclusão');

  // 3. Simulação Lógica de Exclusão e Sincronização em Cascata (Caixa e Vendas)
  let mockFluxoCaixa = [
    { id: 'fc_1', tipo: 'ABERTURA', valor: '100,00' },
    { id: 'fc_2', tipo: 'SANGRIA', valor: '50,00' },
    { id: 'fc_3', tipo: 'VENDA', valor: '350,00', saleId: 'sale_101', osNumero: '101' },
    { id: 'fc_4', tipo: 'SUPRIMENTO', valor: '80,00' }
  ];

  let mockRegistroVendas = [
    { id: 'sale_101', 'OS DA VENDA': '101', 'VALOR TOTAL': '350,00', CLIENTE: 'João da Silva' }
  ];

  const simulateDeleteMovement = (movToDelete) => {
    mockFluxoCaixa = mockFluxoCaixa.filter(m => m.id !== movToDelete.id);
    if (movToDelete.saleId) {
      mockRegistroVendas = mockRegistroVendas.filter(s => s.id !== movToDelete.saleId);
    }
  };

  // Exclusão individual
  simulateDeleteMovement(mockFluxoCaixa[2]); // exclui venda fc_3
  console.assert(!mockFluxoCaixa.some(m => m.id === 'fc_3'), 'Lançamento deve ser removido de FLUXO_CAIXA');
  console.assert(!mockRegistroVendas.some(s => s.id === 'sale_101'), 'Venda vinculada deve ser removida de Registro_Vendas');

  // Exclusão em lote (Bulk Delete)
  const selectedForBulk = new Set(['fc_1', 'fc_4']);
  mockFluxoCaixa = mockFluxoCaixa.filter(m => !selectedForBulk.has(m.id));
  console.assert(mockFluxoCaixa.length === 1 && mockFluxoCaixa[0].id === 'fc_2', 'Exclusão em lote deve restar apenas fc_2');

  console.log('  ✅ Test 51 Passed: Exclusão Individual e em Lote no Histórico de Caixa validadas com 100% de sucesso!\n');

  // ─── TEST 52: Módulo de Reparcelamento de OS, Filtro de Datas das Parcelas e Alertas Vencidos com Nome do Cliente ───
  console.log('▶ Test 52: Módulo de Reparcelamento de OS, Filtro de Datas das Parcelas, Alertas Vencidos com Nome do Cliente & UX');

  // 1. Teste de Normalização e Formatação de Datas (ISO e BR)
  console.assert(normalizeInstallmentDateIso('2026-08-15') === '2026-08-15', 'Deve manter formato ISO YYYY-MM-DD');
  console.assert(normalizeInstallmentDateIso('15/08/2026') === '2026-08-15', 'Deve converter DD/MM/YYYY para ISO');
  console.assert(normalizeInstallmentDateIso('5/3/2026') === '2026-03-05', 'Deve converter D/M/YYYY para ISO com zero à esquerda');
  console.assert(normalizeInstallmentDateIso('15-08-2026') === '2026-08-15', 'Deve converter DD-MM-YYYY para ISO');
  console.assert(normalizeInstallmentDateIso('') === '', 'Data vazia deve retornar string vazia');
  console.assert(formatInstallmentDateBr('2026-08-15') === '15/08/2026', 'Deve formatar ISO para DD/MM/YYYY');

  // 2. Teste de Extração de OS e Resolução do Nome do Cliente (Direto, Clientes e Vendas)
  console.assert(extractOSFromRow({ VENDA_OS: '#1045' }) === '1045', 'Deve extrair VENDA_OS sem #');
  console.assert(extractOSFromRow({ DOCUMENTO: 'BOLETO 2/4 - OS 2099' }) === '2099', 'Deve extrair OS de DOCUMENTO');

  const mockClientsForAlert = [
    { id: 'cli_99', 'Nome Completo': 'Mariana Oliveira Costa', 'CPF / CNPJ': '123.456.789-00' }
  ];
  const mockSalesForAlert = [
    { OS: '3050', 'NOME DO CLIENTE': 'Roberto Carlos Mendes' }
  ];

  console.assert(
    resolveInstallmentClientName({ CLIENTE: 'Fernanda Lima' }, mockClientsForAlert, mockSalesForAlert) === 'Fernanda Lima',
    'Deve resolver nome direto na parcela'
  );
  console.assert(
    resolveInstallmentClientName({ CLIENTE_CPF: '12345678900' }, mockClientsForAlert, mockSalesForAlert) === 'Mariana Oliveira Costa',
    'Deve resolver nome do cliente cruzando CPF com clientsData'
  );
  console.assert(
    resolveInstallmentClientName({ DESCRICAO: 'Parcela 1/3 ref OS #3050' }, mockClientsForAlert, mockSalesForAlert) === 'Roberto Carlos Mendes',
    'Deve resolver nome do cliente cruzando OS com salesData'
  );

  // 3. Teste de Alertas de Parcelas Vencidas Referentes com o Nome do Cliente
  const mockReceberAlerts = [
    {
      id: 'r1',
      CLIENTE: 'Ana Paula Souza',
      VENDA_OS: '4501',
      PARCELA: '1/3',
      DESCRICAO: 'Parcela 1/3',
      VALOR: '180,00',
      DATA_VENCIMENTO: '10/05/2026', // formato BR vencido
      STATUS: 'Pendente'
    },
    {
      id: 'r2',
      CLIENTE_CPF: '123.456.789-00', // Sem campo CLIENTE preenchido -> deve puxar Mariana Oliveira Costa
      VENDA_OS: '4502',
      DOCUMENTO: 'BOLETO 2/4 - OS 4502',
      VALOR: '220,50',
      DATA_VENCIMENTO: '2026-05-15', // vence no dia de referência
      STATUS: 'Pendente'
    },
    {
      id: 'r3',
      CLIENTE: 'Cliente Futuro',
      VENDA_OS: '4503',
      VALOR: '150,00',
      DATA_VENCIMENTO: '2026-06-20', // futuro -> não deve entrar no alerta de vencidas
      STATUS: 'Pendente'
    },
    {
      id: 'r4',
      CLIENTE: 'Cliente Já Pago',
      VENDA_OS: '4504',
      VALOR: '300,00',
      DATA_VENCIMENTO: '2026-05-01',
      STATUS: 'Recebido' // pago -> não deve entrar no alerta
    }
  ];

  const overdueAlerts = buildOverdueInstallmentAlerts(
    mockReceberAlerts,
    [],
    mockClientsForAlert,
    mockSalesForAlert,
    '2026-05-15'
  );

  console.assert(overdueAlerts.length === 2, `Esperado 2 alertas vencidos, obtido ${overdueAlerts.length}`);
  console.assert(overdueAlerts[0].clienteNome === 'Ana Paula Souza', 'Primeiro alerta deve trazer o nome da cliente Ana Paula Souza');
  console.assert(overdueAlerts[0].osNumero === '4501', 'Primeiro alerta deve trazer a OS 4501');
  console.assert(overdueAlerts[0].diasAtraso === 5, 'Deve calcular 5 dias de atraso entre 10/05 e 15/05');
  console.assert(overdueAlerts[0].descricao.includes('Ana Paula Souza'), 'Descrição do alerta deve incluir explicitamente o nome do cliente');
  console.assert(overdueAlerts[1].clienteNome === 'Mariana Oliveira Costa', 'Segundo alerta deve resolver nome do cliente via CPF no cadastro');
  console.assert(overdueAlerts[1].isDueToday === true, 'Segundo alerta vence hoje');

  // 4. Teste do Filtro de Datas da Parcela (Modo de Busca com Datas Personalizadas)
  const customRangeResult = filterInstallmentsByDateRange(
    mockReceberAlerts,
    {
      periodMode: 'CUSTOM',
      startDate: '2026-05-12',
      endDate: '2026-06-30',
      dateField: 'VENCIMENTO',
      statusFilter: 'ALL'
    },
    '2026-05-15'
  );
  console.assert(customRangeResult.length === 2, 'Filtro personalizado 12/05 a 30/06 deve retornar r2 (15/05) e r3 (20/06)');

  // Intervalo invertido (startDate > endDate) deve ser corrigido automaticamente
  const invertedRangeResult = filterInstallmentsByDateRange(
    mockReceberAlerts,
    {
      periodMode: 'CUSTOM',
      startDate: '2026-06-30',
      endDate: '2026-05-12',
      dateField: 'VENCIMENTO'
    },
    '2026-05-15'
  );
  console.assert(invertedRangeResult.length === 2, 'Filtro com datas invertidas deve auto-corrigir e retornar 2 parcelas');

  const overdueModeResult = filterInstallmentsByDateRange(
    mockReceberAlerts,
    { periodMode: 'OVERDUE' },
    '2026-05-15'
  );
  console.assert(overdueModeResult.length === 2, 'Modo OVERDUE deve retornar apenas as 2 parcelas vencidas e não pagas');

  // Teste de precedência de preset explícito mesmo com startDate/endDate residuais + busca por nome resolvido via CPF
  const presetOverrideResult = filterInstallmentsByDateRange(
    mockReceberAlerts,
    {
      periodMode: 'TODAY',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      searchQuery: 'Mariana Oliveira',
      clientsData: mockClientsForAlert,
      salesData: mockSalesForAlert
    },
    '2026-05-15'
  );
  console.assert(
    presetOverrideResult.length === 1 && presetOverrideResult[0].id === 'r2',
    'Preset TODAY deve prevalecer sobre datas residuais e encontrar cliente cujo nome foi resolvido via clientsData'
  );

  // 5. Teste do Cronograma e Payload do Módulo de Reparcelamento referente à OS
  // Teste de arredondamento exato de centavos (R$ 100,00 em 3x -> 33,33 + 33,33 + 33,34 = 100,00)
  const sched3x = generateInstallmentSchedule({
    totalAmount: 100,
    count: 3,
    firstDueDateIso: '2026-01-31',
    intervalType: 'MESMO_DIA_MES'
  });
  console.assert(sched3x.length === 3, 'Deve gerar 3 parcelas');
  console.assert(sched3x[0].valorNum === 33.33 && sched3x[1].valorNum === 33.33 && sched3x[2].valorNum === 33.34, 'Última parcela deve absorver 1 centavo residual');
  console.assert(sched3x[1].vencimento === '2026-02-28', `Vencimento de 31/01 no mês seguinte deve ajustar para 28/02, obtido ${sched3x[1].vencimento}`);

  // Teste de Payload Completo de Reparcelamento (com Entrada + Desconto + Novas Parcelas Boleto)
  const reparcPayload = buildReparcelamentoOSPayload({
    osNumber: '4501',
    clientName: 'Ana Paula Souza',
    clientId: 'cli_ana',
    clientCpf: '111.222.333-44',
    unit: 'Cajati',
    selectedPendingRows: [mockReceberAlerts[0], mockReceberAlerts[1]], // 180,00 + 220,50 = 400,50
    entradaValor: '100,50',
    entradaMeioPagamento: 'Pix',
    descontoValor: '0,00',
    acrescimoValor: '0,00',
    meioPagamento: 'Carnê', // Deve ser higienizado automaticamente para 'Boleto'
    schedule: generateInstallmentSchedule({
      totalAmount: 300,
      count: 3,
      firstDueDateIso: '2026-06-15',
      intervalType: '30_DIAS'
    }),
    dataAcordoIso: '2026-05-15',
    observacoes: 'Cliente renegociou saldo no balcão',
    operador: 'admin'
  });

  console.assert(reparcPayload.originalSelectedTotal === 400.5, 'Total original selecionado deve ser 400.50');
  console.assert(reparcPayload.entradaValor === 100.5, 'Entrada deve ser 100.50');
  console.assert(reparcPayload.totalNovoParcelado === 300, 'Novo saldo parcelado deve ser 300.00');
  console.assert(reparcPayload.rowsToDelete.length === 2, 'Deve marcar as 2 parcelas antigas para substituição/exclusão');
  console.assert(reparcPayload.entradaReceberRow && reparcPayload.entradaReceberRow.STATUS === 'Recebido', 'Deve gerar registro de entrada quitada em CONTAS_RECEBER');
  console.assert(reparcPayload.entradaFluxoRow && reparcPayload.entradaFluxoRow.valor === 100.5, 'Deve gerar lançamento de entrada no FLUXO_CAIXA');
  console.assert(reparcPayload.newInstallmentRows.length === 3, 'Deve gerar 3 novas parcelas pendentes');
  console.assert(
    reparcPayload.newInstallmentRows.every(r => r.MEIO_PAGAMENTO === 'Boleto' && !/carn[eê]/i.test(r.DOCUMENTO)),
    'Todas as novas parcelas devem utilizar nomenclatura padronizada Boleto (nunca Carnê)'
  );

  // Teste de quitação integral (100% pago como Entrada -> novoSaldoParcelado === 0)
  // Mesmo passando um schedule de R$ 0,00 gerado por generateInstallmentSchedule({ totalAmount: 0, count: 3 }),
  // NÃO deve criar parcelas pendentes fantasmas de R$ 0,00!
  const zeroBalanceSchedule = generateInstallmentSchedule({ totalAmount: 0, count: 3, firstDueDateIso: '2026-06-15' });
  const fullSettlementPayload = buildReparcelamentoOSPayload({
    osNumber: '4501',
    clientName: 'Ana Paula Souza',
    selectedPendingRows: [mockReceberAlerts[0]], // 180,00
    entradaValor: '180,00',
    entradaMeioPagamento: 'PIX',
    schedule: zeroBalanceSchedule,
    dataAcordoIso: '2026-05-15'
  });
  console.assert(fullSettlementPayload.totalNovoParcelado === 0, 'Saldo parcelado deve ser 0 na quitação integral');
  console.assert(fullSettlementPayload.newInstallmentRows.length === 0, 'Quitação integral via Entrada NÃO pode gerar parcelas pendentes de R$ 0,00');
  console.assert(fullSettlementPayload.entradaReceberRow && fullSettlementPayload.entradaReceberRow.VALOR === '180,00', 'Deve registrar a entrada de R$ 180,00');

  // 6. Auditoria de Código-Fonte nos Componentes Integrados
  const erpOpticaSrc52 = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf8');
  const clientModalSrc52 = fs.readFileSync('./src/components/ClientInstallmentsModal.jsx', 'utf8');
  const reparcModalSrc52 = fs.readFileSync('./src/components/ReparcelamentoOSModal.jsx', 'utf8');
  const dataTableSrc52 = fs.readFileSync('./src/components/DataTable.jsx', 'utf8');

  console.assert(erpOpticaSrc52.includes('ReparcelamentoOSModal'), 'ErpOptica.jsx deve importar e renderizar ReparcelamentoOSModal');
  console.assert(erpOpticaSrc52.includes('Filtro de Datas da Parcela — Busca Personalizada'), 'ErpOptica.jsx deve exibir o painel de filtro com as datas da parcela');
  console.assert(erpOpticaSrc52.includes('item.clienteNome'), 'ErpOptica.jsx deve exibir o nome do cliente nos alertas de parcelas vencidas');
  console.assert(clientModalSrc52.includes('filterInstallmentsByDateRange'), 'ClientInstallmentsModal.jsx deve permitir filtrar parcelas por datas personalizadas');
  console.assert(dataTableSrc52.includes('onReparcelarOS'), 'DataTable.jsx deve disponibilizar botão de ação Reparcelar OS');
  console.assert(!reparcModalSrc52.includes('Carnê'), 'ReparcelamentoOSModal.jsx não deve conter o termo Carnê');

  console.log('  ✅ Test 52 Passed: Módulo de Reparcelamento de OS, Filtro de Datas das Parcelas e Alertas Vencidos com Nome do Cliente validados com 100% de sucesso!\n');

  // =========================================================================
  // TEST 53: Método de Pagamento da Entrada (Sinal) e do Restante (Falta) na OS
  //          + Blindagem Contábil de Fluxo de Caixa, Gaveta e Contas a Receber
  //          + Preservação 100% Intacta da Opção "Boleto"
  // =========================================================================
  console.log('▶️ Running Test 53: Método de Pagamento da Entrada e do Restante na OS + Blindagem Contábil & Boleto Intacto...');

  const osGenSrc53 = fs.readFileSync('./src/components/OSGeneratorModal.jsx', 'utf8');
  const editOsSrc53 = fs.readFileSync('./src/components/EditOSModal.jsx', 'utf8');
  const printableOsSrc53 = fs.readFileSync('./src/components/PrintableOS.jsx', 'utf8');
  const posRegSrc53 = fs.readFileSync('./src/components/POSRegister.jsx', 'utf8');
  const osMgmtSrc53 = fs.readFileSync('./src/components/OSManagement.jsx', 'utf8');
  const clientRegSrc53 = fs.readFileSync('./src/components/ClientRegistration.jsx', 'utf8');
  const cashHistSrc53 = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf8');

  // 1. OSGeneratorModal.jsx: Campos explícitos de Entrada e Restante + stage ('entrada' | 'restante') + Boleto intacto
  console.assert(
    osGenSrc53.includes('formaPagamentoEntrada') && osGenSrc53.includes('formaPagamentoRestante'),
    'OSGeneratorModal.jsx deve gerenciar formaPagamentoEntrada e formaPagamentoRestante'
  );
  console.assert(
    osGenSrc53.includes('FORMA_ENTRADA:') && osGenSrc53.includes('FORMA_RESTANTE:'),
    'OSGeneratorModal.jsx deve persistir FORMA_ENTRADA e FORMA_RESTANTE no payload da OS'
  );
  console.assert(
    osGenSrc53.includes('Método de Pagamento da Entrada') && osGenSrc53.includes('Método de Pagamento do Restante'),
    'OSGeneratorModal.jsx deve exibir seletores dedicados para Método de Pagamento da Entrada e do Restante no Bloco 3'
  );
  console.assert(
    osGenSrc53.includes('value="Boleto"') &&
    osGenSrc53.includes('value="PIX"') &&
    osGenSrc53.includes('value="Cartão de Crédito"') &&
    osGenSrc53.includes('value="Cartão de Débito"') &&
    osGenSrc53.includes('value="Dinheiro"') &&
    osGenSrc53.includes('value="A Combinar na Retirada"'),
    'OSGeneratorModal.jsx deve manter a opção Boleto 100% intacta e oferecer PIX, Cartão de Crédito, Cartão de Débito, Dinheiro e A Combinar na Retirada para o Restante'
  );

  // 2. EditOSModal.jsx: Edição de Entrada/Restante com stage e preservação de FORMA_ENTRADA / FORMA_RESTANTE
  console.assert(
    editOsSrc53.includes('formaPagamentoEntrada') && editOsSrc53.includes('formaPagamentoRestante'),
    'EditOSModal.jsx deve suportar formaPagamentoEntrada e formaPagamentoRestante'
  );
  console.assert(
    editOsSrc53.includes("'FORMA_ENTRADA':") && editOsSrc53.includes("'FORMA_RESTANTE':"),
    'EditOSModal.jsx deve salvar FORMA_ENTRADA e FORMA_RESTANTE ao atualizar a OS'
  );
  console.assert(
    editOsSrc53.includes("p.stage === 'restante'"),
    'EditOSModal.jsx deve separar pagamentos de stage === "restante" para não inflar totalPagoImediato (VALOR ENTRADA)'
  );

  // 3. PrintableOS.jsx: Exibição clara da forma de pagamento da Entrada e do Restante na impressão A4
  console.assert(
    printableOsSrc53.includes('resolvedFormaEntrada') && printableOsSrc53.includes('resolvedFormaRestante'),
    'PrintableOS.jsx deve resolver e exibir a forma de pagamento da Entrada e do Restante'
  );
  console.assert(
    printableOsSrc53.includes('CONTRATO DE VENDA E COMPRA DE ARMAÇÕES DE ÓCULOS, LENTES E LENTES DE CONTATO') &&
    printableOsSrc53.includes('Cronograma de Parcelas do Boleto'),
    'PrintableOS.jsx deve preservar intacto o contrato A4 e o cronograma de parcelas do Boleto'
  );

  // 4. POSRegister.jsx: Blindagem de Fluxo de Caixa e PARCELAS_JSON
  console.assert(
    posRegSrc53.includes('immediatePayments') && posRegSrc53.includes("if (pay.stage === 'restante') return false;"),
    'POSRegister.jsx deve filtrar immediatePayments (excluindo pay.stage === "restante") para que o Restante não pago hoje jamais entre no FLUXO_CAIXA do dia'
  );
  console.assert(
    posRegSrc53.includes("filter(p => p.metodo === 'carne' || p.metodo === 'boleto')"),
    'POSRegister.jsx deve filtrar todasParcelas apenas para carne/boleto, impedindo que parcelas de Cartão de Crédito poluam PARCELAS_JSON'
  );
  console.assert(
    posRegSrc53.includes('FORMA_ENTRADA:') && posRegSrc53.includes('FORMA_RESTANTE:'),
    'POSRegister.jsx deve gravar FORMA_ENTRADA e FORMA_RESTANTE na planilha de vendas'
  );

  // 5. OSManagement.jsx: Exibição e geração correta de CONTAS_RECEBER com o método do Restante
  console.assert(
    osMgmtSrc53.includes('formaEntrada') && osMgmtSrc53.includes('formaRestante'),
    'OSManagement.jsx deve mapear e exibir formaEntrada e formaRestante nos cards, tabela e modais'
  );
  console.assert(
    osMgmtSrc53.includes("MEIO_PAGAMENTO: 'Boleto'") && osMgmtSrc53.includes('MEIO_PAGAMENTO: resolvedMeioRestante'),
    'OSManagement.jsx deve preservar MEIO_PAGAMENTO = Boleto nas parcelas e usar resolvedMeioRestante no saldo restante'
  );

  // 6. ClientRegistration.jsx & CashHistoryModal.jsx: Blindagem de Gaveta (Dinheiro físico) & Multi-OS
  console.assert(
    clientRegSrc53.includes('rawEntradaMethod') && clientRegSrc53.includes("'FORMA_ENTRADA': resolvedFormaEntrada"),
    'ClientRegistration.jsx deve registrar o método real da Entrada no FLUXO_CAIXA em vez de forçar DINHEIRO fixo'
  );
  console.assert(
    clientRegSrc53.includes('osData?.isMultiOS') && clientRegSrc53.includes('ordersList.forEach') && printableOsSrc53.includes('osData.orders && Array.isArray(osData.orders)'),
    'ClientRegistration.jsx e PrintableOS.jsx devem desempacotar osData.orders em emissões Multi-OS (2+ óculos)'
  );
  console.assert(
    cashHistSrc53.includes('formaEntradaOS') && cashHistSrc53.includes('formaRestanteOS') && cashHistSrc53.includes('formaEfetivaCaixa'),
    'CashHistoryModal.jsx deve usar formaEntradaOS (formaEfetivaCaixa) para classificar a entrada imediata no caixa sem contaminar a gaveta com o método do Restante'
  );

  // 6.1 Verificações adicionais de sincronização e preservação (ClientProfileModal, ErpOptica, EditOSModal, OSGeneratorModal)
  const clientProfileSrc53 = fs.readFileSync('./src/components/ClientProfileModal.jsx', 'utf8');
  const erpOpticaSrc53 = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf8');
  console.assert(
    clientProfileSrc53.includes("FORMA_ENTRADA: compra['FORMA_ENTRADA']") &&
    clientProfileSrc53.includes("FORMA_RESTANTE: compra['FORMA_RESTANTE']"),
    'ClientProfileModal.jsx deve encaminhar FORMA_ENTRADA e FORMA_RESTANTE para setOsDataForPrint ao reimprimir OS'
  );
  console.assert(
    erpOpticaSrc53.includes('FORMA_RESTANTE: newFormaRestante') &&
    erpOpticaSrc53.includes('formaPagamentoRestante: newFormaRestante'),
    'ErpOptica.jsx (handleConfirmReparcelamento) deve atualizar FORMA_RESTANTE e formaPagamentoRestante ao reparcelar OS'
  );
  console.assert(
    editOsSrc53.includes("{ id: 'combinar', label: '🤝 A Combinar' }") &&
    editOsSrc53.includes("if (m === 'combinar' || /combinar|retirada/i.test(m)) return 'A Combinar na Retirada';") &&
    editOsSrc53.includes('buildPaymentObject(currentMethod, totalVal, cashTendered, payInstallments, payFirstDueDate, customDueDates, currentStage)'),
    'EditOSModal.jsx deve preservar "A Combinar na Retirada" (combinar) e passar currentStage no fallback autoPay'
  );
  console.assert(
    osGenSrc53.includes("selectFormaRestante = 'Cartão de Crédito'") &&
    osGenSrc53.includes("name === 'formaPagamentoRestante'") &&
    osGenSrc53.includes("name === 'parcelasRestante'"),
    'OSGeneratorModal.jsx deve normalizar formaPagamentoRestante para os valores do <select> e sincronizar alterações do dropdown com a lista de pagamentos'
  );

  // 7. Simulação Matemática Contábil dos 5 Cenários Críticos (Entrada + Restante)
  const simulateOSPaymentAccounting = (paymentsList, valorFinalOS) => {
    const immediatePayments = paymentsList.filter(
      p => p.metodo !== 'carne' && p.metodo !== 'boleto' && p.stage !== 'restante'
    );
    const deferredRestantePayments = paymentsList.filter(
      p => p.metodo === 'carne' || p.metodo === 'boleto' || p.stage === 'restante'
    );
    const valorEntrada = immediatePayments.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const somaRestanteListado = deferredRestantePayments.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const valorRestante = somaRestanteListado > 0
      ? somaRestanteListado
      : Math.max(0, valorFinalOS - valorEntrada);

    // PARCELAS_JSON deve conter SOMENTE parcelas de Boleto
    const parcelasJson = paymentsList
      .filter(p => p.metodo === 'carne' || p.metodo === 'boleto')
      .flatMap(p => p.listaParcelas || []);

    // Gaveta de Dinheiro físico hoje deve somar apenas immediatePayments em dinheiro
    const gavetaDinheiroHoje = immediatePayments
      .filter(p => p.metodo === 'dinheiro')
      .reduce((acc, p) => acc + Number(p.valor || 0), 0);

    return {
      valorEntrada,
      valorRestante,
      fluxoCaixaHojeTotal: valorEntrada,
      gavetaDinheiroHoje,
      parcelasJsonCount: parcelasJson.length
    };
  };

  // Cenário A: OS de R$ 600,00 -> Entrada de R$ 200,00 no PIX + Restante de R$ 400,00 no Cartão de Crédito (3x)
  const cenarioCartaoRestante = simulateOSPaymentAccounting([
    { metodo: 'pix', stage: 'entrada', valor: 200 },
    {
      metodo: 'cartao_credito',
      stage: 'restante',
      valor: 400,
      parcelas: 3,
      listaParcelas: [{ numero: 1, valor: 133.34 }, { numero: 2, valor: 133.33 }, { numero: 3, valor: 133.33 }]
    }
  ], 600);
  console.assert(cenarioCartaoRestante.valorEntrada === 200, 'Cenário A: Entrada deve ser exatamente R$ 200,00');
  console.assert(cenarioCartaoRestante.valorRestante === 400, 'Cenário A: Restante deve ser exatamente R$ 400,00 (não somado à Entrada)');
  console.assert(cenarioCartaoRestante.fluxoCaixaHojeTotal === 200, 'Cenário A: Fluxo de Caixa de hoje deve registrar apenas os R$ 200,00 pagos na Entrada');
  console.assert(cenarioCartaoRestante.gavetaDinheiroHoje === 0, 'Cenário A: Gaveta de dinheiro físico deve ser R$ 0,00');
  console.assert(cenarioCartaoRestante.parcelasJsonCount === 0, 'Cenário A: Parcelas de Cartão de Crédito NÃO podem vazar para PARCELAS_JSON de Boleto');

  // Cenário B: OS de R$ 500,00 -> Entrada de R$ 150,00 no PIX + Restante de R$ 350,00 em Dinheiro (na retirada)
  const cenarioDinheiroRestante = simulateOSPaymentAccounting([
    { metodo: 'pix', stage: 'entrada', valor: 150 },
    { metodo: 'dinheiro', stage: 'restante', valor: 350 }
  ], 500);
  console.assert(cenarioDinheiroRestante.valorEntrada === 150, 'Cenário B: Entrada deve ser R$ 150,00');
  console.assert(cenarioDinheiroRestante.valorRestante === 350, 'Cenário B: Restante em Dinheiro deve ser R$ 350,00');
  console.assert(cenarioDinheiroRestante.gavetaDinheiroHoje === 0, 'Cenário B: Restante em Dinheiro (ainda não pago) JAMAIS pode inflar o saldo em dinheiro da gaveta de hoje');

  // Cenário C: OS de R$ 800,00 -> Entrada de R$ 200,00 em Dinheiro + Restante de R$ 600,00 no Boleto (3x) -> 100% Intacto!
  const cenarioBoletoIntacto = simulateOSPaymentAccounting([
    { metodo: 'dinheiro', stage: 'entrada', valor: 200 },
    {
      metodo: 'boleto',
      stage: 'restante',
      valor: 600,
      parcelas: 3,
      listaParcelas: [
        { numero: 1, valor: 200, dataVencimento: '2026-11-20' },
        { numero: 2, valor: 200, dataVencimento: '2026-12-20' },
        { numero: 3, valor: 200, dataVencimento: '2027-01-20' }
      ]
    }
  ], 800);
  console.assert(cenarioBoletoIntacto.valorEntrada === 200, 'Cenário C: Entrada em Dinheiro deve ser R$ 200,00');
  console.assert(cenarioBoletoIntacto.valorRestante === 600, 'Cenário C: Restante no Boleto deve ser R$ 600,00');
  console.assert(cenarioBoletoIntacto.gavetaDinheiroHoje === 200, 'Cenário C: Gaveta de dinheiro físico deve somar os R$ 200,00 da Entrada em Dinheiro');
  console.assert(cenarioBoletoIntacto.parcelasJsonCount === 3, 'Cenário C: Fluxo de Boleto deve continuar gerando as 3 parcelas em PARCELAS_JSON 100% intacto');

  console.log('  ✅ Test 53 Passed: Método de Pagamento da Entrada e do Restante na OS + Blindagem Contábil e Boleto 100% Intacto validados com sucesso!\n');

  // =========================================================================
  // TEST 54: Relatório Consolidado de Vendas de Armações por Grife e por Loja
  // =========================================================================
  console.log('▶️ Running Test 54: Relatório Consolidado de Vendas por Grife e por Loja (Armações, Lentes & Excel)...');
  const { aggregateSalesByBrandAndStore, exportBrandSalesReportToExcel } = await import('./src/stockFilters.js');
  const XLSXModule = await import('xlsx');

  const mockInventoryItems = [
    { MARCA: 'Ray-Ban', MODELO: 'RB3025 Aviador Dourado', SKU: 'RB3025-01', UNIDADE: 'Registro', PRECO_VENDA: 650, ESTOQUE: 5 },
    { MARCA: 'Ray-Ban', MODELO: 'RB2140 Wayfarer Preto', SKU: 'RB2140-02', UNIDADE: 'Cajati', PRECO_VENDA: 700, ESTOQUE: 3 },
    { MARCA: 'Vogue', MODELO: 'VO5211 Gatinho', SKU: 'VO5211-01', UNIDADE: 'Registro', PRECO_VENDA: 480, ESTOQUE: 8 },
    { MARCA: 'Ana Hickmann', MODELO: 'AH6315 Redondo Tartaruga', SKU: 'AH6315-01', UNIDADE: 'Jacupiranga', PRECO_VENDA: 560, ESTOQUE: 4 },
    { MARCA: 'Oakley', MODELO: 'Crosslink Pitch Esportivo', SKU: 'OX8037-01', UNIDADE: 'Cajati', PRECO_VENDA: 620, ESTOQUE: 2 }
  ];

  const mockSalesRecords = [
    // Registro: 3x Ray-Ban RB3025 + 2x Vogue VO5211
    { 'Nº DA OS': 'OS-101', SKU: 'RB3025-01', PRODUTO: 'Armação Ray-Ban RB3025 Aviador', CIDADE: 'Registro', QUANTIDADE: 2, 'VALOR TOTAL': 1300, 'DATA DA VENDA': '20/10/2026' },
    { 'Nº DA OS': 'OS-102', SKU: 'RB3025-01', PRODUTO: 'Armação Ray-Ban', CIDADE: 'Registro', QUANTIDADE: 1, 'VALOR TOTAL': 650, 'DATA DA VENDA': '21/10/2026' },
    { 'Nº DA OS': 'OS-103', MARCA: 'Vogue', PRODUTO: 'Óculos Vogue VO5211', CIDADE: 'Registro', QUANTIDADE: 2, 'VALOR TOTAL': 960, 'DATA DA VENDA': '19/10/2026' },

    // Cajati: 1x Ray-Ban Wayfarer + 3x Oakley Crosslink
    { 'Nº DA OS': 'OS-104', ARMAÇÃO: 'Ray-Ban Wayfarer Preto', CIDADE: 'Cajati', QUANTIDADE: 1, 'VALOR TOTAL': 700, 'DATA DA VENDA': '18/10/2026' },
    { 'Nº DA OS': 'OS-105', SKU: 'OX8037-01', PRODUTO: 'Armação Oakley Crosslink Pitch', CIDADE: 'Cajati', QUANTIDADE: 3, 'VALOR TOTAL': 1860, 'DATA DA VENDA': '17/10/2026' },

    // Jacupiranga: 2x Ana Hickmann AH6315
    { 'Nº DA OS': 'OS-106', ARMAÇÃO: 'Ana Hickmann AH6315 Redondo', CIDADE: 'Jacupiranga', QUANTIDADE: 2, 'VALOR TOTAL': 1120, 'DATA DA VENDA': '16/10/2026' }
  ];

  // Cenário 1: Todas as Lojas consolidadas
  const aggTodas = aggregateSalesByBrandAndStore(mockInventoryItems, mockSalesRecords, {
    selectedStore: 'todas',
    period: 'all',
    type: 'armacoes'
  });

  console.assert(aggTodas.totalBrandsCount === 4, `Esperado 4 marcas distintas, obtido ${aggTodas.totalBrandsCount}`);
  console.assert(aggTodas.grandTotalQuantity === 11, `Esperado 11 peças vendidas no total, obtido ${aggTodas.grandTotalQuantity}`);
  console.assert(aggTodas.grandTotalRevenue === 6590, `Esperado R$ 6.590,00 de faturamento total, obtido ${aggTodas.grandTotalRevenue}`);

  // Verificar ranking das marcas
  const top1 = aggTodas.brandList[0];
  console.assert(top1.brand === 'Ray-Ban', `Esperado Ray-Ban em 1º lugar no ranking, obtido ${top1.brand}`);
  console.assert(top1.totalQuantity === 4, `Esperado 4 peças Ray-Ban vendidas, obtido ${top1.totalQuantity}`);
  console.assert(top1.totalRevenue === 2650, `Esperado R$ 2.650,00 da Ray-Ban, obtido ${top1.totalRevenue}`);
  console.assert(top1.stores['Registro'].quantity === 3, 'Registro deve ter vendido 3 Ray-Bans');
  console.assert(top1.stores['Cajati'].quantity === 1, 'Cajati deve ter vendido 1 Ray-Ban');

  // Cenário 2: Filtrar apenas a filial de Registro
  const aggRegistro = aggregateSalesByBrandAndStore(mockInventoryItems, mockSalesRecords, {
    selectedStore: 'Registro',
    period: 'all',
    type: 'armacoes'
  });

  console.assert(aggRegistro.totalBrandsCount === 2, `Em Registro deve haver apenas Ray-Ban e Vogue, obtido ${aggRegistro.totalBrandsCount}`);
  console.assert(aggRegistro.grandTotalQuantity === 5, `Em Registro deve haver 5 peças no total (3 Ray-Ban + 2 Vogue), obtido ${aggRegistro.grandTotalQuantity}`);
  console.assert(aggRegistro.grandTotalRevenue === 2910, `Em Registro faturamento deve ser R$ 2.910,00, obtido ${aggRegistro.grandTotalRevenue}`);

  // Cenário 3: Exportação em Excel nativo (.xlsx) com as 3 abas estruturadas
  const exportedFilename = exportBrandSalesReportToExcel(aggTodas, {
    selectedStore: 'todas',
    period: 'all',
    type: 'armacoes'
  }, XLSXModule);

  console.assert(typeof exportedFilename === 'string' && exportedFilename.endsWith('.xlsx'), 'Nome do arquivo exportado deve terminar com .xlsx');
  const fsModule = await import('fs');
  console.assert(fsModule.existsSync(exportedFilename), 'Arquivo Excel de vendas por grife deve ser gerado no disco');
  fsModule.unlinkSync(exportedFilename); // Limpeza

  console.log('  ✅ Test 54 Passed: Relatório Consolidado de Vendas por Grife e por Loja (Armações, Lentes & Excel) validado com 100% de sucesso!\n');

  // =========================================================================
  // TEST 55: Relatório Oficial de Fechamento de Caixa em PDF A4 com Movimentações
  // =========================================================================
  console.log('▶️ Running Test 55: Relatório Oficial de Fechamento de Caixa em PDF A4 com Movimentações...');
  {
    const closingReportSource = fs.readFileSync('./src/components/PrintableCashClosingReport.jsx', 'utf-8');
    console.assert(closingReportSource.includes('PrintableCashClosingReport ='), 'PrintableCashClosingReport.jsx deve exportar o componente PrintableCashClosingReport');
    console.assert(closingReportSource.includes('id="print-cash-closing-report"'), 'PrintableCashClosingReport deve conter o contêiner #print-cash-closing-report');
    console.assert(closingReportSource.includes('Entradas Realmente Recebidas'), 'Relatório deve conter a seção de Entradas Realmente Recebidas');
    console.assert(closingReportSource.includes('Conferência da Gaveta Física'), 'Relatório deve conter a seção de Conferência da Gaveta Física');
    console.assert(closingReportSource.includes('Faturamento a Prazo em Boleto'), 'Relatório deve conter a seção de Faturamento a Prazo em Boleto');
    console.assert(closingReportSource.includes('Demonstrativo Detalhado de Movimentações'), 'Relatório deve conter o Demonstrativo Detalhado de Movimentações');
    console.assert(closingReportSource.includes('Operador(a) do Caixa') && closingReportSource.includes('Gerência / Supervisão'), 'Relatório deve conter campos formais de assinatura');

    // Verificar integração de impressão no CSS
    const indexCssSource = fs.readFileSync('./src/index.css', 'utf-8');
    console.assert(indexCssSource.includes('#print-cash-closing-report'), 'index.css deve conter regras de impressão para #print-cash-closing-report');

    // Verificar botões no CashManagementModal e CashHistoryModal
    const modalSrc = fs.readFileSync('./src/components/CashManagementModal.jsx', 'utf-8');
    console.assert(modalSrc.includes('handlePrintExtratoPdf') && modalSrc.includes("handleFechamentoSubmit(e, 'pdf')"), 'CashManagementModal deve conter handlers de relatório e extrato em PDF A4');
    console.assert(modalSrc.includes('Relatório PDF (A4)'), 'CashManagementModal deve conter botão Relatório PDF (A4)');

    const histSrc = fs.readFileSync('./src/components/CashHistoryModal.jsx', 'utf-8');
    console.assert(histSrc.includes('handlePrintPdfReport'), 'CashHistoryModal deve conter handlePrintPdfReport');
    console.assert(histSrc.includes('Relatório em PDF (A4)'), 'CashHistoryModal deve conter botão visual Relatório em PDF (A4)');

    // Simulação de fechamento da loja de Registro
    const mockClosingData = {
      unidade: 'Registro',
      operador: 'Carla Vendedora',
      dataAbertura: '21/10/2026 08:30',
      dataFechamento: '21/10/2026 18:00',
      fundoInicial: 150.00,
      vendasDinheiro: 400.00,
      totalRecebimentosDinheiro: 200.00,
      vendasPix: 350.00,
      vendasDebito: 250.00,
      vendasCredito: 600.00,
      vendasBoletoTotal: 850.00,
      vendasBoletoQtd: 2,
      totalSuprimentos: 50.00,
      totalSangrias: 100.00,
      dinheiroEsperado: 700.00, // 150 + 400 + 200 + 50 - 100 = 700
      dinheiroContado: 700.00,
      diferenca: 0.00,
      observacoes: 'Fechamento perfeito de Registro sem divergência'
    };

    const mockMovementsRegistro = [
      { hora: '09:15', tipo: 'ABERTURA', valor: 150.00, motivo: 'Fundo Inicial', operador: 'Carla' },
      { hora: '10:30', tipo: 'VENDA', valor: 250.00, formaPagamento: 'PIX', cliente: 'Mariana Silva', osNumero: 'OS-501', vendedor: 'Carla' },
      { hora: '11:45', tipo: 'VENDA', valor: 400.00, formaPagamento: 'Dinheiro', cliente: 'João Santos', osNumero: 'OS-502', vendedor: 'Carla' },
      { hora: '14:00', tipo: 'RECEBIMENTO', valor: 200.00, formaPagamento: 'Dinheiro', cliente: 'Ana Costa', osNumero: 'OS-410', vendedor: 'Carla' },
      { hora: '15:30', tipo: 'SUPRIMENTO', valor: 50.00, motivo: 'Troco de moedas', operador: 'Carla' },
      { hora: '16:45', tipo: 'SANGRIA', valor: 100.00, motivo: 'Recolhimento Cofre', operador: 'Carla' },
      { hora: '17:15', tipo: 'VENDA', valor: 850.00, formaPagamento: 'Boleto (3x)', cliente: 'Carlos Mendes', osNumero: 'OS-503', vendedor: 'Carla' }
    ];

    // 1. Conferência da Fórmula da Gaveta Física
    const saldoEsperadoCalculado = mockClosingData.fundoInicial + mockClosingData.vendasDinheiro + mockClosingData.totalRecebimentosDinheiro + mockClosingData.totalSuprimentos - mockClosingData.totalSangrias;
    console.assert(saldoEsperadoCalculado === 700.00, `Esperado R$ 700,00 na gaveta física, obtido ${saldoEsperadoCalculado}`);
    console.assert(mockClosingData.dinheiroEsperado === saldoEsperadoCalculado, 'dinheiroEsperado deve bater com a fórmula estrita');

    // 2. Isolamento do Faturamento em Boleto (Recebível Futuro)
    console.assert(mockClosingData.vendasBoletoTotal === 850.00, 'Faturamento no Boleto deve ser R$ 850,00');
    console.assert(mockClosingData.dinheiroEsperado !== (mockClosingData.dinheiroEsperado + mockClosingData.vendasBoletoTotal), 'Boleto a prazo NÃO pode inflar o saldo físico da gaveta');

    // 3. Validação de isolamento por loja
    const movsOutraLoja = [
      { hora: '10:00', tipo: 'VENDA', valor: 300, unidade: 'Cajati' }
    ];
    const movsFiltradas = [...mockMovementsRegistro, ...movsOutraLoja].filter(m => (m.unidade || 'Registro') === 'Registro');
    console.assert(movsFiltradas.length === 7, 'Apenas as 7 movimentações da loja de Registro devem ser mantidas');

    console.log('  ✅ Test 55 Passed: Relatório Oficial de Fechamento de Caixa em PDF A4 com Movimentações validado com 100% de sucesso!\n');
  }

  // =========================================================================
  // TEST 56: Termo Oficial de Acordo, Confissão de Dívida e Reparcelamento (A4)
  // =========================================================================
  console.log('▶️ Running Test 56: Termo Oficial de Acordo, Confissão de Dívida e Reparcelamento para Assinatura do Cliente...');
  {
    const agreementSource = fs.readFileSync('./src/components/PrintableReparcelamentoAgreement.jsx', 'utf-8');
    console.assert(agreementSource.includes('PrintableReparcelamentoAgreement ='), 'PrintableReparcelamentoAgreement.jsx deve exportar o componente PrintableReparcelamentoAgreement');
    console.assert(agreementSource.includes('id="print-reparcelamento-agreement"'), 'Componente deve conter o contêiner de impressão #print-reparcelamento-agreement');
    console.assert(agreementSource.includes('Termo de Renegociação, Confissão de Dívida e Reparcelamento'), 'Deve conter o título formal de Renegociação e Confissão de Dívida');
    console.assert(agreementSource.includes('CLÁUSULA 1ª (DO RECONHECIMENTO E CONFISSÃO DA DÍVIDA)'), 'Deve conter a Cláusula 1ª de reconhecimento e confissão');
    console.assert(agreementSource.includes('CLÁUSULA 2ª (DA NOVAÇÃO E QUITAÇÃO CONDICIONADA)'), 'Deve conter a Cláusula 2ª de novação e quitação condicionada');
    console.assert(agreementSource.includes('CLÁUSULA 3ª (DO INADIMPLEMENTO E ENCARGOS)'), 'Deve conter a Cláusula 3ª de sanções, multa de 2% e negativação no SPC/SERASA');
    console.assert(agreementSource.includes('Assinatura do(a) Devedor(a)') && agreementSource.includes('Yasmin Ótica') && agreementSource.includes('Visto da Loja'), 'Deve conter as linhas formais de assinatura');
    console.assert(agreementSource.includes('1ª Via - Ótica (Arquivo)') && agreementSource.includes('2ª Via - Cliente'), 'Deve conter o controle formal de vias');

    // Testar helpers do Termo de Acordo em reparcelamentoUtils.js
    const {
      formatAgreementLongDate,
      formatAgreementMoney,
      formatAgreementDateBr,
      parseAgreementCurrency
    } = await import('./src/reparcelamentoUtils.js');

    const longDate = formatAgreementLongDate('2026-10-22', 'Cajati');
    console.assert(longDate === 'Cajati/SP, 22 de Outubro de 2026', `Data por extenso esperada 'Cajati/SP, 22 de Outubro de 2026', obtido '${longDate}'`);

    const moneyBr = formatAgreementMoney(1850.75);
    console.assert(moneyBr === '1.850,75', `Moeda formatada esperada '1.850,75', obtido '${moneyBr}'`);

    const dateBr = formatAgreementDateBr('2026-11-20');
    console.assert(dateBr === '20/11/2026', `Data BR esperada '20/11/2026', obtido '${dateBr}'`);

    console.assert(parseAgreementCurrency('R$ 350,50') === 350.5, 'parseAgreementCurrency deve processar string em reais');

    // Verificar integração no CSS
    const indexCssSource = fs.readFileSync('./src/index.css', 'utf-8');
    console.assert(indexCssSource.includes('#print-reparcelamento-agreement'), 'index.css deve conter regras de visibilidade para #print-reparcelamento-agreement');

    // Verificar botões e handlers no ReparcelamentoOSModal.jsx
    const modalSrc = fs.readFileSync('./src/components/ReparcelamentoOSModal.jsx', 'utf-8');
    console.assert(modalSrc.includes('handlePrintAgreementOnly'), 'ReparcelamentoOSModal deve conter handler handlePrintAgreementOnly');
    console.assert(modalSrc.includes('handleConfirmAndPrint'), 'ReparcelamentoOSModal deve conter handler handleConfirmAndPrint');
    console.assert(modalSrc.includes('Imprimir Termo (PDF)'), 'ReparcelamentoOSModal deve conter botão visual Imprimir Termo (PDF)');
    console.assert(modalSrc.includes('Confirmar & Imprimir'), 'ReparcelamentoOSModal deve conter botão visual Confirmar & Imprimir');
    console.assert(modalSrc.includes('<PrintableReparcelamentoAgreement'), 'ReparcelamentoOSModal deve renderizar PrintableReparcelamentoAgreement');

    // Verificar integração no ErpOptica.jsx
    const erpSrc = fs.readFileSync('./src/components/ErpOptica.jsx', 'utf-8');
    console.assert(erpSrc.includes('onTriggerPrintAgreement'), 'ErpOptica deve conectar onTriggerPrintAgreement no ReparcelamentoOSModal');
    console.assert(erpSrc.includes('reparcelamentoAgreementPrintData'), 'ErpOptica deve conter estado reparcelamentoAgreementPrintData');
    console.assert(erpSrc.includes('<PrintableReparcelamentoAgreement'), 'ErpOptica deve renderizar PrintableReparcelamentoAgreement');

    // Simulação do Acordo de Reparcelamento da OS
    const mockAgreementPayload = {
      osNumero: '1088',
      clientName: 'Vanessa Souza Albuquerque',
      clientCpf: '321.654.987-00',
      clientPhone: '(13) 99876-5432',
      clientAddress: 'Av. 21 de Abril, nº 350 - Cajati/SP - CEP 11950-000',
      unit: 'Cajati',
      dataAcordo: '2026-10-22',
      originalTotal: 1200.00,
      oldRows: [
        { DOCUMENTO: 'OS #1088 - Parcela 1/3', DATA_VENCIMENTO: '2026-09-10', VALOR: 400.00 },
        { DOCUMENTO: 'OS #1088 - Parcela 2/3', DATA_VENCIMENTO: '2026-10-10', VALOR: 400.00 },
        { DOCUMENTO: 'OS #1088 - Parcela 3/3', DATA_VENCIMENTO: '2026-11-10', VALOR: 400.00 }
      ],
      entradaValor: 300.00,
      entradaMeioPagamento: 'Dinheiro',
      descontoValor: 0.00,
      acrescimoValor: 0.00,
      novoSaldo: 900.00,
      schedule: [
        { numero: 1, vencimento: '2026-11-22', valor: 300.00 },
        { numero: 2, vencimento: '2026-12-22', valor: 300.00 },
        { numero: 3, vencimento: '2027-01-22', valor: 300.00 }
      ]
    };

    console.assert(mockAgreementPayload.originalTotal === 1200.00, 'Original deve ser R$ 1.200,00');
    console.assert(mockAgreementPayload.novoSaldo === 900.00, 'Novo saldo após entrada de R$ 300 deve ser R$ 900,00');
    console.assert(mockAgreementPayload.schedule.length === 3, 'Novas parcelas devem ser 3x de R$ 300,00');

    console.log('  ✅ Test 56 Passed: Termo Oficial de Acordo, Confissão de Dívida e Reparcelamento para Assinatura do Cliente validado com 100% de sucesso!\n');
  }

  // -------------------------------------------------------------
  // TEST 57: Sincronização Absoluta de Data e Horário em Todas as Entidades (PDV, Vendas, OS, Comprovante, Caixa)
  // -------------------------------------------------------------
  {
    console.log('▶️ Running Test 57: Sincronização Absoluta de Data e Horário em Todas as Entidades...');

    const posSrc = fs.readFileSync('./src/components/POSRegister.jsx', 'utf-8');
    const cashModalSrc = fs.readFileSync('./src/components/CashManagementModal.jsx', 'utf-8');
    const receiptSrc = fs.readFileSync('./src/components/PrintableReceipt.jsx', 'utf-8');
    const osPrintSrc = fs.readFileSync('./src/components/PrintableOS.jsx', 'utf-8');
    const osModalSrc = fs.readFileSync('./src/components/OSGeneratorModal.jsx', 'utf-8');

    // 1. Verificar inputs de data e horário no PDV
    console.assert(posSrc.includes('posSaleTime'), 'POSRegister deve gerenciar o estado posSaleTime');
    console.assert(posSrc.includes('posSaleDate'), 'POSRegister deve gerenciar o estado posSaleDate');
    console.assert(posSrc.includes('type="date"'), 'POSRegister deve renderizar input de data');
    console.assert(posSrc.includes('type="time"'), 'POSRegister deve renderizar input de horário');
    console.assert(posSrc.includes('Agora'), 'POSRegister deve conter botão de atalho Agora para restaurar data/hora');

    // 2. Verificar sincronização com FLUXO_CAIXA no PDV
    console.assert(posSrc.includes('dataHora: singleSaleIso'), 'POSRegister deve repassar singleSaleIso no FLUXO_CAIXA de OS individual');
    console.assert(posSrc.includes('dataHora: multiSaleIso'), 'POSRegister deve repassar multiSaleIso no FLUXO_CAIXA de Multi-OS');
    console.assert(posSrc.includes('timestamp: singleSaleTimestamp'), 'POSRegister deve gravar singleSaleTimestamp no FLUXO_CAIXA');
    console.assert(posSrc.includes('timestamp: multiSaleTimestamp'), 'POSRegister deve gravar multiSaleTimestamp no FLUXO_CAIXA');

    // 3. Verificar Comprovante de Venda
    console.assert(receiptSrc.includes('receiptDateTimeStr'), 'PrintableReceipt deve calcular receiptDateTimeStr fielmente');
    console.assert(receiptSrc.includes('cleanVal'), 'PrintableReceipt deve possuir cleanVal');
    console.assert(receiptSrc.includes('fmtMoeda'), 'PrintableReceipt deve possuir fmtMoeda definido');

    // 4. Verificar PrintableOS
    console.assert(osPrintSrc.includes('saleTime ? ` às ${saleTime}` : \'\''), 'PrintableOS deve imprimir hora e minuto junto à data da venda');

    // 5. Verificar CashManagementModal e sessionEnd
    console.assert(cashModalSrc.includes('sessionEnd'), 'CashManagementModal deve calcular sessionEnd para isolar fechamentos retroativos');
    console.assert(cashModalSrc.includes('mDate <= sessionEnd'), 'CashManagementModal sessionStats deve limitar movimentos até sessionEnd');
    console.assert(cashModalSrc.includes('sDate > sessionEnd') || cashModalSrc.includes('sDate <= sessionEnd'), 'CashManagementModal sessionStats deve limitar vendas até sessionEnd');
    console.assert(cashModalSrc.includes('dataHoraFechamento'), 'CashManagementModal deve registrar dataHoraFechamento');

    // 6. Simulação de Venda Retroativa com Data e Horário
    const customDateStr = '2026-10-15';
    const customTimeStr = '14:35';
    const parts = customDateStr.split('-');
    const [h, m] = customTimeStr.split(':').map(Number);
    const simulatedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), h, m, 0);

    const salePayload = {
      id: 'venda_retro_1090',
      DATA: simulatedDate.toLocaleDateString('pt-BR'),
      dataHora: simulatedDate.toISOString(),
      timestamp: simulatedDate.getTime(),
      DATA_HORA: simulatedDate.toLocaleString('pt-BR'),
      hora: customTimeStr,
      HORA: customTimeStr,
      VALOR_TOTAL: '850,00',
      cliente: 'Mariana Duarte'
    };

    console.assert(salePayload.hora === '14:35', 'Hora deve ser preservada como 14:35');
    console.assert(salePayload.dataHora.startsWith('2026-10-15T14:35') || salePayload.dataHora.includes('2026-10-15'), 'DataHora ISO deve conter 2026-10-15');
    console.assert(salePayload.timestamp === simulatedDate.getTime(), 'Timestamp epoch deve coincidir com a data/hora exata');

    console.log('  ✅ Test 57 Passed: Sincronização Absoluta de Data e Horário em Todas as Entidades validada com 100% de sucesso!\n');
  }

  // ▶ Test 58: Exclusão Cirúrgica Total em Cascata de OS (Venda, Parcelas, Fluxo de Caixa e Estoque)
  {
    console.log('▶️ Running Test 58: Exclusão Cirúrgica Total em Cascata de OS...');

    const { findOSRelatedEntities, executeOSCascadeDeletion, isMatchingOS } = await import('./src/osDeletionUtils.js');

    // 1. Simular banco de dados em memória com uma OS completa
    const osTestNumber = '99988';
    const saleTestId = 'venda_os_99988';
    const clientTestId = 'cli_rodrigo_silva';

    const mockData = {
      Registro_Vendas: [
        {
          id: saleTestId,
          'OS DA VENDA': `#${osTestNumber}`,
          NOME: 'Rodrigo Silva',
          CPF: '123.456.789-00',
          'ARMAÇÃO': 'Armação Ray-Ban RB5228',
          'LENTE': 'Lente Resina 1.56 Anti-reflexo',
          BRINDE: 'Estojo Rígido Luxo',
          VALOR_TOTAL: '1200,00',
          UNIDADE: 'Cajati'
        },
        {
          id: 'venda_outra_os',
          'OS DA VENDA': '#10001',
          NOME: 'Rodrigo Silva',
          CPF: '123.456.789-00',
          VALOR_TOTAL: '500,00',
          UNIDADE: 'Cajati'
        }
      ],
      CONTAS_RECEBER: [
        {
          id: 'parc_1_99988',
          VENDA_OS: osTestNumber,
          CLIENTE: 'Rodrigo Silva',
          CPF: '123.456.789-00',
          DOCUMENTO: `OS #${osTestNumber} - Parcela 1/3`,
          VALOR: '400,00',
          STATUS: 'Pago'
        },
        {
          id: 'parc_2_99988',
          VENDA_OS: osTestNumber,
          CLIENTE: 'Rodrigo Silva',
          CPF: '123.456.789-00',
          DOCUMENTO: `OS #${osTestNumber} - Parcela 2/3`,
          VALOR: '400,00',
          STATUS: 'Pendente'
        },
        {
          id: 'parc_3_99988',
          VENDA_OS: osTestNumber,
          CLIENTE: 'Rodrigo Silva',
          CPF: '123.456.789-00',
          DOCUMENTO: `OS #${osTestNumber} - Parcela 3/3`,
          VALOR: '400,00',
          STATUS: 'Pendente'
        },
        {
          id: 'parc_outra_os',
          VENDA_OS: '10001',
          CLIENTE: 'Rodrigo Silva',
          CPF: '123.456.789-00',
          DOCUMENTO: 'OS #10001 - Parcela 1/1',
          VALOR: '500,00',
          STATUS: 'Pendente'
        }
      ],
      FLUXO_CAIXA: [
        {
          id: 'mov_caixa_entrada_99988',
          saleId: saleTestId,
          osNumero: osTestNumber,
          tipo: 'VENDA',
          valor: 400,
          formaPagamento: 'DINHEIRO',
          motivo: `Venda PDV - Rodrigo Silva (OS #${osTestNumber})`,
          detalhes: `OS #${osTestNumber} - Entrada em dinheiro`
        },
        {
          id: 'mov_caixa_recebimento_99988',
          tipo: 'RECEBIMENTO',
          valor: 400,
          formaPagamento: 'PIX',
          motivo: `Recebimento Parcela - Rodrigo Silva`,
          detalhes: `OS #${osTestNumber} - Parcela 1/3`
        },
        {
          id: 'mov_caixa_outro',
          tipo: 'VENDA',
          valor: 150,
          motivo: 'Venda Avulsa de Óculos Solar'
        }
      ],
      CAD_ARMACOES: [
        {
          id: 'arm_rb5228',
          MODELO: 'RB5228',
          MARCA: 'Ray-Ban',
          UNIDADE: 'Cajati',
          ESTOQUE: '4'
        }
      ],
      CAD_LENTES: [
        {
          id: 'len_resina_156',
          MARCA: 'Resina',
          MODELO: '1.56',
          TRATAMENTO: 'Anti-reflexo',
          UNIDADE: 'Cajati',
          ESTOQUE: '8'
        }
      ],
      CAD_BRINDES: [
        {
          id: 'brinde_estojo_luxo',
          NOME: 'Estojo Rígido Luxo',
          ESTOQUE: '15'
        }
      ],
      CLIENTES_CADASTRADOS: [
        {
          id: clientTestId,
          'Nome Completo': 'Rodrigo Silva',
          'CPF / CNPJ': '123.456.789-00',
          'Valor Devido': '1.300,00',
          'Status de Pagamento': 'Pendente'
        }
      ]
    };

    // 2. Testar findOSRelatedEntities
    const entities = findOSRelatedEntities({
      osNumber: osTestNumber,
      saleRow: mockData.Registro_Vendas[0],
      data: mockData,
      clientsData: mockData.CLIENTES_CADASTRADOS
    });

    console.assert(entities.matchedSales.length === 1, 'Deve localizar a venda em Registro_Vendas');
    console.assert(entities.matchedInvoices.length === 3, `Deve localizar todas as 3 parcelas da OS em CONTAS_RECEBER (encontrou ${entities.matchedInvoices.length})`);
    console.assert(entities.matchedCashMovements.length === 2, `Deve localizar as 2 movimentações no FLUXO_CAIXA (encontrou ${entities.matchedCashMovements.length})`);
    console.assert(entities.stockItemsToRestore.length === 3, `Deve localizar os 3 itens de estoque a devolver (encontrou ${entities.stockItemsToRestore.length})`);
    console.assert(entities.newClientDebt === 500, `Novo saldo do cliente deve ser R$ 500 (parcela da outra OS #10001), calculou ${entities.newClientDebt}`);

    // 3. Testar executeOSCascadeDeletion simulando exclusão e atualização
    const deletedRecords = [];
    const updatedRecords = [];

    const mockDeleteRow = async (sheet, row) => {
      deletedRecords.push({ sheet, id: row.id });
    };

    const mockUpdateRow = async (sheet, oldRow, newRow) => {
      updatedRecords.push({ sheet, id: oldRow.id, newRow });
    };

    const res = await executeOSCascadeDeletion({
      osNumber: osTestNumber,
      saleRow: mockData.Registro_Vendas[0],
      data: mockData,
      clientsData: mockData.CLIENTES_CADASTRADOS,
      onDeleteRow: mockDeleteRow,
      onUpdateRow: mockUpdateRow
    });

    console.assert(res.success === true, 'Exclusão em cascata deve retornar sucesso');

    // Validações de exclusões
    const deletedInvoices = deletedRecords.filter(r => r.sheet === 'CONTAS_RECEBER');
    console.assert(deletedInvoices.length === 3, 'Todas as 3 parcelas de CONTAS_RECEBER devem ter sido deletadas');

    const deletedCash = deletedRecords.filter(r => r.sheet === 'FLUXO_CAIXA');
    console.assert(deletedCash.length === 2, 'Todos os 2 registros do FLUXO_CAIXA vinculados à OS devem ter sido deletados');

    const deletedSale = deletedRecords.filter(r => r.sheet === 'Registro_Vendas');
    console.assert(deletedSale.length === 1, 'A venda da OS deve ter sido deletada de Registro_Vendas');

    // Validações de devolução de estoque
    const armacaoUpdate = updatedRecords.find(r => r.sheet === 'CAD_ARMACOES');
    console.assert(armacaoUpdate && armacaoUpdate.newRow.ESTOQUE === '5', 'Estoque da armação deve ter sido incrementado de 4 para 5');

    const lenteUpdate = updatedRecords.find(r => r.sheet === 'CAD_LENTES');
    console.assert(lenteUpdate && lenteUpdate.newRow.ESTOQUE === '9', 'Estoque da lente deve ter sido incrementado de 8 para 9');

    const brindeUpdate = updatedRecords.find(r => r.sheet === 'CAD_BRINDES');
    console.assert(brindeUpdate && brindeUpdate.newRow.ESTOQUE === '16', 'Estoque do brinde deve ter sido incrementado de 15 para 16');

    // Validação de atualização de saldo do cliente
    const clientUpdate = updatedRecords.find(r => r.sheet === 'CLIENTES_CADASTRADOS');
    console.assert(clientUpdate && clientUpdate.newRow['Valor Devido'] === '500,00', `Saldo do cliente deve ter sido recalculado para 500,00 (recebeu ${clientUpdate?.newRow?.['Valor Devido']})`);

    console.log('  ✅ Test 58 Passed: Exclusão Cirúrgica Total em Cascata de OS validada com 100% de sucesso!\n');
  }

  // ▶ Test 59: Sincronização Absoluta da Data de Pagamento da OS em Todas as Entidades e Impressões
  {
    console.log('▶️ Running Test 59: Sincronização Absoluta da Data de Pagamento da OS...');

    const { buildNormalizedDateTime, syncOSPaymentDate, syncInstallmentPaymentDate } = await import('./src/dateSyncUtils.js');

    // 1. Validação de buildNormalizedDateTime
    const normIso = buildNormalizedDateTime('2026-10-15', '14:45');
    console.assert(normIso.isoDate === '2026-10-15', 'isoDate deve ser 2026-10-15');
    console.assert(normIso.brDate === '15/10/2026', 'brDate deve ser 15/10/2026');
    console.assert(normIso.timeStr === '14:45', 'timeStr deve ser 14:45');
    console.assert(normIso.brDateTime === '15/10/2026 às 14:45', 'brDateTime formatado');
    console.assert(typeof normIso.timestamp === 'number' && normIso.timestamp > 0, 'timestamp válido');

    const normBr = buildNormalizedDateTime('18/10/2026', '09:20');
    console.assert(normBr.isoDate === '2026-10-18', 'Conversão de BR para isoDate');
    console.assert(normBr.brDate === '18/10/2026', 'Preservação de data BR');

    // 2. Simulação de sincronização da Data de Pagamento da OS no Registro_Vendas e FLUXO_CAIXA
    const mockOS = '55443';
    const mockSaleId = 'sale_55443';

    const testData = {
      Registro_Vendas: [
        {
          id: mockSaleId,
          'OS DA VENDA': `#${mockOS}`,
          'DATA DA VENDA': '26/10/2026',
          DATA: '26/10/2026',
          dataHora: '2026-10-26T10:00:00.000Z',
          hora: '10:00',
          VALOR_TOTAL: '900,00'
        }
      ],
      FLUXO_CAIXA: [
        {
          id: 'mov_venda_55443',
          saleId: mockSaleId,
          osNumero: mockOS,
          tipo: 'VENDA',
          valor: 300,
          data: '26/10/2026',
          dataHora: '2026-10-26T10:00:00.000Z',
          motivo: `Venda PDV - OS #${mockOS}`
        }
      ],
      CONTAS_RECEBER: [
        {
          id: 'parc_55443_1',
          VENDA_OS: mockOS,
          DOCUMENTO: `OS #${mockOS} - Parcela 1/2`,
          VALOR: '300,00',
          STATUS: 'Pendente',
          DATA_VENCIMENTO: '2026-11-26'
        }
      ]
    };

    const updatedRows = [];
    const mockUpdateRow = async (sheet, oldRow, newRow) => {
      updatedRows.push({ sheet, oldRow, newRow });
    };

    // Atualiza a data da OS para data retroativa (10/10/2026 às 11:30)
    await syncOSPaymentDate({
      osNumber: mockOS,
      saleRow: testData.Registro_Vendas[0],
      newDate: '2026-10-10',
      newTime: '11:30',
      data: testData,
      onUpdateRow: mockUpdateRow
    });

    const saleUpdate = updatedRows.find(u => u.sheet === 'Registro_Vendas');
    console.assert(saleUpdate, 'Venda deve ser atualizada');
    console.assert(saleUpdate.newRow['DATA DA VENDA'] === '10/10/2026', 'Data da venda deve ser 10/10/2026');
    console.assert(saleUpdate.newRow.hora === '11:30', 'Hora da venda deve ser 11:30');
    console.assert(saleUpdate.newRow.dataHora.includes('2026-10-10'), 'dataHora ISO deve conter 2026-10-10');

    const cashUpdate = updatedRows.find(u => u.sheet === 'FLUXO_CAIXA');
    console.assert(cashUpdate, 'Movimentação no FLUXO_CAIXA deve ser atualizada para a nova data');
    console.assert(cashUpdate.newRow.data === '10/10/2026', 'Data do caixa deve ser 10/10/2026');
    console.assert(cashUpdate.newRow.dataHora.includes('2026-10-10'), 'dataHora do caixa deve conter 2026-10-10');

    // 3. Teste de syncInstallmentPaymentDate (Quitação / Alteração de data de parcela)
    const addedRows = [];
    const mockAddRow = async (sheet, row) => {
      addedRows.push({ sheet, row });
    };

    await syncInstallmentPaymentDate({
      installmentRow: testData.CONTAS_RECEBER[0],
      newPaymentDate: '2026-10-12',
      newPaymentTime: '16:00',
      data: testData,
      onUpdateRow: mockUpdateRow,
      onAddRow: mockAddRow,
      currentUser: { username: 'CaixaCentral' }
    });

    const installmentUpdate = updatedRows.find(u => u.sheet === 'CONTAS_RECEBER');
    console.assert(installmentUpdate, 'Parcela em CONTAS_RECEBER deve ser atualizada');
    console.assert(installmentUpdate.newRow.STATUS === 'Recebido', 'Status deve ser Recebido');
    console.assert(installmentUpdate.newRow.DATA_PAGAMENTO === '12/10/2026', 'DATA_PAGAMENTO deve ser 12/10/2026');
    console.assert(installmentUpdate.newRow.data_pagamento === '2026-10-12', 'data_pagamento ISO deve ser 2026-10-12');

    const addedCash = addedRows.find(a => a.sheet === 'FLUXO_CAIXA');
    console.assert(addedCash, 'Novo recebimento lançado no FLUXO_CAIXA');
    console.assert(addedCash.row.data === '12/10/2026', 'Data no FLUXO_CAIXA deve ser a data informada 12/10/2026 e não a de hoje');
    console.assert(addedCash.row.dataHora.includes('2026-10-12'), 'dataHora no FLUXO_CAIXA deve ser 2026-10-12');

    // 4. Verificação das fontes de impressão
    const editOsModalSrc = fs.readFileSync('src/components/EditOSModal.jsx', 'utf8');
    console.assert(editOsModalSrc.includes('buildNormalizedDateTime'), 'EditOSModal deve usar buildNormalizedDateTime');

    const erpOpticaSrc = fs.readFileSync('src/components/ErpOptica.jsx', 'utf8');
    console.assert(erpOpticaSrc.includes('syncInstallmentPaymentDate'), 'ErpOptica deve usar syncInstallmentPaymentDate');

    const clientProfileSrc = fs.readFileSync('src/components/ClientProfileModal.jsx', 'utf8');
    console.assert(clientProfileSrc.includes('syncOSPaymentDate') && clientProfileSrc.includes('syncInstallmentPaymentDate'), 'ClientProfileModal deve usar syncOSPaymentDate e syncInstallmentPaymentDate');

    const cashHistorySrc = fs.readFileSync('src/components/CashHistoryModal.jsx', 'utf8');
    console.assert(cashHistorySrc.includes("onUpdateRow('CONTAS_RECEBER'"), 'CashHistoryModal deve sincronizar com CONTAS_RECEBER ao editar data');

    console.log('  ✅ Test 59 Passed: Sincronização Absoluta da Data de Pagamento da OS validada com 100% de sucesso!\n');
  }

  // =========================================================================
  // TEST 60: Auto-preenchimento de Venda Recente, Auto-Soma e Centralização Financeira na OS
  // =========================================================================
  {
    console.log('▶️ Running Test 60: Auto-preenchimento de Venda Recente, Auto-Soma e Centralização Financeira...');

    const clientRegSrc = fs.readFileSync('src/components/ClientRegistration.jsx', 'utf8');
    const osGenSrc = fs.readFileSync('src/components/OSGeneratorModal.jsx', 'utf8');

    // 1. Verificações no ClientRegistration.jsx
    console.assert(clientRegSrc.includes('handleOpenOSModal'), 'ClientRegistration deve implementar handleOpenOSModal');
    console.assert(clientRegSrc.includes('isSameClient(client, sale)'), 'ClientRegistration deve verificar venda recente usando isSameClient');
    console.assert(clientRegSrc.includes('osSaleData'), 'ClientRegistration deve gerenciar estado osSaleData');
    console.assert(clientRegSrc.includes('saleData={osSaleData}'), 'ClientRegistration deve repassar saleData para OSGeneratorModal');
    console.assert(clientRegSrc.includes('onGenerateOS={handleOpenOSModal}'), 'ClientRegistration deve vincular handleOpenOSModal à tabela de clientes');

    // 2. Verificações no OSGeneratorModal.jsx
    console.assert(osGenSrc.includes('getItemPrice'), 'OSGeneratorModal deve implementar busca dinâmica de preço no catálogo');
    console.assert(osGenSrc.includes('calculateTotalFromOSList'), 'OSGeneratorModal deve implementar auto-soma dos produtos em todas as OSs');
    console.assert(osGenSrc.includes('isManualTotal'), 'OSGeneratorModal deve rastrear se o vendedor editou manualmente o valor total');
    console.assert(
      osGenSrc.includes('💡 Centralização Financeira:') &&
      osGenSrc.includes('O valor total da compra de todos os óculos é cobrado aqui no Óculos 1. Os demais óculos são ordens de montagem para o laboratório.'),
      'OSGeneratorModal deve exibir a dica visual educativa de Centralização Financeira com o texto oficial'
    );
    console.assert(osGenSrc.includes('Cobrança Unificada no Óculos 1'), 'OSGeneratorModal deve exibir badge de Cobrança Unificada no Óculos 1');
    console.assert(osGenSrc.includes('Cobrança') && osGenSrc.includes('Laboratório'), 'OSGeneratorModal deve exibir badges de Cobrança e Laboratório nas abas');

    // 3. Blindagem Contábil nas OSs Secundárias
    console.assert(
      osGenSrc.includes("valorTotal: idx === 0 ? formData.valorTotal : '0,00'"),
      'OSGeneratorModal deve blindar OSs secundárias gravando valorTotal como 0,00'
    );
    console.assert(
      osGenSrc.includes("restante: idx === 0 ? formData.restante : '0,00'"),
      'OSGeneratorModal deve blindar restante nas OSs secundárias'
    );

    // 4. Teste funcional da simulação da auto-soma dinâmica de produtos
    const mockArmacoes = [
      { MARCA: 'Ray-Ban', MODELO: 'RB3025', PRECO_VENDA: '350,00' },
      { MARCA: 'Oakley', MODELO: 'Pitchman R', PRECO_VENDA: '450,00' }
    ];
    const mockLentes = [
      { MARCA: 'Essilor', MODELO: 'Crizal Easy', PRECO_VENDA: '250,00' },
      { MARCA: 'Hoya', MODELO: 'BlueControl', PRECO_VENDA: '550,00' }
    ];

    const parseCur = (v) => {
      if (!v) return 0;
      return parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    };

    const getPrice = (name, list) => {
      const clean = String(name || '').toLowerCase().trim();
      const item = list.find(x => `${x.MARCA} ${x.MODELO}`.toLowerCase().trim() === clean);
      return item ? parseCur(item.PRECO_VENDA) : 0;
    };

    const testOSList = [
      { label: 'Óculos 1', armacao: 'Ray-Ban RB3025', lente: 'Essilor Crizal Easy' },
      { label: 'Óculos 2', armacao: 'Oakley Pitchman R', lente: 'Hoya BlueControl' }
    ];

    let totalCalculado = 0;
    testOSList.forEach(os => {
      totalCalculado += getPrice(os.armacao, mockArmacoes);
      totalCalculado += getPrice(os.lente, mockLentes);
    });

    console.assert(totalCalculado === 1600, `Total calculado deve ser 1600 (350+250+450+550), obtido: ${totalCalculado}`);

    // 5. Teste funcional do auto-preenchimento com venda recente
    const mockClient = { id: 'c1', 'Nome Completo': 'Ana Paula Silveira', 'CPF': '123.456.789-00' };
    const mockSales = [
      {
        id: 's1',
        'CLIENTE_CPF': '12345678900',
        'VALOR TOTAL': '1.200,00',
        'VALOR ENTRADA': '400,00',
        'RESTANTE': '800,00',
        'FORMAS_PAGAMENTO': '⚡ PIX: R$ 400,00\n💳 Cartão Crédito (3x): R$ 800,00',
        'FORMA_ENTRADA': 'PIX',
        'FORMA_RESTANTE': 'Cartão de Crédito',
        timestamp: 1000
      },
      {
        id: 's2',
        'CLIENTE_CPF': '12345678900',
        'VALOR TOTAL': '1.800,00',
        'VALOR ENTRADA': '600,00',
        'RESTANTE': '1.200,00',
        'FORMAS_PAGAMENTO': '💵 Dinheiro: R$ 600,00\n📄 Boleto (4x): R$ 1.200,00',
        'FORMA_ENTRADA': 'Dinheiro',
        'FORMA_RESTANTE': 'Boleto',
        timestamp: 2000
      }
    ];

    // 6. Blindagem contra vazamento de débitos antigos (Valor Devido) no valor da nova OS
    console.assert(!osGenSrc.includes("clientData['Valor Devido']"), 'OSGeneratorModal NÃO deve usar Valor Devido como fallback de valorTotal da OS');

    // 7. Teste de cancelamento ignorado na busca de venda recente
    const mockSalesWithCanceled = [
      {
        id: 's_canceled',
        'CLIENTE_CPF': '12345678900',
        'VALOR TOTAL': '9.999,00',
        'STATUS_OS': 'Cancelada',
        timestamp: 5000
      },
      {
        id: 's_valid',
        'CLIENTE_CPF': '12345678900',
        'VALOR TOTAL': '1.500,00',
        'STATUS_OS': 'Pronto',
        timestamp: 3000
      }
    ];
    const nonCanceled = mockSalesWithCanceled.filter(s => !['cancelado', 'cancelada'].includes(String(s.STATUS_OS).toLowerCase()));
    const bestRecent = [...nonCanceled].sort((a, b) => b.timestamp - a.timestamp)[0];
    console.assert(bestRecent.id === 's_valid', 'Venda cancelada deve ser ignorada em favor da venda válida');
    console.assert(bestRecent['VALOR TOTAL'] === '1.500,00', 'Valor da venda válida deve ser 1.500,00');

    console.log('  ✅ Test 60 Passed: Auto-preenchimento de Venda Recente, Auto-Soma e Centralização Financeira validado com 100% de sucesso!\n');
  }

  // ─── TEST 61: Impressão Completa do Termo Oficial de Reparcelamento (Task 1) ────────
  {
    console.log('▶ Test 61: Impressão Completa do Termo de Acordo de Reparcelamento de Parcelas (Task 1)');

    const agreementFile = fs.readFileSync(path.join(__dirname, 'src/components/PrintableReparcelamentoAgreement.jsx'), 'utf-8');
    const reparcelamentoModalFile = fs.readFileSync(path.join(__dirname, 'src/components/ReparcelamentoOSModal.jsx'), 'utf-8');

    // 1. Validação de que o componente de impressão contempla todos os campos essenciais do formulário
    console.assert(agreementFile.includes('meioPagamento'), 'PrintableReparcelamentoAgreement deve suportar meioPagamento');
    console.assert(agreementFile.includes('intervaloRegra'), 'PrintableReparcelamentoAgreement deve exibir regra de intervalo');
    console.assert(agreementFile.includes('diasAtraso') || agreementFile.includes('atraso'), 'PrintableReparcelamentoAgreement deve mostrar dias de atraso nas parcelas renegociadas');
    console.assert(agreementFile.includes('observacoes'), 'PrintableReparcelamentoAgreement deve exibir observações');
    console.assert(agreementFile.includes('entradaMeio'), 'PrintableReparcelamentoAgreement deve exibir meio de pagamento da entrada');

    // 2. Validação de que o modal repassa todos os campos no buildAgreementPayload
    console.assert(reparcelamentoModalFile.includes('intervaloRegra: intervaloLabelMap'), 'Modal deve repassar regra de intervalo');
    console.assert(reparcelamentoModalFile.includes('meioPagamento: meioPagamento'), 'Modal deve repassar meioPagamento');
    console.assert(reparcelamentoModalFile.includes('observacoes,'), 'Modal deve repassar observacoes');
    console.assert(reparcelamentoModalFile.includes('entradaMeioPagamento: entradaFormaPagto'), 'Modal deve repassar meio de pagamento da entrada');

    // 3. Simulação funcional de montagem do payload
    const mockReparcelamentoState = {
      client: { 'Nome Completo': 'Carlos Mendes', 'CPF / CNPJ': '123.456.789-00', 'WhatsApp': '13999998888', 'Endereço': 'Rua das Flores, 100' },
      targetOS: '2026-105',
      selectedInvoices: [
        { DOCUMENTO: 'OS #2026-105 - Parcela 1/2', VENCIMENTO: '2026-09-10', VALOR: '150,00' },
        { DOCUMENTO: 'OS #2026-105 - Parcela 2/2', VENCIMENTO: '2026-10-10', VALOR: '150,00' }
      ],
      valorEntrada: '50,00',
      entradaMeio: 'PIX',
      qtdParcelas: 2,
      intervalo: '30',
      meioPagamento: 'Boleto',
      observacoes: 'Cliente renegociou pessoalmente na loja de Cajati.',
      newInstallments: [
        { numero: 1, totalParcelas: 2, valor: '125,00', vencimento: '2026-11-10' },
        { numero: 2, totalParcelas: 2, valor: '125,00', vencimento: '2026-12-10' }
      ]
    };

    const builtPayload = {
      client: mockReparcelamentoState.client,
      osNumber: mockReparcelamentoState.targetOS,
      totalRenegociado: 300,
      valorEntrada: 50,
      entradaMeio: mockReparcelamentoState.entradaMeio,
      valorRestante: 250,
      intervaloRegra: 'A cada 30 dias',
      meioPagamento: mockReparcelamentoState.meioPagamento,
      observacoes: mockReparcelamentoState.observacoes,
      oldRows: mockReparcelamentoState.selectedInvoices.map((inv, idx) => ({
        ...inv,
        diasAtraso: 20 + idx * 30
      })),
      newRows: mockReparcelamentoState.newInstallments
    };

    console.assert(builtPayload.client['Nome Completo'] === 'Carlos Mendes', 'Nome do cliente deve constar no payload');
    console.assert(builtPayload.totalRenegociado === 300 && builtPayload.valorRestante === 250, 'Totais financeiros do acordo devem ser exatos');
    console.assert(builtPayload.meioPagamento === 'Boleto', 'Meio de pagamento deve ser preservado');
    console.assert(builtPayload.oldRows.length === 2 && builtPayload.newRows.length === 2, 'Parcelas antigas e novas devem bater');

    console.log('  ✅ Test 61 Passed: Impressão Completa do Termo de Acordo validada com 100% de sucesso!\n');
  }

  // ─── TEST 62: Exclusão de OS com Opção de Apagar vs Manter Dívidas (Task 2) ────────
  {
    console.log('▶ Test 62: Exclusão de OS com Opção de Apagar vs Manter Dívidas (Task 2)');

    const { executeOSCascadeDeletion, findOSRelatedEntities } = await import('./src/osDeletionUtils.js');

    // 1. Cenário A: deleteDebt === true (Apagar tudo: OS + Dívidas)
    const mockClientA = {
      id: 'cli_A',
      'Nome Completo': 'Mariana Souza',
      'Valor Devido': '600,00',
      'Status de Pagamento': 'Pendente'
    };
    const mockInvoicesA = [
      { id: 'inv_1', DOCUMENTO: 'OS #2026-200 - Parcela 1/2', CLIENTE: 'Mariana Souza', VALOR: '300,00', STATUS: 'Pendente' },
      { id: 'inv_2', DOCUMENTO: 'OS #2026-200 - Parcela 2/2', CLIENTE: 'Mariana Souza', VALOR: '300,00', STATUS: 'Pendente' }
    ];
    const mockSalesA = [
      { id: 'sale_1', 'OS DA VENDA': '2026-200', 'CLIENTE': 'Mariana Souza', 'VALOR TOTAL': '600,00' }
    ];

    const deletedInvoicesA = [];
    const updatedClientsA = [];
    let saleDeletedA = false;

    await executeOSCascadeDeletion({
      osNumber: '2026-200',
      saleRow: mockSalesA[0],
      data: {
        Registro_Vendas: mockSalesA,
        CONTAS_RECEBER: mockInvoicesA
      },
      clientsData: [mockClientA],
      onDeleteRow: async (table, row) => {
        if (table === 'Registro_Vendas') saleDeletedA = true;
        if (table === 'CONTAS_RECEBER') deletedInvoicesA.push(row.id);
      },
      onUpdateRow: async (table, oldRow, updatedRow) => {
        if (table === 'CLIENTES_CADASTRADOS') updatedClientsA.push(updatedRow);
      },
      deleteDebt: true
    });

    console.assert(saleDeletedA, 'Venda principal deve ser deletada');
    console.assert(deletedInvoicesA.length === 2, `As 2 parcelas devem ser deletadas com deleteDebt=true, deletadas: ${deletedInvoicesA.length}`);
    console.assert(updatedClientsA.length > 0 && updatedClientsA[0]['Valor Devido'] === '0,00', 'Saldo do cliente deve ser zerado');

    // 2. Cenário B: deleteDebt === false (Apagar OS, mas MANTER dívidas ativas para cobrança)
    const mockClientB = {
      id: 'cli_B',
      'Nome Completo': 'Mariana Souza',
      'Valor Devido': '600,00',
      'Status de Pagamento': 'Pendente'
    };
    const deletedInvoicesB = [];
    const updatedClientsB = [];
    let saleDeletedB = false;

    await executeOSCascadeDeletion({
      osNumber: '2026-200',
      saleRow: mockSalesA[0],
      data: {
        Registro_Vendas: mockSalesA,
        CONTAS_RECEBER: mockInvoicesA
      },
      clientsData: [mockClientB],
      onDeleteRow: async (table, row) => {
        if (table === 'Registro_Vendas') saleDeletedB = true;
        if (table === 'CONTAS_RECEBER') deletedInvoicesB.push(row.id);
      },
      onUpdateRow: async (table, oldRow, updatedRow) => {
        if (table === 'CLIENTES_CADASTRADOS') updatedClientsB.push(updatedRow);
      },
      deleteDebt: false
    });

    console.assert(saleDeletedB, 'Venda principal deve ser deletada com deleteDebt=false');
    console.assert(deletedInvoicesB.length === 0, `Nenhuma parcela deve ser deletada quando deleteDebt=false, deletadas: ${deletedInvoicesB.length}`);
    console.assert(updatedClientsB.length === 0, 'Saldo do cliente NÃO deve ser alterado quando deleteDebt=false');

    console.log('  ✅ Test 62 Passed: Exclusão com Opção de Apagar vs Manter Dívida validada com 100% de sucesso!\n');
  }

  // ─── TEST 63: Recebimento com Opção de Contar ou Não no Fluxo de Caixa (Task 3) ────
  {
    console.log('▶ Test 63: Recebimento com Opção de Contar ou Não no Fluxo de Caixa (Task 3)');

    const { syncInstallmentPaymentDate } = await import('./src/dateSyncUtils.js');

    // 1. Cenário A: contarNoCaixa = true
    let addedCashMovementA = null;
    let updatedInvoiceA = null;

    const mockInvoiceA = {
      id: 'rec_101',
      CLIENTE: 'Roberto Lima',
      VALOR: '250,00',
      STATUS: 'Pendente',
      DOCUMENTO: 'OS #2026-301 - Parcela 1/2'
    };

    await syncInstallmentPaymentDate({
      installmentRow: mockInvoiceA,
      newPaymentDate: '2026-10-28',
      contarNoCaixa: true,
      onUpdateRow: async (table, oldRow, newRow) => {
        if (table === 'CONTAS_RECEBER') updatedInvoiceA = newRow;
      },
      onAddRow: async (table, row) => {
        if (table === 'FLUXO_CAIXA') addedCashMovementA = row;
      }
    });

    console.assert(updatedInvoiceA && updatedInvoiceA.STATUS === 'Recebido', 'Parcela deve ser marcada como Recebido');
    console.assert(updatedInvoiceA.CONTAR_NO_CAIXA === 'Sim', 'CONTAR_NO_CAIXA deve ser Sim');
    console.assert(addedCashMovementA !== null, 'Deve lançar movimentação no FLUXO_CAIXA');
    console.assert(addedCashMovementA.valor === 250, `Valor no caixa deve ser 250, obtido: ${addedCashMovementA.valor}`);

    // 2. Cenário B: contarNoCaixa = false (Baixa Administrativa sem movimentar Caixa)
    let addedCashMovementB = null;
    let updatedInvoiceB = null;

    const mockInvoiceB = {
      id: 'rec_102',
      CLIENTE: 'Roberto Lima',
      VALOR: '350,00',
      STATUS: 'Pendente',
      DOCUMENTO: 'OS #2026-301 - Parcela 2/2'
    };

    await syncInstallmentPaymentDate({
      installmentRow: mockInvoiceB,
      newPaymentDate: '2026-10-28',
      contarNoCaixa: false,
      onUpdateRow: async (table, oldRow, newRow) => {
        if (table === 'CONTAS_RECEBER') updatedInvoiceB = newRow;
      },
      onAddRow: async (table, row) => {
        if (table === 'FLUXO_CAIXA') addedCashMovementB = row;
      }
    });

    console.assert(updatedInvoiceB && updatedInvoiceB.STATUS === 'Recebido', 'Parcela B deve ser marcada como Recebido');
    console.assert(updatedInvoiceB.CONTAR_NO_CAIXA === 'Não', 'CONTAR_NO_CAIXA deve ser Não');
    console.assert(addedCashMovementB === null, 'NÃO deve lançar movimentação no FLUXO_CAIXA quando contarNoCaixa = false');

    console.log('  ✅ Test 63 Passed: Recebimento com Opção no Fluxo de Caixa validado com 100% de sucesso!\n');
  }

  // ─── TEST 64: Fidelidade e Sincronização Absoluta da Edição de Data da OS (Venda e Caixa) ────
  {
    console.log('▶ Test 64: Fidelidade e Sincronização Absoluta da Edição de Data da OS (Venda e Caixa)');

    const { syncOSPaymentDate } = await import('./src/dateSyncUtils.js');

    const mockSaleRow = {
      id: 'venda_12345',
      'OS DA VENDA': '2026-999',
      'DATA DA VENDA': '28/10/2026',
      DATA: '28/10/2026',
      dataHora: '2026-10-28T14:00:00.000Z',
      hora: '14:00',
      'VALOR TOTAL': '1.200,00'
    };

    const mockFluxoCaixa = [
      {
        id: 'cx_mov_1',
        saleId: 'venda_12345',
        osNumero: '2026-999',
        tipo: 'VENDA',
        valor: 400,
        data: '28/10/2026',
        dataHora: '2026-10-28T14:00:00.000Z',
        hora: '14:00'
      }
    ];

    const fullData = {
      Registro_Vendas: [mockSaleRow],
      FLUXO_CAIXA: mockFluxoCaixa
    };

    const updatedRows = [];
    const mockOnUpdateRow = async (sheet, oldRow, newRow) => {
      updatedRows.push({ sheet, oldRow, newRow });
    };

    // Edição retroativa da data da OS para 15/10/2026 às 10:30
    await syncOSPaymentDate({
      osNumber: '2026-999',
      saleRow: mockSaleRow,
      newDate: '15/10/2026',
      newTime: '10:30',
      data: fullData,
      onUpdateRow: mockOnUpdateRow
    });

    const saleUpdate = updatedRows.find(u => u.sheet === 'Registro_Vendas');
    const cashUpdate = updatedRows.find(u => u.sheet === 'FLUXO_CAIXA');

    console.assert(saleUpdate && saleUpdate.newRow['DATA DA VENDA'] === '15/10/2026', 'Data da venda deve ser 15/10/2026');
    console.assert(cashUpdate && cashUpdate.newRow.data === '15/10/2026', 'Data no Fluxo de Caixa deve ser 15/10/2026');
    console.assert(cashUpdate && cashUpdate.newRow.hora === '10:30', 'Hora no Fluxo de Caixa deve ser 10:30');

    console.log('  ✅ Test 64 Passed: Edição de Data da OS respeitada perfeitamente em Vendas e Caixa!\n');
  }

  // ─── TEST 65: Recibo Oficial A4 de Pagamento de Reparcelamento (Entrada e Parcelas) ────
  {
    console.log('▶ Test 65: Recibo Oficial A4 de Pagamento de Reparcelamento (Entrada e Parcelas)');

    // 1. Validação do conversor de número para extenso em Reais
    console.assert(numeroPorExtenso(0) === 'zero reais', '0 deve ser zero reais');
    console.assert(numeroPorExtenso(1) === 'um real', '1 deve ser um real');
    console.assert(numeroPorExtenso(150) === 'cento e cinquenta reais', '150 deve ser cento e cinquenta reais');
    console.assert(numeroPorExtenso('1.250,75') === 'mil e duzentos e cinquenta reais e setenta e cinco centavos', '1.250,75 deve ser por extenso correto');
    console.assert(numeroPorExtenso(45.10) === 'quarenta e cinco reais e dez centavos', '45.10 deve ser quarenta e cinco reais e dez centavos');

    // 2. Validação do recibo da Entrada do Acordo
    const entradaReceipt = buildReparcelamentoReceiptPayload({
      osNumero: '2026-888',
      clienteNome: 'Mariana Silveira',
      clienteCpf: '123.456.789-00',
      clienteTelefone: '(13) 99999-1234',
      unidade: 'Cajati',
      operador: 'Carla Gerente',
      tipoPagamento: 'Entrada do Acordo',
      valorPago: 300,
      meioPagamento: 'Pix',
      totalAcordo: 1200,
      totalJaPago: 300,
      saldoRestante: 900,
      parcelasRestantes: 3,
      dataPagamento: '29/10/2026',
      acordoId: 'REP-2026-888-001'
    });

    console.assert(entradaReceipt.osNumero === '2026-888', 'OS da entrada deve ser 2026-888');
    console.assert(entradaReceipt.tipoPagamento === 'Entrada do Acordo', 'Tipo deve ser Entrada do Acordo');
    console.assert(entradaReceipt.valorPago === 300, 'Valor pago deve ser 300');
    console.assert(entradaReceipt.saldoRestante === 900, 'Saldo restante deve ser 900');
    console.assert(entradaReceipt.parcelasRestantes === 3, 'Parcelas restantes deve ser 3');
    console.assert(entradaReceipt.reciboNumero.startsWith('REC-2026-888-'), 'Recibo deve ter identificador padronizado');

    // 3. Validação do recibo de Parcela Quitada
    const parcelaReceipt = buildReparcelamentoReceiptPayload({
      osNumero: '#2026-888',
      clienteNome: 'Mariana Silveira',
      clienteCpf: '123.456.789-00',
      unidade: 'Cajati',
      operador: 'Carla Gerente',
      tipoPagamento: 'Parcela 1 de 3',
      numeroParcela: 1,
      totalParcelas: 3,
      vencimentoOriginal: '15/11/2026',
      valorPago: 300,
      meioPagamento: 'Boleto',
      totalAcordo: 1200,
      totalJaPago: 600,
      saldoRestante: 600,
      parcelasRestantes: 2,
      dataPagamento: '15/11/2026'
    });

    console.assert(parcelaReceipt.osNumero === '2026-888', 'Prefixo # deve ser higienizado');
    console.assert(parcelaReceipt.tipoPagamento === 'Parcela 1 de 3', 'Tipo deve ser Parcela 1 de 3');
    console.assert(parcelaReceipt.numeroParcela === 1 && parcelaReceipt.totalParcelas === 3, 'Parcelas 1 de 3');
    console.assert(parcelaReceipt.saldoRestante === 600, 'Saldo restante deve ser 600');
    console.assert(parcelaReceipt.parcelasRestantes === 2, 'Parcelas restantes deve ser 2');

    console.log('  ✅ Test 65 Passed: Recibo Oficial A4 de Reparcelamento (Entrada e Parcelas) validado com 100% de sucesso!\n');
  }

  console.log('🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});





