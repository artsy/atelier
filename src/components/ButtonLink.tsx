import { Button, type ButtonProps } from "@artsy/palette";

type ButtonLinkProps = Omit<ButtonProps, keyof React.ButtonHTMLAttributes<HTMLButtonElement>> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>;

// Palette's Button forwards `as` to its styled container at runtime, but its
// types don't model polymorphism, so the cast is confined to this wrapper.
const AnchorButton = Button as unknown as React.ComponentType<ButtonLinkProps & { as: "a" }>;

export function ButtonLink(props: ButtonLinkProps) {
  return <AnchorButton as="a" {...props} />;
}
