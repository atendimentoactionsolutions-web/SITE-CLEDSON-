/**
 * iFindz Installment Simulator
 * Configuração Oficial das Taxas da Maquininha (Fator de Divisão para repasse exato)
 */

const CARD_RATES_OFFICIAL = {
  baseRate: 2.69,
  calculationMode: 'factor',
  table: {
    1:  { parcelRate: 3.05, totalRate: 5.74 },
    2:  { parcelRate: 1.50, totalRate: 4.19 },
    3:  { parcelRate: 2.25, totalRate: 4.94 },
    4:  { parcelRate: 3.00, totalRate: 5.69 },
    5:  { parcelRate: 3.75, totalRate: 6.44 },
    6:  { parcelRate: 4.50, totalRate: 7.19 },
    7:  { parcelRate: 5.25, totalRate: 7.94 },
    8:  { parcelRate: 6.00, totalRate: 8.69 },
    9:  { parcelRate: 6.75, totalRate: 9.44 },
    10: { parcelRate: 7.50, totalRate: 10.19 },
    11: { parcelRate: 8.25, totalRate: 10.94 },
    12: { parcelRate: 9.00, totalRate: 11.69 },
    13: { parcelRate: 9.75, totalRate: 12.44 },
    14: { parcelRate: 10.50, totalRate: 13.19 },
    15: { parcelRate: 11.25, totalRate: 13.94 },
    16: { parcelRate: 12.00, totalRate: 14.69 },
    17: { parcelRate: 12.75, totalRate: 15.44 },
    18: { parcelRate: 13.50, totalRate: 16.19 }
  }
};

const IFINDZ_SIMULATOR = {
  activeProduct: null,
  selectedInstallment: null,
  downPayment: 0,
  storePhone: '5511930089729',

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const downPaymentInput = document.getElementById('downPaymentInput');
    if (downPaymentInput) {
      downPaymentInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        let numVal = Number(val) / 100;
        if (numVal > (this.activeProduct ? this.activeProduct.price : 0)) {
          numVal = this.activeProduct.price;
        }
        this.downPayment = numVal;
        e.target.value = this.formatCurrencyRaw(numVal);
        this.renderTable();
      });
    }

    const confirmWppBtn = document.getElementById('btnConfirmWpp');
    if (confirmWppBtn) {
      confirmWppBtn.addEventListener('click', () => {
        this.sendToWhatsApp();
      });
    }

    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalBackdrop = document.getElementById('simulatorModal');
    if (closeModalBtn && modalBackdrop) {
      closeModalBtn.addEventListener('click', () => this.close());
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.close();
      });
    }
  },

  open(product) {
    this.activeProduct = product;
    this.downPayment = 0;
    this.selectedInstallment = null;

    const modal = document.getElementById('simulatorModal');
    const titleEl = document.getElementById('modalProductTitle');
    const descEl = document.getElementById('modalProductDesc');
    const pricePixEl = document.getElementById('modalProductPix');
    const downPaymentInput = document.getElementById('downPaymentInput');

    if (titleEl) titleEl.textContent = product.name;
    if (descEl) descEl.textContent = product.description;
    if (pricePixEl) {
      pricePixEl.textContent = this.formatCurrency(product.price);
    }
    if (downPaymentInput) downPaymentInput.value = '';

    this.renderTable();
    this.updateButtonState();
    if (modal) modal.classList.add('open');
  },

  close() {
    const modal = document.getElementById('simulatorModal');
    if (modal) modal.classList.remove('open');
    this.activeProduct = null;
    this.selectedInstallment = null;
  },

  /**
   * Cálculo por Fator de Divisão:
   * Total = Financiado / (1 - (TaxaTotal / 100))
   * Parcela = Total / N
   */
  calculateInstallment(financedAmount, installmentsCount) {
    if (financedAmount <= 0) {
      return { installmentValue: 0, totalAmount: 0, totalRate: 0, factor: 1 };
    }

    const rateConfig = CARD_RATES_OFFICIAL.table[installmentsCount] || {
      parcelRate: installmentsCount * 0.75,
      totalRate: 2.69 + (installmentsCount * 0.75)
    };

    const totalRate = rateConfig.totalRate;
    const factor = (100 - totalRate) / 100;
    const totalAmount = financedAmount / factor;
    const installmentValue = totalAmount / installmentsCount;

    return {
      installmentValue: installmentValue,
      totalAmount: totalAmount,
      totalRate: totalRate,
      factor: factor
    };
  },

  renderTable() {
    if (!this.activeProduct) return;
    const tbody = document.getElementById('installmentsTableBody');
    if (!tbody) return;

    const financedAmount = Math.max(0, this.activeProduct.price - this.downPayment);
    tbody.innerHTML = '';
    let hasSelected = false;

    // Tabela de parcelamento exibida a partir de 2x até 18x
    for (let i = 2; i <= 18; i++) {
      const calc = this.calculateInstallment(financedAmount, i);
      const tr = document.createElement('tr');
      if (i === this.selectedInstallment) {
        tr.classList.add('selected');
        hasSelected = true;
      }

      tr.innerHTML = `
        <td class="inst-num"><strong>${i}x</strong> de</td>
        <td class="inst-val">${this.formatCurrency(calc.installmentValue)}</td>
        <td class="inst-check">
          <span class="inst-radio-indicator"></span>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.selectedInstallment = i;
        document.querySelectorAll('#installmentsTableBody tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        this.updateTotalFooter(calc.installmentValue, calc.totalAmount, calc.totalRate);
        this.updateButtonState();
      });

      tbody.appendChild(tr);

      if (i === this.selectedInstallment) {
        this.updateTotalFooter(calc.installmentValue, calc.totalAmount, calc.totalRate);
      }
    }

    if (!hasSelected) {
      const totalDisplay = document.getElementById('modalSelectedPlan');
      if (totalDisplay) {
        totalDisplay.innerHTML = `<span style="color: var(--apple-text-secondary); font-size: 0.82rem;">Selecione o plano de parcelamento acima</span>`;
      }
    }

    this.updateButtonState();
  },

  updateButtonState() {
    const confirmWppBtn = document.getElementById('btnConfirmWpp');
    if (!confirmWppBtn) return;
    if (this.selectedInstallment) {
      confirmWppBtn.disabled = false;
      confirmWppBtn.classList.remove('disabled');
      confirmWppBtn.title = 'Fechar pedido no WhatsApp';
    } else {
      confirmWppBtn.disabled = true;
      confirmWppBtn.classList.add('disabled');
      confirmWppBtn.title = 'Selecione uma opção de parcelamento na tabela acima para continuar';
    }
  },

  updateTotalFooter(monthly, totalFinanced, totalRate) {
    const totalDisplay = document.getElementById('modalSelectedPlan');
    if (totalDisplay) {
      if (this.downPayment > 0) {
        totalDisplay.innerHTML = `Entrada de ${this.formatCurrency(this.downPayment)} + <strong>${this.selectedInstallment}x de ${this.formatCurrency(monthly)}</strong>`;
      } else {
        totalDisplay.innerHTML = `Plano Selecionado: <strong>${this.selectedInstallment}x de ${this.formatCurrency(monthly)}</strong>`;
      }
    }
  },

  sendToWhatsApp() {
    if (!this.activeProduct || !this.selectedInstallment) return;
    const financed = Math.max(0, this.activeProduct.price - this.downPayment);
    const calc = this.calculateInstallment(financed, this.selectedInstallment);

    let plan = '';
    if (this.downPayment > 0) {
      plan = ` Plano: *Entrada de ${this.formatCurrency(this.downPayment)} + ${this.selectedInstallment}x de ${this.formatCurrency(calc.installmentValue)}*`;
    } else {
      plan = ` Plano: *${this.selectedInstallment}x de ${this.formatCurrency(calc.installmentValue)}*`;
    }

    const storageStr = this.activeProduct.storage ? `(${this.activeProduct.storage})` : `(${this.activeProduct.description})`;
    const msg = `Olá! Tenho interesse no produto: *${this.activeProduct.name} ${storageStr}* Cor: *${this.activeProduct.color}* Valor à Vista: *${this.formatCurrency(this.activeProduct.price)}*${plan}. Ainda está disponível?`;

    const wppUrl = `https://wa.me/${this.storePhone}?text=${encodeURIComponent(msg)}`;
    window.open(wppUrl, '_blank');
  },

  formatCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },

  formatCurrencyRaw(val) {
    return Number(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
};
