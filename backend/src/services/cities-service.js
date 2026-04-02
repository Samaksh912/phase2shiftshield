class CitiesService {
  constructor({ dataStore }) {
    this.dataStore = dataStore;
  }

  async listCities() {
    const [cities, zones] = await Promise.all([
      this.dataStore.listCities(),
      this.dataStore.listZones()
    ]);

    const zonesByCityId = new Map();
    for (const zone of zones) {
      if (!zonesByCityId.has(zone.city_id)) {
        zonesByCityId.set(zone.city_id, []);
      }
      zonesByCityId.get(zone.city_id).push({
        id: zone.id,
        name: zone.name,
        city_id: zone.city_id,
        city_tier: zone.city_tier || zone.tier || null,
        risk_class: zone.risk_class
      });
    }

    return {
      cities: cities.map((city) => ({
        ...city,
        zones: (zonesByCityId.get(city.id) || []).sort((left, right) => left.name.localeCompare(right.name))
      }))
    };
  }
}

module.exports = {
  CitiesService
};
