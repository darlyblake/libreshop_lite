// Mock for @maplibre/maplibre-react-native on web
// This file is used only on web platform to prevent build errors

module.exports = {
  MapView: () => null,
  Camera: () => null,
  PointAnnotation: () => null,
  Marker: () => null,
  Callout: () => null,
  ShapeSource: () => null,
  FillLayer: () => null,
  LineLayer: () => null,
  CircleLayer: () => null,
  SymbolLayer: () => null,
  RasterLayer: () => null,
  HeatmapLayer: () => null,
  Images: () => null,
  UserLocation: () => null,
  styleURL: {},
  offlineManager: {},
  requestUrl: () => {},
  connect: () => {},
  disconnect: () => {},
};
