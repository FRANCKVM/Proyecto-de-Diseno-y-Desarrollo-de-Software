public class ShipmentRequest {
    private final Airport origin;
    private final Airport destination;
    private final int bagCount;
    private final double maxTimeDays;

    public ShipmentRequest(Airport origin, Airport destination, int bagCount, double maxTimeDays) {
        this.origin = origin;
        this.destination = destination;
        this.bagCount = bagCount;
        this.maxTimeDays = maxTimeDays;
    }

    public Airport getOrigin() {
        return origin;
    }

    public Airport getDestination() {
        return destination;
    }

    public int getBagCount() {
        return bagCount;
    }

    public double getMaxTimeDays() {
        return maxTimeDays;
    }
}