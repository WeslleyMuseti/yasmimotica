import React from 'react';
import {
  parseCurrencyValue as cleanVal,
  formatMoneyBr as formatMoney,
  numeroPorExtenso
} from '../reparcelamentoUtils';

export { numeroPorExtenso };

/**
 * Componente de Impressão Oficial de Recibo de Pagamento de Reparcelamento (Folha A4)
 * Layout corporativo de alta fidelidade visual, com via oficial do cliente e demonstrativo de saldo restante.
 */
const PrintableReparcelamentoReceipt = ({ receiptData }) => {
  if (!receiptData) return null;

  const {
    reciboNumero = `REC-${Date.now().toString().slice(-6)}`,
    dataPagamento = new Date().toLocaleDateString('pt-BR'),
    horaPagamento = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    unidade = 'Cajati',
    operador = 'Yasmin Ótica',
    clienteNome = 'Cliente',
    clienteCpf = '',
    clienteTelefone = '',
    clienteEndereco = '',
    osNumero = 'AVULSO',
    acordoId = '',
    tipoPagamento = 'Parcela do Acordo', // 'Entrada do Acordo' ou 'Parcela X de Y'
    numeroParcela = null,
    totalParcelas = null,
    vencimentoOriginal = '',
    valorPago = 0,
    meioPagamento = 'Dinheiro',
    totalAcordo = null,
    totalJaPago = null,
    saldoRestante = null,
    parcelasRestantes = null,
    observacoes = ''
  } = receiptData;

  const valorNum = cleanVal(valorPago);
  const valorExtenso = numeroPorExtenso(valorNum);

  return (
    <div
      id="printable-reparcelamento-receipt"
      className="hidden print:block bg-white text-slate-950 font-sans p-8 max-w-[210mm] mx-auto min-h-[297mm] text-xs leading-relaxed"
      style={{ boxSizing: 'border-box' }}
    >
      {/* ─── CABEÇALHO OFICIAL COM LOGO E DADOS DA EMPRESA ─── */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-5">
        <div className="flex items-center gap-4">
          <img
            src="/logo-yasmin.png"
            alt="Yasmin Ótica"
            className="h-16 w-auto object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/logo-yasmin-transparent.png";
            }}
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              YASMIN ÓTICA
            </h1>
            <p className="text-[11px] font-semibold text-slate-600">
              Comércio Varejista de Artigos de Óptica e Acessórios
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Unidade: {unidade} • Registro / Cajati / Jacupiranga - SP
            </p>
          </div>
        </div>

        <div className="text-right border-l-2 border-slate-300 pl-4">
          <div className="bg-slate-900 text-white px-3 py-1 rounded text-xs font-black uppercase tracking-wider">
            RECIBO DE PAGAMENTO
          </div>
          <p className="text-[11px] font-mono font-bold text-slate-800 mt-1">
            Nº {reciboNumero}
          </p>
          <p className="text-[10px] text-slate-500">
            Emitido em: {dataPagamento} às {horaPagamento}
          </p>
        </div>
      </div>

      {/* ─── BOX DE DESTAQUE DO VALOR PAGO ─── */}
      <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-4 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
            Valor Recebido Quitado
          </span>
          <span className="text-2xl font-black text-slate-950 font-mono tracking-tight">
            R$ {formatMoney(valorNum)}
          </span>
        </div>
        <div className="sm:text-right max-w-md">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
            Valor por Extenso
          </span>
          <span className="text-xs font-bold text-slate-800 capitalize italic">
            ({valorExtenso})
          </span>
        </div>
      </div>

      {/* ─── DADOS DO PAGADOR / CLIENTE ─── */}
      <div className="border border-slate-300 rounded-lg p-3.5 mb-5 bg-white">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
          Identificação do Pagador (Cliente)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="col-span-2">
            <span className="text-[10px] font-semibold text-slate-500 block">Nome do Cliente:</span>
            <span className="font-bold text-slate-900 uppercase">{clienteNome}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block">CPF / CNPJ:</span>
            <span className="font-mono font-bold text-slate-800">{clienteCpf || 'Não informado'}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block">Telefone / WhatsApp:</span>
            <span className="font-mono text-slate-800">{clienteTelefone || 'Não informado'}</span>
          </div>
          {clienteEndereco && (
            <div className="col-span-2 sm:col-span-4 mt-1 pt-1 border-t border-slate-100">
              <span className="text-[10px] font-semibold text-slate-500 block">Endereço Residencial:</span>
              <span className="text-slate-800">{clienteEndereco}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── DETALHES DO PAGAMENTO EFETUADO ─── */}
      <div className="border border-slate-300 rounded-lg p-3.5 mb-5 bg-white">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
          Especificação do Título / Parcela Quitada
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block">Ordem de Serviço (OS):</span>
            <span className="font-mono font-black text-slate-900">
              {osNumero ? (osNumero.startsWith('#') ? osNumero : `#${osNumero}`) : 'AVULSO'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block">Referência do Pagamento:</span>
            <span className="font-bold text-slate-900">
              {tipoPagamento}
              {numeroParcela && totalParcelas ? ` (${numeroParcela}/${totalParcelas})` : ''}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block">Forma de Pagamento:</span>
            <span className="font-bold text-slate-800 uppercase">{meioPagamento}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block">Data Efetiva da Baixa:</span>
            <span className="font-mono font-bold text-emerald-800">{dataPagamento}</span>
          </div>
          {vencimentoOriginal && (
            <div>
              <span className="text-[10px] font-semibold text-slate-500 block">Vencimento Original:</span>
              <span className="font-mono text-slate-700">{vencimentoOriginal}</span>
            </div>
          )}
          {acordoId && (
            <div>
              <span className="text-[10px] font-semibold text-slate-500 block">Código do Acordo:</span>
              <span className="font-mono text-slate-700">{acordoId}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── DEMONSTRATIVO DE EVOLUÇÃO DA DÍVIDA (SALDO RESTANTE) ─── */}
      {(saldoRestante !== null || totalAcordo !== null || parcelasRestantes !== null) && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 mb-5 bg-slate-50">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-2">
            Demonstrativo de Saldo Restante do Acordo
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {totalAcordo !== null && (
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-semibold">Valor Total Acordo:</span>
                <span className="font-mono font-bold text-slate-900">R$ {formatMoney(totalAcordo)}</span>
              </div>
            )}
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-[10px] text-slate-500 block font-semibold">Valor Pago Nesta Operação:</span>
              <span className="font-mono font-black text-emerald-700">R$ {formatMoney(valorNum)}</span>
            </div>
            {saldoRestante !== null && (
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-semibold">Saldo Restante a Quitar:</span>
                <span className="font-mono font-black text-rose-700">R$ {formatMoney(saldoRestante)}</span>
              </div>
            )}
            {parcelasRestantes !== null && (
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-semibold">Parcelas Restantes:</span>
                <span className="font-mono font-bold text-slate-900">
                  {parcelasRestantes > 0 ? `${parcelasRestantes} parcela(s)` : 'Acordo 100% Quitado!'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── DECLARAÇÃO DE QUITAÇÃO E OBSERVAÇÕES ─── */}
      <div className="text-[11px] text-slate-700 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <p className="leading-relaxed">
          Declaramos para os devidos fins de direito que recebemos do(a) Sr(a). <strong>{clienteNome}</strong> a importância supramencionada de <strong>R$ {formatMoney(valorNum)} ({valorExtenso})</strong>, dando-lhe plena, geral e irrevogável quitação do valor específico correspondente à referência acima identificada.
        </p>
        {observacoes && (
          <p className="mt-2 pt-2 border-t border-slate-200 text-[10px] italic text-slate-600">
            <strong>Observações:</strong> {observacoes}
          </p>
        )}
      </div>

      {/* ─── CAMPOS DE ASSINATURA ─── */}
      <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t border-slate-300 text-center">
        <div>
          <div className="border-b border-slate-950 pb-1 mb-1 mx-6"></div>
          <p className="text-xs font-bold text-slate-900 uppercase">YASMIN ÓTICA</p>
          <p className="text-[10px] text-slate-500">Operador: {operador} • Unidade {unidade}</p>
        </div>

        <div>
          <div className="border-b border-slate-950 pb-1 mb-1 mx-6"></div>
          <p className="text-xs font-bold text-slate-900 uppercase">{clienteNome}</p>
          <p className="text-[10px] text-slate-500">Assinatura do Cliente / Pagador</p>
        </div>
      </div>

      {/* ─── RODAPÉ DO DOCUMENTO ─── */}
      <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono">
        Yasmin Ótica • Sistema de Gestão Óptica e Financeira • Recibo {reciboNumero} • Documento Não Fiscal para Controle de Pagamento
      </div>
    </div>
  );
};

export default PrintableReparcelamentoReceipt;