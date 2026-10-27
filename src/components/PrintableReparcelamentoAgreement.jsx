import React, { useMemo } from 'react';
import {
  parseAgreementCurrency,
  formatAgreementMoney,
  formatAgreementDateBr,
  formatAgreementLongDate
} from '../reparcelamentoUtils';

export {
  parseAgreementCurrency,
  formatAgreementMoney,
  formatAgreementDateBr,
  formatAgreementLongDate
};

/**
 * 📄 PrintableReparcelamentoAgreement
 * Termo Oficial de Renegociação, Confissão de Dívida e Reparcelamento (Folha Única A4)
 */
export const PrintableReparcelamentoAgreement = ({ agreementData }) => {
  if (!agreementData) return null;

  const {
    osNumero = 'AVULSO',
    clientName = 'Cliente',
    clientCpf = '',
    clientRg = '',
    clientPhone = '',
    clientAddress = '',
    responsible = null,
    unit = 'Central',
    dataAcordo = '',
    observacoes = '',
    operador = 'Yasmin Ótica',
    originalTotal = 0,
    oldRows = [],
    entradaValor = 0,
    entradaMeioPagamento = 'Dinheiro',
    descontoValor = 0,
    acrescimoValor = 0,
    novoSaldo = 0,
    schedule = [],
    agreementId = ''
  } = agreementData;

  const safeCity = unit && unit !== 'Central' ? unit : 'Cajati';
  const effectiveAgreementId = agreementId || `REP-${String(osNumero).replace(/^#/, '')}-${Date.now().toString().slice(-6)}`;
  const longDateStr = formatAgreementLongDate(dataAcordo, safeCity);

  const numOldRows = Array.isArray(oldRows) ? oldRows.length : 0;
  const numNewRows = Array.isArray(schedule) ? schedule.length : 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 7mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-reparcelamento-agreement {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 196mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #print-reparcelamento-agreement * {
            visibility: visible !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      <div
        id="print-reparcelamento-agreement"
        className="hidden print:block bg-white text-slate-900 font-sans text-[8.5px] leading-tight select-none p-1"
      >
        {/* ─── 1. CABEÇALHO INSTITUCIONAL ───────────────────────────────── */}
        <div className="border-b-2 border-slate-900 pb-1.5 mb-1.5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-yasmin.png"
              alt="Yasmin Ótica"
              className="h-8 max-w-[130px] object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo-yasmin-transparent.png';
              }}
            />
            <div className="border-l-2 border-slate-900 pl-2">
              <h1 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-none">
                YASMIN ÓTICA & ACESSÓRIOS
              </h1>
              <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-600 mt-0.5">
                Termo de Renegociação, Confissão de Dívida e Reparcelamento
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block bg-slate-950 text-white px-2.5 py-0.5 rounded font-black text-xs uppercase tracking-wide">
              OS Nº {String(osNumero).replace(/^#/, '')}
            </div>
            <p className="text-[7.5px] font-bold mt-0.5 text-slate-700">
              Protocolo: <strong className="text-slate-900">{effectiveAgreementId}</strong> | Unidade: {safeCity}
            </p>
            <p className="text-[7px] text-slate-500 font-medium">
              Data do Acordo: {formatAgreementDateBr(dataAcordo || new Date())}
            </p>
          </div>
        </div>

        {/* ─── 2. QUALIFICAÇÃO DAS PARTES ──────────────────────────────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5 bg-slate-50/70">
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8px] font-black uppercase tracking-wider text-slate-900">
              1. Qualificação das Partes Contratantes
            </h3>
            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">
              Credora & Devedor(a)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[8px]">
            {/* CREDORA */}
            <div className="border-r border-slate-200 pr-1.5">
              <p className="text-slate-800">
                <strong className="text-slate-950 uppercase">Credora:</strong> YASMIN ÓTICA LTDA
              </p>
              <p className="text-slate-700">
                <strong>Unidade / Loja:</strong> {safeCity}/SP &bull; <strong>Operador / Atendente:</strong> {operador || 'Atendimento'}
              </p>
            </div>

            {/* DEVEDOR(A) */}
            <div>
              <p className="text-slate-800 truncate">
                <strong className="text-slate-950 uppercase">Devedor(a):</strong> {clientName}
              </p>
              <p className="text-slate-700">
                <strong>CPF/CNPJ:</strong> {clientCpf || 'Não informado'}
                {clientRg && <> &bull; <strong>RG:</strong> {clientRg}</>}
                {clientPhone && <> &bull; <strong>Tel/WhatsApp:</strong> {clientPhone}</>}
              </p>
              {clientAddress && clientAddress !== 'Não informado' && (
                <p className="text-slate-600 truncate text-[7.5px]">
                  <strong>Endereço:</strong> {clientAddress}
                </p>
              )}
            </div>
          </div>

          {/* RESPONSÁVEL LEGAL (SE HOUVER) */}
          {responsible && responsible.name && (
            <div className="mt-1 pt-1 border-t border-slate-200 text-[7.5px] text-slate-700 flex items-center justify-between">
              <span>
                <strong className="text-slate-900 uppercase">Responsável Legal:</strong> {responsible.name}
              </span>
              {responsible.cpf && <span><strong>CPF:</strong> {responsible.cpf}</span>}
              {responsible.phone && <span><strong>Contato:</strong> {responsible.phone}</span>}
            </div>
          )}
        </div>

        {/* ─── 3. DEMONSTRATIVO FINANCEIRO DA RENEGOCIAÇÃO ─────────────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8px] font-black uppercase tracking-wider text-slate-900">
              2. Demonstrativo Financeiro do Acordo
            </h3>
            <span className="text-[7px] font-bold text-slate-500 uppercase">
              Origem & Repactuação
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 text-center">
            {/* SALDO ORIGINAL */}
            <div className="border border-slate-200 rounded p-1 bg-slate-50">
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-slate-500">
                Saldo Renegociado
              </span>
              <span className="text-[9.5px] font-black text-slate-950">
                R$ {formatAgreementMoney(originalTotal)}
              </span>
              <span className="block text-[6.5px] text-slate-500 font-medium">
                {numOldRows} parcela(s) antiga(s)
              </span>
            </div>

            {/* ENTRADA PAGA NO ATO */}
            <div className="border border-emerald-300 rounded p-1 bg-emerald-50/60">
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-emerald-800">
                Entrada no Ato
              </span>
              <span className="text-[9.5px] font-black text-emerald-900">
                R$ {formatAgreementMoney(entradaValor)}
              </span>
              <span className="block text-[6.5px] text-emerald-700 font-bold uppercase">
                {parseAgreementCurrency(entradaValor) > 0 ? entradaMeioPagamento || 'Dinheiro' : 'Sem Entrada'}
              </span>
            </div>

            {/* DESCONTO / ACRÉSCIMO */}
            <div className="border border-slate-200 rounded p-1 bg-slate-50">
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-slate-500">
                Desconto / Acréscimo
              </span>
              <span className="text-[9.5px] font-black text-slate-800">
                {parseAgreementCurrency(descontoValor) > 0 ? (
                  <span className="text-emerald-700">- R$ {formatAgreementMoney(descontoValor)}</span>
                ) : parseAgreementCurrency(acrescimoValor) > 0 ? (
                  <span className="text-amber-700">+ R$ {formatAgreementMoney(acrescimoValor)}</span>
                ) : (
                  <span>R$ 0,00</span>
                )}
              </span>
              <span className="block text-[6.5px] text-slate-500 font-medium">
                Ajuste negocial
              </span>
            </div>

            {/* NOVO SALDO PARCELADO */}
            <div className="border-2 border-indigo-500 rounded p-1 bg-indigo-50/60">
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-indigo-900">
                Novo Saldo a Pagar
              </span>
              <span className="text-[10px] font-black text-indigo-950">
                R$ {formatAgreementMoney(novoSaldo)}
              </span>
              <span className="block text-[6.5px] text-indigo-800 font-black uppercase">
                {numNewRows > 0 ? `${numNewRows}x no Boleto` : 'Quitado à Vista'}
              </span>
            </div>
          </div>

          {observacoes && (
            <p className="mt-1 text-[7.5px] text-slate-600 italic bg-slate-50 p-1 rounded border border-slate-200">
              <strong>Observações do Acordo:</strong> {observacoes}
            </p>
          )}
        </div>

        {/* ─── 4. PARCELAS ANTIGAS SUBSTITUÍDAS ────────────────────────── */}
        {numOldRows > 0 && (
          <div className="mb-1.5 border border-slate-200 rounded p-1 bg-slate-50/40">
            <div className="flex items-center justify-between pb-0.5 mb-0.5 border-b border-slate-200">
              <h3 className="text-[7.5px] font-black uppercase tracking-wider text-slate-700">
                3. Parcelas Anteriores Substituídas / Baixadas por este Termo
              </h3>
              <span className="text-[6.8px] text-slate-500 italic">
                (Títulos primitivos cancelados por novação contratual)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 text-[7px]">
              {oldRows.map((r, idx) => {
                const doc = r.DOCUMENTO || r.DESCRICAO || `Parcela antiga #${idx + 1}`;
                const venc = formatAgreementDateBr(r.DATA_VENCIMENTO || r['DATA VENCIMENTO'] || r.VENCIMENTO);
                const val = formatAgreementMoney(r.VALOR || r.valor || r['VALOR PARCELA'] || 0);
                return (
                  <div key={idx} className="border border-slate-200 bg-white rounded px-1.5 py-0.5 flex justify-between items-center">
                    <span className="font-bold text-slate-700 truncate max-w-[55%]">{doc}</span>
                    <span className="text-slate-500 font-mono text-[6.5px]">{venc}</span>
                    <span className="font-black text-slate-900">R$ {val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── 5. NOVO CRONOGRAMA DE VENCIMENTOS (BOLETO) ──────────────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8px] font-black uppercase tracking-wider text-slate-900">
              4. Novo Cronograma de Pagamento (Parcelamento no Boleto)
            </h3>
            <span className="text-[7px] font-bold text-indigo-700 uppercase">
              Vencimentos Obrigatórios
            </span>
          </div>

          {numNewRows > 0 ? (
            <table className="w-full text-left border-collapse text-[7.5px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 uppercase font-black text-[7px] border-b border-slate-300">
                  <th className="py-0.5 px-2 text-center w-[12%]">Parcela</th>
                  <th className="py-0.5 px-2 text-center w-[22%]">Data de Vencimento</th>
                  <th className="py-0.5 px-2 text-right w-[22%]">Valor da Parcela</th>
                  <th className="py-0.5 px-2 text-center w-[22%]">Forma de Pagamento</th>
                  <th className="py-0.5 px-2 text-center w-[22%]">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {schedule.map((item, idx) => {
                  const numStr = String(item.numero || idx + 1).padStart(2, '0');
                  const totStr = String(numNewRows).padStart(2, '0');
                  const venc = formatAgreementDateBr(item.vencimentoIso || item.vencimento);
                  const val = formatAgreementMoney(item.valorNum !== undefined ? item.valorNum : item.valor);
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                      <td className="py-0.5 px-2 text-center font-black text-slate-900 font-mono">
                        {numStr}/{totStr}
                      </td>
                      <td className="py-0.5 px-2 text-center font-black text-slate-950 font-mono">
                        {venc}
                      </td>
                      <td className="py-0.5 px-2 text-right font-black text-slate-900 font-mono">
                        R$ {val}
                      </td>
                      <td className="py-0.5 px-2 text-center font-bold text-slate-700 uppercase text-[7px]">
                        Boleto
                      </td>
                      <td className="py-0.5 px-2 text-center font-bold text-amber-700 uppercase text-[6.5px]">
                        A Vencer / Aguardando
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-1 text-emerald-800 font-black text-[8px] bg-emerald-50 rounded">
              Dívida renegociada e quitada integralmente à vista mediante entrada paga no ato do acordo.
            </div>
          )}
        </div>

        {/* ─── 6. CLÁUSULAS CONTRATUAIS DO ACORDO ──────────────────────── */}
        <div className="mb-2 border border-slate-300 rounded p-1.5 bg-slate-50/70 text-[7px] leading-tight space-y-1 text-slate-800">
          <h3 className="text-[7.5px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5 mb-0.5">
            5. Cláusulas e Condições Gerais do Acordo
          </h3>
          <p>
            <strong>CLÁUSULA 1ª (DO RECONHECIMENTO E CONFISSÃO DA DÍVIDA):</strong> O(A) DEVEDOR(A) qualificado(a) neste termo reconhece expressamente e confessa, de forma irrevogável e irretratável, a existência, certeza e liquidez do débito apurado decorrente do fornecimento de armações, lentes oftálmicas e produtos ópticos descritos na Ordem de Serviço (OS) indicada no cabeçalho.
          </p>
          <p>
            <strong>CLÁUSULA 2ª (DA NOVAÇÃO E QUITAÇÃO CONDICIONADA):</strong> As partes ajustam a repactuação do saldo devedor nas exatas condições e datas estipuladas no cronograma acima. A quitação plena, geral e irrevogável da dívida e da respectiva OS dar-se-á única e exclusivamente após a compensação e liquidação integral de todas as parcelas do acordo.
          </p>
          <p>
            <strong>CLÁUSULA 3ª (DO INADIMPLEMENTO E ENCARGOS):</strong> O não pagamento de qualquer parcela em sua respectiva data de vencimento ensejará o vencimento antecipado das parcelas vincendas, acrescido de multa moratória de 2% (dois por cento), juros de mora legais e correção monetária. Fica a CREDORA expressamente autorizada a promover a imediata inclusão dos dados do(a) DEVEDOR(A) nos serviços de proteção ao crédito (SPC e SERASA) e instaurar as medidas de cobrança judiciais e extrajudiciais cabíveis.
          </p>
          <p className="text-center font-black text-slate-900 pt-0.5">
            E por estarem justas, acertadas e contratadas, as partes firmam o presente instrumento em 2 (duas) vias de igual teor e forma.
          </p>
        </div>

        {/* ─── 7. DATA POR EXTENSO E ASSINATURAS ───────────────────────── */}
        <div className="avoid-break pt-1 text-center">
          <p className="text-[8px] font-black text-slate-900 mb-4">
            {longDateStr}
          </p>

          <div className="flex justify-around items-end px-4 gap-4 text-center">
            {/* ASSINATURA CLIENTE / DEVEDOR */}
            <div className="w-[38%]">
              <div className="border-t-2 border-slate-900 pt-1 uppercase text-[8px] font-black text-slate-900">
                Assinatura do(a) Devedor(a)
              </div>
              <p className="text-[7.5px] font-bold text-slate-700 truncate mt-0.5">{clientName}</p>
              <p className="text-[6.5px] text-slate-500 font-mono">CPF: {clientCpf || 'Não informado'}</p>
            </div>

            {/* SE HOUVER RESPONSÁVEL LEGAL */}
            {responsible && responsible.name && (
              <div className="w-[32%]">
                <div className="border-t-2 border-slate-900 pt-1 uppercase text-[8px] font-black text-slate-900">
                  Assinatura do Responsável
                </div>
                <p className="text-[7.5px] font-bold text-slate-700 truncate mt-0.5">{responsible.name}</p>
                <p className="text-[6.5px] text-slate-500 font-mono">CPF: {responsible.cpf || 'Não informado'}</p>
              </div>
            )}

            {/* ASSINATURA CREDORA / YASMIN ÓTICA */}
            <div className="w-[38%]">
              <div className="border-t-2 border-slate-900 pt-1 uppercase text-[8px] font-black text-slate-900">
                Yasmin Ótica &bull; Visto da Loja
              </div>
              <p className="text-[7.5px] font-bold text-slate-700 mt-0.5">Atendimento: {operador || 'Loja'}</p>
              <p className="text-[6.5px] text-slate-500">Unidade: {safeCity}</p>
            </div>
          </div>
        </div>

        {/* ─── 8. CONTROLE DE VIAS E RODAPÉ INSTITUCIONAL ──────────────── */}
        <div className="mt-2.5 pt-1 border-t border-slate-200 flex justify-between items-center text-[6.8px] text-slate-500">
          <div className="font-bold text-slate-700">
            ( &nbsp; ) 1ª Via - Ótica (Arquivo) &nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp; ( &nbsp; ) 2ª Via - Cliente
          </div>
          <div className="italic text-slate-400">
            "Sonda-me, ó Deus, e conhece o meu coração; prova-me, e conhece os meus pensamentos..." — Salmos 139:23-24
          </div>
        </div>
      </div>
    </>
  );
};

export default PrintableReparcelamentoAgreement;
