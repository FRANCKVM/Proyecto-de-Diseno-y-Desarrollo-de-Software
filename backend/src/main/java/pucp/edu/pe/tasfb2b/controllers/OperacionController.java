package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pucp.edu.pe.tasfb2b.controllers.dto.RegistrarOperacionEnvioRequest;
import pucp.edu.pe.tasfb2b.services.OperationSseService;
import pucp.edu.pe.tasfb2b.services.OperacionesService;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/operacion")
public class OperacionController {

    private final OperacionesService operacionesService;
    private final OperationSseService operationSseService;

    public OperacionController(
            OperacionesService operacionesService,
            OperationSseService operationSseService
    ) {
        this.operacionesService = operacionesService;
        this.operationSseService = operationSseService;
    }

    @GetMapping("/estado")
    public ResponseEntity<?> obtenerEstado() {
        return ResponseEntity.ok(operacionesService.obtenerEstadoOperacion());
    }

    @GetMapping("/envios")
    public ResponseEntity<?> obtenerEnvios() {
        return ResponseEntity.ok(operacionesService.obtenerEnviosOperacion());
    }

    @GetMapping("/resumen-home")
    public ResponseEntity<?> obtenerResumenHome(
            @RequestParam(defaultValue = "5") int limiteActividad
    ) {
        return ResponseEntity.ok(operacionesService.obtenerResumenHomeOperacion(limiteActividad));
    }

    @GetMapping("/envios/pagina")
    public ResponseEntity<?> obtenerEnviosPaginados(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "80") int size,
            @RequestParam(required = false) String codigo,
            @RequestParam(defaultValue = "todos") String estado,
            @RequestParam(defaultValue = "todos") String aeropuerto,
            @RequestParam(defaultValue = "todos") String direccion,
            @RequestParam(required = false) Integer horasEntregados
    ) {
        return ResponseEntity.ok(operacionesService.obtenerEnviosOperacionPaginados(
                page,
                size,
                codigo,
                estado,
                aeropuerto,
                direccion,
                horasEntregados
        ));
    }

    @GetMapping("/maletas")
    public ResponseEntity<?> obtenerMaletasPaginadas(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(required = false) String codigo,
            @RequestParam(defaultValue = "todos") String estado,
            @RequestParam(defaultValue = "todos") String aeropuerto,
            @RequestParam(required = false) Integer horasEntregados
    ) {
        return ResponseEntity.ok(operacionesService.obtenerMaletasOperacionPaginadas(
                page,
                size,
                codigo,
                estado,
                aeropuerto,
                horasEntregados
        ));
    }

    @PostMapping("/envios")
    public ResponseEntity<?> registrarEnvio(@RequestBody RegistrarOperacionEnvioRequest request) {
        try {
            return ResponseEntity.ok(operacionesService.registrarEnvioOperacion(request));
        } catch (ObjectOptimisticLockingFailureException e) {
            return ResponseEntity.status(409).body(
                    "La capacidad de uno de los vuelos cambio mientras se registraba el envio. Intente nuevamente."
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/mapa")
    public ResponseEntity<?> obtenerMapa() {
        return ResponseEntity.ok(operacionesService.obtenerMapaOperacion());
    }

    @GetMapping(
            value = "/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter stream() {
        return operationSseService.subscribe();
    }
}
