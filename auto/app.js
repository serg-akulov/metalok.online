const app = {
    data: {
        cars: [],
        currentCar: null,
        settings: {},
        isPro: CONFIG.isProVersion,
        selectedCars: new Set() // Храним ID выбранных для сравнения машин
    },

    defaultPrices: {
        'scratch': { label: 'Царапина', cost: 5000, icon: '⚡' },
        'dent': { label: 'Вмятина', cost: 10000, icon: '🔨' },
        'repaint': { label: 'Окрас/Ржавчина', cost: 8000, icon: '🎨' },
        'light': { label: 'Мелкий ремонт', cost: 15000, icon: '⚠️' },
        'heavy': { label: 'Капремонт/Замена', cost: 50000, icon: '🛑' },
        'fatal': { label: 'Критично', cost: 100000, icon: '☠️' }
    },

    optionsBody: ['ok', 'scratch', 'dent', 'repaint'],
    optionsMech: ['ok', 'light', 'heavy', 'fatal'],

    init() {
        this.loadData();
        this.renderGarage();
        this.renderSettingsInputs();
        this.updateProVisuals();
        
        const svgContainer = document.getElementById('car-svg');
        if (svgContainer) {
            svgContainer.addEventListener('click', (e) => this.handleSvgClick(e));
        }
    },

    loadData() {
        const storedGarage = localStorage.getItem('autoRevizor_garage');
        if (storedGarage) this.data.cars = JSON.parse(storedGarage);

        const storedSettings = localStorage.getItem('autoRevizor_settings');
        if (storedSettings) this.data.settings = JSON.parse(storedSettings);
        else this.data.settings = JSON.parse(JSON.stringify(this.defaultPrices));
    },

    saveData() {
        localStorage.setItem('autoRevizor_garage', JSON.stringify(this.data.cars));
    },

    saveSettings() {
        for (let key in this.data.settings) {
            const input = document.getElementById(`price-${key}`);
            if (input) this.data.settings[key].cost = parseInt(input.value) || 0;
        }
        localStorage.setItem('autoRevizor_settings', JSON.stringify(this.data.settings));
        alert('Прайс сохранен!');
        this.showGarage();
    },

    // --- GARAGE LOGIC ---
    renderGarage() {
        const listEl = document.getElementById('garage-list');
        const compareBtn = document.getElementById('compare-btn');
        listEl.innerHTML = '';

        if (this.data.cars.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Гараж пуст.<br>Нажмите +, чтобы добавить авто.</div>';
            compareBtn.style.display = 'none';
            return;
        }

        // Показываем кнопку сравнения, если выбрано >= 2
        compareBtn.style.display = this.data.selectedCars.size >= 2 ? 'block' : 'none';
        compareBtn.innerText = `Сравнить (${this.data.selectedCars.size})`;

        // Сортировка: новые сверху
        const sortedCars = [...this.data.cars].sort((a,b) => b.id - a.id);

        sortedCars.forEach(car => {
            const repairs = this.calculateRepairs(car.defects);
            const isSelected = this.data.selectedCars.has(car.id);
            
            const card = document.createElement('div');
            card.className = 'car-card';
            
            // HTML Карточки
            card.innerHTML = `
                <div class="car-select ${isSelected ? 'selected' : ''}" onclick="app.toggleSelection(${car.id}, event)"></div>
                <div class="car-info" onclick="app.editCar(${car.id})">
                    <h3>${car.name || 'Без названия'}</h3>
                    <span class="vin-tag">${car.vin || 'VIN не указан'}</span>
                    <p>Цена: ${parseInt(car.price || 0).toLocaleString()} ₽</p>
                </div>
                <div class="badge">-${repairs.toLocaleString()}</div>
                <button class="delete-btn" onclick="app.deleteCar(${car.id}, event)">×</button>
            `;
            listEl.appendChild(card);
        });
    },

    // Выбор чекбокса
    toggleSelection(id, event) {
        event.stopPropagation();
        if (this.data.selectedCars.has(id)) {
            this.data.selectedCars.delete(id);
        } else {
            this.data.selectedCars.add(id);
        }
        this.renderGarage();
    },

    startComparison() {
        if (this.data.selectedCars.size < 2) return;
        
        const container = document.getElementById('compare-content');
        container.innerHTML = '';
        
        // Получаем объекты выбранных машин
        const carsToCompare = this.data.cars.filter(c => this.data.selectedCars.has(c.id));
        
        // Ищем лучшее предложение (минимальная итоговая цена)
        let bestPrice = Infinity;
        let bestCarId = null;
        
        carsToCompare.forEach(car => {
            const repairs = this.calculateRepairs(car.defects);
            const sellerPrice = parseInt(car.price) || 0;
            const final = sellerPrice - repairs > 0 ? sellerPrice - repairs : 0; // На самом деле нам важна рекомендация или просто выгодность. 
            // Обычно сравнивают "Цену покупки". Но здесь логика:
            // "Итоговая цена" (рекомендация) - это за сколько мы хотим купить.
            // Но выгодность для покупателя - это (Цена Продавца - Скидка) + Ремонт?
            // Давай упростим: Лучшее предложение = Минимальная цена продавца (если ремонты одинаковы) или Лучшее соотношение.
            // Давай подсветим ту, где "Рекомендованная цена" МИНИМАЛЬНА (т.е. мы собьем цену ниже всего).
            
            if (final < bestPrice && final > 0) {
                bestPrice = final;
                bestCarId = car.id;
            }
        });

        carsToCompare.forEach(car => {
            const repairs = this.calculateRepairs(car.defects);
            const sellerPrice = parseInt(car.price) || 0;
            const final = sellerPrice - repairs > 0 ? sellerPrice - repairs : 0;
            const defectsCount = Object.keys(car.defects).length;
            
            const isBest = car.id === bestCarId;
            
            const col = document.createElement('div');
            col.className = `compare-column ${isBest ? 'best' : ''}`;
            
            col.innerHTML = `
                ${isBest ? '<div class="best-badge">TOP ЦЕНА</div>' : ''}
                <div class="c-header">
                    <span class="c-name">${car.name || 'Без названия'}</span>
                    <span class="c-vin">${car.vin || '---'}</span>
                </div>
                
                <div class="c-row">
                    <span class="c-label">Продавец:</span>
                    <span class="c-val">${sellerPrice.toLocaleString()} ₽</span>
                </div>
                 <div class="c-row">
                    <span class="c-label">Вложения:</span>
                    <span class="c-val red">-${repairs.toLocaleString()} ₽</span>
                </div>
                 <div class="c-row">
                    <span class="c-label">Дефектов:</span>
                    <span class="c-val">${defectsCount} шт.</span>
                </div>
                
                <div style="margin-top:auto; padding-top:10px; border-top:1px dashed #333">
                    <div class="c-label">Рекомендуем предложить:</div>
                    <div class="c-val green">${final.toLocaleString()} ₽</div>
                </div>
            `;
            container.appendChild(col);
        });
        
        this.switchView('view-compare');
    },

    deleteCar(id, event) {
        event.stopPropagation();
        if(confirm('Удалить эту машину?')) {
            this.data.cars = this.data.cars.filter(c => c.id !== id);
            this.data.selectedCars.delete(id); // Удаляем из выбранных
            this.saveData();
            this.renderGarage();
        }
    },

    createNewCar() {
        if (!this.data.isPro && this.data.cars.length >= 1) {
            this.showPaywall();
            return;
        }

        this.data.currentCar = {
            id: Date.now(),
            name: '',
            vin: '', // Добавили VIN
            price: '',
            defects: {}
        };
        this.resetEditor();
        this.showEditor();
    },

    editCar(id) {
        this.data.currentCar = this.data.cars.find(c => c.id === id);
        this.resetEditor();
        document.getElementById('car-name').value = this.data.currentCar.name;
        document.getElementById('car-vin').value = this.data.currentCar.vin || ''; // Загрузка VIN
        document.getElementById('car-price').value = this.data.currentCar.price;
        this.updateSvgColors();
        this.updateSummary();
        this.showEditor();
    },

    saveCurrentCar() {
        if (!this.data.currentCar) return;
        this.data.currentCar.name = document.getElementById('car-name').value;
        this.data.currentCar.vin = document.getElementById('car-vin').value.toUpperCase(); // Сохраняем VIN
        this.data.currentCar.price = document.getElementById('car-price').value;

        const exists = this.data.cars.find(c => c.id === this.data.currentCar.id);
        if (!exists) {
            this.data.cars.push(this.data.currentCar);
        }

        this.saveData();
        this.renderGarage();
        this.showGarage();
    },

    // --- EDITOR LOGIC ---
    resetEditor() {
        document.getElementById('car-name').value = '';
        document.getElementById('car-vin').value = '';
        document.getElementById('car-price').value = '';
        document.querySelectorAll('[data-status]').forEach(el => el.removeAttribute('data-status'));
        document.getElementById('total-repair-cost').innerText = '0 ₽';
        document.getElementById('recommended-price').innerText = '0 ₽';
        this.updateProVisuals();
    },

    updateProVisuals() {
        const mechParts = document.querySelectorAll('.mech-part');
        mechParts.forEach(el => {
            if (!this.data.isPro) el.classList.add('locked');
            else el.classList.remove('locked');
        });
    },

    handleSvgClick(e) {
        let target = e.target;
        if(target.tagName === 'text') return; 
        if(target.tagName === 'svg' || target.id === 'car-svg') return;

        const partId = target.id;
        const partName = target.getAttribute('data-name');
        const partType = target.getAttribute('data-type');
        
        if (partId && partName) {
            if (partType === 'mech' && !this.data.isPro) {
                this.showPaywall();
                return;
            }
            this.openSheet(partId, partName, partType);
        }
    },

    updateSvgColors() {
        const defects = this.data.currentCar.defects;
        for (let partId in defects) {
            const el = document.getElementById(partId);
            if (el) el.setAttribute('data-status', defects[partId]);
        }
    },

    calculateRepairs(defects) {
        let total = 0;
        for (let partId in defects) {
            const type = defects[partId];
            if (type !== 'ok' && this.data.settings[type]) {
                total += this.data.settings[type].cost;
            }
        }
        return total;
    },

    updateSummary() {
        const totalCost = this.calculateRepairs(this.data.currentCar.defects);
        const sellerPrice = parseInt(document.getElementById('car-price').value) || 0;
        
        document.getElementById('total-repair-cost').innerText = totalCost.toLocaleString() + ' ₽';
        let recPrice = sellerPrice - totalCost;
        if (recPrice < 0) recPrice = 0;
        document.getElementById('recommended-price').innerText = recPrice.toLocaleString() + ' ₽';
    },

    // --- UI HELPERS ---
    openSheet(partId, partName, partType) {
        document.getElementById('sheet-title').innerText = partName;
        const grid = document.getElementById('defect-options');
        grid.innerHTML = ''; 

        const options = partType === 'mech' ? this.optionsMech : this.optionsBody;

        options.forEach(type => {
            let label = 'Целая';
            let icon = '✅';
            let cost = 0;
            let cssClass = 'success';

            if (type !== 'ok') {
                const conf = this.data.settings[type];
                label = conf.label;
                icon = conf.icon;
                cost = conf.cost;
                cssClass = (type === 'scratch' || type === 'light') ? 'warning' : 'danger';
                if(type === 'repaint' || type === 'fatal') cssClass = 'info';
            }

            const btn = document.createElement('button');
            btn.className = `defect-btn ${cssClass}`;
            btn.style.borderColor = (type !== 'ok') ? '' : '#22c55e';
            btn.innerHTML = `<span>${icon}</span>${label}<br><small>${type === 'ok' ? '' : cost + ' ₽'}</small>`;
            
            btn.onclick = () => this.setDefect(partId, type);
            grid.appendChild(btn);
        });

        document.getElementById('sheet-overlay').classList.add('active');
        document.getElementById('sheet').classList.add('active');
    },

    closeSheet() {
        document.getElementById('sheet-overlay').classList.remove('active');
        document.getElementById('sheet').classList.remove('active');
    },

    setDefect(partId, type) {
        if (type === 'ok') delete this.data.currentCar.defects[partId];
        else this.data.currentCar.defects[partId] = type;
        
        this.updateSvgColors();
        this.updateSummary();
        this.closeSheet();
    },

    renderSettingsInputs() {
        const list = document.getElementById('price-settings-list');
        list.innerHTML = '';
        for (let key in this.data.settings) {
            const item = this.data.settings[key];
            const div = document.createElement('div');
            div.className = 'setting-item';
            div.innerHTML = `
                <label>${item.icon} ${item.label}</label>
                <input type="number" id="price-${key}" value="${item.cost}">
            `;
            list.appendChild(div);
        }
    },

    // --- PAYWALL / NAVIGATION ---
    showPaywall() {
        document.getElementById('paywall-overlay').classList.add('active');
        document.getElementById('paywall-card').classList.add('active');
    },
    closePaywall() {
        document.getElementById('paywall-overlay').classList.remove('active');
        document.getElementById('paywall-card').classList.remove('active');
    },
    openProLink() {
        window.open(CONFIG.proAppUrl, '_blank');
        this.closePaywall();
    },

    showGarage() { this.switchView('view-garage'); this.renderGarage(); },
    showEditor() { this.switchView('view-editor'); },
    showSettings() { this.switchView('view-settings'); },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
    document.getElementById('car-price').addEventListener('input', () => app.updateSummary());
});