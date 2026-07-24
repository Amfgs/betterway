const assert = require("node:assert/strict");
const test = require("node:test");
const {
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
