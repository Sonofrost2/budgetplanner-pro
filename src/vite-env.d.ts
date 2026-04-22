/// <reference types="vite/client" />

// Recharts class components (PureComponent<P,S,SS>) trip TS2786/TS2607 against
// @types/react 18's 2-arg Component class. Relax JSX.ElementClass so any
// object-typed component is accepted as a valid JSX element.
declare global {
  namespace JSX {
    interface ElementClass {
      render: any;
    }
  }
}
export {};
