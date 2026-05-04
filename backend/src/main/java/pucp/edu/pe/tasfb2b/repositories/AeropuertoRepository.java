package pucp.edu.pe.tasfb2b.repositories;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;

@Repository
public interface AeropuertoRepository extends JpaRepository<Aeropuerto, String> {

    Optional<Aeropuerto> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);
}