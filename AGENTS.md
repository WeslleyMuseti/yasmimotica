# DIRETRIZES TÉCNICAS E PROTOCOLO DE COMPATIBILIDADE - YASMIN ÓTICA

Este arquivo estabelece as regras obrigatórias de desenvolvimento para qualquer manutenção ou adição de novas funcionalidades no sistema da Yasmin Ótica.

---

## 1. Regra de Ouro: Auditoria de Funções Substituídas e Campos Legados
Sempre que qualquer função, componente, regra de negócio ou campo do sistema for alterado ou substituído:
1. **Mapeamento Global:** Realizar busca em todo o código (`src/`) para mapear todos os locais onde a função ou campo é lido, gravado ou referenciado.
2. **Blindagem de Compatibilidade:** Garantir que registros antigos (vindos de importações legadas de planilhas Excel/Google Sheets ou versões anteriores do Firestore) continuem funcionando normalmente sem quebras.
3. **Sem Efeitos Colaterais:** Assegurar que alterações em um módulo (ex: Perfil do Cliente) reflitam de forma idêntica e sem distorções nos demais módulos (PDV, Gestão de OS, Financeiro/Carnê, Laboratório e Relatórios).

---

## 2. Sincronização Simétrica Obrigatória de Aliases

O sistema possui campos com variações históricas de nomenclatura. Em **qualquer operação de gravação ou atualização**, todos os aliases correspondentes devem ser atualizados em conjunto:

### Identificadores de Ordem de Serviço (OS):
Ao gravar ou editar o número de uma OS, atualizar obrigatoriamente:
* `'OS DA VENDA'`
* `'OS'`
* `'VENDA_OS'`
* `'OS da COMPRA'`
* `'OS da VENDA'`
* `'Nº DA OS'`
* `'Num OS'`
* `numeroOS`
* `osNumber`
* `osNumero`
* `os`
* `allLinkedOS` (atualizando o número alterado no array de OSs vinculadas da venda)

### Identificação de Paciente / Beneficiário:
Ao registrar ou editar o titular ou dependente da OS:
* `'PACIENTE'`
* `'NOME_BENEFICIARIO'`
* `'CLIENTE_BENEFICIARIO'`
* `'nomePessoa'`
* `'beneficiario'`

### Datas e Horários da Venda / Movimento:
* `'DATA  DA VENDA'`
* `'DATA DA VENDA'`
* `'DATA_VENDA'`
* `'Data da Venda'`
* `'data_venda'`
* `'DATA'`
* `'dataHora'` / `'DATA_HORA'`
* `'timestamp'`
* `'hora'` / `'HORA'`

### Valores e Formas de Pagamento:
* Total: `'VALOR TOTAL'`, `'VALOR'`, `'VALOR DA VENDA'`
* Entrada/Sinal: `'VALOR ENTRADA'`, `'SINAL'`
* Saldo Restante: `'RESTANTE'`
* Métodos: `'FORMAS_PAGAMENTO'`, `'FORMA_PAGTO'`, `'MEIO_PAGAMENTO'`

---

## 3. Unificação de Bases de Vendas
As bases de dados de vendas (`Registro_Vendas`, `BD MARKETING`, `VENDAS`) são unificadas via `unifiedSalesData`. Qualquer atualização (`handleRowUpdate`) em uma linha de venda deve refletir em todas as coleções existentes para evitar que registros legados com dados antigos reapareçam na interface.

---

## 4. Checklist Pré-Entrega
Antes de concluir qualquer tarefa solicitada:
1. Validar integridade e compilação de produção com `npm run build`.
2. Rodar suite de testes automatizados com `node test-suite.mjs`.
3. Empacotar `site-hostinger-public_html.zip` na Área de Trabalho (Desktop) para deploy fácil na Hostinger.
4. Commitar e enviar as alterações para a branch `main` do GitHub (`origin/main`).
5. Garantir que o servidor local `npm run dev` esteja ativo e respondendo na porta 5173.
