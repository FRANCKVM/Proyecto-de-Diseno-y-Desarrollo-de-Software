public class Flight {
    private final Airport from;
    private final Airport to;
    private final double travelTimeDays;
    private final int capacity;
    private int usedCapacity;
    private boolean cancelled;

    public Flight(Airport from, Airport to, double travelTimeDays, int capacity) {
        this.from = from;
        this.to = to;
        this.travelTimeDays = travelTimeDays;
        this.capacity = capacity;
        this.usedCapacity = 0;
        this.cancelled = false;
    }

    public Airport getFrom() {
        return from;
    }

    public Airport getTo() {
        return to;
    }

    public double getTravelTimeDays() {
        return travelTimeDays;
    }

    public int getCapacity() {
        return capacity;
    }

    public int getAvailableCapacity() {
        return capacity - usedCapacity;
    }

    public boolean hasCapacity(int bags) {
        return !cancelled && getAvailableCapacity() >= bags;
    }

    public void reserve(int bags) {
        if (!hasCapacity(bags)) {
            throw new IllegalStateException("No hay capacidad suficiente en el vuelo.");
        }
        usedCapacity += bags;
    }

    public boolean isCancelled() {
        return cancelled;
    }

    public void setCancelled(boolean cancelled) {
        this.cancelled = cancelled;
    }

    @Override
    public String toString() {
        return from.getCode() + " -> " + to.getCode() +
               " | tiempo=" + travelTimeDays +
               " | capDisp=" + getAvailableCapacity() +
               " | cancelado=" + cancelled;
    }
}