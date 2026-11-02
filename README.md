# ☕ Lagoinha Café · Sistema de pedidos QR Code

**Versão 1.0 — projeto inicial funcional, com demonstração sem credenciais.**

> Este pacote contém o site/PWA, painel da cozinha, caixa, ecrã de retirada, administração, SQL de produção com Row Level Security, Edge Functions para checkout Stripe e webhook seguro e um QR Code para impressão após a publicação.

## Funcionalidades

| Área | O que faz |
|---|---|
| Visitante / `#/menu` | Escolhe pão de queijo ou misto, café preto ou café com leite, quantidade, pagamento online ou no balcão, recebe senha |
| Senha / `#/ticket/UUID` | Acompanha a situação da encomenda sem criar conta |
| Equipa / `#/staff` | Conta autorizada, confirma pagamento presencial, inicia preparo, marca pronto e entregue |
| Ecrã / `#/pickup` | Exibe senhas prontas, para projetar num ecrã/TV |
| Admin / `#/admin` | Abre/fecha pedidos, muda preço, gere produtos, stock, vendas registadas e exportação CSV |
| QR / `#/qr` | Fornece QR para os clientes abrirem o site |

## Primeiro teste (sem Supabase)

Existe um ficheiro único `DEMO_Lagoinha_Cafe.html` que pode abrir no navegador. O modo demonstração também funciona ao servir a pasta localmente com um servidor estático:

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080/#/menu`, monte um pedido com **Pagamento no balcão**, veja a senha, aceda a Equipa, confirme o pagamento, marque como pronto e veja o ecrã de Retirada. **É uma simulação com localStorage; não envia pedidos reais, não processa pagamentos nem partilha dados entre dispositivos diferentes.**

## Publicar no GitHub Pages

1. No seu GitHub `rafaelgiacometti-beep`, crie um **repositório público vazio chamado `lagoinha-cafe`** (este repositório ainda não existe; não substitua `rg3d` nem `fluxo-pro`).
2. Envie o **conteúdo de dentro** desta pasta para a raiz da branch `main` do repositório; inclua `.github/workflows/deploy.yml`.
3. No GitHub: **Settings → Pages → Build and deployment → GitHub Actions**.
4. Quando o workflow terminar, o endereço será `https://rafaelgiacometti-beep.github.io/lagoinha-cafe/#/menu`.
5. Até configurar Supabase, o site publicado abrirá **apenas em modo DEMONSTRAÇÃO**. Não divulgue o QR como sistema de vendas antes de concluir as etapas abaixo.

O projeto é estático e NÃO precisa de `npm install` nem build; o workflow publica os ficheiros diretamente. Não coloque segredos no repositório.

## Supabase: ativar funcionamento real

1. O projeto exclusivo **lagoinha-cafe** já foi criado (ref `ivqcdpavtqwquwlntvkv`) e está separado dos demais sistemas.
2. A migração `lagoinha_cafe_initial_schema` já foi executada e verificada em 02/11/2026. **NÃO execute novamente `sql/001_schema.sql` neste projeto**, pois as tabelas já existem.
3. O ficheiro `config.js` já contém o URL e a chave pública do projeto novo. Nunca utilize service_role ou chaves privadas no repositório.
4. Em **Authentication → Users**, crie/invite o utilizador administrativo com email e palavra-passe. Copie o seu **User UID**.
5. No SQL Editor, autorize o gestor (substitua o UUID real):

```sql
insert into public.staff_roles(user_id,role)
values ('UUID-REAL-DO-UTILIZADOR','admin');
```

6. Para voluntários adicionais, crie utilizadores no Auth e atribua `cashier` (caixa) ou `kitchen` (cozinha). **Nunca** disponibilize criação livre de contas de staff no site.
7. No painel de Administração, abra **Receber novos pedidos** apenas quando a equipa estiver preparada e os preços/produtos estiverem corretos. Por segurança o SQL inicial deixa a loja fechada.

**Registo dos pedidos:** no modo real, mesmo que a pessoa feche o navegador, os dados ficam no Supabase. As senhas reiniciam a 001 por dia local de Portugal (`Europe/Lisbon`). A confirmação de pedido presencial só pode ser feita por `admin` ou `cashier`. A cozinha só recebe pedidos pagos.

## Stripe: pagamentos online

**IMPORTANTE:** o checkout online está implementado, mas só funcionará após configurar Stripe e publicar as Edge Functions. O botão não valida pagamentos com base no simples regresso ao site; usa um webhook Stripe assinado.

1. Ative uma conta Stripe da organização e verifique o enquadramento legal/fiscal e os métodos de pagamento disponíveis para a entidade.
2. Instale a [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), autentique-se e ligue ao ID do projeto: `supabase login` e `supabase link --project-ref SEU_PROJECT_REF`.
3. No Supabase, configure as secrets, **nunca no frontend** (pode utilizar o Dashboard → Edge Functions → Secrets):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_... SITE_URL=https://rafaelgiacometti-beep.github.io/lagoinha-cafe/
```

4. Faça deploy:

```bash
supabase functions deploy create-cafe-checkout
supabase functions deploy stripe-webhook
```

5. No [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), crie um destino para `https://SEU_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`. Subscreva **`checkout.session.completed`** e **`checkout.session.async_payment_succeeded`**.
6. Copie o segredo do endpoint (`whsec_...`) para Supabase secrets:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy stripe-webhook
```

7. **Teste primeiro em modo de testes Stripe**, com pedidos fictícios e verifique que a cozinha recebe *apenas* encomendas com `payment_status=paid`. Depois valide a migração para as chaves de produção.

A função de checkout deixa que Stripe apresente os métodos elegíveis/configurados (cartão e outros, se disponíveis). **MB WAY depende de elegibilidade e ativação na Stripe; não foi prometido como método nativo.**

### Nota importante de operação

- Pagamentos no balcão exigem confirmação manual da equipa.
- Pedidos online pendentes não podem ser marcados como pagos manualmente.
- Se o cliente abandonar o pagamento Stripe, o pedido fica pendente: a equipa deve rever esses pedidos e verificar o estado na Stripe antes de cancelá-los. **A limpeza automática de reservas e devoluções ainda não está incluída na versão 1.0.**
- Stock opcional é reservado quando o pedido é registado. Em produtos sem limite, deixe o stock vazio. Se utilizar stock finito, faça uma reconciliação manual dos pedidos online não pagos antes de encerrar o dia.
- Pedidos por QR Code podem ser alvo de abuso se o link circular fora da igreja. Nesta versão há limite de 20 combos por pedido e controlo manual de abertura; para maior escala, adicione proteção contra spam/captcha e rate limits no servidor.
- **Não substitui a faturação fiscal** nem emite faturas. Confirme com o contabilista e o município as regras de venda recorrente de alimentos, informação sobre alergénios, meios de pagamento e registos fiscais.

## Ficheiros

- `index.html`, `styles.css`, `app.js`, `config.js`: interface PWA
- `manifest.webmanifest`, `sw.js`, `assets/icon.svg`: instalação no telemóvel/offline da interface (dados reais exigem rede)
- `sql/001_schema.sql`: tabelas, políticas RLS e funções de negócio
- `supabase/functions/create-cafe-checkout/index.ts`: sessão Checkout sem segredos no cliente
- `supabase/functions/stripe-webhook/index.ts`: verificação de assinatura e pagamento
- `.github/workflows/deploy.yml`: publicação automática no GitHub Pages
- `assets/qr-github-pages.png`: QR preparado para o URL esperado; **só imprima depois de confirmar a publicação e configurar o modo real**

## Segurança e privacidade

Sem nomes, números de telefone ou emails de clientes são necessários para o pedido inicial, e o ecrã de retirada apresenta apenas senhas. O token da encomenda é privado e imprevisível. Na versão real as tabelas estão protegidas por RLS e as mutations críticas são feitas por funções Postgres/Edge Functions. Faça testes de acesso de clientes e de voluntários sem privilégios antes de colocar em produção.

## Estado da instalação — 02/11/2026

- Projeto Supabase **criado** com custo cotado de 0 €/mês, região eu-west-2.
- Base de dados: **7 tabelas com RLS, 4 produtos e combo de 3 €**, verificados.
- Encomendas: **FECHADAS** até configurar o primeiro administrador e testar.
- Chaves: `config.js` ligado ao Supabase real por chave **publishable**.
- Pagamentos online: **desativados** na interface (`onlinePaymentsEnabled: false`) até configurar a Stripe e verificar o webhook.
- GitHub: repositório `rafaelgiacometti-beep/lagoinha-cafe` criado; ainda é necessário enviar os ficheiros da aplicação e ativar Pages.

**Nunca imprima ou distribua o QR Code antes de verificar o site e fazer encomendas reais de teste com o caixa.**
