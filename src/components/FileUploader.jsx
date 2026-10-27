import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Sparkles, Download, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { parseXmlToObjects } from '../xmlUtils';

const SHEET_CONFIG = {
  'BD MARKETING':           { label: 'BD Marketing',         color: 'sky'     },
  'BD MARKETING ANTIGO':    { label: 'BD Marketing Antigo',  color: 'slate'   },
  'Controle_Parcelas':      { label: 'Parcelas',             color: 'amber'   },
  'RELATÓRIO PARCELAS':     { label: 'Relatório Parcelas',   color: 'orange'  },
  'ORÇAMENTOS':             { label: 'Orçamentos',           color: 'violet'  },
  'Cópia de DADOS DIOPTRIA':{ label: 'Dioptria (Estoque)',   color: 'teal'    },
  'AnáliseInfluencer':      { label: 'Influencers',          color: 'pink'    },
  'ESTOQUE ENTRADA SAÍDAS': { label: 'Estoque',              color: 'emerald' },
};

const FileUploader = ({ onDataLoaded, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile]   = useState(null);
  const [status, setStatus] = useState('idle');
  const [sheets, setSheets] = useState([]);

  const processFile = async (f) => {
    if (!f) return;
    setStatus('loading');
    setFile(f);

    const reader = new FileReader();
    const ext = f.name.split('.').pop().toLowerCase();

    reader.onload = (e) => {
      try {
        if (ext === 'xml') {
          const parsed = parseXmlToObjects(e.target.result);
          const rawName = f.name.replace(/\.xml$/i, '').trim();
          const cleanName = rawName ? rawName.replace(/[^a-zA-Z0-9_ -]/g, '_') : 'Importacao_XML';
          const sheetData = { [cleanName]: parsed };
          setTimeout(() => { setSheets(Object.keys(sheetData)); onDataLoaded(sheetData); setStatus('success'); }, 800);
        } else if (ext === 'csv') {
          const parsed = Papa.parse(e.target.result, { header: true, dynamicTyping: true });
          const sheetData = { 'Planilha': parsed.data.filter(r => Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== '')) };
          setTimeout(() => { setSheets(Object.keys(sheetData)); onDataLoaded(sheetData); setStatus('success'); }, 800);
        } else {
          // XLSX: carrega todas as abas detectando cabeçalho real e preservando UTF-8/emojis
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          const sheetData = {};
          const parseSheet = (ws) => {
            const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (!raw || raw.length === 0) return [];
            let headerIdx = 0;
            let maxNonEmpty = 0;
            for (let i = 0; i < Math.min(raw.length, 15); i++) {
              const count = raw[i].filter(c => c !== '' && c !== null && c !== undefined && String(c).trim() !== '').length;
              if (count > maxNonEmpty) {
                maxNonEmpty = count;
                headerIdx = i;
              }
            }
            const headers = raw[headerIdx].map((h, i) => (h !== '' && h !== null && h !== undefined ? String(h).trim() : `COL_${i}`));
            return raw.slice(headerIdx + 1)
              .map(row => { const obj = {}; headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; }); return obj; })
              .filter(r => {
                if (!r || typeof r !== 'object') return false;
                return Object.entries(r).some(([k, v]) => {
                  if (v === null || v === undefined || v === '') return false;
                  const s = String(v).trim();
                  return s !== '' && s !== '—' && s !== '-' && s !== '#N/A' && s !== 'Sem Registro na Base Antiga';
                });
              });
          };
          wb.SheetNames.forEach(name => {
            const rows = parseSheet(wb.Sheets[name]);
            if (rows.length > 0) sheetData[name] = rows;
          });
          const names = Object.keys(sheetData);
          setTimeout(() => { setSheets(names); onDataLoaded(sheetData); setStatus('success'); }, 800);
        }
      } catch {
        setStatus('error');
      }
    };

    if (ext === 'csv' || ext === 'xml') reader.readAsText(f, 'UTF-8');
    else reader.readAsArrayBuffer(f);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 relative z-10">
      {/* Glow de Fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-sky-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />
      
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }}
        animate={{ scale: isDragging ? 1.02 : 1 }}
        className={`p-12 sm:p-20 relative overflow-hidden flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] transition-all duration-500 ${
          isDragging ? 'border-sky-500/50 bg-sky-500/10 shadow-[0_0_50px_rgba(14,165,233,0.2)]' : 'border-white/10 bg-[#0b1120]/80 backdrop-blur-3xl shadow-2xl'
        }`}
      >
        <AnimatePresence>
          {isDragging && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-sky-500/5 pointer-events-none" />
          )}
        </AnimatePresence>

        <input type="file" id="file-upload" className="hidden" accept=".xml,.csv,.xlsx,.xls"
          onChange={(e) => processFile(e.target.files[0])} />

        <motion.div
          animate={status === 'loading' ? { rotate: 360 } : {}}
          transition={status === 'loading' ? { repeat: Infinity, duration: 1.5, ease: 'linear' } : {}}
          className={`p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br transition-all duration-500 shadow-2xl relative group ${
            status === 'success' ? 'from-emerald-500 to-teal-600 shadow-[0_0_40px_rgba(16,185,129,0.3)]' :
            status === 'error' ? 'from-rose-500 to-pink-600 shadow-[0_0_40px_rgba(244,63,94,0.3)]' : 'from-sky-500 to-indigo-600 shadow-[0_0_40px_rgba(14,165,233,0.3)]'
          }`}
        >
          {status === 'idle' && <Upload className="w-10 h-10 text-white" />}
          {status === 'loading' && <Sparkles className="w-10 h-10 text-white" />}
          {status === 'success' && <CheckCircle2 className="w-10 h-10 text-white" />}
          {status === 'error' && <AlertCircle className="w-10 h-10 text-white" />}
        </motion.div>

        <div className="mt-10 text-center relative z-10">
          <h3 className="text-2xl font-black mb-3">
            {status === 'success' ? `${sheets.length} tabelas carregadas!` : 'Conectar Arquivo de Dados'}
          </h3>
          <p className="text-slate-400 max-w-xs mx-auto mb-10 text-sm leading-relaxed">
            {status === 'success'
              ? 'Todas as tabelas foram detectadas automaticamente.'
              : 'Carregue seu arquivo XML ou Excel. Todas as abas e seções serão processadas individualmente.'
            }
          </p>

          {/* Abas detectadas */}
          <AnimatePresence>
            {status === 'success' && sheets.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap justify-center gap-2 mb-8">
                {sheets.map(s => {
                  const cfg = SHEET_CONFIG[s] || { label: s, color: 'slate' };
                  return (
                    <span key={s} className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-${cfg.color}-500/10 text-${cfg.color}-400 border border-${cfg.color}-500/20 uppercase tracking-widest`}>
                      <Layers size={10} /> {cfg.label}
                    </span>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 w-full max-w-2xl mx-auto">
            {onCancel && (
              <button onClick={onCancel} className="flex-1 px-6 py-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 text-slate-300 hover:text-white transition-all text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
                <X size={18} className="text-rose-400" /> Cancelar
              </button>
            )}
            
            <label htmlFor="file-upload" className="flex-1 px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white transition-all text-sm font-black flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_50px_rgba(14,165,233,0.5)] transform hover:scale-[1.02]" style={{ cursor: 'pointer' }}>
              <Upload size={18} />
              {status === 'success' ? 'Trocar Arquivo' : 'Escolher Arquivo'}
            </label>

            <a href="/planilha_teste_otica.csv" download className="flex-1 px-6 py-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 text-slate-300 hover:text-white transition-all text-sm font-bold flex items-center justify-center gap-2 shadow-lg">
              <Download size={18} className="text-emerald-400" /> Baixar Modelo
            </a>
          </div>
        </div>

        <AnimatePresence>
          {file && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-8 flex items-center gap-3 text-xs font-bold text-sky-400 bg-sky-500/5 px-4 py-2 rounded-full border border-sky-500/10">
              <FileText size={14} />
              <span>{file.name.toUpperCase()}</span>
              <button onClick={() => { setFile(null); setStatus('idle'); setSheets([]); }} className="hover:text-rose-400 transition-colors">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default FileUploader;
