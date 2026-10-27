import React from 'react';

const formatCPF_CNPJ = (val) => {
  if (!val) return 'Não informado';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return String(val);
};

const formatRG = (val) => {
  if (!val) return 'Não informado';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 9) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
  }
  return String(val);
};

const formatDate = (val) => {
  if (!val) return 'Não informada';
  if (String(val).includes('/')) return String(val);
  const parts = String(val).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(val);
};

const calculateAge = (birthDateStr) => {
  if (!birthDateStr) return '';
  let d = null;
  if (birthDateStr.includes('/')) {
    const [day, month, year] = birthDateStr.split('/');
    d = new Date(`${year}-${month}-${day}`);
  } else if (birthDateStr.includes('-')) {
    d = new Date(birthDateStr);
  }
  if (!d || isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const ageDate = new Date(diff);
  const age = Math.abs(ageDate.getUTCFullYear() - 1970);
  return isNaN(age) ? '' : ` (${age} anos)`;
};

const formatMoney = (val) => {
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
 * 📄 PrintableClientProfile
 * Componente oficial de impressão em folha única A4 contendo
 * todas as informações pessoais do cliente e do responsável legal.
 */
export const PrintableClientProfile = ({ clientData = {}, storeName = 'YASMIN ÓTICA' }) => {
  if (!clientData) return null;

  // ─── 1. DADOS DO CLIENTE TITULAR ──────────────────────────────
  const clientName = clientData['Nome Completo'] || clientData['NOME'] || clientData['CLIENTE'] || clientData['Nome'] || 'Cliente Não Informado';
  const clientCpf = formatCPF_CNPJ(clientData['CPF / CNPJ'] || clientData['CPF'] || clientData['CNPJ']);
  const clientRg = formatRG(clientData['RG'] || clientData['rg']);
  const rawBirth = clientData['Data de Nascimento'] || clientData['DATA NASCIMENTO'] || clientData['Dt. Nasc.'] || '';
  const clientBirth = formatDate(rawBirth) + calculateAge(rawBirth);
  const clientZap = clientData['WhatsApp'] || clientData['TELEFONE'] || clientData['TELEFONE CLIENTE'] || clientData['Celular'] || 'Não informado';
  const clientEmail = clientData['E-mail'] || clientData['EMAIL'] || clientData['Email'] || 'Não informado';

  const rua = clientData['Rua'] || clientData['RUA'] || clientData['ENDEREÇO'] || '';
  const num = clientData['Número'] || clientData['NUMERO'] || clientData['Nº'] || '';
  const bairro = clientData['Bairro'] || clientData['BAIRRO'] || '';
  const cidade = clientData['Cidade'] || clientData['CIDADE'] || clientData['UNIDADE'] || 'Cajati';
  const estado = clientData['Estado'] || clientData['ESTADO'] || clientData['UF'] || 'SP';
  const cep = clientData['CEP'] || clientData['cep'] || '';

  const clientAddress = [
    rua ? `${rua}${num ? `, nº ${num}` : ', S/N'}` : null,
    bairro ? `Bairro: ${bairro}` : null,
    cidade ? `${cidade}/${estado}` : null,
    cep ? `CEP: ${cep}` : null
  ].filter(Boolean).join(' • ') || 'Endereço não informado';

  const clientInsta = clientData['Instagram'] || clientData['INSTAGRAM'] || '';
  const clientFace = clientData['Facebook'] || clientData['FACEBOOK'] || '';
  const clientTikTok = clientData['TikTok'] || clientData['TIKTOK'] || '';

  const clientRef1Name = clientData['Nome Referência 1'] || clientData['Nome Ref. 1'] || clientData['NOME_REF_1'] || '';
  const clientRef1Tel = clientData['Referência 1'] || clientData['REFERENCIA 1'] || '';
  const clientRef1Parent = clientData['Parentesco Ref. 1'] || clientData['PARENTESCO REF. 1'] || '';

  const clientRef2Name = clientData['Nome Referência 2'] || clientData['Nome Ref. 2'] || clientData['NOME_REF_2'] || '';
  const clientRef2Tel = clientData['Referência 2'] || clientData['REFERENCIA 2'] || '';
  const clientRef2Parent = clientData['Parentesco Ref. 2'] || clientData['PARENTESCO REF. 2'] || '';

  // ─── 2. DADOS DO RESPONSÁVEL LEGAL ────────────────────────────
  const respName = clientData['Responsável Nome'] || clientData['Responsável'] || clientData['RESPONSAVEL'] || '';
  const hasResponsavel = Boolean(respName && respName.trim().length > 0 && respName.toLowerCase() !== 'não' && respName.toLowerCase() !== 'nao');

  const respCpf = formatCPF_CNPJ(clientData['Responsável CPF'] || clientData['RESPONSAVEL_CPF']);
  const respRg = formatRG(clientData['Responsável RG'] || clientData['RESPONSAVEL_RG']);
  const rawRespBirth = clientData['Responsável Data de Nascimento'] || clientData['RESPONSAVEL_DATA_NASC'] || '';
  const respBirth = formatDate(rawRespBirth) + calculateAge(rawRespBirth);
  const respZap = clientData['Responsável WhatsApp'] || clientData['RESPONSAVEL_WHATSAPP'] || 'Não informado';

  const respRua = clientData['Responsável Rua'] || clientData['RESPONSAVEL_RUA'] || '';
  const respNum = clientData['Responsável Número'] || clientData['RESPONSAVEL_NUMERO'] || '';
  const respBairro = clientData['Responsável Bairro'] || clientData['RESPONSAVEL_BAIRRO'] || '';
  const respCidade = clientData['Responsável Cidade'] || clientData['RESPONSAVEL_CIDADE'] || '';
  const respEstado = clientData['Responsável Estado'] || clientData['RESPONSAVEL_ESTADO'] || '';
  const respCep = clientData['Responsável CEP'] || clientData['RESPONSAVEL_CEP'] || '';

  const respAddress = hasResponsavel && respRua ? [
    respRua ? `${respRua}${respNum ? `, nº ${respNum}` : ', S/N'}` : null,
    respBairro ? `Bairro: ${respBairro}` : null,
    respCidade ? `${respCidade}/${respEstado || 'SP'}` : null,
    respCep ? `CEP: ${respCep}` : null
  ].filter(Boolean).join(' • ') : (hasResponsavel ? 'Mesmo endereço do titular' : null);

  const respRef1Name = clientData['Responsável Nome Referência 1'] || clientData['RESPONSAVEL_NOME_REF_1'] || '';
  const respRef1Tel = clientData['Responsável Referência 1'] || '';
  const respRef1Parent = clientData['Responsável Parentesco Ref. 1'] || '';

  const respRef2Name = clientData['Responsável Nome Referência 2'] || clientData['RESPONSAVEL_NOME_REF_2'] || '';
  const respRef2Tel = clientData['Responsável Referência 2'] || '';
  const respRef2Parent = clientData['Responsável Parentesco Ref. 2'] || '';

  // ─── 3. SITUAÇÃO FINANCEIRA & HISTÓRICO ÓPTICO ─────────────────
  const statusPag = clientData['Status de Pagamento'] || clientData['STATUS'] || 'Em dia';
  const saldoDev = formatMoney(clientData['Valor Devido'] || clientData['VALOR DEVIDO'] || 0);
  const dtVenc = clientData['Data de Vencimento'] || clientData['DATA VENCIMENTO'] || '—';
  const armacaoPref = clientData['Modelo de Armação'] || clientData['ARMAÇÃO'] || '—';
  const lentePref = clientData['Marca de Lente'] || clientData['LENTE'] || '—';

  // ─── 4. AUDITORIA DE ANEXOS ───────────────────────────────────
  const hasDocCliente = Boolean(clientData['Foto Documento Cliente'] || clientData['fotoDocumentoCliente']);
  const hasCompCliente = Boolean(clientData['Foto Comprovante Residência Cliente'] || clientData['fotoComprovanteResidenciaCliente']);
  const hasDocResp = Boolean(clientData['Foto Documento Responsável'] || clientData['fotoDocumentoResponsavel']);
  const hasCompResp = Boolean(clientData['Foto Comprovante Residência Responsável'] || clientData['fotoComprovanteResidenciaResponsavel']);

  const printDateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 8mm 10mm !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-client-profile, #print-client-profile * {
            visibility: visible !important;
          }
          #print-client-profile {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 195mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      <div
        id="print-client-profile"
        className="hidden print:block bg-white text-slate-900 font-sans text-[9px] leading-tight select-none p-2"
      >
        {/* ─── CABEÇALHO DA EMPRESA & DOCUMENTO ─── */}
        <div className="border-2 border-black p-2.5 rounded-t-lg bg-slate-50 flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black text-white font-black text-lg flex items-center justify-center rounded-lg tracking-tighter shrink-0 border border-black">
              YO
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-tight text-black m-0 leading-tight">
                {storeName} · ÓTICA &amp; RELOJOARIA
              </h1>
              <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest mt-0.5">
                Ficha Cadastral do Cliente &amp; Responsável Legal
              </p>
              <p className="text-[7.5px] text-gray-600 mt-0.5">
                Unidade / Loja: <strong>{cidade || 'Central'}</strong> · Emissão: <strong>{printDateStr}</strong>
              </p>
            </div>
          </div>

          <div className="text-right border-l border-black/20 pl-3">
            <span className="inline-block px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase tracking-wider rounded">
              Cadastro #{clientData.id ? String(clientData.id).slice(-6) : 'S/N'}
            </span>
            <div className="text-[8px] font-bold text-gray-700 mt-1">
              Situação: <strong className={statusPag === 'Em dia' ? 'text-black' : 'text-gray-900'}>{statusPag.toUpperCase()}</strong>
            </div>
          </div>
        </div>

        {/* ─── QUADRO 1: DADOS PESSOAIS DO CLIENTE (TITULAR) ─── */}
        <div className="border border-black rounded-lg p-2.5 mb-2 bg-white">
          <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
            <h2 className="text-[9.5px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <span>👤 1. DADOS PESSOAIS DO CLIENTE (TITULAR DA CONTA)</span>
            </h2>
            <span className="text-[7.5px] font-mono font-bold bg-gray-100 border border-gray-400 px-1.5 py-0.2 rounded">
              DOCUMENTO OFICIAL
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[8.5px] mb-2">
            <div className="col-span-2">
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Nome Completo:</span>
              <span className="font-black text-[10px] text-black tracking-tight">{clientName}</span>
            </div>
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">CPF / CNPJ:</span>
              <span className="font-mono font-bold text-black">{clientCpf}</span>
            </div>
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Documento RG:</span>
              <span className="font-mono font-bold text-black">{clientRg}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[8.5px] mb-2 border-t border-gray-200 pt-1.5">
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Data de Nascimento:</span>
              <span className="font-semibold text-black">{clientBirth}</span>
            </div>
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">WhatsApp / Telefone:</span>
              <span className="font-bold text-black">{clientZap}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">E-mail:</span>
              <span className="font-medium text-black truncate">{clientEmail}</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-1.5 mb-2 text-[8.5px]">
            <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Endereço Residencial Completo:</span>
            <span className="font-semibold text-black">{clientAddress}</span>
          </div>

          {/* Redes Sociais do Cliente */}
          {(clientInsta || clientFace || clientTikTok) && (
            <div className="border-t border-gray-200 pt-1 mb-2 text-[8px] flex items-center gap-3 text-gray-700">
              <span className="font-bold uppercase text-[7.5px] text-gray-600">Redes Sociais:</span>
              {clientInsta && <span>Instagram: <strong>{clientInsta}</strong></span>}
              {clientFace && <span>Facebook: <strong>{clientFace}</strong></span>}
              {clientTikTok && <span>TikTok: <strong>{clientTikTok}</strong></span>}
            </div>
          )}

          {/* Referências Pessoais do Cliente */}
          {(clientRef1Name || clientRef1Tel || clientRef2Name || clientRef2Tel) && (
            <div className="border-t border-gray-300 pt-1.5 mt-1 bg-gray-50/80 -mx-2.5 -mb-2.5 p-2 rounded-b-lg">
              <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 block mb-1">
                📞 Contatos de Referência Pessoal (Cliente):
              </span>
              <div className="grid grid-cols-2 gap-2 text-[8px]">
                {clientRef1Name && (
                  <div className="border border-gray-300 rounded p-1 bg-white">
                    <span className="text-gray-500 font-bold block text-[7px]">REFERÊNCIA 1:</span>
                    <strong className="text-black">{clientRef1Name}</strong>
                    <div className="text-gray-700">Tel: {clientRef1Tel || '—'} {clientRef1Parent ? `(${clientRef1Parent})` : ''}</div>
                  </div>
                )}
                {clientRef2Name && (
                  <div className="border border-gray-300 rounded p-1 bg-white">
                    <span className="text-gray-500 font-bold block text-[7px]">REFERÊNCIA 2:</span>
                    <strong className="text-black">{clientRef2Name}</strong>
                    <div className="text-gray-700">Tel: {clientRef2Tel || '—'} {clientRef2Parent ? `(${clientRef2Parent})` : ''}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── QUADRO 2: DADOS DO RESPONSÁVEL LEGAL / TUTOR / FIADOR ─── */}
        <div className={`border rounded-lg p-2.5 mb-2 ${hasResponsavel ? 'border-black bg-white' : 'border-gray-300 bg-gray-50'}`}>
          <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
            <h2 className="text-[9.5px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <span>👥 2. DADOS DO RESPONSÁVEL LEGAL / TUTOR / FIADOR</span>
            </h2>
            <span className={`text-[7.5px] font-bold px-1.5 py-0.2 rounded border ${hasResponsavel ? 'bg-black text-white border-black font-black' : 'bg-gray-200 text-gray-700 border-gray-400'}`}>
              {hasResponsavel ? 'RESPONSÁVEL VINCULADO' : 'NÃO VINCULADO'}
            </span>
          </div>

          {hasResponsavel ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-[8.5px] mb-2">
                <div className="col-span-2">
                  <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Nome Completo do Responsável:</span>
                  <span className="font-black text-[10px] text-black tracking-tight">{respName}</span>
                </div>
                <div>
                  <span className="text-gray-600 block text-[7.5px] uppercase font-bold">CPF do Responsável:</span>
                  <span className="font-mono font-bold text-black">{respCpf}</span>
                </div>
                <div>
                  <span className="text-gray-600 block text-[7.5px] uppercase font-bold">RG do Responsável:</span>
                  <span className="font-mono font-bold text-black">{respRg}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-[8.5px] mb-2 border-t border-gray-200 pt-1.5">
                <div>
                  <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Data de Nascimento:</span>
                  <span className="font-semibold text-black">{respBirth}</span>
                </div>
                <div>
                  <span className="text-gray-600 block text-[7.5px] uppercase font-bold">WhatsApp / Telefone:</span>
                  <span className="font-bold text-black">{respZap}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Endereço Residencial:</span>
                  <span className="font-semibold text-black truncate">{respAddress}</span>
                </div>
              </div>

              {/* Referências do Responsável */}
              {(respRef1Name || respRef1Tel || respRef2Name || respRef2Tel) && (
                <div className="border-t border-gray-300 pt-1.5 mt-1 bg-gray-50/80 -mx-2.5 -mb-2.5 p-2 rounded-b-lg">
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-gray-800 block mb-1">
                    📞 Contatos de Referência (Responsável):
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[8px]">
                    {respRef1Name && (
                      <div className="border border-gray-300 rounded p-1 bg-white">
                        <span className="text-gray-500 font-bold block text-[7px]">REF. 1 RESPONSÁVEL:</span>
                        <strong className="text-black">{respRef1Name}</strong>
                        <div className="text-gray-700">Tel: {respRef1Tel || '—'} {respRef1Parent ? `(${respRef1Parent})` : ''}</div>
                      </div>
                    )}
                    {respRef2Name && (
                      <div className="border border-gray-300 rounded p-1 bg-white">
                        <span className="text-gray-500 font-bold block text-[7px]">REF. 2 RESPONSÁVEL:</span>
                        <strong className="text-black">{respRef2Name}</strong>
                        <div className="text-gray-700">Tel: {respRef2Tel || '—'} {respRef2Parent ? `(${respRef2Parent})` : ''}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-2 px-3 text-center text-gray-600 text-[8px] italic">
              O titular acima é maior de idade e assume responsabilidade integral e exclusiva sobre as transações e o crediário.
            </div>
          )}
        </div>

        {/* ─── QUADRO 3: SITUAÇÃO FINANCEIRA & HISTÓRICO ÓPTICO ─── */}
        <div className="border border-black rounded-lg p-2.5 mb-2 bg-white">
          <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
            <h2 className="text-[9.5px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <span>💳 3. SITUAÇÃO FINANCEIRA &amp; HISTÓRICO ÓPTICO CADASTRADO</span>
            </h2>
            <span className="text-[7.5px] font-bold text-gray-700 uppercase">
              Controle Interno ERP
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[8.5px]">
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Status de Pagamento:</span>
              <span className="font-black text-black">{statusPag}</span>
            </div>
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Saldo Devedor Atual:</span>
              <span className="font-mono font-black text-black">R$ {saldoDev}</span>
            </div>
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Dia Vencimento Habitual:</span>
              <span className="font-semibold text-black">{dtVenc}</span>
            </div>
            <div>
              <span className="text-gray-600 block text-[7.5px] uppercase font-bold">Armação / Lente Vinculada:</span>
              <span className="font-medium text-black truncate">{armacaoPref} / {lentePref}</span>
            </div>
          </div>
        </div>

        {/* ─── QUADRO 4: CHECKLIST DE AUDITORIA DOCUMENTAL ─── */}
        <div className="border border-gray-400 rounded-lg p-2 mb-2 bg-gray-50/50">
          <div className="flex items-center justify-between text-[8px] font-bold text-gray-800">
            <span className="uppercase tracking-wider">📁 Auditoria de Documentos Físicos / Digitais Anexados:</span>
            <div className="flex items-center gap-3 font-semibold">
              <span>[{hasDocCliente ? 'X' : ' '}] Doc. com Foto Titular</span>
              <span>[{hasCompCliente ? 'X' : ' '}] Comp. Residência Titular</span>
              <span>[{hasDocResp ? 'X' : ' '}] Doc. com Foto Responsável</span>
              <span>[{hasCompResp ? 'X' : ' '}] Comp. Residência Responsável</span>
            </div>
          </div>
        </div>

        {/* ─── QUADRO 5: DECLARAÇÃO DE VERACIDADE & ASSINATURAS ─── */}
        <div className="border-2 border-black rounded-lg p-2.5 bg-white">
          <p className="text-[7.5px] text-gray-700 leading-tight text-justify mb-4">
            Declaro para todos os fins legais que as informações cadastrais, de endereço, pessoais e de contato acima descritas são autênticas e verdadeiras, assumindo total responsabilidade civil e contratual por sua exatidão. Autorizo a <strong>{storeName}</strong> a manter o registro sob sigilo e utilizá-lo estritamente para fins de abertura de crediário, emissão de ordens de serviço, assistência óptica e comunicações comerciais.
          </p>

          <div className="grid grid-cols-2 gap-6 pt-3 text-center">
            {/* Assinatura do Cliente / Titular */}
            <div>
              <div className="border-b border-black w-4/5 mx-auto mb-1" />
              <p className="font-bold text-[8.5px] uppercase text-black">{clientName}</p>
              <p className="text-[7px] text-gray-600">Assinatura do Cliente (Titular)</p>
            </div>

            {/* Assinatura do Responsável ou Visto da Loja */}
            <div>
              <div className="border-b border-black w-4/5 mx-auto mb-1" />
              {hasResponsavel ? (
                <>
                  <p className="font-bold text-[8.5px] uppercase text-black">{respName}</p>
                  <p className="text-[7px] text-gray-600">Assinatura do Responsável Legal / Tutor</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-[8.5px] uppercase text-black">{storeName}</p>
                  <p className="text-[7px] text-gray-600">Atendente / Responsável Técnico pela Ótica</p>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center text-[7px] text-gray-500 border-t border-gray-200 mt-3 pt-1">
            <span>{cidade || 'Cajati'} - SP, ______ de _________________ de 2026.</span>
            <span>Documento emitido pelo Sistema Integrado Yasmin Ótica v1.6</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrintableClientProfile;
