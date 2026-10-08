import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, Eye, Trash2, Download, Printer, CheckCircle2, 
  RotateCw, ZoomIn, ZoomOut, Maximize2, FileText, Image as ImageIcon, 
  Paperclip, Camera, DollarSign, Calendar, AlertCircle
} from 'lucide-react';

/**
 * Utilitário de compressão de imagens para comprovantes
 * Garante fidelidade para leitura de comprovantes de PIX, boletos e depósitos
 * mantendo o tamanho otimizado (< 250KB) para sincronização no banco.
 */
const compressReceiptFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Nenhum arquivo fornecido'));

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDimension = 1400;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const webpData = canvas.toDataURL('image/webp', 0.85);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {}

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const ReceiptModal = ({ isOpen, onClose, row, onSave, onDelete }) => {
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (row && isOpen) {
      const receiptVal = row.COMPROVANTE || row.comprovante || row.ANEXO_COMPROVANTE || null;
      setCurrentReceipt(receiptVal);
      setZoomLevel(1);
      setRotation(0);
      const isAlreadyPaid = (row.STATUS || row.status || '').toLowerCase() === 'recebido' || (row.STATUS || row.status || '').toLowerCase() === 'pago';
      setMarkAsPaid(!isAlreadyPaid);
    }
  }, [row, isOpen]);

  if (!isOpen || !row) return null;

  const isPdf = typeof currentReceipt === 'string' && currentReceipt.startsWith('data:application/pdf');
  const clientName = row.CLIENTE || row['NOME CLIENTE'] || row.NOME || 'Cliente';
  const installmentDoc = row.DOCUMENTO || row.DESCRICAO || row.VENDA_OS ? `OS #${row.VENDA_OS}` : 'Mensalidade';
  const installmentVal = row.VALOR || row.valor || '0,00';
  const installmentDueDate = row.DATA_VENCIMENTO || row['DATA VENCIMENTO'] || row.VENCIMENTO || '—';

  const handleFile = async (file) => {
    if (!file) return;

    // Limite estrito de 4MB para garantir rapidez e leveza no sistema
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      alert(`O arquivo selecionado possui ${sizeMB}MB. O tamanho máximo permitido para comprovantes é de até 4MB para manter o sistema leve e rápido. Por favor, selecione um arquivo menor.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    try {
      const base64Data = await compressReceiptFile(file);
      setCurrentReceipt(base64Data);
      if (onSave) {
        await onSave({
          comprovante: base64Data,
          nomeArquivo: file.name || 'comprovante.jpg',
          dataAnexo: new Date().toISOString(),
          markAsPaid: markAsPaid
        });
      }
    } catch (err) {
      console.error('Erro ao processar comprovante:', err);
      alert('Não foi possível ler o arquivo. Tente outra imagem (JPG, PNG) ou PDF.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownload = () => {
    if (!currentReceipt) return;
    const a = document.createElement('a');
    a.href = currentReceipt;
    const ext = isPdf ? 'pdf' : 'jpg';
    const safeDoc = String(installmentDoc).replace(/[^a-zA-Z0-9]/g, '_');
    const safeClient = String(clientName).replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `Comprovante_${safeDoc}_${safeClient}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!currentReceipt) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, autorize pop-ups para imprimir o comprovante.');
      return;
    }

    if (isPdf) {
      printWindow.document.write(`
        <html>
          <head><title>Imprimir Comprovante</title></head>
          <body style="margin:0;padding:0;">
            <embed width="100%" height="100%" src="${currentReceipt}" type="application/pdf">
          </body>
        </html>
      `);
    } else {
      printWindow.document.write(`
        <html>
          <head>
            <title>Comprovante - ${installmentDoc} - ${clientName}</title>
            <style>
              body { margin: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; }
              .header { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
              img { max-width: 100%; max-height: 85vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Comprovante de Pagamento / Mensalidade</h2>
              <p><strong>Cliente:</strong> ${clientName} | <strong>Parcela:</strong> ${installmentDoc} | <strong>Valor:</strong> R$ ${installmentVal}</p>
            </div>
            <img src="${currentReceipt}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
    }
    printWindow.document.close();
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja remover este comprovante de pagamento?')) return;
    setCurrentReceipt(null);
    if (onDelete) {
      await onDelete();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/5 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Paperclip size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                    Comprovante de Pagamento
                  </h3>
                  {currentReceipt ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Anexado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Pendente de Anexo
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  <strong className="text-slate-200">{clientName}</strong> • {installmentDoc} • <span className="text-emerald-400 font-bold">R$ {installmentVal}</span> • Venc: {installmentDueDate}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
            {currentReceipt ? (
              <div className="space-y-4">
                {/* Visualizador de Imagem / PDF */}
                <div className="relative w-full h-[52vh] sm:h-[58vh] bg-slate-950 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner group">
                  {isPdf ? (
                    <iframe
                      src={currentReceipt}
                      title="Comprovante PDF"
                      className="w-full h-full rounded-2xl"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 overflow-hidden">
                      <img
                        src={currentReceipt}
                        alt="Comprovante"
                        style={{
                          transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                          transition: 'transform 0.2s ease-out'
                        }}
                        className="max-w-full max-h-full object-contain rounded-xl select-none"
                      />
                    </div>
                  )}

                  {/* Controles flutuantes de Zoom / Rotação para Imagem */}
                  {!isPdf && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-1.5 flex items-center gap-1 shadow-2xl">
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                        className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all"
                        title="Diminuir Zoom"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <span className="text-xs font-mono font-bold text-slate-400 px-1">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                        className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all"
                        title="Aumentar Zoom"
                      >
                        <ZoomIn size={16} />
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1" />
                      <button
                        type="button"
                        onClick={() => setRotation(prev => (prev + 90) % 360)}
                        className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all"
                        title="Girar 90°"
                      >
                        <RotateCw size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setZoomLevel(1); setRotation(0); }}
                        className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-bold"
                        title="Resetar Zoom"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {/* Barra de Ações Rápidas */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-white/5 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <Download size={15} className="text-sky-400" />
                      <span>Baixar Arquivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-white/5 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <Printer size={15} className="text-emerald-400" />
                      <span>Imprimir</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
                      <Upload size={15} />
                      <span>{isProcessing ? 'Processando...' : 'Trocar Comprovante'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileInputChange}
                        disabled={isProcessing}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <Trash2 size={15} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Dropzone para novo Anexo */
              <div className="space-y-4">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-white/10 hover:border-emerald-500/50 bg-black/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                    <Upload size={30} className={isProcessing ? 'animate-bounce' : ''} />
                  </div>

                  <div className="max-w-md space-y-1.5">
                    <h4 className="text-base font-black text-white">
                      {isProcessing ? 'Processando arquivo...' : 'Anexar Comprovante de Pagamento'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Arraste e solte o comprovante (PIX, recibo de máquina de cartão, boleto autenticado ou comprovante assinado) aqui.
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Formatos aceitos: JPG, PNG, WEBP ou PDF (até 4MB)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <label className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2 active:scale-95">
                      <Upload size={16} />
                      <span>Selecionar Arquivo</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileInputChange}
                        disabled={isProcessing}
                        className="hidden"
                      />
                    </label>

                    <label className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs transition-all cursor-pointer flex items-center gap-2 active:scale-95 sm:hidden">
                      <Camera size={16} className="text-emerald-400" />
                      <span>Tirar Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileInputChange}
                        disabled={isProcessing}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Opção de Atualização de Status */}
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Atualizar Situação da Mensalidade
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Marcar automaticamente esta parcela como <strong className="text-emerald-400">"Recebido"</strong> após anexar o comprovante.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markAsPaid}
                      onChange={(e) => setMarkAsPaid(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-slate-950/60 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReceiptModal;
