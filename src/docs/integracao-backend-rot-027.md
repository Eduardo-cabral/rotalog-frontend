# ROT-027 — Integração Frontend e contratos do Backend

## Referência da análise

Backend oficial, branch main, commit **5dda7eaed56185509382113f66b6807cc97fe30d**.
A análise estática consultou routers FastAPI, schemas Pydantic, dependências e
serviços de autenticação/autorização, operações, testes e README do Backend.
Os contratos de login, catálogo, produtos, ofertas, estoque, checkout, compras e
pedidos foram considerados compatíveis com as chamadas implementadas nesta
branch. Essa conclusão é estática: a compatibilidade com o ambiente publicado
ainda precisa ser validada.

As rotas da API usam o prefixo /api/v1. O Backend continua responsável pela
autorização final e pela validação dos dados e efeitos de cada operação.

## Autenticação e capacidades

O modo API usa login, cadastro, refresh, logout, alteração de senha e GET /me.
O cabeçalho X-Organization-Id identifica a organização ativa. A alteração de
senha envia current_password e new_password; após resposta 204, o Frontend
encerra a sessão local.

As telas do comprador exigem BUYER_ADMIN, vínculo ativo e a capacidade adequada:
catalog:read para catálogo, checkout:create para carrinho/checkout e
purchase:read para histórico e detalhes de compras. Um comprador que possui
somente purchase:read pode abrir as compras sem receber acesso ao catálogo ou
ao checkout.

Para o fornecedor, supplier_order:manage permite dashboard, pedidos e a tela de
Rotas; offer:write permite catálogo/ofertas e depósitos; inventory:write permite
consulta e ajuste de estoque. O provider de pedidos não consulta
/supplier-orders sem supplier_order:manage. Usuários com somente offer:write ou
inventory:write continuam podendo acessar as respectivas áreas sem carregar
pedidos.

O administrador cadastra e publica produtos com catalog:read e product:write.
A capacidade warehouse:review existe no Backend, mas a revisão de geocodificação
não tem tela ou integração no Frontend.

## Jornada do comprador

O catálogo e os detalhes consultam GET /products e GET /products/{id}; ofertas
consultam GET /offers. Compras usam GET /purchases e GET /purchases/{id}, com
paginação e validação de organização na resposta.

O comprador consulta janelas existentes por GET /capacity-slots. POST /checkouts
envia de 1 a 50 ofertas distintas, um fornecedor e um depósito,
capacity_slot_id e accepts_partial=false, com Idempotency-Key. A API retorna o
checkout e reserva estoque e capacidade. GET /checkouts/{id} permite consultar
seu estado. A confirmação explícita usa
POST /checkouts/{id}/confirm-payment, expected_version e outra chave de
idempotência.

No Backend do commit de referência, confirm-payment utiliza pagamento simulado,
sem chamada a PSP externo. A confirmação não é uma operação sem efeitos:
registra compra, pedidos, pagamento e alocações no banco, converte as reservas
e altera o estado do checkout. A resposta informa provider=SIMULATED. O
Frontend não executa essas operações nas suítes E2E; elas usam mocks.

As intenções de checkout são separadas por usuário, organização e conjunto de
dados. Uma operação com resultado incerto exige consulta antes de nova
confirmação; não há cancelamento de reserva iniciado pelo Frontend. O relógio
local não comprova expiração nem liberação.

## Jornada do fornecedor e administração

O fornecedor consulta produtos publicados, cria e altera ofertas e declara
ajustes de estoque. Os pedidos são consultados pela API e as ações integradas
seguem o fluxo de aceite, separação, alocação e prontidão até
READY_TO_DISPATCH.

A tela /fornecedor/rotas lista os pedidos em READY_TO_DISPATCH e permite abrir
seus detalhes. Ela não planeja rotas, atribui motoristas nem consulta
rastreamento. O Backend de referência possui endpoints de rotas, planejamento,
timeline e tracking; eles não são consumidos por essa tela. O endpoint legado
de atribuição não foi adotado. A tela mantém essa limitação explícita.

O cadastro/publicação de produtos é uma área administrativa. A interface do
fornecedor não cadastra produtos canônicos nem aprova depósitos.

## Limitações atuais da integração

- **Revisão de depósitos:** o fornecedor consegue cadastrar e consultar
  depósitos, mas a interface não oferece a revisão administrativa exigida para
  confirmar as coordenadas. Um depósito pendente não pode ser usado em uma
  oferta até que um administrador o aprove por outro meio.
- **Capacidade logística:** o comprador consulta janelas, mas o Frontend não
  cria nem ajusta janelas. O checkout depende de capacidade previamente
  cadastrada no Backend.
- **Rotas:** a interface mostra pedidos prontos; planejamento, atribuição de
  motorista e rastreamento ainda não estão implementados.
- **Imagens:** imagens de produtos ficam no IndexedDB do navegador. Não há
  integração Frontend com upload privado, confirmação/processamento ou galeria
  de imagens do Backend; elas não são compartilhadas entre usuários/dispositivos.
- **Ambiente publicado:** a análise não comprova que o ambiente implantado usa
  o commit de referência, nem valida CORS, cookies, banco, execução de demo,
  storage privado ou worker de arquivos.

Esses itens são pendências de Frontend/configuração e não devem ser descritos
como funcionalidades concluídas nem como contratos ausentes do Backend.

## Testes e validação

Os testes de API usam respostas interceptadas e não chamam o Backend. Nenhum
teste E2E deve efetuar compra, pagamento, alteração de estoque ou outra escrita
real. A execução E2E desta rodada deve ser registrada separadamente no relatório
de validação; a compatibilidade com o ambiente publicado requer validação
manual autorizada e isolada.