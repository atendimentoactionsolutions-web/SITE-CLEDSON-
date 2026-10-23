/**
 * iFindz API Client
 * Integração AO VIVO com https://srv2058756.hstgr.cloud/api/products
 * Categorização e preços principais em tempo real
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
  // Busca produtos da vitrine AO VIVO do site principal
  async getVitrineProducts() {
    try {
      console.log('iFindz API: Puxando produtos AO VIVO de https://srv2058756.hstgr.cloud...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(API_CONFIG.VITRINE_URL, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        console.log('iFindz API: Dados recebidos com sucesso. Total:', json.total || (json.data && json.data.length));
        return this.normalizeProducts(json);
      }
      throw new Error(`Vitrine retornou status ${response.status}`);
    } catch (err) {
      console.warn('iFindz API: Tentando fallback...', err.message);
      return await this.getFallbackProducts();
    }
  },

  async getFallbackProducts() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(API_CONFIG.PRODUCTS_FALLBACK_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const json = await response.json();
        const rawProducts = json.data || json.products || (Array.isArray(json) ? json : []);
        if (rawProducts.length > 0) {
          return this.normalizeProducts(rawProducts);
        }
      }
    } catch (e) {
      console.error('Fallback também falhou:', e);
    }
    return this.normalizeProducts(this.getMockProducts());
  },

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
      console.warn('Usando taxas padrão:', e);
    }
    return API_CONFIG.DEFAULT_RATES;
  },

  // Normalização e categorização precisa de todos os produtos ao vivo
  normalizeProducts(products) {
    if (!Array.isArray(products)) {
      if (products && products.data && Array.isArray(products.data)) products = products.data;
      else if (products && products.products && Array.isArray(products.products)) products = products.products;
      else products = [];
    }

    return products.map(p => {
      const rawCat = (p.category || p.categoria || '').toUpperCase().trim();
      const rawName = (p.name || p.nome || p.title || 'Produto Apple').toUpperCase().trim();
      const isSemi = p.isSeminovo === true || rawCat === 'SEMI' || rawName.includes('SEMINOVO') || p.condition === 'SEMINOVO';

      let deviceKey = 'accessories';
      let category = 'Acessórios';
      let categoryKey = 'accessories';

      if (isSemi) {
        if (rawName.includes('MAC') || rawCat === 'MCB') {
          deviceKey = 'mac';
          category = 'MacBooks';
          categoryKey = 'mac';
        } else if (rawName.includes('IPAD') || rawCat === 'IPAD') {
          deviceKey = 'ipad';
          category = 'iPads';
          categoryKey = 'ipad';
        } else if (rawName.includes('WATCH') || rawCat === 'RLG') {
          deviceKey = 'watch';
          category = 'Apple Watch';
          categoryKey = 'watch';
        } else {
          deviceKey = 'iphone';
          category = 'iPhones Seminovos';
          categoryKey = 'iphones-seminovos';
        }
      } else if (rawCat === 'IPH' || rawName.includes('IPHONE')) {
        deviceKey = 'iphone';
        category = 'iPhones Novos';
        categoryKey = 'iphones-novos';
      } else if (rawCat === 'MCB' || rawCat === 'IMAC' || rawName.includes('MACBOOK') || rawName.includes('MAC MINI') || rawName.includes('MAC STUDIO') || rawName.includes('IMAC')) {
        deviceKey = 'mac';
        category = 'MacBooks';
        categoryKey = 'mac';
      } else if (rawCat === 'IPAD' || rawName.includes('IPAD')) {
        deviceKey = 'ipad';
        category = 'iPads';
        categoryKey = 'ipad';
      } else if (rawCat === 'RLG' || rawName.includes('WATCH') || rawName.includes('ULTRA')) {
        deviceKey = 'watch';
        category = 'Apple Watch';
        categoryKey = 'watch';
      } else if (rawCat === 'PODS' || rawName.includes('AIRPOD')) {
        deviceKey = 'airpods';
        category = 'AirPods';
        categoryKey = 'airpods';
      } else if (rawCat === 'ACSS' || rawName.includes('PENCIL') || rawName.includes('AIRTAG') || rawName.includes('CABO') || rawName.includes('CARREGADOR') || rawName.includes('FONTE') || rawName.includes('ADAPTADOR')) {
        deviceKey = 'accessories';
        category = 'Acessórios';
        categoryKey = 'accessories';
      } else {
        if (rawName.includes('IPHONE') || /\b1[1-9]\b/.test(rawName)) {
          deviceKey = 'iphone';
          category = isSemi ? 'iPhones Seminovos' : 'iPhones Novos';
          categoryKey = isSemi ? 'iphones-seminovos' : 'iphones-novos';
        } else {
          deviceKey = 'accessories';
          category = 'Acessórios';
          categoryKey = 'accessories';
        }
      }

      const price = Number(p.price || p.preco || p.valor || 0);

      let color = (p.color || '').trim();
      if (!color || color === '-' || color === 'PADRÃO' || color === 'PADRAO') {
        if (deviceKey === 'airpods' || deviceKey === 'accessories') {
          color = 'BRANCO';
        } else if (deviceKey === 'mac') {
          color = 'PADRÃO';
        }
      }

      return {
        id: p.id || Math.random().toString(36).substr(2, 9),
        name: p.name || 'Produto Apple',
        description: p.description || p.descricao || '',
        price: price,
        category: category,
        deviceKey: deviceKey,
        categoryKey: categoryKey,
        storage: (p.storage || '').trim(),
        color: color,
        region: p.region || 'ANATEL / Global',
        condition: isSemi ? 'SEMINOVO' : 'NOVO',
        isSeminovo: isSemi,
        badge: isSemi ? 'GARANTIA iFindz' : (p.condition === 'NOVO' ? 'NOVO' : 'LANÇAMENTO')
      };
    });
  },

  getMockProducts() {
    return [
      // iPhones Novos - Linha 16
      { name: 'iPhone 16 Pro Max', description: '256GB - Titânio Preto', price: 8490, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro Max', description: '256GB - Titânio Natural', price: 8490, color: 'NATURAL', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro Max', description: '256GB - Titânio Branco', price: 8490, color: 'WHITE', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro Max', description: '256GB - Titânio Deserto', price: 8590, color: 'DESERT', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro Max', description: '512GB - Titânio Preto', price: 9990, color: 'BLACK', storage: '512GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro Max', description: '512GB - Titânio Deserto', price: 9990, color: 'DESERT', storage: '512GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro Max', description: '1TB - Titânio Deserto', price: 11490, color: 'DESERT', storage: '1TB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      { name: 'iPhone 16 Pro', description: '128GB - Titânio Preto', price: 7290, color: 'BLACK', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro', description: '128GB - Titânio Natural', price: 7290, color: 'NATURAL', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro', description: '128GB - Titânio Deserto', price: 7390, color: 'DESERT', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro', description: '256GB - Titânio Preto', price: 7990, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Pro', description: '256GB - Titânio Deserto', price: 8090, color: 'DESERT', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      { name: 'iPhone 16 Plus', description: '128GB - Preto', price: 6190, color: 'BLACK', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Plus', description: '128GB - Branco', price: 6190, color: 'WHITE', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16 Plus', description: '128GB - Rosa', price: 6250, color: 'PINK', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      { name: 'iPhone 16', description: '128GB - Preto', price: 5490, color: 'BLACK', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16', description: '128GB - Branco', price: 5490, color: 'WHITE', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16', description: '128GB - Azul Ultramarino', price: 5550, color: 'ULTRAMARINE', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 16', description: '256GB - Preto', price: 6190, color: 'BLACK', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      // iPhones Novos - Linha 15
      { name: 'iPhone 15 Pro Max', description: '256GB - Titânio Natural', price: 6890, color: 'NATURAL', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 15 Pro Max', description: '256GB - Titânio Azul', price: 6790, color: 'BLUE', storage: '256GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 15 Pro', description: '128GB - Titânio Natural', price: 5990, color: 'NATURAL', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 15', description: '128GB - Preto', price: 4490, color: 'BLACK', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 15', description: '128GB - Azul', price: 4490, color: 'BLUE', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 15', description: '128GB - Rosa', price: 4550, color: 'PINK', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      // iPhones Novos - Linha 14 e 13
      { name: 'iPhone 14', description: '128GB - Meia-noite', price: 3890, color: 'MIDNIGHT', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 14', description: '128GB - Estelar', price: 3890, color: 'STARLIGHT', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 13', description: '128GB - Meia-noite', price: 3390, color: 'MIDNIGHT', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },
      { name: 'iPhone 13', description: '128GB - Estelar', price: 3390, color: 'STARLIGHT', storage: '128GB', categoryKey: 'iphones-novos', deviceKey: 'iphone', condition: 'NOVO', isSeminovo: false },

      // iPhones Seminovos (Garantia iFindz)
      { name: 'iPhone 15 Pro Max', description: '256GB - Titânio Natural - SEMINOVO', price: 5890, color: 'NATURAL', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 15 Pro Max', description: '256GB - Titânio Azul - SEMINOVO', price: 5790, color: 'BLUE', storage: '256GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 15 Pro', description: '128GB - Titânio Preto - SEMINOVO', price: 5190, color: 'BLACK', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 15', description: '128GB - Preto - SEMINOVO', price: 3890, color: 'BLACK', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 14 Pro Max', description: '128GB - Roxo Profundo - SEMINOVO', price: 4790, color: 'PURPLE', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 14 Pro Max', description: '128GB - Preto Espacial - SEMINOVO', price: 4790, color: 'SPACE BLACK', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 14 Pro', description: '128GB - Dourado - SEMINOVO', price: 4190, color: 'GOLD', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 14', description: '128GB - Azul - SEMINOVO', price: 3290, color: 'BLUE', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },
      { name: 'iPhone 13', description: '128GB - Meia-noite - SEMINOVO', price: 2790, color: 'MIDNIGHT', storage: '128GB', categoryKey: 'iphones-seminovos', deviceKey: 'iphone', condition: 'SEMINOVO', isSeminovo: true },

      // MacBooks
      { name: 'MacBook Air 13" M3', description: '256GB SSD - 8GB RAM - Meia-noite', price: 7990, color: 'MIDNIGHT', storage: '256GB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Air 13" M3', description: '256GB SSD - 8GB RAM - Estelar', price: 7990, color: 'STARLIGHT', storage: '256GB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Air 13" M2', description: '256GB SSD - 8GB RAM - Cinza Espacial', price: 6890, color: 'SPACE GRAY', storage: '256GB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro 14" M3 Pro', description: '512GB SSD - 18GB RAM - Preto Espacial', price: 14990, color: 'SPACE BLACK', storage: '512GB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },
      { name: 'MacBook Pro 16" M3 Pro', description: '512GB SSD - 18GB RAM - Prateado', price: 17490, color: 'SILVER', storage: '512GB', categoryKey: 'mac', deviceKey: 'mac', condition: 'NOVO', isSeminovo: false },

      // iPads
      { name: 'iPad Pro 11" M4', description: '256GB Wi-Fi - Preto Espacial', price: 7990, color: 'SPACE BLACK', storage: '256GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad Pro 11" M4', description: '256GB Wi-Fi - Prateado', price: 7990, color: 'SILVER', storage: '256GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad Air 11" M2', description: '128GB Wi-Fi - Cinza Espacial', price: 4990, color: 'SPACE GRAY', storage: '128GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad Air 11" M2', description: '128GB Wi-Fi - Estelar', price: 4990, color: 'STARLIGHT', storage: '128GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad 10ª Geração 10.9"', description: '64GB Wi-Fi - Azul', price: 2990, color: 'BLUE', storage: '64GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },
      { name: 'iPad 10ª Geração 10.9"', description: '64GB Wi-Fi - Prateado', price: 2990, color: 'SILVER', storage: '64GB', categoryKey: 'ipad', deviceKey: 'ipad', condition: 'NOVO', isSeminovo: false },

      // Apple Watch
      { name: 'Apple Watch Ultra 2', description: '49mm Titânio Natural - Pulseira Oceano Azul', price: 5690, color: 'NATURAL', storage: '49MM', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch Ultra 2', description: '49mm Titânio Preto - Pulseira Loop Trail', price: 5890, color: 'BLACK', storage: '49MM', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch Series 10', description: '46mm Alumínio - Preto Brilhante (Jet Black)', price: 3690, color: 'BLACK', storage: '46MM', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch Series 10', description: '42mm Alumínio - Ouro Rosa', price: 3390, color: 'ROSE', storage: '42MM', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },
      { name: 'Apple Watch SE 2', description: '40mm Alumínio - Meia-noite', price: 1990, color: 'MIDNIGHT', storage: '40MM', categoryKey: 'watch', deviceKey: 'watch', condition: 'NOVO', isSeminovo: false },

      // AirPods
      { name: 'AirPods Pro 2', description: 'Estojo MagSafe USB-C com Cancelamento Ativo', price: 1690, color: 'BRANCO', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods 4 com ANC', description: 'Cancelamento Ativo de Ruído e Áudio Espacial', price: 1450, color: 'BRANCO', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods 4', description: 'Áudio Espacial Personalizado', price: 1190, color: 'BRANCO', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods Max', description: 'USB-C - Meia-noite', price: 4790, color: 'MIDNIGHT', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },
      { name: 'AirPods Max', description: 'USB-C - Estelar', price: 4790, color: 'STARLIGHT', storage: '', categoryKey: 'airpods', deviceKey: 'airpods', condition: 'NOVO', isSeminovo: false },

      // Acessórios
      { name: 'Carregador MagSafe 25W', description: 'Cabo de 1m original lacrado Apple', price: 390, color: 'BRANCO', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false },
      { name: 'Adaptador de Energia 35W Duo', description: 'Duas portas USB-C compactas', price: 340, color: 'BRANCO', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false },
      { name: 'Adaptador de Energia 20W USB-C', description: 'Carregador rápido original Apple', price: 190, color: 'BRANCO', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false },
      { name: 'Cabo USB-C Trançado 60W', description: 'Cabo de carga de 1 metro', price: 170, color: 'BRANCO', storage: '', categoryKey: 'accessories', deviceKey: 'accessories', condition: 'NOVO', isSeminovo: false }
    ];
  }
};
