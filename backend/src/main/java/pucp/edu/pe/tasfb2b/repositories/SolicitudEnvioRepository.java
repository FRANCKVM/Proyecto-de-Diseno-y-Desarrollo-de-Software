package pucp.edu.pe.tasfb2b.repositories;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
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
}