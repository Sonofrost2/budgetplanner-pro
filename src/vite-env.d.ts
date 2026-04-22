/// <reference types="vite/client" />

// Recharts class components (PureComponent<P,S,SS>) trip TS2786/TS2607 against
// @types/react 18's 2-arg Component class. With jsx: "react-jsx" the JSX
// namespace is imported from react/jsx-runtime, so we augment ElementClass
// there to accept any class-like component.
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface ElementClass {
      render: any;
    }
  }
}
declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface ElementClass {
      render: any;
    }
  }
}
