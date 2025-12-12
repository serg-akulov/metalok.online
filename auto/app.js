const app = {
    // === ДАННЫЕ ===
    data: {
        cars: [],
        currentCar: null,
        settings: {},
        // ФЛАГ PRO ВЕРСИИ
        // В реальном приложении при старте ты будешь проверять покупку через Android Interface
        isPro: false 
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

    // === ИНИЦИАЛИЗАЦИЯ ===
    init() {
        this.loadData();
        this.renderGarage();
        this.renderSettingsInputs();
        this.updateProVisuals(); // Обновить вид иконок (замки)
        
        const svgContainer = document.getElementById('car-svg');
        svgContainer.addEventListener('click', (e) => {
            let target = e.target;
            if(target.tagName === 'text') return;
            if(target.tagName === 'svg' || target.id === 'car-svg') return;

            const partId = target.id;
            const partName = target.getAttribute('data-name');
            const partType = target.getAttribute('data-type');
            
            if (partId && partName) {
                // ПРОВЕРКА PRO ДЛЯ УЗЛОВ
                // Если это механика (mech) и у нас НЕ Pro версия
                if (partType === 'mech' && !this.data.isPro) {
                    this.showPaywall();
                    return; // Прерываем выполнение
                }

                this.openSheet(partId, partName, partType);
            }
        });
    },

    // === УПРАВЛЕНИЕ ДАННЫМИ ===
    loadData() {
        const storedGarage = localStorage.getItem('autoRevizor_garage');
        if (storedGarage) this.data.cars = JSON.parse(storedGarage);

        const storedSettings = localStorage.getItem('autoRevizor_settings');
        if (storedSettings) this.data.settings = JSON.parse(storedSettings);
        else this.data.settings = JSON.parse(JSON.stringify(this.defaultPrices));

        // Проверка статуса PRO (симуляция сохранения)
        const proStatus = localStorage.getItem('autoRevizor_isPro');
        if (proStatus === 'true') this.data.isPro = true;
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

    // === ГАРАЖ ===
    renderGarage() {
        const listEl = document.getElementById('garage-list');
        listEl.innerHTML = '';

        if (this.data.cars.length === 0) {
            listEl.innerHTML = '<div class="empty-state">Гараж пуст.<br>Нажмите +, чтобы добавить авто.</div>';
            return;
        }

        const sortedCars = [...this.data.cars].sort((a,b) => b.id - a.id);

        sortedCars.forEach(car => {
            const repairs = this.calculateRepairs(car.defects);
            // Добавляем класс .locked, если пользователь превысил лимит (на случай если он перестал быть PRO)
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div onclick="app.editCar(${car.id})">
                    <h3>${car.name || 'Без названия'}</h3>
                    <p>Цена: ${parseInt(car.price || 0).toLocaleString()} ₽</p>
                </div>
                <div class="badge">-${repairs.toLocaleString()} ₽</div>
                <button onclick="app.deleteCar(${car.id}, event)" style="background:none; border:none; color:#555; margin-left:10px; font-size:1.2rem;">×</button>
            `;
            listEl.appendChild(card);
        });
    },

    // Добавил функцию удаления (полезно для тестов)
    deleteCar(id, event) {
        event.stopPropagation(); // Чтобы не открылась карточка
        if(confirm('Удалить эту машину?')) {
            this.data.cars = this.data.cars.filter(c => c.id !== id);
            this.saveData();
            this.renderGarage();
        }
    },

    createNewCar() {
        // ПРОВЕРКА ЛИМИТА ГАРАЖА
        // Если не ПРО и машин уже 1 или больше
        if (!this.data.isPro && this.data.cars.length >= 1) {
            this.showPaywall();
            return;
        }

        this.data.currentCar = {
            id: Date.now(),
            name: '',
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
        document.getElementById('car-price').value = this.data.currentCar.price;
        this.updateSvgColors();
        this.updateSummary();
        this.showEditor();
    },

    saveCurrentCar() {
        if (!this.data.currentCar) return;
        this.data.currentCar.name = document.getElementById('car-name').value;
        this.data.currentCar.price = document.getElementById('car-price').value;

        const exists = this.data.cars.find(c => c.id === this.data.currentCar.id);
        if (!exists) {
            this.data.cars.push(this.data.currentCar);
        }

        this.saveData();
        this.renderGarage();
        this.showGarage();
    },

    // === РЕДАКТОР И SVG ===
    resetEditor() {
        document.getElementById('car-name').value = '';
        document.getElementById('car-price').value = '';
        document.querySelectorAll('.car-part, .mech-part').forEach(el => {
            el.removeAttribute('data-status');
        });
        document.getElementById('total-repair-cost').innerText = '0 ₽';
        document.getElementById('recommended-price').innerText = '0 ₽';
        this.updateProVisuals();
    },

    // Обновляем визуальный вид иконок (замочки если не ПРО)
    updateProVisuals() {
        const mechParts = document.querySelectorAll('.mech-part');
        mechParts.forEach(el => {
            if (!this.data.isPro) {
                el.classList.add('locked');
            } else {
                el.classList.remove('locked');
            }
        });
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

    // === UI ЛОГИКА ===
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
            
            btn.onclick = () => {
                this.setDefect(partId, type);
            };
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

    // === PAYWALL И ПОКУПКА ===
    showPaywall() {
        document.getElementById('paywall').classList.add('active');
    },
    closePaywall() {
        document.getElementById('paywall').classList.remove('active');
    },
    buyPro() {
        // ЭМУЛЯЦИЯ ПОКУПКИ
        // В WebView здесь будет вызов Android Interface
        if(confirm('Эмуляция: Купить PRO версию?')) {
            this.data.isPro = true;
            localStorage.setItem('autoRevizor_isPro', 'true');
            this.closePaywall();
            this.updateProVisuals(); // Разблокируем иконки
            alert('Спасибо за покупку! Теперь вам доступен безлимит и механика.');
        }
    },

    // Навигация
    showGarage() {
        this.switchView('view-garage');
        this.renderGarage();
    },
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