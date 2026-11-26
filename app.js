// 1. Catálogo Visual de Produtos
        const productCatalog = {
            "06512943780243": {
                name: "Nescau 350g",
                category: "Achocolatado em Pó • Lata",
                badgeColor: "from-red-600 via-red-500 to-amber-700",
                shortBrand: "NESCAU",
                icon: "fa-bolt",
                image: "NESCAU.webp"
            },
            "7891000100103": {
                name: "Leite Moça 395g",
                category: "Leite Condensado • Lata",
                badgeColor: "from-blue-700 via-blue-600 to-sky-500",
                shortBrand: "MOÇA",
                icon: "fa-droplet",
                image: "LEITE MOÇA.webp"
            },
            "7896089011357": {
                name: "Café Pilão 500g",
                category: "Cafeteria • Almofada",
                badgeColor: "from-stone-900 via-red-900 to-amber-800",
                shortBrand: "PILÃO",
                icon: "fa-mug-hot",
                image: "CAFÉ PILÃO.webp"
            },
            "7896004006214": {
                name: "Biscoito Cream Cracker 400g",
                category: "Mercearia • Pacote",
                badgeColor: "from-amber-600 via-orange-500 to-yellow-500",
                shortBrand: "CRACKER",
                icon: "fa-cookie-bite",
                image: "BISCOITO CREAM CRECKER.webp"
            },
            "7896006711112": {
                name: "Arroz Tipo 1 5kg",
                category: "Grãos • Fardo",
                badgeColor: "from-emerald-700 via-teal-600 to-cyan-600",
                shortBrand: "ARROZ",
                icon: "fa-wheat-awn",
                image: "ARROZ TIPO 1.webp"
            }
        };

        // Helper para gerar data atual formatada (YYYY-MM-DD)
        function getTodayStr(offsetDays = 0) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + offsetDays);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // 2. Estado Global Reativo (Pronto para integração externa via window.WMS_STORE e wms:stateChange)
        const storeSubscribers = [];
        const WMS_STORAGE_KEY = 'smartwms_state_v1';

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function getStoredState() {
            try {
                const saved = localStorage.getItem(WMS_STORAGE_KEY);
                if (!saved) return null;
                const state = JSON.parse(saved);
                if (!Array.isArray(state.invoices) ||
                    !Array.isArray(state.conferences) ||
                    !Array.isArray(state.labelQueue)) {
                    console.warn('Estado salvo do WMS tem formato invalido; usando dados iniciais.');
                    return null;
                }
                return state;
            } catch (error) {
                console.warn('Nao foi possivel ler o estado salvo do WMS:', error);
                return null;
            }
        }

        const storedState = getStoredState();
        const lotCounterKey = 'smartwms_lot_counter';
        let lotCounter = 0;
        try {
            lotCounter = parseInt(localStorage.getItem(lotCounterKey), 10) || 0;
        } catch (error) {
            lotCounter = 0;
        }
        if (storedState?.labelQueue?.length) {
            const highestStoredLot = storedState.labelQueue.reduce((highest, label) => {
                const match = /^LT-(\d+)$/i.exec(label.lote || '');
                return match ? Math.max(highest, parseInt(match[1], 10)) : highest;
            }, 0);
            lotCounter = Math.max(lotCounter, highestStoredLot);
        }

        function persistStore() {
            try {
                localStorage.setItem(WMS_STORAGE_KEY, JSON.stringify({
                    invoices: window.WMS_STORE.invoices,
                    conferences: window.WMS_STORE.conferences,
                    labelQueue: window.WMS_STORE.labelQueue
                }));
                localStorage.setItem(lotCounterKey, String(lotCounter));
            } catch (error) {
                console.warn('Nao foi possivel salvar o estado do WMS:', error);
                showToast('Nao foi possivel salvar os dados neste navegador.', 'error');
            }
        }

        window.WMS_STORE = {
            invoices: storedState?.invoices || [
                {
                    id: "NF-45890",
                    supplier: "Nestlé Brasil Ltda",
                    emissionDate: getTodayStr(-1),
                    items: [
                        { barcode: "06512943780243", productName: "Nescau 350g", notaQty: 15, checked: false },
                        { barcode: "7891000100103", productName: "Leite Moça 395g", notaQty: 24, checked: false }
                    ]
                },
                {
                    id: "NF-45902",
                    supplier: "JDE Cafés do Brasil",
                    emissionDate: getTodayStr(0),
                    items: [
                        { barcode: "7896089011357", productName: "Café Pilão 500g", notaQty: 30, checked: false }
                    ]
                }
            ],
            conferences: storedState?.conferences || [],
            labelQueue: storedState?.labelQueue || [],
            subscribe(fn) {
                if (typeof fn === 'function') storeSubscribers.push(fn);
            },
            notify() {
                persistStore();
                updateBadges();
                updateDashboardSummary();
                storeSubscribers.forEach(fn => fn(window.WMS_STORE));
                window.dispatchEvent(new CustomEvent('wms:stateChange', { detail: window.WMS_STORE }));
            }
        };

        window.addEventListener('storage', event => {
            if (event.key !== WMS_STORAGE_KEY || !event.newValue) return;

            let incomingState;
            try {
                incomingState = JSON.parse(event.newValue);
            } catch (error) {
                console.warn('Estado sincronizado do WMS esta invalido:', error);
                return;
            }

            if (!Array.isArray(incomingState.invoices) ||
                !Array.isArray(incomingState.conferences) ||
                !Array.isArray(incomingState.labelQueue)) {
                console.warn('Estado sincronizado do WMS tem formato invalido.');
                return;
            }

            window.WMS_STORE.invoices = incomingState.invoices;
            window.WMS_STORE.conferences = incomingState.conferences;
            window.WMS_STORE.labelQueue = incomingState.labelQueue;
            if (!incomingState.invoices.some(invoice => invoice.id === selectedMobileNfId)) {
                selectedMobileNfId = '';
            }
            populateMobileNfSelect();
            handleMobileNfChange(selectedMobileNfId);
            renderInvoicesList();
            renderConferenceManagement();
            renderLabelsTab();
            updateBadges();
            updateDashboardSummary();
        });

        function getAcceptedQty(item) {
            if (Number.isInteger(item.acceptedQty)) return item.acceptedQty;
            const conference = window.WMS_STORE.conferences.find(record => record.id === item.id);
            return Math.max(0, item.caixaQty - (conference?.defeitoQty || 0));
        }

        function renderCode128(target, value, height) {
            if (typeof JsBarcode !== 'function' || !/^[\x20-\x7E]+$/.test(value)) return false;
            JsBarcode(target, value, {
                format: 'CODE128',
                displayValue: false,
                height,
                margin: 2
            });
            return true;
        }

        // Estados locais de interface
        let draftNfItems = [];
        let isCustomNfProduct = false;
        let invoicePreviewObjectUrl = null;
        let selectedMobileNfId = "";
        let activeLabelId = null;
        let currentLabelFilter = 'all';
        let expandedInvoiceIds = new Set(["NF-45890", "NF-45902"]);
        let barcodeScannerControls = null;
        let barcodeScannerStarting = false;
        let barcodeScannerRequestId = 0;

        // 3. Cálculo Automático FIFO / PEPS a partir da data de validade
        function calculateFIFO(validadeStr) {
            const dataHoje = new Date();
            dataHoje.setHours(0, 0, 0, 0);

            const [year, month, day] = validadeStr.split('-').map(Number);
            const dataValidade = new Date(year, month - 1, day);
            dataValidade.setHours(0, 0, 0, 0);

            const diasParaVencer = Math.ceil((dataValidade - dataHoje) / (1000 * 60 * 60 * 24));

            if (diasParaVencer <= 30) {
                return {
                    colorKey: 'red',
                    label: 'Vermelha',
                    labelUpper: 'VERMELHO',
                    priority: 'Prioridade Máxima / Curto Prazo',
                    days: diasParaVencer,
                    bgClass: 'bg-red-500',
                    softBg: 'bg-red-50',
                    textClass: 'text-red-700',
                    borderClass: 'border-red-300',
                    dot: '🔴'
                };
            } else if (diasParaVencer >= 31 && diasParaVencer <= 90) {
                return {
                    colorKey: 'yellow',
                    label: 'Amarela',
                    labelUpper: 'AMARELO',
                    priority: 'Atenção Intermediária',
                    days: diasParaVencer,
                    bgClass: 'bg-amber-400',
                    softBg: 'bg-amber-50',
                    textClass: 'text-amber-800',
                    borderClass: 'border-amber-300',
                    dot: '🟡'
                };
            } else {
                return {
                    colorKey: 'green',
                    label: 'Verde',
                    labelUpper: 'VERDE',
                    priority: 'Estoque Regular',
                    days: diasParaVencer,
                    bgClass: 'bg-emerald-500',
                    softBg: 'bg-emerald-50',
                    textClass: 'text-emerald-700',
                    borderClass: 'border-emerald-300',
                    dot: '🟢'
                };
            }
        }

        function formatDaysRemainingText(days) {
            if (days < 0) return `Vencido há ${Math.abs(days)}d`;
            if (days === 0) return `Vence hoje`;
            if (days === 1) return `1 dia`;
            return `${days} dias`;
        }

        function formatDateBR(dateStr) {
            if (!dateStr) return '--/--/----';
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        }

        function formatDateShortDDMM(dateStr) {
            if (!dateStr) return '--/--';
            const [, m, d] = dateStr.split('-');
            return `${d}/${m}`;
        }

        function getInvoiceStatus(invoice) {
            const total = invoice.items.length;
            const checked = invoice.items.filter(i => i.checked).length;
            if (checked === 0) {
                return { label: 'Aguardando Conferência', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200', checked, total };
            }
            if (checked < total) {
                return { label: 'Em Andamento', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200', checked, total };
            }
            return { label: 'Conferida', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', checked, total };
        }

        // 4. Navegação entre as Abas Laterais
        function setAppMenuOpen(isOpen) {
            const sidebar = document.getElementById('app-sidebar');
            const backdrop = document.getElementById('menu-backdrop');
            const toggleButton = document.getElementById('menu-toggle');
            const menuIcon = toggleButton.querySelector('i');

            sidebar.classList.toggle('menu-visible', isOpen);
            sidebar.setAttribute('aria-hidden', String(!isOpen));
            backdrop.classList.toggle('hidden', !isOpen);
            backdrop.setAttribute('aria-hidden', String(!isOpen));
            backdrop.tabIndex = isOpen ? 0 : -1;
            toggleButton.setAttribute('aria-expanded', String(isOpen));
            toggleButton.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
            menuIcon.classList.toggle('fa-bars', !isOpen);
            menuIcon.classList.toggle('fa-xmark', isOpen);
            document.body.classList.toggle('menu-open', isOpen);
        }

        function toggleAppMenu() {
            const isOpening = !document.getElementById('app-sidebar').classList.contains('menu-visible');
            setAppMenuOpen(isOpening);
            if (isOpening) {
                document.querySelector('#app-sidebar nav button')?.focus();
            }
        }

        function closeAppMenu() {
            const sidebar = document.getElementById('app-sidebar');
            if (!sidebar.classList.contains('menu-visible')) return;
            setAppMenuOpen(false);
            document.getElementById('menu-toggle').focus();
        }

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeAppMenu();
        });

        function switchTab(tabName) {
            closeAppMenu();
            if (tabName !== 'conferencia') stopBarcodeScanner();
            const tabs = ['dashboard', 'imputar', 'conferencia', 'etiquetas'];
            tabs.forEach(t => {
                document.getElementById(`tab-${t}`).classList.add('hidden');
            });

            // Resetar estilos dos botões
            document.getElementById('nav-dashboard').className = "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition text-sm group border border-dashed border-slate-700 cursor-pointer";
            ['imputar', 'conferencia', 'etiquetas'].forEach(t => {
                document.getElementById(`nav-${t}`).className = "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer";
            });

            document.getElementById(`tab-${tabName}`).classList.remove('hidden');

            if (tabName === 'dashboard') {
                document.getElementById('nav-dashboard').className = "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all bg-blue-600 text-white shadow-md shadow-blue-900/40 cursor-pointer";
                updateDashboardSummary();
            } else if (tabName === 'imputar') {
                document.getElementById('nav-imputar').className = "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all bg-blue-600 text-white shadow-md shadow-blue-900/40 cursor-pointer";
                renderInvoicesList();
            } else if (tabName === 'conferencia') {
                document.getElementById('nav-conferencia').className = "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all bg-blue-600 text-white shadow-md shadow-blue-900/40 cursor-pointer";
                populateMobileNfSelect();
                renderConferenceManagement();
            } else if (tabName === 'etiquetas') {
                document.getElementById('nav-etiquetas').className = "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all bg-blue-600 text-white shadow-md shadow-blue-900/40 cursor-pointer";
                renderLabelsTab();
            }
        }

        async function toggleAppFullscreen() {
            const appShell = document.getElementById('app-shell');
            const isFullscreen = document.fullscreenElement === appShell;

            try {
                if (isFullscreen) {
                    await document.exitFullscreen();
                } else {
                    await appShell.requestFullscreen();
                }
            } catch (error) {
                showToast('Nao foi possivel ativar a tela cheia neste navegador.', 'error');
            }
        }

        function updateFullscreenButton() {
            const appShell = document.getElementById('app-shell');
            const isFullscreen = document.fullscreenElement === appShell;
            const button = document.getElementById('header-fullscreen');
            const icon = document.getElementById('header-fullscreen-icon');

            icon.classList.toggle('fa-expand', !isFullscreen);
            icon.classList.toggle('fa-compress', isFullscreen);
            button.setAttribute('aria-label', isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia');
            button.setAttribute('title', isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia');
        }

        document.addEventListener('fullscreenchange', updateFullscreenButton);

        // =========================================================================
        // 5. LÓGICA DA ABA 1: IMPUTAR NOTA FISCAL (NF-e)
        // =========================================================================
        function toggleCustomNfProduct() {
            isCustomNfProduct = !isCustomNfProduct;
            const catalogBox = document.getElementById('nf-catalog-selector');
            const customBox = document.getElementById('nf-custom-product-fields');
            const btn = document.getElementById('btn-toggle-custom-nf');

            if (isCustomNfProduct) {
                catalogBox.classList.add('hidden');
                customBox.classList.remove('hidden');
                btn.textContent = "← Escolher do catálogo";
            } else {
                catalogBox.classList.remove('hidden');
                customBox.classList.add('hidden');
                btn.textContent = "+ Digitar EAN avulso";
            }
        }

        function addDraftNfItem() {
            const qtyInput = document.getElementById('nf-item-qty');
            const qtyRaw = qtyInput.value.trim();
            const qty = Number(qtyRaw);

            if (!qtyRaw || !Number.isInteger(qty) || qty <= 0) {
                showToast("Informe uma quantidade inteira maior que zero.", "error");
                qtyInput.focus();
                return;
            }

            let barcode = "";
            let productName = "";

            if (isCustomNfProduct) {
                barcode = document.getElementById('nf-custom-ean').value.trim();
                productName = document.getElementById('nf-custom-name').value.trim();
                if (!barcode || !productName) {
                    showToast("Preencha o Código EAN e o Nome do Produto avulso.", "error");
                    return;
                }
                if (!/^[0-9A-Za-z-]+$/.test(barcode)) {
                    showToast("O Código EAN deve conter apenas letras, números ou hífen.", "error");
                    return;
                }
            } else {
                barcode = document.getElementById('nf-product-select').value;
                productName = productCatalog[barcode].name;
            }

            // Se o mesmo EAN já estiver no rascunho, soma a quantidade
            const existing = draftNfItems.find(i => i.barcode === barcode);
            if (existing) {
                existing.notaQty += qty;
            } else {
                draftNfItems.push({ barcode, productName, notaQty: qty, checked: false });
            }

            qtyInput.value = '';
            if (isCustomNfProduct) {
                document.getElementById('nf-custom-ean').value = '';
                document.getElementById('nf-custom-name').value = '';
            }

            renderDraftNfItems();
            showToast(`${productName} (${qty} un) incluído na NF.`, "info");
        }

        function clearInvoicePreview() {
            if (invoicePreviewObjectUrl) {
                URL.revokeObjectURL(invoicePreviewObjectUrl);
                invoicePreviewObjectUrl = null;
            }

            const previewContainer = document.getElementById('nf-upload-preview-container');
            const imagePreview = document.getElementById('nf-upload-image-preview');
            previewContainer.classList.add('hidden');
            imagePreview.classList.add('hidden');
            imagePreview.removeAttribute('src');
            document.getElementById('nf-upload-file-name').textContent = '';
            document.getElementById('nf-reading-status').textContent = '';
            document.getElementById('nf-ocr-text').textContent = '';
        }

        function showInvoicePreview(url, fileName) {
            const previewContainer = document.getElementById('nf-upload-preview-container');
            const imagePreview = document.getElementById('nf-upload-image-preview');

            document.getElementById('nf-upload-file-name').textContent = fileName;
            previewContainer.classList.remove('hidden');
            imagePreview.src = url;
            imagePreview.classList.remove('hidden');
        }

        function hasDraftInvoiceData() {
            return Boolean(
                document.getElementById('nf-number').value.trim() ||
                document.getElementById('nf-supplier').value.trim() ||
                draftNfItems.length
            );
        }

        function clearDraftForInvoiceImport() {
            document.getElementById('nf-number').value = '';
            document.getElementById('nf-supplier').value = '';
            draftNfItems = [];
            if (isCustomNfProduct) toggleCustomNfProduct();
            renderDraftNfItems();
        }

        function normalizeInvoiceText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
        }

        function getInvoiceLineCenter(line) {
            return (line.bbox.y0 + line.bbox.y1) / 2;
        }

        function extractInvoiceItems(ocrData) {
            const lines = ocrData.lines || [];
            const allTextDigits = String(ocrData.text || '').replace(/\D/g, '');
            const imageWidth = ocrData.width || 1;
            const items = [];

            Object.entries(productCatalog).forEach(([barcode, product]) => {
                const barcodeDigits = barcode.replace(/\D/g, '');
                const barcodeFound = allTextDigits.includes(barcodeDigits) ||
                    (barcodeDigits.length === 14 && allTextDigits.includes(barcodeDigits.slice(1)));
                const productName = normalizeInvoiceText(product.name);
                const nameLine = lines.find(line =>
                    normalizeInvoiceText(line.text).includes(productName)
                );
                const eanLine = lines.find(line => {
                    const lineDigits = String(line.text || '').replace(/\D/g, '');
                    return lineDigits.includes(barcodeDigits) ||
                        (barcodeDigits.length === 14 && lineDigits.includes(barcodeDigits.slice(1)));
                });

                if (!barcodeFound && !nameLine) return;

                const anchor = nameLine || eanLine;
                let quantity = null;
                if (anchor && Array.isArray(ocrData.words)) {
                    const anchorY = getInvoiceLineCenter(anchor);
                    const quantityCandidates = ocrData.words.filter(word => {
                        const wordText = String(word.text || '').replace(/\D/g, '');
                        if (!/^\d{1,4}$/.test(wordText)) return false;
                        const wordX = (word.bbox.x0 + word.bbox.x1) / 2 / imageWidth;
                        const wordY = (word.bbox.y0 + word.bbox.y1) / 2;
                        return wordX >= 0.64 && wordX <= 0.73 && Math.abs(wordY - anchorY) <= 55;
                    }).sort((a, b) => {
                        const aY = Math.abs((a.bbox.y0 + a.bbox.y1) / 2 - anchorY);
                        const bY = Math.abs((b.bbox.y0 + b.bbox.y1) / 2 - anchorY);
                        return aY - bY;
                    });
                    if (quantityCandidates.length) {
                        quantity = Number(String(quantityCandidates[0].text).replace(/\D/g, ''));
                    }
                }

                if (Number.isInteger(quantity) && quantity > 0) {
                    items.push({
                        barcode,
                        productName: product.name,
                        notaQty: quantity,
                        checked: false
                    });
                }
            });

            return items;
        }

        function applyRecognizedInvoiceData(ocrData) {
            const text = String(ocrData.text || '');
            const normalizedText = normalizeInvoiceText(text);
            const invoiceNumberMatch = text.match(/N[º°o]\s*[:.]?\s*([0-9][0-9./-]{2,})/i);
            const dateMatch = text.match(/\b(\d{2})[\/.-](\d{2})[\/.-](20\d{2})\b/);
            const supplierLine = (text.match(/^[^\r\n]*MERCADO\s+GUAPE[^\r\n]*/im) || [])[0];
            const recognizedItems = extractInvoiceItems(ocrData);

            if (invoiceNumberMatch) {
                document.getElementById('nf-number').value = invoiceNumberMatch[1].replace(/[./]/g, '');
            } else if (normalizedText.includes('mercadoguape') && normalizedText.includes('000000123')) {
                document.getElementById('nf-number').value = 'DEMO-2026-001';
            }

            if (dateMatch) {
                document.getElementById('nf-date').value = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            }
            if (supplierLine) {
                document.getElementById('nf-supplier').value = 'Mercado Guape Distribuidora de Alimentos Ltda';
            }
            if (recognizedItems.length) {
                draftNfItems = recognizedItems;
                renderDraftNfItems();
            }

            document.getElementById('nf-ocr-text').textContent = text.trim() || 'Nenhum texto foi reconhecido.';
            const status = document.getElementById('nf-reading-status');
            status.textContent = recognizedItems.length
                ? `Leitura concluída: ${recognizedItems.length} produto(s) reconhecido(s). Revise os dados antes de lançar.`
                : 'Imagem lida, mas nenhum produto do catálogo foi identificado com quantidade. Confira o texto e preencha os dados manualmente.';
            showToast(
                recognizedItems.length
                    ? `${recognizedItems.length} produto(s) reconhecido(s). Revise os dados antes de lançar.`
                    : 'Leitura concluída sem identificar produtos do catálogo. Confira o texto reconhecido.',
                recognizedItems.length ? 'success' : 'info'
            );
        }

        async function readInvoiceImage() {
            const status = document.getElementById('nf-reading-status');
            const image = document.getElementById('nf-upload-image-preview');
            if (typeof Tesseract === 'undefined' || typeof Tesseract.recognize !== 'function') {
                status.textContent = 'OCR indisponível: não foi possível carregar a biblioteca. Verifique a conexão e tente novamente.';
                showToast('A biblioteca de leitura OCR não foi carregada. Verifique a conexão com a internet.', 'error');
                return;
            }

            status.textContent = 'Preparando a imagem para leitura...';
            try {
                if (image.decode) {
                    await image.decode();
                } else if (!image.complete || !image.naturalWidth) {
                    await new Promise((resolve, reject) => {
                        image.onload = resolve;
                        image.onerror = reject;
                    });
                }
                if (!image.naturalWidth || !image.naturalHeight) {
                    throw new Error('A imagem selecionada não pôde ser aberta.');
                }

                const scale = Math.min(2, 2400 / image.naturalWidth);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(image.naturalWidth * scale);
                canvas.height = Math.round(image.naturalHeight * scale);
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Não foi possível preparar a imagem para o OCR.');
                context.drawImage(image, 0, 0, canvas.width, canvas.height);

                const result = await Tesseract.recognize(canvas, 'por', {
                    logger: progress => {
                        if (progress.status === 'recognizing text') {
                            status.textContent = `Lendo texto: ${Math.round((progress.progress || 0) * 100)}%`;
                        } else if (progress.status === 'loading language traineddata') {
                            status.textContent = 'Baixando o modelo de português para a primeira leitura...';
                        }
                    }
                });
                applyRecognizedInvoiceData(result.data);
            } catch (error) {
                console.error('Falha ao ler a imagem da Nota Fiscal:', error);
                status.textContent = `Não foi possível ler a imagem: ${error.message || 'erro no OCR'}.`;
                showToast('Não foi possível ler a imagem. Confira o arquivo e tente novamente.', 'error');
            }
        }

        async function handleInvoiceFileSelection(input) {
            const file = input.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                input.value = '';
                showToast('Selecione uma imagem da Nota Fiscal (JPG, PNG, WEBP ou SVG).', 'error');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                input.value = '';
                showToast('O arquivo deve ter no máximo 10 MB.', 'error');
                return;
            }

            if (hasDraftInvoiceData() && !window.confirm('Substituir os dados atuais do rascunho pelos dados desta imagem?')) {
                input.value = '';
                return;
            }

            clearDraftForInvoiceImport();
            document.getElementById('nf-date').value = '';
            clearInvoicePreview();
            invoicePreviewObjectUrl = URL.createObjectURL(file);
            showInvoicePreview(invoicePreviewObjectUrl, file.name);
            await readInvoiceImage();
        }

        async function loadSampleInvoice() {
            if (hasDraftInvoiceData() && !window.confirm('Substituir os dados atuais do rascunho pela Nota Fiscal fictícia?')) return;

            clearDraftForInvoiceImport();
            document.getElementById('nf-date').value = '';
            document.getElementById('nf-file-input').value = '';
            clearInvoicePreview();
            showInvoicePreview('NOTA FISCAL FICTICIA.svg', 'Nota fiscal fictícia de demonstração');
            await readInvoiceImage();
        }

        window.addEventListener('beforeunload', () => {
            if (invoicePreviewObjectUrl) URL.revokeObjectURL(invoicePreviewObjectUrl);
        });

        function removeDraftNfItem(index) {
            draftNfItems.splice(index, 1);
            renderDraftNfItems();
        }

        function renderDraftNfItems() {
            const container = document.getElementById('draft-nf-items-list');
            const countBadge = document.getElementById('draft-items-count');
            countBadge.textContent = `${draftNfItems.length} ${draftNfItems.length === 1 ? 'item' : 'itens'}`;

            if (draftNfItems.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                        Nenhum item incluído nesta NF ainda.
                    </div>
                `;
                return;
            }

            container.innerHTML = draftNfItems.map((item, idx) => `
                <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <div class="min-w-0 pr-2">
                        <div class="font-bold text-slate-800 truncate">${escapeHtml(item.productName)}</div>
                            <div class="text-[10px] font-mono text-slate-500">EAN: ${escapeHtml(item.barcode)}</div>
                    </div>
                    <div class="flex items-center gap-2.5 shrink-0">
                        <span class="bg-blue-100 text-blue-800 font-extrabold px-2.5 py-1 rounded-lg">${item.notaQty} un</span>
                        <button type="button" onclick="removeDraftNfItem(${idx})" title="Remover item"
                                class="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        function saveNewInvoice() {
            const nfNumberRaw = document.getElementById('nf-number').value.trim();
            const supplier = document.getElementById('nf-supplier').value.trim();
            const emissionDate = document.getElementById('nf-date').value;

            if (!nfNumberRaw || !supplier || !emissionDate) {
                showToast("Preencha o Número da NF, Fornecedor e Data de Emissão.", "error");
                return;
            }

            if (draftNfItems.length === 0) {
                showToast("Adicione pelo menos 1 produto antes de lançar a Nota Fiscal.", "error");
                return;
            }

            const nfNumberClean = nfNumberRaw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
            if (!nfNumberClean) {
                showToast("Informe um número de NF válido.", "error");
                return;
            }
            const formattedNfId = nfNumberClean.startsWith('NF-') ? nfNumberClean : `NF-${nfNumberClean}`;

            if (window.WMS_STORE.invoices.some(inv => inv.id === formattedNfId)) {
                showToast(`A nota ${formattedNfId} já está cadastrada no sistema.`, "error");
                return;
            }

            const newInvoice = {
                id: formattedNfId,
                supplier,
                emissionDate,
                items: draftNfItems.map(i => ({ ...i }))
            };

            window.WMS_STORE.invoices.unshift(newInvoice);
            expandedInvoiceIds.add(formattedNfId);

            // Resetar formulário
            document.getElementById('nf-number').value = '';
            document.getElementById('nf-supplier').value = '';
            document.getElementById('nf-file-input').value = '';
            draftNfItems = [];
            clearInvoicePreview();
            renderDraftNfItems();
            renderInvoicesList();
            window.WMS_STORE.notify();

            showToast(`Nota Fiscal ${formattedNfId} lançada e liberada para Conferência Cega!`, "success");
        }

        function toggleInvoiceExpand(nfId) {
            if (expandedInvoiceIds.has(nfId)) {
                expandedInvoiceIds.delete(nfId);
            } else {
                expandedInvoiceIds.add(nfId);
            }
            renderInvoicesList();
        }

        function startConferenceForInvoice(nfId) {
            switchTab('conferencia');
            const selectEl = document.getElementById('mobile-select-nf');
            selectEl.value = nfId;
            handleMobileNfChange(nfId);
        }

        function renderInvoicesList() {
            const container = document.getElementById('invoices-list-container');
            container.innerHTML = '';

            window.WMS_STORE.invoices.forEach(inv => {
                const statusInfo = getInvoiceStatus(inv);
                const isExpanded = expandedInvoiceIds.has(inv.id);
                const totalUnits = inv.items.reduce((acc, i) => acc + i.notaQty, 0);

                const card = document.createElement('div');
                card.className = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition";
                card.innerHTML = `
                    <div onclick="toggleInvoiceExpand('${escapeHtml(inv.id)}')" class="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition">
                        <div class="flex items-center gap-3.5">
                            <div class="w-11 h-11 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0">
                                <span class="text-[9px] font-bold uppercase text-blue-400">NF-e</span>
                                <i class="fa-solid fa-file-lines text-sm"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h4 class="font-extrabold text-slate-900 text-base">${escapeHtml(inv.id)}</h4>
                                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}">
                                        ${statusInfo.label} (${statusInfo.checked}/${statusInfo.total})
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 mt-0.5">
                                    <strong>${escapeHtml(inv.supplier)}</strong> • Emissão: ${formatDateBR(inv.emissionDate)} • ${totalUnits} un fiscais
                                </p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                            ${statusInfo.checked < statusInfo.total ? `
                                <button onclick="startConferenceForInvoice('${inv.id}')"
                                        class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer">
                                    <i class="fa-solid fa-mobile-screen-button"></i>
                                    <span>Conferir no App</span>
                                </button>
                            ` : ''}
                            <button onclick="toggleInvoiceExpand('${inv.id}')" class="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-500 flex items-center justify-center transition cursor-pointer">
                                <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs"></i>
                            </button>
                        </div>
                    </div>

                    ${isExpanded ? `
                        <div class="px-5 pb-4 pt-2 bg-slate-50/70 border-t border-slate-100">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Itens Fiscais Imputados (Ocultos ao Conferente):</div>
                            <div class="divide-y divide-slate-200/70 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                                ${inv.items.map(item => `
                                    <div class="px-3.5 py-2.5 flex items-center justify-between text-xs">
                                        <div>
                                            <span class="font-bold text-slate-800">${escapeHtml(item.productName)}</span>
                                            <span class="block text-[10px] font-mono text-slate-400">EAN: ${escapeHtml(item.barcode)}</span>
                                        </div>
                                        <div class="flex items-center gap-3">
                                            <span class="font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                                                Qtd. Nota: ${item.notaQty} un
                                            </span>
                                            ${item.checked
                                                ? `<span class="${item.conferenceStatus === 'Devolvido' ? 'text-red-600' : 'text-emerald-600'} font-bold text-[11px]"><i class="fa-solid ${item.conferenceStatus === 'Devolvido' ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${item.conferenceStatus === 'Devolvido' ? 'Devolvido (encerrado)' : 'Conferido'}</span>`
                                                : `<span class="text-amber-600 font-bold text-[11px]"><i class="fa-regular fa-clock"></i> Pendente</span>`
                                            }
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                `;
                container.appendChild(card);
            });
        }

        // =========================================================================
        // 6. LÓGICA DA ABA 2: CONFERÊNCIA CEGA PROGRESSIVA NO CELULAR
        // =========================================================================
        function populateMobileNfSelect() {
            const selectEl = document.getElementById('mobile-select-nf');
            const currentVal = selectedMobileNfId;

            selectEl.innerHTML = `<option value="">— Selecione uma Nota Fiscal —</option>`;

            window.WMS_STORE.invoices.forEach(inv => {
                const status = getInvoiceStatus(inv);
                const opt = document.createElement('option');
                opt.value = inv.id;
                opt.textContent = `${inv.id} — ${inv.supplier} (${status.checked}/${status.total} itens)`;
                selectEl.appendChild(opt);
            });

            if (currentVal && window.WMS_STORE.invoices.some(i => i.id === currentVal)) {
                selectEl.value = currentVal;
            }
        }

        function resetMobileNfSelection() {
            document.getElementById('mobile-select-nf').value = "";
            handleMobileNfChange("");
        }

        function handleMobileNfChange(nfId) {
            if (barcodeScannerControls || barcodeScannerStarting) stopBarcodeScanner();
            if (selectedMobileNfId !== nfId) {
                document.getElementById('input-qty-caixa').value = '';
                document.getElementById('input-qty-defeito').value = '0';
                document.getElementById('input-defect-observation').value = '';
                document.getElementById('input-validade').value = '';
                updateDefectObservationVisibility('0');
            }
            selectedMobileNfId = nfId;

            const emptyState = document.getElementById('mobile-step-empty-state');
            const completedState = document.getElementById('mobile-step-completed-state');
            const step2Container = document.getElementById('mobile-step-2-container');
            const progressPill = document.getElementById('mobile-nf-progress-pill');
            const supplierBar = document.getElementById('mobile-nf-supplier-bar');

            // Limpa erros residuais
            clearFieldError('input-qty-caixa');
            clearFieldError('input-qty-defeito');
            clearFieldError('input-validade');
            document.getElementById('poka-yoke-alert').classList.add('hidden');

            // PASSO 1: Se nenhuma NF foi escolhida, oculta todos os passos seguintes
            if (!nfId) {
                emptyState.classList.remove('hidden');
                completedState.classList.add('hidden');
                step2Container.classList.add('hidden');
                progressPill.classList.add('hidden');
                supplierBar.classList.add('hidden');
                return;
            }

            const invoice = window.WMS_STORE.invoices.find(i => i.id === nfId);
            if (!invoice) return;

            supplierBar.classList.remove('hidden');
            document.getElementById('mobile-nf-supplier-name').textContent = invoice.supplier;

            const pendingItems = invoice.items.filter(i => !i.checked);
            const checkedCount = invoice.items.length - pendingItems.length;

            // Se todos os itens da NF já foram conferidos
            if (pendingItems.length === 0) {
                emptyState.classList.add('hidden');
                step2Container.classList.add('hidden');
                completedState.classList.remove('hidden');
                progressPill.classList.remove('hidden');
                progressPill.textContent = `Concluída (${invoice.items.length}/${invoice.items.length})`;
                document.getElementById('mobile-completed-nf-text').textContent =
                    `Todos os ${invoice.items.length} itens da ${invoice.id} (${invoice.supplier}) passaram pela conferência cega.`;
                return;
            }

            // PASSO 2: Libera os campos de conferência para os itens pendentes daquela NF
            emptyState.classList.add('hidden');
            completedState.classList.add('hidden');
            step2Container.classList.remove('hidden');

            progressPill.classList.remove('hidden');
            progressPill.textContent = `Item ${checkedCount + 1} de ${invoice.items.length} da ${invoice.id}`;

            // Popula dropdown com os itens pendentes desta NF
            const pendingSelect = document.getElementById('select-nf-pending-item');
            pendingSelect.innerHTML = pendingItems.map(item =>
                `<option value="${escapeHtml(item.barcode)}">${escapeHtml(item.productName)}</option>`
            ).join('');

            // Seleciona automaticamente o primeiro item pendente da NF
            const firstPending = pendingItems[0];
            document.getElementById('input-barcode').value = firstPending.barcode;
            handleBarcodeInput(firstPending.barcode);
        }

        function stopBarcodeScanner() {
            barcodeScannerRequestId += 1;
            barcodeScannerStarting = false;
            if (barcodeScannerControls) {
                barcodeScannerControls.stop();
                barcodeScannerControls = null;
            }

            const video = document.getElementById('barcode-scanner-video');
            const scannerBox = document.getElementById('scanner-box');
            const status = document.getElementById('barcode-scanner-status');
            const button = document.querySelector('[onclick="toggleBarcodeScanner()"]');
            const buttonLabel = document.getElementById('barcode-scanner-button-label');

            if (video) {
                video.pause();
                video.srcObject = null;
                video.classList.add('hidden');
            }
            if (scannerBox) scannerBox.classList.remove('scanner-active');
            if (status) status.classList.add('hidden');
            if (button) {
                button.setAttribute('aria-pressed', 'false');
                button.classList.remove('bg-red-600');
                button.classList.add('bg-slate-900');
                button.title = 'Ler código com a câmera';
            }
            if (buttonLabel) buttonLabel.textContent = 'Câmera';
        }

        window.addEventListener('beforeunload', stopBarcodeScanner);

        function getScannerStartErrorMessage(error) {
            if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
                return 'Permita o acesso à câmera no navegador para fazer a leitura.';
            }
            if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
                return 'Nenhuma câmera foi encontrada neste dispositivo.';
            }
            if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
                return 'A câmera está em uso por outro aplicativo. Feche-o e tente novamente.';
            }
            if (!window.isSecureContext) {
                return 'A leitura pela câmera exige que o app seja aberto por HTTPS.';
            }
            return `Não foi possível iniciar a câmera: ${error?.message || 'erro desconhecido'}.`;
        }

        function handleScannedBarcode(result, requestId) {
            if (requestId !== barcodeScannerRequestId || !barcodeScannerControls) return;
            const code = result.getText().trim();
            if (!code) return;

            stopBarcodeScanner();
            document.getElementById('input-barcode').value = code;
            handleBarcodeInput(code);
            const pendingSelect = document.getElementById('select-nf-pending-item');
            if ([...pendingSelect.options].some(option => option.value === code)) {
                pendingSelect.value = code;
            }
            showToast(`Código lido: ${code}`, 'success');
        }

        function isBarcodeDecodeMiss(error) {
            return [
                ZXing.NotFoundException,
                ZXing.ChecksumException,
                ZXing.FormatException
            ].some(ErrorType => typeof ErrorType === 'function' && error instanceof ErrorType);
        }

        async function toggleBarcodeScanner() {
            if (barcodeScannerControls || barcodeScannerStarting) {
                stopBarcodeScanner();
                return;
            }
            if (!window.isSecureContext) {
                showToast('A leitura pela câmera exige que o app seja aberto por HTTPS.', 'error');
                return;
            }
            if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                showToast('Este navegador não permite acesso à câmera. Digite o código manualmente.', 'error');
                return;
            }
            if (typeof ZXing === 'undefined' || typeof ZXing.BrowserMultiFormatReader !== 'function') {
                showToast('O leitor de código não foi carregado. Digite o código manualmente.', 'error');
                return;
            }

            const video = document.getElementById('barcode-scanner-video');
            const scannerBox = document.getElementById('scanner-box');
            const status = document.getElementById('barcode-scanner-status');
            const button = document.querySelector('[onclick="toggleBarcodeScanner()"]');
            const buttonLabel = document.getElementById('barcode-scanner-button-label');
            const requestId = ++barcodeScannerRequestId;
            barcodeScannerStarting = true;
            scannerBox.classList.add('scanner-active');
            video.classList.remove('hidden');
            status.classList.remove('hidden');
            button.setAttribute('aria-pressed', 'true');
            button.classList.remove('bg-slate-900');
            button.classList.add('bg-red-600');
            button.title = 'Parar leitura pela câmera';
            buttonLabel.textContent = 'Parar';

            const reader = new ZXing.BrowserMultiFormatReader();
            try {
                const controls = await reader.decodeFromConstraints(
                    { audio: false, video: { facingMode: { ideal: 'environment' } } },
                    video,
                    (result, error) => {
                        if (requestId !== barcodeScannerRequestId) return;
                        if (result) {
                            handleScannedBarcode(result, requestId);
                        } else if (error && !isBarcodeDecodeMiss(error)) {
                            stopBarcodeScanner();
                            showToast(`Erro durante a leitura: ${error.message || 'tente novamente'}.`, 'error');
                        }
                    }
                );

                if (requestId !== barcodeScannerRequestId) {
                    controls.stop();
                    return;
                }
                barcodeScannerControls = controls;
                barcodeScannerStarting = false;
            } catch (error) {
                if (requestId !== barcodeScannerRequestId) return;
                stopBarcodeScanner();
                showToast(getScannerStartErrorMessage(error), 'error');
            }
        }

        function selectNfPendingItem(barcode) {
            document.getElementById('input-barcode').value = barcode;
            handleBarcodeInput(barcode);
        }

        function updateDefectObservationVisibility(value) {
            const container = document.getElementById('defect-observation-container');
            const observation = document.getElementById('input-defect-observation');
            const hasDefect = Number(value) > 0;
            container.classList.toggle('hidden', !hasDefect);
            if (!hasDefect) observation.value = '';
        }

        function handleBarcodeInput(code) {
            const cleanCode = code.trim();
            document.getElementById('barcode-visual-digits').textContent = cleanCode || "Aguardando código";
            const barcodePreview = document.getElementById('barcode-visual-svg');
            barcodePreview.replaceChildren();
            if (cleanCode) renderCode128(barcodePreview, cleanCode, 26);

            const invoice = window.WMS_STORE.invoices.find(i => i.id === selectedMobileNfId);
            const nfItem = invoice ? invoice.items.find(i => i.barcode === cleanCode) : null;
            const catalogInfo = productCatalog[cleanCode];

            const nameEl = document.getElementById('product-name-display');
            const catEl = document.getElementById('product-category-display');
            const iconBox = document.getElementById('product-icon-box');
            const matchBadge = document.getElementById('product-nf-match-badge');

            if (nfItem) {
                nameEl.textContent = nfItem.productName;
                catEl.textContent = catalogInfo ? catalogInfo.category : `EAN ${cleanCode} • Pertence à ${invoice.id}`;
                matchBadge.className = "inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md";
                matchBadge.textContent = nfItem.checked ? "Já conferido nesta NF" : `Item da ${invoice.id}`;
            } else if (catalogInfo) {
                nameEl.textContent = catalogInfo.name;
                catEl.textContent = "Atenção: Este EAN não consta na NF selecionada";
                matchBadge.className = "inline-block text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md";
                matchBadge.textContent = "Fora da NF";
            } else {
                nameEl.textContent = cleanCode ? `Código ${cleanCode}` : "Aguardando EAN";
                catEl.textContent = "Digite ou selecione um item da NF";
                matchBadge.className = "inline-block text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md";
                matchBadge.textContent = "Produto";
            }

            if (catalogInfo) {
                iconBox.innerHTML = catalogInfo.image
                    ? `<img src="${escapeHtml(catalogInfo.image)}" alt="${escapeHtml(catalogInfo.name)}" class="w-full h-full object-contain rounded-xl bg-white">`
                    : `
                        <div class="w-10 h-11 rounded-md bg-gradient-to-b ${catalogInfo.badgeColor} flex flex-col items-center justify-center border border-white/30 shadow">
                            <span class="text-[7px] font-black tracking-tighter bg-white text-slate-900 px-1 rounded-xs">${catalogInfo.shortBrand}</span>
                            <i class="fa-solid ${catalogInfo.icon} text-white text-xs mt-1"></i>
                        </div>
                    `;
            } else {
                iconBox.innerHTML = `<i class="fa-solid fa-box-open text-xl text-blue-400"></i>`;
            }
        }

        function clearFieldError(inputId) {
            const el = document.getElementById(inputId);
            el.classList.remove('border-red-500', 'ring-2', 'ring-red-500/30', 'bg-red-50');
            el.classList.add('border-slate-300', 'bg-white');
        }

        function highlightFieldError(inputId) {
            const el = document.getElementById(inputId);
            el.classList.remove('border-slate-300', 'bg-white');
            el.classList.add('border-red-500', 'ring-2', 'ring-red-500/30', 'bg-red-50');
        }

        function processConference(actionStatus) {
            if (!selectedMobileNfId) {
                showToast("Selecione uma Nota Fiscal primeiro.", "error");
                return;
            }

            const invoice = window.WMS_STORE.invoices.find(i => i.id === selectedMobileNfId);
            if (!invoice) return;

            const barcode = document.getElementById('input-barcode').value.trim();
            const nfItem = invoice.items.find(i => i.barcode === barcode);

            if (!nfItem) {
                showToast(`O código ${barcode} não pertence à ${invoice.id}. Selecione um item da nota.`, "error");
                return;
            }

            const caixaQtyRaw = document.getElementById('input-qty-caixa').value;
            const caixaQty = Number(caixaQtyRaw);
            const defeitoRaw = document.getElementById('input-qty-defeito').value;
            const defeitoQty = defeitoRaw === '' ? 0 : Number(defeitoRaw);
            const defeitoObservation = document.getElementById('input-defect-observation').value.trim();
            const validade = document.getElementById('input-validade').value;

            const alertBox = document.getElementById('poka-yoke-alert');
            const formEl = document.getElementById('poka-yoke-form');

            clearFieldError('input-qty-caixa');
            clearFieldError('input-validade');

            // TRAVA POKA-YOKE: Bloqueia envio se Quantidade na caixa ou Validade estiverem vazios
            let hasError = false;
            if (!caixaQtyRaw || !Number.isInteger(caixaQty) || caixaQty <= 0) {
                highlightFieldError('input-qty-caixa');
                hasError = true;
            }
            if (!Number.isInteger(defeitoQty) || defeitoQty < 0) {
                highlightFieldError('input-qty-defeito');
                showToast("A quantidade com defeito deve ser um inteiro maior ou igual a zero.", "error");
                return;
            }
            if (defeitoQty > caixaQty) {
                highlightFieldError('input-qty-defeito');
                showToast("A quantidade com defeito nao pode exceder a quantidade fisica.", "error");
                return;
            }
            if (!validade) {
                highlightFieldError('input-validade');
                hasError = true;
            }
            if (actionStatus === 'Aceito' && validade && validade < getTodayStr()) {
                highlightFieldError('input-validade');
                showToast("Produto vencido não pode ser aceito. Registre a devolução.", "error");
                return;
            }
            if (actionStatus === 'Aceito' && defeitoQty === caixaQty) {
                highlightFieldError('input-qty-defeito');
                showToast("Todas as unidades estão com defeito. Registre a devolução.", "error");
                return;
            }

            if (hasError) {
                alertBox.classList.remove('hidden');
                formEl.classList.remove('animate-shake');
                void formEl.offsetWidth;
                formEl.classList.add('animate-shake');
                return;
            }

            alertBox.classList.add('hidden');

            // Marca item como conferido na NF
            nfItem.checked = true;
            nfItem.conferenceStatus = actionStatus;

            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const newId = Date.now();

            // Registra no histórico gerencial
            const confRecord = {
                id: newId,
                nfId: invoice.id,
                supplier: invoice.supplier,
                barcode: nfItem.barcode,
                productName: nfItem.productName,
                notaQty: nfItem.notaQty,
                caixaQty,
                defeitoQty,
                defeitoObservation: defeitoQty > 0 ? defeitoObservation : '',
                validade,
                status: actionStatus,
                timestamp: timeStr
            };
            window.WMS_STORE.conferences.unshift(confRecord);

            // Se Aceito, calcula validade e envia automaticamente para a Fila de Etiquetas FIFO/PEPS
            if (actionStatus === 'Aceito') {
                lotCounter += 1;
                const acceptedQty = caixaQty - defeitoQty;
                const labelRecord = {
                    id: newId,
                    lote: `LT-${String(lotCounter).padStart(3, '0')}`,
                    nfId: invoice.id,
                    barcode: nfItem.barcode,
                    productName: nfItem.productName,
                    validade,
                    caixaQty: acceptedQty,
                    acceptedQty,
                    stored: false
                };
                window.WMS_STORE.labelQueue.unshift(labelRecord);
                activeLabelId = newId;

                const fifo = calculateFIFO(validade);
                showToast(`Aceito! Etiqueta ${fifo.dot} ${fifo.label} gerada para ${nfItem.productName}.`, 'success');
            } else {
                showToast(`Devolução de ${nfItem.productName} registrada. Item encerrado nesta NF.`, 'error');
            }

            // Limpa os campos de apontamento e avança para o próximo item da NF (ou conclusão)
            document.getElementById('input-qty-caixa').value = '';
            document.getElementById('input-qty-defeito').value = '0';
            document.getElementById('input-defect-observation').value = '';
            updateDefectObservationVisibility('0');
            document.getElementById('input-validade').value = '';

            populateMobileNfSelect();
            handleMobileNfChange(selectedMobileNfId);
            renderConferenceManagement();
            window.WMS_STORE.notify();
        }

        // Renderiza o Painel de Gestão da Aba 2
        function renderConferenceManagement() {
            const tbody = document.getElementById('conference-table-body');
            tbody.innerHTML = '';

            const records = window.WMS_STORE.conferences;
            let divergencias = 0;
            let avariasOrDevolvidos = 0;

            const nfsConcluidas = window.WMS_STORE.invoices.filter(inv =>
                inv.items.length > 0 && inv.items.every(i => i.checked)
            ).length;

            if (records.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="py-10 text-center text-slate-400 text-xs">
                            Nenhuma conferência registrada ainda. Selecione uma Nota Fiscal no celular ao lado para começar.
                        </td>
                    </tr>
                `;
            } else {
                records.forEach(item => {
                    const diff = item.caixaQty - item.notaQty;
                    const hasDivergence = diff !== 0;
                    if (hasDivergence) divergencias++;
                    if (item.status === 'Devolvido' || item.defeitoQty > 0) avariasOrDevolvidos++;

                    let divergenceBadge = `<span class="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"><i class="fa-solid fa-check"></i> OK</span>`;
                    if (diff < 0) {
                        divergenceBadge = `<span class="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">Falta (${diff})</span>`;
                    } else if (diff > 0) {
                        divergenceBadge = `<span class="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">Sobra (+${diff})</span>`;
                    }

                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-slate-50/90 transition";
                    tr.innerHTML = `
                        <td class="py-3 px-3 font-extrabold text-blue-700">${escapeHtml(item.nfId)}</td>
                        <td class="py-3 px-3">
                            <div class="font-bold text-slate-800">${escapeHtml(item.productName)}</div>
                            <div class="text-[10px] font-mono text-slate-400">${escapeHtml(item.barcode)} • ${escapeHtml(item.timestamp)}</div>
                            ${item.defeitoQty > 0 && item.defeitoObservation ? `<div class="mt-1 text-[10px] text-red-600"><span class="font-bold">Observação:</span> ${escapeHtml(item.defeitoObservation)}</div>` : ''}
                        </td>
                        <td class="py-3 px-2.5 text-center font-bold text-slate-600">${item.notaQty}</td>
                        <td class="py-3 px-2.5 text-center font-extrabold text-slate-900">${item.caixaQty}</td>
                        <td class="py-3 px-2.5 text-center">
                            <span class="font-bold ${item.defeitoQty > 0 ? 'text-red-600' : 'text-slate-400'}">${item.defeitoQty}</span>
                        </td>
                        <td class="py-3 px-2.5 text-center">${divergenceBadge}</td>
                        <td class="py-3 px-2.5 font-bold text-slate-700">${formatDateBR(item.validade)}</td>
                        <td class="py-3 px-3 text-right">
                            <span class="inline-block font-bold px-2.5 py-1 rounded-lg ${item.status === 'Aceito' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                                ${item.status}
                            </span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            document.getElementById('kpi-total').textContent = records.length;
            document.getElementById('kpi-divergencias').textContent = divergencias;
            document.getElementById('kpi-devolvidos').textContent = avariasOrDevolvidos;
            document.getElementById('kpi-nfs-concluidas').textContent = nfsConcluidas;
        }

        // =========================================================================
        // 7. LÓGICA DA ABA 3: ETIQUETAS (FIFO/PEPS) & CELULAR TELA 2
        // =========================================================================
        function filterLabels(colorKey) {
            currentLabelFilter = colorKey;
            renderLabelsTab();
        }

        function renderLabelsTab() {
            const tbody = document.getElementById('labels-table-body');
            tbody.innerHTML = '';

            const queue = window.WMS_STORE.labelQueue;

            const summary = {
                all: { lotes: queue.length, caixas: 0 },
                red: { lotes: 0, caixas: 0 },
                yellow: { lotes: 0, caixas: 0 },
                green: { lotes: 0, caixas: 0 }
            };

            queue.forEach(item => {
                const fifo = calculateFIFO(item.validade);
                const acceptedQty = getAcceptedQty(item);
                summary.all.caixas += acceptedQty;
                summary[fifo.colorKey].lotes++;
                summary[fifo.colorKey].caixas += acceptedQty;
            });

            document.getElementById('count-all-lotes').textContent = summary.all.lotes;
            document.getElementById('count-all-caixas').textContent = summary.all.caixas;
            document.getElementById('count-red-lotes').textContent = summary.red.lotes;
            document.getElementById('count-red-caixas').textContent = summary.red.caixas;
            document.getElementById('count-yellow-lotes').textContent = summary.yellow.lotes;
            document.getElementById('count-yellow-caixas').textContent = summary.yellow.caixas;
            document.getElementById('count-green-lotes').textContent = summary.green.lotes;
            document.getElementById('count-green-caixas').textContent = summary.green.caixas;

            ['all', 'red', 'yellow', 'green'].forEach(key => {
                const btn = document.getElementById(`filter-${key}`);
                if (key === currentLabelFilter) {
                    btn.classList.add('ring-2', 'ring-offset-1', 'ring-blue-600');
                } else {
                    btn.classList.remove('ring-2', 'ring-offset-1', 'ring-blue-600');
                }
            });

            // Ordena FIFO (vencimento mais próximo primeiro)
            const sortedQueue = [...queue].sort((a, b) => new Date(a.validade) - new Date(b.validade));
            const filtered = sortedQueue.filter(item => {
                if (currentLabelFilter === 'all') return true;
                return calculateFIFO(item.validade).colorKey === currentLabelFilter;
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-10 text-center text-slate-400 text-xs">
                            Nenhuma etiqueta na fila para este filtro. Aceite itens na Conferência Cega para gerar etiquetas automaticamente.
                        </td>
                    </tr>
                `;
            } else {
                filtered.forEach(item => {
                    const fifo = calculateFIFO(item.validade);
                    const isSelected = item.id === activeLabelId;

                    const tr = document.createElement('tr');
                    tr.onclick = () => {
                        activeLabelId = item.id;
                        renderLabelsTab();
                    };
                    tr.className = `cursor-pointer transition ${isSelected ? 'bg-blue-50/90' : 'hover:bg-slate-50'}`;
                    tr.innerHTML = `
                        <td class="py-3.5 px-4">
                            <div class="flex items-center gap-2.5">
                                <span class="w-2.5 h-8 rounded-full ${fifo.bgClass} shrink-0"></span>
                                <div>
                                    <div class="font-bold text-slate-800">${escapeHtml(item.productName)}</div>
                                    <div class="text-[11px] font-mono text-slate-400">
                                        ${escapeHtml(item.nfId)} • ${escapeHtml(item.lote)} ${item.stored ? '• <span class="text-emerald-600 font-bold">Guardado</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="py-3.5 px-3 font-bold text-slate-800">${formatDateBR(item.validade)}</td>
                        <td class="py-3.5 px-3 font-bold ${fifo.textClass}">${formatDaysRemainingText(fifo.days)}</td>
                        <td class="py-3.5 px-3">
                            <span class="inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg ${fifo.softBg} ${fifo.textClass} border ${fifo.borderClass}">
                                ${fifo.dot} ${fifo.label}
                            </span>
                        </td>
                        <td class="py-3.5 px-3 text-center">
                            <span class="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md">${getAcceptedQty(item)} un</span>
                        </td>
                        <td class="py-3.5 px-4 text-right" onclick="event.stopPropagation()">
                            <button onclick="openPrintModal(${item.id})"
                                    class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white font-bold transition inline-flex items-center gap-1.5 cursor-pointer">
                                <i class="fa-solid fa-print"></i>
                                <span>Imprimir</span>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            renderPhoneScreen2();
        }

        function renderPhoneScreen2() {
            const screen = document.getElementById('phone-screen-2-content');
            const queue = window.WMS_STORE.labelQueue;
            const item = queue.find(i => i.id === activeLabelId) || queue[0];

            if (!item) {
                screen.innerHTML = `
                    <div class="flex-1 flex flex-col items-center justify-center text-center p-6">
                        <div class="w-16 h-16 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-2xl mb-3">
                            <i class="fa-solid fa-tags"></i>
                        </div>
                        <h4 class="font-bold text-slate-800 text-sm">Nenhuma Etiqueta na Fila</h4>
                        <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                            Quando um produto for <strong>Aceito</strong> na Conferência Cega, a etiqueta colorida aparecerá aqui automaticamente.
                        </p>
                    </div>
                `;
                return;
            }

            activeLabelId = item.id;
            const fifo = calculateFIFO(item.validade);
            const catalogInfo = productCatalog[item.barcode] || {
                badgeColor: "from-slate-700 via-slate-600 to-slate-800",
                shortBrand: "ITEM",
                icon: "fa-box"
            };
            const productImage = catalogInfo.image
                ? `<img src="${escapeHtml(catalogInfo.image)}" alt="${escapeHtml(item.productName)}" class="w-full h-full object-contain rounded-xl bg-white">`
                : `
                    <div class="w-10 h-11 rounded-md bg-gradient-to-b ${catalogInfo.badgeColor} flex flex-col items-center justify-center border border-white/30">
                        <span class="text-[7px] font-black bg-white text-slate-900 px-1 rounded-xs">${escapeHtml(catalogInfo.shortBrand)}</span>
                        <i class="fa-solid ${catalogInfo.icon} text-white text-xs mt-1"></i>
                    </div>
                `;

            screen.innerHTML = `
                <div class="space-y-3">
                    <!-- Topo Câmera + Código de Barras -->
                    <div class="bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200/80 flex items-center gap-2.5">
                        <div class="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-camera text-lg"></i>
                        </div>
                        <div class="flex-1 min-h-12 bg-white rounded-xl border border-slate-300 flex flex-col items-center justify-center px-2 overflow-hidden">
                            <svg class="phone-barcode max-w-full" aria-label="Código de barras do produto"></svg>
                            <span class="text-[9px] font-mono font-bold text-slate-900">${escapeHtml(item.barcode)}</span>
                        </div>
                    </div>

                    <!-- Card Produto -->
                    <div class="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl ${catalogInfo.image ? 'bg-white' : 'bg-slate-900'} flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                            ${productImage}
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="font-extrabold text-slate-900 text-base leading-tight truncate">${escapeHtml(item.productName)}</h3>
                            <span class="text-[11px] font-semibold text-slate-500">${escapeHtml(item.nfId)} • ${escapeHtml(item.lote)}</span>
                        </div>
                    </div>

                    <!-- Box Cinza Mieruka: Validade DD/MM + 3 Blocos de Cor + Quantidade na Caixa -->
                    <div class="bg-[#cfd7e3] rounded-2xl p-4 space-y-3.5 shadow-inner border border-slate-300/80">
                        <div>
                            <label class="block text-xs font-bold text-slate-800 mb-1">Validade:</label>
                            <div class="w-full bg-white text-slate-900 font-extrabold text-base rounded-lg px-3 py-2 border border-slate-300 flex items-center justify-between">
                                <span>${formatDateShortDDMM(item.validade)}</span>
                                <span class="text-[11px] font-bold ${fifo.textClass}">${formatDaysRemainingText(fifo.days)}</span>
                            </div>
                        </div>

                        <!-- 3 Blocos de Cor lado a lado (APENAS a cor calculada fica acesa) -->
                        <div>
                            <div class="grid grid-cols-3 gap-2.5">
                                <!-- Vermelho -->
                                <div class="h-11 rounded-lg bg-[#ff3b30] transition-all flex items-center justify-center ${fifo.colorKey === 'red' ? 'ring-3 ring-slate-900 scale-105 opacity-100 shadow-md' : 'opacity-20 grayscale'}">
                                    ${fifo.colorKey === 'red' ? '<i class="fa-solid fa-check text-white text-base"></i>' : ''}
                                </div>
                                <!-- Amarelo -->
                                <div class="h-11 rounded-lg bg-[#ffde59] transition-all flex items-center justify-center ${fifo.colorKey === 'yellow' ? 'ring-3 ring-slate-900 scale-105 opacity-100 shadow-md' : 'opacity-20 grayscale'}">
                                    ${fifo.colorKey === 'yellow' ? '<i class="fa-solid fa-check text-slate-900 text-base"></i>' : ''}
                                </div>
                                <!-- Verde -->
                                <div class="h-11 rounded-lg bg-[#7ed957] transition-all flex items-center justify-center ${fifo.colorKey === 'green' ? 'ring-3 ring-slate-900 scale-105 opacity-100 shadow-md' : 'opacity-20 grayscale'}">
                                    ${fifo.colorKey === 'green' ? '<i class="fa-solid fa-check text-slate-900 text-base"></i>' : ''}
                                </div>
                            </div>
                            <p class="text-[11px] font-bold text-center mt-2 ${fifo.textClass}">
                                ${fifo.dot} Etiqueta ${fifo.labelUpper} — ${fifo.priority}
                            </p>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-800 mb-1">Unidades aproveitáveis:</label>
                            <div class="w-full bg-white text-slate-900 font-extrabold text-base rounded-lg px-3 py-2 border border-slate-300">
                                ${getAcceptedQty(item)}
                            </div>
                        </div>

                        <!-- Botões Inferiores: Excluir e Guardar -->
                        <div class="grid grid-cols-2 gap-2.5 pt-1">
                            <button type="button" onclick="removeLabelFromPhone(${item.id})"
                                    class="bg-[#ef4444] hover:bg-red-600 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl shadow-md transition cursor-pointer">
                                Excluir
                            </button>
                            <button type="button" onclick="storeLabelFromPhone(${item.id})"
                                    class="bg-[#65d65c] hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl shadow-md transition cursor-pointer">
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Atalho de Impressão no Celular -->
                <button type="button" onclick="openPrintModal(${item.id})"
                        class="w-full mt-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow transition cursor-pointer">
                    <i class="fa-solid fa-print"></i>
                    <span>Imprimir Etiqueta (${getAcceptedQty(item)} un.)</span>
                </button>
            `;
            const phoneBarcode = screen.querySelector('.phone-barcode');
            if (!renderCode128(phoneBarcode, String(item.barcode), 28)) {
                phoneBarcode.remove();
            }
        }

        function removeLabelFromPhone(id) {
            window.WMS_STORE.labelQueue = window.WMS_STORE.labelQueue.filter(i => i.id !== id);
            activeLabelId = window.WMS_STORE.labelQueue.length > 0 ? window.WMS_STORE.labelQueue[0].id : null;
            renderLabelsTab();
            window.WMS_STORE.notify();
            showToast("Etiqueta removida da fila.", "info");
        }

        function storeLabelFromPhone(id) {
            const idx = window.WMS_STORE.labelQueue.findIndex(i => i.id === id);
            if (idx !== -1) {
                window.WMS_STORE.labelQueue[idx].stored = true;
                showToast(`Etiqueta aplicada e lote ${window.WMS_STORE.labelQueue[idx].lote} guardado no estoque!`, "success");
                const next = window.WMS_STORE.labelQueue.find(i => !i.stored);
                if (next) activeLabelId = next.id;
                renderLabelsTab();
                window.WMS_STORE.notify();
            }
        }

        // =========================================================================
        // 8. MODAL DE IMPRESSÃO TÉRMICA (100x50mm)
        // =========================================================================
        function openPrintModal(itemId) {
            const modal = document.getElementById('print-modal');
            const printArea = document.getElementById('print-area');
            printArea.innerHTML = '';

            let itemsToPrint = [];
            if (itemId) {
                itemsToPrint = window.WMS_STORE.labelQueue.filter(i => i.id === itemId);
            } else {
                itemsToPrint = window.WMS_STORE.labelQueue.filter(item => {
                    if (currentLabelFilter === 'all') return true;
                    return calculateFIFO(item.validade).colorKey === currentLabelFilter;
                });
            }

            if (itemsToPrint.length === 0) {
                showToast("Nenhuma etiqueta disponível na seleção para impressão.", "error");
                return;
            }

            itemsToPrint.forEach(item => {
                const fifo = calculateFIFO(item.validade);
                const labelCard = document.createElement('div');
                labelCard.className = "thermal-label-100x50 bg-white border-2 border-slate-900 rounded-xl p-4 shadow-sm mx-auto";
                labelCard.innerHTML = `
                    <div class="${fifo.bgClass} text-white px-3 py-1.5 rounded-lg flex items-center justify-between font-black text-xs uppercase tracking-wider mb-3">
                        <span>FIFO / PEPS: ${fifo.labelUpper}</span>
                        <span>${escapeHtml(item.nfId)} • ${escapeHtml(item.lote)}</span>
                    </div>

                    <div class="flex justify-between items-start gap-4">
                        <div>
                            <span class="text-[10px] font-bold uppercase text-slate-400">Produto</span>
                            <h4 class="text-lg font-black text-slate-900 leading-tight">${escapeHtml(item.productName)}</h4>
                            <p class="text-xs font-mono text-slate-600 mt-0.5">EAN: ${escapeHtml(item.barcode)}</p>
                            <p class="text-xs font-bold text-slate-700 mt-2">Unidades aproveitáveis: ${getAcceptedQty(item)}</p>
                        </div>

                        <div class="text-right bg-slate-100 px-3 py-2 rounded-lg border border-slate-300">
                            <span class="block text-[10px] font-bold uppercase text-slate-500">Validade</span>
                            <span class="text-xl font-black text-slate-900">${formatDateBR(item.validade)}</span>
                            <span class="block text-[10px] font-bold ${fifo.textClass}">${formatDaysRemainingText(fifo.days)}</span>
                        </div>
                    </div>

                    <div class="mt-3 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between">
                        <svg class="print-barcode" aria-label="Código de barras ${escapeHtml(item.barcode)}"></svg>
                        <span class="text-[10px] font-bold text-slate-400 uppercase">RECEBE CERTO • 100x50mm</span>
                    </div>
                `;
                const barcodeSvg = labelCard.querySelector('.print-barcode');
                if (!renderCode128(barcodeSvg, String(item.barcode), 42)) {
                    barcodeSvg.replaceWith(document.createTextNode(`Código para leitura manual: ${item.barcode}`));
                }
                printArea.appendChild(labelCard);
            });
            if (typeof JsBarcode !== 'function') {
                showToast("Biblioteca de código de barras indisponível. As etiquetas mostram o código para leitura manual.", "error");
            } else if (itemsToPrint.some(item => !/^[\x20-\x7E]+$/.test(String(item.barcode)))) {
                showToast("Há um código inválido para Code 128. A etiqueta correspondente mostra o código para leitura manual.", "error");
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closePrintModal() {
            const modal = document.getElementById('print-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        // =========================================================================
        // 9. BADGES, DASHBOARD DE INTEGRAÇÃO E NOTIFICAÇÕES TOAST
        // =========================================================================
        function updateBadges() {
            const pendingInvoices = window.WMS_STORE.invoices.filter(inv =>
                inv.items.some(i => !i.checked)
            ).length;

            const totalItems = window.WMS_STORE.invoices.reduce((acc, inv) => acc + inv.items.length, 0);
            const checkedItems = window.WMS_STORE.invoices.reduce((acc, inv) =>
                acc + inv.items.filter(i => i.checked).length, 0
            );

            document.getElementById('badge-imputar').textContent = pendingInvoices;
            document.getElementById('badge-conferencia').textContent = `${checkedItems}/${totalItems}`;
            document.getElementById('badge-etiquetas').textContent = window.WMS_STORE.labelQueue.length;
        }

        function updateDashboardSummary() {
            if (!document.getElementById('dash-kpi-nfs')) return;
            const nfs = window.WMS_STORE.invoices;
            const pendingNfs = nfs.filter(inv => inv.items.some(i => !i.checked)).length;
            const confs = window.WMS_STORE.conferences;
            const divergences = confs.filter(c => c.caixaQty !== c.notaQty).length;
            const labels = window.WMS_STORE.labelQueue;
            const totalBoxes = labels.reduce((acc, l) => acc + getAcceptedQty(l), 0);
            const redLots = labels.filter(l => calculateFIFO(l.validade).colorKey === 'red').length;
            const yellowLots = labels.filter(l => calculateFIFO(l.validade).colorKey === 'yellow').length;
            const greenLots = labels.filter(l => calculateFIFO(l.validade).colorKey === 'green').length;
            const totalItems = nfs.reduce((acc, inv) => acc + inv.items.length, 0);
            const checkedItems = nfs.reduce((acc, inv) => acc + inv.items.filter(i => i.checked).length, 0);
            const progress = totalItems ? Math.round((checkedItems / totalItems) * 100) : 0;

            document.getElementById('dash-kpi-nfs').textContent = nfs.length;
            document.getElementById('dash-kpi-nfs-sub').textContent = `${pendingNfs} aguardando conferência`;
            document.getElementById('dash-kpi-conf').textContent = confs.length;
            document.getElementById('dash-kpi-div-sub').textContent = `${divergences} divergências`;
            document.getElementById('dash-kpi-labels').textContent = labels.length;
            document.getElementById('dash-kpi-boxes-sub').textContent = `${totalBoxes} unidades aproveitáveis`;
            document.getElementById('dash-kpi-red').textContent = redLots;
            document.getElementById('dash-fifo-red').textContent = `${redLots} lotes`;
            document.getElementById('dash-fifo-yellow').textContent = `${yellowLots} lotes`;
            document.getElementById('dash-fifo-green').textContent = `${greenLots} lotes`;
            document.getElementById('dash-step-notes').textContent = nfs.length;
            document.getElementById('dash-step-conferences').textContent = confs.length;
            document.getElementById('dash-step-labels').textContent = labels.length;
            document.getElementById('dash-progress-percent').textContent = `${progress}%`;
            document.getElementById('dash-progress-bar').style.width = `${progress}%`;

            const recentContainer = document.getElementById('dashboard-recent-invoices');
            const recentInvoices = [...nfs]
                .sort((a, b) => String(b.emissionDate).localeCompare(String(a.emissionDate)))
                .slice(0, 4);

            recentContainer.innerHTML = recentInvoices.length ? recentInvoices.map(inv => {
                const status = getInvoiceStatus(inv);
                return `
                    <button type="button" class="dashboard-recent-item w-full text-left" onclick="switchTab('imputar'); toggleInvoiceExpand('${escapeHtml(inv.id)}')">
                        <span class="dashboard-recent-item-icon"><i class="fa-solid fa-file-lines"></i></span>
                        <div>
                            <strong>${escapeHtml(inv.id)}</strong>
                            <span>${escapeHtml(inv.supplier)} • ${formatDateBR(inv.emissionDate)}</span>
                        </div>
                        <span class="text-[10px] font-bold ${status.checked === status.total ? 'text-emerald-600' : 'text-amber-600'}">${status.checked}/${status.total}</span>
                    </button>
                `;
            }).join('') : `<div class="dashboard-empty">Nenhuma Nota Fiscal cadastrada.</div>`;

            const alertContainer = document.getElementById('dashboard-alert-list');
            const alerts = [];
            if (redLots > 0) alerts.push({ tone: 'red', icon: 'fa-clock', title: `${redLots} lote${redLots === 1 ? '' : 's'} crítico${redLots === 1 ? '' : 's'}`, text: 'Produto próximo do vencimento' });
            if (divergences > 0) alerts.push({ tone: 'yellow', icon: 'fa-scale-balanced', title: `${divergences} divergência${divergences === 1 ? '' : 's'}`, text: 'Quantidade recebida diferente da NF' });
            const defectCount = confs.filter(c => c.defeitoQty > 0).length;
            if (defectCount > 0) alerts.push({ tone: 'red', icon: 'fa-box-open', title: `${defectCount} item${defectCount === 1 ? '' : 's'} com avaria`, text: 'Requer avaliação operacional' });
            if (pendingNfs > 0) alerts.push({ tone: 'yellow', icon: 'fa-hourglass-half', title: `${pendingNfs} nota${pendingNfs === 1 ? '' : 's'} pendente${pendingNfs === 1 ? '' : 's'}`, text: 'Aguardando conferência cega' });
            if (alerts.length === 0) alerts.push({ tone: 'green', icon: 'fa-circle-check', title: 'Operação em ordem', text: 'Nenhum ponto crítico identificado' });

            alertContainer.innerHTML = alerts.slice(0, 4).map(alert => `
                <div class="dashboard-alert-item">
                    <span class="dashboard-alert-icon alert-${alert.tone}"><i class="fa-solid ${alert.icon}"></i></span>
                    <div>
                        <strong>${escapeHtml(alert.title)}</strong>
                        <span>${escapeHtml(alert.text)}</span>
                    </div>
                </div>
            `).join('');

            const updatedAt = document.getElementById('dashboard-updated-at');
            if (updatedAt) {
                updatedAt.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }

        function refreshDashboard() {
            updateDashboardSummary();
            showToast('Painel atualizado com os dados mais recentes.', 'success');
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');

            const styles = {
                success: 'bg-slate-900 text-white border-l-4 border-emerald-500',
                error: 'bg-slate-900 text-white border-l-4 border-red-500',
                info: 'bg-slate-900 text-white border-l-4 border-blue-500'
            };

            const icons = {
                success: 'fa-circle-check text-emerald-400',
                error: 'fa-circle-exclamation text-red-400',
                info: 'fa-circle-info text-blue-400'
            };

            toast.className = `${styles[type]} px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2.5 transition-all duration-300`;
            const icon = document.createElement('i');
            icon.className = `fa-solid ${icons[type]} text-sm`;
            const text = document.createElement('span');
            text.textContent = message;
            toast.append(icon, text);

            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px)';
                setTimeout(() => toast.remove(), 300);
            }, 3200);
        }

        // =========================================================================
        // 10. INICIALIZAÇÃO DO APLICATIVO
        // =========================================================================
        window.onload = function () {
            // Define data padrão de emissão no formulário da Aba 1
            document.getElementById('nf-date').value = getTodayStr(0);

            renderInvoicesList();
            populateMobileNfSelect();
            renderConferenceManagement();
            renderLabelsTab();
            updateBadges();
            switchTab('dashboard');
        };
