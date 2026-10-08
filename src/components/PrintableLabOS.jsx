import React from 'react';

const formatCurrencyPrint = (val) => {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    return isNaN(val) ? '' : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return '';
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? '' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SingleLabSheet = ({ osData, clientData = {}, isMulti = false, index = 1, total = 1 }) => {
  if (!osData) return null;

  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  const otica = osData.unidade || osData.unit || clientData['Cidade'] || '';
  const lente = osData.lente || clientData['Lente'] || clientData['Marca de Lente'] || '';
  const laboratorio = osData.laboratorio || clientData['Laboratório'] || '';
  const valorEntrada = formatCurrencyPrint(osData.valorEntrada);
  const formaPgto = osData.formasPagamento ? String(osData.formasPagamento).replace(/(?:FORMA DE PAGAMENTO|FORMA_PAGTO|FORMA_PAGAMENTO|MEIO_PAGAMENTO)\s*:\s*/gi, '').split('\n')[0].trim() : '';
  const tipoArmacao = osData.armacao || clientData['Modelo de Armação'] || '';

  return (
    <div className="single-lab-sheet-wrapper bg-white text-slate-900 font-sans text-xs leading-tight select-none w-full max-w-[196mm] mx-auto pb-4">
      {/* HEADER COMPACTO */}
      <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img 
            src="/logo-yasmin.png" 
            alt="Yasmin Ótica" 
            className="h-14 max-w-[150px] object-contain" 
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/logo-yasmin-transparent.png";
            }}
          />
          <div className="border-l-2 border-slate-900 pl-3">
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900 leading-none">Laboratório</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mt-1">Ordem de Serviço Óptica</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="inline-block bg-slate-950 text-white px-3 py-1 rounded font-black text-sm uppercase tracking-wide">
            OS Nº {osData.numeroOS || '---'}{isMulti ? ` (${index}/${total})` : ''}
          </div>
            <p className="text-xs font-bold mt-1 text-slate-700">
              Data: {dataAtual}
            </p>
          </div>
        </div>

        {/* INFO BASIC */}
        <div className="mb-6 grid grid-cols-3 gap-4 border border-slate-300 rounded p-4 bg-slate-50/50 text-sm">
          <div><strong className="text-slate-600">Ótica:</strong> <span className="font-bold text-slate-900">{otica}</span></div>
          <div><strong className="text-slate-600">Lente:</strong> <span className="font-bold text-slate-900 uppercase">{lente}</span></div>
          <div><strong className="text-slate-600">Lab:</strong> <span className="font-bold text-slate-900">{laboratorio}</span></div>
        </div>

        {/* PRESCRIPTION TABLE */}
        <div className="mb-6 border border-slate-300 rounded p-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Prescrição / Medidas
            </h3>
          </div>
          <table className="w-full text-center border-collapse border border-slate-400 text-xs mb-4">
            <thead>
              <tr className="bg-slate-100 font-black uppercase text-slate-800 text-[10px]">
                <th className="border border-slate-400 py-2 px-2 w-20">Distância</th>
                <th className="border border-slate-400 py-2 px-2 w-12">Olho</th>
                <th className="border border-slate-400 py-2 px-2">Esférico</th>
                <th className="border border-slate-400 py-2 px-2">Cilíndrico</th>
                <th className="border border-slate-400 py-2 px-2">Eixo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="border border-slate-400 py-2 px-2 font-black text-left text-slate-900" rowSpan={2}>LONGE</td>
                <td className="border border-slate-400 py-2 px-2 font-black text-slate-900">OD</td>
                <td className="border border-slate-400 py-2 px-2 font-bold text-slate-900 text-sm">{osData.odEsf || '---'}</td>
                <td className="border border-slate-400 py-2 px-2 font-bold text-slate-900 text-sm">{osData.odCil || '---'}</td>
                <td className="border border-slate-400 py-2 px-2 font-bold text-slate-900 text-sm">{osData.odEixo || '---'}</td>
              </tr>
              <tr className="bg-slate-50/70">
                <td className="border border-slate-400 py-2 px-2 font-black text-slate-900">OE</td>
                <td className="border border-slate-400 py-2 px-2 font-bold text-slate-900 text-sm">{osData.oeEsf || '---'}</td>
                <td className="border border-slate-400 py-2 px-2 font-bold text-slate-900 text-sm">{osData.oeCil || '---'}</td>
                <td className="border border-slate-400 py-2 px-2 font-bold text-slate-900 text-sm">{osData.oeEixo || '---'}</td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-400 py-2 px-2 font-black text-left text-slate-900" rowSpan={2}>PERTO</td>
                <td className="border border-slate-400 py-2 px-2 font-black text-slate-900">OD</td>
                <td className="border border-slate-400 py-2 px-2"></td>
                <td className="border border-slate-400 py-2 px-2"></td>
                <td className="border border-slate-400 py-2 px-2"></td>
              </tr>
              <tr className="bg-slate-50/70">
                <td className="border border-slate-400 py-2 px-2 font-black text-slate-900">OE</td>
                <td className="border border-slate-400 py-2 px-2"></td>
                <td className="border border-slate-400 py-2 px-2"></td>
                <td className="border border-slate-400 py-2 px-2"></td>
              </tr>
            </tbody>
          </table>

          {/* AD, DNP, ALTURA DE MONTAGEM, TIPO DE ARMAÇÃO */}
          <table className="w-full text-center border-collapse border border-slate-400 text-xs">
            <tbody>
              <tr>
                <td className="border border-slate-400 py-3 px-3 text-left bg-slate-50 w-24" rowSpan={2}>
                  <div className="font-black text-[10px] text-slate-600 uppercase">AD</div>
                  <div className="text-center font-black text-xl mt-1 text-slate-900">{osData.adicao || '---'}</div>
                </td>
                <td className="border border-slate-400 py-2 px-2 bg-slate-50 text-[10px] font-black uppercase text-slate-600 w-28" rowSpan={2}>
                  Altura de<br/>Montagem
                </td>
                <td className="border border-slate-400 py-2 px-3 font-bold text-slate-900 text-sm">OD: {osData.odAlt || '---'}</td>
                <td className="border border-slate-400 py-2 px-3 text-left bg-slate-50 w-16" rowSpan={2}>
                  <div className="font-black text-[10px] text-slate-600 uppercase">DNP</div>
                </td>
                <td className="border border-slate-400 py-2 px-3 font-bold text-slate-900 text-sm">OD: {osData.odDnp || '---'}</td>
                <td className="border border-slate-400 py-3 px-3 bg-slate-50 text-center w-32" rowSpan={2}>
                  <div className="font-black text-[10px] text-slate-600 uppercase">Tipo de Armação</div>
                  <div className="font-black text-xs mt-1 uppercase text-slate-900">{tipoArmacao || '---'}</div>
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 py-2 px-3 font-bold text-slate-900 bg-slate-50/70 text-sm">OE: {osData.oeAlt || '---'}</td>
                <td className="border border-slate-400 py-2 px-3 font-bold text-slate-900 bg-slate-50/70 text-sm">OE: {osData.oeDnp || '---'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex gap-4 mb-4">
          {/* FRAME DATA */}
          <div className="w-1/2 border border-slate-300 rounded p-3 bg-slate-50/30">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2 mb-3">
              Dados da Armação
            </h3>
            <table className="w-full text-left border-collapse border border-slate-400 text-xs">
              <tbody>
                <tr className="bg-white">
                  <td className="border border-slate-400 py-2.5 px-3 font-bold text-slate-700">Ponte + Aro:</td>
                  <td className="border border-slate-400 py-2.5 px-3 font-black text-center text-slate-900 text-sm">{osData.raw?.PONTE_ARO || '---'}</td>
                </tr>
                <tr className="bg-slate-50/70">
                  <td className="border border-slate-400 py-2.5 px-3 font-bold text-slate-700">Diagonal Maior:</td>
                  <td className="border border-slate-400 py-2.5 px-3 font-black text-center text-slate-900 text-sm">{osData.raw?.DIAGONAL_MAIOR || '---'}</td>
                </tr>
                <tr className="bg-white">
                  <td className="border border-slate-400 py-2.5 px-3 font-bold text-slate-700">Altura Vertical:</td>
                  <td className="border border-slate-400 py-2.5 px-3 font-black text-center text-slate-900 text-sm">{osData.raw?.ALTURA_VERTICAL || '---'}</td>
                </tr>
                <tr className="bg-slate-50/70">
                  <td className="border border-slate-400 py-2.5 px-3 font-bold text-slate-700">Ponte:</td>
                  <td className="border border-slate-400 py-2.5 px-3 font-black text-center text-slate-900 text-sm">{osData.raw?.PONTE || '---'}</td>
                </tr>
                <tr className="bg-white">
                  <td className="border border-slate-400 py-2.5 px-3 font-bold text-slate-700">Aro:</td>
                  <td className="border border-slate-400 py-2.5 px-3 font-black text-center text-slate-900 text-sm">{osData.raw?.ARO || '---'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* OBSERVATIONS AND ARRIVAL */}
          <div className="w-1/2 border border-slate-300 rounded p-4 bg-slate-50/30 flex flex-col justify-between mb-4">
            <div className="mb-6">
              <div className="text-xs font-black text-slate-600 uppercase mb-3">Data que chegou o óculos</div>
              <div className="text-center font-bold text-base border-b border-slate-400 mx-8 h-6 mb-2"></div>
            </div>
            
            <div className="mt-2">
              <span className="text-xs font-black text-slate-600 uppercase">Obs.:</span>
              <div className="flex flex-col gap-8 mt-6">
                <div className="border-b border-slate-400 w-full"></div>
                <div className="border-b border-slate-400 w-full"></div>
                <div className="border-b border-slate-400 w-full"></div>
                <div className="border-b border-slate-400 w-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM FIELDS */}
        <div className="border border-slate-300 rounded p-4 bg-slate-50/50 mt-4">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="flex items-end">
              <span className="text-[10px] font-black uppercase text-slate-600 mr-2 whitespace-nowrap">Data da Consulta:</span>
              <div className="border-b border-slate-400 flex-1 h-4"></div>
            </div>
            <div className="flex items-end">
              <span className="text-[10px] font-black uppercase text-slate-600 mr-2 whitespace-nowrap">Valor da Entrada:</span>
              <span className="border-b border-slate-400 font-bold px-2 text-slate-900 flex-1 text-sm h-5">R$ {valorEntrada || '---'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="flex items-end">
              <span className="text-[10px] font-black uppercase text-slate-600 mr-2 whitespace-nowrap">Forma de Pagamento:</span>
              <span className="border-b border-slate-400 font-bold px-1 text-slate-900 flex-1 uppercase truncate text-xs h-4">{formaPgto || '---'}</span>
            </div>
            <div className="flex items-end">
              <span className="text-[10px] font-black uppercase text-slate-600 mr-2 whitespace-nowrap">O.S anterior de retificação:</span>
              <div className="border-b border-slate-400 flex-1 h-4"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-end">
              <span className="text-[10px] font-black uppercase text-slate-600 mr-2 whitespace-nowrap">Resp. pela Entrega:</span>
              <div className="border-b border-slate-400 flex-1 h-4"></div>
            </div>
            <div className="flex items-end">
              <span className="text-[10px] font-black uppercase text-slate-600 mr-2 whitespace-nowrap">Resp. pela Retirada:</span>
              <div className="border-b border-slate-400 flex-1 h-4"></div>
            </div>
          </div>
        </div>
        
      </div>
  );
};

const PrintableLabOS = ({ osData, clientData = {} }) => {
  if (!osData) return null;
  const list = (osData.multiOrders && Array.isArray(osData.multiOrders))
    ? osData.multiOrders
    : (Array.isArray(osData) ? osData : [osData]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: #ffffff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-section {
            display: block !important;
            width: 100% !important;
            max-width: 196mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .lab-sheet-page {
            page-break-after: always !important;
            break-after: page !important;
            padding-bottom: 4mm;
          }
          .lab-sheet-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .hide-on-lab-print {
            display: none !important;
          }
        }
      `}} />

      <div id="print-section" className="hidden print:block bg-white text-slate-900 font-sans text-xs leading-tight select-none w-full max-w-[196mm] mx-auto pb-4">
        {list.map((item, idx) => (
          <div key={idx} className={list.length > 1 ? "lab-sheet-page" : ""}>
            <SingleLabSheet
              osData={item}
              clientData={item.clientData || clientData}
              isMulti={list.length > 1}
              index={item.osIndex || (idx + 1)}
              total={item.totalOS || list.length}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default PrintableLabOS;

