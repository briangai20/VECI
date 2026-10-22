// Centro de cada zona, para buscar comercios cuando el comprador no comparte
// su ubicación. Los ids coinciden con la tabla public.zonas.
export const CENTROS: Record<string, { lat: number; lng: number }> = {
  escobar: { lat: -34.3487, lng: -58.7973 },
  pacheco: { lat: -34.4547, lng: -58.6481 },
  tigre: { lat: -34.426, lng: -58.5797 },
  olivos: { lat: -34.5106, lng: -58.4964 },
  urquiza: { lat: -34.5733, lng: -58.487 },
  pilar: { lat: -34.4587, lng: -58.9142 },
};

export const ZONA_INICIAL = "escobar";
export const RADIO_INICIAL = 5;
