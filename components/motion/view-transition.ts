/// <reference types="react/canary" />
/**
 * React's <ViewTransition> (shipped in the React build that Next 16 bundles; the types live
 * in react/canary). Navigations in the App Router run as transitions, so wrapped elements
 * animate between pages with the browser's View Transitions API; browsers without it simply
 * navigate. Reduced motion turns the animations off (globals.css).
 */
export { ViewTransition } from "react"
