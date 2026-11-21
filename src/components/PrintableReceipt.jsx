import React from 'react';

const cleanVal = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let str = String(v).replace(/R\$\s?/g, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
      str = parts.join('');
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const fmtMoeda = (v) => `R$ ${Number(cleanVal(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PrintableReceipt = ({ saleData, clientData }) => {
  if (!saleData) return null;
  const safeClient = clientData || saleData.clientData || {};

  const cleanBoletoText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/(^|[^\p{L}])Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Boleto\s+da\s+Loja(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Carn[eê]s?(?!\p{L})/gui, '$1Boleto');
  };

  const totalVendaNum = cleanVal(
    saleData.valorTotal ||
    saleData['VALOR TOTAL'] ||
    saleData['VALOR DA VENDA'] ||
    saleData['VALOR_TOTAL'] ||
    saleData.valor ||
    saleData['VALOR'] ||
    saleData.subtotal ||
    0
  );

  const subtotalNum = cleanVal(
    saleData.subtotal ||
    saleData['SUBTOTAL'] ||
    (totalVendaNum + cleanVal(saleData.descontoVoucher || saleData['DESCONTO_VOUCHER'] || 0) + cleanVal(saleData.desconto || saleData['DESCONTO'] || 0)) ||
    totalVendaNum
  );

  const valorEntradaNum = cleanVal(
    saleData.valorEntrada ||
    saleData['VALOR ENTRADA'] ||
    saleData['SINAL'] ||
    saleData.sinal ||
    0
  );

  const rawRestanteNum = cleanVal(
    saleData.restante ||
    saleData['RESTANTE'] ||
    saleData.saldoRestante ||
    0
  );

  const saldoRestanteNum = rawRestanteNum > 0
    ? rawRestanteNum
    : (valorEntradaNum > 0 && totalVendaNum > valorEntradaNum ? Math.max(0, totalVendaNum - valorEntradaNum) : 0);

  const trocoTotalNum = cleanVal(
    saleData.trocoTotal ||
    saleData['TROCO'] ||
    saleData['TROCO_TOTAL'] ||
    saleData.troco ||
    0
  );

  const receiptDateTimeStr = (() => {
    const raw = saleData.dataHora || saleData.timestamp || saleData.DATA_HORA || saleData['DATA  DA VENDA'] || saleData['DATA DA VENDA'] || saleData.DATA;
    if (!raw) {
      return `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (typeof raw === 'string' && raw.includes('/')) {
      if (raw.includes('às') || raw.includes(':')) return raw;
      const time = saleData.hora || saleData.HORA || '';
      return time ? `${raw} às ${time}` : raw;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return String(raw);
  })();

  const effectivePagamentosLista = (() => {
    if (Array.isArray(saleData.pagamentosLista) && saleData.pagamentosLista.length > 0) {
      return saleData.pagamentosLista;
    }
    if (typeof saleData.pagamentosLista === 'string' && saleData.pagamentosLista.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(saleData.pagamentosLista);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    if (typeof saleData.pagamentos_json === 'string' && saleData.pagamentos_json.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(saleData.pagamentos_json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    return [];
  })();

  const effectiveItens = (() => {
    let items = saleData.itens;
    if (typeof items === 'string' && items.trim().startsWith('[')) {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!Array.isArray(items) || items.length === 0) {
      const rawItens = saleData.ITENS_JSON || saleData['ITENS_JSON'] || saleData.itens_json || saleData.raw?.ITENS_JSON;
      if (typeof rawItens === 'string' && rawItens.trim().startsWith('[')) {
        try { items = JSON.parse(rawItens); } catch (_) { items = []; }
      } else if (Array.isArray(rawItens)) {
        items = rawItens;
      }
    }
    return Array.isArray(items) ? items : [];
  })();

  const effectiveParcelas = (() => {
    let p = saleData.parcelas;
    if (typeof p === 'string' && p.trim().startsWith('[')) {
      try { p = JSON.parse(p); } catch (_) { p = []; }
    }
    if (!Array.isArray(p) || p.length === 0) {
      const pJson = saleData.PARCELAS_JSON || saleData['PARCELAS_JSON'] || saleData.raw?.PARCELAS_JSON;
      if (typeof pJson === 'string' && pJson.trim().startsWith('[')) {
        try { p = JSON.parse(pJson); } catch (_) { p = []; }
      } else if (Array.isArray(pJson)) {
        p = pJson;
      }
    }
    return Array.isArray(p) ? p : [];
  })();

  const fallbackFormaPagamento = (
    saleData.formaPagamento ||
    saleData.FORMAS_PAGAMENTO ||
    saleData['FORMAS_PAGAMENTO'] ||
    saleData['FORMA_PAGTO'] ||
    saleData['FORMA DE PAGAMENTO'] ||
    saleData['FORMA'] ||
    saleData.meioPagamento ||
    saleData.MEIO_PAGAMENTO ||
    ''
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          #print-receipt-section,
          #print-receipt-section * {
            visibility: visible !important;
          }
          #print-receipt-section {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            z-index: 99999999 !important;
          }
        }
      `}} />
      <div id="print-receipt-section" className="hidden print:block p-4 sm:p-6 bg-white text-black max-w-sm mx-auto font-mono text-xs">
        <div className="w-[360px] max-w-full mx-auto text-left">
          {/* Cabeçalho */}
          <div className="text-center border-b border-black pb-4 mb-4">
            <img 
              src="/logo-yasmin.png" 
              alt="Yasmin Ótica" 
              className="h-12 mx-auto mb-2 object-contain filter contrast-125" 
              onError={(e) => {
                if (e.target.src.includes('logo-yasmin-transparent.png')) {
                  e.target.style.display = 'none';
                } else {
                  e.target.src = "/logo-yasmin-transparent.png";
                }
              }}
            />
            <h1 className="text-sm font-black uppercase tracking-wider">YASMIN ÓTICA</h1>
            <p className="text-[10px] text-gray-700 uppercase">Comprovante de Venda Não Fiscal</p>
            <p className="text-[10px] text-gray-600 mt-1">Data: {receiptDateTimeStr}</p>
            {(() => {
              const receiptOS = String(saleData.numeroOS || saleData['OS DA VENDA'] || saleData['OS'] || saleData['VENDA_OS'] || '').replace(/^#+/, '');
              return receiptOS ? <p className="text-xs font-bold mt-1">Ordem de Serviço: #{receiptOS}</p> : null;
            })()}
          </div>

          {/* Dados do Cliente */}
          {(() => {
            const clientName = safeClient['Nome Completo'] || safeClient['NOME'] || safeClient['Cliente'] || saleData['CLIENTE'] || saleData.clientName || 'Cliente não identificado';
            const clientCpf = safeClient['CPF / CNPJ'] || safeClient['CPF'] || saleData['CPF'] || saleData.clientCPF || '';
            const respName = String(
              safeClient['Responsável Nome'] ||
              safeClient['Responsável Legal'] ||
              safeClient['RESPONSAVEL_LEGAL'] ||
              safeClient['RESPONSAVEL_NOME'] ||
              safeClient['responsavelNome'] ||
              saleData['RESPONSAVEL_NOME'] ||
              saleData['RESPONSAVEL_LEGAL'] ||
              saleData['Responsável Nome'] ||
              saleData.responsavelNome ||
              ''
            ).trim();
            const respCpf = String(
              safeClient['Responsável CPF'] ||
              safeClient['RESPONSAVEL_CPF'] ||
              safeClient['responsavelCpf'] ||
              saleData['RESPONSAVEL_CPF'] ||
              saleData['Responsável CPF'] ||
              saleData.responsavelCpf ||
              ''
            ).trim();
            const pacName = String(
              saleData.pacienteNome ||
              saleData.PACIENTE ||
              saleData.NOME_BENEFICIARIO ||
              saleData.nomePessoa ||
              safeClient.pacienteNome ||
              safeClient.PACIENTE ||
              ''
            ).trim();
            const phone = safeClient['WhatsApp'] || safeClient['TELEFONE'] || saleData.TELEFONE || '';

            return (
              <div className="border-b border-black pb-3 mb-3 text-[11px] space-y-0.5">
                <p><strong>Cliente:</strong> {clientName}</p>
                {clientCpf && <p><strong>CPF do Cliente:</strong> {clientCpf}</p>}
                {pacName && pacName.toLowerCase() !== clientName.toLowerCase() && (
                  <p><strong>Paciente / Beneficiário:</strong> {pacName}</p>
                )}
                {respName && (
                  <p><strong>Responsável Legal:</strong> {respName}</p>
                )}
                {respCpf && (
                  <p><strong>CPF do Responsável:</strong> {respCpf}</p>
                )}
                {phone && (
                  <p><strong>WhatsApp:</strong> {phone}</p>
                )}
                {(saleData.cidade || saleData.CIDADE) && (
                  <p><strong>Unidade / Loja:</strong> {saleData.cidade || saleData.CIDADE}</p>
                )}
                {(saleData.vendedor || saleData.VENDEDOR) && (
                  <p><strong>Atendente:</strong> {saleData.vendedor || saleData.VENDEDOR}</p>
                )}
              </div>
            );
          })()}

          {/* Itens Comprados */}
          <div className="border-b border-black pb-3 mb-3">
            <p className="font-bold uppercase text-[11px] mb-2">Itens da Compra:</p>
            <div className="space-y-1.5 text-[11px]">
              {effectiveItens && effectiveItens.length > 0 ? (
                effectiveItens.map((item, idx) => {
                  const itemQtd = Number(item.qtd || item.quantidade || item.QTD || 1) || 1;
                  const itemPreco = cleanVal(item.preco || item.PRECO || item.valor || item.VALOR || item.preco_venda || item.PRECO_VENDA || 0);
                  const itemSubtotal = itemPreco > 0 ? itemPreco * itemQtd : 0;
                  const itemNome = item.nome || item.descricao || item.PRODUTO || item.DESCRICAO || 'Produto';

                  return (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <p className="font-bold">{itemQtd}x {itemNome}</p>
                        {item.detalhes && <p className="text-[10px] text-gray-600">{item.detalhes}</p>}
                        {(() => {
                          const extraSpecs = [
                            (item.referenciaSku && !String(item.detalhes || '').includes(String(item.referenciaSku))) ? `Ref: ${item.referenciaSku}` : '',
                            (item.cor && !String(item.detalhes || '').toLowerCase().includes(String(item.cor).toLowerCase())) ? `Cor: ${item.cor}` : '',
                            (item.material && !String(item.detalhes || '').toLowerCase().includes(String(item.material).toLowerCase())) ? `Material: ${item.material}` : '',
                            (item.tratamento && !String(item.detalhes || '').toLowerCase().includes(String(item.tratamento).toLowerCase())) ? `Trat: ${item.tratamento}` : ''
                          ].filter(Boolean).join(' | ');
                          return extraSpecs ? (
                            <p className="text-[9.5px] text-gray-600 italic">{extraSpecs}</p>
                          ) : null;
                        })()}
                      </div>
                      <p className="font-bold shrink-0">{fmtMoeda(itemSubtotal > 0 ? itemSubtotal : totalVendaNum)}</p>
                    </div>
                  );
                })
              ) : (
                <div className="flex justify-between items-center">
                  <span>{saleData.produto || saleData.PRODUTO || saleData['PRODUTO'] || saleData.descricao || saleData.DESCRICAO || saleData['DESCRICAO'] || 'Produtos / Serviços Óticos'}</span>
                  <span>{fmtMoeda(totalVendaNum)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Totais e Pagamento */}
          <div className="border-b border-black pb-3 mb-3 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{fmtMoeda(subtotalNum)}</span>
            </div>
            {(saleData.descontoVoucher > 0 || saleData['DESCONTO_VOUCHER'] > 0) && (
              <div className="flex justify-between text-gray-700">
                <span>Cupom {saleData.voucher?.CODIGO || saleData.voucher?.codigo || saleData.VOUCHER || saleData.voucher ? `(${saleData.voucher?.CODIGO || saleData.voucher?.codigo || saleData.VOUCHER || saleData.voucher})` : ''}:</span>
                <span>- {fmtMoeda(saleData.descontoVoucher || saleData['DESCONTO_VOUCHER'])}</span>
              </div>
            )}
            {(saleData.desconto > 0 || saleData['DESCONTO'] > 0) && (
              <div className="flex justify-between text-gray-700">
                <span>
                  Desconto Extra{saleData.descontoTipo === 'PORCENTAGEM' || saleData.TIPO_DESCONTO === 'PORCENTAGEM' ? ` (${saleData.descontoPercentual || saleData.DESCONTO_PERCENTUAL}%)` : ''}:
                </span>
                <span>- {fmtMoeda(saleData.desconto || saleData['DESCONTO'])}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm pt-1 border-t border-dashed border-gray-400">
              <span>TOTAL DA VENDA:</span>
              <span>{fmtMoeda(totalVendaNum)}</span>
            </div>

            {saldoRestanteNum > 0 ? (
              <>
                <div className="flex justify-between font-bold text-emerald-800 text-[11px]">
                  <span>VALOR PAGO (ENTRADA):</span>
                  <span>{fmtMoeda(valorEntradaNum)}</span>
                </div>
                <div className="flex justify-between font-black text-rose-700 text-[11px]">
                  <span>SALDO A PAGAR (BOLETO):</span>
                  <span>{fmtMoeda(saldoRestanteNum)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between font-black text-emerald-800 text-[11px]">
                <span>TOTAL PAGO:</span>
                <span>{fmtMoeda(totalVendaNum)}</span>
              </div>
            )}

            {/* Detalhamento dos Pagamentos Lançados */}
            <div className="pt-2 text-[10px] space-y-1">
              <p className="font-bold uppercase text-[10px]">Formas de Pagamento:</p>
              {effectivePagamentosLista.length > 0 ? (
                effectivePagamentosLista.map((p, idx) => {
                  const desc = p.texto || (p.metodo ? `${p.metodo.toUpperCase()}: ${fmtMoeda(p.valor)}` : String(p));
                  return (
                    <div key={idx} className="flex justify-between text-gray-800">
                      <span>• {cleanBoletoText(desc)}</span>
                    </div>
                  );
                })
              ) : (
                <p>{cleanBoletoText(fallbackFormaPagamento) || 'Não informado'}</p>
              )}

              {trocoTotalNum > 0 && (
                <div className="flex justify-between font-bold text-emerald-800 pt-1">
                  <span>Troco Devolvido:</span>
                  <span>{fmtMoeda(trocoTotalNum)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Parcelamento Boleto se houver */}
          {effectiveParcelas && effectiveParcelas.length > 0 && (
            <div className="border-b border-black pb-3 mb-3 text-[10px]">
              <div className="flex justify-between items-center mb-1 flex-wrap">
                <p className="font-bold uppercase">Parcelamento no Boleto:</p>
                {(saleData.boletoTitularTipo || saleData.BOLETO_TITULAR_TIPO) && (
                  <span className="font-bold text-[9px] uppercase">
                    Titular: {(saleData.boletoTitularTipo || saleData.BOLETO_TITULAR_TIPO) === 'responsavel'
                      ? `Responsável (${saleData.boletoPagadorNome || saleData.BOLETO_PAGADOR_NOME || 'Responsável'})`
                      : `Cliente (${saleData.boletoPagadorNome || saleData.BOLETO_PAGADOR_NOME || saleData.CLIENTE || 'Cliente'})`
                    }
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {effectiveParcelas.map((parc, idx) => (
                  <div key={idx} className="flex justify-between pr-2">
                    <span>{parc.numero}ª {parc.vencimento}:</span>
                    <span>{fmtMoeda(parc.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé / Termo de Garantia */}
          <div className="text-center text-[9px] text-gray-600 space-y-1 pt-2">
            <p>Apresente este comprovante para retirada e garantia de seus óculos.</p>
            <p className="font-bold">Obrigado pela preferência!</p>
            <p className="text-[8px] mt-2 text-gray-400">YASMIN ÓTICA - SISTEMA INTEGRADO</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrintableReceipt;
