import { chemicalProducts, homeFeaturedLimit, applyPriceList, randomizeCatalogSpecs, extractInventoryConfig } from './products-data.js';

const productAnchorMap = {
    "Acetone": "acetone",
    "Methanol": "methanol",
    "Ethanol": "ethanol",
    "Toluene": "toluene",
    "Sulfuric Acid": "sulfuric",
    "Hydrochloric Acid": "hydrochloric",
    "Sodium Hydroxide": "caustic",
    "Nitric Acid": "nitric",
    "Calcium Hypochlorite": "calcium",
    "Potassium Permanganate": "potassium",
    "Ferric Chloride": "ferric"
};

const productState = {
    selectedProductName: '',
    pageSearchTerm: '',
    activeCategory: 'All Categories',
    currentPage: 1,
    homeCurrentPage: 1
};

const pageConfig = {
    isHomePage: document.body.dataset.page === 'home',
    isProductsPage: document.body.dataset.page === 'products',
    isLogisticsPage: document.body.dataset.page === 'logistics'
};

function getProductAnchorId(productName) {
    const mappedEntry = Object.entries(productAnchorMap).find(([key]) => productName.includes(key));
    if (mappedEntry) return mappedEntry[1];

    return productName
        .toLowerCase()
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function findProductByName(productName) {
    return chemicalProducts.find(product => product.name === productName);
}

function getProductKeywords(product) {
    return `${product.name} ${product.formula} ${product.description} ${product.category} ${product.grade}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
}

function getSimilarProducts(product, limit = 6) {
    const sourceKeywords = new Set(getProductKeywords(product));

    return chemicalProducts
        .filter(candidate => candidate.name !== product.name)
        .map(candidate => {
            const candidateKeywords = getProductKeywords(candidate);
            const keywordMatches = candidateKeywords.filter(word => sourceKeywords.has(word)).length;
            const sharedHazards = (candidate.hazards || []).filter(hazard => (product.hazards || []).includes(hazard)).length;
            const sameCategory = candidate.category === product.category ? 4 : 0;
            const score = (keywordMatches * 2) + (sharedHazards * 3) + sameCategory;

            return { candidate, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.candidate);
}

function formatHazardClass(hazard) {
    const normalized = hazard.toLowerCase().replace(/[^a-z]+/g, '-');
    if (normalized.includes('flammable')) return 'hazard-flammable';
    if (normalized.includes('corrosive')) return 'hazard-corrosive';
    if (normalized.includes('toxic')) return 'hazard-toxic';
    if (normalized.includes('oxidizing')) return 'hazard-oxidizing';
    return 'hazard-non';
}

function getTopHazard(product) {
    const priority = ["Toxic", "Oxidizing", "Flammable", "Corrosive"];
    const productHazards = product.hazards || [];
    return priority.find(hazard => productHazards.includes(hazard)) || (productHazards[0] || "Non-Hazardous");
}

function getProductImagePath(product) {
    return product.image ? `./assets/products/${product.image}` : '';
}

function getProductMatches(searchTerm, products = chemicalProducts) {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    if (!normalizedTerm) return products;

    return products.filter(product => {
        const haystack = [
            product.name,
            product.formula,
            product.description,
            product.grade,
            product.packaging,
            product.category
        ].join(' ').toLowerCase();

        return haystack.includes(normalizedTerm);
    });
}

function getProductCategories(products = chemicalProducts) {
    return ['All Categories', ...new Set(products.map(product => product.category))];
}

function filterProducts({ searchTerm = '', category = 'All Categories', products = chemicalProducts } = {}) {
    const categoryFiltered = category === 'All Categories'
        ? products
        : products.filter(product => product.category === category);

    return getProductMatches(searchTerm, categoryFiltered);
}

function createCard(product) {
    const topHazard = getTopHazard(product);
    const productId = getProductAnchorId(product.name);
    const imagePath = getProductImagePath(product);
    const fallbackLabel = product.name.slice(0, 2).toUpperCase();

    return `
        <article class="product-card" id="${productId}">
            <div class="card-image-wrapper${imagePath ? '' : ' is-fallback'}">
                ${imagePath ? `
                    <img
                        src="${imagePath}"
                        alt="${product.name}"
                        class="product-image"
                        loading="lazy"
                        onerror="this.closest('.card-image-wrapper').classList.add('is-fallback'); this.remove();"
                    >
                ` : ''}
                <div class="image-fallback-badge">${fallbackLabel}</div>
            </div>
            <div class="card-content">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description || 'No description available for this industrial chemical.'}</p>
                <div class="product-meta">
                    <div class="meta-item">
                        <span class="meta-label">Packaging</span>
                        <span class="meta-value">${product.packaging}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Price</span>
                        <span class="meta-value" style="color: var(--primary-color); font-weight: 800;">${product.pricePerKg}</span>
                    </div>
                </div>
                <div class="product-footer">
                    <button type="button" class="btn-action" data-rfq-trigger data-product-name="${product.name}">Request Quote</button>
                    <span class="hazard-badge ${formatHazardClass(topHazard)}">${topHazard}</span>
                </div>
            </div>
        </article>
    `;
}

function renderProducts(productsToRender, gridSelector = '#product-grid') {
    const gridContainer = document.querySelector(gridSelector);
    if (!gridContainer) return;

    if (!productsToRender.length) {
        gridContainer.innerHTML = `
            <div class="catalog-empty-state">
                <h3>No products found</h3>
                <p>Try a different chemical name, formula, or category.</p>
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = productsToRender.map(createCard).join('');
}

function focusProductByName(productName) {
    const targetId = getProductAnchorId(productName);
    const targetCard = document.getElementById(targetId);
    if (!targetCard) return;

    targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSelectedProductWithSimilar(productName) {
    const matchedProduct = findProductByName(productName);
    if (!matchedProduct) {
        renderHomeCatalog();
        return;
    }

    const similarProducts = getSimilarProducts(matchedProduct);
    renderProducts([matchedProduct, ...similarProducts]);
}

function buildSuggestionsMarkup(matches) {
    return matches.map(product => `
        <div class="suggestion-item" data-name="${product.name}">
            <div class="suggestion-name">${product.name}</div>
            <div class="suggestion-formula">${product.formula}</div>
        </div>
    `).join('');
}

function updateSuggestions(searchValue, suggestionsBox, searchForm, maxResults = 8) {
    const value = searchValue.toLowerCase().trim();
    if (!suggestionsBox || !searchForm) return;

    if (value.length < 1) {
        suggestionsBox.style.display = 'none';
        searchForm.classList.remove('is-open');
        return;
    }

    const matches = chemicalProducts.filter(product =>
        product.name.toLowerCase().includes(value) ||
        product.formula.toLowerCase().includes(value)
    ).slice(0, maxResults);

    if (matches.length) {
        suggestionsBox.innerHTML = buildSuggestionsMarkup(matches);
        suggestionsBox.style.display = 'block';
        searchForm.classList.add('is-open');
    } else {
        suggestionsBox.style.display = 'none';
        searchForm.classList.remove('is-open');
    }
}

function attachSuggestionSelection(suggestionsBox, onSelect) {
    if (!suggestionsBox) return;

    suggestionsBox.addEventListener('click', event => {
        const item = event.target.closest('.suggestion-item');
        if (!item) return;

        onSelect(item.dataset.name);
    });
}

function buildHomeCategoryMarkup() {
    const categories = getProductCategories().filter(category => category !== 'All Categories');
    return categories.map(category => {
        const products = chemicalProducts
            .filter(product => product.category === category)
            .slice(0, 4)
            .map(product => `
                <a href="./products.html#${getProductAnchorId(product.name)}" class="sub-link">${product.name}</a>
            `)
            .join('');

        return `
            <li class="category-item">
                <div class="category-header">
                    <span class="category-name">${category}</span>
                    <span class="toggle-icon">+</span>
                </div>
                <div class="sub-category-list">
                    ${products}
                </div>
            </li>
        `;
    }).join('');
}

function renderHomeCategorySidebar() {
    const categoryList = document.getElementById('home-category-list');
    if (!categoryList) return;
    categoryList.innerHTML = buildHomeCategoryMarkup();
}

function getPaginationRange(current, total) {
    const delta = 1;
    const range = [];
    const rangeWithDots = [];
    let l;

    range.push(1);
    for (let i = current - delta; i <= current + delta; i++) {
        if (i < total && i > 1) {
            range.push(i);
        }
    }
    if (total > 1) range.push(total);

    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }
    return rangeWithDots;
}

function renderHomePagination(totalItems, itemsPerPage) {
    const pagination = document.getElementById('home-pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    const range = getPaginationRange(productState.homeCurrentPage, totalPages);
    pagination.innerHTML = range.map(p => p === '...' 
        ? `<span class="pagination-ellipsis">...</span>`
        : `<button type="button" class="pagination-button ${productState.homeCurrentPage === p ? 'is-active' : ''}" data-home-page="${p}">${p}</button>`
    ).join('');
}

function renderProductsPagination(totalItems, itemsPerPage) {
    const pagination = document.getElementById('products-pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    const range = getPaginationRange(productState.currentPage, totalPages);
    pagination.innerHTML = range.map(p => p === '...' 
        ? `<span class="pagination-ellipsis">...</span>`
        : `<button type="button" class="pagination-button ${productState.currentPage === p ? 'is-active' : ''}" data-page="${p}">${p}</button>`
    ).join('');
}

function renderHomeCatalog() {
    if (!pageConfig.isHomePage) return;

    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const matchingProducts = getProductMatches(searchTerm);
    const isMobile = window.innerWidth <= 768;
    const itemsPerPage = isMobile ? 7 : 12;

    let pool;
    if (searchTerm) {
        pool = matchingProducts;
    } else {
        const todaySeed = new Date().toDateString();
        let hash = 0;
        for (let i = 0; i < todaySeed.length; i++) hash += todaySeed.charCodeAt(i);
        pool = [...chemicalProducts]
            .sort((a, b) => Math.sin(hash + a.name.length) - Math.sin(hash + b.name.length))
            .slice(0, homeFeaturedLimit);
    }

    const startIndex = (productState.homeCurrentPage - 1) * itemsPerPage;
    const homeProducts = pool.slice(startIndex, startIndex + itemsPerPage);

    productState.selectedProductName = '';
    renderProducts(homeProducts);
    renderHomePagination(pool.length, itemsPerPage);
}

function setupHomeSearch() {
    const searchForm = document.getElementById('product-search-form');
    const searchInput = document.getElementById('search-input');
    const suggestionsBox = document.getElementById('suggestions-box');
    const mobileSearchBar = document.getElementById('search-bar');
    const mobileSearchForm = document.getElementById('mobile-search-form');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const mobileSearchButton = document.getElementById('mobile-search-button');
    const mobileSuggestionsBox = document.getElementById('mobile-suggestions-box');

    function syncSearchInputs(value, source = 'desktop') {
        if (source !== 'desktop' && searchInput) {
            searchInput.value = value;
        }

        if (source !== 'mobile' && mobileSearchInput) {
            mobileSearchInput.value = value;
        }
    }

    if (searchForm && searchInput && suggestionsBox) {
        function setSuggestionsOpen(isOpen) {
            suggestionsBox.style.display = isOpen ? 'block' : 'none';
            searchForm.classList.toggle('is-open', isOpen);
        }

        searchInput.addEventListener('input', () => {
            productState.selectedProductName = '';
            productState.homeCurrentPage = 1;
            syncSearchInputs(searchInput.value, 'desktop');
            renderHomeCatalog();
            updateSuggestions(searchInput.value, suggestionsBox, searchForm);
        });

        attachSuggestionSelection(suggestionsBox, selectedName => {
            productState.selectedProductName = selectedName;
            searchInput.value = selectedName;
            syncSearchInputs(selectedName, 'desktop');
            setSuggestionsOpen(false);
            renderSelectedProductWithSimilar(selectedName);
            requestAnimationFrame(() => focusProductByName(selectedName));
        });

        document.addEventListener('click', event => {
            if (!searchForm.contains(event.target) && !suggestionsBox.contains(event.target)) {
                setSuggestionsOpen(false);
            }
        });

        searchForm.addEventListener('submit', event => {
            event.preventDefault();

            if (productState.selectedProductName) {
                renderSelectedProductWithSimilar(productState.selectedProductName);
                requestAnimationFrame(() => focusProductByName(productState.selectedProductName));
                return;
            }

            renderHomeCatalog();
        });
    }

    if (mobileSearchBar && mobileSearchForm && mobileSearchInput && mobileSearchButton && mobileSuggestionsBox) {
        function setMobileSearchOpen(isOpen) {
            mobileSearchBar.classList.toggle('is-open', isOpen);

            if (!isOpen) {
                mobileSuggestionsBox.style.display = 'none';
                mobileSearchForm.classList.remove('is-open');
            }
        }

        mobileSearchButton.addEventListener('click', event => {
            const isClosed = !mobileSearchBar.classList.contains('is-open');

            if (isClosed) {
                event.preventDefault();
                setMobileSearchOpen(true);
                requestAnimationFrame(() => mobileSearchInput.focus());
            }
        });

        mobileSearchInput.addEventListener('input', () => {
            productState.selectedProductName = '';
            productState.homeCurrentPage = 1;
            syncSearchInputs(mobileSearchInput.value, 'mobile');
            renderHomeCatalog();
            updateSuggestions(mobileSearchInput.value, mobileSuggestionsBox, mobileSearchForm, 6);
        });

        attachSuggestionSelection(mobileSuggestionsBox, selectedName => {
            productState.selectedProductName = selectedName;
            mobileSearchInput.value = selectedName;
            syncSearchInputs(selectedName, 'mobile');
            mobileSuggestionsBox.style.display = 'none';
            mobileSearchForm.classList.remove('is-open');
            renderSelectedProductWithSimilar(selectedName);
            setMobileSearchOpen(false);
            requestAnimationFrame(() => focusProductByName(selectedName));
        });

        mobileSearchForm.addEventListener('submit', event => {
            event.preventDefault();

            if (!mobileSearchBar.classList.contains('is-open')) {
                setMobileSearchOpen(true);
                requestAnimationFrame(() => mobileSearchInput.focus());
                return;
            }

            syncSearchInputs(mobileSearchInput.value, 'mobile');
            if (productState.selectedProductName) {
                renderSelectedProductWithSimilar(productState.selectedProductName);
                requestAnimationFrame(() => focusProductByName(productState.selectedProductName));
            } else {
                renderHomeCatalog();
            }
            mobileSuggestionsBox.style.display = 'none';
            mobileSearchForm.classList.remove('is-open');
        });

        document.addEventListener('click', event => {
            if (!mobileSearchBar.contains(event.target)) {
                setMobileSearchOpen(false);
            }
        });
    }

    const homePagination = document.getElementById('home-pagination');
    if (homePagination) {
        homePagination.addEventListener('click', event => {
            const trigger = event.target.closest('[data-home-page]');
            if (!trigger) return;

            productState.homeCurrentPage = Number(trigger.dataset.homePage);
            renderHomeCatalog();
            const grid = document.getElementById('product-grid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

function renderProductsCategoryList() {
    const categories = getProductCategories();
    const categoryList = document.getElementById('products-category-list');
    const categorySelect = document.getElementById('products-category-select');

    if (categoryList) {
        categoryList.innerHTML = categories.map(category => `
            <button
                type="button"
                class="category-chip ${productState.activeCategory === category ? 'is-active' : ''}"
                data-category-filter="${category}"
            >
                ${category}
            </button>
        `).join('');
    }

    if (categorySelect) {
        categorySelect.innerHTML = categories.map(category => `
            <option value="${category}" ${productState.activeCategory === category ? 'selected' : ''}>${category}</option>
        `).join('');
    }
}

function renderProductsPageCatalog() {
    if (!pageConfig.isProductsPage) return;

    const resultsCount = document.getElementById('products-results-count');
    const filteredProducts = filterProducts({
        searchTerm: productState.pageSearchTerm,
        category: productState.activeCategory
    });

    const isMobile = window.innerWidth <= 768;
    const itemsPerPage = isMobile ? 10 : 12;
    const startIndex = (productState.currentPage - 1) * itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    if (resultsCount) {
        resultsCount.textContent = `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} available`;
    }

    renderProducts(paginatedProducts, '#products-page-grid');
    renderProductsPagination(filteredProducts.length, itemsPerPage);
    renderProductsCategoryList();
}



function setupProductsPageFilters() {
    const searchInput = document.getElementById('products-search-input');
    const heroSearchInput = document.getElementById('hero-category-search-input');
    const categoryList = document.getElementById('products-category-list');
    const categorySelect = document.getElementById('products-category-select');
    const pagination = document.getElementById('products-pagination');

    const handleSearch = (value) => {
        productState.pageSearchTerm = value.trim();
        productState.currentPage = 1;
        renderProductsPageCatalog();
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => handleSearch(searchInput.value));
    }

    if (heroSearchInput) {
        heroSearchInput.addEventListener('input', () => handleSearch(heroSearchInput.value));
        const suggestionsBox = document.getElementById('hero-suggestions-box');
        const searchWrapper = heroSearchInput.closest('.category-search-wrapper');

        heroSearchInput.addEventListener('input', () => {
            const value = heroSearchInput.value;
            handleSearch(value);
            updateSuggestions(value, suggestionsBox, searchWrapper);
        });

        if (suggestionsBox && searchWrapper) {
            attachSuggestionSelection(suggestionsBox, (selectedName) => {
                heroSearchInput.value = selectedName;
                handleSearch(selectedName);
                suggestionsBox.style.display = 'none';
                searchWrapper.classList.remove('is-open');
                requestAnimationFrame(() => focusProductByName(selectedName));
            });

            document.addEventListener('click', (e) => {
                if (!searchWrapper.contains(e.target)) {
                    suggestionsBox.style.display = 'none';
                    searchWrapper.classList.remove('is-open');
                }
            });
        }
    }

    // Connect the hero category chips to the main product catalog
    const heroCategoryList = document.querySelector('.hero-category-list');
    if (heroCategoryList) {
        heroCategoryList.addEventListener('click', event => {
            const chip = event.target.closest('.category-chip');
            if (!chip) return;

            productState.activeCategory = chip.textContent.trim();
            productState.currentPage = 1;
            renderProductsPageCatalog();
            
            // Scroll to the product grid after selecting a category
            const grid = document.getElementById('products-page-grid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    if (categoryList) {
        categoryList.addEventListener('click', event => {
            const trigger = event.target.closest('[data-category-filter]');
            if (!trigger) return;

            productState.activeCategory = trigger.dataset.categoryFilter;
            productState.currentPage = 1;
            renderProductsPageCatalog();
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            productState.activeCategory = categorySelect.value;
            productState.currentPage = 1;
            renderProductsPageCatalog();
        });
    }

    if (pagination) {
        pagination.addEventListener('click', event => {
            const trigger = event.target.closest('[data-page]');
            if (!trigger) return;

            productState.currentPage = Number(trigger.dataset.page);
            renderProductsPageCatalog();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function setupHeroButtons() {
    document.querySelectorAll('[data-open-products]').forEach(link => {
        link.addEventListener('click', () => {
            window.location.href = './products.html';
        });
    });

    document.querySelectorAll('[data-open-logistics]').forEach(link => {
        link.addEventListener('click', () => {
            window.location.href = './import-export.html';
        });
    });

    document.querySelectorAll('[data-open-about]').forEach(link => {
        link.addEventListener('click', () => {
            window.location.href = './about-us.html';
        });
    });

    document.querySelectorAll('[data-open-contact]').forEach(link => {
        link.addEventListener('click', () => {
            window.location.href = './contact-us.html';
        });
    });
}

function setupCategoryAccordions() {
    document.addEventListener('click', event => {
        const header = event.target.closest('.category-header');
        if (!header) return;

        const parentItem = header.parentElement;
        const siblings = parentItem.parentElement?.children || [];

        for (const sibling of siblings) {
            if (sibling !== parentItem && sibling.classList.contains('active')) {
                sibling.classList.remove('active');
            }
        }

        parentItem.classList.toggle('active');
    });
}

function setupNavbar() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');

    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    if (hamburger && navLinks) {
        hamburger.innerHTML = '&#9776;';

        hamburger.addEventListener('click', event => {
            event.stopPropagation();
            navLinks.classList.toggle('active');
            hamburger.innerHTML = navLinks.classList.contains('active') ? 'X' : '&#9776;';
        });

        navLinks.addEventListener('click', event => {
            if (event.target.tagName === 'A' || event.target.closest('a')) {
                navLinks.classList.remove('active');
                hamburger.innerHTML = '&#9776;';
            }
        });

        document.addEventListener('click', event => {
            const isClickInside = navLinks.contains(event.target) || hamburger.contains(event.target);
            if (!isClickInside && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                hamburger.innerHTML = '&#9776;';
            }
        });
    }
}

function setupQuoteModal() {
    const quoteCard = document.getElementById('request-quote');
    const quoteForm = document.querySelector('.quote-form');
    const quoteProductField = document.querySelector('.quote-form input[name="product"]');
    const appModal = document.getElementById('app-modal');
    const appModalPanel = appModal?.querySelector('.app-modal-panel');
    const appModalBadge = document.getElementById('app-modal-badge');
    const appModalTitle = document.getElementById('app-modal-title');
    const appModalMessage = document.getElementById('app-modal-message');
    const appModalConfirm = document.getElementById('app-modal-confirm');
    let modalPreviousFocus = null;

    function closeAppModal() {
        if (!appModal) return;

        appModal.classList.remove('is-open');
        appModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        if (modalPreviousFocus instanceof HTMLElement) {
            modalPreviousFocus.focus();
        }
    }

    function openAppModal({
        badge = 'Confirmed',
        title = 'Done',
        message = 'Your action has been completed.',
        confirmLabel = 'Continue',
        onConfirm
    } = {}) {
        if (!appModal || !appModalPanel || !appModalBadge || !appModalTitle || !appModalMessage || !appModalConfirm) {
            return;
        }

        modalPreviousFocus = document.activeElement;
        appModalBadge.textContent = badge;
        appModalTitle.textContent = title;
        appModalMessage.textContent = message;
        appModalConfirm.textContent = confirmLabel;
        appModalConfirm.onclick = () => {
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
            closeAppModal();
        };

        appModal.classList.add('is-open');
        appModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => appModalPanel.focus());
    }

    function openQuoteForm(productName = '') {
        if (!quoteCard) return;

        if (quoteProductField && productName) {
            quoteProductField.value = productName;
        }

        quoteCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        requestAnimationFrame(() => {
            if (quoteProductField) {
                quoteProductField.focus();
                if (productName) {
                    quoteProductField.setSelectionRange(
                        quoteProductField.value.length,
                        quoteProductField.value.length
                    );
                }
            }
        });
    }

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-rfq-trigger]');
        if (!trigger) return;

        event.preventDefault();
        const productName =
            trigger.dataset.productName ||
            trigger.closest('.product-card')?.querySelector('.product-name')?.textContent?.trim() ||
            '';

        openQuoteForm(productName);
    });

    if (quoteForm) {
        quoteForm.addEventListener('submit', event => {
            event.preventDefault();

            const formData = new FormData(quoteForm);
            const productName = String(formData.get('product') || '').trim();
            const customerName = String(formData.get('name') || '').trim();
            const contactEmail = String(formData.get('email') || '').trim();
            const contactPoint = customerName || contactEmail || 'your team';
            const productLine = productName ? ` for ${productName}` : '';

            openAppModal({
                badge: 'RFQ Sent',
                title: 'Quote request ready',
                message: `Thanks ${contactPoint}. Your request${productLine} has been captured and is ready for follow-up from Zeemax.`,
                confirmLabel: 'Back to form',
                onConfirm: () => {
                    quoteForm.reset();
                    openQuoteForm();
                }
            });
        });
    }

    if (appModal) {
        appModal.addEventListener('click', event => {
            if (event.target.closest('[data-modal-close]')) {
                closeAppModal();
            }
        });
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && appModal?.classList.contains('is-open')) {
            closeAppModal();
        }
    });
}

function setupLogisticsPage() {
    if (!pageConfig.isLogisticsPage) return;

    // 1. Lead-Time Estimator Logic
    const estimatorForm = document.getElementById('estimator-form');
    const estimatorResult = document.getElementById('estimator-result');

    if (estimatorForm && estimatorResult) {
        estimatorForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const origin = document.getElementById('origin-port').options[document.getElementById('origin-port').selectedIndex].text;
            const dest = document.getElementById('dest-port').options[document.getElementById('dest-port').selectedIndex].text;
            
            const sailTime = Math.floor(Math.random() * 20) + 15; 
            const clearanceTime = Math.floor(Math.random() * 5) + 3; 

            estimatorResult.innerHTML = `
                <h4 style="color: var(--primary); margin-bottom: 10px;">Estimate Details</h4>
                <p><strong>Route:</strong> ${origin} to ${dest}</p>
                <p><strong>Est. Sailing Time:</strong> ${sailTime} Days</p>
                <p><strong>Est. Customs Clearance:</strong> ${clearanceTime} Days</p>
                <p style="margin-top: 10px; font-weight: bold; color: var(--success);">Total Est. Lead Time: ${sailTime + clearanceTime} Days</p>
            `;
            estimatorResult.classList.remove('hidden');
        });
    }

    // 2. Compliance Vault Logic
    const vaultForm = document.getElementById('vault-form');
    const vaultResult = document.getElementById('vault-result');
    const batchInput = document.getElementById('batch-input');

    if (vaultForm && vaultResult && batchInput) {
        vaultForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const batchNo = batchInput.value;

            vaultResult.innerHTML = `
                <h4 style="color: var(--primary); margin-bottom: 10px;">Documents for ${batchNo}</h4>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: 8px;">📄 <a href="#" style="color: var(--primary); text-decoration: none; font-weight: 500;">Certificate of Analysis (CoA) - PDF</a></li>
                    <li style="margin-bottom: 8px;">📄 <a href="#" style="color: var(--primary); text-decoration: none; font-weight: 500;">Material Safety Data Sheet (MSDS) - PDF</a></li>
                    <li>📄 <a href="#" style="color: var(--primary); text-decoration: none; font-weight: 500;">Technical Data Sheet (TDS) - PDF</a></li>
                </ul>
            `;
            vaultResult.classList.remove('hidden');
        });
    }

    // 3. Tracker Logic
    const trackBtn = document.getElementById('track-btn');
    const trackingNumber = document.getElementById('tracking-number');
    const timeline = document.getElementById('shipment-timeline');

    if (trackBtn && trackingNumber && timeline) {
        trackBtn.addEventListener('click', () => {
            if(trackingNumber.value.trim() !== "") {
                timeline.classList.remove('hidden');
                timeline.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                alert("Please enter a valid tracking number.");
            }
        });
    }
}

function applyHashProductFocus() {
    if (!window.location.hash) return;
    const productName = chemicalProducts.find(product => `#${getProductAnchorId(product.name)}` === window.location.hash)?.name;
    if (!productName) return;
    requestAnimationFrame(() => focusProductByName(productName));
}

function setupProductHeroCarousel() {
    const track = document.getElementById('hero-carousel-track');
    if (!track) return;

    // Get a unique set of images from the chemical catalog
    const allImages = [...new Set(chemicalProducts.filter(p => p.image).map(p => `./assets/products/${p.image}`))];
    
    // Shuffle and pick 5 random images
    const selectedImages = allImages.sort(() => 0.5 - Math.random()).slice(0, 5);

    track.innerHTML = selectedImages.map(src => `
        <div class="hero-carousel-slide">
            <img src="${src}" alt="Industrial Chemicals" loading="lazy">
        </div>
    `).join('');

    // Simple carousel rotation logic
    let currentIndex = 0;
    const slideCount = selectedImages.length;

    if (slideCount > 1) {
        setInterval(() => {
            currentIndex = (currentIndex + 1) % slideCount;
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
        }, 5000); // Change image every 5 seconds
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load price overrides from Admin panel (localStorage)
    const STORAGE_KEY = 'zeemax_price_config';
    const savedPrices = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    applyPriceList(savedPrices);

    setupNavbar();
    setupHeroButtons();
    setupCategoryAccordions();
    setupQuoteModal();

    if (pageConfig.isHomePage) {
        renderHomeCategorySidebar();
        setupHomeSearch();
        renderHomeCatalog();
    }

    if (pageConfig.isProductsPage) {
        renderProductsPageCatalog();
        setupProductsPageFilters();
        setupProductHeroCarousel();
    }

    if (pageConfig.isLogisticsPage) {
        setupLogisticsPage();
    }

    applyHashProductFocus();
});
