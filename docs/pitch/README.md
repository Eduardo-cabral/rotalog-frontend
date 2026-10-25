# Capturas do pitch

As cinco imagens em `img/` são capturadas do frontend real por Playwright em viewport desktop de 1600 × 1200. A suíte usa `playwright.api.config.ts` e intercepta todas as respostas da API com fixtures sintéticas locais; nenhum pedido é enviado a um backend.

Para regenerar as imagens na raiz do repositório:

```powershell
npx playwright test --config=playwright.api.config.ts tests/e2e-api/pitch-screenshots.spec.ts
```

O teste cria `docs/pitch/img/` se necessário e atualiza:

- `01-catalogo.png` — catálogo, produto, preço e selo de demonstração.
- `02-carrinho.png` — carrinho preenchido, quantidade, subtotal e resumo.
- `03-pedido.png` — detalhes de pedido de demonstração com pedido analisado.
- `04-linha-do-tempo.png` — acompanhamento durante a preparação, com progresso.
- `05-erro-amigavel.png` — falha simulada de consulta, mensagem e ação para tentar novamente.

As imagens são capturadas em página completa, sem animações. As fixtures usam nomes e identificadores fictícios e um endereço de e-mail reservado para testes (`.invalid`).

## Roteiro: jornada do comprador em 60 segundos

### 0–10 segundos | Apresentação do problema

“Na rotina de compras, comparar fornecedores, escolher a melhor oferta e acompanhar pedidos pode exigir várias ferramentas e processos manuais. O RotaLog reúne essas etapas em um único portal.”

### 10–22 segundos | Catálogo e comparação

“O comprador acessa o catálogo, encontra os produtos disponíveis e visualiza as ofertas de diferentes fornecedores. Ele pode selecionar duas ofertas e comparar preços, quantidades mínimas e disponibilidade para tomar uma decisão mais informada.”

### 22–35 segundos | Carrinho e checkout

“Depois de escolher a oferta, o comprador informa a quantidade e adiciona o produto ao carrinho. Em seguida, revisa os valores e avança pelo processo de checkout simulado.”

### 35–48 segundos | Pedido

“Após a confirmação, o pedido fica disponível no histórico, permitindo consultar os produtos, valores e informações da compra em um só lugar.”

### 48–60 segundos | Acompanhamento e benefício

“O comprador também acompanha a evolução do pedido por uma linha do tempo de status. Assim, o RotaLog oferece mais organização, visibilidade e praticidade, desde a comparação de fornecedores até o acompanhamento da entrega.”
