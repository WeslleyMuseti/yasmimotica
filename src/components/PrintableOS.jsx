import React, { useMemo } from 'react';
import { resolveOSUnit, resolveOSFinancials } from '../reparcelamentoUtils';

export { resolveOSUnit };

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
  if (dStr instanceof Date) {
    return isNaN(dStr.getTime()) ? 'Não definida' : dStr.toLocaleDateString('pt-BR');
  }
  const str = String(dStr).trim();
  if (!str) return 'Não definida';
  if (str.includes('/')) return str;
  const parts = str.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
};

const SingleOSSheet = ({ osData, clientData, isMulti = false, index = 1, total = 1 }) => {
  const safeClient = {
    ...(osData?.raw || {}),
    ...(osData?.clientData || {}),
    ...(osData?.matchedClient || {}),
    ...(clientData || {})
  };

  const isSecondary = Boolean(osData.isSecondaryOS || (isMulti && index > 1 && (osData.financeiroUnificado || parseCurrencyPrint(osData.valorTotal) === 0)));
  const saleDate = osData.dataVenda || osData['DATA  DA VENDA'] || osData['DATA DA VENDA'] || osData['DATA_VENDA'] || osData['Data da Venda'] || osData['DATA'] || osData['Data'] || safeClient['DATA  DA VENDA'] || safeClient['DATA'] || '';
  const saleTime = osData.hora || osData.HORA || safeClient.hora || safeClient.HORA || (typeof saleDate === 'string' && saleDate.includes(':') ? saleDate.split(/\s+/)[1] : (osData.DATA_HORA && typeof osData.DATA_HORA === 'string' && osData.DATA_HORA.includes(':') ? osData.DATA_HORA.split(/\s+/)[1] : ''));

  // ─── UNIDADE DA LOJA ONDE A OS FOI EMITIDA ───────────────────────
  const osUnit = resolveOSUnit(osData, safeClient);

  // ─── DADOS COMPLETOS DO CLIENTE TITULAR ─────────────────────────
  const clientName = safeClient['Nome Completo'] || safeClient['NOME'] || safeClient['CLIENTE'] || safeClient['Nome'] || osData['nomeCliente'] || osData['CLIENTE'] || osData.clientName || 'Cliente';
  const clientZap = safeClient['WhatsApp'] || safeClient['TELEFONE'] || safeClient['Telefone'] || safeClient['Celular'] || safeClient['FONE'] || safeClient['Telefone Cliente'] || 'Não informado';
  const clientCpf = safeClient['CPF / CNPJ'] || safeClient['CPF'] || safeClient['CNPJ'] || safeClient['CLIENTE_CPF'] || safeClient['Cpf'] || osData.clientCPF || 'Não informado';
  const clientRg = safeClient['RG'] || safeClient['rg'] || safeClient['Rg'] || osData.rg || '';
  const clientNascRaw = safeClient['Data de Nascimento'] || safeClient['DATA_NASCIMENTO'] || safeClient['Nascimento'] || safeClient['Dt. Nasc'] || safeClient['dataNascimento'] || '';
  const clientNasc = clientNascRaw ? formatDatePrint(clientNascRaw) : '';
  const clientEmail = safeClient['E-mail'] || safeClient['Email'] || safeClient['EMAIL'] || safeClient['email'] || '';
  const clientCep = safeClient['CEP'] || safeClient['Cep'] || safeClient['cep'] || '';
  
  const rua = safeClient['Rua'] || safeClient['ENDERECO'] || safeClient['Endereço'] || safeClient['LOGRADOURO'] || safeClient['rua'] || '';
  const num = safeClient['Número'] || safeClient['NUMERO'] || safeClient['Numero'] || safeClient['numero'] || '';
  const bairro = safeClient['Bairro'] || safeClient['BAIRRO'] || safeClient['bairro'] || '';
  const cidade = safeClient['Cidade'] || safeClient['CIDADE'] || safeClient['cidade'] || osUnit;
  const estado = safeClient['Estado'] || safeClient['ESTADO'] || safeClient['UF'] || safeClient['estado'] || 'SP';
  
  const addressParts = [
    rua && num ? `${rua}, nº ${num}` : (rua || (num ? `Nº ${num}` : '')),
    bairro ? `Bairro ${bairro}` : '',
    `${cidade}/${estado}`,
    clientCep ? `CEP ${clientCep}` : ''
  ].filter(Boolean);
  const clientAddress = addressParts.length > 0 ? addressParts.join(' - ') : 'Não informado';

  // Referências Pessoais do Titular
  const formatRef = (name, phone, kin) => {
    const parts = [];
    if (name) parts.push(name);
    if (phone) parts.push(phone);
    if (kin) parts.push(`(${kin})`);
    return parts.join(' ').trim();
  };

  const clientRef1 = formatRef(
    safeClient['Nome Referência 1'] || safeClient['Nome Ref. 1'] || safeClient['NOME_REF_1'],
    safeClient['Referência 1'] || safeClient['Ref. 1'] || safeClient['REF_1'] || safeClient['TELEFONE_REF_1'],
    safeClient['Parentesco Ref. 1'] || safeClient['Parentesco 1'] || safeClient['PARENTESCO_1']
  );
  const clientRef2 = formatRef(
    safeClient['Nome Referência 2'] || safeClient['Nome Ref. 2'] || safeClient['NOME_REF_2'],
    safeClient['Referência 2'] || safeClient['Ref. 2'] || safeClient['REF_2'] || safeClient['TELEFONE_REF_2'],
    safeClient['Parentesco Ref. 2'] || safeClient['Parentesco 2'] || safeClient['PARENTESCO_2']
  );

  const clientInstagram = safeClient['Instagram'] || safeClient['INSTAGRAM'] || safeClient['instagram'] || '';
  const clientFacebook = safeClient['Facebook'] || safeClient['FACEBOOK'] || safeClient['facebook'] || '';
  const clientTikTok = safeClient['TikTok'] || safeClient['TIKTOK'] || safeClient['tiktok'] || '';

  // ─── DADOS COMPLETOS DO RESPONSÁVEL LEGAL ─────────────────────
  const respName = String(
    osData.responsavelNome ||
    osData.RESPONSAVEL_NOME ||
    osData['Responsável Nome'] ||
    osData['Responsável Legal'] ||
    osData['RESPONSAVEL_LEGAL'] ||
    safeClient['Responsável Nome'] || 
    safeClient['Responsável Legal'] || 
    safeClient['RESPONSAVEL_LEGAL'] || 
    safeClient['RESPONSAVEL_NOME'] || 
    safeClient['Responsável'] || 
    safeClient['RESPONSAVEL'] || 
    safeClient['NOME RESPONSAVEL'] || 
    safeClient['Nome Responsável'] || 
    safeClient['responsavelNome'] || 
    safeClient['responsavel'] || 
    osData.responsavel || 
    ''
  ).trim();

  const respCpf = osData.responsavelCpf || osData.RESPONSAVEL_CPF || osData['Responsável CPF'] || safeClient['Responsável CPF'] || safeClient['RESPONSAVEL_CPF'] || safeClient['CPF Responsável'] || safeClient['responsavelCpf'] || '';
  const respRg = safeClient['Responsável RG'] || safeClient['RESPONSAVEL_RG'] || safeClient['RG Responsável'] || safeClient['responsavelRg'] || '';
  const respNascRaw = safeClient['Responsável Data de Nascimento'] || safeClient['RESPONSAVEL_DATA_NASCIMENTO'] || safeClient['Nascimento Responsável'] || safeClient['responsavelNascimento'] || '';
  const respNasc = respNascRaw ? formatDatePrint(respNascRaw) : '';
  const respZap = safeClient['Responsável WhatsApp'] || safeClient['RESPONSAVEL_WHATSAPP'] || safeClient['RESPONSAVEL_TELEFONE'] || safeClient['WhatsApp Responsável'] || safeClient['Telefone Responsável'] || safeClient['responsavelWhatsApp'] || '';

  const respRua = safeClient['Responsável Rua'] || safeClient['RESPONSAVEL_RUA'] || '';
  const respNum = safeClient['Responsável Número'] || safeClient['RESPONSAVEL_NUMERO'] || '';
  const respBairro = safeClient['Responsável Bairro'] || safeClient['RESPONSAVEL_BAIRRO'] || '';
  const respCidade = safeClient['Responsável Cidade'] || safeClient['RESPONSAVEL_CIDADE'] || '';
  const respEstado = safeClient['Responsável Estado'] || safeClient['RESPONSAVEL_ESTADO'] || '';
  const respCep = safeClient['Responsável CEP'] || safeClient['RESPONSAVEL_CEP'] || '';

  const respAddressParts = [
    respRua && respNum ? `${respRua}, nº ${respNum}` : (respRua || (respNum ? `Nº ${respNum}` : '')),
    respBairro ? `Bairro ${respBairro}` : '',
    (respCidade || respEstado) ? `${respCidade || ''}${respEstado ? `/${respEstado}` : ''}` : '',
    respCep ? `CEP ${respCep}` : ''
  ].filter(Boolean);
  const respAddress = respAddressParts.length > 0 ? respAddressParts.join(' - ') : '';

  const respRef1 = formatRef(
    safeClient['Responsável Nome Referência 1'] || safeClient['Responsável Nome Ref. 1'] || safeClient['RESPONSAVEL_NOME_REF_1'],
    safeClient['Responsável Referência 1'] || safeClient['Responsável Ref. 1'] || safeClient['RESPONSAVEL_REF_1'] || safeClient['RESPONSAVEL_TELEFONE_REF_1'],
    safeClient['Responsável Parentesco Ref. 1'] || safeClient['RESPONSAVEL_PARENTESCO_1']
  );
  const respRef2 = formatRef(
    safeClient['Responsável Nome Referência 2'] || safeClient['Responsável Nome Ref. 2'] || safeClient['RESPONSAVEL_NOME_REF_2'],
    safeClient['Responsável Referência 2'] || safeClient['Responsável Ref. 2'] || safeClient['RESPONSAVEL_REF_2'] || safeClient['RESPONSAVEL_TELEFONE_REF_2'],
    safeClient['Responsável Parentesco Ref. 2'] || safeClient['RESPONSAVEL_PARENTESCO_2']
  );

  const respInstagram = safeClient['Responsável Instagram'] || safeClient['RESPONSAVEL_INSTAGRAM'] || '';
  const respFacebook = safeClient['Responsável Facebook'] || safeClient['RESPONSAVEL_FACEBOOK'] || '';
  const respTikTok = safeClient['Responsável TikTok'] || safeClient['RESPONSAVEL_TIKTOK'] || '';

  // Beneficiário / Paciente (quando for OS extra ou nominalmente diferente do titular)
  const beneficiaryName = String(
    osData.nomePessoa || 
    osData.pacienteNome ||
    osData.PACIENTE || 
    osData.NOME_BENEFICIARIO || 
    osData.CLIENTE_BENEFICIARIO || 
    osData.beneficiario || 
    safeClient.pacienteNome ||
    safeClient.PACIENTE ||
    safeClient.NOME_BENEFICIARIO ||
    safeClient.nomePessoa ||
    ''
  ).trim();

  // Valores canônicos com suporte total à regra de consistência financeira universal
  const resolvedFin = useMemo(() => {
    return resolveOSFinancials(osData, safeClient);
  }, [osData, safeClient]);

  const displayTotal = resolvedFin.totalFmt;
  const displayEntrada = resolvedFin.entradaFmt;
  const displayRestante = resolvedFin.restanteFmt;
  const displayOSNumber = String(osData.numeroOS || osData['OS DA VENDA'] || osData['OS'] || osData['VENDA_OS'] || safeClient['OS DA VENDA'] || safeClient['OS'] || '---').replace(/^#+/, '');

  // ─── PADRÃO DE ITENS DO PEDIDO (PRODUTOS & SERVIÇOS) ─────────────
  const orderItems = useMemo(() => {
    const totalSaleNum = parseCurrencyPrint(displayTotal);
    const valArmacao = parseCurrencyPrint(osData.valorArmacao || osData.raw?.['VALOR ARMAÇÃO'] || osData.raw?.['VALOR_ARMACAO'] || osData.raw?.valorArmacao || safeClient['VALOR ARMAÇÃO'] || 0);
    const valLente = parseCurrencyPrint(osData.valorLente || osData.raw?.['VALOR LENTE'] || osData.raw?.['VALOR_LENTE'] || osData.raw?.valorLente || safeClient['VALOR LENTE'] || 0);

    const generalDetails = osData.detalhes || osData.detalhesProduto || osData.raw?.['DETALHES'] || osData.raw?.['detalhes'] || osData.raw?.['DETALHE DO PRODUTO'] || osData.raw?.['DETALHES DO PRODUTO'] || osData.raw?.['DETALHES_PRODUTO'] || safeClient['DETALHES'] || safeClient['DETALHE DO PRODUTO'] || safeClient['DETALHES DO PRODUTO'] || safeClient['DETALHES_PRODUTO'] || '';

    // Medidas técnicas da armação para laboratório
    const frameSpecs = [];
    const pAro = osData.ponteAro || osData.PONTE_ARO || osData.raw?.PONTE_ARO || safeClient['PONTE_ARO'] || safeClient['ponteAro'];
    const dMaior = osData.diagonalMaior || osData.DIAGONAL_MAIOR || osData.raw?.DIAGONAL_MAIOR || safeClient['DIAGONAL_MAIOR'] || safeClient['diagonalMaior'];
    const aVert = osData.alturaVertical || osData.ALTURA_VERTICAL || osData.raw?.ALTURA_VERTICAL || safeClient['ALTURA_VERTICAL'] || safeClient['alturaVertical'];
    const pte = osData.ponte || osData.PONTE || osData.raw?.PONTE || safeClient['PONTE'] || safeClient['ponte'];
    const ar = osData.aro || osData.ARO || osData.raw?.ARO || safeClient['ARO'] || safeClient['aro'];
    if (pAro) frameSpecs.push(`Ponte+Aro: ${pAro}`);
    if (dMaior) frameSpecs.push(`Diag. Maior: ${dMaior}`);
    if (aVert) frameSpecs.push(`Alt. Vert: ${aVert}`);
    if (pte) frameSpecs.push(`Ponte: ${pte}`);
    if (ar) frameSpecs.push(`Aro: ${ar}`);
    const frameSpecsStr = frameSpecs.length > 0 ? `Medidas: ${frameSpecs.join(' | ')}` : '';

    // 1. Se houver array de itens explícito vindo do PDV ou OS
    let rawItens = osData.itens || safeClient.itens || (osData.raw && osData.raw.itens) || [];
    if (!Array.isArray(rawItens) || rawItens.length === 0) {
      if (typeof osData.raw?.ITENS_JSON === 'string') {
        try { rawItens = JSON.parse(osData.raw.ITENS_JSON); } catch (e) {}
      } else if (typeof osData.ITENS_JSON === 'string') {
        try { rawItens = JSON.parse(osData.ITENS_JSON); } catch (e) {}
      } else if (typeof safeClient.ITENS_JSON === 'string') {
        try { rawItens = JSON.parse(safeClient.ITENS_JSON); } catch (e) {}
      }
    }
    if (typeof rawItens === 'string' && rawItens.trim().startsWith('[')) {
      try { rawItens = JSON.parse(rawItens); } catch (e) {}
    }
    if (Array.isArray(rawItens) && rawItens.length > 0) {
      const mapped = rawItens.filter(Boolean).map(item => {
        if (typeof item === 'string') {
          return {
            tipo: 'Produto',
            nome: item,
            detalhes: '',
            qtd: 1,
            precoUnit: 0,
            total: 0
          };
        }
        let tipo = 'Produto';
        if (item.type === 'armacoes' || item.tipo === 'armacoes') tipo = 'Armação';
        else if (item.type === 'lentes' || item.tipo === 'lentes') tipo = 'Lente Oftálmica';
        else if (item.type === 'brindes' || item.tipo === 'brindes') tipo = 'Brinde / Cortesia';
        else if (item.type === 'avulso' || item.tipo === 'avulso') tipo = 'Serviço / Avulso';

        const extraDetails = [];
        if (item.detalhes) extraDetails.push(String(item.detalhes));
        if (item.cor && !extraDetails.some(d => String(d).toLowerCase().includes(String(item.cor).toLowerCase()))) {
          extraDetails.push(`Cor: ${item.cor}`);
        }
        if (item.tratamento && !extraDetails.some(d => String(d).toLowerCase().includes(String(item.tratamento).toLowerCase()))) {
          extraDetails.push(`Tratamento: ${item.tratamento}`);
        }
        if (item.material && !extraDetails.some(d => String(d).toLowerCase().includes(String(item.material).toLowerCase()))) {
          extraDetails.push(`Material: ${item.material}`);
        }
        const refCode = item.referenciaSku || item.ref || item.sku || item.codigo;
        if (refCode && !extraDetails.some(d => String(d).toLowerCase().includes(String(refCode).toLowerCase()))) {
          extraDetails.push(`Ref: ${refCode}`);
        }
        if (item.descricao && item.descricao !== item.nome && !extraDetails.some(d => String(d).toLowerCase().includes(String(item.descricao).toLowerCase()))) {
          extraDetails.push(String(item.descricao));
        }
        if (item.observacoes && !extraDetails.some(d => String(d).toLowerCase().includes(String(item.observacoes).toLowerCase()))) {
          extraDetails.push(String(item.observacoes));
        }
        if ((item.type === 'armacoes' || item.tipo === 'armacoes' || /arma[cç][aã]o/i.test(String(item.nome || item.descricao || ''))) && frameSpecsStr) {
          if (!frameSpecs[0] || !extraDetails.some(d => String(d).includes(frameSpecs[0]))) {
            extraDetails.push(frameSpecsStr);
          }
        }
        if (extraDetails.length === 0 && generalDetails) {
          extraDetails.push(String(generalDetails));
        }

        const precoUnit = parseCurrencyPrint(item.preco ?? item.valor ?? 0);
        const qtd = Number(item.qtd) || 1;
        const total = qtd * precoUnit;
        return {
          tipo,
          nome: String(item.nome || item.descricao || 'Produto do Pedido'),
          detalhes: extraDetails.join(' | '),
          qtd,
          precoUnit,
          total
        };
      });

      // Se só houver 1 item e ele não tiver preço explícito, atribui o valor total da venda ao produto
      if (mapped.length === 1 && mapped[0].total === 0 && totalSaleNum > 0) {
        mapped[0].precoUnit = totalSaleNum;
        mapped[0].total = totalSaleNum;
      }
      return mapped;
    }

    // 2. Monta a partir dos campos estruturados de Armação e Lente
    const items = [];
    const armacaoNome = osData.armacao || osData.raw?.['ARMAÇÃO'] || osData.raw?.['ARMACAO'] || safeClient['Armação'] || safeClient['Modelo de Armação'];
    if (armacaoNome && armacaoNome !== 'Não informada') {
      const extra = [];
      const cor = osData.cor || osData.raw?.['COR'] || osData.raw?.['Cor'] || safeClient['Cor'] || safeClient['COR'];
      if (cor) extra.push(`Cor: ${cor}`);
      const mat = osData.materialArmacao || osData.material || osData.raw?.['MATERIAL_ARMACAO'] || osData.raw?.['MATERIAL'] || safeClient['Material'];
      if (mat) extra.push(`Material: ${mat}`);
      const ref = osData.referenciaSku || osData.raw?.['REFERENCIA_SKU'] || osData.raw?.['CODIGO'] || safeClient['REFERENCIA_SKU'] || safeClient['CODIGO'];
      if (ref) extra.push(`Ref: ${ref}`);
      const detArm = osData.detalhesArmacao || osData.raw?.['DETALHES_ARMACAO'];
      if (detArm) extra.push(detArm);
      if (frameSpecsStr) extra.push(frameSpecsStr);
      if (generalDetails && (!osData.lente && !safeClient['Lente'] && !safeClient['Marca de Lente'])) {
        extra.push(generalDetails);
      }
      items.push({
        tipo: 'Armação',
        nome: armacaoNome,
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: valArmacao > 0 ? valArmacao : null,
        total: valArmacao > 0 ? valArmacao : null
      });
    }

    const lenteNome = osData.lente || osData.raw?.['LENTE'] || safeClient['Lente'] || safeClient['Marca de Lente'];
    if (lenteNome && lenteNome !== 'Não informada') {
      const extra = [];
      const trat = osData.tratamento || osData.raw?.['TRATAMENTO'] || osData.raw?.['Tratamento'] || safeClient['Tratamento'] || safeClient['TRATAMENTO'];
      if (trat) extra.push(`Tratamento: ${trat}`);
      const mat = osData.material || osData.raw?.['MATERIAL'] || osData.raw?.['Material'] || safeClient['MATERIAL'] || safeClient['Material'];
      if (mat) extra.push(`Material: ${mat}`);
      const tipoL = osData.tipoLente || osData.raw?.['TIPO_LENTE'] || safeClient['TIPO_LENTE'];
      if (tipoL) extra.push(`Tipo: ${tipoL}`);
      const detLente = osData.detalhesLente || osData.raw?.['DETALHES_LENTE'];
      if (detLente) extra.push(detLente);
      if (generalDetails && !extra.includes(generalDetails)) {
        extra.push(generalDetails);
      }
      items.push({
        tipo: 'Lente Oftálmica',
        nome: lenteNome,
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: valLente > 0 ? valLente : null,
        total: valLente > 0 ? valLente : null
      });
    }

    if (items.length === 0 && (osData.produto || safeClient['PRODUTO'])) {
      const extra = [];
      if (generalDetails) extra.push(generalDetails);
      const ref = osData.referenciaSku || osData.raw?.['REFERENCIA_SKU'] || osData.raw?.['CODIGO'] || safeClient['REFERENCIA_SKU'] || safeClient['CODIGO'];
      if (ref) extra.push(`Ref: ${ref}`);
      const cor = osData.cor || osData.raw?.['COR'] || osData.raw?.['Cor'] || safeClient['Cor'] || safeClient['COR'];
      if (cor) extra.push(`Cor: ${cor}`);
      const trat = osData.tratamento || osData.raw?.['TRATAMENTO'] || osData.raw?.['Tratamento'] || safeClient['Tratamento'] || safeClient['TRATAMENTO'];
      if (trat) extra.push(`Tratamento: ${trat}`);
      const mat = osData.material || osData.raw?.['MATERIAL'] || osData.raw?.['Material'] || safeClient['MATERIAL'] || safeClient['Material'];
      if (mat) extra.push(`Material: ${mat}`);

      items.push({
        tipo: 'Óculos Completo',
        nome: osData.produto || safeClient['PRODUTO'],
        detalhes: extra.join(' | '),
        qtd: 1,
        precoUnit: totalSaleNum > 0 ? totalSaleNum : null,
        total: totalSaleNum > 0 ? totalSaleNum : null
      });
    }

    // Se temos 1 item e ele não possui total explícito, atribui o valor da venda
    if (items.length === 1 && (!items[0].total || items[0].total === 0) && totalSaleNum > 0) {
      items[0].precoUnit = totalSaleNum;
      items[0].total = totalSaleNum;
    } else if (items.length === 2 && (!items[0].total && !items[1].total) && totalSaleNum > 0) {
      // Pacote completo (Armação + Lente) vendido conjuntamente pelo valor total da venda
      items[0].precoUnit = 0;
      items[0].total = 0;
      items[0].isPacoteIncluso = true;
      items[1].precoUnit = totalSaleNum;
      items[1].total = totalSaleNum;
      items[1].isPacotePrincipal = true;
    }

    return items;
  }, [osData, safeClient, displayTotal]);

  const hasItemPrices = true; // As colunas de valor do produto/venda sempre são exibidas conforme especificação

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
    if (!p && safeClient.parcelas) {
      p = safeClient.parcelas;
      if (typeof p === 'string') {
        try { p = JSON.parse(p); } catch (e) {}
      }
    }
    if (!p && safeClient.PARCELAS_JSON) {
      try { p = JSON.parse(safeClient.PARCELAS_JSON); } catch (e) {}
    }
    if (Array.isArray(p) && p.length > 0) {
      return p;
    }
    return [];
  }, [osData, safeClient]);

  // ─── RESOLUÇÃO DO MÉTODO DE PAGAMENTO DA ENTRADA E DO RESTANTE ────────
  const { resolvedFormaEntrada, resolvedFormaRestante } = useMemo(() => {
    const rawFP = String(osData.formasPagamento || osData.formaPagamento || safeClient['FORMAS_PAGAMENTO'] || safeClient['FORMA_PAGTO'] || '');
    const explicitEntrada = String(osData.formaPagamentoEntrada || osData.FORMA_ENTRADA || osData.raw?.FORMA_ENTRADA || safeClient['FORMA_ENTRADA'] || safeClient.formaPagamentoEntrada || '').trim();
    const explicitRestante = String(osData.formaPagamentoRestante || osData.FORMA_RESTANTE || osData.raw?.FORMA_RESTANTE || safeClient['FORMA_RESTANTE'] || safeClient.formaPagamentoRestante || '').trim();

    const entradaNum = parseCurrencyPrint(osData.valorEntrada ?? osData['VALOR ENTRADA'] ?? osData['SINAL'] ?? safeClient['VALOR ENTRADA']);
    const restanteNum = parseCurrencyPrint(osData.restante ?? osData['RESTANTE'] ?? safeClient['RESTANTE']);

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
  }, [osData, safeClient, installmentsList]);

  // ─── PARSER E FORMATAÇÃO ORGANIZADA DAS FORMAS DE PAGAMENTO ────────
  const paymentMethodsList = useMemo(() => {
    const rawFP = osData.formasPagamento || osData.formaPagamento || safeClient['FORMAS_PAGAMENTO'] || safeClient['FORMA_PAGTO'] || '';
    const entradaNum = parseCurrencyPrint(osData.valorEntrada ?? osData['VALOR ENTRADA'] ?? osData['SINAL'] ?? safeClient['VALOR ENTRADA']);
    const restanteNum = parseCurrencyPrint(osData.restante ?? osData['RESTANTE'] ?? safeClient['RESTANTE']);

    if (!rawFP && installmentsList.length === 0 && !resolvedFormaEntrada && !resolvedFormaRestante) {
      return ['À Vista / Conforme Lançamento'];
    }

    // Limpeza de prefixos redundantes e normalização para 'Boleto'
    let text = String(rawFP)
      .replace(/(?:FORMA DE PAGAMENTO|FORMA_PAGTO|FORMA_PAGAMENTO|MEIO_PAGAMENTO)\s*:\s*/gi, '')
      .replace(/(^|[^\p{L}])Boleto\s*(?:da\s*Loja\s*)?(?:\/|\s+)?\s*Carn[eê]s?(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Carn[eê]s?\s*(?:\/|\s+)?\s*Boleto(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Boleto\s+Banc[aá]rio\s*(?:\/\s*Carn[eê]s?)?(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Boleto\s+da\s+Loja(?!\p{L})/gui, '$1Boleto')
      .replace(/(^|[^\p{L}])Carn[eê]s?(?!\p{L})/gui, '$1Boleto')
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
  }, [osData, safeClient, installmentsList, resolvedFormaEntrada, resolvedFormaRestante]);

  if (!osData) return null;

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
            OS Nº {displayOSNumber}{isMulti ? ` (${index}/${total})` : ''}
          </div>
            <p className="text-[8.5px] font-bold mt-0.5 text-slate-700">
              {saleDate && <span>Data da Venda: <strong className="text-slate-900">{formatDatePrint(saleDate)}{saleTime ? ` às ${saleTime}` : ''}</strong> | </span>}
              Emissão: {new Date().toLocaleDateString('pt-BR')} | Unidade: {osUnit}
            </p>
          </div>
        </div>

        {/* ─── 1. IDENTIFICAÇÃO DO CLIENTE & RESPONSÁVEL ───────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5 bg-slate-50/50">
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
              1. Identificação do Cliente {respName ? '& Responsável Legal' : ''}
            </h3>
            <span className="text-[7.5px] font-bold text-slate-500 uppercase">Cadastro Oficial Yasmin Ótica</span>
          </div>
          
          {/* Dados do Cliente Titular */}
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
            
            <p className="col-span-2">
              <strong className="text-slate-600">Endereço:</strong> <span className="font-medium text-slate-900">{clientAddress}</span>
            </p>
            <p>
              <strong className="text-slate-600">RG:</strong> <span className="font-medium text-slate-900">{clientRg || '—'}</span>
            </p>
            <p>
              <strong className="text-slate-600">Dt. Nasc:</strong> <span className="font-medium text-slate-900">{clientNasc || '—'}</span>
            </p>

            {(clientEmail || clientInstagram || clientFacebook || clientTikTok) && (
              <p className="col-span-4 text-[7.5px] text-slate-700">
                {clientEmail && <span><strong className="text-slate-600">E-mail:</strong> {clientEmail}</span>}
                {clientInstagram && <span className="ml-2"><strong className="text-slate-600">Insta:</strong> {clientInstagram}</span>}
                {clientFacebook && <span className="ml-2"><strong className="text-slate-600">Face:</strong> {clientFacebook}</span>}
                {clientTikTok && <span className="ml-2"><strong className="text-slate-600">TikTok:</strong> {clientTikTok}</span>}
              </p>
            )}

            {(clientRef1 || clientRef2) && (
              <p className="col-span-4 text-[7.5px] text-slate-700">
                <strong className="text-slate-600">Ref. Pessoais:</strong>{' '}
                {clientRef1 && <span>[1] {clientRef1}</span>}
                {clientRef1 && clientRef2 && <span> | </span>}
                {clientRef2 && <span>[2] {clientRef2}</span>}
              </p>
            )}
          </div>

          {/* Dados Completos do Responsável Legal (se houver) */}
          {respName && (
            <div className="mt-1 pt-1 border-t border-slate-200 bg-amber-50/60 p-1 rounded border border-amber-200/80">
              <div className="flex items-center justify-between pb-0.5 mb-0.5 border-b border-amber-200/50">
                <span className="text-[8px] font-black uppercase text-amber-950 tracking-wider">
                  Dados do Responsável Legal (Assina pelo Dependente):
                </span>
                <span className="text-[7px] font-bold text-amber-800 uppercase">Responsável</span>
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-[8px] text-slate-800">
                <p className="col-span-2">
                  <strong className="text-slate-600">Nome:</strong> <span className="font-black uppercase text-slate-900">{respName}</span>
                </p>
                <p>
                  <strong className="text-slate-600">CPF:</strong> <span className="font-bold text-slate-900">{respCpf || '—'}</span>
                </p>
                <p>
                  <strong className="text-slate-600">WhatsApp:</strong> <span className="font-bold text-slate-900">{respZap || '—'}</span>
                </p>

                <p className="col-span-2">
                  <strong className="text-slate-600">Endereço:</strong> <span className="font-medium text-slate-900">{respAddress || clientAddress || 'Mesmo endereço do titular'}</span>
                </p>
                <p>
                  <strong className="text-slate-600">RG:</strong> <span className="font-medium text-slate-900">{respRg || '—'}</span>
                </p>
                <p>
                  <strong className="text-slate-600">Dt. Nasc:</strong> <span className="font-medium text-slate-900">{respNasc || '—'}</span>
                </p>

                {(respRef1 || respRef2) && (
                  <p className="col-span-4 text-[7.5px] text-slate-700">
                    <strong className="text-slate-600">Ref. Responsável:</strong>{' '}
                    {respRef1 && <span>[1] {respRef1}</span>}
                    {respRef1 && respRef2 && <span> | </span>}
                    {respRef2 && <span>[2] {respRef2}</span>}
                  </p>
                )}

                {(respInstagram || respFacebook || respTikTok) && (
                  <p className="col-span-4 text-[7.5px] text-slate-700">
                    <strong className="text-slate-600">Redes Resp.:</strong>{' '}
                    {respInstagram && <span>Insta: {respInstagram} </span>}
                    {respFacebook && <span>Face: {respFacebook} </span>}
                    {respTikTok && <span>TikTok: {respTikTok}</span>}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── 2. RECEITA OFTALMOLÓGICA (DIOPTRIA) ───────────────────── */}
        <div className="mb-1.5 border border-slate-300 rounded p-1.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-0.5 mb-1">
            <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-900">
              2. Prescrição Oftalmológica (Dioptria)
            </h3>
            <div className="flex items-center gap-3 text-[8.5px]">
              <p><strong>Médico / Prescritor:</strong> <span className="font-bold text-slate-900">{osData.medico || osData['MEDICO'] || safeClient['Médico'] || safeClient['MEDICO'] || 'Não informado'}</span></p>
              <p>
                <strong>Adição (Perto):</strong> <span className="font-black text-slate-950 bg-slate-100 px-1 py-0.5 rounded border border-slate-300">{osData.adicao || osData['ADICAO'] || osData['Adição'] || safeClient['Adição'] || '---'}</span>
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
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odEsf || osData['OD_ESF'] || safeClient['OD_ESF'] || safeClient['odEsf'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odCil || osData['OD_CIL'] || safeClient['OD_CIL'] || safeClient['odCil'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odEixo || osData['OD_EIXO'] || safeClient['OD_EIXO'] || safeClient['odEixo'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odDnp || osData['OD_DNP'] || safeClient['OD_DNP'] || safeClient['odDnp'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odAlt || osData['OD_ALT'] || safeClient['OD_ALT'] || safeClient['odAlt'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odDp || osData['OD_DP'] || safeClient['OD_DP'] || safeClient['odDp'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odOpa || osData['OD_OPA'] || safeClient['OD_OPA'] || safeClient['odOpa'] || '---'}</td>
              </tr>
              <tr className="bg-slate-50/70">
                <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-slate-900">OE (Longe)</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeEsf || osData['OE_ESF'] || safeClient['OE_ESF'] || safeClient['oeEsf'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeCil || osData['OE_CIL'] || safeClient['OE_CIL'] || safeClient['oeCil'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeEixo || osData['OE_EIXO'] || safeClient['OE_EIXO'] || safeClient['oeEixo'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeDnp || osData['OE_DNP'] || safeClient['OE_DNP'] || safeClient['oeDnp'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeAlt || osData['OE_ALT'] || safeClient['OE_ALT'] || safeClient['oeAlt'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeDp || osData['OE_DP'] || safeClient['OE_DP'] || safeClient['oeDp'] || '---'}</td>
                <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oeOpa || osData['OE_OPA'] || safeClient['OE_OPA'] || safeClient['oeOpa'] || '---'}</td>
              </tr>
              {/* Perto */}
              {(osData.odPertoEsf || osData['OD_PERTO_ESF'] || safeClient['OD_PERTO_ESF'] || osData.oePertoEsf || osData['OE_PERTO_ESF'] || safeClient['OE_PERTO_ESF'] || osData.adicao || osData['ADICAO'] || safeClient['ADICAO'] || osData.odPertoCil || osData['OD_PERTO_CIL'] || osData.oePertoCil || osData['OE_PERTO_CIL']) && (
                <>
                  <tr className="bg-amber-50/40">
                    <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-amber-950">OD (Perto)</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoEsf || osData['OD_PERTO_ESF'] || safeClient['OD_PERTO_ESF'] || safeClient['odPertoEsf'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoCil || osData['OD_PERTO_CIL'] || safeClient['OD_PERTO_CIL'] || safeClient['odPertoCil'] || osData.odCil || osData['OD_CIL'] || safeClient['OD_CIL'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoEixo || osData['OD_PERTO_EIXO'] || safeClient['OD_PERTO_EIXO'] || safeClient['odPertoEixo'] || osData.odEixo || osData['OD_EIXO'] || safeClient['OD_EIXO'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoDnp || osData['OD_PERTO_DNP'] || safeClient['OD_PERTO_DNP'] || safeClient['odPertoDnp'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoAlt || osData['OD_PERTO_ALT'] || safeClient['OD_PERTO_ALT'] || safeClient['odPertoAlt'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoDp || osData['OD_PERTO_DP'] || safeClient['OD_PERTO_DP'] || safeClient['odPertoDp'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.odPertoOpa || osData['OD_PERTO_OPA'] || safeClient['OD_PERTO_OPA'] || safeClient['odPertoOpa'] || '---'}</td>
                  </tr>
                  <tr className="bg-amber-50/60">
                    <td className="border border-slate-400 py-0.5 px-1 font-black text-left text-amber-950">OE (Perto)</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoEsf || osData['OE_PERTO_ESF'] || safeClient['OE_PERTO_ESF'] || safeClient['oePertoEsf'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoCil || osData['OE_PERTO_CIL'] || safeClient['OE_PERTO_CIL'] || safeClient['oePertoCil'] || osData.oeCil || osData['OE_CIL'] || safeClient['OE_CIL'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoEixo || osData['OE_PERTO_EIXO'] || safeClient['OE_PERTO_EIXO'] || safeClient['oePertoEixo'] || osData.oeEixo || osData['OE_EIXO'] || safeClient['OE_EIXO'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoDnp || osData['OE_PERTO_DNP'] || safeClient['OE_PERTO_DNP'] || safeClient['oePertoDnp'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoAlt || osData['OE_PERTO_ALT'] || safeClient['OE_PERTO_ALT'] || safeClient['oePertoAlt'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoDp || osData['OE_PERTO_DP'] || safeClient['OE_PERTO_DP'] || safeClient['oePertoDp'] || '---'}</td>
                    <td className="border border-slate-400 py-0.5 px-1 font-bold text-slate-900">{osData.oePertoOpa || osData['OE_PERTO_OPA'] || safeClient['OE_PERTO_OPA'] || safeClient['oePertoOpa'] || '---'}</td>
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
                <th className="border border-slate-300 py-0.5 px-1.5 text-left">Item / Descrição do Produto & Detalhes</th>
                <th className="border border-slate-300 py-0.5 px-1 text-center w-24">Categoria</th>
                <th className="border border-slate-300 py-0.5 px-1 text-center w-10">Qtd</th>
                <th className="border border-slate-300 py-0.5 px-1 text-right w-20">Unit. (R$)</th>
                <th className="border border-slate-300 py-0.5 px-1.5 text-right w-24">Subtotal / Valor</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="border border-slate-300 py-0.5 px-1.5">
                    <strong className="text-slate-900 font-bold text-[8.5px]">{item.nome}</strong>
                    {item.detalhes && (
                      <span className="text-slate-600 text-[7.5px] block font-medium mt-0.5 leading-snug">
                        🔍 {item.detalhes}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-300 py-0.5 px-1 text-center text-[7.5px] font-bold text-slate-700 uppercase">
                    {item.tipo}
                  </td>
                  <td className="border border-slate-300 py-0.5 px-1 text-center font-bold text-slate-900">
                    {item.qtd}
                  </td>
                  <td className="border border-slate-300 py-0.5 px-1 text-right text-slate-800 font-mono">
                    {item.precoUnit && item.precoUnit > 0
                      ? formatCurrencyPrint(item.precoUnit)
                      : item.isPacoteIncluso
                      ? 'Incluso no Combo'
                      : item.tipo === 'Brinde / Cortesia'
                      ? 'Cortesia'
                      : (item.precoUnit === 0 ? 'R$ 0,00' : '—')}
                  </td>
                  <td className="border border-slate-300 py-0.5 px-1.5 text-right font-black text-slate-900 font-mono">
                    {item.total && item.total > 0
                      ? `R$ ${formatCurrencyPrint(item.total)}`
                      : item.isPacoteIncluso
                      ? 'R$ 0,00 (Incluso)'
                      : item.tipo === 'Brinde / Cortesia'
                      ? 'R$ 0,00'
                      : (item.total === 0 ? 'R$ 0,00' : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/90 font-black text-slate-950 border-t-2 border-slate-300">
                <td colSpan={3} className="text-right py-1 px-2 border border-slate-300 uppercase text-[8.5px] tracking-wider text-slate-800">
                  Valor do Produto / Total da Venda:
                </td>
                <td colSpan={2} className="text-right py-1 px-2 border border-slate-300 text-[10px] font-black text-slate-950 font-mono">
                  R$ {formatCurrencyPrint(displayTotal)}
                </td>
              </tr>
            </tfoot>
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
                Valor do Produto / Venda
              </p>
              <p className="font-black text-xs text-slate-950 font-mono">
                R$ {formatCurrencyPrint(displayTotal)}
              </p>
              <span className="text-[6.5px] text-slate-500 font-bold block uppercase mt-0.5">
                {isSecondary ? '(Cobrança Unificada na OS 1)' : 'Valor Total da Venda'}
              </span>
            </div>
            <div className="border border-emerald-700 p-1 text-center rounded bg-emerald-50/50">
              <p className="uppercase text-[7.5px] font-black text-emerald-800">
                {isSecondary ? 'Faturamento' : 'Sinal / Entrada Paga'}
              </p>
              <p className="font-black text-xs text-emerald-800">
                {isSecondary ? 'Faturado na OS 1' : `R$ ${formatCurrencyPrint(displayEntrada)}`}
              </p>
              {!isSecondary && parseCurrencyPrint(displayEntrada) > 0 && resolvedFormaEntrada && (
                <p className="text-[7px] font-black text-emerald-900 mt-0.5 uppercase">
                  Forma da Entrada: {resolvedFormaEntrada}
                </p>
              )}
            </div>
            <div className={`p-1 text-center rounded border ${(!isSecondary && parseCurrencyPrint(displayRestante) > 0) ? 'border-rose-600 bg-rose-50/50' : 'border-slate-400 bg-slate-50'}`}>
              <p className={`uppercase text-[7.5px] font-black ${(!isSecondary && parseCurrencyPrint(displayRestante) > 0) ? 'text-rose-700' : 'text-slate-600'}`}>
                {isSecondary ? 'Saldo Desta OS' : 'Falta / Restante'}
              </p>
              <p className={`font-black text-xs ${(!isSecondary && parseCurrencyPrint(displayRestante) > 0) ? 'text-rose-800' : 'text-slate-900'}`}>
                {isSecondary ? 'R$ 0,00 (Faturamento Único)' : `R$ ${formatCurrencyPrint(displayRestante)}`}
              </p>
              {!isSecondary && parseCurrencyPrint(displayRestante) > 0 && resolvedFormaRestante && (
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
              {(osData.voucher || safeClient['VOUCHER']) && (
                <span className="text-[7.5px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-400 px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                  <span>🎟️ Voucher: {osData.voucher || safeClient['VOUCHER']}</span>
                  {(parseCurrencyPrint(osData.descontoVoucher ?? osData.valorDesconto ?? osData.DESCONTO_VOUCHER ?? safeClient['DESCONTO_VOUCHER'] ?? safeClient.descontoVoucher) > 0) && (
                    <span className="text-emerald-950 font-bold">
                      (-R$ {formatCurrencyPrint(osData.descontoVoucher ?? osData.valorDesconto ?? osData.DESCONTO_VOUCHER ?? safeClient['DESCONTO_VOUCHER'] ?? safeClient.descontoVoucher)})
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
            {!isSecondary && (installmentsList.length > 0 || (osData.boletoTitularTipo || osData.raw?.BOLETO_TITULAR_TIPO)) && (
              <div className="mt-1 pt-1 border-t border-slate-200">
                {(osData.boletoTitularTipo || osData.raw?.BOLETO_TITULAR_TIPO) && (
                  <div className="mb-1 text-[7.5px] font-bold text-slate-700 bg-indigo-50/70 border border-indigo-200 rounded px-1.5 py-0.5 flex items-center justify-between">
                    <span>Titular / Pagador das Parcelas do Boleto:</span>
                    <span className="font-black text-indigo-950 uppercase">
                      {(osData.boletoTitularTipo || osData.raw?.BOLETO_TITULAR_TIPO) === 'responsavel'
                        ? `Responsável: ${osData.boletoPagadorNome || osData.raw?.BOLETO_PAGADOR_NOME || safeClient['Responsável Nome'] || safeClient['Responsável'] || 'Responsável Legal'}${osData.boletoPagadorCpf || osData.raw?.BOLETO_PAGADOR_CPF ? ` (CPF: ${osData.boletoPagadorCpf || osData.raw?.BOLETO_PAGADOR_CPF})` : ''}`
                        : `Cliente: ${osData.boletoPagadorNome || osData.raw?.BOLETO_PAGADOR_NOME || safeClient['Nome Completo'] || 'Cliente Titular'}${osData.boletoPagadorCpf || osData.raw?.BOLETO_PAGADOR_CPF ? ` (CPF: ${osData.boletoPagadorCpf || osData.raw?.BOLETO_PAGADOR_CPF})` : ''}`
                      }
                    </span>
                  </div>
                )}
                {installmentsList.length > 0 && (
                  <>
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
                  </>
                )}
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
              <span className="text-slate-500 font-bold block text-[7.5px] uppercase tracking-wider">Valor do Produto / Venda</span>
              <span>Total: R$ {formatCurrencyPrint(displayTotal)}</span>
            </div>
            <div className="text-[9px] font-black text-emerald-800 border-x border-slate-200">
              <span className="text-emerald-700 font-bold block text-[7.5px] uppercase tracking-wider">Entrada / Sinal</span>
              <span>Entrada: R$ {formatCurrencyPrint(displayEntrada)}</span>
              {!isSecondary && resolvedFormaEntrada && (
                <span className="block text-[7px] font-bold text-emerald-700 uppercase">({resolvedFormaEntrada})</span>
              )}
            </div>
            <div className="text-[9px] font-black text-slate-950">
              <span className="text-slate-500 font-bold block text-[7.5px] uppercase tracking-wider">Saldo Restante</span>
              <span>Restante: R$ {formatCurrencyPrint(displayRestante)}</span>
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

const PrintableOS = ({ osData, clientData }) => {
  if (!osData) return null;
  const safeClient = clientData || osData?.clientData || {};
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
        {list.map((item, idx) => {
          const parentUnit = osData?.unidade || osData?.selectedCity || osData?.CIDADE || osData?.LOJA;
          const mergedItem = {
            ...item,
            unidade: item?.unidade || item?.selectedCity || parentUnit,
            selectedCity: item?.selectedCity || item?.unidade || parentUnit
          };
          return (
            <div key={idx} className={list.length > 1 ? "os-sheet-page" : "os-sheet-page-single"}>
              <SingleOSSheet 
                osData={mergedItem} 
                clientData={item.clientData || safeClient}
                isMulti={list.length > 1}
                index={item.osIndex || (idx + 1)}
                total={item.totalOS || list.length}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};

export default PrintableOS;

