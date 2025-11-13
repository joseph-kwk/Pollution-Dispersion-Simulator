/**
 * Scenario and Source Manager
 * - Provides lightweight scenario save/load to localStorage
 * - Keeps current single-source model; future-ready for multi-source
 */

class ScenarioManager {
	constructor(storageKey = 'pds_scenarios') {
		this.storageKey = storageKey;
		this.scenarios = this._loadAll();
	}

	_loadAll() {
		try {
			const raw = localStorage.getItem(this.storageKey);
			return raw ? JSON.parse(raw) : {};
		} catch (e) {
			console.warn('Failed to load scenarios:', e);
			return {};
		}
	}

	_persist() {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(this.scenarios));
			return true;
		} catch (e) {
			console.warn('Failed to save scenarios:', e);
			return false;
		}
	}

	list() {
		return Object.keys(this.scenarios).sort();
	}

	get(name) {
		return this.scenarios[name] || null;
	}

	save(name, data) {
		if (!name || !data) return false;
		this.scenarios[name] = {
			version: (typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'),
			timestamp: Date.now(),
			data
		};
		return this._persist();
	}

	remove(name) {
		if (!this.scenarios[name]) return false;
		delete this.scenarios[name];
		return this._persist();
	}

	// Capture current UI/simulation state in a serializable object
	static captureCurrentState() {
		return {
			windDirection: window.windDirection || 0,
			windSpeed: window.windSpeed || 0.5,
			diffusionRate: window.diffusionRate || 0.1,
			releaseRate: window.releaseRate || 10,
			source: window.pollutionSource ? { ...window.pollutionSource } : null,
			gridSize: typeof GRID_SIZE !== 'undefined' ? GRID_SIZE : 80,
			obstacles: (window.obstacleMask || []).map(row => row.slice())
		};
	}

	// Apply a scenario state to the UI/simulation
	static applyState(state) {
		if (!state) return;

		// Update globals
		window.windDirection = state.windDirection;
		window.windSpeed = state.windSpeed;
		window.diffusionRate = state.diffusionRate;
		window.releaseRate = state.releaseRate;
		if (state.source) {
			window.pollutionSource = { ...state.source };
		}

		// Sync controls if present
		const sync = (id, value, formatter) => {
			const el = document.getElementById(id);
			if (el) el.value = value;
			const label = document.getElementById(id + 'Value');
			if (label) label.textContent = formatter ? formatter(value) : value;
		};
		sync('windDirection', state.windDirection, v => `${parseInt(v, 10)}°`);
		sync('windSpeed', state.windSpeed, v => Number(v).toFixed(1));
		sync('diffusionRate', state.diffusionRate, v => Number(v).toFixed(2));
		sync('releaseRate', state.releaseRate, v => parseInt(v, 10));

		const typeSelect = document.getElementById('pollutionTypeSelect');
		if (typeSelect && state.source?.type) {
			typeSelect.value = state.source.type;
		}

		// Restore obstacles if provided
		if (Array.isArray(state.obstacles) && state.obstacles.length) {
			// Recreate obstacleMask to avoid stale references
			window.obstacleMask = state.obstacles.map(row => row.slice());
			window.obstaclesDirty = true;
		}

		if (typeof window.draw === 'function') window.draw();
	}
}

// Export
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { ScenarioManager };
} else {
	window.ScenarioManager = ScenarioManager;
}
