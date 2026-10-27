import React from 'react';

export const parseReportNum = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let str = String(val).replace(/R\$\s?/gi, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].replace(/^-/, '').length >= 1) {
      str = parts.join('');
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatReportMoney = (val) => {
  const num = parseReportNum(val);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const cleanReportBoletoText = (val) => {
  if (!val) return '';
  return String(val)
    .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
    .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
};

export const parseMovementDateObj = (m) => {
  if (!m || typeof m !== 'object') return null;
  const raw = m.dataHora || m.timestamp || m.DATA_HORA || m['DATA  DA VENDA'] || m['DATA DA VENDA'] || m.DATA || m.data || '';
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  if (s.includes('/')) {
    const [datePart, timePart] = s.split(/\s+/);
    const parts = (datePart || '').split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (timePart && timePart.includes(':')) {
        const [hh, mm, ss] = timePart.split(':');
        d.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, parseInt(ss, 10) || 0);
      }
      return isNaN(d.getTime()) ? null : d;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split('-').map(Number);
    return new Date(y, mo - 1, da, 12, 0, 0);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const formatMovementDateTime = (m) => {
  if (!m || typeof m !== 'object') return '---';
  const rawTime = String(m.hora || m.HORA || '').trim();
  const parsed = parseMovementDateObj(m);
  if (parsed) {
    const dStr = parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const rawStr = String(m.dataHora || m.timestamp || m.DATA_HORA || m.DATA || m.data || '');
    if (rawTime) return `${dStr} ${rawTime}`;
    if (rawStr.includes(':') || typeof m.timestamp === 'number') {
      const tStr = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `${dStr} ${tStr}`;
    }
    return dStr;
  }
  if (rawTime) return rawTime;
  const fallback = String(m.dataHora || m.DATA || m.data || '').trim();
  return fallback || '---';
};

export const buildCashClosingReportSummary = (closingData = {}, movements = [], storeName = 'Central') => {
  const unit = cleanReportBoletoText(storeName || closingData.unidade || closingData.loja || closingData.cidade || 'Central');
  const operator = closingData.operador || closingData.vendedor || closingData.usuario || 'Operador de Caixa';

  // 1. Valores Realmente Recebidos
  const vendasDinheiro = parseReportNum(closingData.vendasDinheiro);
  const totalRecebimentosDinheiro = parseReportNum(closingData.totalRecebimentosDinheiro);
  const vendasPix = parseReportNum(closingData.vendasPix);
  const vendasDebito = parseReportNum(closingData.vendasDebito);
  const vendasCredito = parseReportNum(closingData.vendasCredito);
  const computedRecebidos = vendasDinheiro + totalRecebimentosDinheiro + vendasPix + vendasDebito + vendasCredito;
  const totalRecebidosCaixa = closingData.totalRecebidosCaixa !== undefined && parseReportNum(closingData.totalRecebidosCaixa) > 0
    ? parseReportNum(closingData.totalRecebidosCaixa)
    : computedRecebidos;

  // 2. Faturamento no Boleto (Recebível Futuro)
  const vendasBoletoTotal = parseReportNum(closingData.vendasBoletoTotal ?? closingData.vendasBoleto);
  const vendasBoletoQtd = closingData.vendasBoletoQtd !== undefined
    ? Number(closingData.vendasBoletoQtd) || 0
    : (vendasBoletoTotal > 0 ? 1 : 0);

  // 3. Gaveta Física
  const fundoInicial = parseReportNum(closingData.fundoInicial);
  const totalSuprimentos = parseReportNum(closingData.totalSuprimentos);
  const totalSangrias = parseReportNum(closingData.totalSangrias);
  const totalSaidas = parseReportNum(closingData.totalSaidas);
  const totalRetiradasGaveta = totalSangrias + totalSaidas;
  const computedEntradasEspecie = vendasDinheiro + totalRecebimentosDinheiro + totalSuprimentos;
  const totalEntradasEspecie = closingData.totalEntradasEspecie !== undefined && parseReportNum(closingData.totalEntradasEspecie) > 0
    ? parseReportNum(closingData.totalEntradasEspecie)
    : computedEntradasEspecie;

  const computedDinheiroEsperado = Math.max(0, fundoInicial + vendasDinheiro + totalRecebimentosDinheiro + totalSuprimentos - totalRetiradasGaveta);
  const dinheiroEsperado = closingData.dinheiroEsperado !== undefined
    ? parseReportNum(closingData.dinheiroEsperado)
    : computedDinheiroEsperado;

  const dinheiroContado = closingData.dinheiroContado !== undefined
    ? parseReportNum(closingData.dinheiroContado)
    : dinheiroEsperado;

  const diferenca = closingData.diferenca !== undefined
    ? parseReportNum(closingData.diferenca)
    : Number((dinheiroContado - dinheiroEsperado).toFixed(2));

  const totalFaturadoGeral = totalRecebidosCaixa + vendasBoletoTotal;

  // 4. Ordenar movimentações cronologicamente
  const safeMovements = Array.isArray(movements) ? movements.filter(Boolean) : [];
  const sortedMovements = [...safeMovements].sort((a, b) => {
    const da = parseMovementDateObj(a);
    const db = parseMovementDateObj(b);
    if (da && db) return da.getTime() - db.getTime();
    const ta = String(a.hora || a.HORA || a.dataHora || a.DATA || '');
    const tb = String(b.hora || b.HORA || b.dataHora || b.DATA || '');
    return ta.localeCompare(tb);
  });

  return {
    unit,
    operator,
    vendasDinheiro,
    totalRecebimentosDinheiro,
    vendasPix,
    vendasDebito,
    vendasCredito,
    totalRecebidosCaixa,
    vendasBoletoTotal,
    vendasBoletoQtd,
    fundoInicial,
    totalSuprimentos,
    totalSangrias,
    totalSaidas,
    totalRetiradasGaveta,
    totalEntradasEspecie,
    dinheiroEsperado,
    dinheiroContado,
    diferenca,
    totalFaturadoGeral,
    sortedMovements
  };
};

/**
 * 📄 PrintableCashClosingReport
 * Relatório Executivo Oficial de Fechamento de Caixa (Relatório Z) e Demonstrativo Analítico de Movimentações.
 * Diagramado com CSS autossuficiente e Portal direto no <body> para ocupar 100% da largura da folha A4 de ponta a ponta.
 */
export const PrintableCashClosingReport = ({
  closingData = {},
  movements = [],
  storeName = 'Central',
  periodLabel = '',
  reportTitle = 'RELATÓRIO DE FECHAMENTO DE CAIXA (RELATÓRIO Z)'
}) => {
  const nowStr = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const summary = buildCashClosingReportSummary(closingData, movements, storeName);
  const {
    unit,
    operator,
    vendasDinheiro,
    totalRecebimentosDinheiro,
    vendasPix,
    vendasDebito,
    vendasCredito,
    totalRecebidosCaixa,
    vendasBoletoTotal,
    vendasBoletoQtd,
    fundoInicial,
    totalSuprimentos,
    totalRetiradasGaveta,
    dinheiroEsperado,
    dinheiroContado,
    diferenca,
    totalFaturadoGeral,
    sortedMovements
  } = summary;

  const openTime = closingData.dataAbertura || closingData.dataHoraAbertura || periodLabel || 'Início do Turno';
  const closeTime = closingData.dataFechamento || closingData.dataHoraFechamento || closingData.dataHora || nowStr;
  const cleanTitle = cleanReportBoletoText(reportTitle || 'RELATÓRIO DE FECHAMENTO DE CAIXA (RELATÓRIO Z)');
  const authHash = `Z-${String(unit).slice(0, 3).toUpperCase()}-${String(sortedMovements.length).padStart(3, '0')}-${Math.round(totalRecebidosCaixa + vendasBoletoTotal)}`;

  // Totais analíticos da tabela de movimentações
  let sumTabelaEntradas = 0;
  let sumTabelaSaidas = 0;
  let sumTabelaBoletoPrazo = 0;

  const preparedRows = sortedMovements.map((m, idx) => {
    const dateTimeDisplay = formatMovementDateTime(m);
    const movUnit = cleanReportBoletoText(m.unidade || m.CIDADE || m.LOJA || m.loja || unit);
    const tipo = String(m.tipo || m.TIPO || 'MOVIMENTO').toUpperCase().trim();
    const isSaida = tipo === 'SANGRIA' || tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'DESPESA' || tipo === 'PAGAMENTO';
    const isFechamento = tipo === 'FECHAMENTO';

    const rawValor = parseReportNum(m.valor ?? m.VALOR ?? m['VALOR TOTAL'] ?? m['VALOR DA VENDA'] ?? 0);
    const restBoleto = parseReportNum(m.valorRestanteBoleto ?? m.RESTANTE ?? 0);
    const totalOS = parseReportNum(m.valorTotalOS ?? m['VALOR TOTAL'] ?? 0);

    const rawForma = cleanReportBoletoText(
      m.formaPagamento || m.forma || m.FORMA_PAGTO || m['FORMA DE PAGAMENTO'] || m.MEIO_PAGAMENTO || (tipo === 'ABERTURA' || tipo === 'SANGRIA' || tipo === 'SUPRIMENTO' ? 'DINHEIRO' : '---')
    );

    const isPureBoletoSale = tipo === 'VENDA' && rawValor === 0 && (restBoleto > 0 || /boleto/i.test(rawForma));
    const displayValor = isPureBoletoSale ? (restBoleto || totalOS) : rawValor;

    if (isSaida) {
      sumTabelaSaidas += displayValor;
    } else if (isPureBoletoSale) {
      sumTabelaBoletoPrazo += displayValor;
    } else if (!isFechamento) {
      sumTabelaEntradas += displayValor;
      if (restBoleto > 0) {
        sumTabelaBoletoPrazo += restBoleto;
      }
    }

    const docRaw = m.osNumero || m.os || m['OS DA VENDA'] || m['Nº DA OS'] || m.OS || '';
    const docDisplay = docRaw
      ? `OS #${String(docRaw).replace(/^#|^os[-_ ]?/i, '').trim()}`
      : (m.id && !String(m.id).startsWith('fc_') && !String(m.id).startsWith('mov_') ? String(m.id).slice(0, 12) : '---');

    const clienteRaw = cleanReportBoletoText(
      m.cliente || m.CLIENTE || m.NOME || m.favorecido || m.motivo || m.MOTIVO || m.descricao || m.detalhes || '---'
    );
    const subDetalhe = cleanReportBoletoText(
      (m.cliente && m.motivo && m.motivo !== m.cliente) ? m.motivo : (m.detalhes || m.despesaCategoria || '')
    );

    const vendedorDisplay = m.vendedor || m.VENDEDOR || m.operador || m.OPERADOR || operator;

    return {
      idx: idx + 1,
      dateTimeDisplay,
      movUnit,
      tipo,
      isSaida,
      isFechamento,
      isPureBoletoSale,
      displayValor,
      restBoleto,
      totalOS,
      docDisplay,
      clienteRaw,
      subDetalhe,
      vendedorDisplay,
      rawForma
    };
  });

  const reportContent = (
    <div
      id="print-cash-closing-report"
      className="hidden print:block bg-white text-slate-900 font-sans select-none w-full max-w-full m-0 p-0"
      style={{
        width: '100%',
        minWidth: '100%',
        maxWidth: '100%',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: '10.5px',
        lineHeight: 1.35
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 4mm 4mm 4mm 4mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-cash-closing-report,
          #print-cash-closing-report * {
            visibility: visible !important;
          }
          #print-cash-closing-report {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #0f172a !important;
            z-index: 9999999 !important;
          }
          #print-cash-closing-report .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #print-cash-closing-report table {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          #print-cash-closing-report thead {
            display: table-header-group !important;
          }
          #print-cash-closing-report tfoot {
            display: table-footer-group !important;
          }
          #print-cash-closing-report tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      {/* ─── 1. CABEÇALHO EXECUTIVO DE PONTA A PONTA (100% LARGURA) ──────── */}
      <div
        className="avoid-break"
        style={{
          width: '100%',
          borderBottom: '2px solid #0f172a',
          paddingBottom: '5px',
          marginBottom: '5px'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '17px',
                flexShrink: 0,
                border: '1px solid #0f172a'
              }}
            >
              👓
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1
                  style={{
                    fontSize: '16px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#0f172a',
                    margin: 0,
                    lineHeight: 1.1
                  }}
                >
                  Ótica Yasmin
                </h1>
                <span
                  style={{
                    fontSize: '8.5px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor: '#e2e8f0',
                    color: '#1e293b',
                    padding: '1.5px 5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  Documento Oficial A4
                </span>
              </div>
              <p
                style={{
                  fontSize: '9.5px',
                  color: '#334155',
                  fontWeight: 700,
                  margin: '1px 0 0 0'
                }}
              >
                Sistema de Gestão ERP &amp; Frente de Caixa • Auditoria Financeira e Demonstrativo de Turno
              </p>
              <p
                style={{
                  fontSize: '8px',
                  color: '#64748b',
                  fontWeight: 600,
                  margin: '1px 0 0 0'
                }}
              >
                Unidades Integradas: Cajati • Registro • Jacupiranga • Venda Externa
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '5px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '2px'
              }}
            >
              Loja: {unit}
            </div>
            <p style={{ fontSize: '9px', color: '#334155', margin: '1px 0' }}>
              Emissão: <strong style={{ color: '#0f172a' }}>{nowStr}</strong>
            </p>
            <p style={{ fontSize: '8px', color: '#64748b', fontFamily: 'monospace', margin: 0 }}>
              Protocolo: <strong style={{ color: '#0f172a' }}>{authHash}</strong>
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: '5px',
            width: '100%',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '3.5px 8px',
            borderRadius: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2
            style={{
              fontSize: '10.5px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              margin: 0,
              color: '#ffffff'
            }}
          >
            {cleanTitle}
          </h2>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#cbd5e1'
            }}
          >
            {periodLabel ? `Período: ${periodLabel}` : `Unidade: ${unit}`}
          </span>
        </div>
      </div>

      {/* ─── 2. DADOS GERAIS DO TURNO (4 COLUNAS DE PONTA A PONTA) ──────── */}
      <table
        className="avoid-break"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '5px',
          border: '1px solid #94a3b8',
          backgroundColor: '#f8fafc'
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: '22%', padding: '4px 7px', borderRight: '1px solid #cbd5e1' }}>
              <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                Unidade / Filial Apurada
              </span>
              <strong style={{ fontSize: '10.5px', fontWeight: 900, color: '#0f172a' }}>{unit}</strong>
            </td>
            <td style={{ width: '26%', padding: '4px 7px', borderRight: '1px solid #cbd5e1' }}>
              <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                Operador(a) Responsável
              </span>
              <strong style={{ fontSize: '10.5px', fontWeight: 900, color: '#0f172a' }}>{operator}</strong>
            </td>
            <td style={{ width: '26%', padding: '4px 7px', borderRight: '1px solid #cbd5e1' }}>
              <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                Abertura / Período Inicial
              </span>
              <strong style={{ fontSize: '10px', fontWeight: 800, color: '#0f172a' }}>{openTime}</strong>
            </td>
            <td style={{ width: '26%', padding: '4px 7px' }}>
              <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                Data/Hora de Fechamento
              </span>
              <strong style={{ fontSize: '10px', fontWeight: 800, color: '#0f172a' }}>{closeTime}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ─── 3. FAIXA DE INDICADORES EXECUTIVOS (5 KPIS DE PONTA A PONTA) ─ */}
      <table
        className="avoid-break"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '5px',
          border: '1.5px solid #0f172a'
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: '19%', padding: '4px 6px', borderRight: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
              <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                Fundo Inicial (Abertura)
              </span>
              <strong style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                R$ {formatReportMoney(fundoInicial)}
              </strong>
            </td>
            <td style={{ width: '21%', padding: '4px 6px', borderRight: '1px solid #cbd5e1', backgroundColor: '#f0fdf4' }}>
              <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', color: '#166534' }}>
                Total Recebido em Caixa
              </span>
              <strong style={{ fontSize: '11px', fontWeight: 900, color: '#14532d', fontFamily: 'monospace' }}>
                R$ {formatReportMoney(totalRecebidosCaixa)}
              </strong>
            </td>
            <td style={{ width: '21%', padding: '4px 6px', borderRight: '1px solid #cbd5e1', backgroundColor: '#fffbeb' }}>
              <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', color: '#92400e' }}>
                Boleto a Prazo ({vendasBoletoQtd}x)
              </span>
              <strong style={{ fontSize: '11px', fontWeight: 900, color: '#78350f', fontFamily: 'monospace' }}>
                R$ {formatReportMoney(vendasBoletoTotal)}
              </strong>
            </td>
            <td style={{ width: '19%', padding: '4px 6px', borderRight: '1px solid #cbd5e1', backgroundColor: '#fff1f2' }}>
              <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', color: '#9f1239' }}>
                Sangrias &amp; Retiradas
              </span>
              <strong style={{ fontSize: '11px', fontWeight: 900, color: '#881337', fontFamily: 'monospace' }}>
                -R$ {formatReportMoney(totalRetiradasGaveta)}
              </strong>
            </td>
            <td style={{ width: '20%', padding: '4px 6px', backgroundColor: '#f1f5f9' }}>
              <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
                Saldo Físico na Gaveta
              </span>
              <strong style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                R$ {formatReportMoney(dinheiroEsperado)}
              </strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ─── 4. QUADROS FINANCEIROS LADO A LADO (100% LARGURA, 50% / 50%) ── */}
      <table
        className="avoid-break"
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0',
          marginBottom: '5px'
        }}
      >
        <tbody>
          <tr>
            {/* QUADRO 1: ENTRADAS REALMENTE RECEBIDAS */}
            <td
              style={{
                width: '49.2%',
                verticalAlign: 'top',
                border: '1.5px solid #0f172a',
                borderRadius: '5px',
                overflow: 'hidden',
                padding: 0
              }}
            >
              <div
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '9.5px',
                  padding: '4px 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>1. Entradas Realmente Recebidas</span>
                <span>Valor (R$)</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      💵 Dinheiro (Vendas à Vista / Entrada Espécie)
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', width: '34%' }}>
                      R$ {formatReportMoney(vendasDinheiro)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      🎟️ Boletos Recebidos em Espécie (Quitações)
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(totalRecebimentosDinheiro)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      ⚡ PIX (Transferências Instantâneas)
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(vendasPix)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      💳 Cartão de Débito
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(vendasDebito)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      💳 Cartão de Crédito (1x a 12x)
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(vendasCredito)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#e2e8f0', borderBottom: '1px solid #94a3b8' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', fontSize: '9.5px' }}>
                      (=) Total Recebido no Caixa:
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', fontSize: '10.5px' }}>
                      R$ {formatReportMoney(totalRecebidosCaixa)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '3.5px 8px', fontWeight: 800, color: '#334155', fontSize: '9px' }}>
                      (+) Total Faturado Geral (Caixa + Boleto):
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 900, color: '#334155', fontFamily: 'monospace', fontSize: '10px' }}>
                      R$ {formatReportMoney(totalFaturadoGeral)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* ESPAÇADOR CENTRAL */}
            <td style={{ width: '1.6%' }} />

            {/* QUADRO 2: CONFERÊNCIA DA GAVETA FÍSICA (ESPÉCIE) */}
            <td
              style={{
                width: '49.2%',
                verticalAlign: 'top',
                border: '1.5px solid #0f172a',
                borderRadius: '5px',
                overflow: 'hidden',
                padding: 0
              }}
            >
              <div
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '9.5px',
                  padding: '4px 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>2. Conferência da Gaveta Física</span>
                <span>Espécie (R$)</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      (+) Fundo Inicial de Abertura:
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', width: '36%' }}>
                      R$ {formatReportMoney(fundoInicial)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      (+) Vendas &amp; Boletos em Espécie:
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(vendasDinheiro + totalRecebimentosDinheiro)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3.5px 8px', color: '#1e293b', fontWeight: 600 }}>
                      (+) Suprimentos / Reforço de Troco:
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(totalSuprimentos)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff1f2' }}>
                    <td style={{ padding: '3.5px 8px', color: '#9f1239', fontWeight: 700 }}>
                      (-) Sangrias &amp; Retiradas em Espécie:
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 800, color: '#9f1239', fontFamily: 'monospace' }}>
                      -R$ {formatReportMoney(totalRetiradasGaveta)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                    <td style={{ padding: '3.5px 8px', fontWeight: 900, color: '#0f172a' }}>
                      (=) SALDO FÍSICO ESPERADO:
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(dinheiroEsperado)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #94a3b8' }}>
                    <td style={{ padding: '3.5px 8px', fontWeight: 900, color: '#0f172a' }}>
                      (=) DINHEIRO FÍSICO CONTADO:
                    </td>
                    <td style={{ padding: '3.5px 8px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                      R$ {formatReportMoney(dinheiroContado)}
                    </td>
                  </tr>
                  <tr
                    style={{
                      backgroundColor: diferenca === 0 ? '#dcfce7' : diferenca > 0 ? '#dbeafe' : '#ffe4e6'
                    }}
                  >
                    <td
                      style={{
                        padding: '4px 8px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        fontSize: '9px',
                        color: diferenca === 0 ? '#14532d' : diferenca > 0 ? '#1e3a8a' : '#881337'
                      }}
                    >
                      Diferença de Caixa:
                    </td>
                    <td
                      style={{
                        padding: '4px 8px',
                        textAlign: 'right',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        fontSize: '9.5px',
                        color: diferenca === 0 ? '#14532d' : diferenca > 0 ? '#1e3a8a' : '#881337'
                      }}
                    >
                      {diferenca === 0
                        ? 'R$ 0,00 (CAIXA EXATO)'
                        : `${diferenca > 0 ? 'SOBRA (+)' : 'FALTA (-)'} R$ ${formatReportMoney(Math.abs(diferenca))}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ─── 5. QUADRO 3: FATURAMENTO A PRAZO EM BOLETO (100% LARGURA) ──── */}
      <div
        className="avoid-break"
        style={{
          width: '100%',
          padding: '4.5px 8px',
          backgroundColor: '#fffbeb',
          border: '1.5px solid #d97706',
          borderRadius: '5px',
          marginBottom: '5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <span
            style={{
              fontWeight: 900,
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              fontSize: '9.5px',
              display: 'block'
            }}
          >
            3. Faturamento a Prazo em Boleto da Loja (Recebíveis Futuros)
          </span>
          <span style={{ fontSize: '8px', color: '#92400e', fontStyle: 'italic' }}>
            * Vendas parceladas no Boleto próprio da ótica. Não ingressam no saldo físico da gaveta hoje; são lançadas no Contas a Receber.
          </span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '10px' }}>
          <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 800, color: '#92400e' }}>
            {vendasBoletoQtd} venda(s) a prazo no Boleto
          </span>
          <strong style={{ fontSize: '11.5px', fontWeight: 900, color: '#78350f', fontFamily: 'monospace' }}>
            R$ {formatReportMoney(vendasBoletoTotal)}
          </strong>
        </div>
      </div>

      {/* ─── 6. QUADRO 4: RELAÇÃO ANALÍTICA DE MOVIMENTAÇÕES (PONTA A PONTA) ─ */}
      <div
        style={{
          width: '100%',
          border: '1.5px solid #0f172a',
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '8px'
        }}
      >
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '10px',
            padding: '5px 10px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <span>4. Demonstrativo Detalhado de Movimentações ({preparedRows.length} registros)</span>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1' }}>
            Unidade / Loja: {unit}
          </span>
        </div>

        {preparedRows.length === 0 ? (
          <div
            style={{
              padding: '14px',
              textAlign: 'center',
              color: '#64748b',
              fontStyle: 'italic',
              fontSize: '10px'
            }}
          >
            Nenhuma movimentação individual registrada neste período/turno.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              minWidth: '100%',
              maxWidth: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontSize: '9.5px'
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#e2e8f0',
                  borderBottom: '1.5px solid #0f172a',
                  color: '#0f172a',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  fontSize: '8.5px'
                }}
              >
                <th style={{ width: '4%', padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>#</th>
                <th style={{ width: '12%', padding: '5px 5px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Data / Hora</th>
                <th style={{ width: '9%', padding: '5px 5px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Loja</th>
                <th style={{ width: '11%', padding: '5px 5px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>Tipo</th>
                <th style={{ width: '9%', padding: '5px 5px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Doc / OS</th>
                <th style={{ width: '25%', padding: '5px 6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Cliente / Histórico / Detalhes</th>
                <th style={{ width: '9%', padding: '5px 5px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Operador</th>
                <th style={{ width: '10%', padding: '5px 5px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Forma Pagto</th>
                <th style={{ width: '11%', padding: '5px 6px', textAlign: 'right' }}>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {preparedRows.map((row) => {
                const bgRow = row.idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                let badgeBg = '#f1f5f9';
                let badgeColor = '#0f172a';
                let badgeBorder = '#cbd5e1';

                if (row.tipo === 'VENDA') {
                  badgeBg = '#e0f2fe';
                  badgeColor = '#075985';
                  badgeBorder = '#7dd3fc';
                } else if (row.tipo === 'RECEBIMENTO') {
                  badgeBg = '#dcfce7';
                  badgeColor = '#166534';
                  badgeBorder = '#86efac';
                } else if (row.tipo === 'SUPRIMENTO' || row.tipo === 'ABERTURA') {
                  badgeBg = '#ccfbf1';
                  badgeColor = '#115e59';
                  badgeBorder = '#5eead4';
                } else if (row.isSaida) {
                  badgeBg = '#ffe4e6';
                  badgeColor = '#9f1239';
                  badgeBorder = '#fda4af';
                } else if (row.isFechamento) {
                  badgeBg = '#fef3c7';
                  badgeColor = '#92400e';
                  badgeBorder = '#fcd34d';
                }

                return (
                  <tr
                    key={row.idx}
                    style={{
                      backgroundColor: bgRow,
                      borderBottom: '1px solid #e2e8f0'
                    }}
                  >
                    <td
                      style={{
                        padding: '4.5px 4px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontFamily: 'monospace',
                        fontSize: '8.5px',
                        borderRight: '1px solid #e2e8f0'
                      }}
                    >
                      {row.idx}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 5px',
                        color: '#334155',
                        fontFamily: 'monospace',
                        fontSize: '8.5px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {row.dateTimeDisplay}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 5px',
                        fontWeight: 700,
                        color: '#1e293b',
                        fontSize: '8.5px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {row.movUnit}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 4px',
                        textAlign: 'center',
                        borderRight: '1px solid #e2e8f0'
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1.5px 5px',
                          borderRadius: '4px',
                          fontSize: '8px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {row.tipo}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '4.5px 5px',
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        color: '#0f172a',
                        fontSize: '8.5px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {row.docDisplay}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 6px',
                        color: '#0f172a',
                        borderRight: '1px solid #e2e8f0',
                        wordBreak: 'break-word'
                      }}
                    >
                      <strong style={{ fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.2 }}>
                        {row.clienteRaw}
                      </strong>
                      {row.subDetalhe && row.subDetalhe !== row.clienteRaw && (
                        <span style={{ display: 'block', fontSize: '8px', color: '#475569', lineHeight: 1.2, marginTop: '1px' }}>
                          {row.subDetalhe}
                        </span>
                      )}
                      {row.restBoleto > 0 && !row.isPureBoletoSale && (
                        <span style={{ display: 'block', fontSize: '8px', color: '#92400e', fontWeight: 700, marginTop: '1px' }}>
                          + Saldo Boleto a Prazo: R$ {formatReportMoney(row.restBoleto)}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 5px',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '8.5px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {row.vendedorDisplay}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 5px',
                        color: '#1e293b',
                        fontWeight: 700,
                        fontSize: '8.5px',
                        borderRight: '1px solid #e2e8f0',
                        wordBreak: 'break-word'
                      }}
                    >
                      {row.rawForma}
                    </td>
                    <td
                      style={{
                        padding: '4.5px 6px',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontWeight: 900,
                        fontSize: '9.5px',
                        whiteSpace: 'nowrap',
                        color: row.isSaida ? '#9f1239' : row.isPureBoletoSale ? '#92400e' : '#0f172a'
                      }}
                    >
                      {row.isSaida ? '-' : ''}R$ {formatReportMoney(row.displayValor)}
                      {row.isPureBoletoSale && (
                        <span style={{ display: 'block', fontSize: '7.5px', fontWeight: 800, color: '#92400e' }}>
                          (A Prazo)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                style={{
                  backgroundColor: '#f1f5f9',
                  borderTop: '1.5px solid #0f172a',
                  fontWeight: 900,
                  fontSize: '9px',
                  color: '#0f172a'
                }}
              >
                <td colSpan={5} style={{ padding: '5px 8px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                  RESUMO DAS MOVIMENTAÇÕES LISTADAS ({preparedRows.length} lançamentos)
                </td>
                <td colSpan={2} style={{ padding: '5px 8px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#166534' }}>
                  Entradas Caixa: R$ {formatReportMoney(sumTabelaEntradas)}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#9f1239' }}>
                  Saídas: -R$ {formatReportMoney(sumTabelaSaidas)}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '9.5px', color: '#0f172a' }}>
                  Líq: R$ {formatReportMoney(sumTabelaEntradas - sumTabelaSaidas)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ─── 7. OBSERVAÇÕES DO FECHAMENTO (SE HOUVER) ───────────────────── */}
      {closingData.observacoes && (
        <div
          className="avoid-break"
          style={{
            width: '100%',
            padding: '6px 10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #94a3b8',
            borderRadius: '6px',
            marginBottom: '8px',
            fontSize: '9.5px'
          }}
        >
          <strong style={{ color: '#0f172a', textTransform: 'uppercase', fontSize: '8.5px', display: 'block' }}>
            Observações &amp; Notas de Auditoria do Caixa:
          </strong>
          <p style={{ color: '#334155', margin: '2px 0 0 0' }}>
            {cleanReportBoletoText(closingData.observacoes)}
          </p>
        </div>
      )}

      {/* ─── 8. TERMO DE RESPONSABILIDADE & ASSINATURAS (LARGURA TOTAL) ──── */}
      <div
        className="avoid-break"
        style={{
          width: '100%',
          paddingTop: '5px',
          marginTop: '4px',
          borderTop: '2px solid #0f172a'
        }}
      >
        <p
          style={{
            fontSize: '8px',
            color: '#475569',
            textAlign: 'center',
            fontStyle: 'italic',
            margin: '0 0 8px 0'
          }}
        >
          Declaro para os devidos fins de auditoria interna que os valores e movimentações discriminados neste relatório conferem com os comprovantes físicos e o numerário em espécie apurado na gaveta.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%', padding: '0 12px' }}>
                <div style={{ borderBottom: '1.5px solid #0f172a', width: '90%', margin: '0 auto 3px auto', height: '10px' }} />
                <strong style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>
                  {operator}
                </strong>
                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', fontWeight: 800, color: '#475569', letterSpacing: '0.05em' }}>
                  Operador(a) do Caixa • Assinatura
                </span>
              </td>
              <td style={{ width: '10%' }} />
              <td style={{ width: '45%', padding: '0 12px' }}>
                <div style={{ borderBottom: '1.5px solid #0f172a', width: '90%', margin: '0 auto 3px auto', height: '10px' }} />
                <strong style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: '#0f172a' }}>
                  Gerência / Supervisão Financeira
                </strong>
                <span style={{ fontSize: '7.5px', textTransform: 'uppercase', fontWeight: 800, color: '#475569', letterSpacing: '0.05em' }}>
                  Visto de Conferência &amp; Auditoria • {unit}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return reportContent;
};

export default PrintableCashClosingReport;
