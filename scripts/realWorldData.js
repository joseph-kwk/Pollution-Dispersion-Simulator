/**
 * Real-World Data Integration Module
 * Connects simulation with actual environmental and geographical data
 */

class RealWorldDataManager {
    constructor() {
        // Use window.__ENV__ if provided by hosting/bundler; fallback to placeholders
        const env = (typeof window !== 'undefined' && window.__ENV__) || {};
        this.apiKeys = {
            weather: env.VITE_OPENWEATHER_API_KEY || 'your_api_key_here',
            satellite: env.VITE_SATELLITE_API_KEY || 'your_api_key_here',
            water: env.VITE_WATER_QUALITY_API_KEY || 'your_api_key_here'
        };
        
        this.dataSources = {
            weather: 'https://api.openweathermap.org/data/2.5/weather',
            oceanCurrent: 'https://api.oceancurrent.noaa.gov/v1/currents',
            waterQuality: 'https://waterqualitydata.us/data',
            satellite: 'https://api.nasa.gov/planetary/earth/imagery',
            bathymetry: 'https://maps.ngdc.noaa.gov/viewers/bathymetry/',
            tides: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
        };
        
        this.locationData = null;
        this.environmentalData = null;
        this.historicalData = [];
    }
    
    // Geographic location setup
    async setLocation(latitude, longitude) {
        this.location = { latitude, longitude };
        
        try {
            // Load all relevant data for the location
            await Promise.all([
                this.loadWeatherData(),
                this.loadOceanCurrentData(),
                this.loadBathymetryData(),
                this.loadWaterQualityData(),
                this.loadSatelliteImagery()
            ]);
            
            console.log('Location data loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading location data:', error);
            return false;
        }
    }
    
    // Weather and atmospheric data
    async loadWeatherData() {
        const url = `${this.dataSources.weather}?lat=${this.location.latitude}&lon=${this.location.longitude}&appid=${this.apiKeys.weather}&units=metric`;
        
        try {
            if (!this.apiKeys.weather || this.apiKeys.weather === 'your_api_key_here') {
                console.warn('OpenWeather API key missing. Set VITE_OPENWEATHER_API_KEY in a .env file for live data. Using defaults.');
            }
            const response = await fetch(url);
            const data = await response.json();
            
            this.environmentalData = {
                ...this.environmentalData,
                weather: {
                    windSpeed: data.wind?.speed || 0,
                    windDirection: data.wind?.deg || 0,
                    temperature: data.main?.temp || 15,
                    pressure: data.main?.pressure || 1013,
                    humidity: data.main?.humidity || 50,
                    visibility: data.visibility || 10000,
                    clouds: data.clouds?.all || 0,
                    precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0
                }
            };
            
            return this.environmentalData.weather;
        } catch (error) {
            console.error('Error fetching weather data:', error);
            return this.getDefaultWeatherData();
        }
    }
    
    // Ocean and water current data
    async loadOceanCurrentData() {
        // For coastal simulations - get actual ocean current data
        const url = `${this.dataSources.oceanCurrent}?lat=${this.location.latitude}&lon=${this.location.longitude}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            this.environmentalData = {
                ...this.environmentalData,
                oceanCurrents: {
                    surfaceSpeed: data.surface?.speed || 0,
                    surfaceDirection: data.surface?.direction || 0,
                    deepSpeed: data.deep?.speed || 0,
                    deepDirection: data.deep?.direction || 0,
                    tideHeight: data.tide?.height || 0,
                    tideDirection: data.tide?.direction || 'rising'
                }
            };
            
            return this.environmentalData.oceanCurrents;
        } catch (error) {
            console.error('Error fetching ocean current data:', error);
            return this.getDefaultOceanData();
        }
    }
    
    // Bathymetry and topography
    async loadBathymetryData() {
        // Get water depth and bottom topography
        try {
            const bathymetryGrid = await this.fetchBathymetryGrid();
            
            this.environmentalData = {
                ...this.environmentalData,
                bathymetry: bathymetryGrid,
                topography: this.extractTopographicFeatures(bathymetryGrid)
            };
            
            return this.environmentalData.bathymetry;
        } catch (error) {
            console.error('Error fetching bathymetry data:', error);
            return this.generateDefaultBathymetry();
        }
    }
    
    // Water quality baseline data
    async loadWaterQualityData() {
        const url = `${this.dataSources.waterQuality}?lat=${this.location.latitude}&lon=${this.location.longitude}&characteristicName=Temperature,water&mimeType=json`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            this.environmentalData = {
                ...this.environmentalData,
                waterQuality: {
                    baselineTemperature: this.extractBaselineValue(data, 'Temperature'),
                    baselineSalinity: this.extractBaselineValue(data, 'Salinity'),
                    baselineOxygen: this.extractBaselineValue(data, 'Dissolved oxygen'),
                    baselinepH: this.extractBaselineValue(data, 'pH'),
                    baseTurbidity: this.extractBaselineValue(data, 'Turbidity')
                }
            };
            
            return this.environmentalData.waterQuality;
        } catch (error) {
            console.error('Error fetching water quality data:', error);
            return this.getDefaultWaterQuality();
        }
    }
    
    // Satellite imagery for visual reference
    async loadSatelliteImagery() {
    const url = `${this.dataSources.satellite}?lon=${this.location.longitude}&lat=${this.location.latitude}&date=2024-01-01&dim=0.5&api_key=${this.apiKeys.satellite}`;
        
        try {
            const response = await fetch(url);
            if (response.ok) {
                const imageBlob = await response.blob();
                const imageUrl = URL.createObjectURL(imageBlob);
                
                this.environmentalData = {
                    ...this.environmentalData,
                    satelliteImage: imageUrl
                };
                
                return imageUrl;
            }
        } catch (error) {
            console.error('Error fetching satellite imagery:', error);
        }
        
        return null;
    }
    
    // Real pollution incident data
    async loadPollutionIncidents() {
        // Get historical pollution incidents in the area
        try {
            const incidents = await this.fetchPollutionIncidents();
            
            this.historicalData = incidents.map(incident => ({
                type: incident.pollutantType,
                location: { lat: incident.latitude, lon: incident.longitude },
                magnitude: incident.volume || incident.concentration,
                date: new Date(incident.date),
                duration: incident.duration,
                source: incident.source,
                weatherConditions: incident.weather
            }));
            
            return this.historicalData;
        } catch (error) {
            console.error('Error fetching pollution incidents:', error);
            return [];
        }
    }
    
    // Environmental monitoring stations
    async loadMonitoringStations() {
        // Get real-time data from environmental monitoring stations
        const stations = await this.fetchNearbyStations();
        
        const realTimeData = await Promise.all(
            stations.map(station => this.fetchStationData(station.id))
        );
        
        return realTimeData;
    }
    
    // Predictive weather data
    async loadWeatherForecast() {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${this.location.latitude}&lon=${this.location.longitude}&appid=${this.apiKeys.weather}&units=metric`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            return data.list.map(item => ({
                time: new Date(item.dt * 1000),
                windSpeed: item.wind?.speed || 0,
                windDirection: item.wind?.deg || 0,
                temperature: item.main?.temp || 15,
                precipitation: item.rain?.['3h'] || 0
            }));
        } catch (error) {
            console.error('Error fetching weather forecast:', error);
            return [];
        }
    }
    
    // Validation against real incidents
    validateSimulation(simulationResults) {
        if (this.historicalData.length === 0) {
            return { validated: false, reason: 'No historical data available' };
        }
        
        // Compare simulation with similar historical incidents
        const similarIncidents = this.findSimilarIncidents(simulationResults.parameters);
        
        if (similarIncidents.length === 0) {
            return { validated: false, reason: 'No similar historical incidents found' };
        }
        
        // Statistical comparison
        const validation = this.performStatisticalValidation(simulationResults, similarIncidents);
        
        return validation;
    }
    
    // Helper methods
    extractBaselineValue(data, parameter) {
        const measurements = data.results?.filter(result => 
            result.CharacteristicName === parameter
        ) || [];
        
        if (measurements.length === 0) return null;
        
        const values = measurements.map(m => parseFloat(m.ResultMeasureValue)).filter(v => !isNaN(v));
        return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : null;
    }
    
    generateDefaultBathymetry() {
        // Generate realistic bathymetry based on location type
        const gridSize = 80;
        const bathymetry = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
        
        // Add realistic depth variations
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                // Create gentle depth gradient with some variation
                const depth = -5 - (i / gridSize) * 20 + Math.sin(i / 10) * 2 + Math.cos(j / 8) * 1.5;
                bathymetry[i][j] = Math.max(-50, depth); // Max depth 50m
            }
        }
        
        return bathymetry;
    }
    
    getDefaultWeatherData() {
        return {
            windSpeed: 3.5,
            windDirection: 225,
            temperature: 18,
            pressure: 1013,
            humidity: 65,
            visibility: 10000,
            clouds: 30,
            precipitation: 0
        };
    }
    
    getDefaultOceanData() {
        return {
            surfaceSpeed: 0.2,
            surfaceDirection: 180,
            deepSpeed: 0.1,
            deepDirection: 190,
            tideHeight: 0.5,
            tideDirection: 'rising'
        };
    }
    
    getDefaultWaterQuality() {
        return {
            baselineTemperature: 18,
            baselineSalinity: 35,
            baselineOxygen: 8.5,
            baselinepH: 7.8,
            baseTurbidity: 2.1
        };
    }
    
    // Export processed data for simulation
    getEnvironmentalParameters() {
        if (!this.environmentalData) {
            console.warn('No environmental data loaded, using defaults');
            return this.getDefaultEnvironmentalParameters();
        }
        
        return {
            weather: this.environmentalData.weather,
            oceanCurrents: this.environmentalData.oceanCurrents,
            bathymetry: this.environmentalData.bathymetry,
            waterQuality: this.environmentalData.waterQuality,
            location: this.location
        };
    }
    
    getDefaultEnvironmentalParameters() {
        return {
            weather: this.getDefaultWeatherData(),
            oceanCurrents: this.getDefaultOceanData(),
            waterQuality: this.getDefaultWaterQuality(),
            bathymetry: this.generateDefaultBathymetry(),
            location: { latitude: 40.7128, longitude: -74.0060 } // NYC default
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealWorldDataManager;
} else {
    window.RealWorldDataManager = RealWorldDataManager;
}
