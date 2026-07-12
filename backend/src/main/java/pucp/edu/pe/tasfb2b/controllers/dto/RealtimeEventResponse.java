package pucp.edu.pe.tasfb2b.controllers.dto;

import java.time.Instant;

public record RealtimeEventResponse(
        String type,
        Integer idSimulacion,
        Object payload,
        Instant timestamp
) {
}
