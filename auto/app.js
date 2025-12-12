const app = {
    // === ДАННЫЕ ===
    data: {
        cars: [],
        currentCar: null, // Объект редактируемого авто
        settings: {}      // Прайс-лист
    },

    // Прайс по умолчанию (если пользователь не менял)
    defaultPrices: {
        'scratch': { label: 'Царапина', cost: 5000, icon: '⚡' },
        'dent': { label: 'Вмятина', cost: 10000, icon: '🔨' },
        'repaint': { label: 'Окрас/Ржавчина', cost: 8000, icon: '🎨' },
        'light': { label: 'Мелкий ремонт', cost: 15000, icon: '⚠️' }, // Для механики
        'heavy': { label: 'Капремонт/Замена', cost: 50000, icon: '🛑' }, // Для механики
        'fatal': { label: 'Критично', cost: 100000, icon: '☠️' }
    },

    // Опции для Кузова и Механики
    optionsBody: ['ok', 'scratch', 'dent', 'repaint'],
    optionsMech: ['ok', 'light', 'heavy', 'fatal'],

    // === ИНИЦИАЛИЗАЦИЯ ===
    init() {
        this.loadData();
        this.renderGarage();
        this.renderSettingsInputs();
        
        // Слушаем клики по SVG деталям
        const svgContainer = document.getElementById('car-svg');
        svgContainer.addEventListener('click', (e) => {
            // Ищем ближайший элемент с классом car-part или mech-part
            let target = e.target;
            if(target.tagName === 'text') return; // Игнор текста
            
            // Если кликнули в svg, но не в деталь
            if(target.tagName === 'svg' || target.id === 'car-svg') return;

            // Обработка клика
            const partId = target.id;
            const partName = target.getAttribute('data-name');
            const partType = target.getAttribute('data-type'); // body или mech
            
            if (partId && partName) {
                this.openSheet(partId, partName, partType);
            }
        });
    },

    // === УПРАВЛЕНИЕ ДАННЫМИ ===
    loadData() {
        // Загрузка Гаража
        const storedGarage = localStorage.getItem('autoRevizor_garage');
        if (storedGarage) this.data.cars = JSON.parse(storedGarage);

        // Загрузка Прайса (или дефолт)
        const storedSettings = localStorage.getItem('autoRevizor_settings');
        if (storedSettings) {
            this.data.settings = JSON.parse(storedSettings);
        } else {
            this.data.settings = JSON.parse(JSON.stringify(this.defaultPrices));
        }
    },

    saveData() {
        localStorage.setItem('autoRevizor_garage', JSON.stringify(this.data.cars));
    },

    saveSettings() {
        // Собираем данные из инпутов
        for (let key in this.data.settings) {
            const input = document.getElementById(`price-${key}`);
            if (input) {
                this.data.settings[key].cost = parseInt(input.value) || 0;
            }
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

        // Сортировка: новые сверху
        const sortedCars = [...this.data.cars].sort((a,b) => b.id - a.id);

        sortedCars.forEach(car => {
            const repairs = this.calculateRepairs(car.defects);
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div onclick="app.editCar(${car.id})">
                    <h3>${car.name || 'Без названия'}</h3>
                    <p>Цена: ${parseInt(car.price || 0).toLocaleString()} ₽</p>
                </div>
                <div class="badge">-${repairs.toLocaleString()} ₽</div>
            `;
            listEl.appendChild(card);
        });
    },

    createNewCar() {
        this.data.currentCar = {
            id: Date.now(),
            name: '',
            price: '',
            defects: {} // { partId: 'type' }
        };
        this.resetEditor();
        this.showEditor();
    },

    editCar(id) {
        this.data.currentCar = this.data.cars.find(c => c.id === id);
        this.resetEditor();
        // Заполняем поля
        document.getElementById('car-name').value = this.data.currentCar.name;
        document.getElementById('car-price').value = this.data.currentCar.price;
        // Раскрашиваем SVG
        this.updateSvgColors();
        this.updateSummary();
        this.showEditor();
    },

    saveCurrentCar() {
        if (!this.data.currentCar) return;

        // Берем данные из полей
        this.data.currentCar.name = document.getElementById('car-name').value;
        this.data.currentCar.price = document.getElementById('car-price').value;

        // Если это новый авто (его нет в массиве), добавляем
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
        // Сброс цветов SVG
        document.querySelectorAll('.car-part, .mech-part').forEach(el => {
            el.removeAttribute('data-status');
        });
        document.getElementById('total-repair-cost').innerText = '0 ₽';
        document.getElementById('recommended-price').innerText = '0 ₽';
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

    // === UI ЛОГИКА (Шторка, Навигация) ===
    
    openSheet(partId, partName, partType) {
        document.getElementById('sheet-title').innerText = partName;
        const grid = document.getElementById('defect-options');
        grid.innerHTML = ''; // Очистка

        // Генерируем кнопки в зависимости от типа (кузов или механика)
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
                if(type === 'repaint' || type === 'fatal') cssClass = 'info'; // Фиолетовый
            }

            const btn = document.createElement('button');
            btn.className = `defect-btn ${cssClass}`;
            btn.style.borderColor = (type !== 'ok') ? '' : '#22c55e'; // Зеленая рамка для ОК
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
        // Сохраняем в объект
        if (type === 'ok') {
            delete this.data.currentCar.defects[partId];
        } else {
            this.data.currentCar.defects[partId] = type;
        }
        
        // Обновляем вид и цифры
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

    // Навигация
    showGarage() {
        this.switchView('view-garage');
        this.renderGarage(); // Обновить список при возврате
    },
    showEditor() { this.switchView('view-editor'); },
    showSettings() { this.switchView('view-settings'); },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }
};

// Запуск при старте
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    // Live update for calculations when price input changes
    document.getElementById('car-price').addEventListener('input', () => app.updateSummary());
});