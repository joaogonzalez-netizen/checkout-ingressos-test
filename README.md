# Checkout de Ingressos — Fase 1 (Fundação)

Checkout próprio para substituir a Sympla, com Asaas (cartão e Pix) e backoffice de eventos.
Segue o doc **Arquitetura MVP – Checkout de Ingressos** e as abas de PRD (Checkout e Backoffice).

Stack: Next.js 16 (App Router) · Prisma 7 · Postgres · TypeScript.

## Rodar localmente

```bash
npm install
cp .env.example .env        # preencha os segredos (openssl rand -base64 32)
npm run db                  # terminal 1: Postgres embutido (PGlite) na porta 54329
npm run db:migrate          # terminal 2
npm run db:seed             # cria o admin do .env e o evento de exemplo
npm run dev
```

- Backoffice: http://localhost:3000/admin (login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Página de vendas de exemplo: http://localhost:3000/e/ivangelica-belo-horizonte-2026-11-20

**Sem `ASAAS_API_KEY` o app roda em modo simulado**: a cobrança abre uma fatura local em
`/dev/asaas/[id]`, com botões para aprovar, recusar ou deixar vencer. Esses botões passam pelo mesmo
handler do webhook real. O modo simulado nunca liga em produção.

PGlite tem uma única sessão para todas as conexões. Por isso o `.env` de dev usa `DATABASE_POOL_MAX=1`.
Com Postgres de verdade, remova a variável e crie migrations com `npx prisma migrate dev`.

## O que a Fase 1 entrega

| Área | Entregue |
| --- | --- |
| Backoffice | Login (perfil admin), artistas (paleta com alerta de contraste WCAG, pixel, padrões), wizard do evento em 6 etapas com rascunho salvo a cada etapa, preview desktop/mobile, publicar/despublicar/encerrar, lista de participantes, auditoria (BO-11) |
| Página de vendas | Template único portado do `ivangelica-checkout.html`, com cores do artista, mapa de poltronas, lotes, taxa de 10%, parcelamento 1/2/3/6x sem juros e 12x com juros |
| Pagamento | Asaas: Pix (QR na página, com polling) e cartão (fatura hospedada da Asaas, sem dado de cartão no nosso backend) |
| Confirmação | Webhook autenticado (`asaas-access-token`) e idempotente; o pedido só vira "pago" após confirmação. Consulta ativa à Asaas como fallback |
| Estoque | Reserva atômica de lote e poltrona por 15 min; cron libera reservas vencidas depois de confirmar com a Asaas |
| Pixel | Snippet do Meta montado a partir do ID; ViewContent, InitiateCheckout e AddPaymentInfo no browser + CAPI; Purchase server-side com o mesmo `event_id` |
| Ingresso | Emitido no pagamento: código de 4 caracteres sem 0/O/1/I/L e QR com payload HMAC (a entrega por e-mail/WhatsApp é a Fase 2) |
| Mídia | Upload de logo, header do site (desktop 16:9 e celular 4:5), og:image e vídeo da VSL (formato Reels 9:16, até 2 min e 100 MB). O artista define os padrões e o evento pode sobrescrever. Imagens convertidas para WebP (og:image em JPEG) |
| Conferência (teste) | Modo lista do BO-09: contador, validação por código ou QR (digitado ou leitor USB), check-in pela lista, desfazer com motivo, filtros e CSV. Em dev, botão que gera 10 participantes de teste |

## Informações da página de vendas

- **Configurações** (uma vez): razão social, CNPJ, endereço e contatos de quem vende (Decreto 7.962/2013), textos de meia-entrada (Lei 12.933/2013), política de cancelamento (CDC art. 49) e "Entenda a taxa". Os textos padrão estão em `src/lib/legal-defaults.ts` e **precisam de revisão jurídica**.
- **Por evento** (wizard): classificação indicativa (obrigatória para publicar), término, descrição, regras de acesso e descrição de cada lote.
- **Checkout**: aceite obrigatório de Termos + Privacidade + cancelamento e opt-in de marketing opcional, desmarcado (`orders.marketing_opt_in`, também no CSV da Conferência).

## Acesso ao backoffice (Usuários)

- Menu **Usuários** → "Liberar acesso": nome, e-mail e senha temporária. No primeiro login a pessoa é obrigada a criar a própria senha.
- Política de senha (`src/lib/password-policy.ts`, conferida na tela e no servidor): 12+ caracteres, maiúscula, minúscula, número e símbolo; sem o nome/e-mail; sem senhas comuns; sem 3 caracteres iguais seguidos. Hash bcrypt custo 12.
- 5 senhas erradas seguidas bloqueiam a conta por 15 min. Conta desativada responde igual a senha errada.
- Desativar, redefinir ou trocar a senha incrementa `sessionVersion` e derruba todas as sessões abertas.
- Não dá para desativar a si mesmo nem o último admin ativo. Tudo fica no `audit_log`.
- v1: todo usuário é Admin (acesso total). Os perfis Produtor/Supervisor/Operador já existem no banco.

## Configurar a Asaas

1. Crie a chave de API (sandbox primeiro) e coloque em `ASAAS_API_KEY`, com `ASAAS_ENV=sandbox`.
2. Em Integrações → Webhooks, aponte para `https://SEU_DOMINIO/api/webhooks/asaas` com o token
   de `ASAAS_WEBHOOK_TOKEN`. Eventos: cobranças (confirmada, recebida, vencida, removida, estornada, reprovada).
3. Cadastre o domínio do app na Asaas para o redirecionamento após o pagamento com cartão (`callback.successUrl`).
4. Agende `GET /api/cron/expire-holds` a cada minuto com `Authorization: Bearer $CRON_SECRET`.
   O `vercel.json` já faz isso. Cron por minuto exige plano Pro na Vercel.

## Pendências e decisões registradas

- **Homologar o payload do webhook com a Asaas** antes de produção (pendência da Arquitetura).
- **Juros do 12x**: `INSTALLMENT_12X_MONTHLY_RATE` em `src/lib/money.ts` está em 2,99% a.m. só como referência. Confirmar com o financeiro.
- Compra de 1 ingresso por pedido, como no template atual.
- Preço mínimo por lote de R$ 5,00 (mínimo da Asaas). Cortesia gratuita fica para o P2.
- **Storage de mídia**: em dev os arquivos ficam em `./.uploads` e são servidos por `/media/...`. Na Vercel o disco não persiste: antes de produção, troque `src/lib/storage.ts` por S3/R2 + CDN (mesma interface).
- Formatos de upload: `src/lib/media-rules.ts` (a mesma regra vale na tela e no servidor). SVG não é aceito por risco de XSS.
- A duração do vídeo é lida pelo navegador; o servidor confere o limite e o tipo do arquivo, mas não decodifica o vídeo.
- Fase 2 (envio do ingresso) e Fase 3 (webapp de check-in com câmera, offline e PIN) têm tabelas prontas
  (`tickets`, `checkin_access`), mas ainda não têm telas. A Conferência em lista já usa a mesma checagem de "já usado".
