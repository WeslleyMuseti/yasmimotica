import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Edit2, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PrintableOS from './PrintableOS';

const RowDetailsModal = ({ isOpen, onClose, data, onEditClick }) => {
  const [printOSData, setPrintOSData] = useState(null);
  const [printClientData, setPrintClientData] = useState(null);

  const row = data?.row || {};
  const osNum = row['OS'] || row['OS DA VENDA'] || row['OS da COMPRA'] || row['VENDA_OS'];
  const modalContent = (
    <AnimatePresence>
      {isOpen && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0b1120] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 sm:p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent flex justify-between items-start z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
              
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                  <FileText className="text-emerald-400 relative z-10" size={26} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
                    {data.clientName || 'Detalhes do Registro'}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                      {data.sheetName}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar bg-black/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {Object.entries(data.row).map(([key, value], i) => {
                  if (value === '' || value === null || value === undefined) return null;
                  return (
                    <div key={i} className="group bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 hover:border-white/10 transition-all flex flex-col justify-center min-h-[90px]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 group-hover:text-emerald-400/80 transition-colors">
                        {key}
                      </p>
                      <p className="text-base text-slate-200 font-medium break-words leading-snug">
                        {value instanceof Date ? value.toLocaleDateString('pt-BR') : String(value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-black/40 flex justify-end gap-3">
               <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Fechar
              </button>
              {osNum && (
                <button
                  onClick={() => {
                    setPrintOSData({
                      numeroOS: osNum,
                      selectedCity: row['CIDADE'] || row['LOJA'] || row['UNIDADE'] || 'Central',
                      unidade: row['CIDADE'] || row['LOJA'] || row['UNIDADE'] || 'Central',
                      medico: row['MEDICO'] || '',
                      lente: row['LENTE'] || row['PRODUTO'] || '',
                      armacao: row['ARMAÇÃO'] || '',
                      valorTotal: row['VALOR TOTAL'] || row['VALOR'] || '0,00',
                      valorEntrada: row['VALOR ENTRADA'] || '0,00',
                      restante: row['RESTANTE'] || '0,00',
                      dataVenda: row['DATA  DA VENDA'] || row['DATA DA VENDA'] || row['DATA_VENDA'] || row['Data da Venda'] || row['data_venda'] || row['DATA'] || row['Data'] || '',
                      dataEntrega: row['DATA ENTREGA ÓCULOS'] || row['DATA_ENTREGA'] || '',
                      formasPagamento: row['FORMAS_PAGAMENTO'] || row['MEIO_PAGAMENTO'] || '',
                      observacoes: row['OBSERVACOES'] || '',
                      odEsf: row['OD_ESF'] || '',
                      odCil: row['OD_CIL'] || '',
                      odEixo: row['OD_EIXO'] || '',
                      odDnp: row['OD_DNP'] || '',
                      odAlt: row['OD_ALT'] || '',
                      oeEsf: row['OE_ESF'] || '',
                      oeCil: row['OE_CIL'] || '',
                      oeEixo: row['OE_EIXO'] || '',
                      oeDnp: row['OE_DNP'] || '',
                      oeAlt: row['OE_ALT'] || '',
                      adicao: row['ADICAO'] || ''
                    });
                    setPrintClientData({
                      ...row,
                      'Nome Completo': row['Nome Completo'] || row['NOME'] || row['NOME DO CLIENTE'] || row['CLIENTE'] || 'Cliente',
                      'CPF / CNPJ': row['CPF / CNPJ'] || row['CPF'] || '',
                      'WhatsApp': row['WhatsApp'] || row['TELEFONE'] || row['TELEFONE CLIENTE'] || '',
                      'Cidade': row['CIDADE'] || row['Cidade'] || 'Central'
                    });
                    setTimeout(() => window.print(), 300);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Printer size={16} /> Reimprimir OS
                </button>
              )}
              {onEditClick && (
                <button
                  onClick={onEditClick}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-lg shadow-sky-500/20"
                >
                  <Edit2 size={16} />
                  Editar Registro
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return (
      <>
        {createPortal(modalContent, document.body)}
        {printOSData && printClientData && (
          <PrintableOS clientData={printClientData} osData={printOSData} />
        )}
      </>
    );
  }
  return null;
};

export default RowDetailsModal;
