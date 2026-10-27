import { readChoice } from '../lib/cookie-choice';
import { cookieRegion } from './cookie-region';
// Start only the existing necessary region check while HTML is still parsing.
// No UI, storage mutation, tracking or third-party request runs here.
if (!readChoice()) void cookieRegion();
