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
  if (!saleData || !clientData) return null;

  const cleanBoletoText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto');
  };

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

  return (
    <div id="print-receipt-section" className="hidden print:block p-8 bg-white text-black max-w-sm mx-auto font-mono text-xs">
      
      {/* Cabeçalho */}
      <div className="text-center border-b border-black pb-4 mb-4">
        <img 
          src="/logo-yasmin.png" 
          alt="Yasmin Ótica" 
          className="h-12 mx-auto mb-2 object-contain filter contrast-125" 
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/logo-yasmin-transparent.png";
          }}
        />
        <h1 className="text-sm font-black uppercase tracking-wider">YASMIN ÓTICA</h1>
        <p className="text-[10px] text-gray-700 uppercase">Comprovante de Venda Não Fiscal</p>
        <p className="text-[10px] text-gray-600 mt-1">Data: {receiptDateTimeStr}</p>
        {saleData.numeroOS && (
          <p className="text-xs font-bold mt-1">Ordem de Serviço: #{saleData.numeroOS}</p>
        )}
      </div>

      {/* Dados do Cliente */}
      <div className="border-b border-black pb-3 mb-3 text-[11px]">
        <p><strong>Cliente:</strong> {clientData['Nome Completo'] || clientData['NOME'] || 'Cliente não identificado'}</p>
        {(clientData['CPF / CNPJ'] || clientData['CPF']) && (
          <p><strong>CPF:</strong> {clientData['CPF / CNPJ'] || clientData['CPF']}</p>
        )}
        {clientData['WhatsApp'] && (
          <p><strong>WhatsApp:</strong> {clientData['WhatsApp']}</p>
        )}
        {saleData.cidade && (
          <p><strong>Unidade / Loja:</strong> {saleData.cidade}</p>
        )}
        {saleData.vendedor && (
          <p><strong>Atendente:</strong> {saleData.vendedor}</p>
        )}
      </div>

      {/* Itens Comprados */}
      <div className="border-b border-black pb-3 mb-3">
        <p className="font-bold uppercase text-[11px] mb-2">Itens da Compra:</p>
        <div className="space-y-1.5 text-[11px]">
          {saleData.itens && saleData.itens.length > 0 ? (
            saleData.itens.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <p className="font-bold">{item.qtd || 1}x {item.nome || item.descricao}</p>
                  {item.detalhes && <p className="text-[10px] text-gray-600">{item.detalhes}</p>}
                </div>
                <p className="font-bold shrink-0">{fmtMoeda((item.preco || 0) * (item.qtd || 1))}</p>
              </div>
            ))
          ) : (
            <div className="flex justify-between items-center">
              <span>{saleData.produto || saleData.descricao || 'Produtos / Serviços Óticos'}</span>
              <span>{fmtMoeda(saleData.valorTotal || saleData.valor)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Totais e Pagamento */}
      <div className="border-b border-black pb-3 mb-3 text-[11px] space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{fmtMoeda(saleData.subtotal || saleData.valorTotal || saleData.valor)}</span>
        </div>
        {saleData.descontoVoucher > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Cupom {saleData.voucher?.CODIGO || saleData.voucher?.codigo ? `(${saleData.voucher?.CODIGO || saleData.voucher?.codigo})` : ''}:</span>
            <span>- {fmtMoeda(saleData.descontoVoucher)}</span>
          </div>
        )}
        {saleData.desconto > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Desconto Extra:</span>
            <span>- {fmtMoeda(saleData.desconto)}</span>
          </div>
        )}
        <div className="flex justify-between font-black text-sm pt-1 border-t border-dashed border-gray-400">
          <span>TOTAL PAGO:</span>
          <span>{fmtMoeda(saleData.valorTotal || saleData.valor)}</span>
        </div>

        {/* Detalhamento dos Pagamentos Lançados */}
        <div className="pt-2 text-[10px] space-y-1">
          <p className="font-bold uppercase text-[10px]">Formas de Pagamento:</p>
          {saleData.pagamentosLista && saleData.pagamentosLista.length > 0 ? (
            saleData.pagamentosLista.map((p, idx) => (
              <div key={idx} className="flex justify-between text-gray-800">
                <span>• {cleanBoletoText(p.texto)}</span>
              </div>
            ))
          ) : (
            <p>{cleanBoletoText(saleData.formaPagamento) || 'Não informado'}</p>
          )}

          {saleData.trocoTotal > 0 && (
            <div className="flex justify-between font-bold text-emerald-800 pt-1">
              <span>Troco Devolvido:</span>
              <span>{fmtMoeda(saleData.trocoTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Parcelamento Boleto se houver */}
      {saleData.parcelas && saleData.parcelas.length > 0 && (
        <div className="border-b border-black pb-3 mb-3 text-[10px]">
          <p className="font-bold uppercase mb-1">Parcelamento no Boleto:</p>
          <div className="grid grid-cols-2 gap-1">
            {saleData.parcelas.map((parc, idx) => (
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
  );
};

export default PrintableReceipt;
