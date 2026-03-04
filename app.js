/**
 * Transformer Digital Twin - Core Logic & UI Controller
 */

class TransformerEngine {
    constructor() {
        this.inputs = {};
        this.results = {};
        this.isPractical = false;
    }

    updateInputs(data) {
        this.inputs = data;
        this.calculate();
    }

    calculate() {
        const { vp, vs, ip, is, np, ns, zl, phi, rw, xm } = this.inputs;
        const res = {};

        // 1. Transformation Ratio (a)
        // a = Vp/Vs = Np/Ns = Is/Ip
        if (vp && vs) res.ratio = vp / vs;
        else if (np && ns) res.ratio = np / ns;
        else if (is && ip) res.ratio = is / ip;

        const a = res.ratio;

        // 2. Infer missing basic values if possible
        if (!vp && vs && a) res.vp = vs * a;
        if (!vs && vp && a) res.vs = vp / a;
        if (!ip && is && a) res.ip = is / a;
        if (!is && ip && a) res.is = ip * a;
        if (!np && ns && a) res.np = ns * a;
        if (!ns && np && a) res.ns = np / a;

        // Effective values for further calculation
        const Vp = vp || res.vp;
        const Vs = vs || res.vs;
        const Ip = ip || res.ip;
        const Is = is || res.is;
        const Phi = phi || 0;
        const rad = (Phi * Math.PI) / 180;

        // 3. Power Calculations
        if (Vs && Is) {
            res.powerOut = Vs * Is * Math.cos(rad);
            res.apparentPower = Vs * Is;
        }

        // 4. Impedance
        if (zl) {
            res.zl = zl;
            if (a) res.reflectedZ = zl * Math.pow(a, 2);
        } else if (Vs && Is) {
            res.zl = Vs / Is;
            if (a) res.reflectedZ = res.zl * Math.pow(a, 2);
        }

        // 5. Practical Model (Losses)
        if (this.isPractical) {
            // Simple model: resistive loss and magnetizing current
            const copperLoss = (Ip * Ip * (rw || 0)) + (Is * Is * (rw || 0) / (a * a || 1));
            const magnetizingCurrent = Vp / (xm || Infinity);

            res.pin = (res.powerOut || 0) + copperLoss;
            res.efficiency = res.pin > 0 ? (res.powerOut / res.pin) * 100 : 100;
            res.magCurrent = magnetizingCurrent;
            res.voltageReg = rw ? (copperLoss / (res.powerOut || 1)) * 100 : 0; // Simplified proxy
        } else {
            res.efficiency = 100;
            res.voltageReg = 0;
            res.pin = res.powerOut;
        }

        this.results = res;
    }
}

/**
 * Firebase Integration Handler
 */
class FirebaseHandler {
    constructor(onUpdate, onError) {
        this.app = null;
        this.db = null;
        this.onUpdate = onUpdate;
        this.onError = onError;
        this.isStreaming = false;
        this.credentials = null;
    }

    async init(credentials) {
        this.credentials = credentials;
        try {
            // Use compat for easier dynamic script injection if module imports are restricted by CORS/Protocol
            if (!window.firebase) {
                await this.loadScripts();
            }

            const firebaseConfig = {
                apiKey: credentials.apiKey,
                projectId: credentials.projectId,
                databaseURL: credentials.databaseURL,
            };

            // Use the compat API for easier dynamic initialization in non-build environments
            if (!this.app) {
                this.app = firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.database(this.app);

            this.startListening(credentials.databasePath || '/');
            this.isStreaming = true;
            return true;
        } catch (error) {
            console.error("Firebase Init Error:", error);
            this.onError(`Connection failed: ${error.message}`);
            return false;
        }
    }

    loadScripts() {
        return new Promise((resolve, reject) => {
            const scripts = [
                'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js'
            ];
            let loaded = 0;
            scripts.forEach(src => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    loaded++;
                    if (loaded === scripts.length) resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        });
    }

    startListening(path) {
        const dbRef = this.db.ref(path);
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (this.validateSchema(data)) {
                    this.onUpdate(data);
                } else {
                    this.onError("Schema validation failed. Check README for requirements.");
                }
            }
        }, (error) => {
            this.onError(`Database error: ${error.message}`);
        });
    }

    validateSchema(data) {
        if (!data || typeof data !== 'object') return false;

        const validKeys = ['vp', 'vs', 'ip', 'is', 'np', 'ns', 'zl', 'phi', 'rw', 'xm'];
        const incomingKeys = Object.keys(data);

        // Basic check: at least one valid transformer key must exist
        const hasValidKey = incomingKeys.some(k => validKeys.includes(k));

        // Ensure all provided matching keys can be parsed as numbers
        const allValid = incomingKeys
            .filter(k => validKeys.includes(k))
            .every(k => !isNaN(parseFloat(data[k])));

        return hasValidKey && allValid;
    }

    disconnect() {
        this.isStreaming = false;
        if (this.db && this.credentials) {
            this.db.ref(this.credentials.databasePath || '/').off();
        }
        this.credentials = null;
    }
}

// UI Controller
const UI = {
    engine: new TransformerEngine(),
    chart: null,

    init() {
        this.inputs = document.querySelectorAll('.panel.editor input[type="number"]');
        this.practicalToggle = document.getElementById('practical-model-toggle');
        this.realtimeToggle = document.getElementById('realtime-toggle');
        this.practicalInputs = document.getElementById('practical-inputs');
        this.resetBtn = document.getElementById('reset-btn');
        this.statusText = document.getElementById('status-text');

        // Realtime UI Elements
        this.modal = document.getElementById('credential-modal');
        this.closeModalBtn = document.getElementById('close-modal');
        this.connectBtn = document.getElementById('connect-fb-btn');
        this.fbHandler = null;

        this.setupEventListeners();
        this.initChart();
        this.update();
    },

    setupEventListeners() {
        this.inputs.forEach(input => {
            input.addEventListener('input', () => {
                if (input.value < 0 && input.id !== 'phi') {
                    input.value = 0;
                    this.notify('Negative values not allowed', 'error');
                }
                this.update();
            });
        });

        this.practicalToggle.addEventListener('change', (e) => {
            this.engine.isPractical = e.target.checked;
            this.practicalInputs.classList.toggle('hidden', !e.target.checked);
            document.getElementById('model-badge').textContent = e.target.checked ? 'Practical Model' : 'Ideal Model';
            document.getElementById('model-badge').className = `badge ${e.target.checked ? 'practical' : 'ideal'}`;
            this.update();
        });

        this.resetBtn.addEventListener('click', () => {
            this.inputs.forEach(i => i.value = '');
            this.update();
        });

        // Realtime Logic
        this.realtimeToggle.addEventListener('change', (e) => {
            const labels = document.querySelectorAll('.mode-label');
            labels[0].classList.toggle('mode-active', !e.target.checked);
            labels[1].classList.toggle('mode-active', e.target.checked);

            if (e.target.checked) {
                this.modal.classList.remove('hidden');
            } else {
                if (this.fbHandler) {
                    this.fbHandler.disconnect();
                    this.fbHandler = null;
                }
                this.setStatus('Manual Mode Active', 'ok');
                this.update(); // Revert to manual inputs
            }
        });

        // Initialize mode labels
        const labels = document.querySelectorAll('.mode-label');
        if (labels.length >= 2) {
            labels[0].classList.add('mode-active');
        }

        this.closeModalBtn.addEventListener('click', () => {
            this.modal.classList.add('hidden');
            this.realtimeToggle.checked = false;
        });

        this.connectBtn.addEventListener('click', async () => {
            const credentials = {
                apiKey: document.getElementById('fb-api-key').value.trim(),
                projectId: document.getElementById('fb-project-id').value.trim(),
                databaseURL: document.getElementById('fb-db-url').value.trim(),
                databasePath: document.getElementById('fb-db-path').value.trim()
            };

            if (!credentials.apiKey || !credentials.projectId || !credentials.databaseURL) {
                this.setStatus('API Key, Project ID, and URL are required', 'error');
                return;
            }

            this.setStatus('Initializing Firebase...', 'warn');

            if (!this.fbHandler) {
                this.fbHandler = new FirebaseHandler(
                    (data) => this.handleRealtimeUpdate(data),
                    (err) => {
                        this.setStatus(err, 'error');
                        this.notify(err, 'error'); // Trigger popup
                    }
                );
            }

            const success = await this.fbHandler.init(credentials);
            if (success) {
                this.modal.classList.add('hidden');
                this.setStatus('Realtime Sync Active', 'ok');
            } else {
                this.realtimeToggle.checked = false;
            }
        });
    },

    handleRealtimeUpdate(data) {
        // Map data to inputs and update engine
        const numericData = {};
        Object.entries(data).forEach(([key, val]) => {
            if (!isNaN(parseFloat(val))) {
                numericData[key] = parseFloat(val);

                // Reflect in UI for feedback
                const input = document.getElementById(key);
                if (input) input.placeholder = val;
            }
        });

        this.engine.updateInputs(numericData);
        this.renderResults();
        this.updateChart();
    },

    update() {
        const data = {};
        this.inputs.forEach(input => {
            if (input.value !== '') data[input.id] = parseFloat(input.value);
        });

        this.engine.updateInputs(data);
        this.renderResults();
        this.updateChart();
        this.checkRequirements(data);
    },

    renderResults() {
        const res = this.engine.results;

        const setVal = (id, val, suffix = '', decimals = 2) => {
            const el = document.getElementById(id);
            if (val !== undefined && !isNaN(val)) {
                el.textContent = typeof val === 'number' ? val.toFixed(decimals) : val;
            } else {
                el.textContent = '--';
            }
        };

        setVal('res-ratio', res.ratio);
        setVal('res-power', res.powerOut);
        setVal('res-efficiency', res.efficiency);
        setVal('res-reflected', res.reflectedZ);

        // Update secondary values if inferred
        if (res.vs && !document.getElementById('vs').value) document.getElementById('vs').placeholder = `(${res.vs.toFixed(1)})`;
        if (res.is && !document.getElementById('is').value) document.getElementById('is').placeholder = `(${res.is.toFixed(1)})`;
    },

    checkRequirements(data) {
        if (!data.vp && !data.vs && !data.np && !data.ns) {
            this.setStatus('Waiting for primary/secondary parameters...', 'warn');
        } else {
            this.setStatus('Live Simulation Active', 'ok');
        }
    },

    setStatus(msg, type) {
        this.statusText.textContent = msg;
        const dot = document.querySelector('.status-dot');
        dot.style.background = type === 'warn' ? '#ffaa00' : (type === 'error' ? '#ff4444' : '#39ff14');
        dot.style.boxShadow = `0 0 8px ${dot.style.background}`;
    },

    notify(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    initChart() {
        const ctx = document.getElementById('balanceChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Voltage (V)', 'Current (A)', 'Turns'],
                datasets: [{
                    label: 'Primary',
                    data: [0, 0, 0],
                    backgroundColor: 'rgba(88, 166, 255, 0.6)',
                    borderColor: '#58a6ff',
                    borderWidth: 1
                }, {
                    label: 'Secondary',
                    data: [0, 0, 0],
                    backgroundColor: 'rgba(0, 210, 255, 0.6)',
                    borderColor: '#00d2ff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#8b949e' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e6edf3' } }
                }
            }
        });
    },

    updateChart() {
        const input = this.engine.inputs;
        const res = this.engine.results;

        const vp = input.vp || res.vp || 0;
        const vs = input.vs || res.vs || 0;
        const ip = input.ip || res.ip || 0;
        const is = input.is || res.is || 0;
        const np = input.np || res.np || 0;
        const ns = input.ns || res.ns || 0;

        this.chart.data.datasets[0].data = [vp, ip, np / 10]; // Scale turns for vis
        this.chart.data.datasets[1].data = [vs, is, ns / 10];
        this.chart.update('none');
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());
