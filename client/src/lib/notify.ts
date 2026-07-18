import { sileo } from 'sileo';
import { getErrorMessage } from './api';

const shared = {
  fill: '#191917',
  roundness: 8,
  duration: 5200,
  styles: {
    title: 'goliat-sileo-title',
    description: 'goliat-sileo-description',
    badge: 'goliat-sileo-badge',
    button: 'goliat-sileo-button',
  },
} as const;

export const notify = {
  success: (title: string, description?: string) => sileo.success({ ...shared, title, description }),
  error: (title: string, description?: string) => sileo.error({ ...shared, title, description, duration: 7000 }),
  warning: (title: string, description?: string) => sileo.warning({ ...shared, title, description }),
  info: (title: string, description?: string) => sileo.info({ ...shared, title, description }),
  promise: <T>(promise: Promise<T>, messages: {
    loading: string;
    success: string | ((value: T) => string);
    error: string;
  }) => sileo.promise(promise, {
    loading: { ...shared, title: messages.loading, duration: null },
    success: (value) => ({ ...shared, title: typeof messages.success === 'function' ? messages.success(value) : messages.success }),
    error: (error) => ({ ...shared, title: messages.error, description: getErrorMessage(error) }),
  }),
};
