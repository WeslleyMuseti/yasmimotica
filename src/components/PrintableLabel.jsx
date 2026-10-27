import React, { useState } from 'react';
import { Tag, Printer, X, Eye, Check, AlertCircle, Copy, FileText, Glasses, Sparkles, Scissors } from 'lucide-react';

// Tabela Padrão Code 128 (107 símbolos)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 é STOP)
];

/**
 * Gerador de Código de Barras Vetorial SVG (Code 128 Auto/B)
 */
export const BarcodeSVG = ({ value, height = 20, className = "w-full" }) => {
  const cleanText = String(value || "0000").trim().toUpperCase();
  if (!cleanText) return null;

  const codes = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    const codeVal = (charCode >= 32 && charCode <= 126) ? charCode - 32 : 0;
    codes.push(codeVal);
    checksum += codeVal * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop Code

  let totalWidth = 0;
  const bars = [];

  codes.forEach((codeVal) => {
    const pattern = CODE128_PATTERNS[codeVal] || CODE128_PATTERNS[0];
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      const isBar = j % 2 === 0;
      if (isBar) {
        bars.push({ x: totalWidth, width });
      }
      totalWidth += width;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      className={className}
      style={{ height: `${height}px`, display: 'block' }}
      preserveAspectRatio="none"
    >
      {bars.map((bar, idx) => (
        <rect key={idx} x={bar.x} y={0} width={bar.width} height={height} fill="#000000" />
      ))}
    </svg>
  );
};

const fmtMoney = (val) => {
  if (val === null || val === undefined || val === '') return '0,00';
  if (typeof val === 'number') {
    return isNaN(val) ? '0,00' : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return '0,00';
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? '0,00' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * 👓 1. ETIQUETA HASTE DE ÓCULOS & JOIAS - PADRÃO ARGOX OS-214 PLUS (RABO DE RATO / BORBOLETA)
 * Corpo duplo dobrável com linha pontilhada central + haste/cauda lateral fina para abraçar a armação
 */
export const SingleLabelGlassesJewelry = ({ item = {}, storeName = 'YASMIN ÓTICA' }) => {
  const brand = item.MARCA || item.marca || item.brand || 'ÓTICA';
  const model = item.NOME || item.nome || item.MODELO || item.modelo || item.PRODUTO || item.produto || item.DESCRICAO || 'Produto';
  const sku = item.REFERENCIA_SKU || item.referencia_sku || item.CODIGO || item.codigo || item.SKU || item.sku || `SKU-${Date.now().toString().slice(-6)}`;
  const color = item.COR || item.cor || '';
  const size = item.TAMANHO || item.tamanho || '';
  const material = item.MATERIAL || item.material || '';
  const unit = item.UNIDADE || item.unidade || item.CIDADE || item.cidade || 'Central';
  const rawPrice = item.PRECO_VENDA || item.preco_venda || item.VALOR || item.valor || item.preco || 0;
  const price = fmtMoney(rawPrice);

  return (
    <div className="label-glasses-tail-wrapper flex items-center select-none w-full max-w-[440px] py-1">
      {/* ─── CORPO PRINCIPAL DOBRÁVEL (DIVIDIDO EM 2 METADES POR LINHA PONTILHADA) ─── */}
      <div className="label-glasses-body flex items-stretch bg-white text-black font-sans leading-none border border-black rounded-[3px] shadow-sm overflow-hidden h-[74px] w-[68%]">
        
        {/* Metade 1 (Esquerda - Código de Barras / Leitor) */}
        <div className="w-1/2 p-1.5 flex flex-col justify-between border-r border-dashed border-black/40 bg-white">
          <div className="flex items-center justify-between border-b border-black/30 pb-0.5">
            <span className="font-black text-[7.5px] tracking-tight uppercase truncate">{storeName}</span>
            <span className="text-[6px] font-bold text-gray-700 uppercase">{unit}</span>
          </div>

          <div className="my-auto py-0.5 flex flex-col items-center justify-center">
            <BarcodeSVG value={sku} height={18} />
            <span className="text-[7.5px] font-mono font-black tracking-widest text-black mt-0.5">
              {sku}
            </span>
          </div>

          <div className="text-[6.5px] text-gray-800 font-bold truncate">
            Ref: {sku} {color ? `· ${color}` : ''}
          </div>
        </div>

        {/* Metade 2 (Direita - Marca, Modelo e Preço ao Consumidor) */}
        <div className="w-1/2 p-1.5 flex flex-col justify-between bg-white">
          <div className="flex items-center justify-between border-b border-black/30 pb-0.5">
            <span className="font-black text-[7.5px] tracking-tight uppercase truncate">{storeName}</span>
            <span className="text-[7px] font-black text-black uppercase truncate">{brand}</span>
          </div>

          <div className="my-auto py-0.5">
            <div className="font-black text-[8.5px] uppercase tracking-tight text-black truncate leading-tight">
              {brand} {model}
            </div>
            <div className="text-[6.5px] text-gray-700 font-medium truncate mt-0.5">
              {color && <span>Cor: {color} </span>}
              {size && <span>| Tam: {size} </span>}
              {material && <span>| {material}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/40 pt-0.5 mt-auto">
            <span className="text-[6px] font-bold uppercase text-gray-600">À Vista</span>
            <span className="text-[11px] font-black tracking-tight text-black">
              R$ {price}
            </span>
          </div>
        </div>

      </div>

      {/* ─── CAUDA / HASTE LATERAL (RABO DE RATO QUE LAÇA A ARMAÇÃO/JOIA SEM COLA) ─── */}
      <div className="label-glasses-tail flex items-center h-[14px] w-[32%] bg-white border-y border-r border-black rounded-r-full shadow-sm relative overflow-hidden pl-1 select-none">
        <div className="w-full border-b border-dashed border-gray-300" />
        <span className="text-[5px] text-gray-500 uppercase font-mono font-bold tracking-tighter whitespace-nowrap px-1">
          ⟵ HASTE / ANEL ⟶
        </span>
      </div>
    </div>
  );
};

/**
 * 🏷️ 2. ETIQUETA ADESIVA RETANGULAR 50x30mm
 */
export const SingleLabel50x30 = ({ item = {}, type = 'armacao', storeName = 'YASMIN ÓTICA' }) => {
  if (type === 'os' || type === 'envelope_lab' || item.numeroOS || item.osNumber || item.OS) {
    const osNum = item.numeroOS || item.osNumber || item.OS || item['OS DA VENDA'] || item['OS da COMPRA'] || item['VENDA_OS'] || '---';
    const client = item.clientName || item['Nome Completo'] || item.NOME || item.CLIENTE || item['NOME DO CLIENTE'] || item.nomeCliente || 'Cliente';
    const armacao = item.armacao || item['ARMAÇÃO'] || item.armacaoNome || item.modeloArmacao || '';
    const lente = item.lente || item['LENTE'] || item.lenteNome || item.PRODUTO || '';
    const entrega = item.dtEntrega || item.dataEntrega || item['DATA ENTREGA ÓCULOS'] || item['DATA_ENTREGA'] || '';
    
    const odEsf = item.odEsf || item.OD_ESF || '';
    const odCil = item.odCil || item.OD_CIL || '';
    const odEixo = item.odEixo || item.OD_EIXO || '';
    const odDnp = item.odDnp || item.OD_DNP || '';
    const odAlt = item.odAlt || item.OD_ALT || '';
    
    const oeEsf = item.oeEsf || item.OE_ESF || '';
    const oeCil = item.oeCil || item.OE_CIL || '';
    const oeEixo = item.oeEixo || item.OE_EIXO || '';
    const oeDnp = item.oeDnp || item.OE_DNP || '';
    const oeAlt = item.oeAlt || item.OE_ALT || '';

    const adicao = item.adicao || item.ADICAO || '';
    const unidade = item.unidade || item.selectedCity || item.CIDADE || item.LOJA || 'Cajati';

    const hasDioptria = odEsf || odCil || oeEsf || oeCil || adicao;

    return (
      <div className="label-50x30 bg-white text-black font-sans leading-tight flex flex-col justify-between select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5">
          <span className="font-black text-[9px] tracking-tight uppercase">{storeName}</span>
          <span className="font-black text-[9px] bg-black text-white px-1 rounded-sm uppercase">
            OS #{osNum}
          </span>
        </div>

        {/* Cliente */}
        <div className="truncate text-[8.5px] font-bold">
          <span className="font-normal text-[7px] text-gray-700">Cli: </span>
          {client}
        </div>

        {/* Armação & Lente */}
        {(armacao || lente) && (
          <div className="truncate text-[7.5px] text-gray-900 leading-none">
            {armacao && <span className="font-semibold">Arm: {armacao} </span>}
            {lente && <span>| Lnt: {lente}</span>}
          </div>
        )}

        {/* Dioptrias / Graus */}
        {hasDioptria ? (
          <div className="bg-gray-100 p-0.5 rounded text-[6.5px] font-mono leading-none border border-gray-300 my-0.5">
            <div className="flex justify-between">
              <span><strong>OD:</strong> {odEsf || '0.00'} {odCil ? `cil ${odCil}` : ''} {odEixo ? `eixo ${odEixo}°` : ''}</span>
              {(odDnp || odAlt) && <span>DNP:{odDnp} Alt:{odAlt}</span>}
            </div>
            <div className="flex justify-between">
              <span><strong>OE:</strong> {oeEsf || '0.00'} {oeCil ? `cil ${oeCil}` : ''} {oeEixo ? `eixo ${oeEixo}°` : ''}</span>
              {adicao && <span className="font-bold text-black">Ad:+{adicao}</span>}
            </div>
          </div>
        ) : (
          <div className="text-[7.5px] text-gray-600 font-medium">
            Loja / Unidade: {unidade} {entrega ? `· Entr: ${entrega}` : ''}
          </div>
        )}

        {/* Código de Barras da OS */}
        <div className="mt-auto pt-0.5 flex flex-col items-center">
          <div className="w-full px-1">
            <BarcodeSVG value={`OS${osNum}`} height={16} />
          </div>
          <div className="flex justify-between w-full text-[6.5px] font-mono text-gray-700 px-0.5 mt-0.5">
            <span>OS #{osNum}</span>
            {entrega && <span>Ent: {entrega}</span>}
          </div>
        </div>
      </div>
    );
  }

  // Modo: Armação / Produto / Geral
  const brand = item.MARCA || item.marca || item.brand || 'ÓTICA';
  const model = item.NOME || item.nome || item.MODELO || item.modelo || item.PRODUTO || item.produto || item.DESCRICAO || 'Produto';
  const sku = item.REFERENCIA_SKU || item.referencia_sku || item.CODIGO || item.codigo || item.SKU || item.sku || `SKU-${Date.now().toString().slice(-6)}`;
  const color = item.COR || item.cor || '';
  const size = item.TAMANHO || item.tamanho || '';
  const unit = item.UNIDADE || item.unidade || item.CIDADE || item.cidade || '';
  const rawPrice = item.PRECO_VENDA || item.preco_venda || item.VALOR || item.valor || item.preco || 0;
  const price = fmtMoney(rawPrice);

  return (
    <div className="label-50x30 bg-white text-black font-sans leading-tight flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-black pb-0.5">
        <span className="font-black text-[9px] tracking-wider uppercase">{storeName}</span>
        {unit && <span className="text-[7px] font-bold text-gray-700 uppercase">{unit}</span>}
      </div>

      {/* Marca e Modelo */}
      <div className="my-0.5">
        <div className="font-black text-[9.5px] uppercase truncate tracking-tight text-black">
          {brand} {model}
        </div>
        <div className="text-[7.5px] text-gray-800 flex items-center gap-1 truncate font-medium">
          {color && <span>Cor: {color}</span>}
          {size && <span>| Tam: {size}</span>}
          {sku && <span>| Ref: {sku}</span>}
        </div>
      </div>

      {/* Código de barras */}
      <div className="w-full px-1 my-0.5 flex flex-col items-center">
        <BarcodeSVG value={sku} height={18} />
        <span className="text-[7px] font-mono font-bold tracking-wider text-black mt-0.5">
          {sku}
        </span>
      </div>

      {/* Preço de Venda em Destaque */}
      <div className="flex items-center justify-between border-t border-black pt-0.5 mt-auto">
        <span className="text-[7px] font-bold uppercase text-gray-600">À Vista / Parcela</span>
        <span className="text-[12px] font-black tracking-tight text-black">
          R$ {price}
        </span>
      </div>
    </div>
  );
};

/**
 * Seção de impressão global oculta na tela e visível no print
 */
export const PrintableLabelSection = ({ labelData, labelType = 'haste_oculos', copies = 1 }) => {
  if (!labelData) return null;
  const itemsList = Array.isArray(labelData)
    ? labelData
    : (labelData.multiItems || labelData.items || [labelData]);

  return (
    <div id="print-label-section" className="hidden print:block">
      {itemsList.flatMap((singleItem, sIdx) =>
        Array.from({ length: copies }).map((_, idx) => (
          <div key={`${sIdx}-${idx}`} className="print-label-item mb-2">
            {labelType === 'haste_oculos' || labelType === 'haste_joia' ? (
              <SingleLabelGlassesJewelry item={singleItem} />
            ) : (
              <SingleLabel50x30 item={singleItem} type={labelType} />
            )}
          </div>
        ))
      )}
    </div>
  );
};

/**
 * Modal Interativo de Impressão de Etiquetas para Óculos, Joias e Envelopes
 */
export const PrintableLabelModal = ({ isOpen, onClose, data, defaultType = 'haste_oculos' }) => {
  const itemsList = Array.isArray(data) ? data : (data?.multiItems || data?.items || [data]);
  const previewItem = itemsList[0] || data;
  const isMulti = itemsList.length > 1;

  const isOSData = Boolean(
    previewItem?.numeroOS || previewItem?.osNumber || previewItem?.OS || previewItem?.['OS DA VENDA'] || previewItem?.['OS da COMPRA'] || previewItem?.['VENDA_OS']
  );
  const initialType = isOSData ? (defaultType === 'envelope_lab' ? 'envelope_lab' : 'haste_oculos') : 'haste_oculos';
  
  const [labelType, setLabelType] = useState(initialType);
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !data) return null;

  const handleTriggerPrint = () => {
    setIsPrinting(true);
    document.body.classList.add('printing-label');

    const handleAfter = () => {
      document.body.classList.remove('printing-label');
      setIsPrinting(false);
      window.removeEventListener('afterprint', handleAfter);
    };

    window.addEventListener('afterprint', handleAfter);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-label');
        setIsPrinting(false);
      }, 1500);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Glasses size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                Etiqueta Térmica para Óculos &amp; Joias
                <span className="px-2 py-0.5 text-[9px] bg-amber-500/20 text-amber-300 font-bold rounded-full border border-amber-500/30">
                  Formato Ótica
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">
                Dupla face borboleta para hastes de armações, anéis, joias e envelopes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Seletor de Formato de Etiqueta */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
              Selecione o Formato da Etiqueta:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLabelType('haste_oculos')}
                className={`p-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center text-center gap-1 border ${
                  labelType === 'haste_oculos' || labelType === 'haste_joia'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                <Glasses size={18} />
                <span>Borboleta (Haste / Joia)</span>
              </button>

              <button
                type="button"
                onClick={() => setLabelType('armacao')}
                className={`p-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center text-center gap-1 border ${
                  labelType === 'armacao'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                <Tag size={18} />
                <span>Adesiva (50x30mm)</span>
              </button>

              {isOSData ? (
                <button
                  type="button"
                  onClick={() => setLabelType('envelope_lab')}
                  className={`p-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center text-center gap-1 border col-span-2 sm:col-span-1 ${
                    labelType === 'envelope_lab'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  <FileText size={18} />
                  <span>Envelope Lab (OS)</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Prévia Visual da Etiqueta Selecionada */}
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                Prévia Visual em Escala Real
              </span>
              <span className="text-[10px] text-amber-400 font-bold">
                {labelType === 'haste_oculos' || labelType === 'haste_joia' ? 'Formato Borboleta Dupla Face' : (labelType === 'envelope_lab' ? 'Envelope OS 50x30mm' : 'Adesiva Geral 50x30mm')}
              </span>
            </div>

            {isMulti && (
              <div className="w-full mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between">
                <span>🏷️ Impressão Conjunta: {itemsList.length} etiquetas vinculadas</span>
                <span className="font-mono text-[10px]">({itemsList.map(i => i.numeroOS || i.osNumber || i.OS).filter(Boolean).join(', ')})</span>
              </div>
            )}

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner flex items-center justify-center w-full min-h-[140px] overflow-x-auto">
              {labelType === 'haste_oculos' || labelType === 'haste_joia' ? (
                <div className="w-full max-w-[430px] flex items-center justify-center">
                  <SingleLabelGlassesJewelry item={previewItem} />
                </div>
              ) : (
                <div className="w-[220px] h-[130px] bg-white text-black rounded-lg p-2 shadow-2xl border border-slate-400 overflow-hidden flex flex-col justify-between">
                  <SingleLabel50x30 item={previewItem} type={labelType} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 text-center">
              <Scissors size={12} className="text-amber-400" />
              <span>
                {labelType === 'haste_oculos' || labelType === 'haste_joia'
                  ? 'Padrão Argox OS-214 Plus / Zebra: A cauda lateral fina laça a haste do óculos / anel, e o corpo dobra unindo Código de Barras + Marca/Preço.'
                  : 'Compatível com impressoras Zebra, Argox, Elgin, Xprinter e rolos térmicos adesivos.'}
              </span>
            </div>
          </div>

          {/* Quantidade de Cópias */}
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-slate-200 uppercase block">Quantidade de Cópias</span>
              <span className="text-[10px] text-slate-400">Total de etiquetas que serão impressas</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setCopies(c => Math.max(1, c - 1))}
                className="w-7 h-7 rounded-lg bg-slate-800 text-white font-black hover:bg-slate-700 flex items-center justify-center"
              >
                -
              </button>
              <span className="w-8 text-center font-black text-sm text-amber-400">{copies}</span>
              <button
                type="button"
                onClick={() => setCopies(c => Math.min(50, c + 1))}
                className="w-7 h-7 rounded-lg bg-slate-800 text-white font-black hover:bg-slate-700 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition-all"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleTriggerPrint}
            disabled={isPrinting}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Printer size={16} />
            <span>{isPrinting ? 'Enviando para Impressora...' : `Imprimir ${copies > 1 ? `(${copies} etiquetas)` : 'Etiqueta'}`}</span>
          </button>
        </div>

      </div>

      {/* Seção Oculta de Impressão */}
      <PrintableLabelSection labelData={data} labelType={labelType} copies={copies} />
    </div>
  );
};

export default PrintableLabelModal;
