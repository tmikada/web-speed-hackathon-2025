import { createContext, useContext } from 'react';
export const CssContext = createContext('');
export const useCss = () => useContext(CssContext);
