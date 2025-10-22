/**
 * Minimal type declarations for Cypress (optional peer dependency)
 * These types allow compilation when Cypress is not installed
 */

declare namespace Cypress {
  interface Chainable<Subject = any> {
    then<S>(fn: (subject: Subject) => S): Chainable<S>;
    catch(fn: (error: Error) => void): Chainable<Subject>;
  }
}

declare global {
  interface JQuery<TElement = HTMLElement> {
    length: number;
    [index: number]: TElement;
  }
}

export {};

