// Zone Manager - handles switching between shipping zones
import { ZONES, ZONE_ORDER, DEFAULT_ZONE } from './config.js';

class ZoneManager {
  constructor() {
    this.currentZoneId = DEFAULT_ZONE;
    this.onZoneChange = null;
  }

  get currentZone() {
    return ZONES[this.currentZoneId];
  }

  get currentIndex() {
    return ZONE_ORDER.indexOf(this.currentZoneId);
  }

  canGoNext() {
    return this.currentIndex < ZONE_ORDER.length - 1;
  }

  canGoPrev() {
    return this.currentIndex > 0;
  }

  goNext() {
    if (this.canGoNext()) {
      this.setZone(ZONE_ORDER[this.currentIndex + 1]);
    }
  }

  goPrev() {
    if (this.canGoPrev()) {
      this.setZone(ZONE_ORDER[this.currentIndex - 1]);
    }
  }

  setZone(zoneId) {
    if (zoneId === this.currentZoneId) return;
    if (!ZONES[zoneId]) return;

    const prevZone = ZONES[this.currentZoneId];
    this.currentZoneId = zoneId;

    if (this.onZoneChange) {
      this.onZoneChange(this.currentZone, prevZone);
    }
  }
}

export const zoneManager = new ZoneManager();
