# Fonte de dados — RO Latam Trading Search

Este documento registra de onde vêm os dados consumidos pelo módulo `market-search`, o formato bruto capturado, e como ele foi mapeado para a entidade de domínio `TradingItem`. Serve como referência para quando o site mudar e o parser precisar ser ajustado.

## Origem

- **Site:** RO Latam (GnJoy Americas)
- **URL de busca:** `https://ro.gnjoyamericas.com/pt/intro/shop-search/trading?storeType=BUY&serverType=FREYA&searchWord=<termo>&sortType=LOW_PRICE`
- **Natureza do dado:** não é uma API REST documentada. O site é uma aplicação Next.js (App Router) renderizada no servidor; os resultados da busca vêm embutidos no próprio HTML da página, dentro de um `<script>self.__next_f.push([1,"..."])</script>`, como parte do payload de RSC (React Server Components) do framework.
- **Proteção:** o domínio está atrás de Cloudflare. Chamadas HTTP simples (curl, Insomnia, axios) tomam `403`, mesmo replicando os headers de um navegador real — o bloqueio acontece por fingerprint de conexão (TLS/HTTP2), não por header ausente. Por isso o `market-search` acessa a página via Chromium headless (Playwright) em vez de uma chamada HTTP direta.
- **Data da captura de referência:** HAR capturado em 16/09/2026, buscando o termo `Arcebispo` no servidor `FREYA`.

## JSON bruto capturado (antes de qualquer mapeamento)

Trecho relevante, já desescapado, extraído do payload RSC embutido no HTML da página (`"list":[...]`):

```json
{
  "queryParams": {
    "storeType": "BUY",
    "serverType": "FREYA",
    "searchWord": "Arcebispo",
    "sortType": "LOW_PRICE"
  },
  "list": [
    {
      "svrId": 3,
      "itemId": 2866,
      "mapId": 835,
      "ssi": "7686228685002935677",
      "itemName": "Anel do Arcebispo",
      "databaseImgPath": "https://assets.gnjoyamericas.com/static/upload/database/item/2025/10/2866.png",
      "databaseType": "armor",
      "storeName": "          ",
      "itemPrice": 1400000,
      "itemCnt": 1,
      "slotMaxCount": "",
      "storeTypeName": "BUY",
      "itemSellerCharName": "Manná"
    },
    {
      "svrId": 3,
      "itemId": 2866,
      "mapId": 835,
      "ssi": "7686252680985236652",
      "itemName": "Anel do Arcebispo",
      "databaseImgPath": "https://assets.gnjoyamericas.com/static/upload/database/item/2025/10/2866.png",
      "databaseType": "armor",
      "storeName": "18 toma essa denuncia ai Bannnnn",
      "itemPrice": 1500000,
      "itemCnt": 1,
      "slotMaxCount": "",
      "storeTypeName": "BUY",
      "itemSellerCharName": "<Tops>"
    }
  ]
}
```

> Amostra reduzida a 2 itens por brevidade — a lista real retorna todos os resultados da busca, um objeto por anúncio de loja.

## Mapeamento: campo bruto → `TradingItem`

| Campo bruto          | Tipo         | Descrição                                                             | Está no `TradingItem`? | Motivo                                                                              |
| -------------------- | ------------ | --------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `svrId`              | number       | Id numérico do servidor (3 = Freya, nesse exemplo)                    | ✅ sim                 | usado como parte da chave de cache                                                  |
| `itemId`             | number       | Id do item no banco de dados do jogo                                  | ✅ sim                 | identifica o item de forma inequívoca (nomes podem repetir)                         |
| `mapId`              | number       | Id do mapa onde a loja está posicionada                               | ❌ não                 | nenhum consumidor atual precisa de localização no mapa                              |
| `ssi`                | string       | Identificador interno da entrada de venda (session/store id)          | ❌ não                 | uso interno do site, sem valor pro bot hoje                                         |
| `itemName`           | string       | Nome do item, no idioma da busca (pt)                                 | ✅ sim                 | exibido diretamente no embed do Discord                                             |
| `databaseImgPath`    | string (URL) | Ícone do item                                                         | ❌ não                 | bot atual responde só texto; candidato a incluir se um dia o embed ganhar thumbnail |
| `databaseType`       | string       | Categoria do item (`armor`, `weapon`, etc.)                           | ❌ não                 | não usado em nenhuma regra de negócio hoje                                          |
| `storeName`          | string       | Nome da loja do vendedor (pode vir em branco ou com texto livre/spam) | ✅ sim                 | exibido no embed                                                                    |
| `itemPrice`          | number       | Preço unitário em Zeny                                                | ✅ sim                 | é o dado principal da busca                                                         |
| `itemCnt`            | number       | Quantidade por lote/anúncio                                           | ✅ sim                 | exibido no embed (`x{itemCnt}`)                                                     |
| `slotMaxCount`       | string       | Slots do equipamento (geralmente vazio nos exemplos capturados)       | ❌ não                 | sem uso definido ainda                                                              |
| `storeTypeName`      | string       | Redundante com o `storeType` já enviado na busca (`BUY`/`SELL`)       | ❌ não                 | seria repetição do parâmetro de busca                                               |
| `itemSellerCharName` | string       | Nome do personagem vendedor                                           | ✅ sim                 | exibido no embed                                                                    |

Campos não incluídos hoje ficam de fora do construtor por decisão de design (ver discussão na Etapa 2 do tutorial) — não por limitação técnica. Adicionar qualquer um deles ao `TradingItem` é só estender o construtor e o `RawTradingItem` do parser.

## Observações sobre qualidade do dado

- `storeName` e `itemSellerCharName` são texto livre digitado por jogadores — já foram observados valores com spam, símbolos e nomes de loja em branco (só espaços). Não assuma que são identificadores limpos.
- `itemPrice` vem como número inteiro (Zeny), sem separador de milhar.
- A ordenação (`sortType=LOW_PRICE`) é feita pelo próprio site antes de retornar a lista — o parser não reordena nada.

## Como recapturar uma amostra nova (quando o site mudar)

1. Abra a busca no navegador normalmente (ex: `.../trading?storeType=BUY&serverType=FREYA&searchWord=Arcebispo&sortType=LOW_PRICE`).
2. DevTools → aba Network → **Preserve log** → refaça a busca → botão direito numa requisição → **Save all as HAR with content**.
3. No HAR, procure a resposta HTML da própria URL de busca (não os `_rsc=` prefetch, que vêm vazios) e localize o texto `\"list\":[` dentro dela.
4. Compare a estrutura nova com a tabela acima e ajuste `RawTradingItem` (`price-search/infrastructure/parsers/market-html-parser.ts`) e a entidade `TradingItem` conforme necessário.
