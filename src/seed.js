/* Dados de exemplo — a dona da loja substitui pelo painel /admin */
export const CATEGORIAS_EXEMPLO = [
  { slug: 'conjuntos',  nome: 'Conjuntos',    icone: 'sutia' },
  { slug: 'calcinhas',  nome: 'Calcinhas',    icone: 'calcinha' },
  { slug: 'sutias',     nome: 'Sutiãs',       icone: 'sutia' },
  { slug: 'pijamas',    nome: 'Pijamas',      icone: 'lua' },
  { slug: 'kits',       nome: 'Kits',         icone: 'presente' },
  { slug: 'cosmeticos', nome: 'Cosméticos',   icone: 'frasco' },
  { slug: 'sexshop',    nome: 'Sex Shop 18+', icone: 'coracao' },
];

const PMG = ['P', 'M', 'G'];
const PMGGG = ['P', 'M', 'G', 'GG'];

// preços em centavos
export const PRODUTOS_EXEMPLO = [
  { nome: 'Calcinha Borboleta Brilho', cat: 'calcinhas', preco: 5990, de: 7990, tag: 'Mais vendida', destaque: true, variacoes: PMG, cor: ['#e01f3d', '#7d0d1c'],
    descricao: 'Calcinha fio dental com borboleta bordada e aplicação de strass. Um detalhe que faz toda a diferença.' },
  { nome: 'Conjunto Cereja', cat: 'conjuntos', preco: 12990, tag: 'Novo', destaque: true, variacoes: PMG, cor: ['#d61f3c', '#5b0a12'],
    descricao: 'Conjunto em renda vermelha com detalhes de cerejas e cinta-liga. Delicado e provocante.' },
  { nome: 'Calcinha Personalizada com Nome', cat: 'calcinhas', preco: 6990, tag: 'Encomenda', variacoes: PMG, cor: ['#2a1216', '#5b0a12'],
    descricao: 'Calcinha com corrente e letras douradas com o nome que você escolher. Informe o nome na observação do pedido.' },
  { nome: 'Kit Trio Paetê', cat: 'calcinhas', preco: 9990, de: 12990, tag: 'Oferta', destaque: true, variacoes: PMG, cor: ['#f08fb0', '#c2185b'],
    descricao: 'Três calcinhas com aplicações de paetê nas cores vermelha, preta e rosa.' },
  { nome: 'Sutiã Renda Rubi', cat: 'sutias', preco: 8990, variacoes: ['40', '42', '44', '46'], cor: ['#c41a34', '#6b0b16'],
    descricao: 'Sutiã com bojo e renda floral vermelha: conforto e sustentação com muito charme.' },
  { nome: 'Sutiã Meia-Taça Noir', cat: 'sutias', preco: 7990, variacoes: ['40', '42', '44'], cor: ['#3a0509', '#1a0205'],
    descricao: 'Meia-taça em renda preta com aro, que valoriza o colo com delicadeza.' },
  { nome: 'Conjunto Tiras Noir & Rouge', cat: 'conjuntos', preco: 11990, destaque: true, variacoes: PMG, cor: ['#3a0509', '#a3122a'],
    descricao: 'Conjunto de renda com tiras cruzadas, disponível em preto e vermelho.' },
  { nome: 'Body Renda Rubi', cat: 'conjuntos', preco: 13990, tag: 'Novo', variacoes: PMGGG, cor: ['#d61f3c', '#3a0509'],
    descricao: 'Body em renda vermelha com decote profundo. Elegância e sensualidade na mesma peça.' },
  { nome: 'Calcinha Pérolas', cat: 'calcinhas', preco: 6490, tag: 'Hot', variacoes: PMG, cor: ['#3a0509', '#1a0205'],
    descricao: 'Calcinha de renda com fio de pérolas. É assim de propósito…' },
  { nome: 'Calcinha Corações', cat: 'calcinhas', preco: 5490, variacoes: PMG, cor: ['#ff3355', '#a3122a'],
    descricao: 'Renda vermelha com argolas em formato de coração e tiras laterais.' },
  { nome: 'Pijama Cetim Bordô', cat: 'pijamas', preco: 11990, variacoes: PMGGG, cor: ['#7d0d1c', '#3a0509'],
    descricao: 'Short-doll em cetim com acabamento de renda. Macio, fresquinho e muito elegante.' },
  { nome: 'Camisola Seda Rosé', cat: 'pijamas', preco: 9990, tag: 'Novo', variacoes: PMG, cor: ['#f3b6c4', '#c2185b'],
    descricao: 'Camisola curta com alças finas e detalhe de renda no decote.' },
  { nome: 'Kit Presente Rosa Encantada', cat: 'kits', preco: 18990, tag: 'Presente', destaque: true, variacoes: PMG, estoque: 5, cor: ['#a3122a', '#3a0509'],
    descricao: 'Caixa presente com lingerie, rosa encantada, cosmético sensual e cartão personalizado.' },
  { nome: 'Kit Noite Especial', cat: 'kits', preco: 15990, variacoes: PMG, estoque: 5, cor: ['#7d0d1c', '#22030a'],
    descricao: 'Conjunto de renda + gel beijável + perfume de bolsa. Tudo para uma noite inesquecível.' },
  { nome: 'Perfume de Bolsa Pheromone', cat: 'cosmeticos', preco: 3990, cor: ['#2a1216', '#5b0a12'],
    descricao: 'Perfume com feromônio em tamanho perfeito para levar na bolsa. Cheirosa o dia todo.' },
  { nome: 'Mel Estimulante Honey', cat: 'cosmeticos', preco: 3490, cor: ['#e8a54b', '#a3122a'],
    descricao: 'Comestível, com sabor irresistível, desenvolvido para intensificar o desejo.' },
  { nome: 'Gel Sedenta', cat: 'sexshop', preco: 2990, tag: '18+', variacoes: ['Melancia', 'Blueberry'], cor: ['#e04de0', '#3a0a5b'],
    descricao: 'Gel funcional 15 ml com sabor. Escolha seu sabor favorito.' },
  { nome: 'Gel Goze+', cat: 'sexshop', preco: 3490, tag: '18+', cor: ['#ff5fa2', '#a3122a'],
    descricao: 'Gel excitante feminino. Você abriu a gaveta e conheceu seu novo produto favorito.' },
];
