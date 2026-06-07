import type {BluebirdStatic} from './types';
import PromiseImpl from 'bluebird';

export const Promise = PromiseImpl as BluebirdStatic;
