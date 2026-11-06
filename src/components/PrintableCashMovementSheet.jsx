import React from 'react';
import ReactDOM from 'react-dom';
import {
  parseMovementNum,
  formatMovementMoney,
  formatMovementMoneyWithPrefix,
  prepareCashMovementRows,
  buildSynthesizedMovementRows
} from '../cashMovementUtils';

export {
  parseMovementNum,
  formatMovementMoney,
  formatMovementMoneyWithPrefix,
  prepareCashMovementRows,
  buildSynthesizedMovementRows
};

/**
 * 📄 PrintableCashMovementSheet
 * Ficha Contábil Oficial de "MOVIMENTO DO CAIXA"
 * Reproduz com 100% de fidelidade o layout físico tradicional em papel A4:
 * - Cabeçalho: MOVIMENTO DO CAIXA, DATA, Nº, EMPRESA
 * - Tabela com 5 colunas oficiais: DOC. Nº, HISTÓRICO, VENDAS, ENTRADAS, SAÍDAS
 * - Rodapé: DETALHES DO SALDO (Dinheiro, PIX/Cheques, Cartão Débito, Cartão Crédito, Boleto/Carnê, Total)
 * - Totalizadores: A TRANSPORTAR / TOTAL DO DIA (Vendas, Entradas, Saídas), SALDO ANTERIOR, SALDO ATUAL (GAVETA), (DEMAIS PARA CONFERÊNCIA)
 * - Assinaturas: CAIXA e VISTO
 */
export const PrintableCashMovementSheet = ({
  closingData = {},
  movements = [],
  storeName = 'Central',
  shiftNumber = '',
  dateStr = '',
  containerId = 'print-cash-movement-sheet'
}) => {
  const unit = storeName || closingData.unidade || closingData.loja || closingData.cidade || 'Central';
  const operator = closingData.operador || closingData.vendedor || closingData.usuario || 'Operador de Caixa';

  // Data formatada
  const displayDate = dateStr || (() => {
    const rawDate = closingData.dataFechamento || closingData.dataHoraFechamento || closingData.dataHora || closingData.dataAbertura || new Date();
    if (rawDate instanceof Date) {
      return rawDate.toLocaleDateString('pt-BR');
    }
    const s = String(rawDate).trim();
    if (s.includes('/')) return s.split(' ')[0];
    if (s.includes('-')) {
      const parts = s.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date().toLocaleDateString('pt-BR');
  })();

  // Número sequencial do fechamento / turno
  const displayShiftNo = shiftNumber || closingData.numeroFechamento || closingData.idFechamento || closingData.id || (() => {
    const raw = String(closingData.id || '').replace(/\D/g, '');
    return raw ? raw.slice(-4) : '001';
  })();

  // Cálculo e estruturação de linhas e balanço contábil
  const {
    rows: allDisplayRows,
    totalVendasFinal,
    totalEntradasFinal,
    totalSaidasFinal,
    saldoAnterior,
    saldoAtual,
    demaisConferencia,
    totalDinheiroDetalhes,
    totalChequesPixDetalhes,
    totalDebitoDetalhes,
    totalCreditoDetalhes,
    totalBoletoDetalhes,
    totalGeralDetalhes
  } = prepareCashMovementRows(closingData, movements, 24);

  const content = (
    <div
      id={containerId}
      className="hidden print:block"
      style={{
        width: '100%',
        maxWidth: '198mm',
        margin: '0 auto',
        padding: '0',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif",
        boxSizing: 'border-box',
        lineHeight: 1.15
      }}
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 7mm 6mm 7mm;
        }
        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-cash-movement-sheet, #print-cash-movement-sheet *,
          #print-cash-closing-report, #print-cash-closing-report * {
            visibility: visible !important;
          }
          #print-cash-movement-sheet,
          #print-cash-closing-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            z-index: 9999999 !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ─── MOLDURA EXTERNA DO FORMULÁRIO CONTÁBIL ─── */}
      <div
        style={{
          border: '1.5px solid #000000',
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff'
        }}
      >
        {/* ─── 1. CABEÇALHO SUPERIOR ─── */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1.5px solid #000000',
            width: '100%'
          }}
        >
          {/* Lado Esquerdo: Título e Empresa */}
          <div
            style={{
              flex: '1 1 65%',
              padding: '6px 10px 4px 10px',
              borderRight: '1.5px solid #000000',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div
              style={{
                fontSize: '17px',
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#000000',
                paddingBottom: '4px'
              }}
            >
              MOVIMENTO DO CAIXA
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: 900 }}>EMPRESA:</span>
              <span
                style={{
                  flex: 1,
                  borderBottom: '1px solid #555555',
                  paddingLeft: '4px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#111111'
                }}
              >
                YASMIN ÓTICA LTDA{unit && unit !== 'Central' && unit !== 'Todas as Lojas' ? ` • ${String(unit).toUpperCase()}` : ''}
              </span>
            </div>
          </div>

          {/* Lado Direito: DATA e Nº */}
          <div
            style={{
              flex: '0 0 35%',
              display: 'flex',
              flexDirection: 'row'
            }}
          >
            {/* Box DATA */}
            <div
              style={{
                flex: 1,
                borderRight: '1px solid #000000',
                padding: '4px 6px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor: '#f8f9fa'
              }}
            >
              <span style={{ fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', color: '#333333' }}>
                DATA
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  textAlign: 'center',
                  padding: '2px 0',
                  color: '#000000'
                }}
              >
                {displayDate}
              </span>
            </div>

            {/* Box Nº */}
            <div
              style={{
                flex: 1,
                padding: '4px 6px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor: '#f8f9fa'
              }}
            >
              <span style={{ fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', color: '#333333' }}>
                Nº
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  textAlign: 'center',
                  padding: '2px 0',
                  color: '#000000'
                }}
              >
                {String(displayShiftNo).startsWith('#') ? displayShiftNo : `#${displayShiftNo}`}
              </span>
            </div>
          </div>
        </div>

        {/* ─── 2. TABELA DE MOVIMENTAÇÕES (GRID CONTÁBIL COM CAMPO DE VENDAS) ─── */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            fontSize: '9.5px',
            color: '#000000'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#ffffff', borderBottom: '1.5px solid #000000' }}>
              <th
                style={{
                  width: '10%',
                  padding: '3px 2px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '8.5px',
                  textTransform: 'uppercase',
                  borderRight: '1px solid #000000',
                  lineHeight: 1.15
                }}
                title="DOC. Nº"
              >
                DOC.<br />Nº
              </th>
              <th
                style={{
                  width: '42%',
                  padding: '4px 6px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '8.5px',
                  textTransform: 'uppercase',
                  borderRight: '1px solid #000000'
                }}
              >
                HISTÓRICO
              </th>
              <th
                style={{
                  width: '16%',
                  padding: '4px 4px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '8.5px',
                  textTransform: 'uppercase',
                  borderRight: '1px solid #000000'
                }}
                title="VENDAS REALIZADAS"
              >
                VENDAS
              </th>
              <th
                style={{
                  width: '16%',
                  padding: '4px 4px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '8.5px',
                  textTransform: 'uppercase',
                  borderRight: '1px solid #000000'
                }}
              >
                ENTRADAS
              </th>
              <th
                style={{
                  width: '16%',
                  padding: '4px 4px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '8.5px',
                  textTransform: 'uppercase'
                }}
              >
                SAÍDAS
              </th>
            </tr>
          </thead>
          <tbody>
            {allDisplayRows.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  height: '21px',
                  borderBottom: '1px solid #000000',
                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                }}
              >
                {/* DOC Nº */}
                <td
                  style={{
                    borderRight: '1px solid #000000',
                    padding: '0 4px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '9px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {row.docNo}
                </td>

                {/* HISTÓRICO */}
                <td
                  style={{
                    borderRight: '1px solid #000000',
                    padding: '0 6px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '9px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {row.historico}
                </td>

                {/* VENDAS */}
                <td
                  style={{
                    borderRight: '1px solid #000000',
                    padding: '0 6px',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '9.5px',
                    fontFamily: "'Courier New', Courier, monospace"
                  }}
                >
                  {row.venda}
                </td>

                {/* ENTRADAS */}
                <td
                  style={{
                    borderRight: '1px solid #000000',
                    padding: '0 6px',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '9.5px',
                    fontFamily: "'Courier New', Courier, monospace"
                  }}
                >
                  {row.entrada}
                </td>

                {/* SAÍDAS */}
                <td
                  style={{
                    padding: '0 6px',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '9.5px',
                    fontFamily: "'Courier New', Courier, monospace"
                  }}
                >
                  {row.saida}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ─── 3. RODAPÉ DE RESUMO / TOTAIS (IDÊNTICO À IMAGEM) ─── */}
        <div
          className="avoid-break"
          style={{
            display: 'flex',
            width: '100%',
            borderTop: '1.5px solid #000000'
          }}
        >
          {/* BLOCO ESQUERDO: DETALHES DO SALDO */}
          <div
            style={{
              flex: '0 0 45%',
              borderRight: '1.5px solid #000000',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Título do Bloco */}
            <div
              style={{
                backgroundColor: '#e5e7eb',
                textAlign: 'center',
                padding: '3px 0',
                fontSize: '8.5px',
                fontWeight: 900,
                textTransform: 'uppercase',
                borderBottom: '1px solid #000000',
                letterSpacing: '0.05em'
              }}
            >
              DETALHES DO SALDO
            </div>

            {/* Grid de Formas de Pagamento */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '8.5px',
                lineHeight: 1.1
              }}
            >
              <tbody>
                {/* Linha DINHEIRO */}
                <tr style={{ height: '18px', borderBottom: '1px solid #000000' }}>
                  <td style={{ width: '45%', padding: '0 6px', fontWeight: 900, textTransform: 'uppercase', borderRight: '1px solid #000000' }}>
                    DINHEIRO
                  </td>
                  <td style={{ width: '15%', borderRight: '1px solid #000000', textAlign: 'center', color: '#888' }} />
                  <td style={{ width: '40%', padding: '0 6px', textAlign: 'right', fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
                    {formatMovementMoney(totalDinheiroDetalhes, true)}
                  </td>
                </tr>

                {/* Linha CHEQUES / PIX */}
                <tr style={{ height: '18px', borderBottom: '1px solid #000000' }}>
                  <td style={{ padding: '0 6px', fontWeight: 900, textTransform: 'uppercase', borderRight: '1px solid #000000' }}>
                    PIX / CHEQUES
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', color: '#888' }} />
                  <td style={{ padding: '0 6px', textAlign: 'right', fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
                    {formatMovementMoney(totalChequesPixDetalhes, true)}
                  </td>
                </tr>

                {/* Linha CARTÃO DÉBITO */}
                <tr style={{ height: '18px', borderBottom: '1px solid #000000' }}>
                  <td style={{ padding: '0 6px', fontWeight: 800, textTransform: 'uppercase', borderRight: '1px solid #000000' }}>
                    CARTÃO DÉBITO
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', color: '#888' }} />
                  <td style={{ padding: '0 6px', textAlign: 'right', fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
                    {formatMovementMoney(totalDebitoDetalhes, true)}
                  </td>
                </tr>

                {/* Linha CARTÃO CRÉDITO */}
                <tr style={{ height: '18px', borderBottom: '1px solid #000000' }}>
                  <td style={{ padding: '0 6px', fontWeight: 800, textTransform: 'uppercase', borderRight: '1px solid #000000' }}>
                    CARTÃO CRÉDITO
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', color: '#888' }} />
                  <td style={{ padding: '0 6px', textAlign: 'right', fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
                    {formatMovementMoney(totalCreditoDetalhes, true)}
                  </td>
                </tr>

                {/* Linha CARNÊ / BOLETO */}
                <tr style={{ height: '18px', borderBottom: '1px solid #000000' }}>
                  <td style={{ padding: '0 6px', fontWeight: 800, textTransform: 'uppercase', borderRight: '1px solid #000000' }}>
                    CARNÊ / BOLETO
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', color: '#888' }} />
                  <td style={{ padding: '0 6px', textAlign: 'right', fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
                    {formatMovementMoney(totalBoletoDetalhes, true)}
                  </td>
                </tr>

                {/* Linha TOTAL DOS DETALHES */}
                <tr style={{ height: '20px', backgroundColor: '#e5e7eb', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                  <td style={{ padding: '0 6px', textTransform: 'uppercase', borderRight: '1px solid #000000', fontSize: '9px' }}>
                    TOTAL
                  </td>
                  <td style={{ borderRight: '1px solid #000000' }} />
                  <td style={{ padding: '0 6px', textAlign: 'right', fontSize: '9.5px', fontFamily: "'Courier New', monospace" }}>
                    {formatMovementMoney(totalGeralDetalhes, true)}
                  </td>
                </tr>

                {/* Linha SOBRA (Idêntico ao formulário físico da foto) */}
                <tr style={{ height: '18px' }}>
                  <td style={{ padding: '0 6px', textTransform: 'uppercase', borderRight: '1px solid #000000', fontSize: '8px', fontWeight: 800, color: '#333333' }}>
                    {parseMovementNum(closingData.diferenca) < 0 ? 'FALTA' : 'SOBRA'}
                  </td>
                  <td style={{ borderRight: '1px solid #000000', textAlign: 'center', color: '#888' }} />
                  <td style={{ padding: '0 6px', textAlign: 'right', fontSize: '9px', fontFamily: "'Courier New', monospace", fontWeight: 800 }}>
                    {closingData.diferenca !== undefined && parseMovementNum(closingData.diferenca) !== 0
                      ? formatMovementMoney(Math.abs(parseMovementNum(closingData.diferenca)), true)
                      : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BLOCO DIREITO: TOTAL DO DIA / SALDO ANTERIOR / SALDO ATUAL */}
          <div
            style={{
              flex: '0 0 55%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '8.5px',
                lineHeight: 1.15
              }}
            >
              <tbody>
                {/* Linha A TRANSPORTAR / TOTAL DO DIA */}
                <tr style={{ height: '22px', borderBottom: '1px solid #000000', backgroundColor: '#f9fafb' }}>
                  <td
                    style={{
                      width: '37%',
                      padding: '0 6px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      borderRight: '1px solid #000000',
                      fontSize: '8px'
                    }}
                  >
                    A TRANSPORTAR<br />
                    <span style={{ fontSize: '7.5px', fontWeight: 700, color: '#444' }}>TOTAL DO DIA</span>
                  </td>
                  {/* Vendas */}
                  <td
                    style={{
                      width: '21%',
                      padding: '0 4px',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontFamily: "'Courier New', monospace",
                      borderRight: '1px solid #000000'
                    }}
                    title="Total de Vendas do Dia"
                  >
                    <div style={{ fontSize: '6.5px', fontWeight: 800, color: '#555', textTransform: 'uppercase', lineHeight: 1 }}>VENDAS</div>
                    {formatMovementMoney(totalVendasFinal, true)}
                  </td>
                  {/* Entradas */}
                  <td
                    style={{
                      width: '21%',
                      padding: '0 4px',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontFamily: "'Courier New', monospace",
                      borderRight: '1px solid #000000'
                    }}
                    title="Total de Entradas do Dia"
                  >
                    <div style={{ fontSize: '6.5px', fontWeight: 800, color: '#555', textTransform: 'uppercase', lineHeight: 1 }}>ENTRADAS</div>
                    {formatMovementMoney(totalEntradasFinal, true)}
                  </td>
                  {/* Saídas */}
                  <td
                    style={{
                      width: '21%',
                      padding: '0 4px',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontFamily: "'Courier New', monospace"
                    }}
                    title="Total de Saídas do Dia"
                  >
                    <div style={{ fontSize: '6.5px', fontWeight: 800, color: '#555', textTransform: 'uppercase', lineHeight: 1 }}>SAÍDAS</div>
                    {formatMovementMoney(totalSaidasFinal, true)}
                  </td>
                </tr>

                {/* Linha SALDO ANTERIOR */}
                <tr style={{ height: '20px', borderBottom: '1px solid #000000' }}>
                  <td
                    style={{
                      padding: '0 6px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      borderRight: '1px solid #000000'
                    }}
                  >
                    SALDO ANTERIOR
                  </td>
                  <td
                    colSpan={3}
                    style={{
                      padding: '0 6px',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontFamily: "'Courier New', monospace",
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {formatMovementMoney(saldoAnterior, true)}
                  </td>
                </tr>

                {/* Linha SALDO ATUAL */}
                <tr style={{ height: '22px', borderBottom: '1px solid #000000', backgroundColor: '#f3f4f6' }}>
                  <td
                    style={{
                      padding: '0 6px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      borderRight: '1px solid #000000',
                      fontSize: '9px'
                    }}
                  >
                    SALDO ATUAL (GAVETA)
                  </td>
                  <td
                    colSpan={3}
                    style={{
                      padding: '0 6px',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontSize: '10.5px',
                      fontFamily: "'Courier New', monospace"
                    }}
                  >
                    {formatMovementMoney(saldoAtual, true)}
                  </td>
                </tr>

                {/* Linha (DEMAIS PARA CONFERÊNCIA) */}
                <tr style={{ height: '20px', borderBottom: '1px solid #000000' }}>
                  <td
                    style={{
                      padding: '0 6px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      fontSize: '7.5px',
                      borderRight: '1px solid #000000',
                      color: '#333'
                    }}
                  >
                    (DEMAIS PARA CONFERÊNCIA)
                  </td>
                  <td
                    colSpan={3}
                    style={{
                      padding: '0 6px',
                      textAlign: 'right',
                      fontWeight: 800,
                      fontFamily: "'Courier New', monospace",
                      color: '#444'
                    }}
                  >
                    {formatMovementMoney(demaisConferencia, true)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 4. ASSINATURAS: CAIXA E VISTO ─── */}
        <div
          className="avoid-break"
          style={{
            display: 'flex',
            width: '100%',
            height: '48px',
            backgroundColor: '#ffffff'
          }}
        >
          {/* Caixa (Operador) */}
          <div
            style={{
              flex: '1 1 50%',
              borderRight: '1.5px solid #000000',
              padding: '4px 8px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
              CAIXA:
            </span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <div style={{ borderBottom: '1px solid #000000', width: '85%', marginBottom: '2px' }} />
              <span style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#222222' }}>
                {operator} &bull; Operador(a) do Caixa
              </span>
            </div>
          </div>

          {/* Visto (Gerência / Auditoria) */}
          <div
            style={{
              flex: '1 1 50%',
              padding: '4px 8px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}>
              VISTO:
            </span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <div style={{ borderBottom: '1px solid #000000', width: '85%', marginBottom: '2px' }} />
              <span style={{ fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#222222' }}>
                Gerência / Conferência Financeira
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return ReactDOM.createPortal(content, document.body);
  }
  return content;
};

export default PrintableCashMovementSheet;
