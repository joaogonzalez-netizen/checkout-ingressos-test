# Regras do Backoffice

Documento de regras do backoffice (`/admin`). Descreve o que o sistema **impõe hoje**, conferido no código em 02/10/2026 (branch `feat/checkout-fase-1`). Onde a regra vem de uma decisão de negócio, ela aparece com a origem.

**Como ler**
- **Regra:** o sistema bloqueia ou faz sozinho. O arquivo que a impõe está entre parênteses.
- **Pendente:** combinado ou promessa que ainda não existe no sistema. Fica na seção 12.

Documento irmão: [Regras das páginas de venda](./regras-paginas-de-venda.md).

---

## 1. Acesso e segurança

**Perfil.** Só existe o perfil **Admin**, e o Admin faz tudo (decisão de 27/09/2026). Não há perfis de supervisor ou de portaria nesta versão.

**Login**
- E-mail e senha. Toda a área `/admin` e as pré-visualizações exigem sessão válida; sem ela o sistema leva ao `/login` (`proxy.ts`). A checagem real acontece de novo em cada página e ação (`requireAdmin`).
- **5 senhas erradas seguidas** bloqueiam a conta por **15 minutos** (`login/actions.ts`). O bloqueio fica registrado na auditoria.
- A resposta de erro é a mesma para e-mail inexistente e senha errada, e o tempo de resposta não revela se o e-mail existe.

**Sessão**
- A sessão é um cookie assinado que carrega a *versão de sessão* do usuário. Quando a senha é trocada, redefinida ou a conta é desativada, a versão sobe e **todas as sessões abertas caem na hora** (`lib/auth.ts`, `lib/session.ts`).

**Política de senha** (`lib/password-policy.ts`), valida na tela e no servidor:
- Mínimo de 12 caracteres.
- Uma letra maiúscula, uma minúscula, um número e um símbolo.
- Sem o mesmo caractere 3 vezes seguidas.
- Não pode conter o nome nem partes do e-mail (3 letras ou mais).
- Não pode conter senhas comuns ("123456", "senha", "admin", "brasil" e semelhantes).
- A senha é guardada com bcrypt (custo 12). Nunca é guardada nem exibida em texto.

**Troca obrigatória.** Conta criada por outro admin, ou senha redefinida por outro admin, nasce com **troca obrigatória no primeiro acesso** (`/trocar-senha`). Trocar a própria senha exige a senha atual e uma nova diferente da atual.

## 2. Usuários (menu Sistema → Usuários)

- Só um admin cria usuários (`users/actions.ts`). Informe nome, e-mail e uma senha que cumpra a política. O e-mail é único.
- **Desativar** um usuário derruba as sessões dele na hora e não apaga o histórico.
- **Ninguém pode desativar o próprio acesso**, e **sempre deve restar ao menos um admin ativo**.
- **Redefinir senha** (por outro admin): define senha temporária, exige troca no próximo acesso, derruba as sessões e zera o contador de tentativas erradas.
- Toda criação, ativação, desativação e redefinição vai para a auditoria (seção 11).

## 3. Navegação

Uma só barra lateral (no celular, o botão ☰ abre a mesma barra como gaveta):

| Grupo | Itens |
|---|---|
| Principal | **Eventos** (página de abertura) · **Vendas** · **Check-in** · **Artistas** |
| Sistema | **Usuários** · **Configurações** |
| Rodapé | Conta: Minha senha · Sair |

- **Vendas** (menu): pedidos de **todos** os eventos, com busca.
- **Check-in** (menu): abre direto o evento de **hoje**; havendo mais de um, mostra a lista para escolher. Considera eventos publicados **e** com vendas encerradas, não arquivados, de hoje em diante.
- **Dentro de um evento** não há segundo menu lateral. O cabeçalho do evento tem **4 abas**: Visão geral · Vendas · Check-in · Configurar.

| Aba | Para quê |
|---|---|
| Visão geral | Acompanhar: situação, números, vendas por lote. **Não edita nada.** |
| Vendas | Pedidos deste evento. |
| Check-in | Conferência na portaria. |
| Configurar | As 6 etapas de cadastro, inclusive a **Publicação**. |

- **Rascunho novo** abre direto em **Configurar** (próxima etapa pendente). **Evento publicado** abre em **Visão geral**. Em **Configurar**, um evento já publicado abre em "Dados do evento".

## 4. Artistas

Todo evento nasce de um artista. O artista guarda a identidade que os eventos herdam.

**Dados do artista**
- Nome e **slug** (único, usado para montar o endereço dos eventos).
- **Logo** (aparece no topo das páginas de venda).
- **Cores:** escolha só a **cor principal**; o sistema sugere as outras 3 (secundária, destaque e fundo), e todas podem ser editadas. Há alerta de **contraste** quando uma combinação dificulta a leitura.
- **Header padrão** (desktop e celular) e **imagem de compartilhamento padrão**, usados por todos os eventos que não tiverem os próprios.
- Textos padrão do espetáculo e da chamada, e link de volta à agenda do artista.
- **Pixel do Meta** e token da API de Conversões, valendo para todos os eventos (cada evento pode sobrescrever). O token é guardado criptografado.

**Desativar x excluir** (`artists/actions.ts`)
- **Desativar** (arquivar): o artista some das listas e não aceita eventos novos ("Artista desativado: reative antes de criar eventos"). Nada é apagado. É a saída quando já há vendas.
- **Excluir** é definitivo e **só é permitido se nenhum evento do artista tem pedidos**, porque pedido é registro financeiro. Exige **digitar o nome exato do artista** para confirmar. Apaga os eventos, lotes, poltronas, mídias e arquivos junto.

## 5. Eventos: ciclo de vida

```
Rascunho ──(checklist completo + "Publicar")──► Publicado ──("Encerrar vendas")──► Vendas encerradas
    ▲                                              │                                      │
    └──────────────("Despublicar")─────────────────┘◄────────────("Reabrir vendas")──────┘
Qualquer estado ──("Arquivar")──► Arquivado (aba "Arquivados")
```

- **Rascunho:** não existe para o público (a página dá erro 404). Dá para pré-visualizar no backoffice.
- **Publicado:** a página vende.
- **Vendas encerradas:** a página mostra apenas o aviso de encerramento, com link para a agenda do artista se houver. **O check-in continua funcionando.**
- **Arquivar** tira o evento da lista de ativos e vai para a aba **Arquivados**. **Arquivar um evento publicado encerra as vendas** (o sistema pede confirmação). Pedidos e ingressos continuam guardados, e dá para **desarquivar**.
- **Todo o controle do ciclo de vida fica num lugar só:** Configurar → etapa 6 **Publicação** (publicar, encerrar, despublicar, reabrir, arquivar). **Despublicar** fica separado de "Encerrar vendas", com explicação e botão vermelho.
- Pedidos **nunca são apagados**, em nenhuma ação.

## 6. Eventos: as 6 etapas de Configurar

A etapa 0 (escolher o artista) vem antes, em "Novo evento", e é obrigatória.

### Etapa 1: Dados do evento
- **Nome do espetáculo**, **local** e **endereço**.
- **Estado primeiro, depois cidade**, escolhida na lista oficial de municípios do IBGE (5.571). Digitar a cidade à mão não é aceito, para não haver erro de grafia.
- **Data e horário** não podem estar no passado. Se informada, a **abertura dos portões** deve ser antes do início. Horário de término é opcional.
- **Classificação indicativa:** Livre, 10, 12, 14, 16 ou 18 anos, com observação opcional.
- **Slug** do endereço público: padrão `{artista}-{cidade}-{data}`, editável, **único**. **Depois de publicado o slug não muda** (os anúncios já apontam para ele).

### Etapa 2: Página
- **Título da chamada (headline)** é obrigatório (4 caracteres ou mais). Subtítulo e texto do botão são editáveis.
- **Descrição do evento** e **regras de acesso** (listas começam com "- "). Há um texto padrão de regras que pode ser editado.
- **Mídias** (limites na seção 7). A tela mostra uma pré-visualização da página.
- **Imagem de compartilhamento (og:image):** obrigatória para publicar (vale a do evento ou, se não houver, a padrão do artista).

### Etapa 3: Ingressos
- **Limite de ingressos do evento:** obrigatório e maior que zero.
- **A soma das quantidades dos lotes não pode passar do limite.**
- Cada lote tem nome, categoria (inteira, meia-entrada, solidário, promocional), descrição opcional, preço, quantidade e período de venda opcional (início e fim; o fim não pode ser antes do início).
- **Preço mínimo de R$ 5,00** por lote (mínimo da Asaas). Cortesia gratuita ainda não existe.
- **Lote com vendas ou reservas:** a quantidade não pode ficar abaixo do que já foi vendido ou reservado; **o preço não pode ser reduzido**; **o lote não pode ser removido**. Para parar de vender, preencha o "Fim da venda".
- Lote que já aparece em pedidos antigos também não pode ser removido.
- Se outra pessoa mexer no mesmo evento ao mesmo tempo, o sistema avisa e pede para recarregar.

### Etapa 4: Lugares
- **Sem lugar marcado** é o padrão. **Lugar marcado está desativado** por enquanto (aparece como segunda opção, bloqueada).
- *(Preparado para depois:)* mapa simples em grade, de 1 a 26 fileiras (A–Z) e de 1 a 60 poltronas por fileira. Com poltrona vendida ou reservada, fileiras e assentos não mudam, e o evento não deixa de ser de lugar marcado.

### Etapa 5: Pixel e rastreamento
- Só o **Pixel do Meta** nesta versão. O evento herda o pixel do artista e pode ter o próprio.
- O Pixel ID tem só números (6 a 20). Há botão de **teste**, que envia um evento de verificação.
- Sem pixel (nem no artista, nem no evento), a página funciona normalmente, sem rastreamento.

### Etapa 6: Publicação
- **Pré-visualização** da página no desktop e no celular, na mesma tela.
- **Checklist**: o botão **Publicar** só libera com todos os itens cumpridos, e cada item pendente é um link para a etapa que falta:
  1. Nome do espetáculo
  2. Estado e cidade da lista oficial
  3. Local e endereço
  4. Data e horário no futuro
  5. Classificação indicativa
  6. Slug da URL
  7. Título da chamada
  8. Imagem de compartilhamento
  9. Limite de ingressos definido
  10. Ao menos um lote
  11. Soma dos lotes dentro do limite
  12. Tipo de lugar definido
  13. Mapa de poltronas gerado (só para lugar marcado)
- Depois de publicar, o sistema volta à Visão geral com a confirmação.
- **Evento publicado:** as alterações salvas nas etapas **entram no ar na hora**. Toda edição de evento publicado vai para a auditoria.
- Em qualquer etapa, **Salvar** guarda o rascunho; **Salvar e continuar** guarda e avança.

## 7. Mídias (imagens e vídeo)

Aceitos: JPG, PNG e WebP para imagens; MP4 (H.264) e MOV para vídeo. **SVG não é aceito** (poderia executar script). O servidor sempre reprocessa as imagens (converte para WebP, ou JPEG no caso da og:image).

| Item | Tamanho recomendado | Limite do arquivo |
|---|---|---|
| Logo | Horizontal, 600 × 150 px (altura mínima 120 px); PNG transparente é o ideal | 1 MB |
| Header desktop | 1920 × 1080 px (16:9) | 5 MB |
| Header celular (opcional) | 1080 × 1350 px (4:5, vertical) | 5 MB |
| Imagem de compartilhamento | 1200 × 630 px (1,91:1), recortada para 1200 × 630 | 5 MB |
| Vídeo da chamada | **Em pé, 9:16** (formato Reels), 1080 × 1920 px | **100 MB** e **até 2 minutos** |

- **O header aparece inteiro, sem corte.** Se o header celular não existir, o celular usa o do desktop. Evento sem header próprio herda o do artista.
- O **vídeo** só é aceito em pé (9:16, com tolerância de 10%). O envio vai direto do navegador para o armazenamento, por isso o limite de 100 MB e não o de 4,5 MB das funções. Gravado no iPhone: ajuste **Câmera › Formatos › Mais Compatível**, senão o vídeo sai em HEVC e não toca no Chrome.
- A tela de upload mostra o formato, o tamanho e a prévia antes de salvar.

## 8. Dinheiro e vendas (regras de preço)

Regras fixas da plataforma, que o administrador não edita (`lib/money.ts`):

- **Taxa de serviço: 10%** sobre o valor do ingresso, calculada **por unidade** e somada. Quem compra paga o ingresso mais a taxa (decisão de 27/09/2026).
- **Máximo de 10 ingressos por compra**, somando todos os lotes.
- **Parcelamento no cartão:** 1x, 2x, 3x e 6x **sem juros**; **12x com juros**. **Pix é sempre à vista.** A taxa de juros do 12x (2,99% ao mês) é só um valor de referência (ver Pendências).
- **Reserva de 15 minutos** assim que o pedido é criado. Se o pagamento não confirma, a reserva é liberada sozinha (limpeza diária automática e também ao abrir a página do evento).
- A reserva é **atômica**: ou reserva tudo o que o comprador escolheu, ou nada. Não existe venda acima da quantidade do lote.
- Dinheiro é guardado em **centavos**; datas em UTC e exibidas no horário de Brasília.

## 9. Vendas (pedidos)

- **Menu Vendas** (todos os eventos) e **aba Vendas** do evento usam a mesma lista, mostrando os 200 pedidos mais recentes.
- **Busca única:** nome, e-mail, telefone, CPF/CNPJ, código do ingresso (4 letras) ou número do pedido. Filtro por situação.
- **Situações do pedido:** Aguardando · Pago · Recusado · Expirado · Cancelado · Estornado.
- Pagamentos confirmam por **notificação (webhook) da Asaas**; se ela atrasar, o sistema consulta a Asaas por conta própria quando o comprador ainda está acompanhando o pedido há mais de 20 segundos. Cada notificação é processada **uma única vez** (sem duplicar ingressos).
- **Estorno e chargeback** na Asaas cancelam o pedido e os ingressos automaticamente. Não há botão de estorno no backoffice; o estorno é feito no painel da Asaas.
- Se um pagamento chegar **depois de a reserva expirar** e a vaga já tiver sido vendida, a Visão geral mostra um **alerta em vermelho** com os pedidos afetados, para estornar ou realocar à mão.
- **Dados do comprador são pessoais (LGPD).** Mostrar CPF, e-mail e telefone só para quem administra; não copiar para planilhas soltas nem mensagens.
- A pergunta "aceita receber informações de outros shows" (opcional, nunca pré-marcada) aparece como "aceita comunicações" no pedido. **Só use o contato do comprador para marketing se essa marca existir.**

## 10. Check-in

Três formas de conferir, todas caindo na mesma regra de validação (um único registro atômico, sem dar entrada duas vezes):

- **Lista:** uma busca única por nome (ignora acento), e-mail ou telefone; também aceita código ou número do pedido. Botão "Fazer check-in" por participante. Contador "Check-ins feitos X de Y". Dá para **exportar** e **imprimir** a lista.
- **Código / QR:** digitar o código de 4 caracteres (sem 0, O, 1, I, L) ou ler o QR.
- **QR assinado:** cada ingresso tem um QR com assinatura (HMAC). Se a assinatura não confere, ou o QR é de **outro evento**, o sistema recusa.
- Resultados possíveis: **válido**, **já utilizado** (mostra quando), **cancelado** (pedido estornado), **de outro evento**, **código/QR inválido**.
- **Desfazer check-in** exige um **motivo (3 caracteres ou mais)**, e fica na auditoria com quem desfez.
- Todo check-in registra o método (QR, código, lista, manual) e quem fez.
- Eventos com **vendas encerradas continuam com check-in**.
- Em ambiente de teste existe gerador de participantes fictícios.

## 11. Configurações e auditoria

**Configurações** (menu Sistema)
- **Dados do vendedor:** razão social, CNPJ (validado), endereço, e-mail e WhatsApp de contato. Aparecem no rodapé das páginas de venda.
- **Textos legais:** regra da meia-entrada, política de cancelamento e explicação da taxa. Valem para todos os eventos.
- **Evento da página inicial:** qual evento abre em `/`. Só abre se estiver publicado (ou com vendas encerradas) e não arquivado; senão o endereço principal vai para o backoffice.
- **Limpar dados de teste:** só existe no ambiente de teste (pagamentos simulados) e exige digitar **LIMPAR**.

**Auditoria** (tabela de registro)
- Registram-se: criação, desativação e redefinição de usuário; bloqueio por tentativas; edição de evento publicado; arquivar e desarquivar; exclusão de artista; check-in e seu desfazer; estornos; conflitos de pagamento tardio; consultas públicas de "Meus ingressos" (só um código do IP, nunca CPF ou e-mail).
- Os registros não têm tela no backoffice ainda; ficam no banco.

## 12. Pendências e pontos de atenção

Itens que **ainda não existem**, ou que precisam de decisão antes de vender de verdade:

1. **Envio de e-mail ao comprador não existe.** A página promete "ingresso enviado por e-mail" e o texto da taxa cita "envio por e-mail", mas o sistema não envia nada. Hoje o comprador vê o ingresso na tela de confirmação e em **Meus ingressos**. É preciso implementar o envio (confirmação de compra e ingresso com QR) ou ajustar os textos.
2. **Juros do 12x:** 2,99% ao mês é um valor de referência. Confirmar com o financeiro.
3. **Revisão jurídica** dos textos padrão (meia-entrada, cancelamento, taxa, regras de acesso).
4. **Dados reais do vendedor** em Configurações (CNPJ, endereço, contato) e **links reais** de Termos de uso e Política de privacidade.
5. **Asaas em produção:** chave de API e webhook configurados. Sem a chave, produção não abre vendas reais (modo de demonstração com pagamento simulado).
6. **Lugar marcado:** desativado. Código do mapa existe, mas a escolha está bloqueada.
7. **Cortesia (ingresso gratuito)** e **perfis além de Admin:** fora desta versão.
8. **Tela de auditoria** e **botão de estorno** no backoffice: não existem.
9. **Perfil só para a portaria** (check-in sem acesso ao resto): ainda não existe; hoje a equipe de porta precisaria ser Admin.
10. **Outros pixels** (Google, TikTok): fora do escopo. Só Meta.
