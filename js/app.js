/**
 * iFindz Storefront - Matrix Card Grid Engine (Sem Imagens)
 * Renderização dinâmica fiel aos prints do usuário com agrupamento por modelo, capacidade e variantes de cores.
 */

const IFINDZ_APP = {
  rawProducts: [],
  groupedCards: [],
  cardRates: null,
  activeFilter: 'iphones-novos',
  searchQuery: '',

  // Lista de produtos / modelos para remover da vitrine (vazia para respeitar todo o estoque)
  excludedProducts: [],

  // Verifica se um produto deve ser filtrado/removido
  isProductExcluded(modelName, isSemi, rawProduct, storage = '') {
    const m = (modelName || '').trim().toUpperCase();
    const rawN = ((rawProduct && rawProduct.name) || '').toUpperCase();
    const s = (storage || (rawProduct && rawProduct.storage) || '').trim().toUpperCase();
    
    for (const item of this.excludedProducts) {
      if (typeof item === 'string') {
        const target = item.trim().toUpperCase();
        // Match exato do modelo (ex: IPHONE 13 PRO não remove IPHONE 13 PRO MAX)
        if (m === target) return true;
        if (isSemi && `${m} (SEMINOVO)` === target) return true;
        if (rawN.includes(target) && !rawN.includes('MAX') && target.endsWith('PRO')) return true;
        if (rawN.includes(target) && target.includes('MAX')) return true;
      } else if (typeof item === 'object' && item !== null) {
        const targetModel = (item.model || '').trim().toUpperCase();
        const matchesModel = !targetModel || m === targetModel;
        const matchesSemi = item.isSemi === undefined || item.isSemi === isSemi;
        const matchesStorage = !item.storage || s === item.storage.toUpperCase() || ((rawProduct && rawProduct.description) || '').toUpperCase().includes(item.storage.toUpperCase());
        if (matchesModel && matchesSemi && matchesStorage) {
          return true;
        }
      }
    }
    return false;
  },

  async init() {
    this.bindEvents();
    
    // Carrega dados da API e taxas
    try {
      const [products, rates] = await Promise.all([
        IFINDZ_API.getVitrineProducts(),
        IFINDZ_API.getCardRates()
      ]);

      this.rawProducts = products;
      this.cardRates = rates;
      IFINDZ_SIMULATOR.init(rates);

      this.processAndGroupProducts();
      this.render();
    } catch (e) {
      console.error('Erro na inicialização:', e);
    }
  },

  bindEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeFilter = pill.getAttribute('data-filter') || 'iphones-novos';
        // Limpa a busca ao trocar de categoria para focar na categoria clicada
        if (this.searchQuery && searchInput) {
          searchInput.value = '';
          this.searchQuery = '';
        }
        this.render();
      });
    });

    // Eventos do Menu Hambúrguer (Apple Style)
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => this.openDrawer());
    }
    if (closeMenuBtn) {
      closeMenuBtn.addEventListener('click', () => this.closeDrawer());
    }
    if (menuOverlay) {
      menuOverlay.addEventListener('click', () => this.closeDrawer());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDrawer();
      }
    });

    const drawerLinks = document.querySelectorAll('.hamburger-drawer a');
    drawerLinks.forEach(link => {
      link.addEventListener('click', () => this.closeDrawer());
    });
  },

  openDrawer() {
    const drawer = document.getElementById('hamburgerDrawer');
    const overlay = document.getElementById('menuOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (drawer && overlay) {
      drawer.classList.add('open');
      overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('hamburgerDrawer');
    const overlay = document.getElementById('menuOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (drawer && overlay) {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  },

  // Agrupa produtos brutos por [Modelo + Storage + RAM + Condição]
  processAndGroupProducts() {
    const map = new Map();

    this.rawProducts.forEach(p => {
      // Ignora produtos CPO, AS-IS ou seminovos descartados (< 13 ou 13 Mini) exatamente como a Loja Física
      if (this.isCpoProduct(p) || this.isAsIsProduct(p)) return;

      const isSemi = p.condition === 'SEMINOVO' || p.isSeminovo === true || (p.categoryKey === 'seminovos') || (p.categoryKey === 'iphones-seminovos') || (p.name && p.name.toUpperCase().includes('SEMINOVO'));
      
      if (isSemi && this.isDisallowedSeminovo(p.name)) return;

      let deviceKey = p.deviceKey;
      if (!deviceKey) {
        if (p.categoryKey === 'mac') deviceKey = 'mac';
        else if (p.categoryKey === 'ipad') deviceKey = 'ipad';
        else if (p.categoryKey === 'watch') deviceKey = 'watch';
        else if (p.categoryKey === 'airpods') deviceKey = 'airpods';
        else if (p.categoryKey === 'accessories') deviceKey = 'accessories';
        else deviceKey = 'iphone';
      }
      const cleanModel = this.cleanModelName(p.name);
      const storage = this.extractStorage(p.description) || p.storage || '';

      // Filtro de exclusão de produtos (por modelo, condição e capacidade)
      if (this.isProductExcluded(cleanModel, isSemi, p, storage)) {
        return;
      }
      
      // RAM: EXCLUSIVAMENTE para Macs e SOMENTE se estiver explicitamente declarado na API
      let ram = '';
      if (deviceKey === 'mac') {
        if (p.ram && String(p.ram).toUpperCase().includes('RAM')) {
          ram = p.ram.toUpperCase();
        } else {
          ram = this.extractRAM(p.name + ' ' + (p.description || ''), deviceKey);
        }
      }

      let color = this.extractColor(p.description, p.color, deviceKey, p.name);
      const rawPrice = Number(p.price || 0);

      // Tratamento inteligente para produtos sem cor explícita (AirPods, Cabos, Carregadores, etc.)
      if (!color) {
        if (deviceKey === 'airpods' || deviceKey === 'accessories') {
          color = 'BRANCO';
        } else if (deviceKey === 'mac') {
          color = 'PADRÃO';
        }
      }

      // Nunca aceitar preco zerado ou cor vazia
      if (rawPrice <= 0 || !color) {
        return;
      }

      // Para iPhones novos, a cor específica é obrigatória
      if (deviceKey === 'iphone' && (color === 'PADRÃO' || color === 'PADRAO')) {
        return;
      }

      const groupKey = `${cleanModel}__${storage}${ram ? '__' + ram : ''}__${isSemi ? 'SEMI' : 'NEW'}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          model: cleanModel,
          storage: storage,
          ram: ram,
          isSeminovo: isSemi,
          deviceKey: deviceKey,
          categoryKey: p.categoryKey,
          colors: new Map()
        });
      }

      const grp = map.get(groupKey);
      if (!grp.colors.has(color)) {
        grp.colors.set(color, {
          color: color,
          offers: [p],
          productId: p.id
        });
      } else {
        grp.colors.get(color).offers.push(p);
      }
    });

    // Converte para lista estruturada (calcula preço de referência de cada cor fiel à Loja Física)
    this.groupedCards = Array.from(map.values())
      .filter(grp => grp.colors.size > 0)
      .map(grp => {
        const colorsArr = Array.from(grp.colors.values()).map(colObj => {
          const price = this.calculateReferencePrice(colObj.offers, grp.isSeminovo);
          return {
            color: colObj.color,
            price: price,
            productId: colObj.offers[0] ? colObj.offers[0].id : colObj.productId
          };
        }).filter(c => c.price > 0).sort((a, b) => a.price - b.price);

        return {
          ...grp,
          colorsList: colorsArr,
          minPrice: colorsArr[0] ? colorsArr[0].price : 0
        };
      })
      .filter(grp => grp.colorsList && grp.colorsList.length > 0);

    // Ordenação estrita: Modelos mais recentes para os mais antigos; depois por capacidade (64GB -> 2TB); depois preço
    this.groupedCards.sort((a, b) => {
      const scoreA = this.getModelRecencyScore(a.model, a.deviceKey);
      const scoreB = this.getModelRecencyScore(b.model, b.deviceKey);
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      const stA = this.getStorageWeight(a.storage);
      const stB = this.getStorageWeight(b.storage);
      if (stA !== stB) {
        return stA - stB;
      }

      return a.minPrice - b.minPrice;
    });
  },

  cleanModelName(name) {
    if (!name) return 'PRODUTO APPLE';
    return name.toUpperCase()
      .replace(/^(?:IPH|MCB|RLG|PODS|ACSS)[\s\-]+/i, '')
      .replace(/\b(SEMINOVO|SEMINOVOS|SEMI-NOVO|SEMI-NOVOS|SEMI|NOVO|NOVOS|LACRADO|LACRADOS|ANATEL)\b/gi, '')
      .replace(/[-\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  extractStorage(desc) {
    if (!desc) return '';
    const match = desc.match(/\b(64GB|128GB|256GB|512GB|1TB|2TB|38MM|40MM|41MM|42MM|44MM|45MM|46MM|49MM)\b/i);
    return match ? match[1].toUpperCase() : '';
  },

  // Pontuação para ordenação decrescente: Mais recentes -> Mais antigos
  getModelRecencyScore(name, deviceKey) {
    const u = String(name || '').toUpperCase();
    let score = 0;

    // 1. Linha iPhones (Novos e Seminovos)
    if (deviceKey === 'iphone' || u.includes('IPHONE')) {
      const genMatch = u.match(/\b(?:IPHONE\s+)?(1[1-9]|20|[7-9])(?:E)?\b/);
      if (genMatch) {
        score += parseInt(genMatch[1], 10) * 10000;
      } else if (u.includes('XS MAX')) score += 10500;
      else if (u.includes('XS')) score += 10400;
      else if (u.includes('XR')) score += 10300;
      else if (u.includes(' X ')) score += 10000;
      else if (u.includes('SE 3') || u.includes('SE 2024') || u.includes('SE 2022')) score += 9500;
      else if (u.includes('SE 2') || u.includes('SE 2020')) score += 9200;
      else if (u.includes('SE')) score += 9000;

      // Sub-modelos dentro da mesma geração
      if (u.includes('PRO MAX')) score += 600;
      else if (u.includes('PRO')) score += 500;
      else if (u.includes('PLUS')) score += 400;
      else if (u.includes('AIR')) score += 350;
      else if (/\b1[0-9]E\b/.test(u) || u.includes(' 16E') || u.includes(' 17E') || u.includes(' 18E')) score += 100;
      else if (u.includes('MINI')) score += 50;
      else score += 300; // Base model (ex: iPhone 18, 17, 16, 15)
      return score;
    }

    // 2. Linha MacBooks & Macs
    if (deviceKey === 'mac' || u.includes('MAC')) {
      const mChip = u.match(/\bM([1-9])\b/i);
      const chipNum = mChip ? parseInt(mChip[1], 10) : 0;
      score += chipNum * 100000;

      if (u.includes('NEO')) score += 500000; // MacBook Neo

      // Modificadores de Chip (MAX > PRO > BASE)
      if (/\bM[1-9]\s+MAX\b/i.test(u) || (u.includes('MAX') && !u.includes('PRO MAX') && !u.includes('IPHONE'))) score += 3000;
      else if (/\bM[1-9]\s+PRO\b/i.test(u)) score += 2000;
      else if (chipNum > 0) score += 1000;

      // Categoria de Form Factor
      if (u.includes('MACBOOK PRO')) score += 500;
      else if (u.includes('MACBOOK AIR')) score += 400;
      else if (u.includes('MACBOOK NEO')) score += 350;
      else if (u.includes('MAC STUDIO')) score += 300;
      else if (u.includes('MAC MINI')) score += 200;
      else if (u.includes('IMAC')) score += 100;

      // Tamanho de tela
      if (u.includes('16"') || u.includes('16 POLEGADAS')) score += 30;
      else if (u.includes('15"') || u.includes('15 POLEGADAS')) score += 25;
      else if (u.includes('14"') || u.includes('14 POLEGADAS')) score += 20;
      else if (u.includes('13"') || u.includes('13 POLEGADAS')) score += 10;
      else if (u.includes('24"')) score += 5;

      return score;
    }

    // 3. Apple Watch
    if (deviceKey === 'watch' || u.includes('WATCH')) {
      if (u.includes('ULTRA 4')) return 50000;
      if (u.includes('ULTRA 3')) return 45000;
      if (u.includes('ULTRA 2')) return 40000;
      if (u.includes('ULTRA')) return 35000;

      const sMatch = u.match(/\b(?:S|SERIES\s*)([0-9]{1,2})\b/i);
      if (sMatch) {
        return 20000 + parseInt(sMatch[1], 10) * 1000;
      }
      if (u.includes('SE 3')) return 15000;
      if (u.includes('SE 2')) return 14000;
      if (u.includes('SE')) return 13000;
      return 10000;
    }

    // 4. AirPods
    if (deviceKey === 'airpods' || u.includes('AIRPOD')) {
      if (u.includes('MAX 2')) return 60000;
      if (u.includes('MAX')) return 55000;
      if (u.includes('PRO 3')) return 50000;
      if (u.includes('PRO 2')) return 45000;
      if (u.includes('PRO')) return 40000;
      if (u.includes('5')) return 35000;
      if (u.includes('4 ANC')) return 30000;
      if (u.includes('4')) return 28000;
      if (u.includes('3')) return 20000;
      if (u.includes('2')) return 15000;
      return 10000;
    }

    // 5. iPads
    if (deviceKey === 'ipad' || u.includes('IPAD')) {
      const mChip = u.match(/\bM([1-9])\b/i);
      const chipNum = mChip ? parseInt(mChip[1], 10) : 0;

      if (u.includes('PRO')) score += 60000 + chipNum * 5000;
      else if (u.includes('AIR')) score += 40000 + chipNum * 5000;
      else if (u.includes('MINI')) {
        const miniNum = u.match(/MINI\s*([0-9]+)/i);
        score += 30000 + (miniNum ? parseInt(miniNum[1], 10) * 1000 : 0);
      } else {
        const genNum = u.match(/\b(1[0-2]|[6-9])\b/);
        score += 20000 + (genNum ? parseInt(genNum[1], 10) * 1000 : 0);
      }

      if (u.includes('13"')) score += 300;
      else if (u.includes('11"')) score += 200;

      return score;
    }

    // 6. Acessórios
    if (deviceKey === 'accessories' || u.includes('AIRTAG') || u.includes('PENCIL') || u.includes('KEYBOARD') || u.includes('MOUSE') || u.includes('FOLIO')) {
      if (u.includes('AIRTAG 2')) return 5000;
      if (u.includes('AIRTAG')) return 4500;
      if (u.includes('PENCIL PRO')) return 4000;
      if (u.includes('PENCIL USB-C')) return 3800;
      if (u.includes('PENCIL 2')) return 3500;
      if (u.includes('PENCIL 1')) return 3000;
      if (u.includes('MAGIC MOUSE 3')) return 2500;
      if (u.includes('MAGIC MOUSE 2')) return 2000;
      return 1000;
    }

    return 0;
  },

  getStorageWeight(storage) {
    if (!storage) return 0;
    const s = String(storage).toUpperCase().trim();
    if (s.includes('2TB')) return 2048;
    if (s.includes('1TB')) return 1024;
    if (s.includes('512GB')) return 512;
    if (s.includes('256GB')) return 256;
    if (s.includes('128GB')) return 128;
    if (s.includes('64GB')) return 64;
    if (s.includes('32GB')) return 32;
    if (s.includes('49MM')) return 49;
    if (s.includes('46MM')) return 46;
    if (s.includes('45MM')) return 45;
    if (s.includes('44MM')) return 44;
    if (s.includes('42MM')) return 42;
    if (s.includes('41MM')) return 41;
    if (s.includes('40MM')) return 40;
    if (s.includes('38MM')) return 38;
    return 0;
  },

  // Extrai RAM apenas se explicitamente declarada com a palavra RAM e somente para Macs
  extractRAM(text, deviceKey) {
    if (!text || deviceKey !== 'mac') return '';
    const match = text.match(/\b(8GB|16GB|18GB|24GB|32GB|36GB|48GB|64GB|96GB|128GB)\s+(?:RAM|DE\s*RAM|UNIFIED)\b/i);
    return match ? match[1].toUpperCase() + ' RAM' : '';
  },

  // Preço principal oficial fiel à vitrine (menor valor entre as ofertas para novos, mediana para seminovos)
  calculateReferencePrice(offers, isSemi) {
    if (!offers || offers.length === 0) return 0;
    const validPrices = offers
      .map(o => (typeof o === 'object' ? Number(o.price) : Number(o)) || 0)
      .filter(p => p > 0);

    if (validPrices.length === 0) return 0;
    // Para produtos novos: melhor preço principal disponível
    if (!isSemi) {
      return Math.min(...validPrices);
    }
    // Para seminovos: mediana central das ofertas
    if (validPrices.length === 1) return validPrices[0];
    validPrices.sort((a, b) => a - b);
    if (validPrices.length === 2) return Math.round((validPrices[0] + validPrices[1]) / 2);
    if (validPrices.length === 3) return validPrices[1];

    const trimmed = validPrices.slice(1, -1);
    const sum = trimmed.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / trimmed.length);
  },

  // Filtros de higiene de dados oficiais da Loja Física
  isDisallowedSeminovo(name) {
    if (!name) return false;
    const n = name.toUpperCase();
    if (n.includes('13 MINI') || n.includes('13-MINI') || n.includes('13MINI')) return true;
    if (/\b(IPHONE|IPH)\s+(11|12|X|XR|XS|SE|8|7|6)\b/i.test(n)) {
      return true;
    }
    return false;
  },

  isCpoProduct(p) {
    if (!p) return false;
    const name = ((p && p.name) || '').toUpperCase();
    const desc = ((p && p.description) || '').toUpperCase();
    return name.includes('CPO') || desc.includes('CPO');
  },

  isAsIsProduct(p) {
    if (!p) return false;
    const cat = ((p && p.category) || '').toUpperCase().trim();
    const name = ((p && p.name) || '').toUpperCase();
    const desc = ((p && p.description) || '').toUpperCase();
    return (
      name.includes('AS IS') || name.includes('AS-IS') || name.includes('ASIS') ||
      desc.includes('AS IS') || desc.includes('AS-IS') || desc.includes('ASIS') ||
      cat.includes('AS IS')
    );
  },

  extractColor(desc, rawColor = '', deviceKey = '', productName = '') {
    // 1. Se a API já enviou a cor direta e válida, respeita 100% o nome oficial da cor
    if (rawColor && typeof rawColor === 'string') {
      const c = rawColor.trim().toUpperCase();
      if (c && c !== 'PADRÃO' && c !== 'PADRAO' && c !== 'NULL' && c !== 'UNDEFINED' && c !== 'NONE') {
        return c;
      }
    }

    // 2. Se for acessório Apple sem cor explícita (AirPods, Pencil, AirTag), a cor oficial é BRANCO
    const pUpper = (productName || '').toUpperCase();
    if (deviceKey === 'airpods' || pUpper.includes('AIRPOD') || pUpper.includes('PENCIL') || pUpper.includes('AIRTAG')) {
      return 'BRANCO';
    }

    // 3. Se for Mac Mini ou Mac Studio sem cor explícita, a cor oficial de fábrica é SILVER
    if (pUpper.includes('MAC MINI') || pUpper.includes('MAC STUDIO')) {
      return 'SILVER';
    }

    if (!desc) return '';
    const clean = desc.toUpperCase();

    // 4. Cores Titanium oficiais
    if (clean.includes('BLUE TITANIUM') || clean.includes('TITÂNIO AZUL')) return 'BLUE TITANIUM';
    if (clean.includes('BLACK TITANIUM') || clean.includes('TITÂNIO PRETO')) return 'BLACK TITANIUM';
    if (clean.includes('WHITE TITANIUM') || clean.includes('TITÂNIO BRANCO')) return 'WHITE TITANIUM';
    if (clean.includes('NATURAL TITANIUM') || clean.includes('TITÂNIO NATURAL')) return 'NATURAL TITANIUM';
    if (clean.includes('DESERT TITANIUM') || clean.includes('TITÂNIO DESERTO')) return 'DESERT TITANIUM';

    // 5. Cores icônicas da Apple
    if (clean.includes('SIERRA BLUE')) return 'SIERRA BLUE';
    if (clean.includes('ALPINE GREEN')) return 'ALPINE GREEN';
    if (clean.includes('PACIFIC BLUE')) return 'PACIFIC BLUE';
    if (clean.includes('DEEP PURPLE')) return 'DEEP PURPLE';
    if (clean.includes('GRAPHITE') || clean.includes('GRAFITE')) return 'GRAPHITE';
    if (clean.includes('SPACE BLACK')) return 'SPACE BLACK';
    if (clean.includes('JET BLACK')) return 'JET BLACK';
    if (clean.includes('SPACE GRAY') || clean.includes('CINZA')) return 'SPACE GRAY';
    if (clean.includes('MIDNIGHT') || clean.includes('MEIA-NOITE')) return 'MIDNIGHT';
    if (clean.includes('STARLIGHT') || clean.includes('ESTELAR')) return 'STARLIGHT';
    if (clean.includes('ROSE GOLD')) return 'ROSE GOLD';
    if (clean.includes('BURGUNDY') || clean.includes('BORDO') || clean.includes('VINHO')) return 'BURGUNDY';
    if (clean.includes('GLACIER') || clean.includes('GLACIAL')) return 'GLACIER';
    if (clean.includes('COSMIC ORANGE')) return 'COSMIC ORANGE';
    if (clean.includes('DEEP BLUE')) return 'DEEP BLUE';
    if (clean.includes('SKY BLUE')) return 'SKY BLUE';
    if (clean.includes('MIST BLUE')) return 'MIST BLUE';
    if (clean.includes('SOFT PINK')) return 'SOFT PINK';
    if (clean.includes('LIGHT GOLD')) return 'LIGHT GOLD';
    if (clean.includes('CLOUD WHITE')) return 'CLOUD WHITE';
    if (clean.includes('DARK BRONZE')) return 'DARK BRONZE';
    if (clean.includes('ULTRAMARINE')) return 'ULTRAMARINE';
    if (clean.includes('TEAL')) return 'TEAL';
    if (clean.includes('SAGE')) return 'SAGE';
    if (clean.includes('BLUSH')) return 'BLUSH';
    if (clean.includes('CITRUS')) return 'CITRUS';
    if (clean.includes('INDIGO')) return 'INDIGO';
    if (clean.includes('CHARCOAL')) return 'CHARCOAL GRAY';
    if (clean.includes('LAVENDER') || clean.includes('ROXO')) return 'LAVENDER';
    if (clean.includes('PURPLE')) return 'PURPLE';
    if (clean.includes('BLACK') || clean.includes('PRETO')) return 'BLACK';
    if (clean.includes('SILVER') || clean.includes('PRATA')) return 'SILVER';
    if (clean.includes('WHITE') || clean.includes('BRANCO')) return 'WHITE';
    if (clean.includes('GOLD') || clean.includes('DOURADO')) return 'GOLD';
    if (clean.includes('YELLOW') || clean.includes('AMARELO')) return 'YELLOW';
    if (clean.includes('GREEN') || clean.includes('VERDE')) return 'GREEN';
    if (clean.includes('BLUE') || clean.includes('AZUL')) return 'BLUE';
    if (clean.includes('PINK') || clean.includes('ROSA')) return 'PINK';
    if (clean.includes('RED') || clean.includes('VERMELHO')) return 'RED';
    if (clean.includes('ORANGE') || clean.includes('LARANJA')) return 'ORANGE';
    if (clean.includes('CORAL')) return 'CORAL';
    
    // Tenta pegar o último termo após traço
    const parts = desc.split('-');
    if (parts.length > 1) {
      const candidate = parts[parts.length - 1].trim().toUpperCase();
      if (candidate && !candidate.includes('GB') && !candidate.includes('TB') && !candidate.includes('RAM') && !candidate.includes('SEMI')) {
        return candidate;
      }
    }
    return '';
  },

  getAppleColorHex(colorName) {
    if (!colorName) return '#94a3b8';
    const c = colorName.trim().toUpperCase();

    // Linha Titânio (iPhone 15 Pro / 16 Pro)
    if (c.includes('BLUE TITANIUM')) return '#3d4451';
    if (c.includes('BLACK TITANIUM')) return '#2b2b2d';
    if (c.includes('WHITE TITANIUM')) return '#e5e5ea';
    if (c.includes('NATURAL TITANIUM') || c === 'NATURAL') return '#9f9a93';
    if (c.includes('DESERT TITANIUM') || c.includes('DESERT') || c.includes('DESERTO')) return '#c8a882';

    // Cores específicas e icônicas Apple
    if (c.includes('SIERRA BLUE')) return '#9bbad0';
    if (c.includes('ALPINE GREEN')) return '#536553';
    if (c.includes('PACIFIC BLUE')) return '#2e4f5e';
    if (c.includes('DEEP PURPLE')) return '#433649';
    if (c.includes('GRAPHITE') || c.includes('GRAFITE')) return '#5c5b57';
    if (c.includes('GLACIER') || c.includes('GLACIAL')) return '#a4c6da';
    if (c.includes('BURGUNDY') || c.includes('BORDO') || c.includes('VINHO') || c.includes('CABERNET')) return '#6b1d2f';
    if (c.includes('COSMIC') || c.includes('ORANGE') || c.includes('LARANJ')) return '#e06d53';
    if (c.includes('DEEP BLUE')) return '#1b365d';
    if (c.includes('SPACE BLACK') || c.includes('JET BLACK')) return '#1a1a1a';
    if (c.includes('SPACE GRAY') || c.includes('CINZA')) return '#535150';
    if (c.includes('MIDNIGHT') || c.includes('MEIA-NOITE')) return '#192028';
    if (c.includes('STARLIGHT') || c.includes('ESTELAR')) return '#f0ece8';
    if (c.includes('ROSE GOLD')) return '#e0a899';
    if (c.includes('LIGHT GOLD')) return '#f5e7d0';
    if (c.includes('GOLD') || c.includes('DOURADO')) return '#f5e7d0';
    if (c.includes('SILVER') || c.includes('PRATA')) return '#e2e8f0';
    if (c.includes('CLOUD WHITE') || c.includes('WHITE') || c.includes('BRANCO')) return '#f8fafc';
    if (c.includes('BLACK') || c.includes('PRETO')) return '#111827';
    if (c.includes('ULTRAMARINE') || c.includes('ULTRAMARIN') || c.includes('INDIGO')) return '#4052b5';
    if (c.includes('TEAL')) return '#3b827e';
    if (c.includes('SAGE')) return '#9cad9e';
    if (c.includes('MIST BLUE')) return '#a4b8c4';
    if (c.includes('SKY BLUE')) return '#87ceeb';
    if (c.includes('BLUE') || c.includes('AZUL')) return '#2563eb';
    if (c.includes('SOFT PINK')) return '#fcd5ce';
    if (c.includes('BLUSH')) return '#e8a598';
    if (c.includes('PINK') || c.includes('ROSA') || c.includes('ROSE')) return '#f7c5cc';
    if (c.includes('CITRUS')) return '#e5a03b';
    if (c.includes('CHARCOAL')) return '#4b5563';
    if (c.includes('LAVENDER') || c.includes('ROXO') || c.includes('VIOLET') || c.includes('LILAS')) return '#b5b0cd';
    if (c.includes('PURPLE')) return '#b39ddb';
    if (c.includes('YELLOW') || c.includes('AMARELO')) return '#f9e58b';
    if (c.includes('GREEN') || c.includes('VERDE')) return '#4ade80';
    if (c.includes('RED') || c.includes('VERMELHO')) return '#d02030';
    if (c.includes('CORAL')) return '#ff6f61';
    if (c.includes('DARK BRONZE')) return '#5c4033';

    return '#94a3b8';
  },

  render() {
    const container = document.getElementById('matrixMainContainer');
    if (!container) return;

    let filtered = this.groupedCards;

    // Filtro por Busca ou por Categoria
    if (this.searchQuery) {
      filtered = filtered.filter(g => {
        const text = `${g.model} ${g.storage} ${g.ram} ${g.colorsList.map(c => c.color).join(' ')}`.toLowerCase();
        return text.includes(this.searchQuery);
      });
    } else {
      if (this.activeFilter === 'iphones-novos') {
        filtered = filtered.filter(g => g.deviceKey === 'iphone' && !g.isSeminovo);
      } else if (this.activeFilter === 'iphones-seminovos') {
        filtered = filtered.filter(g => g.isSeminovo);
      } else if (this.activeFilter === 'mac') {
        filtered = filtered.filter(g => g.deviceKey === 'mac');
      } else if (this.activeFilter === 'ipad') {
        filtered = filtered.filter(g => g.deviceKey === 'ipad');
      } else if (this.activeFilter === 'watch') {
        filtered = filtered.filter(g => g.deviceKey === 'watch');
      } else if (this.activeFilter === 'airpods') {
        filtered = filtered.filter(g => g.deviceKey === 'airpods');
      } else if (this.activeFilter === 'accessories') {
        filtered = filtered.filter(g => g.deviceKey === 'accessories');
      }
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 60px 20px; color: var(--text-muted);">
          <h3 style="font-size:1.15rem; color:var(--text-main); font-weight:700;">Nenhum produto encontrado</h3>
          <p style="margin-top:8px;">Tente pesquisar por outro modelo ou selecione outra categoria acima.</p>
        </div>
      `;
      return;
    }

    // Seções organizadas com cabeçalhos elegantes
    const sections = [
      { id: 'iphones-novos', title: 'iPhones Novos', filter: g => g.deviceKey === 'iphone' && !g.isSeminovo },
      { id: 'iphones-semi', title: 'iPhones Seminovos', filter: g => g.isSeminovo },
      { id: 'macs', title: 'MacBooks', filter: g => g.deviceKey === 'mac' },
      { id: 'ipads', title: 'iPads', filter: g => g.deviceKey === 'ipad' },
      { id: 'watch', title: 'Apple Watch', filter: g => g.deviceKey === 'watch' },
      { id: 'airpods', title: 'AirPods', filter: g => g.deviceKey === 'airpods' },
      { id: 'accessories', title: 'Acessórios Apple', filter: g => g.deviceKey === 'accessories' },
      { id: 'outros', title: 'Outros Produtos', filter: g => !['iphone', 'mac', 'ipad', 'watch', 'airpods', 'accessories'].includes(g.deviceKey) && !g.isSeminovo }
    ];

    let fullHtml = '';

    sections.forEach(sec => {
      const items = filtered.filter(sec.filter);
      if (items.length === 0) return;

      // Agrupa cards por modelo base (ex: 18 Pro Max, 18 Pro, 17 Pro Max, etc.)
      // garantindo que cada modelo fique em seu próprio bloco/linha com espaçamento amplo
      const modelMap = new Map();
      items.forEach(grp => {
        const mKey = `${grp.model}__${grp.isSeminovo ? 'SEMI' : 'NEW'}`;
        if (!modelMap.has(mKey)) {
          modelMap.set(mKey, []);
        }
        modelMap.get(mKey).push(grp);
      });

      const modelBlocksHtml = Array.from(modelMap.values()).map(modelCards => `
        <div class="model-family-block">
          <div class="matrix-grid">
            ${modelCards.map(grp => this.renderCardHtml(grp)).join('')}
          </div>
        </div>
      `).join('');

      fullHtml += `
        <div class="section-group">
          <div class="section-header">
            <h2 class="section-title">${sec.title}</h2>
            <span class="section-count">${items.length} modelos</span>
          </div>
          <div class="model-families-container">
            ${modelBlocksHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = fullHtml;
  },

  renderCardHtml(grp) {
    const colorRowsHtml = grp.colorsList.map(col => {
      const hex = this.getAppleColorHex(col.color);
      const isLightColor = hex === '#e2e8f0' || hex === '#f8fafc' || hex === '#f0ece8' || hex === '#f7c5cc';

      return `
        <div class="matrix-color-row" onclick="IFINDZ_APP.openSimulator('${encodeURIComponent(grp.model)}', '${encodeURIComponent(grp.storage)}', '${encodeURIComponent(col.color)}', ${col.price}, '${encodeURIComponent(grp.ram)}', ${grp.isSeminovo})" title="Simular parcelamento">
          <div class="matrix-color-left">
            <span class="matrix-color-dot" style="background-color: ${hex}; ${isLightColor ? 'border: 1px solid #cbd5e1;' : ''}"></span>
            <span class="matrix-color-name">${col.color}</span>
          </div>
          <div class="matrix-color-right">
            <div class="matrix-cost-group">
              <span class="matrix-cost-label">À VISTA</span>
              <span class="matrix-retail-val">${this.formatBRL(col.price)}</span>
            </div>
            <div class="matrix-actions-group">
              <button class="btn-simulate-icon" onclick="event.stopPropagation(); IFINDZ_APP.openSimulator('${encodeURIComponent(grp.model)}', '${encodeURIComponent(grp.storage)}', '${encodeURIComponent(col.color)}', ${col.price}, '${encodeURIComponent(grp.ram)}', ${grp.isSeminovo})" title="Simular no Cartão">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2.5"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </button>
              <button class="btn-cart-direct-wpp" onclick="event.stopPropagation(); IFINDZ_APP.buyDirectWhatsApp('${encodeURIComponent(grp.model)}', '${encodeURIComponent(grp.storage)}', '${encodeURIComponent(col.color)}', ${col.price}, '${encodeURIComponent(grp.ram)}', ${grp.isSeminovo})" title="Comprar pelo WhatsApp">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <article class="matrix-card">
        <div class="matrix-card-header">
          <div class="matrix-card-title-group">
            <h3 class="matrix-card-title">
              ${grp.model}
              ${grp.isSeminovo ? '<span class="matrix-title-semi">(SEMINOVO)</span>' : ''}
            </h3>
            <div class="matrix-card-badges">
              ${grp.isSeminovo ? `<span class="badge-seminovo">SEMINOVO</span>` : ''}
              ${grp.ram ? `<span class="badge-ram">${grp.ram}</span>` : ''}
              ${grp.storage ? `<span class="badge-storage">${grp.storage}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="matrix-card-body">
          ${colorRowsHtml}
        </div>
      </article>
    `;
  },

  openSimulator(modelEncoded, storageEncoded, colorEncoded, price, ramEncoded, isSeminovo) {
    const model = decodeURIComponent(modelEncoded);
    const storage = decodeURIComponent(storageEncoded);
    const color = decodeURIComponent(colorEncoded);
    const ram = decodeURIComponent(ramEncoded);

    const descParts = [];
    if (isSeminovo) descParts.push('SEMINOVO');
    if (ram) descParts.push(ram);
    if (storage) descParts.push(storage);
    if (color) descParts.push(color);

    const productObj = {
      name: model,
      description: descParts.join(' • '),
      price: Number(price),
      color: color,
      storage: storage
    };

    IFINDZ_SIMULATOR.open(productObj);
  },

  buyDirectWhatsApp(modelEncoded, storageEncoded, colorEncoded, price, ramEncoded, isSeminovo) {
    const model = decodeURIComponent(modelEncoded);
    const storage = decodeURIComponent(storageEncoded);
    const color = decodeURIComponent(colorEncoded);
    const ram = decodeURIComponent(ramEncoded);

    const descParts = [];
    if (isSeminovo) descParts.push('SEMINOVO');
    if (ram) descParts.push(ram);
    if (storage) descParts.push(storage);
    const specs = descParts.length > 0 ? ` (${descParts.join(' • ')})` : '';

    const msg = `Olá! Tenho interesse no produto: *${model}${specs}* Cor: *${color}* Valor à Vista: *${this.formatBRL(price)}*. Ainda está disponível?`;

    const storePhone = '5511930089729';
    const wppUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(msg)}`;
    window.open(wppUrl, '_blank');
  },

  formatBRL(val) {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  IFINDZ_APP.init();
});
