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
            inverseJoinColumns = @JoinColumn(name = "id_ocurrencia")
    )
    @OrderColumn(name = "orden")
    private List<VueloOcurrencia> ocurrencias = new ArrayList<>();

    @Column(name = "tiempo_total", nullable = false)
    private Double tiempoTotal = 0.0;

    @Column(name = "costo", nullable = false)
    private Double costo = 999999.9999;

    @Column(name = "factible", nullable = false)
    private Boolean factible = false;

    public Ruta() {
    }

    public Ruta(Ruta otro) {
        this.ocurrencias = new ArrayList<>(otro.ocurrencias);
        this.tiempoTotal = otro.tiempoTotal;
        this.costo = otro.costo;
        this.factible = otro.factible;
    }

    public Integer getIdRuta() { return idRuta; }
    public void setIdRuta(Integer idRuta) { this.idRuta = idRuta; }
    public List<VueloOcurrencia> getOcurrencias() { return ocurrencias; }
    public void setOcurrencias(List<VueloOcurrencia> ocurrencias) {
        this.ocurrencias = ocurrencias != null ? ocurrencias : new ArrayList<>();
    }
    public Double getTiempoTotal() { return tiempoTotal; }
    public void setTiempoTotal(Double tiempoTotal) { this.tiempoTotal = tiempoTotal; }
    public Double getCosto() { return costo; }
    public void setCosto(Double costo) { this.costo = costo; }
    public Boolean getFactible() { return factible; }
    public void setFactible(Boolean factible) { this.factible = factible; }
    public boolean esFactible() { return Boolean.TRUE.equals(factible); }

    public void agregarOcurrencia(VueloOcurrencia ocurrencia) {
        agregarOcurrencia(ocurrencia, ocurrencia.getVuelo().getTiempoViajarDias());
    }

    public void agregarOcurrencia(VueloOcurrencia ocurrencia, double incrementoDias) {
        if (ocurrencia == null) {
            throw new IllegalArgumentException("La ocurrencia no puede ser null");
        }
        ocurrencias.add(ocurrencia);
        tiempoTotal = (tiempoTotal != null ? tiempoTotal : 0.0) + incrementoDias;
    }

    public void evaluar(SolicitudEnvio solicitud) {
        boolean valido = !ocurrencias.isEmpty();
        Aeropuerto actual = solicitud.getOrigen();
        double penalizacion = 0;

        for (VueloOcurrencia ocurrencia : ocurrencias) {
            Vuelo vuelo = ocurrencia.getVuelo();
            if (!vuelo.getDesde().equals(actual)) {
                penalizacion += 5000;
                valido = false;
            }
            if (!ocurrencia.tieneCapacidad(solicitud.getContarBolsas())) {
                penalizacion += 10000;
                valido = false;
            }
            actual = vuelo.getHasta();
        }

        if (!actual.equals(solicitud.getDestino())) {
            penalizacion += 7000;
            valido = false;
        }
        if (tiempoTotal > solicitud.getDiasTiempoMaximo()) {
            penalizacion += (tiempoTotal - solicitud.getDiasTiempoMaximo()) * 1000;
            valido = false;
        }

        double penalizacionSaltos = ocurrencias.size() * 0.03;
        this.factible = valido;
        this.costo = valido
                ? tiempoTotal + penalizacionSaltos
                : tiempoTotal + penalizacionSaltos + penalizacion;
    }

    public void reservarCapacidad(Integer bolsas) {
        ocurrencias.forEach(ocurrencia -> ocurrencia.reservar(bolsas));
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (VueloOcurrencia ocurrencia : ocurrencias) {
            Vuelo vuelo = ocurrencia.getVuelo();
            sb.append(vuelo.getDesde().getCodigo())
                    .append(" -> ")
                    .append(vuelo.getHasta().getCodigo())
                    .append(" @ ")
                    .append(ocurrencia.getFechaHoraSalida())
                    .append("\n");
        }
        sb.append("Tiempo total: ").append(tiempoTotal).append(" días\n");
        sb.append("Cantidad de vuelos: ").append(ocurrencias.size()).append("\n");
        sb.append("Factible: ").append(factible).append("\n");
        sb.append("Costo: ").append(costo).append("\n");
        return sb.toString();
    }
}
