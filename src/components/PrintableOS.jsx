import React, { useMemo } from 'react';

const parseCurrencyPrint = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).replace(/R\$\s?/g, '').trim();
  if (!str) return 0;
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const formatCurrencyPrint = (val) => {
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

const formatDatePrint = (dStr) => {
  if (!dStr) return 'Não definida';
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

const SingleOSSheet = ({ osData, clientData = {}, isMulti = false, index = 1, total = 1 }) => {
  if (!osData) return null;

  const isSecondary = Boolean(osData.isSecondaryOS || (isMulti && index > 1 && (osData.financeiroUnificado || parseCurrencyPrint(osData.valorTotal) === 0)));
  const saleDate = osData.dataVenda || osData['DATA  DA VENDA'] || osData['DATA DA VENDA'] || osData['DATA_VENDA'] || osData['Data da Venda'] || osData['DATA'] || osData['Data'] || clientData['DATA  DA VENDA'] || clientData['DATA'] || '';
  const saleTime = osData.hora || osData.HORA || clientData.hora || clientData.HORA || (typeof saleDate === 'string' && saleDate.includes(':') ? saleDate.split(/\s+/)[1] : (osData.DATA_HORA && typeof osData.DATA_HORA === 'string' && osData.DATA_HORA.includes(':') ? osData.DATA_HORA.split(/\s+/)[1] : ''));

  // ─── DADOS DO CLIENTE TITULAR ───────────────────────────────────
  const clientName = clientData['Nome Completo'] || clientData['NOME'] || clientData['CLIENTE'] || clientData['Nome'] || osData['nomeCliente'] || osData['CLIENTE'] || 'Cliente';
  const clientZap = clientData['WhatsApp'] || clientData['TELEFONE'] || clientData['Telefone'] || clientData['Celular'] || clientData['FONE'] || 'Não informado';
  const clientCpf = clientData['CPF / CNPJ'] || clientData['CPF'] || clientData['CNPJ'] || clientData['CLIENTE_CPF'] || 'Não informado';
  const clientRg = clientData['RG'] || clientData['rg'] || osData.rg || '';
  const clientNasc = clientData['Data de Nascimento'] || clientData['DATA_NASCIMENTO'] || clientData['Nascimento'] ? formatDatePrint(clientData['Data de Nascimento'] || clientData['DATA_NASCIMENTO'] || clientData['Nascimento']) : '';
  const clientEmail = clientData['E-mail'] || clientData['Email'] || clientData['EMAIL'] || '';
  const clientCep = clientData['CEP'] || clientData['Cep'] || clientData['cep'] || '';
  
  const rua = clientData['Rua'] || clientData['ENDERECO'] || clientData['Endereço'] || clientData['LOGRADOURO'] || '';
  const num = clientData['Número'] || clientData['NUMERO'] || clientData['Numero'] || '';
  const bairro = clientData['Bairro'] || clientData['BAIRRO'] || '';
  const cidade = clientData['Cidade'] || clientData['CIDADE'] || osData.unidade || osData.selectedCity || 'Cajati';
  const estado = clientData['Estado'] || clientData['ESTADO'] || clientData['UF'] || 'SP';
  
  const addressParts = [
    rua && num ? `${rua}, nº ${num}` : (rua || (num ? `Nº ${num}` : '')),
    bairro ? `Bairro ${bairro}` : '',
    `${cidade}/${estado}`,
    clientCep ? `CEP ${clientCep}` : ''
  ].filter(Boolean);
  const clientAddress = addressParts.length > 0 ? addressParts.join(' - ') : 'Não informado';

  // Responsável Legal (apenas se existir)
  const respName = clientData['Responsável Nome'] || clientData['Responsável'] || clientData['RESPONSAVEL'] || osData.responsavel;
  const respZap = clientData['Responsável WhatsApp'] || clientData['RESPONSAVEL_WHATSAPP'] || '';
  const respCpf = clientData['Responsável CPF'] || clientData['RESPONSAVEL_CPF'] || '';

  // Beneficiário / Paciente (quando for OS extra ou nominalmente diferente do titular)
  const beneficiaryName = String(
    osData.nomePessoa || 
    osData.PACIENTE || 
    osData.NOME_BENEFICIARIO || 
    osData.CLIENTE_BENEFICIARIO || 
    osData.beneficiario || 
    ''
  ).trim();

  // ─── PADRÃO DE ITENS DO PEDIDO (PRODUTOS & SERVIÇOS) ─────────────
  const orderItems = useMemo(() => {
    // 1. Se houver array de itens explícito vindo do PDV ou OS
    const rawItens = osData.itens || clientData.itens || (osData.raw && osData.raw.itens) || [];
    if (Array.isArray(rawItens) && rawItens.length > 0) {
      return rawItens.map(item => {
        let tipo = 'Produto';
        if (item.type === 'armacoes') tipo = 'Armação';
        else if (item.type === 'lentes') tipo = 'Lente Oftálmica';
        else if (item.type === 'brindes') tipo = 'Brinde / Cortesia';
        else if (item.type === 'avulso') tipo = 'Serviço / Avulso';

        const precoUnit = parseCurrencyPrint(item.preco || item.valor || 0);
        const qtd = Number(item.qtd) || 1;
        return {
          tipo,
          nome: item.nome || item.descricao || 'Produto do Pedido',
          detalhes: item.detalhes || '',
          qtd,
          precoUnit,
          total: qtd * precoUnit
        };
      });
    }

    // 2. Monta a partir dos campos estruturados de Armação e Lente
    const items = [];
    const armacaoNome = osData.armacao || clientData['Armação'] || clientData['Modelo de Armação'];
    if (armacaoNome && armacaoNome !== 'Não informada') {
      const extra = [];
      if (clientData['Cor']) extra.push(`Cor: ${clientData['Cor']}`);
      if (clientData['REFERENCIA_SKU']) extra.push(`Ref: ${clientData['REFERENCIA_SKU']}`);
      items.push({
        tipo: 'Armação',
        nome: armacaoNome,
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: null,
        total: null
      });
    }

    const lenteNome = osData.lente || clientData['Lente'] || clientData['Marca de Lente'];
    if (lenteNome && lenteNome !== 'Não informada') {
      const extra = [];
      if (osData.tratamento || clientData['Tratamento']) extra.push(`Tratamento: ${osData.tratamento || clientData['Tratamento']}`);
      if (clientData['MATERIAL']) extra.push(clientData['MATERIAL']);
      items.push({
        tipo: 'Lente Oftálmica',
        nome: lenteNome,
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: null,
        total: null
      });
    }

    if (items.length === 0 && (osData.produto || clientData['PRODUTO'])) {
      items.push({
        tipo: 'Óculos Completo',
        nome: osData.produto || clientData['PRODUTO'],
        detalhes: '',
        qtd: 1,
        precoUnit: null,
        total: null
      });
    }

    return items;
  }, [osData, clientData]);

  const hasItemPrices = orderItems.some(item => item.total && item.total > 0);

  // ─── CRONOGRAMA DE PARCELAS DO BOLETO ─────────────────────
  const installmentsList = useMemo(() => {
    let p = osData.parcelas;
    if (typeof p === 'string') {
      try { p = JSON.parse(p); } catch (e) {}
    }
    if (!p && osData.PARCELAS_JSON) {
      try { p = JSON.parse(osData.PARCELAS_JSON); } catch (e) {}
    }
    if (!p && osData.raw?.PARCELAS_JSON) {
      try { p = JSON.parse(osData.raw.PARCELAS_JSON); } catch (e) {}
    }
    if (Array.isArray(p) && p.length > 0) {
      return p;
    }
    return [];
  }, [osData]);

  // ─── RESOLUÇÃO DO MÉTODO DE PAGAMENTO DA ENTRADA E DO RESTANTE ────────
  const { resolvedFormaEntrada, resolvedFormaRestante } = useMemo(() => {
    const rawFP = String(osData.formasPagamento || osData.formaPagamento || clientData['FORMAS_PAGAMENTO'] || clientData['FORMA_PAGTO'] || '');
    const explicitEntrada = String(osData.formaPagamentoEntrada || osData.FORMA_ENTRADA || osData.raw?.FORMA_ENTRADA || clientData['FORMA_ENTRADA'] || clientData.formaPagamentoEntrada || '').trim();
    const explicitRestante = String(osData.formaPagamentoRestante || osData.FORMA_RESTANTE || osData.raw?.FORMA_RESTANTE || clientData['FORMA_RESTANTE'] || clientData.formaPagamentoRestante || '').trim();

    const entradaNum = parseCurrencyPrint(osData.valorEntrada ?? osData['VALOR ENTRADA'] ?? osData['SINAL'] ?? clientData['VALOR ENTRADA']);
    const restanteNum = parseCurrencyPrint(osData.restante ?? osData['RESTANTE'] ?? clientData['RESTANTE']);

    let entMethod = explicitEntrada;
    let restMethod = explicitRestante;

    const lines = rawFP.split(/\n|\s*\+\s*/).map(s => s.trim()).filter(Boolean);

    if (!entMethod && entradaNum > 0) {
      const entLines = lines.filter(l => !/boleto|carn[eê]|restante|falta|a pagar/i.test(l));
      const detected = [];
      entLines.forEach(l => {
        if (/pix/i.test(l) && !detected.includes('PIX')) detected.push('PIX');
        else if (/d[eé]bito/i.test(l) && !detected.includes('Cartão de Débito')) detected.push('Cartão de Débito');
        else if (/cr[eé]dito/i.test(l) && !detected.includes('Cartão de Crédito')) detected.push('Cartão de Crédito');
        else if (/dinheiro/i.test(l) && !detected.includes('Dinheiro')) detected.push('Dinheiro');
      });
      entMethod = detected.join(' + ');
    }

    if (!restMethod && restanteNum > 0) {
      if (installmentsList.length > 0 || /boleto|carn[eê]/i.test(rawFP)) {
        restMethod = installmentsList.length > 1 ? `Boleto (${installmentsList.length}x)` : 'Boleto';
      } else {
        const restLines = lines.filter(l => /restante|falta|na retirada|na entrega|a pagar/i.test(l));
        const detectedRest = [];
        restLines.forEach(l => {
          const xMatch = l.match(/(\d+)x/i);
          const xSuffix = xMatch && parseInt(xMatch[1], 10) > 1 ? ` (${xMatch[1]}x)` : '';
          if (/pix/i.test(l)) detectedRest.push('PIX');
          else if (/cr[eé]dito/i.test(l)) detectedRest.push(`Cartão de Crédito${xSuffix}`);
          else if (/d[eé]bito/i.test(l)) detectedRest.push('Cartão de Débito');
          else if (/dinheiro/i.test(l)) detectedRest.push('Dinheiro');
          else if (/combinar|retirada|entrega/i.test(l)) detectedRest.push('A Combinar na Retirada');
        });
        restMethod = [...new Set(detectedRest)].join(' + ');
      }
    }

    return {
      resolvedFormaEntrada: entMethod,
      resolvedFormaRestante: restMethod
    };
  }, [osData, clientData, installmentsList]);

  // ─── PARSER E FORMATAÇÃO ORGANIZADA DAS FORMAS DE PAGAMENTO ────────
  const paymentMethodsList = useMemo(() => {
    const rawFP = osData.formasPagamento || osData.formaPagamento || clientData['FORMAS_PAGAMENTO'] || clientData['FORMA_PAGTO'] || '';
    const entradaNum = parseCurrencyPrint(osData.valorEntrada ?? osData['VALOR ENTRADA'] ?? osData['SINAL'] ?? clientData['VALOR ENTRADA']);
    const restanteNum = parseCurrencyPrint(osData.restante ?? osData['RESTANTE'] ?? clientData['RESTANTE']);

    if (!rawFP && installmentsList.length === 0 && !resolvedFormaEntrada && !resolvedFormaRestante) {
      return ['À Vista / Conforme Lançamento'];
    }

    // Limpeza de prefixos redundantes e normalização para 'Boleto'
    let text = String(rawFP)
      .replace(/(?:FORMA DE PAGAMENTO|FORMA_PAGTO|FORMA_PAGAMENTO|MEIO_PAGAMENTO)\s*:\s*/gi, '')
      .replace(/(?<!\p{L})Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Boleto\s+da\s+Loja(?!\p{L})/gui, 'Boleto')
      .replace(/(?<!\p{L})Carn[eê]s?(?!\p{L})/gui, 'Boleto')
      .trim();

    // Divide por quebras de linha ou ' + '
    const parts = text.split(/\n|\s*\+\s*/).map(p => p.trim()).filter(Boolean);
    
    // Desduplicar itens idênticos (ex: se "Dinheiro" foi repetido)
    const unique = [];
    for (const item of parts) {
      if (!unique.includes(item)) {
        unique.push(item);
      }
    }

    if (entradaNum > 0 && resolvedFormaEntrada && unique.length === 0) {
      unique.push(`Entrada (${resolvedFormaEntrada}): R$ ${formatCurrencyPrint(entradaNum)}`);
    }

    if (restanteNum > 0 && resolvedFormaRestante && !unique.some(u => /restante|boleto/i.test(u))) {
      unique.push(`Restante (${resolvedFormaRestante}): R$ ${formatCurrencyPrint(restanteNum)}`);
    }

    if (unique.length === 0 && installmentsList.length > 0) {
      return [`Boleto (${installmentsList.length} parcelas programadas)`];
    }
    
    return unique.length > 0 ? unique : ['À Vista / Conforme Lançamento'];
  }, [osData, clientData, installmentsList, resolvedFormaEntrada, resolvedFormaRestante]);

  return (
    <div className="single-os-sheet-wrapper bg-white text-slate-900 font-sans text-[9px] leading-tight select-none">
      {/* ─── CABEÇALHO COMPACTO DA OS ────────────────────────────── */}
      <div className="border-b-2 border-slate-900 pb-1.5 mb-1.5 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <img 
            src="/logo-yasmin.png" 
            alt="Yasmin Ótica" 
            className="h-8 max-w-[130px] object-contain" 
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/logo-yasmin-transparent.png";
            }}
          />
          <div className="border-l-2 border-slate-900 pl-2">
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900 leading-none">YASMIN ÓTICA</h1>
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mt-0.5">Ordem de Serviço & Comprovante Óptico</p>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block bg-slate-950 text-white px-2.5 py-0.5 rounded font-black text-xs uppercase tracking-wide">
            OS Nº {osData.numeroOS || '---'}{isMulti ? ` (${index}/${total})` : ''}
          </div>
            <p className="text-[8.5px] font-bold mt-0.5 text-slate-700">
              {saleDate && <span>Data da Venda: <strong className="text-slate-900">{formatDatePrint(saleDate)}{saleTime ? ` às ${saleTime}` : ''}</strong> | </span>}
              Emissão: {new Date().toLocaleDateString('pt-BR')} | Unidade: {osData.unidade || osData.selectedCity || cidade}
            </p>
          </div>
        </div>

        {/* ─── 1. IDENTIFICAÇÃO DO CLIENTE (TITULAR & CONTATO) ───────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5 bg-slate-50/50">
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
              1. Identificação do Cliente
            </h3>
            <span className="text-[7.5px] font-bold text-slate-500 uppercase">Cadastro Oficial</span>
          </div>
          
          <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[8.5px]">
            <p className="col-span-2">
              <strong className="text-slate-600">Cliente Titular:</strong> <span className="font-black uppercase text-slate-900">{clientName}</span>
              {beneficiaryName && beneficiaryName.toLowerCase() !== clientName.toLowerCase() && (
                <span className="ml-2 inline-block bg-fuchsia-100 px-1.5 py-0.2 rounded text-fuchsia-950 border border-fuchsia-300 font-black text-[8px]">
                  Paciente: {beneficiaryName}
                </span>
              )}
            </p>
            <p>
              <strong className="text-slate-600">CPF/CNPJ:</strong> <span className="font-bold text-slate-900">{clientCpf}</span>
            </p>
            <p>
              <strong className="text-slate-600">WhatsApp:</strong> <span className="font-bold text-slate-900">{clientZap}</span>
            </p>
            
            <p className="col-span-3">
              <strong className="text-slate-600">Endereço:</strong> <span className="font-medium text-slate-900">{clientAddress}</span>
            </p>
            {clientNasc ? (
              <p>
                <strong className="text-slate-600">Dt. Nasc:</strong> <span className="font-medium text-slate-900">{clientNasc}</span>
              </p>
            ) : (
              <p>
                <strong className="text-slate-600">RG:</strong> <span className="font-medium text-slate-900">{clientRg || '—'}</span>
              </p>
            )}

            {respName && (
              <p className="col-span-4 text-[8px] bg-slate-100 p-0.5 rounded border border-slate-200 text-slate-800 mt-0.5">
                <strong>Responsável Legal:</strong> <span className="font-bold uppercase">{respName}</span>
                {respCpf && <span> | CPF: {respCpf}</span>}
                {respZap && <span> | Tel: {respZap}</span>}
              </p>
            )}
          </div>
        </div>

        {/* ─── 2. RECEITA OFTALMOLÓGICA (DIOPTRIA) ───────────────────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-900">
              2. Prescrição Oftalmológica (Dioptria)
            </h3>
            <div className="flex items-center gap-3 text-[8.5px]">
              <p><strong>Médico / Prescritor:</strong> <span className="font-bold text-slate-900">{osData.medico || 'Não informado'}</span></p>
              <p>
                <strong>Adição (Perto):</strong> <span className="font-black text-slate-950 bg-slate-100 px-1 py-0.5 rounded border border-slate-300">{osData.adicao || '---'}</span>
              </p>
            </div>
          </div>
          
          <table className="w-full text-center border-collapse border border-slate-400 text-[8.5px]">
            <thead>
              <tr className="bg-slate-100 font-black uppercase text-slate-800 text-[8px]">
                <th className="border border-slate-400 py-0.5 px-1 text-left w-24">Visão / Olho</th>
                <th className="border border-slate-400 py-0.5 px-1">Esférico</th>
                <th className="border border-slate-400 py-0.5 px-1">Cilíndrico</th>
                <th className="border border-slate-400 py-0.5 px-1">Eixo</th>
                <th className="border border-slate-400 py-0.5 px-1">DNP</th>
                <th className="border border-slate-400 py-0.5 px-1">Altura</th>
                <th className="border border-slate-400 py-0.5 px-1">DP</th>
                <th className="border border-slate-400 py-0.5 px-1">OPA</th>
              </tr>
            </thead>
            <tbody>
              {/* Longe */}
              <tr className="bg-white">
                <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-slate-900">OD (Longe)</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odEsf || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odCil || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odEixo || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odDnp || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odAlt || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odDp || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odOpa || '---'}</td>
              </tr>
              <tr className="bg-slate-50/70">
                <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-slate-900">OE (Longe)</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeEsf || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeCil || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeEixo || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeDnp || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeAlt || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeDp || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeOpa || '---'}</td>
              </tr>
              {/* Perto */}
              {(osData.odPertoEsf || osData.oePertoEsf || osData.adicao || osData.odPertoCil || osData.oePertoCil) && (
                <>
                  <tr className="bg-amber-50/40">
                    <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-amber-950">OD (Perto)</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoEsf || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoCil || osData.odCil || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoEixo || osData.odEixo || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoDnp || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoAlt || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoDp || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoOpa || '---'}</td>
                  </tr>
                  <tr className="bg-amber-50/60">
                    <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-amber-950">OE (Perto)</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoEsf || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoCil || osData.oeCil || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoEixo || osData.oeEixo || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoDnp || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoAlt || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoDp || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoOpa || '---'}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 3. PADRÃO DE ITENS DO PEDIDO (PRODUTOS & SERVIÇOS) ────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-900">
              3. Itens do Pedido & Produtos Ópticos
            </h3>
            <span className="text-[8px] font-bold text-slate-500 uppercase">
              Total de Itens: {orderItems.length}
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-[8.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase font-black text-[7.5px]">
                <th className="border border-slate-300 py-0.5 px-1.5 text-left">Item / Descrição do Produto</th>
                <th className="border border-slate-300 py-0.5 px-1 text-center w-28">Categoria</th>
                <th className="border border-slate-300 py-0.5 px-1 text-center w-12">Qtd</th>
                {hasItemPrices ? (
                  <>
                    <th className="border border-slate-300 py-0.5 px-1 text-right w-20">Unit. (R$)</th>
                    <th className="border border-slate-300 py-0.5 px-1.5 text-right w-20">Subtotal</th>
                  </>
                ) : (
                  <th className="border border-slate-300 py-0.5 px-1 text-center w-28">Previsão Entrega</th>
                )}
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="border border-slate-300 py-0.5 px-1.5">
                    <strong className="text-slate-900 font-bold">{item.nome}</strong>
                    {item.detalhes && (
                      <span className="text-slate-500 text-[7.5px] block font-medium">{item.detalhes}</span>
                    )}
                  </td>
                  <td className="border border-slate-300 py-0.5 px-1 text-center text-[7.5px] font-bold text-slate-700 uppercase">
                    {item.tipo}
                  </td>
                  <td className="border border-slate-300 py-0.5 px-1 text-center font-bold text-slate-900">
                    {item.qtd}
                  </td>
                  {hasItemPrices ? (
                    <>
                      <td className="border border-slate-300 py-0.5 px-1 text-right text-slate-700">
                        {item.precoUnit ? formatCurrencyPrint(item.precoUnit) : item.tipo === 'Brinde / Cortesia' ? 'Cortesia' : '—'}
                      </td>
                      <td className="border border-slate-300 py-0.5 px-1.5 text-right font-black text-slate-900">
                        {item.total ? formatCurrencyPrint(item.total) : item.tipo === 'Brinde / Cortesia' ? 'R$ 0,00' : '—'}
                      </td>
                    </>
                  ) : (
                    <td className="border border-slate-300 py-0.5 px-1 text-center font-bold text-slate-800">
                      {formatDatePrint(osData.dataEntrega)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── 4. CONDIÇÕES FINANCEIRAS & PAGAMENTO ──────────────────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-900">
              4. Condições Financeiras & Pagamento
            </h3>
            <div className="flex items-center gap-1.5">
              {saleDate && (
                <div className="text-[8.5px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Data da Venda: <span className="font-black">{formatDatePrint(saleDate)}{saleTime ? ` às ${saleTime}` : ''}</span>
                </div>
              )}
              <div className="text-[8.5px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Previsão de Entrega: <span className="font-black">{formatDatePrint(osData.dataEntrega)}</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            <div className="border border-slate-800 p-1 text-center rounded bg-slate-50">
              <p className="uppercase text-[7.5px] font-black text-slate-600">
                {isSecondary ? 'Cobrança da OS' : 'Valor Total da OS'}
              </p>
              <p className="font-black text-xs text-slate-950">
                {isSecondary ? 'Cobrança Unificada' : `R$ ${formatCurrencyPrint(osData.valorTotal)}`}
              </p>
            </div>
            <div className="border border-emerald-700 p-1 text-center rounded bg-emerald-50/50">
              <p className="uppercase text-[7.5px] font-black text-emerald-800">
                {isSecondary ? 'Faturamento' : 'Sinal / Entrada Paga'}
              </p>
              <p className="font-black text-xs text-emerald-800">
                {isSecondary ? 'Faturado na OS 1' : `R$ ${formatCurrencyPrint(osData.valorEntrada)}`}
              </p>
              {!isSecondary && parseCurrencyPrint(osData.valorEntrada) > 0 && resolvedFormaEntrada && (
                <p className="text-[7px] font-black text-emerald-900 mt-0.5 uppercase">
                  Forma da Entrada: {resolvedFormaEntrada}
                </p>
              )}
            </div>
            <div className={`p-1 text-center rounded border ${(!isSecondary && parseCurrencyPrint(osData.restante) > 0) ? 'border-rose-600 bg-rose-50/50' : 'border-slate-400 bg-slate-50'}`}>
              <p className={`uppercase text-[7.5px] font-black ${(!isSecondary && parseCurrencyPrint(osData.restante) > 0) ? 'text-rose-700' : 'text-slate-600'}`}>
                {isSecondary ? 'Saldo Desta OS' : 'Falta / Restante'}
              </p>
              <p className={`font-black text-xs ${(!isSecondary && parseCurrencyPrint(osData.restante) > 0) ? 'text-rose-800' : 'text-slate-900'}`}>
                {isSecondary ? 'R$ 0,00 (Faturamento Único)' : `R$ ${formatCurrencyPrint(osData.restante)}`}
              </p>
              {!isSecondary && parseCurrencyPrint(osData.restante) > 0 && resolvedFormaRestante && (
                <p className="text-[7px] font-black text-rose-900 mt-0.5 uppercase">
                  Forma do Restante: {resolvedFormaRestante}
                </p>
              )}
            </div>
          </div>

          {/* Formas de Pagamento Organizadas e Estruturadas */}
          <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[8.5px] space-y-1">
            <div className="flex justify-between items-center">
              <strong className="text-[7.5px] uppercase text-slate-700 font-black">
                {isSecondary ? 'Vínculo de Cobrança:' : 'Forma(s) de Pagamento Lançadas:'}
              </strong>
              {(osData.voucher || clientData['VOUCHER']) && (
                <span className="text-[7.5px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-400 px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                  <span>🎟️ Voucher: {osData.voucher || clientData['VOUCHER']}</span>
                  {(parseCurrencyPrint(osData.descontoVoucher ?? osData.valorDesconto ?? osData.DESCONTO_VOUCHER ?? clientData['DESCONTO_VOUCHER'] ?? clientData.descontoVoucher) > 0) && (
                    <span className="text-emerald-950 font-bold">
                      (-R$ {formatCurrencyPrint(osData.descontoVoucher ?? osData.valorDesconto ?? osData.DESCONTO_VOUCHER ?? clientData['DESCONTO_VOUCHER'] ?? clientData.descontoVoucher)})
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {isSecondary ? (
                <div className="bg-white border border-indigo-300 rounded px-2 py-0.5 text-indigo-900 font-bold text-[8px] flex items-center gap-1 shadow-xs">
                  <span>🔗 Cobrança Unificada vinculada à Venda / OS Principal (Não duplica débitos no cliente)</span>
                </div>
              ) : (
                paymentMethodsList.map((methodStr, idx) => (
                  <div key={idx} className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-900 font-bold text-[8px] flex items-center gap-1 shadow-xs">
                    <span>{methodStr}</span>
                  </div>
                ))
              )}
            </div>

            {/* Cronograma de Parcelas do Boleto se houver parcelamento */}
            {!isSecondary && installmentsList.length > 0 && (
              <div className="mt-1 pt-1 border-t border-slate-200">
                <span className="text-[7px] font-black uppercase text-indigo-900 block mb-0.5">
                  📄 Cronograma de Parcelas do Boleto ({installmentsList.length} parcelas):
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1">
                  {installmentsList.map((p, pIdx) => (
                    <div key={pIdx} className="bg-white border border-slate-300 rounded p-0.5 text-center">
                      <span className="block text-[6.5px] font-bold text-slate-500 uppercase">{p.numero || pIdx + 1}ª Parcela</span>
                      <span className="block text-[7.5px] font-black text-slate-900">R$ {formatCurrencyPrint(p.valor)}</span>
                      <span className="block text-[6.5px] font-medium text-slate-600">{formatDatePrint(p.vencimento)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── 5. OBSERVAÇÕES DE MONTAGEM / LABORATÓRIO ──────────────── */}
        {osData.observacoes && (
          <div className="mb-1 border border-slate-300 rounded p-1 bg-slate-50/40">
            <h3 className="text-[7.5px] font-black uppercase text-slate-700">Observações de Montagem / Laboratório:</h3>
            <p className="text-[8px] font-medium text-slate-800 leading-tight">{osData.observacoes}</p>
          </div>
        )}

        {/* ─── 6. CONTRATO DE VENDA E COMPRA DE ARMAÇÕES DE ÓCULOS, LENTES E LENTES DE CONTATO ───────── */}
        <div className="mb-1.5 text-[8.5px] leading-relaxed text-justify border-2 border-slate-400 p-2.5 rounded-lg bg-slate-50/60 shadow-xs">
          <div className="bg-slate-200/80 border-b border-slate-300 py-1 px-2 rounded mb-1.5 text-center">
            <p className="font-black text-[9.5px] uppercase tracking-wider text-slate-950">
              CONTRATO DE VENDA E COMPRA DE ARMAÇÕES DE ÓCULOS, LENTES E LENTES DE CONTATO
            </p>
          </div>
          
          <div className="space-y-1.5 text-slate-800">
            <p>
              As partes acima nominadas, doravante determinadas ÓTICA e SOLICITANTE tem entre si justas e acertadas o presente contrato, pelas cláusulas abaixo:
            </p>
            <p>
              A SOLICITANTE adquire neste ato da OTICA a armação e lente, ou a lente de contato, pelo preço certo e ajustado nas condições acima descritas, cujo valor reconhece a SOLICITANTE como liquido, certo e devido. A compra é feita em carater irrevogável e irretratável obrigando as partes, herdeiros e sucessores.
            </p>
            <p>
              A SOLICITANTE, caso não cumpra com o pagamento dos valores acima descritos, arcará com uma multa de 2% (dois por cento) sobre o valor devido, bem como com o juros de mora e correção monetária dos valores, até a sua quitação. Em caso de não pagamento dos valores acima avançados o nome da SOLICITANTE será inscrito nos serviços de proteção ao crédito SPC e SERASA, o que autoriza de forma expressa.
            </p>
            <p className="font-bold text-slate-900 text-center pt-0.5">
              E por estarem justas e contratadas firmam o presente.
            </p>
          </div>

          {/* Quadro de Resumo Financeiro do Contrato com Destaque */}
          <div className="mt-2 pt-1.5 border-t-2 border-slate-300 grid grid-cols-3 gap-2 text-center bg-white p-1.5 rounded-md border border-slate-200 shadow-2xs">
            <div className="text-[9px] font-black text-slate-950">
              <span className="text-slate-500 font-bold block text-[7.5px] uppercase tracking-wider">Total do Pedido</span>
              <span>Valor Total: R$ {formatCurrencyPrint(osData.valorTotal ?? osData['VALOR TOTAL'] ?? osData['VALOR'] ?? osData.total ?? osData.valor ?? clientData['VALOR TOTAL'] ?? clientData['Valor Total'])}</span>
            </div>
            <div className="text-[9px] font-black text-emerald-800 border-x border-slate-200">
              <span className="text-emerald-700 font-bold block text-[7.5px] uppercase tracking-wider">Entrada / Sinal</span>
              <span>Entrada: R$ {formatCurrencyPrint(osData.valorEntrada ?? osData['VALOR ENTRADA'] ?? osData['SINAL'] ?? osData.entrada ?? osData.sinal ?? clientData['VALOR ENTRADA'] ?? clientData['Valor Entrada'])}</span>
              {!isSecondary && resolvedFormaEntrada && (
                <span className="block text-[7px] font-bold text-emerald-700 uppercase">({resolvedFormaEntrada})</span>
              )}
            </div>
            <div className="text-[9px] font-black text-slate-950">
              <span className="text-slate-500 font-bold block text-[7.5px] uppercase tracking-wider">Saldo Restante</span>
              <span>Restante: R$ {formatCurrencyPrint(osData.restante ?? osData['RESTANTE'] ?? osData.saldoRestante ?? clientData['RESTANTE'] ?? clientData['Restante'])}</span>
              {!isSecondary && resolvedFormaRestante && (
                <span className="block text-[7px] font-bold text-rose-700 uppercase">({resolvedFormaRestante})</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── 7. CONFERÊNCIA DE ENTREGA ─────────────────────────────── */}
        <div className="mb-2 flex justify-between items-center text-[8.5px] bg-slate-50 p-1.5 rounded-lg border border-slate-300">
          <div>
            <strong className="text-slate-800">Conferi e recebi os produtos em perfeito estado em:</strong>
            <span className="border-b border-slate-600 px-4 font-black ml-1.5 text-slate-950">____ / ____ / ________</span>
          </div>
          <div>
            <strong className="text-slate-800">Visto do Cliente:</strong>
            <span className="border-b border-slate-600 px-8 ml-1.5 inline-block"></span>
          </div>
        </div>

        {/* ─── 8. ASSINATURAS LADO A LADO ────────────────────────────── */}
        <div className={`pt-1 flex ${respName ? 'justify-between' : 'justify-around'} px-3 text-center`}>
          <div className="w-[30%]">
            <div className="border-t-2 border-slate-900 pt-1 uppercase text-[8.5px] font-black text-slate-900">
              Assinatura do Solicitante
            </div>
            <p className="text-[7.5px] font-bold text-slate-600 truncate mt-0.5">{clientName}</p>
          </div>
          
          {respName && (
            <div className="w-[30%]">
              <div className="border-t-2 border-slate-900 pt-1 uppercase text-[8.5px] font-black text-slate-900">
                Assinatura do Responsável
              </div>
              <p className="text-[7.5px] font-bold text-slate-600 truncate mt-0.5">{respName}</p>
            </div>
          )}

          <div className="w-[30%]">
            <div className="border-t-2 border-slate-900 pt-1 uppercase text-[8.5px] font-black text-slate-900">
              Yasmin Ótica (Visto)
            </div>
            <p className="text-[7.5px] font-bold text-slate-600 mt-0.5">Atendimento / Loja</p>
          </div>
        </div>

        {/* ─── 9. VERSÍCULO DE ENCERRAMENTO (RODAPÉ COMPACTO) ────────── */}
        <div className="mt-1 text-center text-[7px] italic text-slate-500 border-t border-slate-200 pt-0.5">
          "Sonda-me, ó Deus, e conhece o meu coração; prova-me, e conhece os meus pensamentos..." — Salmos 139:23-24
        </div>

      </div>
  );
};

const PrintableOS = ({ osData, clientData = {} }) => {
  if (!osData) return null;
  const list = (osData.multiOrders && Array.isArray(osData.multiOrders))
    ? osData.multiOrders
    : (osData.orders && Array.isArray(osData.orders))
      ? osData.orders
      : (Array.isArray(osData) ? osData : [osData]);

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
          #print-section {
            display: block !important;
            width: 100% !important;
            max-width: 196mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .single-os-sheet-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .os-sheet-page {
            page-break-after: always !important;
            break-after: page !important;
            padding-bottom: 2mm;
          }
          .os-sheet-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .os-sheet-page-single {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}} />

      <div 
        id="print-section" 
        className="hidden print:block bg-white text-slate-900 font-sans text-[9px] leading-tight select-none"
      >
        {list.map((item, idx) => (
          <div key={idx} className={list.length > 1 ? "os-sheet-page" : "os-sheet-page-single"}>
            <SingleOSSheet 
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

export default PrintableOS;

