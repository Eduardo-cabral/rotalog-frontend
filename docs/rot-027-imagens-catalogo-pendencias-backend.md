# Imagens do catálogo: dependências do Backend

O contrato atual de `ProductResponse` não inclui imagem e não há operação de upload no OpenAPI V5 consultado. O Frontend usa um placeholder neutro nos catálogos e no cadastro administrativo; não há upload, armazenamento local ou imagem fictícia vinculada aos produtos da API.

Para integrar imagens de forma consistente, o Backend precisa definir:

- Endpoint de upload e método HTTP.
- Autenticação e capacidade/permissão exigida.
- Formato de envio e tipos de arquivo aceitos.
- Limites de tamanho e dimensões.
- Estrutura da resposta e identificador da imagem.
- Como a imagem será associada ao produto canônico.
- Campo ou URL retornado em listagens e detalhes de produto.
- Regras para substituir ou remover uma imagem.
- Comportamento da URL: acesso, expiração e cache, quando aplicável.

Até a publicação desses contratos, a interface não deve habilitar upload nem associar o armazenamento local legado a produtos canônicos da API.
