'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Candy, Check, CheckCircle2, Coins, Minus, PackageOpen, Pencil, Plus, Search, ShoppingBag, Sparkles, Wallet, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { shopProducts, maxPurchaseQuantity, type ShopCategory, type ShopProduct, type ShopState, type PurchaseReceipt } from '@/lib/shop';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';

type Props = { shop: ShopState; lang: Lang; onUpdate: (shop: ShopState) => void; onEarn: () => void; onCollection: () => void };

export default function KyomeiShop({ shop, lang, onUpdate, onEarn, onCollection }: Props) {
  const t = (key: string) => tr(key, lang);
  const [category, setCategory] = useState<'all' | ShopCategory>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [affordable, setAffordable] = useState(false);
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/shop', { credentials: 'same-origin', cache: 'no-store', signal });
      if (!response.ok) throw new Error();
      const body = await response.json() as { shop: ShopState };
      if (!signal?.aborted) { updateRef.current(body.shop); setRefreshError(false); }
    } catch { if (!signal?.aborted) setRefreshError(true); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const focus = () => void refresh(controller.signal);
    window.addEventListener('focus', focus);
    return () => { controller.abort(); window.removeEventListener('focus', focus); };
  }, [refresh]);
  const query = search.trim().toLocaleLowerCase();
  const products = shopProducts.filter(product => (category === 'all' || product.category === category) &&
    (!affordable || product.price <= shop.balance) &&
    `${product.name} ${product.description[lang]}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : 0);
  const reset = () => { setSearch(''); setAffordable(false); setCategory('all'); setSort('featured'); };

  return <div className="kyomei-shop">
    <section className="shop-hero">
      <div className="shop-hero-copy"><span className="shop-kicker"><Sparkles size={16} />{t('shopKicker')}</span><h1>{t('shopTitle')}</h1><p>{t('shopIntro')}</p><div className="shop-hero-actions"><button className="secondary" onClick={onCollection}><PackageOpen size={18} />{t('shopGoCollection')}<ArrowRight size={16} /></button><span className="shop-virtual">{t('shopVirtual')}</span></div></div>
      <div className="shop-hero-display" aria-hidden="true"><div className="shop-orbit" /><span className="shop-decoration shop-decoration-one">✦</span><span className="shop-decoration shop-decoration-two">✧</span><div className="shop-postcard shop-postcard-sweet"><img src={shopProducts[2].image} alt="" width={1200} height={1500} /><span>sweet little joys</span></div><div className="shop-postcard shop-postcard-pencil"><img src={shopProducts[45].image} alt="" width={1200} height={1500} /><span>study in colour</span></div><span className="shop-hero-coin">共</span></div>
    </section>
    <section className="shop-wallet-strip" aria-label={t('shopBalance')}><span className="shop-wallet-icon"><Wallet size={24} /></span><div className="shop-wallet-total"><span>{t('shopBalance')}</span><strong aria-live="polite">{shop.balance}<small>共</small></strong></div><p>{t('shopEarnHint')}</p><button className="primary" onClick={onEarn}>{t('shopEarn')}<ArrowRight size={16} /></button></section>
    {refreshError && <p role="alert" className="shop-refresh-error">{t('shopRefreshError')} <button className="text-button" onClick={() => void refresh()}>{t('retry')}</button></p>}
    <div className="shop-tools">
      <div className="shop-categories" role="group" aria-label={t('shop')}>
        {([{ id: 'all', label: 'shopAll', Icon: ShoppingBag }, { id: 'sweets', label: 'shopSweets', Icon: Candy }, { id: 'stationery', label: 'shopStationery', Icon: Pencil }] as const).map(({ id, label, Icon }) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}><Icon size={18} /><span>{t(label)}</span><small>{id === 'all' ? shopProducts.length : shopProducts.filter(product => product.category === id).length}</small></button>)}
      </div>
      <div className="shop-filter-row"><label className="shop-search"><Search size={19} /><span className="sr-only">{t('shopSearch')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('shopSearch')} maxLength={100} /></label><label className="shop-affordable"><input type="checkbox" checked={affordable} onChange={event => setAffordable(event.target.checked)} />{t('shopAffordable')}</label><select className="shop-sort" aria-label={t('shopSort')} value={sort} onChange={event => setSort(event.target.value)}><option value="featured">{t('shopFeatured')}</option><option value="low">{t('shopPriceLow')}</option><option value="high">{t('shopPriceHigh')}</option></select></div>
    </div>
    <div className="shop-catalog-heading"><h2>{t(category === 'sweets' ? 'shopSweets' : category === 'stationery' ? 'shopStationery' : 'shopAll')}</h2><span role="status">{t('shopFound').replace('{count}', String(products.length))}</span></div>
    {products.length ? <div className="shop-product-grid">{products.map(product => {
      const owned = shop.inventory.find(item => item.productId === product.id)?.quantity ?? 0;
      return <article className="shop-product" data-category={product.category} key={product.id}>
        <div className="shop-product-image"><img src={product.image} alt={product.name} width={1200} height={1500} loading="lazy" decoding="async" />{owned > 0 && <span className="shop-owned-badge"><Check size={13} />×{owned}</span>}</div>
        <div className="shop-product-copy"><span className="shop-product-category">{t(product.category === 'sweets' ? 'shopSweets' : 'shopStationery')}</span><h3>{product.name}</h3><p>{product.description[lang]}</p><div className="shop-product-bottom"><strong>{product.price}<span>共</span></strong><button className="secondary" onClick={() => setSelected(product)} aria-label={`${t('shopPick')}: ${product.name}`}><Plus size={16} />{t('shopPick')}</button></div>{owned > 0 && <small className="shop-product-owned">{t('shopOwned').replace('{count}', String(owned))}</small>}</div>
      </article>;
    })}</div> : <section className="card shop-no-results"><Search size={32} /><h3>{t('shopEmpty')}</h3><button className="secondary" onClick={reset}>{t('shopReset')}</button></section>}
    <p className="shop-art-note">{t('shopVirtual')} · {t('shopArtNote')}</p>
    {shop.purchases.length > 0 && <section className="card shop-history"><div className="shop-section-heading"><h2>{t('shopHistory')}</h2><span>{t('shopSpent')}: {shop.spent} 共</span></div>{shop.purchases.map(receipt => <div className="shop-history-row" key={receipt.id}><ShoppingBag size={18} /><div><strong>{shopProducts.find(p => p.id === receipt.productId)?.name ?? receipt.productId} <small>×{receipt.quantity}</small></strong><span>{new Intl.DateTimeFormat(lang === 'kk' ? 'kk-KZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(receipt.createdAt)}</span></div><b>−{receipt.total} 共</b></div>)}</section>}
    {selected && <PurchaseDialog key={selected.id} product={selected} shop={shop} lang={lang} onUpdate={onUpdate} onClose={() => setSelected(null)} onEarn={onEarn} onCollection={onCollection} onRefresh={refresh} />}
  </div>;
}

function PurchaseDialog({ product, shop, lang, onUpdate, onClose, onEarn, onCollection, onRefresh }: Props & { product: ShopProduct; onClose: () => void; onRefresh: () => Promise<void> }) {
  const t = (key: string) => tr(key, lang);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const intent = useRef<string | null>(null);
  const inFlight = useRef(false);
  const origin = useRef<HTMLElement | null>(typeof document !== 'undefined' ? document.activeElement as HTMLElement : null);
  const total = quantity * product.price;
  const missing = Math.max(0, total - shop.balance);
  async function buy() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    intent.current ??= crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/shop', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: intent.current, productId: product.id, quantity }) });
      const body = await response.json() as { error?: string; shop?: ShopState; receipt?: PurchaseReceipt };
      if (!response.ok) {
        const code = body.error ?? 'shopNetwork';
        setError(['shopInvalid', 'shopInsufficient', 'shopConflict', 'unauthorized'].includes(code) ? code : 'shopNetwork');
        void onRefresh(); return;
      }
      if (!body.shop || !body.receipt) throw new Error('Incomplete purchase response');
      onUpdate(body.shop); setReceipt(body.receipt);
    } catch { setError('shopNetwork'); }
    finally { clearTimeout(timer); inFlight.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="shop-dialog" showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); origin.current?.focus(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
    <button className="shop-dialog-close" aria-label={t('shopClose')} disabled={busy} onClick={onClose}><X size={20} /></button>
    <div className="shop-dialog-picture" data-category={product.category}><img src={product.image} alt={product.name} width={1200} height={1500} />{receipt && <span className="shop-success-icon"><CheckCircle2 size={35} /></span>}</div>
    <DialogTitle className="shop-dialog-title">{receipt ? t('shopAdded') : product.name}</DialogTitle>
    <DialogDescription>{receipt ? t('shopAddedDetail').replace('{count}', String(receipt.quantity)).replace('{name}', product.name) : `${product.description[lang]}. ${t('shopVirtual')}`}</DialogDescription>
    {receipt ? <><p className="shop-success-balance" role="status"><Coins size={20} />{t('shopBalance')}: <strong>{shop.balance} 共</strong></p><div className="shop-dialog-actions"><button className="primary" onClick={() => { onClose(); onCollection(); }}>{t('shopGoCollection')}<ArrowRight size={17} /></button><button className="secondary" onClick={onClose}>{t('shopKeepBrowsing')}</button></div></> : <>
      <div className="shop-quantity-row"><span>{t('shopQuantity')}</span><div className="shop-stepper"><button disabled={busy || !!intent.current || quantity <= 1} onClick={() => setQuantity(q => q - 1)} aria-label={t('shopLess')}><Minus size={17} /></button><output aria-live="polite">{quantity}</output><button disabled={busy || !!intent.current || quantity >= maxPurchaseQuantity} onClick={() => setQuantity(q => q + 1)} aria-label={t('shopMore')}><Plus size={17} /></button></div><span>{product.price} 共 / 1</span></div>
      <div className="shop-order-total"><span>{t('shopTotal')}</span><strong>{total} 共</strong></div>
      <p className={missing ? 'shop-shortfall' : 'shop-after-balance'}>{missing ? t('shopMissing').replace('{amount}', String(missing)) : `${t('shopRemaining')}: ${shop.balance - total} 共`}</p>
      {error && <p className="error-text" role="alert">{t(error)}</p>}
      <div className="shop-dialog-actions"><button className="primary" onClick={() => void buy()} disabled={busy || (missing > 0 && !intent.current)}>{busy ? t('shopBuying') : intent.current ? t('shopRetry') : t('shopBuy').replace('{amount}', String(total))}</button>{missing > 0 && !intent.current ? <button className="secondary" onClick={() => { onClose(); onEarn(); }}>{t('shopEarn')}</button> : <button className="secondary" disabled={busy} onClick={onClose}>{t('shopCancel')}</button>}</div>
    </>}
  </DialogContent></Dialog>;
}
