'use client';

import { useMemo, useState } from 'react';
import { formatINR, storeProducts } from './catalog';
import './store.css';

const categories = ['All products', 'Automation', 'Guides', 'Digital tools'];

export default function StoreClient() {
  const [category, setCategory] = useState('All products');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');

  const products = useMemo(() => storeProducts.filter((product) => {
    const matchesCategory = category === 'All products' || product.category === category;
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || [product.name, product.description, product.category]
      .some((value) => value.toLowerCase().includes(search));
    return product.published && matchesCategory && matchesQuery;
  }), [category, query]);

  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = storeProducts.reduce((total, product) => total + (cart[product.id] ?? 0) * product.pricePaise, 0);

  function addToCart(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
    setNotice('Added to your cart.');
    window.setTimeout(() => setNotice(''), 2200);
  }

  return (
    <main className="store-shell">
      <div className="store-topbar">
        <a className="store-brand" href="/"><span className="brand-mark">C</span><span>CORLEON<span className="brand-light"> / STORE</span></span></a>
        <a className="cart-indicator" href="#cart" aria-label={`Cart with ${cartCount} items`}>Cart <span>{cartCount}</span></a>
      </div>

      <section className="store-hero">
        <div className="hero-copy">
          <p className="store-kicker">THE CORLEON COLLECTION</p>
          <h1>Tools for work<br /><em>that moves forward.</em></h1>
          <p className="store-intro">Practical digital resources for building smarter workflows, stronger operations, and better customer experiences.</p>
          <a className="hero-link" href="#products">Explore the collection <span aria-hidden="true">↘</span></a>
        </div>
        <div className="hero-art" aria-label="Abstract Corleon brand artwork">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-core">C<span>®</span></div>
          <span className="art-caption">IDEAS INTO<br />MOMENTUM</span>
        </div>
      </section>

      <section className="store-benefits" aria-label="Store benefits">
        <div><span>01</span><strong>Made to be useful</strong><small>Clear, practical resources</small></div>
        <div><span>02</span><strong>Instant-ready formats</strong><small>Digital-first products</small></div>
        <div><span>03</span><strong>Built for operators</strong><small>Workflows over hype</small></div>
      </section>

      <section className="product-section" id="products">
        <div className="section-heading">
          <div><p className="store-kicker">SHOP THE COLLECTION</p><h2>Explore the essentials.</h2></div>
          <label className="search-box"><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection" /></label>
        </div>
        <div className="category-row" role="group" aria-label="Filter by category">
          {categories.map((item) => <button key={item} className={category === item ? 'category active' : 'category'} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="product-grid">
          {products.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div className={`product-art ${product.accent}`}>
                <span className="product-index">0{index + 1} / CORLEON</span>
                <span className="product-symbol">{product.accent === 'violet' ? '✳' : product.accent === 'mint' ? '◒' : '✦'}</span>
                <span className="product-art-label">{product.category.toUpperCase()}</span>
              </div>
              <div className="product-meta"><span>{product.badge}</span><span>{formatINR(product.pricePaise)}</span></div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <button className="add-button" onClick={() => addToCart(product.id)}>Add to cart <span aria-hidden="true">＋</span></button>
            </article>
          ))}
          {products.length === 0 && <div className="empty-results"><strong>No matches found.</strong><p>Try another search or choose a different category.</p></div>}
        </div>
      </section>

      <section className="cart-panel" id="cart">
        <div><p className="store-kicker">YOUR SELECTION</p><h2>Your cart <span>({cartCount})</span></h2>
          {cartCount === 0 ? <p className="cart-empty">Your cart is empty. Add a resource from the collection to get started.</p> :
            <ul className="cart-lines">{storeProducts.filter((product) => cart[product.id]).map((product) => <li key={product.id}><span>{product.name} × {cart[product.id]}</span><strong>{formatINR(product.pricePaise * cart[product.id])}</strong></li>)}</ul>}
        </div>
        <div className="cart-total"><span>Subtotal</span><strong>{formatINR(cartTotal)}</strong><button disabled className="checkout-button">Checkout coming soon</button><small>Payments are not enabled on this preview. No charge can be made.</small></div>
      </section>

      {notice && <div className="store-notice" role="status">{notice}</div>}
      <footer className="store-footer"><a className="store-brand" href="/"><span className="brand-mark">C</span><span>CORLEON</span></a><span>© {new Date().getFullYear()} Corleon. Built for what’s next.</span><a href="/">Back to Corleon Engine ↗</a></footer>
    </main>
  );
}
