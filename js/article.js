document.addEventListener('DOMContentLoaded', function() {
    initArticlePage().catch(function(error) {
        console.error('Article page failed to initialize.', error);
        document.getElementById('articleHeader').innerHTML = '<h1>Article not found</h1>';
    });
});

/**
 * Resolve article by slug or id. Static content wins; otherwise load from API.
 */
async function initArticlePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = (urlParams.get('slug') || '').trim();
    const articleId = parseInt(urlParams.get('id'), 10);

    await loadPublishedPosts();

    let article = null;
    if (slug) {
        article = articles.find(a => a.slug === slug) || null;
    } else if (!Number.isNaN(articleId)) {
        article = articles.find(a => a.id === articleId) || null;
    }

    // Static body in js/data.js wins. API body is only used when there is no static HTML.
    if (slug && !(article && article.content)) {
        let remote = null;
        try {
            remote = await loadPublishedArticle(slug);
        } catch (error) {
            console.error('Published article body unavailable.', error);
        }

        if (remote && remote.bodyHtml) {
            if (!article) {
                article = {
                    id: Date.now(),
                    slug,
                    title: remote.title || slug,
                    category: remote.category || 'Technology',
                    date: remote.date || '',
                    image: remote.image || '',
                    excerpt: remote.excerpt || '',
                    content: remote.bodyHtml,
                    images: Array.isArray(remote.images) ? remote.images : []
                };
                articles.push(article);
            } else {
                article.content = remote.bodyHtml;
                if (!article.image && remote.image) article.image = remote.image;
                if (!article.title && remote.title) article.title = remote.title;
                if (!article.excerpt && remote.excerpt) article.excerpt = remote.excerpt;
                if (Array.isArray(remote.images) && remote.images.length) {
                    article.images = remote.images;
                }
            }
        }
    }

    if (!article || !article.content) {
        document.getElementById('articleHeader').innerHTML = '<h1>Article not found</h1>';
        return;
    }

    // For static articles opened by id that also have slug content already inline
    updateSEOTags(article);
    renderArticle(article);
}

/**
 * @param {Object} article
 */
function renderArticle(article) {
    const readMins = article.readTime || 5;

    document.getElementById('articleHeader').innerHTML = `
        <span class="category">${article.category}</span>
        <h1>${article.title}</h1>
        <p class="meta">
            <i class="far fa-calendar"></i> ${formatDate(article.date)}
            <span style="margin: 0 10px;">•</span>
            <i class="far fa-clock"></i> ${readMins} min read
        </p>
        ${article.image ? `<img src="${article.image}" alt="${article.title}">` : ''}
    `;

    document.getElementById('articleContent').innerHTML = article.content;

    const relatedArticles = articles
        .filter(a => a.category === article.category && a.id !== article.id && a.slug !== article.slug)
        .slice(0, 3);

    document.getElementById('relatedArticles').innerHTML = relatedArticles.map(a => `
        <article class="post-card">
            <img src="${a.image}" alt="${a.title}">
            <div class="card-content">
                <span class="category">${a.category}</span>
                <h3>${a.title}</h3>
                <p class="meta"><i class="far fa-calendar"></i> ${formatDate(a.date)}</p>
                <a href="${articleHref(a)}" class="read-more">Read More <i class="fas fa-arrow-right"></i></a>
            </div>
        </article>
    `).join('');

    const recentPosts = [...articles]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    document.getElementById('recentPosts').innerHTML = recentPosts.map(a => `
        <div class="post-item">
            <img src="${a.image}" alt="${a.title}">
            <div>
                <h4><a href="${articleHref(a)}">${a.title}</a></h4>
                <p class="meta"><i class="far fa-calendar"></i> ${formatDate(a.date)}</p>
            </div>
        </div>
    `).join('');

    document.getElementById('categoryList').innerHTML = categories.map(cat => `
        <li>
            <a href="blog.html?category=${cat.slug}">
                ${cat.name}
                <span>(${cat.count})</span>
            </a>
        </li>
    `).join('');

    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    const backToTop = document.getElementById('backToTop');
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    });

    backToTop.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function updateSEOTags(article) {
    document.title = `${article.title} | Theweavingtale`;

    updateMetaTag('name', 'description', article.excerpt);
    updateMetaTag('name', 'keywords', `${article.category}, ${article.title}, product review, lifestyle tips`);

    updateMetaTag('property', 'og:title', article.title);
    updateMetaTag('property', 'og:description', article.excerpt);
    updateMetaTag('property', 'og:image', article.image);
    updateMetaTag('property', 'og:url', window.location.href);
    updateMetaTag('property', 'article:published_time', article.date);
    updateMetaTag('property', 'article:section', article.category);

    updateMetaTag('property', 'twitter:title', article.title);
    updateMetaTag('property', 'twitter:description', article.excerpt);
    updateMetaTag('property', 'twitter:image', article.image);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        canonical.href = window.location.href;
    }

    addArticleStructuredData(article);
}

function updateMetaTag(attr, attrValue, content) {
    let element = document.querySelector(`meta[${attr}="${attrValue}"]`);
    if (element) {
        element.setAttribute('content', content);
    } else {
        element = document.createElement('meta');
        element.setAttribute(attr, attrValue);
        element.setAttribute('content', content);
        document.head.appendChild(element);
    }
}

function addArticleStructuredData(article) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        "image": article.image,
        "datePublished": article.date,
        "dateModified": article.date,
        "author": {
            "@type": "Organization",
            "name": "Theweavingtale"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Theweavingtale",
            "logo": {
                "@type": "ImageObject",
                "url": "https://www.theweavingtale.top/logo.png"
            }
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": window.location.href
        },
        "articleSection": article.category,
        "keywords": `${article.category}, product review, lifestyle`
    });
    document.head.appendChild(script);
}

function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(document.querySelector('h1').textContent);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
}

function shareOnPinterest() {
    const url = encodeURIComponent(window.location.href);
    const img = document.querySelector('.article-header img');
    const media = encodeURIComponent(img ? img.src : '');
    const description = encodeURIComponent(document.querySelector('h1').textContent);
    window.open(`https://pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${description}`, '_blank', 'width=600,height=400');
}

function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400');
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}
