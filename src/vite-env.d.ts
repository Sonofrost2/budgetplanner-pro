/// <reference types="vite/client" />

// Recharts class components (PureComponent<P,S,SS>) trip TS2786/TS2607 because
// @types/react 18 declares `class Component<P, S>` (2 args) while recharts'
// PureComponent extends a 3-arg signature via declaration-merging. Augment the
// React class declaration with a 3rd optional type param so recharts class
// components are accepted as JSX elements.
import type {} from 'react';
declare module 'react' {
  interface Component<P = {}, S = {}, SS = any> {
    render(): ReactNode;
  }
}
