package pucp.edu.pe.tasfb2b.entities;

import java.util.*;

public class Grafo {
    private final Map<Aeropuerto, List<VueloOcurrencia>> adyacencia = new HashMap<>();

    public void agregarAeropuerto(Aeropuerto aeropuerto) {
        adyacencia.putIfAbsent(aeropuerto, new ArrayList<>());
    }

    public void agregarOcurrencia(VueloOcurrencia ocurrencia) {
        Vuelo vuelo = ocurrencia.getVuelo();
        agregarAeropuerto(vuelo.getDesde());
        agregarAeropuerto(vuelo.getHasta());
        adyacencia.get(vuelo.getDesde()).add(ocurrencia);
    }

    public List<VueloOcurrencia> getOcurrenciasSalientes(Aeropuerto aeropuerto) {
        return adyacencia.getOrDefault(aeropuerto, Collections.emptyList());
    }

    public Set<Aeropuerto> getAeropuertos() {
        return adyacencia.keySet();
    }
}
