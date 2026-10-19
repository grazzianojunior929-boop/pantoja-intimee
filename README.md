# Pantoja Intimeé · Loja Virtual

Loja virtual de moda íntima feminina da **Pantoja Intimeé** ([@pantojaintimee01](https://www.instagram.com/pantojaintimee01/)), Aliança - TO.

## O que tem

**Loja (clientes)**
- Página inicial com a identidade da marca, categorias, destaques, kits, feedbacks e perguntas frequentes
- Catálogo com filtro por categoria e busca
- Página de produto com galeria de fotos, tamanhos/variações com estoque, quantidade e produtos relacionados
- Sacola de compras (fica salva no navegador) com barra de frete grátis
- Finalização em duas opções:
  - **WhatsApp:** o pedido fica registrado no painel e a mensagem com o resumo abre pronta no WhatsApp da loja (sem taxas)
  - **Cartão (Stripe):** pagamento online. O pedido é confirmado automaticamente e o estoque é baixado
- Página de acompanhamento do pedido (`/pedido/CÓDIGO`)
- Aviso de maioridade (18+), responsiva, em português

**Painel (`/admin`)**, com login
- Resumo: pedidos para tratar, vendas do mês e alerta de estoque baixo
- Pedidos: lista, detalhes, contato da cliente pelo WhatsApp e mudança de status
  (o estoque é baixado ao confirmar e devolvido ao cancelar)
- Produtos: criar, editar, ocultar e excluir, com preço, preço "de", categoria, etiqueta, destaque, **fotos** (envio direto pelo painel), **tamanhos e estoque** por tamanho
- Categorias: criar, renomear, ordenar e escolher ícone
- Conta: trocar a senha

Os preços e o estoque são sempre conferidos no servidor, então ninguém consegue alterar o valor pelo navegador.

## Testar no Windows (sem programar)

1. Instale o **Node.js** (versão LTS) em <https://nodejs.org/pt>
2. Extraia a pasta da loja e dê dois cliques em **`iniciar-loja.bat`**
3. O navegador abre a loja em `http://localhost:3000`. O painel fica em `http://localhost:3000/admin`
   (login de teste: `admin@pantojaintimee.com.br` / `pantoja123`)

Para desligar, feche a janela preta. Os pedidos, produtos e fotos ficam salvos na pasta `data`.

## Rodar no computador

Requer **Node.js 22.5 ou mais novo**.

```bash
npm install
cp .env.example .env      # preencha ADMIN_SENHA e SESSION_SECRET
npm start                 # http://localhost:3000  ·  painel em /admin
npm test                  # testes automáticos
```

Na primeira execução a loja é preenchida com **produtos de exemplo** e o administrador é criado com `ADMIN_EMAIL` / `ADMIN_SENHA`. Se `ADMIN_SENHA` ficar vazio, uma senha é gerada e mostrada no terminal.

## Configuração (`.env`)

| Variável | Para que serve |
|---|---|
| `WHATSAPP` | Número da loja com DDI e DDD, só dígitos (ex.: `5563992783793`) |
| `ADMIN_EMAIL`, `ADMIN_SENHA` | Primeiro acesso ao painel |
| `SESSION_SECRET` | Texto aleatório longo que protege o login |
| `BASE_URL` | Endereço público do site, usado no retorno do pagamento |
| `FRETE_FIXO_CENTS`, `FRETE_GRATIS_CENTS` | Frete em centavos (padrão: R$ 20,00, grátis a partir de R$ 199,00) |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe. Sem ela, só o WhatsApp aparece |
| `STRIPE_WEBHOOK_SECRET` | Segredo do webhook do Stripe |
| `DATA_DIR` | Pasta do banco de dados e das fotos |

### Ativar o cartão (Stripe)

1. Crie a conta em <https://dashboard.stripe.com> e copie a **chave secreta** (`sk_test_…` para testar, `sk_live_…` para valer) em `STRIPE_SECRET_KEY`.
2. Em *Developers → Webhooks*, adicione o endpoint `https://SEU-SITE/api/stripe/webhook` com os eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` e `checkout.session.async_payment_failed`.
3. Copie o *Signing secret* (`whsec_…`) em `STRIPE_WEBHOOK_SECRET` e reinicie.

Para testar, use o cartão `4242 4242 4242 4242`, com qualquer validade futura e qualquer CVC.

## Hospedagem

A loja tem servidor e banco de dados, por isso **não roda no GitHub Pages** (que só serve páginas estáticas). Use um serviço que rode Node.js com **disco persistente** (o banco e as fotos ficam em `DATA_DIR`):

- **Render:** o arquivo `render.yaml` já está pronto (plano com disco)
- **Railway** ou **Fly.io:** use o `Dockerfile` e monte um volume em `/app/data`
- **VPS** (Hostinger, DigitalOcean etc.): `npm ci --omit=dev && npm start`, atrás de HTTPS

Em produção, defina `NODE_ENV=production`, `BASE_URL`, `SESSION_SECRET` e `ADMIN_SENHA`.

## Estrutura

```
server.js          inicialização e configuração
src/app.js         rotas da API, Stripe e painel
src/loja.js        catálogo, carrinho, pedidos e estoque
src/db.js          banco SQLite (embutido no Node)
src/auth.js        senha e sessão do painel
src/seed.js        produtos de exemplo
public/            loja (index.html) e painel (admin.html)
test/              testes automáticos
```

## Próximas fases

- Pix e Mercado Pago
- Cálculo de frete por CEP (Correios / Melhor Envio)
- Cupons de desconto
