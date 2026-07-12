package pucp.edu.pe.tasfb2b.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import pucp.edu.pe.tasfb2b.entities.Vuelo;

@Repository
public interface VueloRepository extends JpaRepository<Vuelo, Integer> {

    List<Vuelo> findByDesde_Codigo(String codigo);

    List<Vuelo> findByHasta_Codigo(String codigo);

    List<Vuelo> findByDesde_CodigoAndHasta_Codigo(String codigoDesde, String codigoHasta);

    @EntityGraph(attributePaths = {"desde", "hasta"})
    @Query("""
            select distinct v
            from Vuelo v
            where v.desde.codigo = :codigo or v.hasta.codigo = :codigo
            order by v.idVuelo asc
            """)
    List<Vuelo> findConectadosByAeropuertoCodigo(@Param("codigo") String codigo);
}
