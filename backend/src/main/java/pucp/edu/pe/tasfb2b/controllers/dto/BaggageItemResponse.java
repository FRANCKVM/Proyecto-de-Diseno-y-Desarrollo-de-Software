package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;

public record BaggageItemResponse(
        String id,
        Integer shipmentId,
        String shipmentCode,
        String shipmentApiCode,
        int bagIndex,
        String routeLabel,
        List<RouteSegmentResponse> routeSegments,
        boolean assigned,
        String status,
        String originIcao,
        String destinationIcao
) {
    public record RouteSegmentResponse(
            String fromIcao,
            String toIcao
    ) {
    }
}
