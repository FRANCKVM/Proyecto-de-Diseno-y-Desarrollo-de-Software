package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;
import java.util.Map;

public record PagedResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasMore,
        Map<String, Long> countsByStatus,
        Map<String, Long> countsByDirection
) {
}
