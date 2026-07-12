package pucp.edu.pe.tasfb2b.repositories;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface VueloOcurrenciaRepository extends JpaRepository<VueloOcurrencia, Long> {

    Optional<VueloOcurrencia> findByVuelo_IdVueloAndFechaHoraSalida(Integer idVuelo, LocalDateTime fechaHoraSalida);

    boolean existsByVuelo_IdVueloAndFechaHoraSalida(Integer idVuelo, LocalDateTime fechaHoraSalida);

    @EntityGraph(attributePaths = {"vuelo", "vuelo.desde", "vuelo.hasta"})
    List<VueloOcurrencia> findByFechaHoraSalidaGreaterThanEqualAndFechaHoraSalidaLessThan(
            LocalDateTime desde,
            LocalDateTime hasta
    );

    @EntityGraph(attributePaths = {"vuelo", "vuelo.desde", "vuelo.hasta"})
    @Query("""
            select o from VueloOcurrencia o
            where (o.vuelo.desde.codigo = :icao or o.vuelo.hasta.codigo = :icao)
              and o.fechaHoraSalida >= :desde
              and o.fechaHoraSalida < :hasta
            order by o.fechaHoraSalida asc, o.idOcurrencia asc
            """)
    List<VueloOcurrencia> findConectadasPorAeropuerto(
            @Param("icao") String icao,
            @Param("desde") LocalDateTime desde,
            @Param("hasta") LocalDateTime hasta
    );
}
