package pucp.edu.pe.tasfb2b.algorithms.ga;

import pucp.edu.pe.tasfb2b.entities.Vuelo;

@FunctionalInterface
public interface VueloOcurrenciaChecker {

    boolean disponible(Vuelo vuelo, int salidaMinuto);
}
