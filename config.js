// CONFIGURAÇÃO PÚBLICA: estes dados são seguros no navegador e no GitHub.
// Substitua pelos valores de Supabase > Project Settings > API.
// NUNCA coloque secret key / service_role / STRIPE_SECRET_KEY neste ficheiro.
export const CONFIG = {
  supabaseUrl: 'https://ivqcdpavtqwquwlntvkv.supabase.co', // URL público do projeto Lagoinha Café
  supabasePublishableKey: 'sb_publishable_jveI2Me4914roWUHzO5Ifg_PyNntzuB', // chave pública; nunca colocar uma chave secreta aqui
  onlinePaymentsEnabled: false, // ativar depois de testar Stripe e webhook em produção
  cafeName: 'Lagoinha Café',
  priceLabel: 'Combo 3 €',
  address: 'Rua Prof. Veiga Simão, nº 4 · Pombal',
  // Após a publicação poderá mudar o nome do repositório, mas volte a gerar o QR.
};
