import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Table2 } from 'lucide-react';
import DataTable from './DataTable';

const ClientInstallmentsModal = ({ isOpen, onClose, clientName, rows, onRowUpdate, onDeleteRow, currentUser }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                <Table2 size={20} className="text-sky-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  Mensalidades & Boletos
                </h2>
                <p className="text-sm font-bold text-slate-400">
                  Cliente: <span className="text-sky-400">{clientName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content - DataTable */}
          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            <DataTable
              sheetName="CONTAS_RECEBER"
              rows={rows}
              onRowUpdate={onRowUpdate}
              onDeleteRow={onDeleteRow}
              currentUser={currentUser}
              allowEdit={true}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ClientInstallmentsModal;
