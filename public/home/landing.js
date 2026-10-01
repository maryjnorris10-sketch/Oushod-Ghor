/* ============ ঔষধ ঘর - ল্যান্ডিং পেজ স্ক্রিপ্ট ============ */

// keep the same light/dark theme choice as the main app
(function initTheme() {
  const saved = localStorage.getItem('og_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

document.getElementById('ldYear').textContent = new Date().getFullYear();

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function money(n) { return `৳${Number(n).toLocaleString('bn-BD')}`; }

async function apiGet(path) {
  try {
    const res = await fetch(`/api${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text) el.textContent = text;
}

async function loadLanding() {
  const [settings, companies, products] = await Promise.all([
    apiGet('/settings'),
    apiGet('/companies'),
    apiGet('/products'),
  ]);

  if (settings) {
    setText('ldShopName', settings.shopName);
    setText('ldFooterShopName', settings.shopName);
    setText('ldTagline', settings.landingTagline);
    setText('ldHeroTitle', settings.heroTitle);
    setText('ldHeroSubtitle', settings.heroSubtitle);
    if (settings.landingAbout) setText('ldAbout', settings.landingAbout);

    if (settings.hotline) {
      document.getElementById('ldHotlineBox').classList.remove('hidden');
      setText('ldHotline', settings.hotline);
      document.getElementById('ldContactHotlineBox').classList.remove('hidden');
      setText('ldContactHotline', settings.hotline);
    }
    if (settings.landingContactEmail) {
      document.getElementById('ldContactEmailBox').classList.remove('hidden');
      setText('ldContactEmail', settings.landingContactEmail);
    }
    if (settings.landingContactAddress) {
      document.getElementById('ldContactAddressBox').classList.remove('hidden');
      setText('ldContactAddress', settings.landingContactAddress);
    }

    // Banners — prefer the 5 dedicated landing-page slider banners; fall back
    // to the app's shop banners if the admin hasn't set any landing-specific ones yet.
    const dedicatedBanners = (settings.landingBanners || []).filter((b) => b.active);
    const fallbackBanners = (settings.banners || []).filter((b) => b.active);
    const activeBanners = dedicatedBanners.length ? dedicatedBanners : fallbackBanners;
    if (activeBanners.length) {
      document.getElementById('ldBannerCarousel').innerHTML = activeBanners
        .map((b) => `
          <${b.link ? 'a' : 'div'} class="ld-banner-slide" ${b.link ? `href="${b.link}"` : ''}>
            <img src="${b.url}" alt="banner">
            ${b.link ? `<span class="ld-banner-cta">${escapeHtml(b.buttonText || 'এখনই দেখুন →')}</span>` : ''}
          </${b.link ? 'a' : 'div'}>
        `)
        .join('');
      if (activeBanners.length > 1) {
        const dotsEl = document.getElementById('ldBannerDots');
        dotsEl.classList.remove('hidden');
        dotsEl.innerHTML = activeBanners.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
        const carousel = document.getElementById('ldBannerCarousel');
        const dots = [...dotsEl.querySelectorAll('.dot')];
        let idx = 0;
        const goTo = (i) => {
          idx = i;
          carousel.scrollTo({ left: carousel.clientWidth * idx, behavior: 'smooth' });
          dots.forEach((d, di) => d.classList.toggle('active', di === idx));
        };
        dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
        setInterval(() => goTo((idx + 1) % activeBanners.length), 4000);
      }
    }

    // Features (only replace defaults if admin has added some)
    if (Array.isArray(settings.landingFeatures) && settings.landingFeatures.length) {
      document.getElementById('ldFeatureGrid').innerHTML = settings.landingFeatures
        .map((f) => `
          <div class="ld-feature-card">
            <div class="ld-fi">${escapeHtml(f.icon || '💊')}</div>
            <h3>${escapeHtml(f.title || '')}</h3>
            <p>${escapeHtml(f.desc || '')}</p>
          </div>
        `).join('');
    }

    // Why choose us
    if (Array.isArray(settings.landingWhyChooseUs) && settings.landingWhyChooseUs.length) {
      document.getElementById('ldWhyList').innerHTML = settings.landingWhyChooseUs
        .map((w) => `<li>✅ ${escapeHtml(w)}</li>`).join('');
    }
  }

  // Brands
  const brandRow = document.getElementById('ldBrandRow');
  if (companies && companies.length) {
    brandRow.innerHTML = companies
      .map((c) => `<div class="ld-brand-chip">${c.logo ? `<img src="${c.logo}">` : '🏢'} ${escapeHtml(c.name)}</div>`)
      .join('');
  } else {
    brandRow.innerHTML = '<div class="empty-state">শীঘ্রই যোগ হবে</div>';
  }

  // Featured products (first 8 in-stock items)
  const grid = document.getElementById('ldProductGrid');
  if (products && products.length) {
    const featured = products.filter((p) => p.inStock).slice(0, 8);
    grid.innerHTML = featured.length
      ? featured.map((p) => {
          const discount = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
          return `
            <div class="product-card">
              ${discount ? `<div class="discount-ribbon">${discount}% ছাড়</div>` : ''}
              ${p.image ? `<img src="${p.image}" class="pimg" loading="lazy">` : ''}
              <div class="company">${escapeHtml(p.companyName || '')}</div>
              <div class="pname">${escapeHtml(p.name)}</div>
              <div class="price-row">
                <span class="price">${money(p.price)}</span>
                ${p.mrp > p.price ? `<span class="mrp">${money(p.mrp)}</span>` : ''}
              </div>
              <div class="unit">প্রতি ${escapeHtml(p.unit)}</div>
            </div>
          `;
        }).join('')
      : '<div class="empty-state">শীঘ্রই প্রোডাক্ট যোগ হবে</div>';
  } else {
    grid.innerHTML = '<div class="empty-state">শীঘ্রই প্রোডাক্ট যোগ হবে</div>';
  }
}

// simple mobile menu toggle: jump straight to app login/register on small screens
document.getElementById('ldBurger').addEventListener('click', () => {
  window.location.href = '/index.html#/shop';
});

loadLanding();
