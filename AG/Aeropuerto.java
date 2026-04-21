import java.util.Objects;

public class Aeropuerto {
	private final String codigo;
	private final String ciudad;
	private final String region;
	private final int desplazamientoGMT;
	private final int capacidad;

	public Aeropuerto(String codigo, String ciudad, String region) {
		this(codigo, ciudad, region, 0, 0);
	}

	public Aeropuerto(String codigo, String ciudad, String region, int desplazamientoGMT, int capacidad) {
		this.codigo = codigo;
		this.ciudad = ciudad;
		this.region = region;
		this.desplazamientoGMT = desplazamientoGMT;
		this.capacidad = capacidad;
	}

	public String getCodigo() {
		return codigo;
	}

	public String getCiudad() {
		return ciudad;
	}

	public String getRegion() {
		return region;
	}

	public int getDesplazamientoGMT() {
		return desplazamientoGMT;
	}

	public int getCapacidad() {
		return capacidad;
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (!(o instanceof Aeropuerto aeropuerto)) {
			return false;
		}
		return Objects.equals(codigo, aeropuerto.codigo);
	}

	@Override
	public int hashCode() {
		return Objects.hash(codigo);
	}

	@Override
	public String toString() {
		return codigo + " (" + ciudad + ", " + region + ")";
	}
}
