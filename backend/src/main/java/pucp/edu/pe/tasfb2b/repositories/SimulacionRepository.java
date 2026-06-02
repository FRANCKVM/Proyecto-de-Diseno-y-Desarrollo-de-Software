package pucp.edu.pe.tasfb2b.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pucp.edu.pe.tasfb2b.entities.Simulacion;

import java.util.List;

@Repository
public interface SimulacionRepository extends JpaRepository<Simulacion, Integer> {
    List<Simulacion> findByActivaTrue();
}
