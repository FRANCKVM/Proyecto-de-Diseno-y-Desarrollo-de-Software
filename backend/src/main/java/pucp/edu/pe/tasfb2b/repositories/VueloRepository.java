package pucp.edu.pe.tasfb2b.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import pucp.edu.pe.tasfb2b.entities.Vuelo;

@Repository
public interface VueloRepository extends JpaRepository<Vuelo, Integer> {

    List<Vuelo> findByDesde_Codigo(String codigo);

    List<Vuelo> findByHasta_Codigo(String codigo);

    List<Vuelo> findByCancelado(Boolean cancelado);

    List<Vuelo> findByDesde_CodigoAndHasta_Codigo(String codigoDesde, String codigoHasta);
}