import React, { useState, useMemo } from 'react';
import { 
  DollarSign, ArrowDownRight, ArrowUpRight, Lock, Unlock, 
  Printer, CheckCircle2, AlertTriangle, AlertCircle, X, ShieldAlert,
  Calendar, Clock, User, Building, FileText, Check, ChevronRight
} from 'lucide-react';

const formatCurrency = (val) => {
  const n = typeof val === 'number' ? val : parseCurrency(val);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrency = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).replace(/R\$\s?/g, '').trim();
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

const parseItemDate = (item) => {
  if (!item) return null;
  const raw = item.dataHora || item.timestamp || item.DATA || item['DATA  DA VENDA'] || item['DATA DA VENDA'] || item.data;
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
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof raw === 'number') {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// ─── COMPROVANTE IMPRESSO PROFISSIONAL COM LOGO YASMIN ÓTICA (1 PÁGINA PERFEITA) ───
export const PrintableCashVoucher = ({ type, data, unit, operator }) => {
  if (!data) return null;

  const nowFormatted = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const authCode = `AUT-${(data.id || Date.now()).toString().slice(-6).toUpperCase()}`;

  return (
    <div
      id="print-cash-voucher-section"
      className="hidden print:block w-full bg-white text-black font-sans text-xs leading-normal"
      style={{
        width: '100%',
        textAlign: 'center',
        margin: '0 auto',
        padding: '0',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      <div
        className="border-2 border-black p-5 rounded-2xl bg-white shadow-none text-black text-left"
        style={{
          width: '360px',
          maxWidth: '92%',
          margin: '0 auto',
          display: 'inline-block',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}
      >
        
        {/* Cabeçalho com Logo Oficial e Nome */}
        <div className="text-center border-b-2 border-black pb-3 mb-3">
          <div className="flex justify-center mb-1.5">
            <img 
              src="/logo-yasmin.png" 
              alt="Yasmin Ótica" 
              className="h-10 max-h-10 max-w-[150px] object-contain filter contrast-125"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/logo-yasmin-transparent.png";
              }}
            />
          </div>
          <h1 className="text-sm font-black uppercase tracking-wider text-black">YASMIN ÓTICA</h1>
          <p className="text-[10px] uppercase font-bold text-gray-700 tracking-wide">Controle de Frente de Caixa &amp; Tesouraria</p>
          <div className="flex items-center justify-center gap-2 text-[9px] text-gray-600 mt-1 font-semibold">
            <span>📍 Loja: <strong className="text-black">{unit || data.unidade || 'Cajati'}</strong></span>
            <span>•</span>
            <span>{nowFormatted}</span>
          </div>
        </div>

        {/* ─── 1. COMPROVANTE DE SANGRIA ─────────────────────────────── */}
        {type === 'SANGRIA' && (
          <div className="space-y-3">
            <div className="text-center font-black text-xs bg-black text-white py-1 rounded-lg uppercase tracking-wider">
              Comprovante de Sangria de Caixa
            </div>
            
            <div className="border border-black p-3 rounded-xl bg-gray-50/80 space-y-2 text-[11px]">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1.5">
                <span className="text-gray-600 font-bold uppercase text-[10px]">Valor Retirado:</span>
                <span className="text-base font-black text-black">R$ {formatCurrency(data.valor)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <p><strong>Operador:</strong> {operator || data.operador}</p>
                <p><strong>Loja:</strong> {unit || data.unidade}</p>
              </div>
              <p className="text-[10px]"><strong>Motivo:</strong> {data.motivo || 'Recolhimento para Cofre'}</p>
              {data.despesaCategoria && (
                <p className="text-[10px]"><strong>Categoria:</strong> {data.despesaCategoria}</p>
              )}
              {data.detalhes && (
                <p className="text-[10px]"><strong>Obs:</strong> {data.detalhes}</p>
              )}
              {data.saldoGavetaApos !== undefined && (
                <p className="text-[10px] pt-1 border-t border-gray-200"><strong>Saldo na Gaveta Após:</strong> R$ {formatCurrency(data.saldoGavetaApos)}</p>
              )}
            </div>

            <div className="pt-2 text-center text-[10px] space-y-4">
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">{operator || data.operador}</p>
                <p className="text-[9px] text-gray-600">Assinatura de Quem Retirou</p>
              </div>
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">Gerência / Supervisor</p>
                <p className="text-[9px] text-gray-600">Assinatura de Quem Recebeu</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── 2. COMPROVANTE DE SUPRIMENTO ───────────────────────────── */}
        {type === 'SUPRIMENTO' && (
          <div className="space-y-3">
            <div className="text-center font-black text-xs bg-black text-white py-1 rounded-lg uppercase tracking-wider">
              Entrada de Suprimento de Troco
            </div>
            
            <div className="border border-black p-3 rounded-xl bg-gray-50/80 space-y-2 text-[11px]">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1.5">
                <span className="text-gray-600 font-bold uppercase text-[10px]">Valor Inserido:</span>
                <span className="text-base font-black text-black">R$ {formatCurrency(data.valor)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <p><strong>Operador:</strong> {operator || data.operador}</p>
                <p><strong>Loja:</strong> {unit || data.unidade}</p>
              </div>
              <p className="text-[10px]"><strong>Origem / Motivo:</strong> {data.motivo || 'Fundo de Troco Adicional'}</p>
              {data.saldoGavetaApos !== undefined && (
                <p className="text-[10px] pt-1 border-t border-gray-200"><strong>Saldo da Gaveta Atualizado:</strong> R$ {formatCurrency(data.saldoGavetaApos)}</p>
              )}
            </div>

            <div className="pt-2 text-center text-[10px] space-y-4">
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">{operator || data.operador}</p>
                <p className="text-[9px] text-gray-600">Assinatura do Operador de Caixa</p>
              </div>
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">Gerência / Supervisor</p>
                <p className="text-[9px] text-gray-600">Visto de Conferência</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── 3. FECHAMENTO DE CAIXA (RELATÓRIO Z) ────────────────────── */}
        {type === 'FECHAMENTO' && (
          <div className="space-y-2.5">
            <div className="text-center font-black text-xs bg-black text-white py-1 rounded-lg uppercase tracking-wider">
              Relatório de Fechamento (Z)
            </div>
            
            <div className="space-y-1 text-[10px] text-left">
              <div className="grid grid-cols-2 gap-1 border-b border-gray-300 pb-1">
                <p><strong>Operador:</strong> {operator || data.operador}</p>
                <p><strong>Loja:</strong> {unit || data.unidade}</p>
                <p><strong>Início:</strong> {data.dataAbertura || '---'}</p>
                <p><strong>Fechamento:</strong> {data.dataFechamento || nowFormatted}</p>
              </div>
              
              {/* 1. Valores Realmente Recebidos em Caixa */}
              <div className="border-b border-black my-1 py-1 space-y-0.5">
                <p className="font-black text-[9px] uppercase tracking-wider text-gray-800">1. Realmente Recebido em Caixa:</p>
                <div className="flex justify-between"><span>💵 Dinheiro (Vendas Espécie):</span> <span>R$ {formatCurrency(data.vendasDinheiro)}</span></div>
                {(parseCurrency(data.totalRecebimentosDinheiro) > 0) && (
                  <div className="flex justify-between"><span>🎟️ Boleto em Dinheiro:</span> <span>R$ {formatCurrency(data.totalRecebimentosDinheiro)}</span></div>
                )}
                <div className="flex justify-between"><span>⚡ PIX (Transferência):</span> <span>R$ {formatCurrency(data.vendasPix)}</span></div>
                <div className="flex justify-between"><span>💳 Cartão de Débito:</span> <span>R$ {formatCurrency(data.vendasDebito)}</span></div>
                <div className="flex justify-between"><span>💳 Cartão de Crédito:</span> <span>R$ {formatCurrency(data.vendasCredito)}</span></div>
                <div className="flex justify-between font-black text-[10.5px] border-t border-gray-400 pt-0.5 mt-0.5">
                  <span>SUBTOTAL RECEBIDO:</span>
                  <span>R$ {formatCurrency(data.totalRecebidosCaixa || (parseCurrency(data.vendasDinheiro) + parseCurrency(data.totalRecebimentosDinheiro) + parseCurrency(data.vendasPix) + parseCurrency(data.vendasDebito) + parseCurrency(data.vendasCredito)))}</span>
                </div>
              </div>

              {/* 2. Valores Faturados a Prazo em Boleto (Recebível Futuro) */}
              <div className="border-b border-black my-1 py-1 space-y-0.5 bg-gray-50 p-1 rounded">
                <p className="font-black text-[9px] uppercase tracking-wider text-gray-800">2. A Prazo no Boleto (Recebível Futuro):</p>
                <div className="flex justify-between"><span>Quantidade de Vendas:</span> <span>{data.vendasBoletoQtd || (parseCurrency(data.vendasBoletoTotal || data.vendasBoleto) > 0 ? 1 : 0)} venda(s)</span></div>
                <div className="flex justify-between font-bold"><span>Total Faturado no Boleto:</span> <span>R$ {formatCurrency(data.vendasBoletoTotal || data.vendasBoleto)}</span></div>
                <p className="text-[8px] text-gray-600 italic mt-0.5">
                  * Recebível futuro em Contas a Receber. Não entra na gaveta física.
                </p>
              </div>

              {/* 3. Movimentações da Gaveta Física (Espécie) */}
              <div className="border-b border-black pb-1 mb-1 space-y-0.5">
                <p className="font-black text-[9px] uppercase tracking-wider text-gray-800">3. Conferência da Gaveta Física (Espécie):</p>
                <div className="flex justify-between"><span>(+) Fundo Inicial:</span> <span>R$ {formatCurrency(data.fundoInicial)}</span></div>
                <div className="flex justify-between"><span>(+) Entradas em Espécie:</span> <span>R$ {formatCurrency(data.totalEntradasEspecie || (parseCurrency(data.vendasDinheiro) + parseCurrency(data.totalRecebimentosDinheiro) + parseCurrency(data.totalSuprimentos)))}</span></div>
                <div className="flex justify-between"><span>(-) Sangrias / Despesas:</span> <span>-R$ {formatCurrency(data.totalSangrias)}</span></div>
                
                <div className="flex justify-between font-bold border-t border-gray-400 pt-0.5 mt-0.5">
                  <span>SALDO FÍSICO ESPERADO:</span>
                  <span>R$ {formatCurrency(data.dinheiroEsperado)}</span>
                </div>
                <div className="flex justify-between font-black">
                  <span>DINHEIRO CONTADO:</span>
                  <span>R$ {formatCurrency(data.dinheiroContado)}</span>
                </div>
                
                <div className={`flex justify-between font-black text-[11px] border-t-2 border-black pt-0.5 mt-0.5 ${
                  data.diferenca === 0 ? '' : data.diferenca > 0 ? 'text-blue-800' : 'text-red-800'
                }`}>
                  <span>DIFERENÇA:</span>
                  <span>
                    {data.diferenca === 0 ? 'R$ 0,00 (EXATO)' : `${data.diferenca > 0 ? 'SOBRA (+)' : 'FALTA (-)'} R$ ${formatCurrency(Math.abs(data.diferenca))}`}
                  </span>
                </div>
              </div>

              {data.observacoes && (
                <p className="text-[9px]"><strong>Obs:</strong> {data.observacoes}</p>
              )}
            </div>

            <div className="pt-2 text-center text-[10px] space-y-4">
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">{operator || data.operador}</p>
                <p className="text-[9px] text-gray-600">Assinatura do Operador</p>
              </div>
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">Gerência / Supervisão</p>
                <p className="text-[9px] text-gray-600">Visto de Conferência</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4. EXTRATO PARCIAL DO TURNO ────────────────────────────── */}
        {type === 'EXTRATO_PARCIAL' && (
          <div className="space-y-2.5">
            <div className="text-center font-black text-xs bg-black text-white py-1 rounded-lg uppercase tracking-wider">
              Extrato Parcial do Turno
            </div>
            
            <div className="space-y-1 text-[10px] text-left">
              <div className="grid grid-cols-2 gap-1 border-b border-gray-300 pb-1">
                <p><strong>Operador:</strong> {operator || data.operador}</p>
                <p><strong>Loja:</strong> {unit || data.unidade}</p>
                <p className="col-span-2"><strong>Início:</strong> {data.dataAbertura || '---'}</p>
              </div>
              
              {/* 1. Valores Realmente Recebidos em Caixa */}
              <div className="border-b border-black my-1 py-1 space-y-0.5">
                <p className="font-black text-[9px] uppercase tracking-wider text-gray-800">1. Realmente Recebido em Caixa:</p>
                <div className="flex justify-between"><span>💵 Dinheiro (Espécie):</span> <span>R$ {formatCurrency(data.vendasDinheiro)}</span></div>
                {(parseCurrency(data.totalRecebimentosDinheiro) > 0) && (
                  <div className="flex justify-between"><span>🎟️ Boleto em Dinheiro:</span> <span>R$ {formatCurrency(data.totalRecebimentosDinheiro)}</span></div>
                )}
                <div className="flex justify-between"><span>⚡ PIX (Transferência):</span> <span>R$ {formatCurrency(data.vendasPix)}</span></div>
                <div className="flex justify-between"><span>💳 Cartão de Débito:</span> <span>R$ {formatCurrency(data.vendasDebito)}</span></div>
                <div className="flex justify-between"><span>💳 Cartão de Crédito:</span> <span>R$ {formatCurrency(data.vendasCredito)}</span></div>
                <div className="flex justify-between font-black text-[10.5px] border-t border-gray-400 pt-0.5 mt-0.5">
                  <span>SUBTOTAL RECEBIDO:</span>
                  <span>R$ {formatCurrency(data.totalRecebidosCaixa || (parseCurrency(data.vendasDinheiro) + parseCurrency(data.totalRecebimentosDinheiro) + parseCurrency(data.vendasPix) + parseCurrency(data.vendasDebito) + parseCurrency(data.vendasCredito)))}</span>
                </div>
              </div>

              {/* 2. Valores Faturados a Prazo em Boleto (Recebível Futuro) */}
              <div className="border-b border-black my-1 py-1 space-y-0.5 bg-gray-50 p-1 rounded">
                <p className="font-black text-[9px] uppercase tracking-wider text-gray-800">2. A Prazo no Boleto (Recebível Futuro):</p>
                <div className="flex justify-between"><span>Quantidade de Vendas:</span> <span>{data.vendasBoletoQtd || (parseCurrency(data.vendasBoletoTotal || data.vendasBoleto) > 0 ? 1 : 0)} venda(s)</span></div>
                <div className="flex justify-between font-bold"><span>Total Faturado no Boleto:</span> <span>R$ {formatCurrency(data.vendasBoletoTotal || data.vendasBoleto)}</span></div>
                <p className="text-[8px] text-gray-600 italic mt-0.5">
                  * Recebível futuro em Contas a Receber. Não entra na gaveta física.
                </p>
              </div>

              {/* 3. Conferência da Gaveta Física (Espécie) */}
              <div className="border-b border-black pb-1 mb-1 space-y-0.5">
                <p className="font-black text-[9px] uppercase tracking-wider text-gray-800">3. Conferência da Gaveta Física (Espécie):</p>
                <div className="flex justify-between"><span>(+) Fundo Inicial:</span> <span>R$ {formatCurrency(data.fundoInicial)}</span></div>
                <div className="flex justify-between"><span>(+) Entradas em Espécie:</span> <span>R$ {formatCurrency(data.totalEntradasEspecie || (parseCurrency(data.vendasDinheiro) + parseCurrency(data.totalRecebimentosDinheiro) + parseCurrency(data.totalSuprimentos)))}</span></div>
                <div className="flex justify-between"><span>(-) Sangrias / Despesas:</span> <span>-R$ {formatCurrency(data.totalSangrias)}</span></div>
                <div className="flex justify-between font-black text-[11px] border-t border-gray-400 pt-0.5 mt-0.5">
                  <span>GAVETA ATUAL:</span>
                  <span>R$ {formatCurrency(data.dinheiroEsperado)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 5. COMPROVANTE DE ABERTURA DE CAIXA ────────────────────── */}
        {type === 'ABERTURA' && (
          <div className="space-y-3">
            <div className="text-center font-black text-xs bg-black text-white py-1 rounded-lg uppercase tracking-wider">
              Comprovante de Abertura de Caixa
            </div>
            
            <div className="border border-black p-3 rounded-xl bg-gray-50/80 space-y-2 text-[11px]">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1.5">
                <span className="text-gray-600 font-bold uppercase text-[10px]">Fundo de Troco Inicial:</span>
                <span className="text-base font-black text-black">R$ {formatCurrency(data.valor || data.fundoInicial)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <p><strong>Operador:</strong> {operator || data.operador}</p>
                <p><strong>Loja:</strong> {unit || data.unidade || 'Cajati'}</p>
              </div>
              <p className="text-[10px]"><strong>Data e Horário:</strong> {data.dataHora ? (typeof data.dataHora === 'string' && data.dataHora.includes('/') ? data.dataHora : new Date(data.dataHora).toLocaleString('pt-BR')) : nowFormatted}</p>
              {(data.detalhes || data.observacoes || data.motivo) && (
                <p className="text-[10px]"><strong>Observações:</strong> {data.detalhes || data.observacoes || data.motivo}</p>
              )}
            </div>

            <div className="pt-2 text-center text-[10px] space-y-4">
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">{operator || data.operador}</p>
                <p className="text-[9px] text-gray-600">Assinatura do Operador de Caixa</p>
              </div>
              <div>
                <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
                <p className="font-bold">Gerência / Supervisor</p>
                <p className="text-[9px] text-gray-600">Visto do Responsável</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── 6. COMPROVANTE DE REGISTRO DE VENDA PDV ───────────────── */}
        {type === 'VENDA' && (
          <div className="space-y-3">
            <div className="text-center font-black text-xs bg-black text-white py-1 rounded-lg uppercase tracking-wider">
              Comprovante de Lançamento (PDV)
            </div>
            
            <div className="border border-black p-3 rounded-xl bg-gray-50/80 space-y-2 text-[11px]">
              <div className="flex justify-between items-center border-b border-gray-300 pb-1.5">
                <span className="text-gray-600 font-bold uppercase text-[10px]">Valor da Venda:</span>
                <span className="text-base font-black text-black">R$ {formatCurrency(data.valor)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <p><strong>Forma:</strong> {data.formaPagamento || 'DINHEIRO'}</p>
                <p><strong>Loja:</strong> {unit || data.unidade}</p>
              </div>
              <p className="text-[10px]"><strong>Operador:</strong> {operator || data.operador}</p>
              <p className="text-[10px]"><strong>Data/Hora:</strong> {data.dataHora ? (typeof data.dataHora === 'string' && data.dataHora.includes('/') ? data.dataHora : new Date(data.dataHora).toLocaleString('pt-BR')) : nowFormatted}</p>
              {(data.detalhes || data.motivo) && (
                <p className="text-[10px]"><strong>Detalhes:</strong> {data.detalhes || data.motivo}</p>
              )}
            </div>

            <div className="pt-2 text-center text-[10px]">
              <div className="border-b border-black w-3/4 mx-auto mb-1"></div>
              <p className="font-bold">{operator || data.operador}</p>
              <p className="text-[9px] text-gray-600">Assinatura do Atendente</p>
            </div>
          </div>
        )}

        {/* Rodapé com Código de Autenticação */}
        <div className="mt-3 pt-2 border-t border-dashed border-gray-400 text-center text-[8px] text-gray-500 uppercase tracking-wider">
          {authCode} · Sistema Yasmin Ótica · Auditoria Interna
        </div>

      </div>
    </div>
  );
};

// ─── COMPONENTE PRINCIPAL DOS MODAIS DE CAIXA ─────────────────────────
const CashManagementModal = ({
  isOpen,
  modalType, // 'ABERTURA', 'SANGRIA', 'SUPRIMENTO', 'FECHAMENTO', 'EXTRATO'
  onClose,
  activeSession,
  selectedCity,
  currentUser,
  cashMovements = [],
  salesData = [],
  onOpenCash,
  onAddSangria,
  onAddSuprimento,
  onCloseCash,
  onTriggerPrint
}) => {
  if (!isOpen) return null;

  // Estados locais dos formulários
  const [fundoInicialInput, setFundoInicialInput] = useState('100,00');
  const [obsAberturaInput, setObsAberturaInput] = useState('');
  
  const [sangriaValorInput, setSangriaValorInput] = useState('');
  const [sangriaMotivoInput, setSangriaMotivoInput] = useState('Recolhimento para Cofre / Depósito');
  const [sangriaDespesaCategoria, setSangriaDespesaCategoria] = useState('');
  const [sangriaObsInput, setSangriaObsInput] = useState('');

  const [suprimentoValorInput, setSuprimentoValorInput] = useState('');
  const [suprimentoMotivoInput, setSuprimentoMotivoInput] = useState('Fundo de Troco Adicional (Moedas/Cédulas)');

  const [fechamentoContadoInput, setFechamentoContadoInput] = useState('');
  const [fechamentoObsInput, setFechamentoObsInput] = useState('');

  const [printData, setPrintData] = useState(null);

  // ─── CÁLCULOS DO TURNO ATUAL DA CIDADE SELECIONADA ─────────────────
  const sessionStats = useMemo(() => {
    if (!activeSession) {
      return {
        fundoInicial: 0,
        vendasDinheiro: 0,
        vendasPix: 0,
        vendasDebito: 0,
        vendasCredito: 0,
        vendasBoleto: 0,
        totalVendas: 0,
        totalSangrias: 0,
        totalSuprimentos: 0,
        dinheiroEsperado: 0,
        listaMovimentos: [],
        vendasDoTurno: []
      };
    }

    const sessionStart = new Date(activeSession.dataHoraAbertura || activeSession.timestamp || Date.now());
    const unit = selectedCity || activeSession.unidade || 'Central';

    // Movimentações deste turno
    const sessionMovements = cashMovements.filter(m => {
      if (m.unidade !== unit && unit !== 'ALL') return false;
      const mDate = new Date(m.dataHora || m.timestamp || 0);
      return mDate >= sessionStart;
    });

    // Vendas deste turno (com filtro de data >= início do turno)
    const sessionSales = salesData.filter(s => {
      const sUnit = s["UNIDADE"] || s["CIDADE"] || s["LOJA"] || "Central";
      if (sUnit !== unit && unit !== "ALL") return false;
      const sDate = parseItemDate(s);
      if (!sDate) return false;
      const rawStr = String(s.dataHora || s.timestamp || s.DATA_HORA || s.data || s.DATA || s['DATA  DA VENDA'] || s['DATA DA VENDA'] || '');
      const hasTime = rawStr.includes(':') || (typeof s.timestamp === 'number');
      if (hasTime) {
        if (sDate < sessionStart) return false;
      } else {
        const startOfDay = new Date(sessionStart.getFullYear(), sessionStart.getMonth(), sessionStart.getDate());
        if (sDate < startOfDay) return false;
      }
      return true;
    });

    // 1. Extração analítica de faturamento a prazo em Boleto a partir de sessionSales
    let vendasBoletoQtd = 0;
    let vendasBoletoTotal = 0;

    sessionSales.forEach(s => {
      let bVal = 0;
      let hasBoleto = false;

      // a) Lista estruturada de pagamentos da venda
      if (Array.isArray(s.pagamentosLista) && s.pagamentosLista.length > 0) {
        s.pagamentosLista.forEach(p => {
          const m = String(p.metodo || '').toLowerCase();
          if (m === 'boleto' || m === 'carne' || m === 'carnê') {
            hasBoleto = true;
            bVal += parseCurrency(p.valor);
          }
        });
      }

      // b) Parcelas estruturadas
      if (!hasBoleto && (s.PARCELAS_JSON || s.parcelas)) {
        try {
          const parcs = typeof s.PARCELAS_JSON === 'string' ? JSON.parse(s.PARCELAS_JSON) : (Array.isArray(s.PARCELAS_JSON) ? s.PARCELAS_JSON : (Array.isArray(s.parcelas) ? s.parcelas : []));
          if (Array.isArray(parcs) && parcs.length > 0) {
            hasBoleto = true;
            bVal = parcs.reduce((acc, p) => acc + parseCurrency(p.valor), 0);
          }
        } catch (e) {}
      }

      // c) Texto descritivo da forma de pagamento
      const fp = String(s['FORMA_PAGTO'] || s['FORMAS_PAGAMENTO'] || s.formaPagamento || '').toUpperCase();
      if (!hasBoleto && (fp.includes('BOLETO') || fp.includes('CARNE') || fp.includes('CARNÊ'))) {
        hasBoleto = true;
        const rest = parseCurrency(s['RESTANTE'] || s.restante);
        if (rest > 0) {
          bVal = rest;
        } else {
          bVal = parseCurrency(s['VALOR TOTAL'] || s['VALOR DA VENDA'] || s.valorTotal);
        }
      }

      if (hasBoleto && bVal > 0) {
        vendasBoletoQtd++;
        vendasBoletoTotal += bVal;
      }
    });

    let fundoInicial = activeSession.fundoInicial || 0;
    let totalSangrias = 0;
    let totalSuprimentos = 0;
    let totalRecebimentosDinheiro = 0;
    let totalSaidas = 0;
    let vendasDinheiro = 0;
    let vendasPix = 0;
    let vendasDebito = 0;
    let vendasCredito = 0;
    let vendasBoletoFromMov = 0;

    sessionMovements.forEach(m => {
      const v = parseCurrency(m.valor);
      const fp = String(m.formaPagamento || '').toUpperCase();
      const tipo = String(m.tipo || '').toUpperCase();
      if (tipo === 'SANGRIA') totalSangrias += v;
      else if (tipo === 'SUPRIMENTO') totalSuprimentos += v;
      else if (tipo === 'SAÍDA' || tipo === 'SAIDA' || tipo === 'PAGAMENTO') {
        totalSaidas += v;
      } else if (tipo === 'RECEBIMENTO') {
        if (fp.includes('DINHEIRO') || !fp) {
          totalRecebimentosDinheiro += v;
        }
      } else if (tipo === 'VENDA') {
        if (fp.includes('DINHEIRO')) vendasDinheiro += v;
        else if (fp.includes('PIX')) vendasPix += v;
        else if (fp.includes('DEBITO') || fp.includes('DÉBITO')) vendasDebito += v;
        else if (fp.includes('CREDITO') || fp.includes('CRÉDITO')) vendasCredito += v;
        else if (fp.includes('BOLETO') || fp.includes('CARNE') || fp.includes('CARNÊ')) vendasBoletoFromMov += v;
      }
    });

    const finalVendasBoleto = vendasBoletoTotal > 0 ? vendasBoletoTotal : vendasBoletoFromMov;
    const finalVendasBoletoQtd = vendasBoletoQtd > 0 ? vendasBoletoQtd : (finalVendasBoleto > 0 ? 1 : 0);

    // Valores realmente recebidos em caixa (dinheiro, boleto em dinheiro, pix, débito e crédito)
    const totalRecebidosCaixa = vendasDinheiro + totalRecebimentosDinheiro + vendasPix + vendasDebito + vendasCredito;

    // Conferência física da gaveta: Fundo Inicial + Entradas em espécie - Sangrias
    const totalEntradasEspecie = vendasDinheiro + totalRecebimentosDinheiro + totalSuprimentos;
    const dinheiroEsperado = Math.max(0, fundoInicial + totalEntradasEspecie - totalSangrias - totalSaidas);

    // Faturamento geral do turno (recebimentos imediatos + faturado a prazo no boleto)
    const totalFaturadoGeral = totalRecebidosCaixa + finalVendasBoleto;

    return {
      fundoInicial,
      vendasDinheiro,
      vendasPix,
      vendasDebito,
      vendasCredito,
      vendasBoleto: finalVendasBoleto,
      vendasBoletoTotal: finalVendasBoleto,
      vendasBoletoQtd: finalVendasBoletoQtd,
      totalRecebidosCaixa,
      totalVendas: totalFaturadoGeral,
      totalFaturadoGeral,
      totalSangrias,
      totalSuprimentos,
      totalRecebimentosDinheiro,
      totalEntradasEspecie,
      totalSaidas,
      dinheiroEsperado,
      listaMovimentos: sessionMovements,
      vendasDoTurno: sessionSales
    };
  }, [activeSession, selectedCity, cashMovements, salesData]);

  // ─── HANDLERS DE ENVIO ─────────────────────────────────────────────
  
  // 1. Abertura de Caixa
  const handleAberturaSubmit = (e) => {
    e.preventDefault();
    const val = parseCurrency(fundoInicialInput);
    onOpenCash({
      unidade: selectedCity,
      operador: currentUser?.username || 'Caixa',
      fundoInicial: val,
      observacoes: obsAberturaInput,
      dataHoraAbertura: new Date().toISOString()
    });
    onClose();
  };

  // 2. Sangria de Caixa
  const handleSangriaSubmit = (e) => {
    e.preventDefault();
    const val = parseCurrency(sangriaValorInput);
    if (val <= 0) {
      alert('Informe um valor válido para a sangria.');
      return;
    }
    if (val > sessionStats.dinheiroEsperado) {
      if (!window.confirm(`Atenção: O valor da sangria (R$ ${formatCurrency(val)}) é maior que o dinheiro disponível na gaveta (R$ ${formatCurrency(sessionStats.dinheiroEsperado)}). Deseja continuar mesmo assim?`)) {
        return;
      }
    }

    const sangriaData = {
      unidade: selectedCity,
      operador: currentUser?.username || 'Caixa',
      valor: val,
      motivo: sangriaMotivoInput,
      despesaCategoria: sangriaDespesaCategoria,
      detalhes: sangriaObsInput,
      dataHora: new Date().toISOString(),
      saldoGavetaApos: Math.max(0, sessionStats.dinheiroEsperado - val)
    };

    onAddSangria(sangriaData);
    
    // Imprimir comprovante de sangria no nível raiz
    if (onTriggerPrint) {
      onTriggerPrint({ type: 'SANGRIA', data: sangriaData });
      onClose();
    } else {
      setPrintData({ type: 'SANGRIA', data: sangriaData });
      setTimeout(() => {
        window.print();
        onClose();
      }, 300);
    }
  };

  // 3. Suprimento de Caixa
  const handleSuprimentoSubmit = (e) => {
    e.preventDefault();
    const val = parseCurrency(suprimentoValorInput);
    if (val <= 0) {
      alert('Informe um valor válido para o suprimento.');
      return;
    }

    const suprimentoData = {
      unidade: selectedCity,
      operador: currentUser?.username || 'Caixa',
      valor: val,
      motivo: suprimentoMotivoInput,
      dataHora: new Date().toISOString(),
      saldoGavetaApos: sessionStats.dinheiroEsperado + val
    };

    onAddSuprimento(suprimentoData);
    
    if (onTriggerPrint) {
      onTriggerPrint({ type: 'SUPRIMENTO', data: suprimentoData });
      onClose();
    } else {
      setPrintData({ type: 'SUPRIMENTO', data: suprimentoData });
      setTimeout(() => {
        window.print();
        onClose();
      }, 300);
    }
  };

  // 4. Fechamento de Caixa
  const handleFechamentoSubmit = (e) => {
    e.preventDefault();
    const contado = parseCurrency(fechamentoContadoInput);
    const diferenca = contado - sessionStats.dinheiroEsperado;

    const fechamentoData = {
      unidade: selectedCity,
      operador: currentUser?.username || 'Caixa',
      dataAbertura: activeSession?.dataHoraAbertura ? new Date(activeSession.dataHoraAbertura).toLocaleString('pt-BR') : '---',
      dataFechamento: new Date().toLocaleString('pt-BR'),
      fundoInicial: sessionStats.fundoInicial,
      vendasDinheiro: sessionStats.vendasDinheiro,
      vendasPix: sessionStats.vendasPix,
      vendasDebito: sessionStats.vendasDebito,
      vendasCredito: sessionStats.vendasCredito,
      vendasBoleto: sessionStats.vendasBoleto,
      vendasBoletoTotal: sessionStats.vendasBoletoTotal,
      vendasBoletoQtd: sessionStats.vendasBoletoQtd,
      totalRecebidosCaixa: sessionStats.totalRecebidosCaixa,
      totalRecebimentosDinheiro: sessionStats.totalRecebimentosDinheiro,
      totalEntradasEspecie: sessionStats.totalEntradasEspecie,
      totalVendas: sessionStats.totalVendas,
      totalSangrias: sessionStats.totalSangrias,
      totalSuprimentos: sessionStats.totalSuprimentos,
      dinheiroEsperado: sessionStats.dinheiroEsperado,
      dinheiroContado: contado,
      diferenca: diferenca,
      observacoes: fechamentoObsInput,
      status: diferenca === 0 ? 'Perfeito' : diferenca > 0 ? 'Sobra' : 'Quebra'
    };

    onCloseCash(fechamentoData);

    // Dispara impressão do Relatório Z
    if (onTriggerPrint) {
      onTriggerPrint({ type: 'FECHAMENTO', data: fechamentoData });
      onClose();
    } else {
      setPrintData({ type: 'FECHAMENTO', data: fechamentoData });
      setTimeout(() => {
        window.print();
        onClose();
      }, 300);
    }
  };

  // 5. Imprimir Extrato Parcial
  const handlePrintExtratoParcial = () => {
    const extratoData = {
      unidade: selectedCity,
      operador: currentUser?.username || 'Caixa',
      dataAbertura: activeSession?.dataHoraAbertura ? new Date(activeSession.dataHoraAbertura).toLocaleString('pt-BR') : '---',
      fundoInicial: sessionStats.fundoInicial,
      vendasDinheiro: sessionStats.vendasDinheiro,
      vendasPix: sessionStats.vendasPix,
      vendasDebito: sessionStats.vendasDebito,
      vendasCredito: sessionStats.vendasCredito,
      vendasBoleto: sessionStats.vendasBoleto,
      vendasBoletoTotal: sessionStats.vendasBoletoTotal,
      vendasBoletoQtd: sessionStats.vendasBoletoQtd,
      totalRecebidosCaixa: sessionStats.totalRecebidosCaixa,
      totalRecebimentosDinheiro: sessionStats.totalRecebimentosDinheiro,
      totalEntradasEspecie: sessionStats.totalEntradasEspecie,
      totalVendas: sessionStats.totalVendas,
      totalSangrias: sessionStats.totalSangrias,
      totalSuprimentos: sessionStats.totalSuprimentos,
      dinheiroEsperado: sessionStats.dinheiroEsperado
    };

    if (onTriggerPrint) {
      onTriggerPrint({ type: 'EXTRATO_PARCIAL', data: extratoData });
    } else {
      setPrintData({ type: 'EXTRATO_PARCIAL', data: extratoData });
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-[#0b1120] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 sm:space-y-6 max-h-[90vh] overflow-y-auto erp-scroll">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                modalType === 'ABERTURA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/20' :
                modalType === 'SANGRIA' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-rose-500/20' :
                modalType === 'SUPRIMENTO' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sky-500/20' :
                modalType === 'FECHAMENTO' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-amber-500/20' :
                'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-purple-500/20'
              }`}>
                {modalType === 'ABERTURA' && <Unlock size={22} />}
                {modalType === 'SANGRIA' && <ArrowDownRight size={22} />}
                {modalType === 'SUPRIMENTO' && <ArrowUpRight size={22} />}
                {modalType === 'FECHAMENTO' && <Lock size={22} />}
                {modalType === 'EXTRATO' && <FileText size={22} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {modalType === 'ABERTURA' && 'Abertura de Caixa (Novo Turno)'}
                  {modalType === 'SANGRIA' && 'Sangria de Caixa (Retirada Segura)'}
                  {modalType === 'SUPRIMENTO' && 'Suprimento de Troco (Entrada Avulsa)'}
                  {modalType === 'FECHAMENTO' && 'Fechamento de Caixa (Conferência Z)'}
                  {modalType === 'EXTRATO' && 'Extrato Completo do Turno'}
                </h3>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                  <span>📍 {selectedCity}</span>
                  <span>•</span>
                  <span>👤 {currentUser?.username || 'Caixa'}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* ─── MODAL 1: ABERTURA DE CAIXA ─────────────────────────── */}
          {modalType === 'ABERTURA' && (
            <form onSubmit={handleAberturaSubmit} className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><CheckCircle2 size={15} /> Início do Expediente de Caixa</p>
                <p className="text-emerald-400/80">Informe a quantidade de dinheiro físico disponível na gaveta para iniciar as operações do dia.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-400" /> Fundo de Troco Inicial (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                  <input
                    type="text"
                    required
                    value={fundoInicialInput}
                    onChange={e => setFundoInicialInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-emerald-500/40 rounded-xl pl-10 pr-4 py-3 text-lg text-white font-black focus:outline-none focus:border-emerald-400 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Observações de Abertura (Opcional)</label>
                <input
                  type="text"
                  value={obsAberturaInput}
                  onChange={e => setObsAberturaInput(e.target.value)}
                  placeholder="Ex: Turno da manhã, gaveta conferida."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all">
                  <Unlock size={16} /> Confirmar e Abrir Caixa
                </button>
              </div>
            </form>
          )}

          {/* ─── MODAL 2: SANGRIA DE CAIXA ──────────────────────────── */}
          {modalType === 'SANGRIA' && (
            <form onSubmit={handleSangriaSubmit} className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dinheiro na Gaveta AGORA</span>
                  <p className="text-xl font-black text-emerald-400">R$ {formatCurrency(sessionStats.dinheiroEsperado)}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>Fundo: R$ {formatCurrency(sessionStats.fundoInicial)}</p>
                  <p>Vendas (Espécie): R$ {formatCurrency(sessionStats.vendasDinheiro)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <ArrowDownRight size={14} /> Valor da Sangria / Retirada (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                  <input
                    type="text"
                    required
                    value={sangriaValorInput}
                    onChange={e => setSangriaValorInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-rose-500/40 rounded-xl pl-10 pr-4 py-3 text-lg text-white font-black focus:outline-none focus:border-rose-400 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300">Motivo da Retirada</label>
                <select
                  value={sangriaMotivoInput}
                  onChange={e => setSangriaMotivoInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-rose-500"
                >
                  <option value="Recolhimento para Cofre / Depósito">🔒 Recolhimento de Segurança para Cofre / Depósito</option>
                  <option value="Pagamento de Despesa Local">🧾 Pagamento de Despesa da Loja (Motoboy, Limpeza, Água/Café)</option>
                  <option value="Adiantamento / Vale">👤 Adiantamento / Vale Funcionário</option>
                  <option value="Outro Motivo">Outro Motivo</option>
                </select>
              </div>

              {sangriaMotivoInput === 'Pagamento de Despesa Local' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-400">Categoria da Despesa (Lançar no Contas a Pagar)</label>
                  <input
                    type="text"
                    placeholder="Ex: Motoboy Entrega de Lentes, Material de Limpeza, Café"
                    value={sangriaDespesaCategoria}
                    onChange={e => setSangriaDespesaCategoria(e.target.value)}
                    className="w-full bg-black/40 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-white"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Observações adicionais</label>
                <input
                  type="text"
                  value={sangriaObsInput}
                  onChange={e => setSangriaObsInput(e.target.value)}
                  placeholder="Ex: Retirado por Carla para depósito bancário."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-lg shadow-rose-500/25 flex items-center gap-2 transition-all">
                  <Printer size={16} /> Confirmar Sangria & Imprimir Recibo
                </button>
              </div>
            </form>
          )}

          {/* ─── MODAL 3: SUPRIMENTO DE CAIXA ───────────────────────── */}
          {modalType === 'SUPRIMENTO' && (
            <form onSubmit={handleSuprimentoSubmit} className="space-y-4">
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 text-xs text-sky-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><ArrowUpRight size={15} /> Entrada Avulsa de Troco</p>
                <p className="text-sky-400/80">Utilize para registrar a entrada de troco adicional (moedas/notas) trazidas para a gaveta.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <DollarSign size={14} /> Valor do Suprimento (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                  <input
                    type="text"
                    required
                    value={suprimentoValorInput}
                    onChange={e => setSuprimentoValorInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-sky-500/40 rounded-xl pl-10 pr-4 py-3 text-lg text-white font-black focus:outline-none focus:border-sky-400 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300">Origem / Motivo</label>
                <input
                  type="text"
                  required
                  value={suprimentoMotivoInput}
                  onChange={e => setSuprimentoMotivoInput(e.target.value)}
                  placeholder="Ex: Troco de moedas trazido do banco."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black shadow-lg shadow-sky-500/25 flex items-center gap-2 transition-all">
                  <Printer size={16} /> Confirmar Suprimento & Imprimir
                </button>
              </div>
            </form>
          )}

          {/* ─── MODAL 4: FECHAMENTO DE CAIXA ───────────────────────── */}
          {modalType === 'FECHAMENTO' && (
            <form onSubmit={handleFechamentoSubmit} className="space-y-5">
              
              {/* 1. Valores Realmente Recebidos em Caixa */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">1. Valores Realmente Recebidos em Caixa:</span>
                  <span className="text-base font-black text-emerald-400">R$ {formatCurrency(sessionStats.totalRecebidosCaixa)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <p>💵 Dinheiro (Espécie): <strong className="text-white">R$ {formatCurrency(sessionStats.vendasDinheiro)}</strong></p>
                  {(parseCurrency(sessionStats.totalRecebimentosDinheiro) > 0) && (
                    <p>🎟️ Boleto em Dinheiro: <strong className="text-emerald-300">R$ {formatCurrency(sessionStats.totalRecebimentosDinheiro)}</strong></p>
                  )}
                  <p>⚡ PIX: <strong className="text-white">R$ {formatCurrency(sessionStats.vendasPix)}</strong></p>
                  <p>💳 Débito: <strong className="text-white">R$ {formatCurrency(sessionStats.vendasDebito)}</strong></p>
                  <p>💳 Crédito: <strong className="text-white">R$ {formatCurrency(sessionStats.vendasCredito)}</strong></p>
                  <p>💸 Sangrias: <strong className="text-rose-400">-R$ {formatCurrency(sessionStats.totalSangrias)}</strong></p>
                </div>
              </div>

              {/* 2. Valores Faturados a Prazo em Boleto (Recebível Futuro) */}
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <div>
                    <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">2. Faturado a Prazo no Boleto:</span>
                    <span className="text-[10px] text-indigo-400 block font-medium">({sessionStats.vendasBoletoQtd || 0} venda(s) a prazo neste turno)</span>
                  </div>
                  <span className="text-base font-black text-indigo-300">R$ {formatCurrency(sessionStats.vendasBoletoTotal)}</span>
                </div>
                <p className="text-[10px] text-indigo-200/80 bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
                  ℹ️ <strong>Recebível futuro em Contas a Receber:</strong> Este valor representa vendas parceladas para recebimento futuro na loja. Não ingressa na gaveta física e não infla o saldo de dinheiro em espécie.
                </p>
              </div>

              {/* 3. Conferência da Gaveta Física (Dinheiro em Espécie) */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">3. Saldo Físico Esperado na Gaveta (Espécie):</span>
                  <span className="text-lg font-black text-emerald-300">R$ {formatCurrency(sessionStats.dinheiroEsperado)}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Fundo Inicial (R$ {formatCurrency(sessionStats.fundoInicial)}) + Entradas em Espécie (R$ {formatCurrency(sessionStats.totalEntradasEspecie)}) - Sangrias (R$ {formatCurrency(sessionStats.totalSangrias)}) = R$ {formatCurrency(sessionStats.dinheiroEsperado)}
                </p>
              </div>

              {/* Campo para Digitar a Contagem */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <DollarSign size={14} /> Valor em Dinheiro Realmente Contado na Gaveta (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                  <input
                    type="text"
                    required
                    value={fechamentoContadoInput}
                    onChange={e => setFechamentoContadoInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-amber-500/40 rounded-xl pl-10 pr-4 py-3 text-lg text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>
              </div>

              {/* Cálculo de Diferença em Tempo Real */}
              {fechamentoContadoInput && (
                <div className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between ${
                  (parseCurrency(fechamentoContadoInput) - sessionStats.dinheiroEsperado) === 0
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : (parseCurrency(fechamentoContadoInput) - sessionStats.dinheiroEsperado) > 0
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}>
                  <span>
                    {(parseCurrency(fechamentoContadoInput) - sessionStats.dinheiroEsperado) === 0
                      ? '✅ Caixa Exato (Sem Diferença)'
                      : (parseCurrency(fechamentoContadoInput) - sessionStats.dinheiroEsperado) > 0
                      ? '📈 Sobra de Caixa'
                      : '📉 Quebra / Falta de Caixa'}
                  </span>
                  <span>
                    R$ {formatCurrency(Math.abs(parseCurrency(fechamentoContadoInput) - sessionStats.dinheiroEsperado))}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Observações de Fechamento</label>
                <input
                  type="text"
                  value={fechamentoObsInput}
                  onChange={e => setFechamentoObsInput(e.target.value)}
                  placeholder="Ex: Turno encerrado sem divergências."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all">
                  <Printer size={16} /> Fechar Caixa & Imprimir Relatório Z
                </button>
              </div>
            </form>
          )}

          {/* ─── MODAL 5: EXTRATO COMPLETO DO TURNO ─────────────────── */}
          {modalType === 'EXTRATO' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Gaveta Atual</span>
                  <p className="text-base font-black text-emerald-400">R$ {formatCurrency(sessionStats.dinheiroEsperado)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Total Vendas</span>
                  <p className="text-base font-black text-white">R$ {formatCurrency(sessionStats.totalVendas)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Sangrias</span>
                  <p className="text-base font-black text-rose-400">-R$ {formatCurrency(sessionStats.totalSangrias)}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Suprimentos</span>
                  <p className="text-base font-black text-sky-400">+R$ {formatCurrency(sessionStats.totalSuprimentos)}</p>
                </div>
              </div>

              {/* Lista de Movimentações */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Histórico de Movimentações do Turno:</h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {sessionStats.listaMovimentos.length > 0 ? (
                    sessionStats.listaMovimentos.map((m, idx) => (
                      <div key={idx} className="bg-black/40 border border-white/5 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full ${
                            m.tipo === 'SANGRIA' ? 'bg-rose-400' :
                            m.tipo === 'SUPRIMENTO' ? 'bg-sky-400' :
                            m.tipo === 'VENDA' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                          <div>
                            <p className="font-bold text-white">{m.tipo} - {m.motivo || m.formaPagamento || 'Movimentação'}</p>
                            <p className="text-[10px] text-slate-500">{m.dataHora ? new Date(m.dataHora).toLocaleTimeString('pt-BR') : '---'} · {m.operador}</p>
                          </div>
                        </div>
                        <span className={`font-mono font-black ${
                          m.tipo === 'SANGRIA' ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {m.tipo === 'SANGRIA' ? '-' : '+'}R$ {formatCurrency(m.valor)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhuma sangria ou suprimento lançado neste turno ainda.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={handlePrintExtratoParcial}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all"
                >
                  <Printer size={15} /> Imprimir Extrato Parcial
                </button>
                <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20">
                  Fechar Extrato
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Componente Invisível de Impressão */}
      {printData && (
        <PrintableCashVoucher
          type={printData.type}
          data={printData.data}
          unit={selectedCity}
          operator={currentUser?.username || 'Caixa'}
        />
      )}
    </>
  );
};

export default CashManagementModal;
