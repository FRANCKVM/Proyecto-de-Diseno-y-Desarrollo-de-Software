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
            "envio.simulacion",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
    })
    List<AsignacionEnvio> findByEnvio_IdEnvioOrderByIdAsignacionAsc(Integer idEnvio);

    @EntityGraph(attributePaths = {
            "envio",
            "envio.simulacion",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
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
            "envio.simulacion",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
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
            "envio.simulacion",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
    })
    @Query("""
            select distinct a
            from AsignacionEnvio a
            join a.ruta r
            join r.vuelos v
            where v.idVuelo = :idVuelo
            order by a.envio.idEnvio asc, a.idAsignacion asc
            """)
    List<AsignacionEnvio> findByVueloId(@Param("idVuelo") Integer idVuelo);

    @EntityGraph(attributePaths = {
            "envio",
            "envio.simulacion",
            "envio.origen",
            "envio.destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
    })
    @Query("""
            select distinct a
            from AsignacionEnvio a
            join a.ruta r
            join r.vuelos v
            where v.idVuelo in :idsVuelo
            order by a.envio.idEnvio asc, a.idAsignacion asc
            """)
    List<AsignacionEnvio> findByVueloIds(@Param("idsVuelo") List<Integer> idsVuelo);
}
