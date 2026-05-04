package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ruta")
public class Ruta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ruta")
    private Integer idRuta;

    @ManyToMany
    @JoinTable(
            name = "ruta_vuelo",
            joinColumns = @JoinColumn(name = "id_ruta"),
            inverseJoinColumns = @JoinColumn(name = "id_vuelo")
    )
    @OrderColumn(name = "orden")
    private List<Vuelo> vuelos = new ArrayList<>();

    @Column(name = "tiempo_total", nullable = false)
    private Double tiempoTotal = 0.0;

    @Column(name = "costo", nullable = false)
    private Double costo = 999999.9999;

    @Column(name = "factible", nullable = false)
    private Boolean factible = false;

    public Ruta() {
    }

    public Ruta(Ruta otro) {
        this.vuelos = new ArrayList<>(otro.vuelos);
        this.tiempoTotal = otro.tiempoTotal;
        this.costo = otro.costo;
        this.factible = otro.factible;
    }

    public Integer getIdRuta() {
        return idRuta;
    }

    public void setIdRuta(Integer idRuta) {
        this.idRuta = idRuta;
    }

    public List<Vuelo> getVuelos() {
        return vuelos;
    }

    public void setVuelos(List<Vuelo> vuelos) {
        this.vuelos = vuelos;
    }

    public Double getTiempoTotal() {
        return tiempoTotal;
    }

    public void setTiempoTotal(Double tiempoTotal) {
        this.tiempoTotal = tiempoTotal;
    }

    public Double getCosto() {
        return costo;
    }

    public void setCosto(Double costo) {
        this.costo = costo;
    }

    public Boolean getFactible() {
        return factible;
    }

    public void setFactible(Boolean factible) {
        this.factible = factible;
    }

    public boolean esFactible() {
        return Boolean.TRUE.equals(factible);
    }

    public void agregarVuelo(Vuelo vuelo) {
        if (vuelo == null) {
            throw new IllegalArgumentException("El vuelo no puede ser null");
        }

        vuelos.add(vuelo);

        if (tiempoTotal == null) {
            tiempoTotal = 0.0;
        }

        tiempoTotal += vuelo.getTiempoViajarDias();
    }

    public void agregarVuelo(Vuelo vuelo, double incrementoDias) {
        if (vuelo == null) {
            throw new IllegalArgumentException("El vuelo no puede ser null");
        }

        vuelos.add(vuelo);

        if (tiempoTotal == null) {
            tiempoTotal = 0.0;
        }

        tiempoTotal += incrementoDias;
    }

    public void evaluar(SolicitudEnvio solicitud) {
        boolean valido = !vuelos.isEmpty();

        Aeropuerto actual = solicitud.getOrigen();
        double penalizacion = 0;

        for (Vuelo v : vuelos) {
            if (!v.getDesde().equals(actual)) {
                penalizacion += 5000;
                valido = false;
            }

            if (!v.tieneCapacidad(solicitud.getContarBolsas())) {
                penalizacion += 10000;
                valido = false;
            }

            actual = v.getHasta();
        }

        if (!actual.equals(solicitud.getDestino())) {
            penalizacion += 7000;
            valido = false;
        }

        if (tiempoTotal > solicitud.getDiasTiempoMaximo()) {
            penalizacion += (tiempoTotal - solicitud.getDiasTiempoMaximo()) * 1000;
            valido = false;
        }

        double penalizacionSaltos = vuelos.size() * 0.03;

        this.factible = valido;

        if (valido) {
            costo = tiempoTotal + penalizacionSaltos;
        } else {
            costo = tiempoTotal + penalizacionSaltos + penalizacion;
        }
    }

    public void reservarCapacidad(Integer bolsas) {
        for (Vuelo v : vuelos) {
            v.reservar(bolsas);
        }
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();

        for (Vuelo v : vuelos) {
            sb.append(v.getDesde().getCodigo())
                    .append(" -> ")
                    .append(v.getHasta().getCodigo())
                    .append("\n");
        }

        sb.append("Tiempo total: ").append(tiempoTotal).append(" días\n");
        sb.append("Cantidad de vuelos: ").append(vuelos.size()).append("\n");
        sb.append("Factible: ").append(factible).append("\n");
        sb.append("Costo: ").append(costo).append("\n");

        return sb.toString();
    }
}