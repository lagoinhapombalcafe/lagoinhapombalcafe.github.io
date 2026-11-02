# Lagoinha Café — PWA v2

Sistema de encomendas para os domingos das 9h às 10h na Lagoinha Pombal.

## Acessos
- **Cliente:** [Cardápio](https://rafaelgiacometti-beep.github.io/lagoinha-cafe/#/cliente) — sem cadastro, QR Code e senha.
- **Caixa:** [Caixa](https://rafaelgiacometti-beep.github.io/lagoinha-cafe/#/caixa) — confirmação de pagamento presencial e entrega.
- **Cozinha:** [Cozinha](https://rafaelgiacometti-beep.github.io/lagoinha-cafe/#/cozinha) — visualizar pagos, preparar e marcar prontos.
- **Administração:** [Administrador](https://rafaelgiacometti-beep.github.io/lagoinha-cafe/#/admin) — abrir/fechar pedidos, cadastrar produtos, preço de venda avulsa, estoque, combos, despesas, indicadores e exportação CSV.
- **Ecrã de retirada:** [Senhas](https://rafaelgiacometti-beep.github.io/lagoinha-cafe/#/retirada) — mostrar números prontos no balcão.

## Estado atual (02/11/2026)
- Publicação: GitHub Pages, deploy automático em `main`.
- Supabase project: `ivqcdpavtqwquwlntvkv`.
- Migrações executadas no servidor: `lagoinha_cafe_initial_schema` e `lagoinha_cafe_v2_avulsos_combos_financas`.
- Combo Lagoinha: 3 € por bebida e alimento escolhidos.
- Produtos existentes: pão de queijo, misto quente, café preto e café com leite.
- Produtos avulsos: preço inicial vazio; **não estão disponíveis até o administrador definir o valor**.
- Encomendas: fechadas por segurança até o primeiro teste presencial.
- Pagamento online: **desativado**. Pagamento apenas no balcão.

## Ativar primeiro administrador
1. Aceda a [Supabase → Authentication → Users](https://supabase.com/dashboard/project/ivqcdpavtqwquwlntvkv/auth/users) e use **Add user**. Indique email e uma palavra-passe segura; nunca a partilhe em chats.
2. Copie o **User UID** (UUID) do utilizador criado.
3. Em [SQL Editor](https://supabase.com/dashboard/project/ivqcdpavtqwquwlntvkv/sql/new) execute (substitua pelo UID):
   ```sql
   INSERT INTO public.staff_roles(user_id,role)
   VALUES ('UUID_DO_ADMIN','admin')
   ON CONFLICT(user_id) DO UPDATE SET role='admin';
   ```
4. Entre em `#/admin` com o email e a palavra-passe. Só admin pode abrir o café.
5. Para os restantes voluntários, crie utilizadores no Supabase Auth e atribua `cashier` ou `kitchen` na tabela `staff_roles`.

## Catálogo e estoque
- Admin → Produtos: adicionar ou editar produtos de tipo alimento/bebida, ativo/inativo, preço avulso e estoque (em branco = ilimitado).
- Admin → Combos: adicionar/editar título, descrição, preço e limite de unidades. Cada combo oferece escolha de um alimento e uma bebida disponíveis.
- Pedidos pendentes reservam o estoque; cancelar um pedido não pago repõe os artigos.
- Se clientes abandonarem encomendas sem pagar, o caixa deve cancelá-las antes do fecho, para devolver o estoque.

## Resultados
- Receita = pedidos marcados pagos no caixa.
- Despesas = lançamentos feitos na Administração → Financeiro.
- Saldo = receita menos despesas registadas.
- CSV mensal para contabilidade. O sistema não emite documentos fiscais.

## Teste obrigatório antes do QR impresso
1. Admin abre pedidos durante um teste controlado.
2. Cliente, sem sessão, encomenda combo + produto avulso, obtém senha.
3. Caixa confirma pagamento, cozinha recebe, marca pronto e entrega.
4. Senha aparece no ecrã de retirada.
5. Confirmar redução de estoque, relatório financeiro e cancelamento de pedidos não pagos.
6. Admin fecha pedidos após o teste.

**Proteção:** não partilhar service_role, senhas, segredos da Stripe nem chaves privadas. A chave `sb_publishable` no ficheiro público `config.js` é apropriada para cliente com RLS. O checkout online da versão anterior não está ativado nem incluído no fluxo v2.
