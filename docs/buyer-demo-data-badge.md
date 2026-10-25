# Selo de dados de demonstração — jornada do comprador

O selo **Dados de demonstração** é apresentado apenas quando a tela tem uma fonte demonstrativa identificável:

- Nas rotas do modo `mock`, somente enquanto houver conteúdo de mock visível. Catálogo e detalhe usam produtos importados dos mocks; carrinho usa itens adicionados a partir desse catálogo; compras e detalhes consultam `purchasesMock`.
- Nas rotas do modo `api`, cada registro relevante precisa retornar `is_synthetic: true`. Se o registro também tiver `demo_run_id`, o identificador precisa ser uma string não vazia. Em listas mistas, com campos ausentes ou inválidos, o selo não é mostrado.
- Catálogo e detalhes do produto verificam os produtos e as ofertas usadas na tela. Lista e acompanhamento de compras verificam os pedidos e os snapshots dos produtos.
- Carrinho API verifica as ofertas armazenadas no carrinho. Quando existe uma tentativa de checkout, o próprio checkout também precisa conter o marcador explícito; o frontend não infere que uma resposta API seja demonstrativa.

## Limitação do contrato atual

O tipo/resposta de `Checkout` usado pelo comprador não declara `is_synthetic` nem `demo_run_id`. Por segurança, o selo não aparece na revisão de checkout API enquanto essa resposta não fornecer um marcador válido, mesmo que os itens do carrinho sejam demonstrativos. O estado vazio do carrinho e telas de erro/carregamento também não recebem o selo por não apresentarem registros demonstrativos confirmados.

Solução segura para uma evolução futura, fora do escopo desta alteração: o Backend pode incluir um marcador explícito de dados demonstrativos no checkout (e mantê-lo coerente com os itens retornados). Até esse contrato existir e ser confirmado, o frontend mantém o selo oculto nesse estado. Nenhum contrato ou comportamento do Backend foi alterado.
