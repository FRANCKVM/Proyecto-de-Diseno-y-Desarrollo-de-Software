package pucp.edu.pe.tasfb2b.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import pucp.edu.pe.tasfb2b.entities.ResultadoSimulacion;

import java.util.Optional;

public interface ResultadoSimulacionRepository extends JpaRepository<ResultadoSimulacion, Integer> {
    Optional<ResultadoSimulacion> findBySimulacion_IdSimulacion(Integer idSimulacion);
}
