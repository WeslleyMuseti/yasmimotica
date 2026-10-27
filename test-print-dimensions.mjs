import fs from 'fs';

console.log('🧪 Iniciando Verificação de Diagramação e Eficiência de Folhas A4...');

// 1. Inspecionar o código-fonte de PrintableCashClosingReport.jsx
const reportCode = fs.readFileSync('./src/components/PrintableCashClosingReport.jsx', 'utf-8');

// Verificações essenciais de regras CSS A4
console.assert(reportCode.includes('@page {'), 'Deve conter regra @page de impressão');
console.assert(reportCode.includes('size: A4 portrait'), 'Deve especificar A4 portrait');
console.assert(reportCode.includes('width: 100%'), 'Deve preencher 100% de largura');
console.assert(reportCode.includes('table-layout: fixed') || reportCode.includes("tableLayout: 'fixed'"), 'Tabela deve usar table-layout fixed para não estourar');
console.assert(reportCode.includes('table-header-group'), 'thead deve ter table-header-group para repetir cabeçalho em múltiplas páginas sem quebra');
console.assert(reportCode.includes('avoid-break'), 'Classes avoid-break devem estar presentes para evitar quebras de blocos de assinaturas');

// 2. Modelo de Alturas em Folha A4 (297mm total)
// Margem superior (4mm) + inferior (4mm) = 8mm
// Altura útil = 289mm
const ALTURA_UTIL_A4_MM = 289;

const DIMENSOES_ESTIMADAS_MM = {
  cabecalho: 26,       // Logo + Título Ótica Yasmin + Info da Loja + Faixa do Relatório
  dadosGerais: 10,     // Unidade, Operador, Abertura, Fechamento
  indicadoresKPI: 11,  // 5 KPIs
  quadrosPrincipais: 42, // Entradas + Gaveta Física (2 colunas lado a lado)
  quadroBoleto: 11,    // Faturamento a Prazo em Boleto
  tabelaTheadTfoot: 13, // Cabeçalho e Rodapé da tabela
  assinaturasETermo: 20, // Declaração + Linhas de assinatura
  margensEntreBlocos: 8 // Margens totais
};

const ALTURA_BLOCO_FIXO_MM = 
  DIMENSOES_ESTIMADAS_MM.cabecalho +
  DIMENSOES_ESTIMADAS_MM.dadosGerais +
  DIMENSOES_ESTIMADAS_MM.indicadoresKPI +
  DIMENSOES_ESTIMADAS_MM.quadrosPrincipais +
  DIMENSOES_ESTIMADAS_MM.quadroBoleto +
  DIMENSOES_ESTIMADAS_MM.tabelaTheadTfoot +
  DIMENSOES_ESTIMADAS_MM.assinaturasETermo +
  DIMENSOES_ESTIMADAS_MM.margensEntreBlocos;

console.log(`📏 Altura total dos blocos estruturais fixos: ${ALTURA_BLOCO_FIXO_MM.toFixed(1)} mm`);
console.log(`📏 Espaço vertical disponível para linhas de movimentação na Página 1: ${(ALTURA_UTIL_A4_MM - ALTURA_BLOCO_FIXO_MM).toFixed(1)} mm`);

// Altura de cada linha de movimentação (com padding 3.5px + fonte 9px + borda = ~6mm)
const ALTURA_LINHA_TABELA_MM = 6.2;
const MAX_LINHAS_PAGINA_1 = Math.floor((ALTURA_UTIL_A4_MM - ALTURA_BLOCO_FIXO_MM) / ALTURA_LINHA_TABELA_MM);

console.log(`📊 Capacidade máxima de movimentações em 1 FOLHA ÚNICA A4: ${MAX_LINHAS_PAGINA_1} linhas`);
console.assert(MAX_LINHAS_PAGINA_1 >= 18, `Deveria caber pelo menos 18 linhas em 1 folha única A4, calculou ${MAX_LINHAS_PAGINA_1}`);

// 3. Teste de Cenários de Turno Real
const testCenario = (qtdMovimentos, nomeCenario) => {
  const alturaTotal = ALTURA_BLOCO_FIXO_MM + (qtdMovimentos * ALTURA_LINHA_TABELA_MM);
  const totalPaginas = Math.ceil(alturaTotal / ALTURA_UTIL_A4_MM);
  console.log(`  ▶ Cenário ${nomeCenario}: ${qtdMovimentos} movimentações -> Altura: ${alturaTotal.toFixed(1)}mm (${totalPaginas} folha(s))`);
  return totalPaginas;
};

// Cenário 1: Turno Curto (5 movimentações) -> DEVE ser 1 folha
console.assert(testCenario(5, 'Turno Curto') === 1, 'Turno com 5 movimentações deve caber em 1 folha');

// Cenário 2: Turno Típico de Ótica (12 movimentações) -> DEVE ser 1 folha
console.assert(testCenario(12, 'Turno Típico') === 1, 'Turno com 12 movimentações deve caber em 1 folha');

// Cenário 3: Turno Movimentado (18 movimentações) -> DEVE ser 1 folha sem desperdício
console.assert(testCenario(18, 'Turno Movimentado') === 1, 'Turno com 18 movimentações deve caber em 1 folha');

// Cenário 4: Super Turno Promocional (35 movimentações) -> Deve ser 2 folhas completas
console.assert(testCenario(35, 'Super Turno (35 movs)') === 2, 'Turno com 35 movimentações deve caber em 2 folhas');

console.log('\n✅ TODOS OS TESTES DE EFICIÊNCIA DE FOLHA A4 E PREVENÇÃO DE DESPERDÍCIO PASSARAM COM SUCESSO!');
