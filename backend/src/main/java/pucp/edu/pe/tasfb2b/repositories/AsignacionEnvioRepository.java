package pucp.edu.pe.tasfb2b.repositories;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pucp.edu.pe.tasfb2b.entities.AsignacionEnvio;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;

import java.util.List;

@Repository
public interface AsignacionEnvioRepository extends JpaRepository<AsignacionEnvio, Integer> {

    @EntityGraph(attributePaths = {
            "envio",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.ocurrencias",
            "ruta.ocurrencias.vuelo",
            "ruta.ocurrencias.vuelo.desde",
            "ruta.ocurrencias.vuelo.hasta"
    })
    List<AsignacionEnvio> findByEnvio_IdEnvioOrderByIdAsignacionAsc(Integer idEnvio);

    @EntityGraph(attributePaths = {
            "envio",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.ocurrencias",
            "ruta.ocurrencias.vuelo",
            "ruta.ocurrencias.vuelo.desde",
            "ruta.ocurrencias.vuelo.hasta"
    })
    @Query("""
            select a
            from AsignacionEnvio a
            where a.envio in :envios
            order by a.envio.idEnvio asc, a.idAsignacion asc
            """)
    List<AsignacionEnvio> findByEnvioInOrderByEnvio_IdEnvioAscIdAsignacionAsc(@Param("envios") List<SolicitudEnvio> envios);

    @EntityGraph(attributePaths = {
            "envio",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.ocurrencias",
            "ruta.ocurrencias.vuelo",
            "ruta.ocurrencias.vuelo.desde",
            "ruta.ocurrencias.vuelo.hasta"
    })
    @Query("""
            select a
            from AsignacionEnvio a
            where a.envio.idEnvio in :idsEnvio
            order by a.envio.idEnvio asc, a.idAsignacion asc
            """)
    List<AsignacionEnvio> findByEnvioIds(@Param("idsEnvio") List<Integer> idsEnvio);

    void deleteByEnvio_IdEnvio(Integer idEnvio);

    @EntityGraph(attributePaths = {
            "envio",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.ocurrencias",
            "ruta.ocurrencias.vuelo",
            "ruta.ocurrencias.vuelo.desde",
            "ruta.ocurrencias.vuelo.hasta"
    })
    @Query("""
            select distinct a
            from AsignacionEnvio a
            join a.ruta r
            join r.ocurrencias o
            where o.idOcurrencia in :idsOcurrencia
            order by a.envio.idEnvio asc, a.idAsignacion asc
            """)
    List<AsignacionEnvio> findByOcurrenciaIds(@Param("idsOcurrencia") List<Long> idsOcurrencia);

    @Query("""
            select a.envio.origen.codigo, coalesce(sum(a.cantidadBolsas), 0)
            from AsignacionEnvio a
            where a.capacidadOrigenLiberada is null or a.capacidadOrigenLiberada = false
            group by a.envio.origen.codigo
            """)
    List<Object[]> sumarBolsasAsignadasPorOrigen();

    @EntityGraph(attributePaths = {
            "envio",
            "envio.origen",
            "ruta",
            "ruta.ocurrencias"
    })
    @Query("""
            select a
            from AsignacionEnvio a
            where a.capacidadOrigenLiberada is null or a.capacidadOrigenLiberada = false
            order by a.idAsignacion asc
            """)
    List<AsignacionEnvio> findPendientesLiberacionOrigen();
}
