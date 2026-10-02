# Regras das páginas de venda

Documento de regras das páginas públicas de venda de ingressos: a página do evento (`/e/{slug}`), a confirmação do pedido (`/pedido/{id}`) e a consulta **Meus ingressos** (`/meus-ingressos`). Descreve o que o sistema **faz hoje**, conferido no código em 02/10/2026 (branch `feat/checkout-fase-1`).

**Como ler**
- **Regra:** o sistema impõe. O arquivo está entre parênteses quando ajuda a achar.
- **Pendente:** promessa ou combinado que ainda não existe. Fica na seção 13.

Documento irmão: [Regras do Backoffice](./regras-backoffice.md) (de onde vêm os dados desta página).

---

## 1. Endereços e quando a página existe

| Endereço | O que é |
|---|---|
| `/` | Abre o evento escolhido em Configurações → "Evento da página inicial". Se esse evento não estiver publicado (ou estiver arquivado), vai para o backoffice. |
| `/e/{slug}` | Página de venda do evento. O slug segue `{artista}-{cidade}-{data}`. |
| `/pedido/{id}?t=…` | Confirmação e acompanhamento de um pedido. Só abre com o código secreto do pedido. |
| `/meus-ingressos` | Consulta dos ingressos pagos. |
| `/preview/{id}` | Pré-visualização para o backoffice (exige login). Nunca é pública. |

**Situação do evento → o que o público vê**
- **Rascunho:** a página **não existe** (erro 404).
- **Publicado:** a página vende.
- **Vendas encerradas:** uma tela simples com o nome do show, o aviso "As vendas deste evento foram encerradas" e, se houver, o link para a agenda do artista.
- **Arquivado:** quem arquiva um evento publicado encerra as vendas.
- Antes de mostrar a página, o sistema **libera as reservas vencidas** do evento, para o estoque aparecer correto.
- **Produção sem a chave da Asaas** não vende: ao finalizar, o comprador vê "As vendas online ainda não foram abertas".

## 2. Estrutura da página, de cima para baixo

1. **Faixa de aviso** (só em ambiente de teste): "Ambiente de teste · os pagamentos são simulados e nenhum valor é cobrado".
2. **Topo fixo:** logo do artista (ou o nome, sem logo), link **Meus ingressos** e o botão claro/escuro. Não há link "voltar para a agenda" no topo.
3. **Primeira dobra (hero)**, descrita na seção 3.
4. **Chamada (VSL):** título, texto, botão e, se houver, o vídeo no formato Reels.
5. **Informações do evento:** descrição, informações importantes, tipos de ingresso, meia-entrada, política do evento, local e produtor.
6. **Finalize sua compra:** a compra em 2 etapas (seção 4). **Vem depois das informações**, não antes.
7. **Rodapé:** formas de pagamento, compra segura, "Já comprou?", ajuda, dados do vendedor, Termos e Privacidade.

A ordem das seções é uma regra: informar primeiro, comprar depois. Os botões de compra levam o visitante à seção 6 sem sair da página.

## 3. Primeira dobra (hero)

- **Fundo:** a capa do evento desfocada e **sempre escurecida**, em qualquer arte e nos dois temas. Sem capa, um degradê escuro com a cor do artista. O texto do hero é sempre claro.
- **Esquerda:** título do show em maiúsculas (é o `h1` da página), **data, horário e local com ícones**, endereço em destaque que abre o mapa, selo de **classificação indicativa**, selo **"Parcele em até 12x"** e o botão **Comprar ingressos** com "a partir de R$ …".
- **Direita:** a **capa inteira, sem corte**, em cartão arredondado, com o botão branco **Compartilhar** sobre a borda de baixo.
- **No celular** a capa vem primeiro e as informações logo abaixo. A capa encolhe (sem cortar) o quanto for preciso para que **título, data, local e o botão de compra apareçam na primeira tela**, contando as faixas de aviso e o topo fixo.
- **Capa:** a de celular (vertical, 4:5) é usada em telas de até 640 px; sem ela vale a do desktop. Evento sem capa própria herda a do artista.
- O horário mostra início e, se cadastrados, portões e término; sem esses dados aparece "Horários referentes ao local do evento".
- **"a partir de R$ …"** é o menor preço entre os lotes ainda à venda. Se tudo esgotar, o botão vira **"Ver ingressos"**.
- **Compartilhar** usa o menu do celular; no computador copia o link e mostra "Link copiado!".

## 4. Compra em duas etapas

A compra tem **duas etapas**, e a segunda só abre pelo botão **Continuar →**.

**Etapa 1: Ingressos**
- Sem lugar marcado: cartões de ingresso com **− / +**. Cada cartão mostra nome, descrição, preço, "(+ R$ taxa)", "em até 12x R$ …", prazo de venda, "Esgotado" quando for o caso e o link "Quem tem direito à meia-entrada?" nos lotes de meia.
- Com lugar marcado *(hoje desativado, ver seção 13)*: mapa de poltronas e escolha de um lote.
- **O botão Continuar fica bloqueado** até haver ao menos 1 ingresso (e, com lugar marcado, uma poltrona). Uma frase ao lado avisa o que falta.
- Abaixo do botão aparece "N ingressos · R$ total".
- "Entenda nossa taxa" abre a explicação da taxa de serviço.

**Etapa 2: Dados e pagamento**
- Resumo da etapa 1 com o link **Alterar ingressos**. Voltar não perde nada do que foi escolhido nem do que foi digitado.
- **Dados do comprador:** nome completo (nome e sobrenome), e-mail e **confirmação do e-mail** (precisam ser iguais), celular com DDD, e CPF ou CNPJ válidos.
- **Pagamento:** cartão de crédito ou Pix (seção 6).
- **Aceites:** a caixa **"Aceito os Termos de uso e a Política de privacidade" é obrigatória**; a de **receber informações de outros shows é opcional e nunca vem pré-marcada** (LGPD).
- Botão final: "Finalizar compra →" (cartão) ou "Pagar com Pix →".
- Mensagem sobre a política de cancelamento ao pé do botão.

**Comum às duas etapas**
- O indicador **"1 Ingressos · 2 Dados e pagamento"** fica acima. A etapa 1 vira ✓ quando concluída e é clicável para voltar; a 2 só abre pelo botão.
- O **resumo do pedido** (à direita no computador, abaixo no celular) fica visível nas duas etapas, com ingressos, taxa de serviço, juros do parcelamento (quando houver) e o total.
- Ao trocar de etapa a tela rola até o início da compra e o foco vai para o título da etapa (teclado e leitor de tela).
- A **validação** de cada campo mostra o erro junto ao campo.

## 5. Preço, taxa e limites

- **Taxa de serviço: 10%** do valor do ingresso, **por unidade**, mostrada separadamente antes de pagar. O texto explicando a taxa é editável em Configurações.
- **Máximo de 10 ingressos por compra**, somando todos os lotes. O limite de cada lote é o estoque restante.
- Lote **fora do período de venda** ou esgotado não aceita compra.
- **Com lugar marcado** a compra é de **1 ingresso por poltrona**. Sem lugar marcado, a poltrona não é aceita no pedido.
- O servidor **refaz todas as contas e validações** do pedido; o que o navegador mostra é só orientação.

## 6. Pagamento

**Cartão de crédito**
- Os dados do cartão são digitados **na tela segura da Asaas**, depois de finalizar. **Nenhum dado de cartão passa pelo nosso site nem fica guardado.**
- Parcelas: **1x, 2x, 3x e 6x sem juros; 12x com juros**. O valor de cada parcela aparece no seletor. A taxa de juros do 12x ainda é de referência (seção 13).

**Pix**
- É **sempre à vista**. Ao finalizar aparece o QR Code, o "copia e cola" e o botão de copiar.
- Cronômetro de **15 minutos**: esse é o tempo em que o ingresso fica reservado. Depois disso aparece "O prazo do Pix acabou" e é preciso refazer a compra.
- A tela acompanha o pagamento sozinha e confirma assim que o Pix cai.

**Reserva e estoque**
- A reserva dura **15 minutos** e é **atômica**: reserva tudo o que o comprador escolheu, ou nada. Se alguém levou o último ingresso do lote, o comprador recebe "Não há ingressos suficientes em …. Diminua a quantidade."
- Pedido que não é pago em 15 minutos expira, e o estoque volta.
- Pedido recusado, vencido ou cancelado na Asaas libera o estoque. Pedido estornado cancela os ingressos.

**Segurança da compra**
- Toda a comunicação usa HTTPS. A página **não exibe selos de certificação** que o projeto não tenha (ex.: PCI, Google Safe Browsing).
- O rodapé informa que o pagamento é processado pela Asaas e que os dados do cartão são digitados no ambiente dela.

## 7. Confirmação do pedido (`/pedido/{id}`)

- Só abre com o **código secreto do pedido** na própria URL; sem ele, a página não existe (404). Não dá para "adivinhar" pedidos de outras pessoas.
- Mostra: situação do pedido, evento, local e data, poltrona (se houver), itens, taxa, forma de pagamento, **códigos dos ingressos** e total.
- **Situações:**
  - **Aguardando confirmação:** a página se atualiza sozinha.
  - **Compra confirmada:** ingresso emitido.
  - **Pagamento não aprovado**, **prazo acabou** ou **cancelado:** nada foi cobrado; há link de volta ao evento. No cartão pendente há link para voltar ao pagamento.
  - **Estornado:** valor devolvido e ingressos cancelados.
- O **Purchase** do Pixel é enviado quando o pedido fica pago (seção 9).

## 8. Meus ingressos (`/meus-ingressos`)

Para o comprador achar os ingressos depois, sem login.

- **Dados exigidos:** o **CPF (ou CNPJ, ou celular)** **e o e-mail** usados na compra. **Os dois precisam ser do mesmo pedido.**
- **O que aparece:** só pedidos **pagos**, agrupados por evento (próximos primeiro, depois os já realizados). Cada ingresso mostra **QR Code**, código de 4 letras, lote, poltrona, nome abreviado ("Maria S.") e se está **Válido** ou **Já utilizado**.
- Resposta quando nada confere: "Não encontramos ingressos pagos com esses dados." A mensagem **não diz qual dado errou**.
- **Limite de consultas:** 10 por IP a cada 10 minutos.
- **Privacidade:** os dados vão pelo envio do formulário e **nunca aparecem na URL**; o sistema registra só um código do IP, nunca o CPF nem o e-mail digitados. A página não é indexada por buscadores.
- **Risco conhecido:** quem souber CPF **e** e-mail de outra pessoa vê os ingressos dela. Reduz o risco, mas não o elimina. A proteção forte seria um código enviado por e-mail (ver Pendências).
- O link **Meus ingressos** está no topo e, em "Já comprou?", no rodapé. Vindo de um evento, a tela usa as cores do evento e tem "Voltar ao evento".

## 9. Rastreamento (Pixel do Meta)

- Só existe o **Meta**. O pixel do evento vale; sem ele, o do artista. Sem nenhum, a página funciona sem rastrear.
- **Eventos enviados:** `PageView` ao abrir a página; `ViewContent` ao carregar; `InitiateCheckout` na **primeira interação** com a compra; `AddPaymentInfo` ao **escolher a forma de pagamento**; `Purchase` quando o pedido fica **pago**.
- Cada evento leva um **código único** (`event_id`), usado no navegador e no servidor, para o Meta **não contar em dobro**. Quando há o token da API de Conversões, o `Purchase` e o `PageView` também são enviados **pelo servidor**.
- Na API de Conversões (servidor), e-mail, telefone e CPF do comprador vão **somente em hash (SHA-256)**, nunca em texto, junto dos cookies de anúncio (`_fbp`, `_fbc`) e de dados técnicos (IP e navegador). O pixel do navegador não recebe esses dados.

## 10. Conteúdo e textos

- O que o produtor edita por evento: título da chamada, subtítulo, texto do botão, descrição, regras de acesso, classificação indicativa e sua observação, mídias.
- O que vale para todos os eventos (Configurações): regra da **meia-entrada**, **política de cancelamento**, explicação da **taxa** e dados do **vendedor** (razão social, CNPJ, endereço, contato).
- **Política de cancelamento padrão:** cancelamento em até **7 dias após a compra** (direito de arrependimento, art. 49 do CDC), desde que pedido até **48 horas antes** do evento.
- **Meia-entrada:** a página explica quem tem direito e que a **documentação é conferida na entrada**, com pagamento da diferença se não for comprovada. Se o evento **não tiver lote de meia**, a página avisa.
- Os textos legais padrão são **rascunhos**, sem revisão jurídica ainda (seção 13).
- **Classificação indicativa:** exibida em selo colorido (L, 10, 12, 14, 16, 18) e no texto "Informações importantes".
- **Audiodescrição:** botão "Ouvir descrição" lê a descrição e as informações do evento em voz alta, no navegador, em português.

## 11. Visual e comportamento

- **Cores:** vêm do artista (principal, secundária, destaque e fundo). Há **tema claro e escuro**, que o visitante alterna no topo e o navegador lembra.
- **O hero é sempre escuro**, mesmo no tema claro.
- **Mídia:** header sempre inteiro (nunca cortado), logo só reduzido (nunca cortado), vídeo em formato Reels (em pé), com o texto e o botão ao lado esquerdo no computador.
- **Layout:** pensado para celular primeiro (testado a partir de 375 px de largura) até telas grandes, sem rolagem lateral. Conteúdo principal com até 1000 px de largura.
- **Alvos de toque** de pelo menos 44 px nos botões principais.
- **Ícones:** desenhados (traço único), sem emoji na primeira dobra.

## 12. Acessibilidade

- A página tem **um só título principal** (o do show); a chamada abaixo é título secundário.
- Etapas da compra marcadas para leitor de tela, com a etapa atual anunciada. O foco vai ao título da nova etapa quando ela muda.
- Campos com rótulo visível, erro junto do campo, mensagens de erro anunciadas.
- Botões e links com **foco visível** pelo teclado.
- Textos de apoio das mídias (`alt`) descrevem a arte.
- **Audiodescrição** da descrição do evento (seção 10).

## 13. Pendências e pontos de atenção

1. **Envio de e-mail não existe.** O rodapé da compra diz "ingresso enviado por e-mail na hora", e o texto da taxa cita "envio por e-mail", **mas o sistema não envia e-mail**. Hoje o comprador vê o ingresso na confirmação e em **Meus ingressos**. É preciso implementar o envio ou corrigir esses textos **antes de vender de verdade**.
2. **Juros do 12x:** 2,99% ao mês é só referência. Confirmar com o financeiro.
3. **Lugar marcado:** o mapa de poltronas existe no código, mas a escolha está **desativada** no cadastro de eventos.
4. **Revisão jurídica** dos textos (meia-entrada, cancelamento, taxa, regras de acesso).
5. **Dados reais do vendedor** e **links reais** de Termos de uso e Política de privacidade (hoje podem estar provisórios ou vazios).
6. **Asaas em produção** (chave e webhook) e remoção do modo de demonstração para vender de verdade.
7. **Meus ingressos com código por e-mail:** depende do item 1 e fecharia o risco descrito na seção 8.
8. **Cortesia (ingresso gratuito)**, **outros pixels** (Google, TikTok) e **troca de ingresso entre pessoas:** fora desta versão.
9. **Pedidos pendentes não aparecem em Meus ingressos**, e não há link para retomar o pagamento a partir dali.
