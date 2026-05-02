/**
 * Concatena classnames condicionales filtrando valores falsy.
 * Alternativa minima a clsx mientras no se instale shadcn/ui (que la trae).
 *
 * @example
 * cn("base", isActive && "active", disabled ? "opacity-50" : null);
 */
export const cn = (
  ...classes: (string | false | null | undefined)[]
): string => classes.filter(Boolean).join(" ");
