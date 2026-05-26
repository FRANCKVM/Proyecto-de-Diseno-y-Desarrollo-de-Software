package pucp.edu.pe.tasfb2b.repositories;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;

@Repository
public interface SolicitudEnvioRepository extends JpaRepository<SolicitudEnvio, Integer> {

    List<SolicitudEnvio> findByOrigen_Codigo(String codigo);

    List<SolicitudEnvio> findByDestino_Codigo(String codigo);

    List<SolicitudEnvio> findByFecha(LocalDate fecha);

    List<SolicitudEnvio> findByIdCliente(Integer idCliente);

    List<SolicitudEnvio> findByRuta_IdRuta(Integer idRuta);

    List<SolicitudEnvio> findByEstado(EstadoEnvio estado);

    @EntityGraph(attributePaths = {
            "simulacion",
            "origen",
            "destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
    })
    List<SolicitudEnvio> findBySimulacion_IdSimulacionOrderByIdEnvioAsc(Integer idSimulacion);

    List<SolicitudEnvio> findBySimulacionIsNullOrderByIdEnvioAsc();

    @EntityGraph(attributePaths = {
            "simulacion",
            "origen",
            "destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
    })
    @Query("""
            select s
            from SolicitudEnvio s
            where s.simulacion is not null
            order by s.simulacion.idSimulacion asc, s.idEnvio asc
            """)
    List<SolicitudEnvio> findAllConRelacionesDeSimulacion();

    @Query("""
            select distinct s
            from SolicitudEnvio s
            join s.ruta r
            join r.vuelos v
            where v.idVuelo = :idVuelo
            order by s.idEnvio asc
            """)
    List<SolicitudEnvio> findByVueloId(@Param("idVuelo") Integer idVuelo);

    @EntityGraph(attributePaths = {
            "simulacion",
            "origen",
            "destino",
            "ruta",
            "ruta.vuelos",
            "ruta.vuelos.desde",
            "ruta.vuelos.hasta"
    })
    @Query("""
            select distinct s
            from SolicitudEnvio s
            join s.ruta r
            join r.vuelos v
            where v.idVuelo in :idsVuelo
            order by s.idEnvio asc
            """)
    List<SolicitudEnvio> findByVueloIds(@Param("idsVuelo") List<Integer> idsVuelo);
}
