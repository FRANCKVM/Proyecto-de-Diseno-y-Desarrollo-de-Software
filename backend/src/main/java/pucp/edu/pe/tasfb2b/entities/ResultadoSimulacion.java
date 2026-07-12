package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "resultado_simulacion")
public class ResultadoSimulacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_resultado")
    private Integer idResultado;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "id_simulacion", nullable = false, unique = true)
    private Simulacion simulacion;

    @Lob
    @Column(name = "resultado_periodo_json", nullable = false, columnDefinition = "LONGTEXT")
    private String resultadoPeriodoJson;

    @Lob
    @Column(name = "resultado_colapso_json", nullable = false, columnDefinition = "LONGTEXT")
    private String resultadoColapsoJson;

    public ResultadoSimulacion() {}

    public ResultadoSimulacion(Simulacion simulacion, String periodo, String colapso) {
        this.simulacion = simulacion;
        this.resultadoPeriodoJson = periodo;
        this.resultadoColapsoJson = colapso;
    }

    public Integer getIdResultado() { return idResultado; }
    public Simulacion getSimulacion() { return simulacion; }
    public String getResultadoPeriodoJson() { return resultadoPeriodoJson; }
    public String getResultadoColapsoJson() { return resultadoColapsoJson; }
    public void setResultadoPeriodoJson(String value) { this.resultadoPeriodoJson = value; }
    public void setResultadoColapsoJson(String value) { this.resultadoColapsoJson = value; }
}
