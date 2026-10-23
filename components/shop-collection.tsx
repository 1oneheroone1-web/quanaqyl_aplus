'use client';

import { useState } from 'react';
import { ArrowRight, PackageOpen, Sparkles } from 'lucide-react';
import { shopProducts, type ShopState } from '@/lib/shop';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';

export default function ShopCollection({ shop, lang, onShop }: { shop: ShopState; lang: Lang; onShop: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const t = (key: string) => tr(key, lang);
  const items = shop.inventory.flatMap(item => {
    const product = shopProducts.find(p => p.id === item.productId);
    return product ? [{ ...item, product }] : [];
  });
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return <section className="card shop-collection" aria-labelledby="my-collection-heading">
    <div className="shop-section-heading"><div><span className="shop-kicker"><Sparkles size={15} />KYŌMEI COLLECTION</span><h2 id="my-collection-heading" tabIndex={-1}>{t('shopGoCollection')}</h2><p>{t('shopCollectionSub')}</p></div><button className="secondary" onClick={onShop}>{t('shopGoShop')}<ArrowRight size={16} /></button></div>
    {items.length ? <>
      <p className="shop-collection-count">{t('shopCollectionCount').replace('{unique}', String(items.length)).replace('{total}', String(shopProducts.length)).replace('{count}', String(count))}</p>
      <div className="shop-shelf">{(expanded ? items : items.slice(0, 8)).map(({ product, quantity }) => <article className="shop-owned-card" data-category={product.category} key={product.id}>
        <div className="shop-owned-image"><img src={product.image} alt={product.name} width={1200} height={1500} loading="lazy" decoding="async" /><span>×{quantity}</span></div>
        <h3>{product.name}</h3><p>{t('shopOwned').replace('{count}', String(quantity))}</p>
      </article>)}</div>
      {items.length > 8 && <button className="text-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{t(expanded ? 'shopCollectionLess' : 'shopCollectionMore')}</button>}
    </> : <div className="shop-empty-shelf"><span><PackageOpen size={34} /></span><h3>{t('shopCollectionEmpty')}</h3><p>{t('shopCollectionEmptyBody')}</p></div>}
  </section>;
}
