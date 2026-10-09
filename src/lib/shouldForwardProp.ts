import isPropValid from "@emotion/is-prop-valid";

// Restores styled-components v5's default prop filtering, as in Force and
// Forque; v6 forwards every prop to DOM targets.
export function shouldForwardProp(propName: string, target: unknown): boolean {
  if (typeof target === "string") {
    return isPropValid(propName);
  }
  return true;
}
