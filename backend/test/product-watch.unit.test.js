const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseMarketProductContent,
  parseMarketSearchContent,
  parseProductHtml,
  validateProductUrl
} = require("../src/services/productWatchService");

test("extrai produto e preço de JSON-LD sem confundir valor parcelado", () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Notebook Aurora 14",
            "image": ["https://cdn.example.com/aurora.webp"],
            "offers": {
              "@type": "Offer",
              "price": "4.599,90",
              "priceCurrency": "BRL"
            }
          }
        </script>
      </head>
      <body>10x de R$ 459,99</body>
    </html>
  `;
  const product = parseProductHtml(html, "https://loja.example.com/produtos/aurora");
  assert.equal(product.name, "Notebook Aurora 14");
  assert.equal(product.price, 4599.9);
  assert.equal(product.currency, "BRL");
  assert.equal(product.store, "Example");
  assert.equal(product.imageUrl, "https://cdn.example.com/aurora.webp");
});

test("bloqueia URLs locais, credenciais e protocolos inseguros", () => {
  assert.throws(() => validateProductUrl("http://example.com/produto"), /HTTPS público/);
  assert.throws(() => validateProductUrl("https://localhost/produto"), /não pode ser usado/);
  assert.throws(() => validateProductUrl("https://user:pass@example.com/produto"), /HTTPS público/);
  assert.equal(validateProductUrl("https://example.com/produto#detalhes").href, "https://example.com/produto");
});

test("extrai modelos, imagens e menor preço dos resultados públicos de mercado", () => {
  const markdown = `
    Mais de 100 resultados
    [![Image 4: Imagem de Monitor Gamer IPS 27 LG UltraGear](https://i.zst.com.br/monitor-lg.jpg) ## Monitor Gamer IPS 27 LG UltraGear Via Loja Um **R$ 1.299,90** 10x de R$ 129,99 Compare em 7 lojas](https://www.buscape.com.br/monitor/monitor-gamer-ips-27-lg-ultragear?_lc=88)
    [![Image 5: Imagem de Monitor Gamer VA 24 Samsung Odyssey](https://i.zst.com.br/monitor-samsung.jpg) ## Monitor Gamer VA 24 Samsung Odyssey Via Loja Dois **R$ 799,00** 1 loja](https://www.buscape.com.br/monitor/monitor-gamer-va-24-samsung-odyssey?searchterm=monitor)
    [![Image 6: Imagem de Oferta patrocinada](https://i.zst.com.br/anuncio.jpg) ## Oferta patrocinada **R$ 499,00** Loja](https://www.buscape.com.br/lead?oid=123)
  `;
  const products = parseMarketSearchContent(markdown);
  assert.equal(products.length, 2);
  assert.deepEqual(products[0], {
    id: "monitor-gamer-ips-27-lg-ultragear",
    provider: "buscape",
    marketSource: "Buscapé",
    url: "https://www.buscape.com.br/monitor/monitor-gamer-ips-27-lg-ultragear",
    name: "Monitor Gamer IPS 27 LG UltraGear",
    imageUrl: "https://i.zst.com.br/monitor-lg.jpg",
    store: "Loja Um",
    currency: "BRL",
    price: 1299.9,
    offersCount: 7
  });
  assert.equal(products[1].price, 799);
  assert.equal(products[1].offersCount, 1);
});

test("seleciona a menor oferta real e captura cupom explícito do comparador", () => {
  const markdown = `
    ## Ofertas destacadas
    * [R$ 1.199,00 à vista](https://www.buscape.com.br/lead?oid=2&index=1 "Ir para Loja B")
    * Menor preço [![Image 21: Monitor Aurora](https://i.zst.com.br/aurora.jpg)](https://www.buscape.com.br/lead?oid=1)[R$ 999,90 à vista](https://www.buscape.com.br/lead?oid=1&index=0 "Ir para Loja A")
    Cupom: **AURORA10**
    ## Compare preços em 8 lojas
    ## Histórico de Preços
  `;
  const product = parseMarketProductContent(
    markdown,
    "https://www.buscape.com.br/monitor/monitor-aurora?tracking=1",
    "Monitor Aurora em Promoção é no Buscapé"
  );
  assert.equal(product.name, "Monitor Aurora");
  assert.equal(product.price, 999.9);
  assert.equal(product.store, "Loja A");
  assert.equal(product.offerUrl, "https://www.buscape.com.br/lead?oid=1&index=0");
  assert.equal(product.couponCode, "AURORA10");
  assert.equal(product.offersCount, 8);
  assert.equal(product.provider, "buscape");
});
