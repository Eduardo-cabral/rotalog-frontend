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
