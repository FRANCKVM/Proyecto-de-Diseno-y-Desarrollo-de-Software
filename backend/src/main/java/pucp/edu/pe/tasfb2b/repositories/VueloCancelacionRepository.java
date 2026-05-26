package pucp.edu.pe.tasfb2b.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pucp.edu.pe.tasfb2b.entities.VueloCancelacion;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VueloCancelacionRepository extends JpaRepository<VueloCancelacion, Integer> {

    boolean existsByVuelo_IdVueloAndFechaHoraSalida(Integer idVuelo, LocalDateTime fechaHoraSalida);

    Optional<VueloCancelacion> findByVuelo_IdVueloAndFechaHoraSalida(Integer idVuelo, LocalDateTime fechaHoraSalida);

    List<VueloCancelacion> findByFechaHoraCancelacionBetween(LocalDateTime desde, LocalDateTime hasta);

    List<VueloCancelacion> findByFechaHoraSalidaBetween(LocalDateTime desde, LocalDateTime hasta);
}
