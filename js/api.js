/**
 * iFindz API Client
 * Integração com rota de vitrine e fallback inteligente para produtos e taxas em tempo real
 */

const API_CONFIG = {
  VITRINE_URL: 'https://srv2058756.hstgr.cloud/api/products',
  PRODUCTS_FALLBACK_URL: 'https://srv2058756.hstgr.cloud/api/v1/vitrine',
  CARD_RATES_URL: 'https://srv2058756.hstgr.cloud/api/card-rates',
  DEFAULT_RATES: {
    baseRate: 2.69,
    calculationMode: 'factor',
    installmentRates: {
      '1': 3.05, '2': 1.5, '3': 2.25, '4': 3.0, '5': 3.75, '6': 4.5,
      '7': 5.25, '8': 6.0, '9': 6.75, '10': 7.5, '11': 8.25, '12': 9.0,
      '13': 9.75, '14': 10.5, '15': 11.25, '16': 12.0, '17': 12.75, '18': 13.5
    }
  }
};

const IFINDZ_API = {
  // Busca produtos da vitrine
  async getVitrineProducts() {
    try {
      console.log('iFindz API: Requisitando vitrine primária...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(API_CONFIG.VITRINE_URL, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Vitrine primária carregada com sucesso');
        return this.normalizeProducts(data);
      }
      throw new Error(`Vitrine primária retornou status ${response.status}`);
    } catch (err) {
      console.warn('Vitrine primária indisponível/timeout, ativando fallback em tempo real:', err.message);
      return await this.getFallbackProducts();
    }
  },

  // Fallback em tempo real para /api/products
  async getFallbackProducts() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(API_CONFIG.PRODUCTS_FALLBACK_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Fallback HTTP status: ${response.status}`);
      }
      const json = await response.json();
      const rawProducts = json.data || json.products || (Array.isArray(json) ? json : []);
      if (rawProducts.length > 0) {
        return this.normalizeProducts(rawProducts);
      }
      return this.getMockProducts();
    } catch (fallbackErr) {
      console.error('Falha no fallback da API, exibindo vitrine catalogada:', fallbackErr);
      return this.getMockProducts();
    }
  },

  // Busca taxas reais da maquininha para o simulador
  async getCardRates() {
    try {
      const resp = await fetch(API_CONFIG.CARD_RATES_URL);
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.rates) {
          return json.rates;
        }
      }
    } catch (e) {
      console.warn('Usando taxas padrão de parcelamento:', e);
    }
    return API_CONFIG.DEFAULT_RATES;
  },

  // Normalização e categorização inteligente dos dados
  normalizeProducts(products) {
    if (!Array.isArray(products)) {
      if (products.data && Array.isArray(products.data)) products = products.data;
      else if (products.products && Array.isArray(products.products)) products = products.products;
      else products = [];
    }

    return products.map(p => {
      const rawName = (p.name || p.nome || p.title || 'Produto Apple').toUpperCase();
      const rawCat = (p.category || p.categoria || '').toUpperCase();
      const isSemi = p.isSeminovo === true || rawCat === 'SEMI' || rawName.includes('SEMINOVO') || p.condition === 'SEMINOVO';
      
      // Detecção precisa de categoria base de produto (deviceKey)
      let deviceKey = 'accessories';
      let category = 'Acessórios';

      if (rawCat === 'ACSS' || rawName.includes('CABO') || rawName.includes('CARREGADOR') || rawName.includes('FONTE') || rawName.includes('CASE') || rawName.includes('CAPA') || rawName.includes('ADAPTADOR') || rawName.includes('MAGIC') || rawName.includes('PENCIL') || rawName.includes('AIRTAG') || rawName.includes('FOLIO')) {
        deviceKey = 'accessories';
        category = 'Acessórios';
      } else if (rawCat === 'IPH' || rawName.includes('IPHONE')) {
        deviceKey = 'iphone';
        category = isSemi ? 'iPhones Seminovos' : 'iPhones Novos';
      } else if (rawCat === 'MCB' || rawName.includes('MACBOOK') || rawName.includes('MAC MINI') || rawName.includes('MAC STUDIO') || rawName.includes('IMAC') || (rawName.includes('MAC') && !rawName.includes('MAX'))) {
        deviceKey = 'mac';
        category = 'MacBooks';
      } else if (rawCat === 'IPAD' || rawName.includes('IPAD')) {
        deviceKey = 'ipad';
        category = 'iPads';
      } else if (rawCat === 'RLG' || rawName.includes('WATCH') || rawName.includes('ULTRA 2') || rawName.includes('ULTRA 1') || rawName.includes('SERIES ')) {
        deviceKey = 'watch';
        category = 'Apple Watch';
      } else if (rawCat === 'PODS' || rawName.includes('AIRPOD') || rawName.includes('AIRPODS')) {
        deviceKey = 'airpods';
        category = 'AirPods';
      } else if (rawCat === 'SEMI') {
        if (rawName.includes('MAC')) {
          deviceKey = 'mac';
          category = 'MacBooks';
        } else if (rawName.includes('IPAD')) {
          deviceKey = 'ipad';
          category = 'iPads';
        } else if (rawName.includes('WATCH')) {
          deviceKey = 'watch';
          category = 'Apple Watch';
        } else {
          deviceKey = 'iphone';
          category = 'iPhones Seminovos';
        }
      } else {
        if (rawName.startsWith('11 ') || rawName.startsWith('12 ') || rawName.startsWith('13 ') || rawName.startsWith('14 ') || rawName.startsWith('15 ') || rawName.startsWith('16 ') || rawName.startsWith('17 ') || rawName.startsWith('18 ') || rawName.includes('PRO MAX') || rawName.includes('PLUS')) {
          deviceKey = 'iphone';
          category = isSemi ? 'iPhones Seminovos' : 'iPhones Novos';
        } else {
          deviceKey = 'accessories';
          category = 'Acessórios';
        }
      }

      const price = Number(p.price || p.preco || p.valor || 0);
      const specString = p.storage ? `${p.storage} • ${p.color || ''}` : 'Original Lacrado';

      return {
        id: p.id || Math.random().toString(36).substr(2, 9),
        name: p.name || 'Produto Apple',
        description: p.description || p.descricao || specString,
        price: price,
        category: category,
        deviceKey: deviceKey,
        categoryKey: isSemi ? 'iphones-seminovos' : (deviceKey === 'iphone' ? 'iphones-novos' : deviceKey),
        storage: p.storage || '',
        color: p.color || '',
        region: p.region || 'ANATEL / Global',
        condition: isSemi ? 'SEMINOVO' : 'NOVO',
        isSeminovo: isSemi,
        badge: isSemi ? 'GARANTIA iFindz' : (p.condition === 'NOVO' ? 'NOVO' : 'LANÇAMENTO')
      };
    });
  },

  getMockProducts() {
    return [
      // iPhones Novos (Fiel ao Print 1)
      { name: 'iPhone 18 Pro Max', description: '256GB - Black', price: 9600, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '256GB - Silver', price: 9840, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '256GB - Glacier', price: 10290, color: 'GLACIER', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '256GB - Burgundy', price: 10520, color: 'BURGUNDY', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '512GB - Glacier', price: 11340, color: 'GLACIER', storage: '512GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '512GB - Silver', price: 11350, color: 'SILVER', storage: '512GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '512GB - Black', price: 11500, color: 'BLACK', storage: '512GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '512GB - Burgundy', price: 12700, color: 'BURGUNDY', storage: '512GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '1TB - Glacier', price: 15890, color: 'GLACIER', storage: '1TB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '1TB - Silver', price: 16250, color: 'SILVER', storage: '1TB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '1TB - Black', price: 16250, color: 'BLACK', storage: '1TB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro Max', description: '1TB - Burgundy', price: 17650, color: 'BURGUNDY', storage: '1TB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro', description: '256GB - Silver', price: 8500, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro', description: '256GB - Glacier', price: 8500, color: 'GLACIER', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro', description: '256GB - Black', price: 8550, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 18 Pro', description: '256GB - Burgundy', price: 9090, color: 'BURGUNDY', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 17 Pro Max', description: '256GB - Cosmic Orange', price: 7440, color: 'COSMIC ORANGE', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 17 Pro Max', description: '256GB - Deep Blue', price: 7540, color: 'DEEP BLUE', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 17 Pro Max', description: '256GB - Silver', price: 7720, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 17 Pro', description: '256GB - Cosmic Orange', price: 6990, color: 'COSMIC ORANGE', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 17 Pro', description: '256GB - Deep Blue', price: 7180, color: 'DEEP BLUE', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 17 Pro', description: '256GB - Silver', price: 7240, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      // iPhones Seminovos (Fiel ao Print 2)
      { name: 'iPhone 18 Pro Max', description: '256GB - Black - SEMINOVO', price: 9650, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro Max', description: '256GB - Silver - SEMINOVO', price: 9700, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro Max', description: '256GB - Glacier - SEMINOVO', price: 10400, color: 'GLACIER', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro Max', description: '256GB - Burgundy - SEMINOVO', price: 10600, color: 'BURGUNDY', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro Max', description: '512GB - Burgundy - SEMINOVO', price: 12800, color: 'BURGUNDY', storage: '512GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro', description: '256GB - Black - SEMINOVO', price: 8900, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro', description: '256GB - Glacier - SEMINOVO', price: 8900, color: 'GLACIER', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro', description: '256GB - Silver - SEMINOVO', price: 8900, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 18 Pro', description: '256GB - Burgundy - SEMINOVO', price: 9700, color: 'BURGUNDY', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 17 Pro Max', description: '256GB - Cosmic Orange - SEMINOVO', price: 6984, color: 'COSMIC ORANGE', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 17 Pro Max', description: '256GB - Deep Blue - SEMINOVO', price: 7038, color: 'DEEP BLUE', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 17 Pro Max', description: '256GB - Silver - SEMINOVO', price: 7189, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 17 Pro', description: '256GB - Cosmic Orange - SEMINOVO', price: 6650, color: 'COSMIC ORANGE', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 17 Pro', description: '256GB - Deep Blue - SEMINOVO', price: 6694, color: 'DEEP BLUE', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 17 Pro', description: '256GB - Silver - SEMINOVO', price: 6808, color: 'SILVER', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },

      // MacBooks (Fiel à API Oficial: Modelo + Armazenamento)
      { name: 'MacBook Pro M5 Pro 16"', description: '1TB - Silver', price: 17700, color: 'SILVER', storage: '1TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 16"', description: '1TB - Space Black', price: 18000, color: 'SPACE BLACK', storage: '1TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 16"', description: '2TB - Silver', price: 19200, color: 'SILVER', storage: '2TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 16"', description: '2TB - Space Black', price: 19200, color: 'SPACE BLACK', storage: '2TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 14"', description: '1TB - Silver', price: 16150, color: 'SILVER', storage: '1TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 14"', description: '1TB - Space Black', price: 16450, color: 'SPACE BLACK', storage: '1TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 14"', description: '2TB - Silver', price: 18400, color: 'SILVER', storage: '2TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 Pro 14"', description: '2TB - Space Black', price: 19500, color: 'SPACE BLACK', storage: '2TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 14"', description: '512GB - Space Black', price: 13250, color: 'SPACE BLACK', storage: '512GB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 14"', description: '1TB - Space Black', price: 12850, color: 'SPACE BLACK', storage: '1TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro M5 14"', description: '1TB - Silver', price: 13000, color: 'SILVER', storage: '1TB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },

      // iPads
      { name: 'iPad Pro 13" M4', description: '256GB - Space Black', price: 8490, color: 'SPACE BLACK', storage: '256GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad Pro 13" M4', description: '256GB - Silver', price: 8490, color: 'SILVER', storage: '256GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad Air 11" M2', description: '128GB - Space Gray', price: 4490, color: 'SPACE GRAY', storage: '128GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad Air 11" M2', description: '128GB - Starlight', price: 4490, color: 'STARLIGHT', storage: '128GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },

      // Apple Watch
      { name: 'Apple Watch Ultra 2', description: '49mm Titânio Natural - Ocean Band Blue', price: 5490, color: 'NATURAL TITANIUM', storage: '', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch Ultra 2', description: '49mm Titânio Preto - Black Trail Loop', price: 5690, color: 'SPACE BLACK', storage: '', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch Series 10', description: '46mm Alumínio - Jet Black', price: 3490, color: 'BLACK', storage: '', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch Series 10', description: '46mm Alumínio - Rose Gold', price: 3490, color: 'ROSE', storage: '', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },

      // AirPods
      { name: 'AirPods Pro 2', description: 'USB-C MagSafe Case com Cancelamento Ativo', price: 1690, color: 'WHITE', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods 4 com ANC', description: 'Cancelamento Ativo de Ruído e Áudio Espacial', price: 1390, color: 'WHITE', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods Max', description: 'USB-C - Midnight', price: 4790, color: 'MIDNIGHT', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods Max', description: 'USB-C - Starlight', price: 4790, color: 'STARLIGHT', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },

      // Acessórios
      { name: 'Carregador MagSafe 25W', description: 'Cabo de 1 metro original lacrado', price: 390, color: 'WHITE', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false },
      { name: 'Adaptador de Energia 35W Duo', description: 'Duas portas USB-C compactas', price: 340, color: 'WHITE', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false },
      { name: 'Cabo USB-C Trançado 240W', description: 'Cabo de carga de 2 metros', price: 220, color: 'WHITE', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false }
    ];
  }
};
