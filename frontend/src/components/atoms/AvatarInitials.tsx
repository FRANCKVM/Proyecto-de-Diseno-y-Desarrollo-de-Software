import { cn } from "@/utils/cn";

type AvatarSize = "sm" | "md";

interface AvatarInitialsProps {
  nombre: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * Calcula las iniciales del nombre completo.
 * Si hay una sola palabra, toma sus dos primeras letras.
 * Si hay mas, toma la inicial de la primera y la ultima palabra.
 */
const obtenerIniciales = (nombre: string): string => {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-secondary",
  md: "w-9 h-9 text-button",
};

/**
 * Avatar circular con iniciales sobre fondo primario.
 * Estandar 61, seccion 4.6: iconografia minima basada en iniciales.
 */
const AvatarInitials = ({
  nombre,
  size = "md",
  className,
}: AvatarInitialsProps) => (
  <div
    className={cn(
      "rounded-full bg-primary text-text-inverse font-semibold flex items-center justify-center shrink-0",
      SIZE_CLASS[size],
      className
    )}
    aria-label={`Avatar de ${nombre}`}
  >
    {obtenerIniciales(nombre)}
  </div>
);

export default AvatarInitials;
