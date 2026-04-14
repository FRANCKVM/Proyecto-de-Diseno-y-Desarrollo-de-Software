import java.util.Objects;

public class Airport {
	private final String code;
	private final String city;
	private final String region;
	private final int gmtOffset;
	private final int capacity;

	public Airport(String code, String city, String region) {
		this(code, city, region, 0, 0);
	}

	public Airport(String code, String city, String region, int gmtOffset, int capacity) {
		this.code = code;
		this.city = city;
		this.region = region;
		this.gmtOffset = gmtOffset;
		this.capacity = capacity;
	}

	public String getCode() {
		return code;
	}

	public String getCity() {
		return city;
	}

	public String getRegion() {
		return region;
	}

	public int getGmtOffset() {
		return gmtOffset;
	}

	public int getCapacity() {
		return capacity;
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (!(o instanceof Airport airport)) {
			return false;
		}
		return Objects.equals(code, airport.code);
	}

	@Override
	public int hashCode() {
		return Objects.hash(code);
	}

	@Override
	public String toString() {
		return code + " (" + city + ", " + region + ")";
	}
}
